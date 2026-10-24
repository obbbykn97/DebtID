/* =====================================================================
   DebtID — core (no DOM): interest math, formatting, QR codes,
   digital signatures (ECDSA P-256), verification codes and backups.
   ===================================================================== */
const DebtID = (() => {
  'use strict';

  // Secret for the visual scrambling. Kept from "Fiado" so old (v1) codes still open.
  // It is not protection: v2 codes are secured by the digital signatures.
  const SEGREDO = 'fiado·v1·7c2e91d4-b83f-4a6e-9f15-2d0ac4e8b6f3';
  const MODOS = ['total', 'mes', 'ano'];
  const PAPEIS = ['credor', 'devedor'];
  const LIMITES = { valor: 100000000000, taxa: 10000000, dias: 36500, nomeBytes: 320 };

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8', { fatal: true });
  const subtle = () => {
    if (!globalThis.crypto || !crypto.subtle) throw new ChaveErro('SEM_CRIPTO');
    return crypto.subtle;
  };

  class ChaveErro extends Error {
    constructor(codigo) { super(codigo); this.codigo = codigo; }
  }

  /* =================== interest math =================== */
  // x in cents (may be fractional). toFixed(4) strips binary noise
  // (e.g. 26438.000000000004) before ALWAYS rounding up.
  const ceilCentavos = x => Math.ceil(Number(x.toFixed(4)));

  // d.valor: cents · d.taxa: percent × 10,000 · d.de/d.dp: days since 1970
  // Simple:   I = P · i · n
  // Compound: A = P · (1 + i)^n  (n may be fractional: exponential convention)
  // n = days/30 (monthly, 30-day month) or days/365 (yearly); "total" applies the rate once.
  function calcular(d) {
    const dias = d.dp - d.de;
    const periodos = d.modo === 'mes' ? dias / 30 : d.modo === 'ano' ? dias / 365 : 1;
    let juros;
    if (d.composto && d.modo !== 'total') {
      juros = d.valor * (Math.pow(1 + d.taxa / 1e6, periodos) - 1);
    } else {
      let num = d.valor * d.taxa, den = 1e6;
      if (d.modo === 'mes') { num *= dias; den *= 30; }
      if (d.modo === 'ano') { num *= dias; den *= 365; }
      juros = num / den;
    }
    const jurosCentavos = Number(juros.toFixed(4));
    const total = ceilCentavos(d.valor + juros);
    return { dias, periodos, jurosCentavos, total, lucro: total - d.valor };
  }
  // For compound interest, accept a 1-cent difference on recalculation (Math.pow may differ
  // in the last digit across browsers). The signed total is authoritative.
  function conferirTotal(d, total) {
    const c = calcular(d);
    if (c.total === total) return c;
    if (d.composto && Math.abs(c.total - total) <= 1) return { ...c, total, lucro: total - d.valor };
    throw new ChaveErro('INCONSISTENTE');
  }

  /* =================== bytes =================== */
  const juntar = (...partes) => {
    let n = 0;
    for (const p of partes) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of partes) { out.set(p, o); o += p.length; }
    return out;
  };
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const iguais = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const sha256 = async b => new Uint8Array(await subtle().digest('SHA-256', b));

  class Escritor {
    constructor() { this.a = []; }
    byte(n) { this.a.push(n & 255); }
    bytes(b) { for (const x of b) this.a.push(x); }
    num(n) { // unsigned varint (LEB128), safe up to 2^53
      if (!Number.isSafeInteger(n) || n < 0) throw new RangeError('número fora do intervalo');
      while (n >= 128) { this.a.push((n % 128) + 128); n = Math.floor(n / 128); }
      this.a.push(n);
    }
    texto(s) { const b = enc.encode(s); this.num(b.length); this.bytes(b); }
    fim() { return Uint8Array.from(this.a); }
  }
  class Leitor {
    constructor(buf) { this.b = buf; this.i = 0; }
    byte() { if (this.i >= this.b.length) throw new ChaveErro('CORROMPIDA'); return this.b[this.i++]; }
    bytes(n) {
      if (this.i + n > this.b.length) throw new ChaveErro('CORROMPIDA');
      const s = this.b.slice(this.i, this.i + n); this.i += n; return s;
    }
    num() {
      let n = 0, mul = 1, b, passos = 0;
      do {
        if (++passos > 8) throw new ChaveErro('CORROMPIDA');
        b = this.byte(); n += (b & 127) * mul; mul *= 128;
      } while (b & 128);
      return n;
    }
    texto() {
      const len = this.num();
      if (len < 1 || len > LIMITES.nomeBytes) throw new ChaveErro('CORROMPIDA');
      let s;
      try { s = dec.decode(this.bytes(len)); } catch (e) { throw new ChaveErro('CORROMPIDA'); }
      if (!s.trim()) throw new ChaveErro('CORROMPIDA');
      return s;
    }
    acabou() { return this.i === this.b.length; }
  }

  /* =================== code wrapping =================== */
  // base64url( [salt ⊕ stream(secret)] + [data ⊕ stream(secret+salt)] ) + "-" + checksum
  function fnv1a(bytes, h = 0x811c9dc5) {
    for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  }
  function fluxo(semente, n) { // mulberry32
    let s = semente >>> 0;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 4) {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      t = (t ^ (t >>> 14)) >>> 0;
      for (let k = 0; k < 4 && i + k < n; k++) out[i + k] = (t >>> (k * 8)) & 255;
    }
    return out;
  }
  const SEG = enc.encode(SEGREDO);
  const SEMENTE_SAL = fnv1a(SEG);
  const sementeDados = sal => fnv1a(sal, fnv1a(SEG) ^ 0x9E3779B9);
  const xor = (a, b) => a.map((v, i) => v ^ b[i]);

  function b64url(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function deB64url(str) {
    if (!/^[A-Za-z0-9_-]+$/.test(str) || str.length % 4 === 1) throw new ChaveErro('FORMATO');
    let s = str.replace(/-/g, '+').replace(/_/g, '/');
    s += '='.repeat((4 - (s.length % 4)) % 4);
    let bin;
    try { bin = atob(s); } catch (e) { throw new ChaveErro('FORMATO'); }
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const checksum = corpo => (fnv1a(enc.encode(corpo)) % 1679616).toString(36).toUpperCase().padStart(4, '0');

  function embalar(dados) {
    const sal = crypto.getRandomValues(new Uint8Array(4));
    const bruto = juntar(xor(sal, fluxo(SEMENTE_SAL, 4)), xor(dados, fluxo(sementeDados(sal), dados.length)));
    const corpo = b64url(bruto);
    return corpo + '-' + checksum(corpo);
  }
  // Code candidates inside pasted text (a WhatsApp message, a PDF with line breaks, etc.)
  const PADRAO_CODIGO = /[A-Za-z0-9_-]{24,}-[0-9A-Za-z]{4}(?![A-Za-z0-9_-])/g;
  function candidatos(txt) {
    const s = String(txt || '');
    const lista = [s.replace(/[\s"'`]/g, '')];
    for (const fonte of [s, s.replace(/[ \t]*\r?\n[ \t]*/g, '')]) {
      for (const m of fonte.match(PADRAO_CODIGO) || []) lista.push(m);
    }
    return [...new Set(lista.filter(Boolean))];
  }
  function separar(s) {
    const corte = s.lastIndexOf('-');
    if (corte < 1) return null;
    const corpo = s.slice(0, corte), soma = s.slice(corte + 1).toUpperCase();
    if (!/^[0-9A-Z]{4}$/.test(soma) || !/^[A-Za-z0-9_-]+$/.test(corpo)) return null;
    return { corpo, soma };
  }
  function extrairCodigo(txt) {
    let comFormato = null;
    for (const c of candidatos(txt)) {
      const p = separar(c);
      if (!p) continue;
      if (checksum(p.corpo) === p.soma) return p.corpo + '-' + p.soma;
      comFormato = comFormato || c;
    }
    return comFormato ? { erro: 'CHECKSUM' } : { erro: String(txt || '').trim() ? 'FORMATO' : 'VAZIA' };
  }
  function desembalar(txt) {
    const achado = extrairCodigo(txt);
    if (typeof achado !== 'string') throw new ChaveErro(achado.erro);
    const { corpo, soma } = separar(achado);
    const bruto = deB64url(corpo);
    if (bruto.length < 4 + 14) throw new ChaveErro('CORROMPIDA');
    const sal = xor(bruto.subarray(0, 4), fluxo(SEMENTE_SAL, 4));
    const resto = bruto.subarray(4);
    return { dados: xor(resto, fluxo(sementeDados(sal), resto.length)), codigo: corpo + '-' + soma };
  }

  /* =================== legacy codes (v1, unsigned) =================== */
  function lerV1(buf) {
    const L = new Leitor(buf);
    if (L.byte() !== 1) throw new ChaveErro('VERSAO');
    const modo = MODOS[L.byte()];
    if (!modo) throw new ChaveErro('CORROMPIDA');
    const valor = L.num(), taxa = L.num(), de = L.num(), dias = L.num();
    const ts = L.num(), tz = L.num() - 64, total = L.num();
    const credor = L.texto(), devedor = L.texto();
    if (!L.acabou()) throw new ChaveErro('CORROMPIDA');
    const d = { valor, taxa, modo, de, dp: de + dias, ts, tz };
    validarDados(d);
    if (calcular(d).total !== total) throw new ChaveErro('INCONSISTENTE');
    d.total = total;
    return { d, credor, devedor };
  }
  function validarDados(d) {
    if (d.valor < 1 || d.valor > LIMITES.valor || d.taxa > LIMITES.taxa || d.dp - d.de > LIMITES.dias ||
        d.de > 120000 || d.ts > 8e9 || d.tz < -60 || d.tz > 60) throw new ChaveErro('CORROMPIDA');
  }

  /* =================== signing keys (ECDSA P-256) =================== */
  const P = 0xffffffff00000001000000000000000000000000ffffffffffffffffffffffffn;
  const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;
  const ALG = { name: 'ECDSA', namedCurve: 'P-256' };
  const ALG_ASSINAR = { name: 'ECDSA', hash: 'SHA-256' };

  const bigDe = b => BigInt('0x' + (hex(b) || '0'));
  const bytesDe = (n, len) => {
    const h = n.toString(16).padStart(len * 2, '0');
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  };
  const mod = n => ((n % P) + P) % P;
  function potencia(base, exp) {
    let r = 1n; base = mod(base);
    while (exp > 0n) { if (exp & 1n) r = (r * base) % P; base = (base * base) % P; exp >>= 1n; }
    return r;
  }
  // 65 bytes (04|X|Y) → 33 bytes (02/03|X)
  function comprimir(raw) {
    if (raw.length !== 65 || raw[0] !== 4) throw new Error('chave pública inesperada');
    return juntar([2 | (raw[64] & 1)], raw.slice(1, 33));
  }
  function descomprimir(c) {
    if (c.length !== 33 || (c[0] !== 2 && c[0] !== 3)) throw new ChaveErro('CORROMPIDA');
    const x = bigDe(c.slice(1));
    if (x >= P) throw new ChaveErro('CORROMPIDA');
    const y2 = mod(x * x * x - 3n * x + B);
    let y = potencia(y2, (P + 1n) / 4n);
    if ((y * y) % P !== y2) throw new ChaveErro('CORROMPIDA');
    if (Number(y & 1n) !== (c[0] & 1)) y = P - y;
    return juntar([4], c.slice(1), bytesDe(y, 32));
  }

  async function idDe(pub33) {
    const h = hex(await sha256(pub33)).slice(0, 12).toUpperCase();
    return `${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
  }

  const cacheChaves = new WeakMap();
  async function chavePrivada(perfil) {
    if (!cacheChaves.has(perfil)) {
      cacheChaves.set(perfil, await subtle().importKey('jwk', perfil.jwk, ALG, false, ['sign']));
    }
    return cacheChaves.get(perfil);
  }
  async function criarPerfil(nome) {
    const par = await subtle().generateKey(ALG, true, ['sign', 'verify']);
    const jwk = await subtle().exportKey('jwk', par.privateKey);
    const raw = new Uint8Array(await subtle().exportKey('raw', par.publicKey));
    const pub = comprimir(raw);
    return { v: 1, nome, criadoEm: Date.now(), jwk: { kty: jwk.kty, crv: jwk.crv, d: jwk.d, x: jwk.x, y: jwk.y }, pub: b64url(pub), id: await idDe(pub) };
  }
  const pubDoPerfil = perfil => deB64url(perfil.pub);
  async function assinar(perfil, msg) {
    return new Uint8Array(await subtle().sign(ALG_ASSINAR, await chavePrivada(perfil), msg));
  }
  async function confere(pub33, msg, sig) {
    try {
      const k = await subtle().importKey('raw', descomprimir(pub33), ALG, false, ['verify']);
      return await subtle().verify(ALG_ASSINAR, k, sig, msg);
    } catch (e) {
      return false;
    }
  }

  /* =================== v2 codes (signed) =================== */
  // [2][type] + P (loan) + issuer signature (+ C (confirmation) + confirmer signature)
  const VERSAO = 2, PROPOSTA = 1, VALIDADO = 2;
  const TAG_PROPOSTA = enc.encode('DebtID/v2/proposta');
  const TAG_CONFIRMA = enc.encode('DebtID/v2/confirma');

  function escreverP(d) {
    const e = new Escritor();
    e.bytes(d.id);
    e.byte(MODOS.indexOf(d.modo) | (PAPEIS.indexOf(d.papel) << 2) | (d.composto ? 8 : 0));
    e.num(d.valor); e.num(d.taxa); e.num(d.de); e.num(d.dp - d.de);
    e.num(d.ts); e.num(d.tz + 64); e.num(d.total);
    e.texto(d.nomeEmissor); e.texto(d.nomeOutro);
    e.bytes(d.pubEmissor);
    return e.fim();
  }
  function lerP(L) {
    const ini = L.i;
    const id = L.bytes(6);
    const f = L.byte();
    const modo = MODOS[f & 3], papel = PAPEIS[(f >> 2) & 1], composto = !!(f & 8);
    if (!modo || f > 15) throw new ChaveErro('CORROMPIDA');
    const valor = L.num(), taxa = L.num(), de = L.num(), dias = L.num();
    const ts = L.num(), tz = L.num() - 64, total = L.num();
    const nomeEmissor = L.texto(), nomeOutro = L.texto();
    const pubEmissor = L.bytes(33);
    const d = { id, modo, composto, papel, valor, taxa, de, dp: de + dias, ts, tz, total, nomeEmissor, nomeOutro, pubEmissor };
    validarDados(d);
    conferirTotal(d, total);
    return { d, bytes: L.b.slice(ini, L.i) };
  }
  function escreverC(c) {
    const e = new Escritor();
    e.num(c.ts); e.num(c.tz + 64); e.texto(c.nome); e.bytes(c.pub);
    return e.fim();
  }
  function lerC(L) {
    const ini = L.i;
    const ts = L.num(), tz = L.num() - 64, nome = L.texto(), pub = L.bytes(33);
    if (ts > 8e9 || tz < -60 || tz > 60) throw new ChaveErro('CORROMPIDA');
    return { c: { ts, tz, nome, pub }, bytes: L.b.slice(ini, L.i) };
  }
  const agora = () => {
    const dt = new Date();
    return { ts: Math.floor(dt.getTime() / 1000), tz: Math.round(-dt.getTimezoneOffset() / 15) };
  };

  // dados: { papel ('credor'|'devedor' — the issuer's role), nomeOutro, valor, taxa, modo, composto, de, dp }
  async function criarProposta(perfil, dados) {
    const { ts, tz } = agora();
    const d = {
      id: crypto.getRandomValues(new Uint8Array(6)),
      modo: dados.modo, composto: !!dados.composto && dados.modo !== 'total', papel: dados.papel,
      valor: dados.valor, taxa: dados.taxa, de: dados.de, dp: dados.dp,
      ts, tz, nomeEmissor: perfil.nome, nomeOutro: dados.nomeOutro, pubEmissor: pubDoPerfil(perfil)
    };
    d.total = calcular(d).total;
    const p = escreverP(d);
    const sig = await assinar(perfil, juntar(TAG_PROPOSTA, p));
    return embalar(juntar([VERSAO, PROPOSTA], p, sig));
  }

  // Confirms someone else's proposal and returns the code validated by both sides.
  async function confirmarProposta(perfil, codigoProposta) {
    const m = await lerCodigo(codigoProposta);
    if (m.tipo !== 'proposta') throw new ChaveErro('NAO_E_PROPOSTA');
    const minha = pubDoPerfil(perfil);
    if (iguais(minha, m.bruto.p.pubEmissor)) throw new ChaveErro('PROPRIA');
    const { ts, tz } = agora();
    const c = escreverC({ ts, tz, nome: perfil.nome, pub: minha });
    const sig2 = await assinar(perfil, juntar(TAG_CONFIRMA, m.bruto.pBytes, m.bruto.sig1, c));
    return embalar(juntar([VERSAO, VALIDADO], m.bruto.pBytes, m.bruto.sig1, c, sig2));
  }

  // Reads any code (v1 or v2), checks the signatures and builds a model for display.
  async function lerCodigo(txt) {
    const { dados, codigo } = desembalar(txt);
    if (dados[0] === 1) {
      const { d, credor, devedor } = lerV1(dados);
      return {
        tipo: 'v1', codigo, idHex: null, ref: codigo.slice(-4), dados: d, calc: calcular(d), emissor: null,
        credor: { nome: credor, assinou: false }, devedor: { nome: devedor, assinou: false }
      };
    }
    if (dados[0] !== VERSAO) throw new ChaveErro('VERSAO');
    const tipo = dados[1];
    if (tipo !== PROPOSTA && tipo !== VALIDADO) throw new ChaveErro('VERSAO');
    const L = new Leitor(dados);
    L.i = 2;
    const { d, bytes: pBytes } = lerP(L);
    const sig1 = L.bytes(64);
    let c = null, cBytes = null, sig2 = null;
    if (tipo === VALIDADO) {
      ({ c, bytes: cBytes } = lerC(L));
      sig2 = L.bytes(64);
    }
    if (!L.acabou()) throw new ChaveErro('CORROMPIDA');
    if (!(await confere(d.pubEmissor, juntar(TAG_PROPOSTA, pBytes), sig1))) throw new ChaveErro('ASSINATURA');
    if (c) {
      if (iguais(c.pub, d.pubEmissor)) throw new ChaveErro('PROPRIA');
      if (!(await confere(c.pub, juntar(TAG_CONFIRMA, pBytes, sig1, cBytes), sig2))) throw new ChaveErro('ASSINATURA');
    }
    const idEmissor = await idDe(d.pubEmissor);
    const parteEmissor = { nome: d.nomeEmissor, id: idEmissor, pub: b64url(d.pubEmissor), assinou: true, ts: d.ts, tz: d.tz };
    const parteOutra = c
      ? { nome: c.nome, id: await idDe(c.pub), pub: b64url(c.pub), assinou: true, ts: c.ts, tz: c.tz, nomeInformado: d.nomeOutro }
      : { nome: d.nomeOutro, assinou: false };
    const dadosExibir = { valor: d.valor, taxa: d.taxa, modo: d.modo, composto: d.composto, de: d.de, dp: d.dp, ts: d.ts, tz: d.tz, total: d.total };
    const idHex = hex(d.id).toUpperCase();
    return {
      tipo: c ? 'validado' : 'proposta', codigo, idHex, ref: `${idHex.slice(0, 4)}-${idHex.slice(4, 8)}`,
      dados: dadosExibir, calc: conferirTotal(d, d.total), emissor: d.papel,
      credor: d.papel === 'credor' ? parteEmissor : parteOutra,
      devedor: d.papel === 'devedor' ? parteEmissor : parteOutra,
      confirmadoEm: c ? { ts: c.ts, tz: c.tz } : null,
      bruto: { p: d, pBytes, sig1 }
    };
  }

  /* =================== password-protected backup =================== */
  const MAGICO = enc.encode('DIDB');
  async function chaveDaSenha(senha, sal) {
    const base = await subtle().importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 210000 },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function exportarBackup(objeto, senha) {
    const sal = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const chave = await chaveDaSenha(senha, sal);
    const cifrado = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(JSON.stringify(objeto))));
    const corpo = b64url(juntar(MAGICO, [1], sal, iv, cifrado));
    return 'DIDB-' + corpo + '-' + checksum(corpo);
  }
  async function importarBackup(txt, senha) {
    const s = String(txt || '').replace(/\s+/g, '');
    const m = /^DIDB-([A-Za-z0-9_-]+)-([0-9A-Za-z]{4})$/.exec(s);
    if (!m) throw new ChaveErro('BACKUP_FORMATO');
    if (checksum(m[1]) !== m[2].toUpperCase()) throw new ChaveErro('BACKUP_FORMATO');
    const b = deB64url(m[1]);
    if (b.length < 4 + 1 + 16 + 12 + 17 || !iguais(b.slice(0, 4), MAGICO) || b[4] !== 1) throw new ChaveErro('BACKUP_FORMATO');
    const chave = await chaveDaSenha(senha, b.slice(5, 21));
    let texto;
    try {
      texto = dec.decode(new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: b.slice(21, 33) }, chave, b.slice(33))));
    } catch (e) {
      throw new ChaveErro('SENHA');
    }
    return JSON.parse(texto);
  }

  /* =================== QR code (byte mode, levels L/M/Q/H) =================== */
  const QR = (() => {
    const NIVEL = { L: [0, 1], M: [1, 0], Q: [2, 3], H: [3, 2] }; // [table index, format bits]
    const ECC = [
      [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
      [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
      [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
    ];
    const BLOCOS = [
      [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
      [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
      [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
      [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
    ];
    const bit = (x, i) => ((x >>> i) & 1) !== 0;
    function modulosBrutos(v) {
      let r = (16 * v + 128) * v + 64;
      if (v >= 2) {
        const n = Math.floor(v / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (v >= 7) r -= 36;
      }
      return r;
    }
    const palavrasDados = (v, e) => Math.floor(modulosBrutos(v) / 8) - ECC[e][v] * BLOCOS[e][v];
    function mult(x, y) { // GF(256), polynomial 0x11D
      let z = 0;
      for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
      return z;
    }
    function divisor(grau) {
      const r = new Array(grau).fill(0);
      r[grau - 1] = 1;
      let raiz = 1;
      for (let i = 0; i < grau; i++) {
        for (let j = 0; j < r.length; j++) { r[j] = mult(r[j], raiz); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
        raiz = mult(raiz, 0x02);
      }
      return r;
    }
    function resto(dados, div) {
      const r = div.map(() => 0);
      for (const b of dados) {
        const fator = b ^ r.shift();
        r.push(0);
        div.forEach((c, i) => { r[i] ^= mult(c, fator); });
      }
      return r;
    }
    function posicoesAlinhamento(v) {
      if (v === 1) return [];
      const n = Math.floor(v / 7) + 2, tam = v * 4 + 17;
      const passo = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      const r = [6];
      for (let p = tam - 7; r.length < n; p -= passo) r.splice(1, 0, p);
      return r;
    }
    function gerar(texto, nivel = 'M') {
      const [e, bitsFormato] = NIVEL[nivel];
      const dados = enc.encode(texto);
      let v = 1;
      for (; v <= 40; v++) {
        const bitsContagem = v <= 9 ? 8 : 16;
        if (4 + bitsContagem + dados.length * 8 <= palavrasDados(v, e) * 8) break;
      }
      if (v > 40) throw new Error('texto grande demais para um QR code');
      const cap = palavrasDados(v, e) * 8;
      const bits = [];
      const poe = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      poe(4, 4); poe(dados.length, v <= 9 ? 8 : 16);
      for (const b of dados) poe(b, 8);
      poe(0, Math.min(4, cap - bits.length));
      poe(0, (8 - (bits.length % 8)) % 8);
      for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) poe(pad, 8);
      const palavras = [];
      for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
        palavras.push(b);
      }
      // blocks + error correction, interleaved
      const nBlocos = BLOCOS[e][v], eccLen = ECC[e][v], brutas = Math.floor(modulosBrutos(v) / 8);
      const nCurtos = nBlocos - (brutas % nBlocos), lenCurto = Math.floor(brutas / nBlocos);
      const div = divisor(eccLen), blocos = [];
      for (let i = 0, k = 0; i < nBlocos; i++) {
        const dat = palavras.slice(k, k + lenCurto - eccLen + (i < nCurtos ? 0 : 1));
        k += dat.length;
        const ecc = resto(dat, div);
        if (i < nCurtos) dat.push(0);
        blocos.push(dat.concat(ecc));
      }
      const final = [];
      for (let i = 0; i < blocos[0].length; i++) {
        blocos.forEach((bl, j) => { if (i !== lenCurto - eccLen || j >= nCurtos) final.push(bl[i]); });
      }
      // matrix
      const tam = v * 4 + 17;
      const m = Array.from({ length: tam }, () => new Array(tam).fill(false));
      const fn = Array.from({ length: tam }, () => new Array(tam).fill(false));
      const fixa = (x, y, escuro) => { m[y][x] = escuro; fn[y][x] = true; };
      for (let i = 0; i < tam; i++) { fixa(6, i, i % 2 === 0); fixa(i, 6, i % 2 === 0); }
      const localizador = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx, y = cy + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
          if (x >= 0 && x < tam && y >= 0 && y < tam) fixa(x, y, dist !== 2 && dist !== 4);
        }
      };
      localizador(3, 3); localizador(tam - 4, 3); localizador(3, tam - 4);
      const al = posicoesAlinhamento(v), na = al.length;
      for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fixa(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
      const formato = mascara => {
        const d = (bitsFormato << 3) | mascara;
        let r = d;
        for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412;
        for (let i = 0; i <= 5; i++) fixa(8, i, bit(b, i));
        fixa(8, 7, bit(b, 6)); fixa(8, 8, bit(b, 7)); fixa(7, 8, bit(b, 8));
        for (let i = 9; i < 15; i++) fixa(14 - i, 8, bit(b, i));
        for (let i = 0; i < 8; i++) fixa(tam - 1 - i, 8, bit(b, i));
        for (let i = 8; i < 15; i++) fixa(8, tam - 15 + i, bit(b, i));
        fixa(8, tam - 8, true);
      };
      formato(0);
      if (v >= 7) {
        let r = v;
        for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
        const b = (v << 12) | r;
        for (let i = 0; i < 18; i++) {
          const a = tam - 11 + (i % 3), c = Math.floor(i / 3);
          fixa(a, c, bit(b, i)); fixa(c, a, bit(b, i));
        }
      }
      // data in zigzag order
      let i = 0;
      for (let dir = tam - 1; dir >= 1; dir -= 2) {
        if (dir === 6) dir = 5;
        for (let vert = 0; vert < tam; vert++) for (let j = 0; j < 2; j++) {
          const x = dir - j, subindo = ((dir + 1) & 2) === 0, y = subindo ? tam - 1 - vert : vert;
          if (!fn[y][x] && i < final.length * 8) { m[y][x] = bit(final[i >>> 3], 7 - (i & 7)); i++; }
        }
      }
      const MASCARAS = [
        (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
        (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
      ];
      const aplica = k => {
        for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) if (!fn[y][x] && MASCARAS[k](x, y)) m[y][x] = !m[y][x];
      };
      const penalidade = () => { // rules 1, 2 and 4 of the spec (enough to pick a mask)
        let p = 0, escuros = 0;
        for (let a = 0; a < tam; a++) {
          let h = 1, v = 1;
          for (let b = 1; b < tam; b++) {
            if (m[a][b] === m[a][b - 1]) h++; else { if (h >= 5) p += h - 2; h = 1; }
            if (m[b][a] === m[b - 1][a]) v++; else { if (v >= 5) p += v - 2; v = 1; }
          }
          if (h >= 5) p += h - 2;
          if (v >= 5) p += v - 2;
        }
        for (let y = 0; y < tam; y++) {
          for (let x = 0; x < tam; x++) {
            if (m[y][x]) escuros++;
            if (x < tam - 1 && y < tam - 1) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3; }
          }
        }
        const total = tam * tam;
        p += Math.floor(Math.abs(escuros * 20 - total * 10) / total) * 10;
        return p;
      };
      let melhor = 0, menor = Infinity;
      for (let k = 0; k < 8; k++) {
        aplica(k); formato(k);
        const p = penalidade();
        if (p < menor) { menor = p; melhor = k; }
        aplica(k);
      }
      aplica(melhor); formato(melhor);
      return { versao: v, tamanho: tam, modulos: m };
    }
    function svg(texto, { nivel = 'M', margem = 4, rotulo = 'QR code' } = {}) {
      const { tamanho, modulos } = gerar(texto, nivel);
      const t = tamanho + margem * 2;
      let d = '';
      for (let y = 0; y < tamanho; y++) {
        for (let x = 0; x < tamanho; x++) {
          if (!modulos[y][x]) continue;
          let w = 1;
          while (x + w < tamanho && modulos[y][x + w]) w++;
          d += `M${x + margem} ${y + margem}h${w}v1h-${w}z`;
          x += w - 1;
        }
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="${rotulo}"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
    }
    return { gerar, svg };
  })();

  /* =================== formatting (pt-BR or English) =================== */
  const LOC = {
    pt: {
      tag: 'pt-BR',
      meses: ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'],
      modo: { total: 'no total', mes: 'ao mês', ano: 'ao ano' }, dia: 'dia', dias: 'dias', as: 'às',
      milhar: '.', decimal: ','
    },
    en: {
      tag: 'en-US',
      meses: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      modo: { total: 'in total', mes: 'per month', ano: 'per year' }, dia: 'day', dias: 'days', as: 'at',
      milhar: ',', decimal: '.'
    }
  };
  let idioma = 'pt', L = LOC.pt, nf2, nf4, nfT;
  /** Sets the language used by fmt, extenso and lerNumero ('pt' or 'en'). Stored codes are not affected. */
  function definirIdioma(l) {
    idioma = l === 'en' ? 'en' : 'pt';
    L = LOC[idioma];
    nf2 = new Intl.NumberFormat(L.tag, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    nf4 = new Intl.NumberFormat(L.tag, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    nfT = new Intl.NumberFormat(L.tag, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
    return idioma;
  }
  definirIdioma('pt');
  const p2 = n => String(n).padStart(2, '0');
  const dataUTC = dia => new Date(dia * 86400000);
  const curto = m => L.meses[m].slice(0, 3);
  const fmt = {
    idioma: () => idioma,
    num2: n => nf2.format(n),
    num: n => nfT.format(n),
    brl: c => 'R$ ' + nf2.format(c / 100),
    brl4: c => 'R$ ' + nf4.format(c / 100),
    taxa: t => nfT.format(t / 10000) + '%',
    modo: m => L.modo[m],
    dias: n => n + ' ' + (n === 1 ? L.dia : L.dias),
    data: dia => {
      const x = dataUTC(dia);
      return idioma === 'en' ? `${curto(x.getUTCMonth())} ${x.getUTCDate()}, ${x.getUTCFullYear()}`
                             : `${p2(x.getUTCDate())}/${p2(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`;
    },
    dataCurta: dia => {
      const x = dataUTC(dia);
      return idioma === 'en' ? `${curto(x.getUTCMonth())} ${x.getUTCDate()}` : `${p2(x.getUTCDate())}/${p2(x.getUTCMonth() + 1)}`;
    },
    dataExtenso: dia => {
      const x = dataUTC(dia), dd = x.getUTCDate(), m = L.meses[x.getUTCMonth()];
      return idioma === 'en' ? `${m} ${dd}, ${x.getUTCFullYear()}` : `${dd === 1 ? '1º' : dd} de ${m} de ${x.getUTCFullYear()}`;
    },
    momento: (ts, tz) => {
      const x = new Date((ts + tz * 900) * 1000), off = tz * 15, a = Math.abs(off);
      const dia = Math.floor((ts + tz * 900) / 86400);
      return `${fmt.data(dia)} ${L.as} ${p2(x.getUTCHours())}:${p2(x.getUTCMinutes())} ` +
             `(UTC${off < 0 ? '−' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)})`;
    }
  };

  /* =================== amounts in words =================== */
  // Brazilian Portuguese
  const UN = ['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  const DZ = ['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  const CT = ['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  const ESCALAS = [null, null, ['milhão','milhões'], ['bilhão','bilhões'], ['trilhão','trilhões']];
  function ate999(n) {
    if (n === 100) return 'cem';
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push(CT[c]);
    if (r) partes.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + UN[r % 10] : ''));
    return partes.join(' e ');
  }
  function inteiroExtenso(n) {
    if (n === 0) return 'zero';
    const grupos = [];
    while (n > 0) { grupos.push(n % 1000); n = Math.floor(n / 1000); }
    const partes = [];
    for (let k = grupos.length - 1; k >= 0; k--) {
      const v = grupos[k];
      if (!v) continue;
      let s;
      if (k === 0) s = ate999(v);
      else if (k === 1) s = v === 1 ? 'mil' : ate999(v) + ' mil';
      else s = ate999(v) + ' ' + ESCALAS[k][v === 1 ? 0 : 1];
      partes.push({ s, v });
    }
    let out = partes[0].s;
    for (let j = 1; j < partes.length; j++) {
      const ultimo = j === partes.length - 1, v = partes[j].v;
      out += (ultimo && (v < 100 || v % 100 === 0)) ? ' e ' : (partes.length > 2 ? ', ' : ' ');
      out += partes[j].s;
    }
    return out;
  }
  // English (the currency stays the Brazilian real: "reais" and "centavos")
  const EN_UN = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
  const EN_DZ = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
  const EN_ESC = ['', 'thousand', 'million', 'billion', 'trillion'];
  function ate999En(n) {
    const c = Math.floor(n / 100), r = n % 100, partes = [];
    if (c) partes.push(EN_UN[c] + ' hundred');
    if (r) partes.push(r < 20 ? EN_UN[r] : EN_DZ[Math.floor(r / 10)] + (r % 10 ? '-' + EN_UN[r % 10] : ''));
    return partes.join(' ');
  }
  function inteiroExtensoEn(n) {
    if (n === 0) return 'zero';
    const partes = [];
    for (let k = 0; n > 0; k++, n = Math.floor(n / 1000)) {
      const v = n % 1000;
      if (v) partes.unshift(ate999En(v) + (k ? ' ' + EN_ESC[k] : ''));
    }
    return partes.join(' ');
  }
  function extenso(centavos) {
    const r = Math.floor(centavos / 100), c = centavos % 100, partes = [];
    if (idioma === 'en') {
      if (r) partes.push(inteiroExtensoEn(r) + (r === 1 ? ' real' : ' reais'));
      if (c) partes.push(inteiroExtensoEn(c) + (c === 1 ? ' centavo' : ' centavos'));
      return partes.length ? partes.join(' and ') : 'zero reais';
    }
    if (r) partes.push(inteiroExtenso(r) + (r >= 1e6 && r % 1e6 === 0 ? ' de ' : ' ') + (r === 1 ? 'real' : 'reais'));
    if (c) partes.push(inteiroExtenso(c) + (c === 1 ? ' centavo' : ' centavos'));
    return partes.length ? partes.join(' e ') : 'zero real';
  }

  /* =================== typed numbers (lenient parsing) ===================
     Accepts both "1.250,50" and "1,250.50". When only one kind of separator appears, the
     current language decides: the decimal mark is "," in Portuguese and "." in English. */
  function lerNumero(bruto, milhar) {
    let s = String(bruto).replace(/[R$\s% ]/g, '');
    if (!s || !/^\d[\d.,]*$|^[.,]\d+$/.test(s)) return NaN;
    const vg = s.lastIndexOf(','), pt = s.lastIndexOf('.');
    if (vg > -1 && pt > -1) {
      const decimal = vg > pt ? ',' : '.';
      s = s.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.');
    } else if (vg > -1 || pt > -1) {
      const sep = vg > -1 ? ',' : '.', partes = s.split(sep);
      if (sep === L.decimal) s = partes.length > 2 ? partes.join('') : partes.join('.');
      else if (partes.length > 2 || (milhar && partes[1].length === 3)) s = partes.join('');
      else s = partes.join('.');
    }
    if ((s.match(/\./g) || []).length > 1) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  return {
    calcular, ceilCentavos, fmt, extenso, lerNumero, definirIdioma, LIMITES, MODOS, ChaveErro,
    criarPerfil, idDe, criarProposta, confirmarProposta, lerCodigo, extrairCodigo,
    exportarBackup, importarBackup, QR,
    _interno: { embalar, desembalar, comprimir, descomprimir, b64url, deB64url, checksum }
  };
})();
