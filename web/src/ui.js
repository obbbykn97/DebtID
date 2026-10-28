/* =====================================================================
   DebtID — user interface (texts live in i18n.js, in Portuguese, English and Spanish)
   ===================================================================== */
(() => {
  'use strict';
  const D = DebtID, { fmt, extenso } = D;
  const { t } = DebtIDIdioma;
  D.definirIdioma(DebtIDIdioma.atual());
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const raiz = document.documentElement;
  const TITULO = document.title;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ico = n => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const rs = s => s.replace(/^(\S+) /, '<i>$1</i>'); // currency symbol in smaller type
  // big number in a stat card: the font shrinks with the number of digits (₿ 0,00510000 has many)
  // (--n ≈ the text width in em: digits are ~0.68em wide in the display font, plus the small symbol)
  const valorStat = s => `<b style="--n:${(s.split(' ').pop().length * 0.68 + 0.8).toFixed(2)}">${rs(s)}</b>`;
  const app = () => window.DebtIDApp || null; // Android app bridge (only exists inside the APK)
  const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const limparNome = s => String(s).normalize('NFC').replace(/\s+/g, ' ').trim();
  const normNome = s => semAcento(limparNome(s));
  const locale = () => fmt.tag(); // language tag for Intl and sorting (with Latin digits)

  /* ---------------- local storage ---------------- */
  const K = {
    perfil: 'debtid.perfil', regs: 'debtid.registros', ui: 'debtid.ui', tema: 'debtid.tema', idioma: 'debtid.idioma', moeda: 'debtid.moeda',
    contatos: 'debtid.contatos', trava: 'debtid.trava', travaErros: 'debtid.trava.erros', backupEm: 'debtid.backup.em',
    backupAdiado: 'debtid.backup.adiado', lembretes: 'debtid.lembretes', texto: 'debtid.texto', ordem: 'debtid.ordem',
    visao: 'debtid.visao', periodo: 'debtid.periodo', grafico: 'debtid.grafico'
  };
  const lerJSON = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } };
  const gravarJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const lerTexto = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarTexto = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } };

  let perfil = lerJSON(K.perfil, null);
  if (perfil && (!perfil.jwk || !perfil.pub || !perfil.id)) perfil = null;
  let registros = lerJSON(K.regs, []);
  if (!Array.isArray(registros)) registros = [];
  let contatos = lerJSON(K.contatos, []);
  if (!Array.isArray(contatos)) contatos = [];

  /* ---------------- records ----------------
     A record: { k (the loan's fingerprint, unique), id (loan id), papel ('credor'|'devedor'), status,
     codigo (the loan code: validated when there is one), tipoCodigo, outro (name), outroPub, outroId,
     moeda, casas, valor, total, de, dp, obs, parcelas, multa, mora,
     recibos: [{ codigo, tipo, valor, dia, ts, tz, rid }] (signed by the creditor),
     quitadoDia / quitadoEm / quitadoAssinado, soRegistro, criadoEm, atualizadoEm }
     status: aguardando · registrado (only I signed) · validado · quitado · cancelado */
  const salvarRegistros = () => {
    if (!gravarJSON(K.regs, registros)) toast(t('toast.semSalvar'));
    agendarLembretes();
  };
  function upsert(r) {
    const i = registros.findIndex(x => x.k === r.k);
    if (i >= 0) registros[i] = { ...registros[i], ...r };
    else registros.push({ criadoEm: Date.now(), recibos: [], ...r });
    salvarRegistros();
    return registros.find(x => x.k === r.k);
  }
  const registroDe = (m, papel, status) => {
    const outro = papel === 'credor' ? m.devedor : m.credor;
    return {
      k: m.hash, id: m.idHex, papel, status, codigo: m.codigo, tipoCodigo: m.tipo,
      outro: outro.nome, outroPub: outro.pub || null, outroId: outro.id || null,
      moeda: m.dados.moeda, casas: m.dados.casas, valor: m.dados.valor, total: m.calc.total, de: m.dados.de, dp: m.dados.dp,
      obs: m.dados.obs || '', parcelas: m.dados.parcelas || 1, multa: m.dados.multa || 0, mora: m.dados.mora || 0,
      atualizadoEm: Date.now()
    };
  };
  const acharReg = m => (m && m.hash ? registros.find(r => r.k === m.hash) : null) || null;
  const recibosDe = r => (r && Array.isArray(r.recibos) ? r.recibos : []);
  const pagamentosLocaisDe = r => (r && r.soRegistro && Array.isArray(r.pagamentosLocais) ? r.pagamentosLocais : []);
  const pagamentosDe = r => [...recibosDe(r).filter(x => x.tipo !== 'cancelamento' && x.valor > 0), ...pagamentosLocaisDe(r)].map(x => ({ dia: x.dia, valor: x.valor }));
  const dadosDe = r => ({ de: r.de, dp: r.dp, parcelas: r.parcelas || 1, multa: r.multa || 0, mora: r.mora || 0 });
  // day number (days since 1970) of a calendar date, and of a moment in the device's time zone
  const diaUTC = (ano, mes, dia) => Math.round(Date.UTC(ano, mes, dia) / 86400000);
  const diaLocal = dt => diaUTC(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const hojeDia = () => diaLocal(new Date());
  // a moment as codes store it: seconds since 1970 and the time zone in quarter hours
  const momentoDe = dt => ({ ts: Math.floor(dt.getTime() / 1000), tz: Math.round(-dt.getTimezoneOffset() / 15) });
  const situacaoDe = (r, dia = hojeDia()) => D.situacao(dadosDe(r), r.total, pagamentosDe(r), dia);
  const emAberto = r => r.status === 'validado' || r.status === 'registrado';
  const temRegras = r => (r.parcelas || 1) > 1 || r.multa > 0 || r.mora > 0;
  // currency of a loan model's data or of a stored record (old ones have none: reais)
  const infoDe = d => D.infoMoeda(d.moeda || 'BRL', d.casas == null ? 2 : d.casas);
  const dinheiro = (v, d) => fmt.dinheiro(Math.round(v), infoDe(d));
  const isoDeDia = dia => new Date(dia * 86400000).toISOString().slice(0, 10);
  // amount (smallest unit) as typed in a field: no thousands separator, at least the cents
  const valorCampo = (v, casas) => {
    const mult = 10 ** casas, i = Math.floor(v / mult);
    let fr = casas ? String(v - i * mult).padStart(casas, '0') : '';
    while (fr.length > Math.min(casas, 2) && fr.endsWith('0')) fr = fr.slice(0, -1);
    return String(i) + (fr ? fmt.sepDecimal() + fr : '');
  };
  // payment day (older records only have the moment the button was pressed)
  const diaQuitado = r => {
    if (r.quitadoDia != null) return r.quitadoDia;
    return diaLocal(new Date(r.quitadoEm || Date.now()));
  };

  // A signed receipt is kept with its loan (both sides keep it). Returns { reg, novo }.
  function guardarRecibo(reg, mr) {
    const lista = recibosDe(reg);
    if (lista.some(x => x.rid === mr.recibo.rid)) return { reg, novo: false };
    const r = mr.recibo;
    const x = { codigo: mr.codigo, tipo: r.tipo, valor: r.valor, dia: r.dia, ts: r.ts, tz: r.tz, rid: r.rid };
    const patch = { k: reg.k, recibos: [...lista, x], atualizadoEm: Date.now() };
    if (r.tipo === 'cancelamento') patch.status = 'cancelado';
    else if (r.tipo === 'quitacao' && reg.status !== 'cancelado') {
      Object.assign(patch, { status: 'quitado', quitadoDia: r.dia, quitadoEm: r.ts * 1000, quitadoAssinado: true });
    }
    return { reg: upsert(patch), novo: true };
  }

  // Records saved by older versions get the new fields (fingerprint, the other person's key...).
  async function migrarRegistros(lista) {
    let mudou = false;
    for (const r of lista) {
      if (!r || !r.codigo || (r.k && r.tipoCodigo)) continue;
      mudou = true;
      try {
        const m = await D.lerCodigo(r.codigo);
        if (!m.hash) { r.k = r.k || 'v1:' + (r.id || r.codigo); r.tipoCodigo = 'v1'; continue; }
        const outro = r.papel === 'credor' ? m.devedor : m.credor;
        Object.assign(r, {
          k: m.hash, id: m.idHex, tipoCodigo: m.tipo, outroPub: outro.pub || null, outroId: outro.id || null,
          obs: m.dados.obs || '', parcelas: m.dados.parcelas || 1, multa: m.dados.multa || 0, mora: m.dados.mora || 0
        });
        if (!Array.isArray(r.recibos)) r.recibos = [];
      } catch {
        r.k = r.k || 'x:' + (r.id || r.codigo); r.tipoCodigo = r.tipoCodigo || '?';
      }
    }
    return mudou;
  }

  /* ---------------- contacts ----------------
     People whose key you have checked. A contact is matched by the full key, never by the name,
     so someone using the same name with another key stands out. */
  const salvarContatos = () => gravarJSON(K.contatos, contatos);
  const contatoDe = pub => (pub ? contatos.find(c => c.pub === pub) || null : null);
  const nomeContato = c => c.apelido || c.nome;
  const homonimos = (nome, pub) => {
    const n = normNome(nome);
    return contatos.filter(c => c.pub !== pub && (normNome(c.nome) === n || (c.apelido && normNome(c.apelido) === n) || (c.nomes || []).some(x => normNome(x) === n)));
  };
  function salvarContato(parte) {
    if (!parte || !parte.pub || (perfil && parte.pub === perfil.pub)) return null;
    let c = contatoDe(parte.pub);
    if (c) {
      if (!(c.nomes || []).includes(parte.nome)) c.nomes = [...(c.nomes || []), parte.nome];
    } else {
      c = { pub: parte.pub, id: parte.id, idLongo: parte.idLongo || parte.id, nome: parte.nome, nomes: [parte.nome], desde: Date.now() };
      contatos.push(c);
    }
    salvarContatos();
    return c;
  }
  // 'conhecido' (in your contacts) · 'homonimo' (a contact has this name with another key) · 'novo'
  function confiancaDe(parte) {
    if (!parte || !parte.pub || (perfil && parte.pub === perfil.pub)) return null;
    if (contatoDe(parte.pub)) return 'conhecido';
    return homonimos(parte.nome, parte.pub).length ? 'homonimo' : 'novo';
  }
  function identidadeHTML(parte) {
    const tipo = confiancaDe(parte);
    if (!tipo) return '';
    const idL = esc(parte.idLongo || parte.id);
    if (tipo === 'conhecido') {
      const c = contatoDe(parte.pub);
      return `<div class="ident ok"><i>${ico('check')}</i><div><b>${t('id.conhecidoT', { nome: esc(nomeContato(c)) })}</b><p>${t('id.conhecido')}</p><code class="id-longo">${idL}</code></div></div>`;
    }
    const salvar = `<div class="btns"><button class="btn" type="button" data-acao="salvar-contato" data-pub="${esc(parte.pub)}">${ico('pessoa')}${t('id.salvar')}</button></div>`;
    if (tipo === 'homonimo') {
      const h = homonimos(parte.nome, parte.pub)[0];
      return `<div class="ident perigo" role="alert"><i>${ico('alerta')}</i><div><b>${t('id.homonimoT')}</b><p>${t('id.homonimo', { nome: esc(parte.nome), salvo: esc(nomeContato(h)), idSalvo: esc(h.id), idNovo: esc(parte.id) })}</p><code class="id-longo">${idL}</code></div></div>`;
    }
    return `<div class="ident novo"><i>${ico('pessoa')}</i><div><b>${t('id.novoT', { nome: esc(parte.nome) })}</b><p>${t('id.novo')}</p><code class="id-longo">${idL}</code>${salvar}</div></div>`;
  }

  /* ---------------- look, theme and text size ---------------- */
  const prefEscuro = matchMedia('(prefers-color-scheme: dark)');
  const temaPref = () => { const v = lerTexto(K.tema); return v === 'dark' || v === 'light' ? v : 'sistema'; };
  function corDasBarras() {
    const cs = getComputedStyle(raiz);
    const pro = raiz.dataset.ui === 'pro', escuro = raiz.dataset.theme === 'dark';
    const topo = cs.getPropertyValue(pro ? '--band' : '--bg').trim();
    const base = cs.getPropertyValue(pro ? '--band' : '--card').trim();
    $('meta[name="theme-color"]').setAttribute('content', topo);
    const a = app();
    if (a && a.systemBars) { try { a.systemBars(topo, !pro && !escuro, base, !pro && !escuro); } catch { /* ignore */ } }
  }
  function aplicarTema() {
    const pref = temaPref();
    const tema = pref === 'sistema' ? (prefEscuro.matches ? 'dark' : 'light') : pref;
    raiz.dataset.theme = tema;
    const rot = t(tema === 'dark' ? 'tema.paraClaro' : 'tema.paraEscuro');
    const b = $('#temaBtn'); b.setAttribute('aria-label', rot); b.title = rot;
    $$('input[name="tema"]').forEach(i => { i.checked = i.value === pref; });
    corDasBarras();
    if (location.hash === '#registros') renderGrafico();
  }
  function aplicarUI(ui) {
    raiz.dataset.ui = ui === 'soft' ? 'soft' : 'pro';
    gravarTexto(K.ui, raiz.dataset.ui);
    $$('input[name="ui"],input[name="ui-bv"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    corDasBarras();
  }
  function aplicarTexto(v) {
    raiz.dataset.texto = v === 'grande' ? 'grande' : 'normal';
    gravarTexto(K.texto, v === 'grande' ? 'grande' : null);
    $$('input[name="texto"]').forEach(i => { i.checked = i.value === raiz.dataset.texto; });
  }
  $('#temaBtn').addEventListener('click', () => {
    gravarTexto(K.tema, raiz.dataset.theme === 'dark' ? 'light' : 'dark');
    aplicarTema();
  });
  const aoMudarSistema = () => { if (temaPref() === 'sistema') aplicarTema(); };
  if (prefEscuro.addEventListener) prefEscuro.addEventListener('change', aoMudarSistema);
  else if (prefEscuro.addListener) prefEscuro.addListener(aoMudarSistema);
  document.addEventListener('change', e => {
    const n = e.target.name;
    if (n === 'ui' || n === 'ui-bv') aplicarUI(e.target.value);
    if (n === 'tema') { gravarTexto(K.tema, e.target.value === 'sistema' ? null : e.target.value); aplicarTema(); }
    if (n === 'texto') aplicarTexto(e.target.value);
    if (n === 'filtro') renderLista();
    if (n === 'periodo') { gravarTexto(K.periodo, e.target.value); renderLucro(); }
    if (n === 'idioma' || n === 'idioma-bv') aplicarIdioma(e.target.value, true);
    if (n === 'travaTempo' && trava) { trava = { ...trava, tempo: +e.target.value }; gravarJSON(K.trava, trava); }
    if (n === 'icone') trocarIcone(e.target.value);
    if (n === 'lembreteDias') { gravarJSON(K.lembretes, { ...cfgLembretes(), dias: +e.target.value }); agendarLembretes(); }
  });

  /* ---------------- toasts and dialogs ---------------- */
  let timerToast;
  function toast(msg) {
    const x = $('#toast'); x.textContent = msg; x.classList.add('show');
    clearTimeout(timerToast); timerToast = setTimeout(() => x.classList.remove('show'), 3200);
  }
  // Confirmation dialog. Optional fields: data (ISO date, with dataMin/dataMax), valor ({ moeda, padrao
  // (smallest unit), rotulo }) and campo ({ rotulo, padrao, max }). Without fields it resolves true/false;
  // with fields, { dia, valor, texto } or false.
  function perguntar({ titulo, texto, ok = t('modal.confirmar'), perigo = false, data = null, dataMin = null, dataMax = null, valor = null, campo = null }) {
    return new Promise(res => {
      const m = $('#modal'), bOk = $('#modalOk'), bNao = $('#modalCancelar');
      const campoData = $('#modalData'), campoValor = $('#modalValor'), campoTexto = $('#modalTextoCampo');
      $('#modalTitulo').textContent = titulo; $('#modalTexto').textContent = texto;
      bOk.textContent = ok; bOk.className = 'btn ' + (perigo ? 'btn-danger' : 'btn-primary');
      $('#modalCampo').hidden = !data;
      if (data) { campoData.value = data; campoData.min = dataMin || ''; campoData.max = dataMax || ''; }
      $('#modalValorCampo').hidden = !valor;
      let info = null;
      if (valor) {
        info = infoDe(valor);
        $('#modalValorRotulo').textContent = valor.rotulo || t('modal.valor');
        $('#modalAffix').textContent = info.simbolo;
        campoValor.value = valor.padrao > 0 ? valorCampo(valor.padrao, info.casas) : '';
        campoValor.placeholder = fmt.numMoeda(0, info.casas);
      }
      $('#modalTextoBloco').hidden = !campo;
      if (campo) {
        $('#modalTextoRotulo').textContent = campo.rotulo;
        campoTexto.value = campo.padrao || ''; campoTexto.maxLength = campo.max || 80;
        campoTexto.type = campo.senha ? 'password' : 'text';
        if (campo.senha) campoTexto.setAttribute('inputmode', 'numeric'); else campoTexto.removeAttribute('inputmode');
      }
      $('#modalErro').textContent = '';
      m.hidden = false;
      if (campo) campoTexto.focus();
      else if (valor) campoValor.focus();
      else bOk.focus();
      const tecla = e => { if (e.key === 'Escape') fim(false); };
      const fim = v => { m.hidden = true; bOk.onclick = bNao.onclick = m.onclick = null; document.removeEventListener('keydown', tecla); res(v); };
      const erro = (msg, el) => { $('#modalErro').textContent = msg; if (el) el.focus(); };
      bOk.onclick = () => {
        if (!data && !valor && !campo) return fim(true);
        const out = {};
        if (data) {
          const dia = diaDeISO(campoData.value), min = dataMin ? diaDeISO(dataMin) : null, max = dataMax ? diaDeISO(dataMax) : null;
          if (dia == null || (max != null && dia > max) || (min != null && dia < min)) return erro(t('modal.dataInvalida'), campoData);
          out.dia = dia;
        }
        if (valor) {
          const n = D.lerNumero(campoValor.value, true), v = Math.round(n * 10 ** info.casas);
          if (!Number.isFinite(n) || v < (valor.minimo ?? 1) || v > D.LIMITES.valor) return erro(t('modal.valorInvalido'), campoValor);
          out.valor = v;
        }
        if (campo) out.texto = campo.senha ? campoTexto.value.trim() : limparNome(campoTexto.value);
        fim(out);
      };
      bNao.onclick = () => fim(false);
      m.onclick = e => { if (e.target === m) fim(false); };
      m.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); bOk.click(); } };
      document.addEventListener('keydown', tecla);
    });
  }
  const msgDe = err => {
    const cod = err && err.codigo;
    if (cod && ('erros.' + cod) in DebtIDTextos.pt) return t('erros.' + cod).split('|');
    const [titulo, texto] = t('erros.GENERICO').split('|');
    return [titulo, (err && err.message) || texto];
  };
  const alertaHTML = (titulo, texto, ok = false) =>
    `<div class="alert${ok ? ' ok' : ''}"><i>${ico(ok ? 'check' : 'alerta')}</i><div><b>${esc(titulo)}</b><p>${esc(texto)}</p></div></div>`;
  function toastErro(err) {
    const [titulo, texto] = msgDe(err);
    toast(`${titulo}: ${texto}`);
  }
  function alertaErro(err) {
    const [titulo, texto] = msgDe(err);
    return alertaHTML(titulo, texto);
  }
  const inicial = nome => (nome.trim()[0] || '?').toUpperCase(); // the letter shown in an avatar

  /* ---------------- app lock (a PIN, or the phone's own lock in the Android app) ----------------
     The lock covers the screen when the app opens and when it comes back after some time away.
     Backups, restoring and erasing the data also ask for it. With the lock on, the signing key is
     stored encrypted (see chaveTrava in core.js): its data key opens with the PIN, or, in the
     Android app, with the fingerprint, the face or the phone's screen lock (Android Keystore). */
  // { v: 2, modo: 'pin' | 'celular', pin: data key wrapped with the PIN, celular: { iv, ct } from the Keystore, tempo }
  // (the first version kept only a PIN hash, { sal, hash, bio, tempo }: it moves to v2 at the next PIN)
  let trava = lerJSON(K.trava, null);
  function travaValida(x) {
    if (!x) return false;
    if (x.v === 2 && x.modo === 'pin' && x.pin) return true;
    if (x.v === 2 && x.modo === 'celular' && x.celular) return true;
    return !!(x.sal && x.hash); // the first version
  }
  if (!travaValida(trava)) trava = null;
  let chaveDados = null; // the data key, only in memory and only while unlocked
  let travado = false, escondidoEm = null, fimTrava = null, timerEspera = null;
  const tempoTrava = () => (trava && Number.isFinite(trava.tempo) ? trava.tempo : 60);
  const modoCelular = () => !!(trava && trava.modo === 'celular');
  const errosTrava = () => { const e = lerJSON(K.travaErros, null); return e && typeof e.n === 'number' ? e : { n: 0, ate: 0 }; };
  const esperaTrava = () => Math.max(0, (errosTrava().ate || 0) - Date.now());
  const zerarErrosTrava = () => gravarJSON(K.travaErros, { n: 0, ate: 0 });

  // The Android Keystore (Android 11+): "ok", "sem-bloqueio" (the phone has no screen lock) or "indisponivel".
  const estadoCofre = () => { const a = app(); try { return a && a.cofre ? a.cofre() : 'indisponivel'; } catch { return 'indisponivel'; } };
  const b64Padrao = bytes => btoa(String.fromCharCode(...bytes));
  const deB64Padrao = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  // Asks the app to wrap or open the data key; the phone shows its own prompt. Answers { r, dados }.
  // While the prompt is open (the screen lock may cover the app), leaving the app does not lock it.
  let promptAberto = false;
  function cofre(acao, ...args) {
    return new Promise(res => {
      const a = app();
      if (!a || !a[acao]) { res({ r: 'erro' }); return; }
      const encerrar = () => { window.__debtidCofre = null; promptAberto = false; };
      promptAberto = true;
      window.__debtidCofre = (r, dados) => { encerrar(); escondidoEm = null; res({ r, dados }); };
      try { a[acao](t('trava.bioTitulo'), t('trava.bioSub'), ...args); } catch { encerrar(); res({ r: 'erro' }); }
    });
  }
  const apagarCofre = () => { const a = app(); try { if (a && a.cofreApagar) a.cofreApagar(); } catch { /* nothing to erase */ } };

  // Saves the profile; with the lock on, the private key goes encrypted.
  async function guardarPerfil() {
    if (!perfil) return false;
    const guardado = trava && trava.v === 2 && chaveDados ? await D.chaveTrava.protegerPerfil(perfil, chaveDados) : perfil;
    return gravarJSON(K.perfil, guardado || perfil);
  }
  // With the data key, the profile can sign again.
  async function abrirSessao(chave) {
    if (perfil) {
      const aberto = await D.chaveTrava.abrirPerfil(perfil, chave);
      if (!aberto) return false;
      perfil = aberto;
    }
    chaveDados = chave;
    return true;
  }
  async function ligarTravaPin(pin, tempo = 60) {
    const chave = chaveDados || D.chaveTrava.novaChaveDados();
    const novo = { v: 2, modo: 'pin', pin: await D.chaveTrava.embrulharComPin(pin, chave), tempo };
    if (modoCelular()) apagarCofre();
    trava = novo; chaveDados = chave;
    gravarJSON(K.trava, trava);
    await guardarPerfil();
  }
  async function pinCerto(pin) {
    if (trava.v === 2) {
      const chave = await D.chaveTrava.abrirComPin(pin, trava.pin);
      if (!chave) return false;
      return abrirSessao(chave);
    }
    if (!(await D.conferirPin(pin, trava))) return false;
    await ligarTravaPin(pin, tempoTrava()); // first version: from now on the key is encrypted with this PIN
    return true;
  }
  async function testarPin(pin) {
    if (esperaTrava() > 0) return { ok: false };
    if (await pinCerto(pin)) { zerarErrosTrava(); return { ok: true }; }
    const e = errosTrava(); e.n++;
    // after 5 wrong PINs: wait 30 s, then twice as long after each new mistake (at most 15 min)
    if (e.n >= 5) e.ate = Date.now() + Math.min(900, 30 * 2 ** (e.n - 5)) * 1000;
    gravarJSON(K.travaErros, e);
    return { ok: false, restam: Math.max(0, 5 - e.n) };
  }
  function atualizarEspera() {
    clearTimeout(timerEspera);
    const espera = esperaTrava(), campoPin = $('#f-pin'), btn = $('#travaOk');
    campoPin.disabled = btn.disabled = espera > 0;
    if (espera > 0) {
      $('#travaErro').textContent = t('trava.espere', { s: Math.ceil(espera / 1000) });
      timerEspera = setTimeout(atualizarEspera, 1000);
    } else if (/\d+ s/.test($('#travaErro').textContent)) {
      $('#travaErro').textContent = '';
    }
  }
  function mostrarTrava(modo, texto) {
    return new Promise(res => {
      const caixa = $('#trava'), abrir = modo === 'abrir', celular = modoCelular();
      $('#travaTitulo').textContent = t(abrir ? 'trava.titulo' : 'trava.confirmarT');
      $('#travaTexto').textContent = celular ? t('trava.bioSub') : (texto || t('trava.texto'));
      $('#travaCancelar').hidden = abrir;
      $('#travaEsqueci').hidden = !abrir || celular;
      $('#formTrava').hidden = celular;
      $('#travaBio').hidden = !celular;
      $('#f-pin').value = ''; $('#travaErro').textContent = '';
      caixa.hidden = false;
      document.body.classList.add('trava-aberta');
      if (abrir) {
        document.body.classList.add('travado');
        $$('.page, .tabbar').forEach(el => el.setAttribute('aria-hidden', 'true'));
      }
      fimTrava = ok => {
        caixa.hidden = true; fimTrava = null; clearTimeout(timerEspera);
        document.body.classList.remove('trava-aberta');
        if (abrir) {
          travado = false;
          document.body.classList.remove('travado');
          $$('.page, .tabbar').forEach(el => el.removeAttribute('aria-hidden'));
        }
        res(ok);
      };
      if (celular) {
        setTimeout(usarCelular, 60);
      } else {
        atualizarEspera();
        setTimeout(() => { if (!$('#f-pin').disabled) $('#f-pin').focus(); }, 40);
      }
    });
  }
  async function bloquear() {
    if (!trava || travado) return;
    if (fimTrava) fimTrava(false); // a question that was open gives way to the full lock
    if (!$('#modal').hidden) $('#modalCancelar').click(); // and so does an open dialog
    travado = true;
    // the private key leaves memory: only the encrypted copy stays
    const guardado = lerJSON(K.perfil, null);
    if (trava.v === 2 && guardado && guardado.dCifrado) perfil = guardado;
    chaveDados = null;
    await mostrarTrava('abrir');
  }
  // Asks for the PIN (or the phone's lock) before a sensitive action. Without a lock, it just goes ahead.
  async function pedirPin(texto) {
    if (!trava) return true;
    if (travado) return false;
    return mostrarTrava('confirmar', texto);
  }
  async function usarCelular() {
    if (!fimTrava || !modoCelular()) return;
    const r = await cofre('cofreAbrir', trava.celular.iv, trava.celular.ct);
    if (r.r === 'ok') {
      let chave = null;
      try { chave = deB64Padrao(r.dados); } catch { /* not base64: no key */ }
      if (chave && (await abrirSessao(chave)) && fimTrava) { zerarErrosTrava(); fimTrava(true); }
      return;
    }
    // the phone's screen lock was removed or reset, and the Keystore threw the key away
    if (r.r === 'invalida') await apagarERecomecar(t('trava.invalidaT'), t('trava.invalida'));
  }
  // Without the key (PIN forgotten, or the Keystore key lost), the way out is to erase this device's data.
  async function apagarERecomecar(titulo, texto) {
    const ok = await perguntar({ titulo, texto, ok: t('trava.esqueciOk'), perigo: true });
    if (!ok) return;
    apagarTudo();
    if (fimTrava) fimTrava(true);
    irPara('boas-vindas');
  }
  $('#formTrava').addEventListener('submit', async e => {
    e.preventDefault();
    if (!fimTrava) return;
    const pin = $('#f-pin').value.trim();
    if (!pin) return;
    const btn = $('#travaOk'); btn.disabled = true;
    const r = await testarPin(pin);
    btn.disabled = false;
    if (r.ok) return fimTrava(true);
    $('#f-pin').value = '';
    $('#travaErro').textContent = r.restam > 0 ? t('trava.errado', { n: r.restam }) : '';
    atualizarEspera();
    if (!$('#f-pin').disabled) $('#f-pin').focus();
  });
  $('#travaCancelar').addEventListener('click', () => { if (fimTrava) fimTrava(false); });
  $('#travaBio').addEventListener('click', usarCelular);
  $('#travaEsqueci').addEventListener('click', () => apagarERecomecar(t('trava.esqueciT'), t('trava.esqueci')));
  function aoEsconder() {
    if (promptAberto) return;
    if (escondidoEm == null) escondidoEm = Date.now();
    if (trava && tempoTrava() === 0) bloquear();
  }
  function aoVoltar() {
    if (trava && escondidoEm != null && Date.now() - escondidoEm >= tempoTrava() * 1000) bloquear();
    escondidoEm = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) aoEsconder();
    else aoVoltar();
  });
  // the Android app tells the page when it goes to the background and comes back
  window.DebtIDSegundoPlano = fundo => {
    if (fundo) aoEsconder();
    else aoVoltar();
  };

  /* ---------------- navigation ---------------- */
  const VIEWS = ['inicio', 'novo', 'conferir', 'registros', 'ajustes', 'detalhe', 'boas-vindas'];
  let atual = null;
  function rota() {
    let v = location.hash.replace('#', '') || 'inicio';
    if (!VIEWS.includes(v)) v = 'inicio';
    const troca = destino => { history.replaceState(null, '', '#' + destino); v = destino; };
    if (!perfil && v !== 'boas-vindas') troca('boas-vindas');
    else if (perfil && v === 'boas-vindas') troca('inicio');
    if (v === 'detalhe' && !atual) troca('registros');
    $$('.view').forEach(s => s.classList.toggle('on', s.dataset.view === v));
    $$('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === v || (v === 'detalhe' && a.dataset.nav === 'registros')));
    document.body.classList.toggle('boas-vindas', v === 'boas-vindas');
    document.body.classList.toggle('com-abas', v !== 'boas-vindas');
    if (v === 'inicio') renderInicio();
    if (v === 'novo') $('#assinaComo').textContent = perfil ? perfil.nome : '—';
    if (v === 'registros') renderRegistros();
    if (v === 'ajustes') renderAjustes();
    if (v === 'boas-vindas') prepararBoasVindas();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function irPara(v) {
    if (location.hash === '#' + v) rota(); else location.hash = v;
  }
  window.addEventListener('hashchange', rota);
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-rolar]');
    if (!a) return;
    e.preventDefault();
    const alvo = document.getElementById(a.dataset.rolar);
    if (location.hash !== '#novo') { irPara('novo'); }
    setTimeout(() => alvo.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' }), 30);
  });

  /* ---------------- loan form ---------------- */
  const form = $('#form');
  const campo = n => form.elements.namedItem(n);
  const diaDeISO = v => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2200) return null;
    const tm = Date.UTC(y, mo - 1, d), x = new Date(tm);
    if (x.getUTCMonth() !== mo - 1 || x.getUTCDate() !== d) return null;
    return Math.round(tm / 86400000);
  };
  const isoLocal = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const hoje = new Date();
  campo('de').value = isoLocal(hoje);
  campo('dp').value = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30));
  const marcado = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value;
  const moedaPadrao = () => { const c = lerTexto(K.moeda); return c && D.MOEDAS[c] ? c : 'BTC'; };
  let moedaForm = moedaPadrao();
  let contatoForm = null; // contact chosen in the form: only that key can confirm the loan
  const multiplo = codigo => 10 ** D.MOEDAS[codigo].casas;
  // amount typed in the form → text in the current language, with the currency's decimals
  const textoValor = (n, codigo) => {
    const casas = D.MOEDAS[codigo].casas;
    return fmt.numMoeda(Math.round(n * 10 ** casas), casas, Math.min(casas, 2));
  };
  function pintarBotaoMoeda(btn, codigo) {
    const m = D.MOEDAS[codigo];
    btn.querySelector('.mo-sim').textContent = m.simbolo;
    btn.querySelector('.mo-nome').textContent = fmt.nomeMoeda(m);
    btn.querySelector('.mo-cod').textContent = m.codigo;
  }
  function pintarMoedas() {
    const m = D.MOEDAS[moedaForm];
    pintarBotaoMoeda($('#btnMoeda'), moedaForm);
    pintarBotaoMoeda($('#btnMoedaPadrao'), moedaPadrao());
    $('#affixMoeda').textContent = m.simbolo;
    campo('valor').placeholder = fmt.numMoeda(0, m.casas);
  }
  function definirMoedaForm(codigo) {
    const v = D.lerNumero(campo('valor').value, true), x = v * multiplo(codigo);
    moedaForm = codigo;
    // rewrite the typed amount with the new decimals, unless that would drop digits (0,005 BTC → JPY)
    if (v > 0 && Math.abs(x - Math.round(x)) < 1e-6) campo('valor').value = textoValor(v, codigo);
    pintarMoedas();
    atualizaDicas();
  }
  const lerTaxaCampo = n => { const v = campo(n).value.trim(); if (!v) return 0; const x = D.lerNumero(v, false); return Number.isFinite(x) ? Math.round(x * 10000) : NaN; };
  function pintarContatoForm() {
    const caixa = $('#fixado');
    caixa.hidden = !contatoForm;
    if (contatoForm) caixa.querySelector('span').textContent = t('form.fixado', { nome: nomeContato(contatoForm), id: contatoForm.id });
  }
  function atualizaDicas() {
    const composto = marcado('tipo') === 'compostos';
    const opTotal = $('#m-total');
    opTotal.disabled = composto; // compound interest needs a period (month or year)
    if (composto && opTotal.checked) $('#m-mes').checked = true;
    const modo = marcado('modo') || 'mes';
    $('#hintModo').textContent = t(`dica.${composto ? 'compostos' : 'simples'}.${modo}`);
    $('#hintConf').textContent = t(marcado('confirmacao') === 'so' ? 'dica.confSo' : 'dica.confPedir');
    const credor = marcado('papel') !== 'devedor';
    $('#l-outro').textContent = t(credor ? 'form.outroDevedor' : 'form.outroCredor');
    const de = diaDeISO(campo('de').value), dp = diaDeISO(campo('dp').value);
    const caixa = $('#prazoAoVivo'), ok = de != null && dp != null && dp >= de;
    caixa.classList.toggle('off', !ok);
    caixa.lastElementChild.textContent = ok ? t('form.prazo', { x: fmt.dias(dp - de) }) : t('form.prazoVazio');
    // live total preview while typing
    const v = D.lerNumero(campo('valor').value, true), tx = D.lerNumero(campo('taxa').value, false);
    const valor = Math.round(v * multiplo(moedaForm)), taxa = Math.round(tx * 10000);
    const previa = $('#totalAoVivo');
    const pode = ok && valor >= 1 && valor <= D.LIMITES.valor && taxa >= 0 && taxa <= D.LIMITES.taxa && dp - de <= D.LIMITES.dias;
    const total = pode ? D.calcular({ valor, taxa, modo, composto, de, dp }).total : NaN;
    const temPrevia = Number.isSafeInteger(total);
    previa.classList.toggle('off', !temPrevia);
    previa.lastElementChild.textContent = temPrevia
      ? t('form.totalPrevia', { x: fmt.dinheiro(total, D.MOEDAS[moedaForm]) })
      : t('form.totalVazio');
    // installments preview
    const emParcelas = marcado('pagamento') === 'parcelas';
    $('#campoParcelas').hidden = !emParcelas;
    const n = parseInt(campo('parcelas').value, 10);
    let dica = t('dica.parcelas');
    if (emParcelas && temPrevia && n >= 2 && n <= D.LIMITES.parcelas && n <= dp - de && total >= n) {
      const lista = D.parcelasDe({ de, dp, parcelas: n }, total);
      dica = t('dica.parcelasPrevia', { n, valor: fmt.dinheiro(lista[0].valor, D.MOEDAS[moedaForm]), dias: fmt.dias(Math.round((dp - de) / n)), primeira: fmt.data(lista[0].dia) });
    }
    $('#hintParcelas').textContent = dica;
    const obs = campo('obs').value;
    $('#contaObs').textContent = `${obs.length}/140`;
  }
  form.addEventListener('change', atualizaDicas);
  form.addEventListener('input', e => {
    atualizaDicas();
    if (e.target.name === 'outro' && contatoForm && limparNome(e.target.value) !== nomeContato(contatoForm)) { contatoForm = null; pintarContatoForm(); }
    const f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) limparErroCampo(f);
  });
  campo('valor').addEventListener('blur', () => {
    const n = D.lerNumero(campo('valor').value, true);
    if (n > 0) campo('valor').value = textoValor(n, moedaForm);
  });
  ['taxa', 'multa', 'mora'].forEach(n => campo(n).addEventListener('blur', () => {
    const x = D.lerNumero(campo(n).value, false);
    if (x >= 0) campo(n).value = fmt.numEntrada(Math.round(x * 10000) / 10000);
  }));
  $('#fixadoTirar').addEventListener('click', () => { contatoForm = null; pintarContatoForm(); });

  function lerFormulario() {
    const erros = {};
    const outro = limparNome(campo('outro').value);
    if (!outro) erros.outro = t(marcado('papel') === 'devedor' ? 'erro.outroCredor' : 'erro.outroDevedor');
    else if (outro.length > 80) erros.outro = t('erro.max80');
    const info = D.MOEDAS[moedaForm];
    const v = D.lerNumero(campo('valor').value, true), valor = Math.round(v * 10 ** info.casas);
    if (!campo('valor').value.trim()) erros.valor = t('erro.valorVazio');
    else if (!Number.isFinite(v)) erros.valor = t('erro.valorInvalido');
    else if (valor < 1) erros.valor = t('erro.valorZero');
    else if (valor > D.LIMITES.valor) erros.valor = t('erro.valorMax', { x: fmt.dinheiro(D.LIMITES.valor, info) });
    const tx = D.lerNumero(campo('taxa').value, false), taxa = Math.round(tx * 10000);
    if (!campo('taxa').value.trim()) erros.taxa = t('erro.taxaVazia');
    else if (!Number.isFinite(tx)) erros.taxa = t('erro.taxaInvalida');
    else if (taxa > D.LIMITES.taxa) erros.taxa = t('erro.taxaMax');
    const de = diaDeISO(campo('de').value), dp = diaDeISO(campo('dp').value);
    if (de == null) erros.de = t('erro.de');
    if (dp == null) erros.dp = t('erro.dp');
    else if (de != null && dp < de) erros.dp = t('erro.dpAntes');
    else if (de != null && dp - de > D.LIMITES.dias) erros.dp = t('erro.prazoMax');
    const modo = marcado('modo') || 'mes', composto = marcado('tipo') === 'compostos';
    let total = NaN;
    if (!erros.valor && !erros.taxa && !erros.de && !erros.dp) {
      total = D.calcular({ valor, taxa, modo, composto, de, dp }).total;
      if (!Number.isSafeInteger(total)) erros.taxa = t('erro.totalAlto');
    }
    let parcelas = 1;
    if (marcado('pagamento') === 'parcelas') {
      parcelas = parseInt(campo('parcelas').value, 10);
      if (!Number.isSafeInteger(parcelas) || parcelas < 2 || parcelas > D.LIMITES.parcelas) erros.parcelas = t('erro.parcelas', { max: D.LIMITES.parcelas });
      else if (de != null && dp != null && parcelas > dp - de) erros.parcelas = t('erro.parcelasPrazo');
      else if (Number.isSafeInteger(total) && total < parcelas) erros.parcelas = t('erro.parcelasValor');
    }
    const multa = lerTaxaCampo('multa'), mora = lerTaxaCampo('mora');
    if (!Number.isFinite(multa) || multa > D.LIMITES.multa) erros.multa = t('erro.multa');
    if (!Number.isFinite(mora) || mora > D.LIMITES.taxa) erros.mora = t('erro.mora');
    const obs = limparNome(campo('obs').value);
    if (new TextEncoder().encode(obs).length > D.LIMITES.obsBytes) erros.obs = t('erro.obs');
    if (Object.keys(erros).some(k => ['parcelas', 'multa', 'mora', 'obs'].includes(k))) $('#maisOpcoes').open = true;
    return {
      erros,
      dados: {
        papel: marcado('papel') === 'devedor' ? 'devedor' : 'credor', nomeOutro: outro, moeda: moedaForm, valor, taxa, modo, composto, de, dp,
        obs, parcelas, multa: multa || 0, mora: mora || 0, pubOutro: contatoForm ? contatoForm.pub : null
      }
    };
  }
  function mostrarErros(erros, alvo = form) {
    alvo.querySelectorAll('.field[data-f]').forEach(f => {
      const msg = erros[f.dataset.f] || '';
      f.classList.toggle('invalid', !!msg);
      const er = f.querySelector('.err'); if (er) er.textContent = msg;
    });
    const primeiro = Object.keys(erros)[0];
    if (primeiro) { const c = alvo.querySelector(`.field[data-f="${primeiro}"] input, .field[data-f="${primeiro}"] textarea`); if (c) c.focus(); }
    return !!primeiro;
  }
  function limparErroCampo(f) {
    f.classList.remove('invalid');
    const er = f.querySelector('.err');
    if (er) er.textContent = '';
  }
  function limparFormulario() {
    ['outro', 'valor', 'taxa', 'obs', 'multa', 'mora'].forEach(n => { campo(n).value = ''; });
    campo('parcelas').value = '3';
    $('#pg-unica').checked = true;
    contatoForm = null; pintarContatoForm();
    $('#maisOpcoes').open = false;
    atualizaDicas();
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { erros, dados } = lerFormulario();
    if (mostrarErros(erros)) return;
    const soRegistro = marcado('confirmacao') === 'so';
    const btn = $('#btnRegistrar'); btn.disabled = true;
    try {
      const codigo = await D.criarProposta(perfil, dados);
      const m = await D.lerCodigo(codigo);
      upsert(soRegistro ? { ...registroDe(m, dados.papel, 'registrado'), soRegistro: true } : registroDe(m, dados.papel, 'aguardando'));
      limparFormulario();
      await abrirModelo(m, { aviso: t(soRegistro ? 'toast.soRegistro' : 'toast.registrado') });
    } catch (err) {
      toastErro(err);
    } finally {
      btn.disabled = false;
    }
  });
  // Fills the form with an existing loan's data (to correct a cancelled loan or to repeat one).
  function preencherForm(m, reg) {
    const d = m.dados;
    const papel = reg ? reg.papel : m.emissor;
    (papel === 'devedor' ? $('#p-devedor') : $('#p-credor')).checked = true;
    const outra = papel === 'credor' ? m.devedor : m.credor;
    campo('outro').value = outra.nome;
    if (D.MOEDAS[d.moeda]) definirMoedaForm(d.moeda);
    campo('valor').value = valorCampo(d.valor, d.casas);
    campo('taxa').value = fmt.numEntrada(d.taxa / 10000);
    (d.composto ? $('#t-compostos') : $('#t-simples')).checked = true;
    ($('#m-' + d.modo) || $('#m-mes')).checked = true;
    campo('de').value = isoDeDia(d.de); campo('dp').value = isoDeDia(d.dp);
    campo('obs').value = d.obs || '';
    if (d.parcelas > 1) { $('#pg-parcelas').checked = true; campo('parcelas').value = String(d.parcelas); } else $('#pg-unica').checked = true;
    campo('multa').value = d.multa ? fmt.numEntrada(d.multa / 10000) : '';
    campo('mora').value = d.mora ? fmt.numEntrada(d.mora / 10000) : '';
    $('#maisOpcoes').open = !!(d.obs || d.parcelas > 1 || d.multa || d.mora);
    const c = outra.pub ? contatoDe(outra.pub) : null;
    contatoForm = c; pintarContatoForm();
    atualizaDicas();
    irPara('novo');
    setTimeout(() => $('#novo-form').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' }), 60);
  }

  /* ---------------- currency picker ---------------- */
  let escolhaMoeda = null, moedaMarcada = null;
  const opcaoMoeda = c => {
    const m = D.MOEDAS[c];
    return `<button type="button" class="moeda-op" role="option" data-moeda="${c}" aria-selected="${c === moedaMarcada}"><span class="mo-sim">${esc(m.simbolo)}</span><span class="mo-nome">${esc(fmt.nomeMoeda(m))}</span><span class="mo-cod">${c}</span></button>`;
  };
  function renderMoedas() {
    const q = semAcento($('#moedasBusca').value.trim());
    const nome = c => fmt.nomeMoeda(D.MOEDAS[c]);
    const ordem = (a, b) => nome(a).localeCompare(nome(b), locale());
    let html;
    if (q) {
      const achadas = D.CODIGOS_MOEDAS.filter(c => {
        const m = D.MOEDAS[c];
        return [c, m.simbolo, m.pt.nome, m.en.nome, m.pt.p, m.en.p, fmt.nomeMoeda(m)].some(x => semAcento(x).includes(q));
      }).sort((a, b) => (semAcento(b) === q) - (semAcento(a) === q) || ordem(a, b));
      html = achadas.length ? achadas.map(opcaoMoeda).join('') : `<p class="moedas-vazio">${t('moeda.nenhuma')}</p>`;
    } else {
      const pop = new Set(D.MOEDAS_POPULARES);
      html = `<h4>${t('moeda.populares')}</h4>${D.MOEDAS_POPULARES.map(opcaoMoeda).join('')}` +
             `<h4>${t('moeda.todas')}</h4>${D.CODIGOS_MOEDAS.filter(c => !pop.has(c)).sort(ordem).map(opcaoMoeda).join('')}`;
    }
    $('#moedasLista').innerHTML = html;
  }
  function escolherMoeda(atualCod, origem) {
    return new Promise(res => {
      moedaMarcada = atualCod;
      $('#moedasBusca').value = '';
      renderMoedas();
      const caixa = $('#moedas');
      caixa.hidden = false;
      $('#moedasLista').scrollTop = 0;
      const marcada = $('#moedasLista [aria-selected="true"]');
      if (marcada) marcada.focus({ preventScroll: true });
      const tecla = e => { if (e.key === 'Escape') fim(null); };
      const fim = v => {
        caixa.hidden = true; escolhaMoeda = null;
        document.removeEventListener('keydown', tecla);
        if (origem) origem.focus({ preventScroll: true });
        res(v);
      };
      document.addEventListener('keydown', tecla);
      escolhaMoeda = fim;
    });
  }
  $('#moedasBusca').addEventListener('input', renderMoedas);
  $('#moedasBusca').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const b = $('#moedasLista .moeda-op');
    if (b && escolhaMoeda) escolhaMoeda(b.dataset.moeda);
  });
  $('#moedasLista').addEventListener('click', e => {
    const b = e.target.closest('.moeda-op');
    if (b && escolhaMoeda) escolhaMoeda(b.dataset.moeda);
  });
  $('#moedasFechar').addEventListener('click', () => { if (escolhaMoeda) escolhaMoeda(null); });
  $('#moedas').addEventListener('click', e => { if (e.target.id === 'moedas' && escolhaMoeda) escolhaMoeda(null); });
  $('#btnMoeda').addEventListener('click', async e => {
    const c = await escolherMoeda(moedaForm, e.currentTarget);
    if (c) definirMoedaForm(c);
  });
  $('#btnMoedaPadrao').addEventListener('click', async e => {
    const c = await escolherMoeda(moedaPadrao(), e.currentTarget);
    if (!c) return;
    gravarTexto(K.moeda, c);
    definirMoedaForm(c);
    toast(t('toast.moedaPadrao', { x: fmt.nomeMoeda(D.MOEDAS[c]) }));
  });

  /* ---------------- contact picker (in the loan form) ---------------- */
  let escolhaContato = null;
  function renderEscolhaContatos() {
    const q = normNome($('#contatosBusca').value);
    const lista = contatos.filter(c => !q || [c.nome, c.apelido || '', c.id, ...(c.nomes || [])].some(x => normNome(x).includes(q)))
      .sort((a, b) => nomeContato(a).localeCompare(nomeContato(b), locale()));
    $('#contatosLista').innerHTML = lista.length
      ? lista.map(c => `<button type="button" class="moeda-op contato-op" role="option" data-pub="${esc(c.pub)}"><span class="mo-sim">${esc(inicial(nomeContato(c)))}</span><span class="mo-nome">${esc(nomeContato(c))}</span><span class="mo-cod">${esc(c.id)}</span></button>`).join('')
      : `<p class="moedas-vazio">${t(contatos.length ? 'contatos.nenhumAchado' : 'contatos.vazio')}</p>`;
  }
  $('#btnContatos').addEventListener('click', e => {
    const origem = e.currentTarget, caixa = $('#escolhaContatos');
    $('#contatosBusca').value = '';
    renderEscolhaContatos();
    caixa.hidden = false;
    $('#contatosBusca').focus();
    const tecla = ev => { if (ev.key === 'Escape') escolhaContato(null); };
    document.addEventListener('keydown', tecla);
    escolhaContato = pub => {
      caixa.hidden = true; escolhaContato = null;
      document.removeEventListener('keydown', tecla);
      origem.focus({ preventScroll: true });
      const c = contatoDe(pub);
      if (!c) return;
      contatoForm = c;
      campo('outro').value = nomeContato(c);
      pintarContatoForm();
      atualizaDicas();
    };
  });
  $('#contatosBusca').addEventListener('input', renderEscolhaContatos);
  $('#contatosLista').addEventListener('click', e => { const b = e.target.closest('[data-pub]'); if (b && escolhaContato) escolhaContato(b.dataset.pub); });
  $('#contatosFechar').addEventListener('click', () => { if (escolhaContato) escolhaContato(null); });
  $('#escolhaContatos').addEventListener('click', e => { if (e.target.id === 'escolhaContatos' && escolhaContato) escolhaContato(null); });

  /* ---------------- check a code ---------------- */
  async function abrirTexto(txt) {
    if (!perfil) { toast(t('toast.criePerfil')); return; }
    try {
      const m = await D.lerCodigo(txt);
      $('#f-codigo').value = ''; $('#msgConf').innerHTML = '';
      if (m.tipo === 'recibo') await abrirRecibo(m);
      else await abrirModelo(m);
    } catch (err) {
      $('#msgConf').innerHTML = alertaErro(err);
      if (location.hash !== '#conferir') irPara('conferir');
    }
  }
  $('#vform').addEventListener('submit', e => { e.preventDefault(); abrirTexto($('#f-codigo').value); });
  $('#f-codigo').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); abrirTexto($('#f-codigo').value); }
  });
  $('#limparConf').addEventListener('click', () => { $('#f-codigo').value = ''; $('#msgConf').innerHTML = ''; $('#f-codigo').focus(); });
  window.DebtIDOpen = abrirTexto; // used by the app when it receives a shared code

  /* ---------------- QR scanner ---------------- */
  async function verificarLeitor() {
    let pode = false;
    const a = app();
    if (a && a.scanQR) pode = true;
    else if ('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { pode = (await BarcodeDetector.getSupportedFormats()).includes('qr_code'); } catch { pode = false; }
    }
    document.body.classList.toggle('pode-ler-qr', pode);
  }
  function lerQR() {
    const a = app();
    if (a && a.scanQR) {
      return new Promise(res => {
        window.__debtidQR = (texto, erro) => { window.__debtidQR = null; if (erro) toast(t('toast.qrApp')); res(texto ? String(texto) : null); };
        try { a.scanQR(); } catch { window.__debtidQR = null; res(null); }
      });
    }
    return lerQRCamera();
  }
  async function lerQRCamera() {
    const tela = $('#scanner'), video = $('#scanVideo');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      toast(t('toast.camera'));
      return null;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    tela.hidden = false; video.srcObject = stream;
    try { await video.play(); } catch { /* fall through */ }
    return new Promise(res => {
      let ativo = true;
      const fim = txt => {
        if (!ativo) return;
        ativo = false;
        stream.getTracks().forEach(tr => tr.stop());
        video.srcObject = null; tela.hidden = true; $('#scanFechar').onclick = null;
        res(txt);
      };
      $('#scanFechar').onclick = () => fim(null);
      const procurar = async () => {
        if (!ativo) return;
        try {
          if (video.readyState >= 2) {
            const r = await detector.detect(video);
            if (r && r.length && r[0].rawValue) return fim(r[0].rawValue);
          }
        } catch { /* try again */ }
        setTimeout(procurar, 180);
      };
      procurar();
    });
  }
  async function lerEAbrir() {
    const txt = await lerQR();
    if (txt) abrirTexto(txt);
  }

  /* ---------------- copy, share, print, files ---------------- */
  async function copiar(texto) {
    const a = app();
    if (a && a.copy) { try { if (a.copy(texto)) return true; } catch { /* fall through */ } }
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; }
    } catch { /* fallback */ }
    const ta = document.createElement('textarea');
    ta.value = texto; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, texto.length);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  async function compartilhar(texto) {
    const a = app();
    if (a && a.share) { try { a.share(texto); return; } catch { /* fall through */ } }
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    toast(t(await copiar(texto) ? 'toast.copiadoCola' : 'toast.semCompartilhar'));
  }
  // prints the page; the print stylesheet shows only the receipt, or only the report (body.imprimir-relatorio)
  function imprimirComo(nome, relatorio = false) {
    document.body.classList.toggle('imprimir-relatorio', relatorio);
    const fim = () => { document.title = TITULO; document.body.classList.remove('imprimir-relatorio'); window.removeEventListener('afterprint', fim); };
    const a = app();
    if (a && a.print) {
      // the app renders the print in the background: the class (which only affects printing) stays until the next tap
      try {
        a.print(nome);
        const limpar = () => { document.body.classList.remove('imprimir-relatorio'); document.removeEventListener('click', limpar, true); };
        setTimeout(() => document.addEventListener('click', limpar, true), 0);
        return;
      } catch { /* fall through */ }
    }
    document.title = nome;
    window.addEventListener('afterprint', fim);
    window.print();
  }
  function imprimir() {
    const m = atual.m;
    if (m.tipo === 'recibo') return imprimirComo(t('rc.pdfRecibo', { ref: m.ref }));
    imprimirComo(t('rc.pdf', { nome: m.devedor.nome, data: fmt.data(m.dados.de).replace(/[\u200e\u200f\u061c]/g, '').replace(/\//g, '-').replace(/,/g, '') }));
  }
  // Saves a text file: the Android app asks where to save it; the browser downloads it.
  function salvarArquivo(nome, tipo, texto) {
    const a = app();
    if (a && a.salvarArquivo) {
      window.__debtidArquivo = ok => { window.__debtidArquivo = null; if (ok === true) toast(t('toast.arquivoSalvo')); else if (ok === false) toast(t('toast.arquivoErro')); };
      try { a.salvarArquivo(nome, tipo, texto); return; } catch { window.__debtidArquivo = null; }
    }
    try {
      const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
      const l = document.createElement('a');
      l.href = url; l.download = nome; document.body.appendChild(l); l.click(); l.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(t('toast.arquivoBaixado'));
    } catch { toast(t('toast.arquivoErro')); }
  }

  /* ---------------- record details ---------------- */
  const papelDe = m => {
    if (m.credor.id && m.credor.id === perfil.id) return 'credor';
    if (m.devedor.id && m.devedor.id === perfil.id) return 'devedor';
    return null;
  };
  const parteEmissora = m => (m.emissor === 'credor' ? m.credor : m.devedor);
  const parteOutra = m => (m.emissor === 'credor' ? m.devedor : m.credor);
  const parteNaoEu = m => {
    if (!m.emissor) return null;
    const meu = papelDe(m);
    if (meu === 'credor') return m.devedor;
    if (meu === 'devedor') return m.credor;
    return null;
  };

  async function abrirModelo(m, opts = {}) {
    let reg = acharReg(m);
    let ctx, aviso = opts.aviso;
    if (m.tipo === 'v1') {
      ctx = 'antigo';
    } else if (m.tipo === 'proposta') {
      // a newer state of this loan is saved here (validated, paid...): show that one
      if (reg && reg.status !== 'aguardando' && reg.codigo !== m.codigo && reg.tipoCodigo === 'validado') {
        return abrirModelo(await D.lerCodigo(reg.codigo), opts);
      }
      if (parteEmissora(m).id === perfil.id) {
        if (!reg) reg = upsert(registroDe(m, m.emissor, 'aguardando'));
        ctx = ctxDe(reg);
      } else {
        ctx = 'recebida';
      }
    } else {
      const meu = papelDe(m);
      if (meu) {
        if (!reg) {
          reg = upsert({ ...registroDe(m, meu, 'validado'), soRegistro: false });
        } else if (reg.tipoCodigo !== 'validado') {
          // the confirmation arrived: keep payments and the status if it was already paid or cancelled
          const estavaAguardando = reg.status === 'aguardando';
          const status = reg.status === 'aguardando' || reg.status === 'registrado' ? 'validado' : reg.status;
          const novo = registroDe(m, meu, status);
          reg = upsert({ ...novo, recibos: recibosDe(reg), soRegistro: false, criadoEm: reg.criadoEm });
          if (estavaAguardando && !aviso) aviso = t('toast.validado');
        }
        ctx = ctxDe(reg);
      } else {
        ctx = 'terceiro';
      }
    }
    atual = { m, ctx, reg, extra: opts };
    renderDetalhe();
    irPara('detalhe');
    if (aviso) toast(aviso);
  }
  const ctxDe = reg => {
    if (reg.status === 'cancelado') return 'cancelado';
    if (reg.status === 'quitado') return 'quitado';
    if (reg.status === 'registrado') return 'pessoal';
    if (reg.status === 'aguardando') return 'aguardando';
    return 'validado';
  };

  // A receipt was read: it joins its loan when the loan is saved here; otherwise it shows on its own.
  async function abrirRecibo(mr) {
    const reg = registros.find(r => r.k === mr.hash);
    if (reg) {
      const m = await D.lerCodigo(reg.codigo);
      const erro = D.conferirRecibo(m, mr);
      if (erro) throw new D.ChaveErro(erro === 'NAO_CREDOR' ? 'RECIBO_NAO_CREDOR' : 'RECIBO_OUTRO');
      const { novo } = guardarRecibo(reg, mr);
      return abrirModelo(m, { aviso: t(novo ? 'toast.reciboSalvo' : 'toast.reciboJa'), reciboMostrado: null });
    }
    atual = { m: mr, ctx: 'recibo', reg: null, extra: {} };
    renderDetalhe();
    irPara('detalhe');
  }

  const nomeTipoRecibo = tipo => t('recibo.' + tipo);
  function statusHTML() {
    const { m, ctx, reg, extra } = atual;
    if (ctx === 'recibo') return statusReciboHTML(m);
    const emissor = m.emissor ? parteEmissora(m) : null, outra = m.emissor ? parteOutra(m) : null;
    const d = m.dados, c = m.calc;
    const sou = reg ? reg.papel : null;
    const s = reg ? situacaoDe(reg) : null;
    const atraso = s && s.atrasadas ? ' ' + t('st.atrasadas', { n: s.atrasadas }) : '';
    let cls, icone, titulo, texto, botoes = '', extraHTML = '';
    const btnPagamento = `<button class="btn btn-primary" type="button" data-acao="pagamento">${ico('plus')}${t('st.pagamento')}</button>`;
    const btnQuitarAss = `<button class="btn" type="button" data-acao="quitar-assinado">${ico('check')}${t('st.quitarAssinado')}</button>`;
    const btnLerRecibo = `<button class="btn btn-dark so-qr" type="button" data-acao="ler-qr">${ico('camera')}${t('st.lerRecibo')}</button>
                          <button class="btn" type="button" data-acao="colar">${ico('copiar')}${t('st.colarRecibo')}</button>`;
    const btnQuitarLocal = `<button class="btn" type="button" data-acao="quitar">${ico('check')}${t('st.quitarLocal')}</button>`;
    if (ctx === 'aguardando') {
      cls = 'st-aguardando'; icone = 'relogio';
      titulo = t('st.aguardandoT', { nome: esc(outra.nome) });
      texto = t('st.aguardando', { nome: esc(outra.nome) });
      if (outra.fixo) texto += ' ' + t('st.fixado', { nome: esc(outra.nome), id: esc(outra.id) });
      botoes = `<button class="btn btn-dark so-qr" type="button" data-acao="ler-qr">${ico('camera')}${t('st.lerConf')}</button>
                <button class="btn" type="button" data-acao="colar">${ico('copiar')}${t('st.colarConf')}</button>`;
    } else if (ctx === 'pessoal') {
      cls = 'st-pessoal'; icone = 'doc';
      titulo = t('st.pessoalT');
      texto = t('st.pessoal', { nome: esc(outra.nome) }) + atraso;
      if (d.dp < hojeDia() && !atraso) texto += ' ' + t('st.venceu', { data: fmt.data(d.dp) });
      botoes = `<button class="btn btn-primary" type="button" data-acao="pagamento-local">${ico('plus')}${t('st.pagamento')}</button>` + btnQuitarLocal +
               `<button class="btn" type="button" data-acao="pedir-confirmacao">${ico('enviar')}${t('st.pedirConf')}</button>`;
    } else if (ctx === 'recebida') {
      const souDevedor = m.emissor === 'credor';
      cls = 'st-recebida'; icone = 'doc';
      titulo = t('st.recebidaT', { nome: esc(emissor.nome) });
      texto = t(souDevedor ? 'st.recebidaDevedor' : 'st.recebidaCredor',
        { nome: esc(emissor.nome), valor: dinheiro(d.valor, d), de: fmt.data(d.de), total: dinheiro(c.total, d), dp: fmt.data(d.dp) });
      if (d.parcelas > 1) texto += ' ' + t('st.emParcelas', { n: d.parcelas });
      if (d.obs) texto += ' ' + t('st.obs', { obs: esc(d.obs) });
      texto += ' ' + t('st.confira');
      extraHTML = identidadeHTML(emissor);
      const paraOutro = outra.fixo && outra.pub !== perfil.pub;
      if (paraOutro) {
        texto += ' ' + t('st.paraOutro', { nome: esc(outra.nome), id: esc(outra.id) });
        botoes = `<button class="btn" type="button" data-acao="recusar">${t('st.naoReconheco')}</button>`;
      } else {
        botoes = `<button class="btn btn-primary" type="button" data-acao="confirmar">${ico('chave')}${t('st.confirmar')}</button>
                  <button class="btn" type="button" data-acao="recusar">${t('st.naoReconheco')}</button>`;
      }
    } else if (ctx === 'validado') {
      cls = 'st-validado'; icone = 'check';
      titulo = t('st.validadoT');
      texto = t('st.validado', { a: esc(m.credor.nome), b: esc(m.devedor.nome) });
      if (extra.recemConfirmado) texto += ' ' + t('st.mostreVolta', { nome: esc(emissor.nome) });
      texto += atraso;
      if (d.dp < hojeDia() && !atraso && s && s.saldo > 0) texto += ' ' + t('st.venceu', { data: fmt.data(d.dp) });
      if (s && s.saldo === 0 && s.pago > 0) texto += ' ' + t(sou === 'credor' ? 'st.tudoPagoCredor' : 'st.tudoPagoDevedor');
      extraHTML = identidadeHTML(parteNaoEu(m));
      if (reg) botoes = sou === 'credor' ? btnPagamento + btnQuitarAss : btnLerRecibo + btnQuitarLocal;
    } else if (ctx === 'quitado') {
      cls = 'st-quitado'; icone = 'check';
      titulo = t('st.quitadoT');
      texto = t(reg.quitadoAssinado ? 'st.quitadoAssinado' : 'st.quitado', { data: fmt.data(diaQuitado(reg)) });
      extraHTML = identidadeHTML(parteNaoEu(m));
      if (!reg.quitadoAssinado) botoes = `<button class="btn" type="button" data-acao="desquitar">${ico('desfazer')}${t('st.desfazer')}</button>`;
      if (!reg.quitadoAssinado && sou === 'credor' && m.credor.pub === perfil.pub) botoes += btnQuitarAss;
    } else if (ctx === 'cancelado') {
      const rc = recibosDe(reg).find(x => x.tipo === 'cancelamento');
      cls = 'st-cancelado'; icone = 'alerta';
      titulo = t('st.canceladoT');
      texto = t(sou === 'credor' ? 'st.canceladoCredor' : 'st.canceladoDevedor', { data: rc ? fmt.data(rc.dia) : '—', nome: esc(m.credor.nome) });
      if (sou === 'credor') botoes = `<button class="btn" type="button" data-acao="corrigir">${ico('doc')}${t('st.corrigir')}</button>`;
    } else if (ctx === 'terceiro') {
      cls = 'st-terceiro'; icone = 'escudo';
      titulo = t('st.terceiroT');
      texto = t('st.terceiro', { a: esc(m.credor.nome), b: esc(m.devedor.nome) });
      extraHTML = identidadeHTML(m.credor) + identidadeHTML(m.devedor);
    } else {
      cls = 'st-antigo'; icone = 'alerta';
      titulo = t('st.antigoT');
      texto = t('st.antigo');
    }
    const caixa = `<section class="status ${cls}"><span class="st-ico">${ico(icone)}</span><div><h3>${titulo}</h3><p>${texto}</p>${botoes ? `<div class="btns">${botoes}</div>` : ''}</div></section>`;
    // before signing, the identity check comes first, so a scam warning is read before the button
    return ctx === 'recebida' ? extraHTML + caixa : caixa + extraHTML;
  }

  function statusReciboHTML(mr) {
    const r = mr.recibo;
    const valor = r.valor ? fmt.dinheiro(r.valor, D.infoMoeda(r.moeda, r.casas)) : '';
    const texto = t('st.reciboAvulso.' + r.tipo, { nome: esc(r.nome), valor, data: fmt.data(r.dia), ref: esc(mr.ref) });
    return `<section class="status st-terceiro"><span class="st-ico">${ico('doc')}</span><div><h3>${t('st.reciboAvulsoT', { tipo: nomeTipoRecibo(r.tipo) })}</h3><p>${texto} ${t('st.reciboSemEmprestimo')}</p></div></section>` +
      identidadeHTML({ nome: r.nome, pub: r.pub, id: r.id, idLongo: r.idLongo });
  }

  function qrBloco({ codigo, legenda, dica, imprimir: podeImprimir = true, acaoCopiar = 'copiar', acaoEnviar = 'enviar', classe = '' }) {
    return `<section class="qr-card ${classe}">
      <div class="qr">${D.QR.svg(codigo, { nivel: 'M', rotulo: esc(t('qr.rotulo')) })}</div>
      <div class="qr-info">
        <p class="kicker">${legenda}</p>
        <code class="codigo">${esc(codigo)}</code>
        <div class="btns">
          <button class="btn btn-alt" type="button" data-acao="${acaoCopiar}">${ico('copiar')}${t('qr.copiar')}</button>
          <button class="btn" type="button" data-acao="${acaoEnviar}">${ico('enviar')}${t('aj.compartilhar')}</button>
          ${podeImprimir ? `<button class="btn" type="button" data-acao="imprimir">${ico('imprimir')}${t('qr.imprimir')}</button>` : ''}
        </div>
        ${dica ? `<p class="hint">${dica}</p>` : ''}
      </div>
    </section>`;
  }
  function qrHTML() {
    const { m, ctx, extra } = atual;
    if (ctx === 'recebida') return '';
    if (ctx === 'recibo') return qrBloco({ codigo: m.codigo, legenda: t('qr.recibo'), dica: t('qr.dicaRecibo') });
    let antes = '';
    if (extra.reciboMostrado) {
      const devedor = esc(m.devedor.nome);
      antes = qrBloco({
        codigo: extra.reciboMostrado, legenda: t('qr.reciboPara', { nome: devedor }), dica: t('qr.dicaReciboNovo', { nome: devedor }),
        imprimir: false, acaoCopiar: 'copiar-recibo', acaoEnviar: 'enviar-recibo', classe: 'qr-recibo'
      });
    }
    const aguardando = ctx === 'aguardando', pessoal = m.tipo === 'proposta' && !aguardando;
    const nomeOutra = m.emissor ? esc(parteOutra(m).nome) : '';
    let legenda, dica;
    if (aguardando) {
      legenda = t('qr.paraConfirmar', { nome: nomeOutra });
      dica = t('qr.dicaAg');
    } else if (pessoal) {
      legenda = t('qr.pessoal');
      dica = ctx === 'pessoal' ? t('qr.dicaPessoal', { nome: nomeOutra }) : '';
    } else {
      legenda = t(m.tipo === 'v1' ? 'qr.antigo' : 'qr.validado');
      dica = t('qr.dica');
    }
    return antes + qrBloco({ codigo: m.codigo, legenda, dica, imprimir: !aguardando });
  }

  function resumoHTML(m, reg) {
    if (m.tipo === 'recibo') {
      const r = m.recibo, info = D.infoMoeda(r.moeda, r.casas);
      return `<div class="summary">
        <div class="stat s-1"><span>${t('res.valorRecibo')}</span>${valorStat(fmt.dinheiro(r.valor, info))}<small>${esc(nomeTipoRecibo(r.tipo))}</small></div>
        <div class="stat s-3"><span>${t('res.dataPagamento')}</span><b>${fmt.dataCurta(r.dia)}</b><small>${fmt.data(r.dia)}</small></div>
      </div>`;
    }
    const c = m.calc, d = m.dados;
    const pct = fmt.num(d.valor ? Math.round(c.lucro / d.valor * 10000) / 100 : 0);
    let html = `<div class="summary">
      <div class="stat s-1"><span>${t('res.total')}</span>${valorStat(dinheiro(c.total, d))}<small>${t('res.totalNota')}</small></div>
      <div class="stat s-2"><span>${t('res.lucro')}</span>${valorStat(dinheiro(c.lucro, d))}<small>${t('res.lucroNota', { pct })}</small></div>
      <div class="stat s-3"><span>${t('res.prazo')}</span><b>${fmt.dias(c.dias)}</b><small>${fmt.dataCurta(d.de)} ${DebtIDIdioma.rtl() ? '←' : '→'} ${fmt.dataCurta(d.dp)}</small></div>
      <div class="stat s-4"><span>${t('res.juros')}</span>${valorStat(fmt.dinheiro4(c.jurosCentavos, infoDe(d)))}<small>${t('res.jurosNota')}</small></div>
    </div>`;
    if (reg && (temRegras(reg) || pagamentosDe(reg).length) && reg.status !== 'cancelado') {
      const s = situacaoDe(reg);
      const saldo = reg.status === 'quitado' ? 0 : s.saldo;
      html += `<div class="summary summary-2">
        <div class="stat s-2"><span>${t('res.pago')}</span>${valorStat(dinheiro(s.pago, reg))}<small>${t('res.pagoNota', { n: pagamentosDe(reg).length })}</small></div>
        <div class="stat s-1"><span>${t('res.saldo')}</span>${valorStat(dinheiro(saldo, reg))}<small>${t(s.encargos ? 'res.saldoEncargos' : 'res.saldoNota')}</small></div>
        ${reg.multa || reg.mora ? `<div class="stat s-4"><span>${t('res.encargos')}</span>${valorStat(dinheiro(s.encargos, reg))}<small>${t('res.encargosNota')}</small></div>` : ''}
        ${s.proxima && reg.status !== 'quitado' ? `<div class="stat s-3"><span>${t('res.proxima')}</span><b>${fmt.dataCurta(s.proxima.dia)}</b><small>${t('res.proximaNota', { n: s.proxima.n, de: reg.parcelas || 1, valor: dinheiro(s.proxima.restante, reg) })}</small></div>` : ''}
      </div>`;
    }
    return html;
  }

  // Installments, late charges and signed receipts of a saved loan
  function pagamentosHTML(reg) {
    if (!reg || reg.tipoCodigo === 'v1') return '';
    const recibos = recibosDe(reg).slice().sort((a, b) => a.ts - b.ts);
    const locais = pagamentosLocaisDe(reg);
    if (!temRegras(reg) && !recibos.length && !locais.length) return '';
    const dia = hojeDia(), s = situacaoDe(reg, dia);
    let html = `<section class="panel pagamentos" aria-labelledby="t-pag"><h3 id="t-pag">${t('pg.titulo')}</h3>`;
    if ((reg.parcelas || 1) > 1 || reg.multa || reg.mora) {
      html += '<ol class="parcelas">' + s.parcelas.map(p => {
        let estado, cls;
        if (reg.status === 'quitado' || p.restante === 0) { estado = p.pagaEm != null ? t('pg.pagaEm', { data: fmt.data(p.pagaEm) }) : t('pg.paga'); cls = 'ok'; }
        else if (reg.status === 'cancelado') { estado = t('pg.cancelada'); cls = ''; }
        else if (p.dia < dia) { estado = t('pg.atrasada', { dias: fmt.dias(dia - p.dia), falta: dinheiro(p.restante, reg) }); cls = 'atraso'; }
        else if (p.restante < p.valor) { estado = t('pg.parcial', { falta: dinheiro(p.restante, reg) }); cls = 'parcial'; }
        else { estado = t('pg.aVencer'); cls = ''; }
        return `<li class="${cls}"><span class="pc-n">${p.n}/${reg.parcelas || 1}</span><span class="pc-main"><b>${dinheiro(p.valor, reg)}</b><small>${t('pg.vence', { data: fmt.data(p.dia) })}</small></span><span class="pc-estado">${estado}</span></li>`;
      }).join('') + '</ol>';
    }
    if (reg.multa || reg.mora) {
      html += `<p class="hint">${t('pg.regras', { multa: fmt.taxa(reg.multa || 0), mora: fmt.taxa(reg.mora || 0) })}${s.encargos ? ' ' + t('pg.encargosHoje', { x: dinheiro(s.encargos, reg) }) : ''}</p>`;
    }
    if (locais.length) {
      html += `<h4>${t('pg.recibos')}</h4><ul class="recibos">` + locais.map(x =>
        `<li><span class="pc-main"><b>${t('recibo.pagamento')} · ${dinheiro(x.valor, reg)}</b><small>${fmt.data(x.dia)}</small></span></li>`).join('') + '</ul>';
    }
    if (recibos.length) {
      html += `<h4>${t('pg.recibos')}</h4><ul class="recibos">` + recibos.map(x =>
        `<li><span class="pc-main"><b>${esc(nomeTipoRecibo(x.tipo))}${x.valor ? ' · ' + dinheiro(x.valor, reg) : ''}</b><small>${t('pg.reciboDia', { data: fmt.data(x.dia), quando: fmt.momento(x.ts, x.tz) })}</small></span>
         <button class="btn btn-ghost" type="button" data-acao="ver-recibo" data-rid="${esc(x.rid)}">${ico('qr')}${t('pg.verRecibo')}</button></li>`).join('') + '</ul>';
    } else if (reg.papel === 'credor' && emAberto(reg)) {
      html += `<p class="hint">${t('pg.semRecibosCredor')}</p>`;
    } else if (emAberto(reg)) {
      html += `<p class="hint">${t('pg.semRecibosDevedor')}</p>`;
    }
    return html + '</section>';
  }

  function linhaTempoHTML(m, reg) {
    if (!m.emissor) return '';
    const ev = [];
    const em = parteEmissora(m);
    ev.push({ ts: m.dados.ts, tz: m.dados.tz, texto: t('tl.criado', { nome: esc(em.nome) }) });
    if (m.confirmadoEm) ev.push({ ts: m.confirmadoEm.ts, tz: m.confirmadoEm.tz, texto: t('tl.confirmado', { nome: esc(parteOutra(m).nome) }) });
    for (const x of pagamentosLocaisDe(reg)) {
      ev.push({ ts: x.ts, tz: x.tz, texto: `${t('recibo.pagamento')} · ${dinheiro(x.valor, reg)} · ${fmt.data(x.dia)}` });
    }
    for (const x of recibosDe(reg)) {
      ev.push({ ts: x.ts, tz: x.tz, texto: t('tl.recibo.' + x.tipo, { valor: x.valor ? dinheiro(x.valor, reg) : '', data: fmt.data(x.dia), nome: esc(m.credor.nome) }) });
    }
    if (reg && reg.status === 'quitado' && !reg.quitadoAssinado && reg.quitadoEm) {
      ev.push({ ...momentoDe(new Date(reg.quitadoEm)), texto: t('tl.quitadoLocal', { data: fmt.data(diaQuitado(reg)) }) });
    }
    if (ev.length < 2) return '';
    ev.sort((a, b) => a.ts - b.ts);
    return `<section class="panel linha-tempo" aria-labelledby="t-tl"><h3 id="t-tl">${t('tl.titulo')}</h3><ol>` +
      ev.map(e => `<li><small>${fmt.momento(e.ts, e.tz)}</small><span>${e.texto}</span></li>`).join('') + '</ol></section>';
  }

  function textoJuros(d, c) {
    if (d.taxa === 0) return t('juros.sem');
    const v = { taxa: fmt.taxaModo(d.taxa, d.modo), dias: fmt.dias(c.dias), juros: dinheiro(c.lucro, d),
                base: t(d.modo === 'mes' ? 'juros.baseMes' : 'juros.baseAno') };
    if (d.composto) return t('juros.compostos', v);
    return t(d.modo === 'total' ? 'juros.simplesTotal' : 'juros.simples', v);
  }

  // top and bottom of a printed receipt (a loan's or a payment's): the brand, then the QR code and the code
  const cabecalhoRecibo = ref => `<header class="rc-head"><div class="rc-brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="44 44 168 168"><rect class="bm-a" x="64" y="52" width="36" height="152" rx="6"/><path class="bm-a" d="M116 52A76 76 0 0 1 116 204V168A40 40 0 0 0 116 88Z"/><circle class="bm-p" cx="133" cy="128" r="13"/></svg></span>DebtID</div><span class="rc-ref">Ref. ${esc(ref)}</span></header>`;
  const codigoRecibo = (codigo, nota) => `<div class="rc-key">
        <div class="rc-qr">${D.QR.svg(codigo, { nivel: 'M', margem: 2, rotulo: esc(t('qr.rotulo')) })}</div>
        <div>
          <p class="rc-key-label">${t('rc.codigo')}</p>
          <code>${esc(codigo)}</code>
          <p class="rc-key-note">${ico('cadeado')}<span>${nota}</span></p>
        </div>
      </div>`;

  function reciboHTML(m, reg) {
    if (m.tipo === 'recibo') return reciboAvulsoHTML(m);
    const c = m.calc, d = m.dados, moeda = infoDe(d);
    const credor = esc(m.credor.nome), devedor = esc(m.devedor.nome);
    // a record kept without the other person's confirmation (only the issuer signed)
    const pessoal = m.tipo === 'proposta' && !!(reg && reg.soRegistro);
    const linha = (rot, val, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><dt>${rot}</dt><dd>${val}</dd></div>`;
    const assinatura = (parte, papel) => parte.assinou
      ? `<div class="sig"><span class="selo">${ico('check')}</span><span class="sig-role">${papel}</span><b>${esc(parte.nome)}</b><small>ID ${esc(parte.idLongo || parte.id)}</small><small>${t('rc.assinou', { quando: fmt.momento(parte.ts, parte.tz) })}</small>${parte.nomeInformado && parte.nomeInformado !== parte.nome ? `<small>${t('rc.informado', { nome: esc(parte.nomeInformado) })}</small>` : ''}</div>`
      : `<div class="sig off"><span class="sig-role">${papel}</span><b>${esc(parte.nome)}</b>${parte.fixo ? `<small>ID ${esc(parte.idLongo || parte.id)}</small>` : ''}<small>${t(m.tipo === 'v1' ? 'rc.semAssinatura' : pessoal ? 'rc.semConfirmacao' : 'rc.aguardando')}</small></div>`;
    let situacao, nota, situacaoCurta;
    if (m.tipo === 'validado') {
      situacao = t('rc.situacaoVal', { a: credor, b: devedor });
      situacaoCurta = t('rc.curtaVal');
      nota = t('rc.notaVal');
    } else if (m.tipo === 'proposta') {
      const a = esc(parteEmissora(m).nome), b = esc(parteOutra(m).nome);
      situacao = t(pessoal ? 'rc.situacaoPessoal' : 'rc.situacaoProp', { a, b });
      situacaoCurta = t(pessoal ? 'rc.curtaPessoal' : 'rc.curtaProp');
      nota = t(pessoal ? 'rc.notaPessoal' : 'rc.notaProp', { a, b });
    } else {
      situacao = t('rc.situacaoV1');
      situacaoCurta = t('rc.curtaV1');
      nota = t('rc.notaV1');
    }
    if (reg && reg.status === 'cancelado') situacaoCurta = t('rotulo.cancelado');
    else if (reg && reg.status === 'quitado') situacaoCurta = t(reg.quitadoAssinado ? 'rc.curtaQuitadoAss' : 'rotulo.quitado');
    const confirmado = m.confirmadoEm ? fmt.momento(m.confirmadoEm.ts, m.confirmadoEm.tz) : '—';
    const taxa = d.taxa === 0 ? t('rc.semJuros')
      : `${fmt.taxaModo(d.taxa, d.modo)}${d.modo === 'total' ? '' : t(d.composto ? 'rc.compostos' : 'rc.simples')}`;
    let extras = '';
    if (d.parcelas > 1) {
      const lista = D.parcelasDe(d, c.total);
      extras += `<p class="rc-text">${t('rc.parcelas', { n: d.parcelas, lista: lista.map(p => t('rc.parcelaItem', { n: p.n, valor: dinheiro(p.valor, d), data: fmt.data(p.dia) })).join('; ') })}</p>`;
    }
    if (d.multa || d.mora) extras += `<p class="rc-text">${t(d.multa && d.mora ? 'rc.atraso' : d.multa ? 'rc.atrasoMulta' : 'rc.atrasoMora', { multa: fmt.taxa(d.multa || 0), mora: fmt.taxa(d.mora || 0) })}</p>`;
    const recibos = recibosDe(reg).filter(x => x.tipo !== 'cancelamento' && x.valor > 0).sort((a, b) => a.dia - b.dia);
    let pagos = '';
    if (recibos.length || (reg && reg.status === 'cancelado')) {
      const s = situacaoDe(reg);
      pagos = `<div class="rc-pagos"><p class="rc-key-label">${t('rc.pagamentos')}</p><ul>` +
        recibos.map(x => `<li><span>${fmt.data(x.dia)}</span><span>${esc(nomeTipoRecibo(x.tipo))}</span><b>${dinheiro(x.valor, d)}</b></li>`).join('') +
        `</ul><p class="rc-note">${reg.status === 'cancelado' ? t('rc.canceladoNota', { nome: credor }) : t('rc.saldoNota', { saldo: dinheiro(reg.status === 'quitado' ? 0 : s.saldo, d) })}</p></div>`;
    }
    return `
      ${cabecalhoRecibo(m.ref)}
      <div class="rc-body">
        <p class="kicker">${t('rc.kicker')}</p>
        <h3 class="rc-title">${t('rc.titulo')}</h3>
        <p class="rc-text">${t('rc.p1', { devedor, credor, data: fmt.dataExtenso(d.de), valor: dinheiro(d.valor, d), extenso: extenso(d.valor, moeda) })}${d.obs ? ' ' + t('rc.finalidade', { obs: esc(d.obs) }) : ''}</p>
        <p class="rc-text">${t('rc.p2', { juros: textoJuros(d, c), credor, total: dinheiro(c.total, d), extenso: extenso(c.total, moeda), data: fmt.dataExtenso(d.dp), dias: fmt.dias(c.dias) })}</p>
        ${extras}
        <p class="rc-note">${situacao} ${t('rc.arred', { tipo: t(d.composto ? 'rc.tipoCompostos' : 'rc.tipoSimples') })}</p>
        <dl class="rc-grid">
          ${linha(t('rc.credor'), credor)}
          ${linha(t('rc.devedor'), devedor)}
          ${linha(t('rc.moeda'), `${esc(fmt.nomeMoeda(moeda))} (${esc(moeda.codigo)})`)}
          ${linha(t('rc.valor'), dinheiro(d.valor, d))}
          ${linha(t('rc.taxa'), taxa)}
          ${linha(t('rc.de'), fmt.data(d.de))}
          ${linha(t('rc.dp'), fmt.data(d.dp))}
          ${linha(t('rc.prazo'), fmt.dias(c.dias))}
          ${d.parcelas > 1 ? linha(t('rc.nParcelas'), String(d.parcelas)) : ''}
          ${linha(t('rc.juros'), fmt.dinheiro4(c.jurosCentavos, moeda))}
          ${linha(t('rc.lucro'), dinheiro(c.lucro, d))}
          ${d.obs ? linha(t('rc.obs'), esc(d.obs), 'wide') : ''}
          ${linha(t('rc.situacao'), situacaoCurta)}
          ${linha(t('rc.registrado'), fmt.momento(d.ts, d.tz))}
          ${linha(t('rc.confirmado'), confirmado)}
          ${linha(t('rc.total'), dinheiro(c.total, d), 'hl')}
        </dl>
        ${pagos}
        <div class="rc-sign">${assinatura(m.credor, t('rc.credor'))}${assinatura(m.devedor, t('rc.devedor'))}</div>
      </div>
      ${codigoRecibo(m.codigo, nota)}`;
  }

  function reciboAvulsoHTML(mr) {
    const r = mr.recibo, info = D.infoMoeda(r.moeda, r.casas);
    const valor = r.valor ? fmt.dinheiro(r.valor, info) : '—';
    const linha = (rot, val) => `<div><dt>${rot}</dt><dd>${val}</dd></div>`;
    return `
      ${cabecalhoRecibo(mr.ref)}
      <div class="rc-body">
        <p class="kicker">${t('rc.kickerRecibo')}</p>
        <h3 class="rc-title">${esc(nomeTipoRecibo(r.tipo))}</h3>
        <p class="rc-text">${t('rc.recibo.' + r.tipo, { nome: esc(r.nome), valor, extenso: r.valor ? extenso(r.valor, info) : '', data: fmt.dataExtenso(r.dia), ref: esc(mr.ref) })}</p>
        <dl class="rc-grid">
          ${linha(t('rc.assinadoPor'), esc(r.nome))}
          ${linha('ID', esc(r.idLongo))}
          ${linha(t('rc.valor'), valor)}
          ${linha(t('res.dataPagamento'), fmt.data(r.dia))}
          ${linha(t('rc.registrado'), fmt.momento(r.ts, r.tz))}
          ${linha(t('rc.emprestimo'), 'Ref. ' + esc(mr.ref))}
        </dl>
      </div>
      ${codigoRecibo(mr.codigo, t('rc.notaRecibo'))}`;
  }

  function renderDetalhe() {
    const { m, reg } = atual;
    const usar = m.emissor && reg ? `<button class="btn btn-ghost" type="button" data-acao="usar-dados">${ico('doc')}${t('det.usarDados')}</button>` : '';
    // only the creditor can cancel (with a signed cancellation), and only an open loan they signed
    const cancelar = reg && reg.papel === 'credor' && emAberto(reg) && m.credor.pub === perfil.pub
      ? `<button class="btn btn-ghost" type="button" data-acao="cancelar">${ico('lixo')}${t('pg.cancelar')}</button>` : '';
    $('#detalhe').innerHTML = statusHTML() + qrHTML() + resumoHTML(m, reg) + pagamentosHTML(reg) +
      `<article class="receipt">${reciboHTML(m, reg)}</article>` + linhaTempoHTML(m, reg) +
      (reg ? `<div class="form-foot">${usar}${cancelar}<button class="btn btn-ghost" type="button" data-acao="excluir">${ico('lixo')}${t('det.excluir')}</button></div>` : '');
  }
  function reRender(extra = {}) {
    atual.extra = { ...atual.extra, ...extra };
    if (atual.reg) atual.reg = registros.find(r => r.k === atual.reg.k) || null;
    if (atual.reg) atual.ctx = ctxDe(atual.reg);
    renderDetalhe();
  }

  function mensagemCompartilhar() {
    const { m, ctx } = atual;
    if (m.tipo === 'recibo') return t('share.recibo', { ref: m.ref, codigo: m.codigo });
    if (ctx === 'aguardando') {
      return t('share.aguardando', { eu: perfil.nome, total: dinheiro(m.calc.total, m.dados), data: fmt.data(m.dados.dp), codigo: m.codigo });
    }
    if (m.tipo === 'validado' && parteEmissora(m).id !== perfil.id && papelDe(m)) return t('share.confirmei', { codigo: m.codigo });
    return t('share.geral', { ref: m.ref, codigo: m.codigo });
  }

  async function confirmarAtual(botao) {
    const m = atual.m;
    const meuPapel = m.emissor === 'credor' ? 'devedor' : 'credor';
    const outro = parteEmissora(m);
    const conf = confiancaDe(outro);
    let texto = t(meuPapel === 'devedor' ? 'modal.assinarDevedor' : 'modal.assinarCredor',
      { valor: dinheiro(m.dados.valor, m.dados), nome: outro.nome, total: dinheiro(m.calc.total, m.dados), data: fmt.data(m.dados.dp) });
    if (conf === 'homonimo') texto = t('modal.assinarHomonimo', { nome: outro.nome, id: outro.id }) + ' ' + texto;
    else if (conf === 'novo') texto += ' ' + t('modal.assinarNovo', { id: outro.idLongo });
    const ok = await perguntar({ titulo: t('modal.assinarT'), texto, ok: t('modal.assinarOk'), perigo: conf === 'homonimo' });
    if (!ok) return;
    if (botao) botao.disabled = true;
    try {
      const cod = await D.confirmarProposta(perfil, m.codigo);
      const mv = await D.lerCodigo(cod);
      upsert({ ...registroDe(mv, meuPapel, 'validado'), soRegistro: false });
      if (conf !== 'homonimo') salvarContato(outro); // you looked at the ID before signing
      await abrirModelo(mv, { recemConfirmado: true, aviso: t('toast.assinado') });
    } catch (err) {
      toastErro(err);
      if (botao) botao.disabled = false;
    }
  }

  // The creditor signs a receipt and shows its QR code to the debtor.
  async function emitirRecibo(tipo) {
    const { m, reg } = atual;
    const s = situacaoDe(reg), hojeISO = isoDeDia(hojeDia()), deISO = isoDeDia(Math.min(m.dados.de, hojeDia()));
    let resp;
    if (tipo === 'pagamento') {
      resp = await perguntar({
        titulo: t('modal.pagamentoT'), texto: t('modal.pagamento', { nome: m.devedor.nome, saldo: dinheiro(s.saldo, reg) }), ok: t('modal.pagamentoOk'),
        valor: { moeda: reg.moeda, casas: reg.casas, padrao: s.proxima ? Math.min(s.proxima.restante, s.saldo) : s.saldo, rotulo: t('modal.valorRecebido') },
        data: hojeISO, dataMin: deISO, dataMax: hojeISO
      });
      if (!resp) return;
      if (resp.valor >= s.saldo && s.saldo > 0) tipo = 'quitacao'; // the payment covers the balance: it settles the loan
    } else if (tipo === 'quitacao') {
      resp = await perguntar({
        titulo: t('modal.quitacaoT'), texto: t('modal.quitacao', { nome: m.devedor.nome, saldo: dinheiro(s.saldo, reg) }), ok: t('modal.quitacaoOk'),
        valor: { moeda: reg.moeda, casas: reg.casas, padrao: s.saldo, minimo: 0, rotulo: t('modal.valorUltimo') },
        data: hojeISO, dataMin: deISO, dataMax: hojeISO
      });
      if (!resp) return;
    } else {
      const ok = await perguntar({ titulo: t('modal.cancelarEmpT'), texto: t('modal.cancelarEmp', { nome: m.devedor.nome }), ok: t('modal.cancelarEmpOk'), perigo: true });
      if (!ok) return;
      resp = { valor: 0, dia: Math.max(m.dados.de, hojeDia()) };
    }
    try {
      const codigo = await D.criarRecibo(perfil, m, { tipo, valor: resp.valor, dia: resp.dia });
      const mr = await D.lerCodigo(codigo);
      guardarRecibo(reg, mr);
      reRender({ reciboMostrado: codigo });
      window.scrollTo({ top: 0, behavior: 'instant' });
      toast(t('toast.recibo.' + tipo, { nome: m.devedor.nome }));
    } catch (err) {
      toastErro(err);
    }
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    if (acao === 'escolher-tipo') {
      $('#p-' + (b.dataset.papel === 'devedor' ? 'devedor' : 'credor')).checked = true;
      $(b.dataset.pessoal === 'true' ? '#c-so' : '#c-pedir').checked = true;
      atualizaDicas();
      $('#novo-form').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (acao === 'ler-qr') return lerEAbrir();
    if (acao === 'copiar-backup') return toast(t(await copiar($('#codigoBackup').textContent) ? 'toast.backupCopiado' : 'toast.semCopiarCurto'));
    if (acao === 'enviar-backup') return compartilhar($('#codigoBackup').textContent);
    if (acao === 'abrir-reg') {
      const r = registros.find(x => x.k === b.dataset.k);
      if (r) { try { await abrirModelo(await D.lerCodigo(r.codigo)); } catch (err) { toastErro(err); } }
      return;
    }
    if (acao === 'pessoa') { filtroPessoa = b.dataset.chave; definirVisao('lista'); return; }
    if (acao === 'tirar-pessoa') { filtroPessoa = null; renderLista(); return; }
    if (acao === 'backup-agora') { irPara('ajustes'); setTimeout(() => { $('#t-backup').scrollIntoView({ block: 'start' }); $('#btnBackup').click(); }, 80); return; }
    if (acao === 'backup-depois') { gravarTexto(K.backupAdiado, String(Date.now())); renderLembreteBackup(); return; }
    if (acao === 'ativar-lembretes') { ligarLembretes(true); return; }
    if (acao === 'exportar-csv') return exportarCSV();
    if (acao === 'relatorio') return relatorioPDF();
    if (acao === 'ver-tabela') { const tb = $('#graficoTabela'); tb.hidden = !tb.hidden; b.setAttribute('aria-expanded', String(!tb.hidden)); return; }
    if (acao === 'contato-renomear' || acao === 'contato-remover') return acaoContato(acao, b.dataset.pub);
    if (acao.startsWith('trava-')) return acaoTrava(acao);
    if (!atual) return;
    const { reg } = atual;
    switch (acao) {
      case 'colar': irPara('conferir'); setTimeout(() => $('#f-codigo').focus(), 60); break;
      case 'confirmar': confirmarAtual(b); break;
      case 'recusar': atual = null; irPara('conferir'); toast(t('toast.nadaAssinado')); break;
      case 'copiar': toast(t(await copiar(atual.m.codigo) ? 'toast.codigoCopiado' : 'toast.semCopiar')); break;
      case 'enviar': compartilhar(mensagemCompartilhar()); break;
      case 'copiar-recibo': toast(t(await copiar(atual.extra.reciboMostrado) ? 'toast.codigoCopiado' : 'toast.semCopiar')); break;
      case 'enviar-recibo': compartilhar(t('share.recibo', { ref: atual.m.ref, codigo: atual.extra.reciboMostrado })); break;
      case 'imprimir': imprimir(); break;
      case 'salvar-contato': {
        const m = atual.m;
        const partes = m.tipo === 'recibo' ? [{ nome: m.recibo.nome, pub: m.recibo.pub, id: m.recibo.id, idLongo: m.recibo.idLongo }] : [m.credor, m.devedor];
        const parte = partes.find(p => p.pub === b.dataset.pub);
        if (!parte) break;
        const ok = await perguntar({ titulo: t('modal.contatoT'), texto: t('modal.contato', { nome: parte.nome, id: parte.idLongo || parte.id }), ok: t('modal.contatoOk') });
        if (!ok) break;
        salvarContato(parte); reRender(); toast(t('toast.contatoSalvo', { nome: parte.nome }));
        break;
      }
      case 'pagamento-local': {
        if (!reg || !reg.soRegistro || !emAberto(reg)) break;
        const saldo = situacaoDe(reg).saldo;
        if (saldo <= 0) break;
        const hojeISO = isoDeDia(hojeDia());
        const resp = await perguntar({
          titulo: t('modal.pagamentoT'), texto: t('modal.pagamento', { nome: reg.outro, saldo: dinheiro(saldo, reg) }), ok: t('modal.pagamentoOk'),
          valor: { moeda: reg.moeda, casas: reg.casas, padrao: Math.min(saldo, situacaoDe(reg).proxima?.restante || saldo), rotulo: t('modal.valorRecebido') },
          data: hojeISO, dataMin: isoDeDia(Math.min(reg.de, hojeDia())), dataMax: hojeISO
        });
        if (!resp) break;
        if (resp.valor <= 0 || resp.valor > saldo) { toast(t('modal.valorInvalido')); break; }
        const agora = momentoDe(new Date());
        upsert({ k: reg.k, pagamentosLocais: [...pagamentosLocaisDe(reg), { ...resp, ...agora, valor: resp.valor }], atualizadoEm: Date.now() });
        reRender(); toast(t('toast.recibo.pagamento', { nome: reg.outro }));
        break;
      }
      case 'pagamento': emitirRecibo('pagamento'); break;
      case 'quitar-assinado': emitirRecibo('quitacao'); break;
      case 'cancelar': emitirRecibo('cancelamento'); break;
      case 'ver-recibo': {
        const x = recibosDe(reg).find(y => y.rid === b.dataset.rid);
        if (x) { reRender({ reciboMostrado: x.codigo }); window.scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' }); }
        break;
      }
      case 'corrigir': case 'usar-dados': preencherForm(atual.m, reg); toast(t(acao === 'corrigir' ? 'toast.corrigir' : 'toast.usarDados')); break;
      case 'quitar': {
        const hojeISO = isoDeDia(hojeDia());
        const r = await perguntar({
          titulo: t('modal.quitarT'), texto: t(reg.papel === 'devedor' ? 'modal.quitarDevedor' : 'modal.quitarCredor'),
          ok: t('modal.quitarOk'), data: hojeISO, dataMax: hojeISO
        });
        if (!r) break;
        upsert({ k: reg.k, status: 'quitado', quitadoEm: Date.now(), quitadoDia: r.dia, quitadoAssinado: false, atualizadoEm: Date.now() });
        reRender(); toast(t('toast.quitado')); break;
      }
      case 'desquitar': {
        if (reg.quitadoAssinado) break;
        const volta = reg.soRegistro ? 'registrado' : reg.tipoCodigo === 'validado' ? 'validado' : 'aguardando';
        upsert({ k: reg.k, status: volta, quitadoEm: null, quitadoDia: null, atualizadoEm: Date.now() });
        reRender(); break;
      }
      case 'pedir-confirmacao':
        upsert({ k: reg.k, status: 'aguardando', soRegistro: false, atualizadoEm: Date.now() });
        reRender(); window.scrollTo({ top: 0, behavior: 'instant' });
        toast(t('toast.pedirConf', { nome: parteOutra(atual.m).nome })); break;
      case 'excluir':
        if (await perguntar({ titulo: t('modal.excluirT'), texto: t('modal.excluir'), ok: t('modal.excluirOk'), perigo: true })) {
          registros = registros.filter(r => r.k !== reg.k); salvarRegistros();
          atual = null; irPara('registros'); toast(t('toast.excluido'));
        }
        break;
    }
  });

  /* ---------------- records list ---------------- */
  let filtroPessoa = null;
  const visao = () => (lerTexto(K.visao) === 'pessoas' ? 'pessoas' : 'lista');
  function definirVisao(v) {
    gravarTexto(K.visao, v === 'pessoas' ? 'pessoas' : null);
    $$('input[name="visao"]').forEach(i => { i.checked = i.value === visao(); });
    renderLista();
  }
  $$('input[name="visao"]').forEach(i => i.addEventListener('change', () => definirVisao(i.value)));
  $('#busca').addEventListener('input', () => renderLista());
  $('#ordem').addEventListener('change', () => { gravarTexto(K.ordem, $('#ordem').value); renderLista(); });
  const chavePessoa = r => (r.outroPub ? 'pub:' + r.outroPub : 'nome:' + normNome(r.outro));
  const nomePessoa = r => { const c = contatoDe(r.outroPub); return c ? nomeContato(c) : r.outro; };
  const atrasado = (r, dia) => emAberto(r) && situacaoDe(r, dia).atrasadas > 0;

  // one line per currency: amounts in different currencies are never added together
  function somasPorMoeda(lista, valor) {
    const grupos = new Map();
    for (const r of lista) {
      const m = infoDe(r), k = m.codigo + '|' + m.casas;
      grupos.set(k, { m, v: (grupos.has(k) ? grupos.get(k).v : 0) + valor(r) });
    }
    const linhas = [...grupos.values()].sort((a, b) => a.m.codigo.localeCompare(b.m.codigo));
    return linhas.length ? linhas.map(g => valorStat(fmt.dinheiro(Math.round(g.v), g.m))).join('')
                         : valorStat(fmt.dinheiro(0, D.MOEDAS[moedaPadrao()]));
  }
  const saldoAberto = r => (emAberto(r) ? situacaoDe(r).saldo : 0);

  function renderInicio() {
    const dia = hojeDia(), abertos = registros.filter(emAberto);
    $('#inicioTotais').innerHTML =
      `<div class="stat s-2"><span>${t('reg.receber')}</span>${somasPorMoeda(abertos.filter(r => r.papel === 'credor'), saldoAberto)}</div>` +
      `<div class="stat s-3"><span>${t('reg.pagar')}</span>${somasPorMoeda(abertos.filter(r => r.papel === 'devedor'), saldoAberto)}</div>`;
    const vencendo = [];
    for (const r of abertos) {
      const p = situacaoDe(r, dia).parcelas.find(x => x.restante > 0 && x.dia <= dia + 30);
      if (p) vencendo.push({ r, p });
    }
    vencendo.sort((a,b) => a.p.dia - b.p.dia);
    const v = $('#inicioVencimentos');
    v.hidden = !vencendo.length;
    v.innerHTML = vencendo.length ? `<h2>${t('venc.titulo')}</h2><div class="lista">` +
      vencendo.slice(0, 3).map(({ r }) => linhaRegistro(r, dia)).join('') + '</div>' : '';
    const recentes = registros.slice().sort((a,b) => (b.atualizadoEm || b.criadoEm || 0) - (a.atualizadoEm || a.criadoEm || 0)).slice(0, 5);
    $('#inicioRecentes').innerHTML = recentes.length ? recentes.map(r => linhaRegistro(r, dia)).join('')
      : `<p class="hint">${t('inicio.vazio')}</p>`;
  }

  function renderRegistros() {
    const abertos = registros.filter(emAberto);
    $('#totais').innerHTML =
      `<div class="stat s-2"><span>${t('reg.receber')}</span>${somasPorMoeda(abertos.filter(r => r.papel === 'credor'), saldoAberto)}<small>${t('reg.totaisNota')}</small></div>` +
      `<div class="stat s-3"><span>${t('reg.pagar')}</span>${somasPorMoeda(abertos.filter(r => r.papel === 'devedor'), saldoAberto)}<small>${t('reg.totaisNota')}</small></div>`;
    renderLembreteBackup();
    renderVencimentos();
    renderLucro();
    $$('input[name="visao"]').forEach(i => { i.checked = i.value === visao(); });
    const ordemSalva = lerTexto(K.ordem);
    if (['recentes', 'vencimento', 'valor', 'nome'].includes(ordemSalva)) $('#ordem').value = ordemSalva;
    renderLista();
  }

  function linhaRegistro(r, dia) {
    const recebe = r.papel === 'credor';
    const aberto = emAberto(r);
    const s = aberto ? situacaoDe(r, dia) : null;
    const vencido = !!(s && s.atrasadas);
    let quando;
    if (r.status === 'quitado') quando = t('reg.quitado');
    else if (r.status === 'cancelado') quando = t('reg.cancelado');
    else if (s && s.proxima && (r.parcelas || 1) > 1) quando = t(s.proxima.dia < dia ? 'reg.parcelaVenceu' : 'reg.parcelaVence', { n: s.proxima.n, de: r.parcelas, data: fmt.data(s.proxima.dia) });
    else quando = t(r.dp < dia && aberto ? 'reg.venceu' : 'reg.vence', { data: fmt.data(r.dp) });
    const valor = s && s.pago > 0 ? s.saldo : r.total;
    const rot = vencido ? 'vencido' : r.status;
    return `<button class="reg" type="button" data-acao="abrir-reg" data-k="${esc(r.k)}">
        <span class="reg-ico ${recebe ? 'rec' : 'pag'}">${ico(recebe ? 'baixo' : 'cima')}</span>
        <span class="reg-main"><b>${esc(nomePessoa(r))}</b><small>${t(recebe ? 'reg.emprestou' : 'reg.deve')} · ${quando}</small>${r.obs ? `<small class="reg-obs">${esc(r.obs)}</small>` : ''}</span>
        <span class="reg-side"><b>${dinheiro(valor, r)}</b>${s && s.pago > 0 ? `<small>${t('reg.falta')}</small>` : ''}<span class="chip ${rot}">${t('rotulo.' + rot)}</span></span>
      </button>`;
  }

  function renderLista() {
    const el = $('#lista');
    const dia = hojeDia();
    const filtro = ($('input[name="filtro"]:checked') || {}).value || 'todos';
    $('#filtrosLista').hidden = visao() === 'pessoas';
    if (!registros.length) {
      el.innerHTML = `<div class="vazio"><b>${t('reg.vazioT')}</b><p>${t('reg.vazio')}</p><a class="btn btn-primary" href="#novo">${ico('plus')}${t('comum.novoRegistro')}</a></div>`;
      $('#pessoaFiltro').innerHTML = '';
      return;
    }
    const q = normNome($('#busca').value);
    const casa = r => !q || [nomePessoa(r), r.outro, r.obs || '', r.id || '', r.outroId || '', fmt.numMoeda(r.total, infoDe(r).casas), dinheiro(r.total, r)]
      .some(x => normNome(x).includes(q) || normNome(x).replace(/[.,\s]/g, '').includes(q.replace(/[.,\s]/g, '')));
    if (visao() === 'pessoas') return renderPessoas(registros.filter(casa));
    let lista = registros.filter(casa).filter(r => {
      if (filtroPessoa && chavePessoa(r) !== filtroPessoa) return false;
      if (filtro === 'todos') return true;
      if (filtro === 'atrasado') return atrasado(r, dia);
      return r.status === filtro;
    });
    const proximo = r => { if (!emAberto(r) && r.status !== 'aguardando') return Infinity; const s = situacaoDe(r, dia); return s.proxima ? s.proxima.dia : r.dp; };
    const ordem = $('#ordem').value;
    const cmp = {
      recentes: (a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0),
      vencimento: (a, b) => proximo(a) - proximo(b) || (b.atualizadoEm || 0) - (a.atualizadoEm || 0),
      valor: (a, b) => (a.moeda || 'BRL').localeCompare(b.moeda || 'BRL') || b.total - a.total,
      nome: (a, b) => nomePessoa(a).localeCompare(nomePessoa(b), locale())
    }[ordem] || ((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
    lista = lista.sort(cmp);
    const pf = filtroPessoa ? registros.find(r => chavePessoa(r) === filtroPessoa) : null;
    $('#pessoaFiltro').innerHTML = pf ? `<span class="pill-filtro">${ico('pessoa')}<span>${esc(nomePessoa(pf))}</span><button type="button" data-acao="tirar-pessoa" aria-label="${esc(t('reg.tirarPessoa'))}">×</button></span>` : '';
    if (!lista.length) { el.innerHTML = `<div class="vazio">${t(q ? 'reg.buscaVazia' : 'reg.filtroVazio')}</div>`; return; }
    el.innerHTML = lista.map(r => linhaRegistro(r, dia)).join('');
  }

  function renderPessoas(lista) {
    $('#pessoaFiltro').innerHTML = '';
    const grupos = new Map();
    for (const r of lista) {
      const k = chavePessoa(r);
      if (!grupos.has(k)) grupos.set(k, { k, regs: [] });
      grupos.get(k).regs.push(r);
    }
    const el = $('#lista');
    if (!grupos.size) { el.innerHTML = `<div class="vazio">${t('reg.buscaVazia')}</div>`; return; }
    const arr = [...grupos.values()].map(g => {
      const ult = g.regs.slice().sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0))[0];
      return { ...g, nome: nomePessoa(ult), id: ult.outroId, pub: ult.outroPub };
    }).sort((a, b) => a.nome.localeCompare(b.nome, locale()));
    el.innerHTML = arr.map(g => {
      const abertos = g.regs.filter(emAberto);
      const receber = abertos.filter(r => r.papel === 'credor'), pagar = abertos.filter(r => r.papel === 'devedor');
      const c = contatoDe(g.pub);
      const linhas = [];
      if (receber.length) linhas.push(`<span class="pessoa-soma rec"><small>${t('pes.receber')}</small>${somasPorMoeda(receber, saldoAberto)}</span>`);
      if (pagar.length) linhas.push(`<span class="pessoa-soma pag"><small>${t('pes.pagar')}</small>${somasPorMoeda(pagar, saldoAberto)}</span>`);
      return `<button class="reg pessoa" type="button" data-acao="pessoa" data-chave="${esc(g.k)}">
        <span class="reg-ico">${esc(inicial(g.nome))}</span>
        <span class="reg-main"><b>${esc(g.nome)}</b><small>${t('pes.n', { n: g.regs.length, abertos: abertos.length })}${g.id ? ' · ID ' + esc(g.id) : ''}${c ? ' · ' + t('pes.contato') : ''}</small></span>
        <span class="reg-side">${linhas.join('') || `<span class="chip quitado">${t('pes.nadaAberto')}</span>`}</span>
      </button>`;
    }).join('');
  }

  // next installments due (or already late), across all open loans
  function renderVencimentos() {
    const dia = hojeDia(), itens = [];
    for (const r of registros) {
      if (!emAberto(r)) continue;
      const s = situacaoDe(r, dia);
      for (const p of s.parcelas) if (p.restante > 0 && p.dia <= dia + 30) itens.push({ r, p });
    }
    itens.sort((a, b) => a.p.dia - b.p.dia);
    const el = $('#vencimentos');
    el.hidden = !itens.length;
    if (!itens.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<h3>${t('venc.titulo')}</h3><ul>` + itens.slice(0, 6).map(({ r, p }) => {
      const atras = p.dia < dia, hojeVence = p.dia === dia;
      const quando = atras ? t('venc.atrasado', { dias: fmt.dias(dia - p.dia) }) : hojeVence ? t('venc.hoje') : t('venc.em', { dias: fmt.dias(p.dia - dia) });
      return `<li><button type="button" class="venc ${atras ? 'atraso' : ''}" data-acao="abrir-reg" data-k="${esc(r.k)}">
        <span class="venc-dia"><b>${fmt.dataCurta(p.dia)}</b><small>${quando}</small></span>
        <span class="venc-main"><b>${esc(nomePessoa(r))}</b><small>${t(r.papel === 'credor' ? 'venc.receber' : 'venc.pagar')}${(r.parcelas || 1) > 1 ? ' · ' + t('venc.parcela', { n: p.n, de: r.parcelas }) : ''}</small></span>
        <b class="venc-valor">${dinheiro(p.restante, r)}</b></button></li>`;
    }).join('') + '</ul>';
  }

  function renderLembreteBackup() {
    const el = $('#lembreteBackup');
    const ultimo = +lerTexto(K.backupEm) || 0, adiado = +lerTexto(K.backupAdiado) || 0;
    const mudou = registros.some(r => (r.atualizadoEm || r.criadoEm || 0) > ultimo);
    const mostrar = perfil && registros.length > 0 && mudou && Date.now() - adiado > 3 * 864e5 && Date.now() - ultimo > 7 * 864e5;
    el.hidden = !mostrar;
    el.innerHTML = mostrar ? `<div class="alert aviso"><i>${ico('cadeado')}</i><div><b>${t(ultimo ? 'bk.lembreteT' : 'bk.lembreteNuncaT')}</b><p>${ultimo ? t('bk.lembrete', { data: fmt.data(Math.floor(ultimo / 864e5)) }) : t('bk.lembreteNunca')}</p>
      <div class="btns"><button class="btn btn-primary" type="button" data-acao="backup-agora">${t('bk.fazerAgora')}</button><button class="btn" type="button" data-acao="backup-depois">${t('bk.depois')}</button></div></div></div>` : '';
  }

  /* ---------------- profit by period ---------------- */
  const PERIODOS = ['mes', 'ano', 'tudo', 'datas'];
  const periodoMarcado = () => ($('input[name="periodo"]:checked') || {}).value || 'tudo';
  function intervalo() {
    const p = periodoMarcado();
    const h = new Date(), y = h.getFullYear(), mo = h.getMonth();
    if (p === 'mes') return [diaUTC(y, mo, 1), diaUTC(y, mo + 1, 0)];
    if (p === 'ano') return [diaUTC(y, 0, 1), diaUTC(y, 11, 31)];
    if (p === 'datas') return [diaDeISO($('#pe-de').value) ?? -Infinity, diaDeISO($('#pe-ate').value) ?? Infinity];
    return [-Infinity, Infinity];
  }
  // Profit actually received (creditor) or interest actually paid (debtor), day by day: each payment
  // carries its share of the interest (amount × interest / total); what pays late charges is all profit.
  // A settled loan counts whatever was still open as paid on the settlement day.
  function eventosLucro(r) {
    if (r.status === 'cancelado' || !r.total) return [];
    const lucroTotal = r.total - r.valor, ev = [];
    let principalPago = 0;
    for (const p of pagamentosDe(r).sort((a, b) => a.dia - b.dia)) {
      const parte = Math.min(p.valor, Math.max(0, r.total - principalPago));
      principalPago += parte;
      const l = parte * lucroTotal / r.total + (p.valor - parte);
      if (l > 0) ev.push({ dia: p.dia, lucro: l });
    }
    if (r.status === 'quitado') {
      const resto = Math.max(0, r.total - principalPago);
      if (resto > 0 && lucroTotal > 0) ev.push({ dia: diaQuitado(r), lucro: resto * lucroTotal / r.total });
    }
    return ev;
  }
  const lucroAReceber = r => {
    const s = situacaoDe(r);
    return (r.total ? s.principal * (r.total - r.valor) / r.total : 0) + Math.max(0, s.encargos - s.encargosPagos);
  };
  function renderLucro() {
    $('#lucroDatas').hidden = periodoMarcado() !== 'datas';
    const [ini, fim] = intervalo(), dentro = d => d >= ini && d <= fim;
    const recebidoEm = r => eventosLucro(r).filter(e => dentro(e.dia)).reduce((s, e) => s + e.lucro, 0);
    const comLucro = papel => registros.filter(r => r.papel === papel && eventosLucro(r).some(e => dentro(e.dia)));
    const abertos = papel => registros.filter(r => r.papel === papel && emAberto(r) && dentro(r.dp));
    const card = (cls, rotulo, lista, valor, nota) =>
      `<div class="stat ${cls}"><span>${t(rotulo)}</span>${somasPorMoeda(lista, valor)}<small>${t(nota, { n: lista.length })}</small></div>`;
    let html = card('s-2', 'lucro.recebido', comLucro('credor'), recebidoEm, 'lucro.nRecebidos') + card('s-1', 'lucro.aReceber', abertos('credor'), lucroAReceber, 'lucro.nAbertos');
    if (registros.some(r => r.papel === 'devedor' && r.status !== 'cancelado' && r.status !== 'aguardando')) {
      html += card('s-3', 'lucro.jurosPagos', comLucro('devedor'), recebidoEm, 'lucro.nRecebidos') + card('s-4', 'lucro.jurosAPagar', abertos('devedor'), lucroAReceber, 'lucro.nAbertos');
    }
    $('#lucroCards').innerHTML = html;
    renderGrafico();
  }
  {
    const salvo = lerTexto(K.periodo);
    if (PERIODOS.includes(salvo)) $('#pe-' + salvo).checked = true;
    const h = new Date();
    $('#pe-de').value = isoLocal(new Date(h.getFullYear(), h.getMonth(), 1));
    $('#pe-ate').value = isoLocal(h);
    ['#pe-de', '#pe-ate'].forEach(id => $(id).addEventListener('change', renderLucro));
  }

  /* ---------------- monthly profit chart (last 12 months, one currency) ---------------- */
  function dadosGrafico() {
    const h = new Date(), meses = [];
    for (let i = 11; i >= 0; i--) {
      const x = new Date(h.getFullYear(), h.getMonth() - i, 1), y = x.getFullYear(), m = x.getMonth();
      meses.push({ y, m, ini: diaUTC(y, m, 1), fim: diaUTC(y, m + 1, 0), v: 0 });
    }
    const chaveMoeda = r => (r.moeda || 'BRL') + '|' + (r.casas == null ? 2 : r.casas);
    const credor = registros.filter(r => r.papel === 'credor');
    const moedas = [...new Set(credor.map(chaveMoeda))];
    let escolhida = lerTexto(K.grafico);
    if (!moedas.includes(escolhida)) {
      // the currency with the most profit received
      const soma = k => credor.filter(r => chaveMoeda(r) === k).reduce((s, r) => s + eventosLucro(r).reduce((a, e) => a + e.lucro, 0), 0);
      escolhida = moedas.sort((a, b) => soma(b) - soma(a))[0] || null;
    }
    if (escolhida) {
      for (const r of credor) {
        if (chaveMoeda(r) !== escolhida) continue;
        for (const e of eventosLucro(r)) { const mes = meses.find(x => e.dia >= x.ini && e.dia <= x.fim); if (mes) mes.v += e.lucro; }
      }
    }
    meses.forEach(x => { x.v = Math.round(x.v); });
    return { meses, moedas, escolhida };
  }
  function renderGrafico() {
    const caixa = $('#grafico');
    if (!caixa) return;
    const { meses, moedas, escolhida } = dadosGrafico();
    if (!escolhida || meses.every(x => x.v === 0)) { caixa.hidden = true; caixa.innerHTML = ''; return; }
    caixa.hidden = false;
    const [cod, casas] = escolhida.split('|'), info = D.infoMoeda(cod, +casas);
    const max = Math.max(...meses.map(x => x.v));
    const W = 340, H = 150, base = 120, topo = 18, passo = W / 12, larg = Math.min(18, passo - 6);
    const nomeMes = x => new Intl.DateTimeFormat(locale(), { month: 'short' }).format(new Date(x.y, x.m, 15)).replace('.', '');
    const nomeMesLongo = x => new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(x.y, x.m, 15));
    const iMax = meses.findIndex(x => x.v === max);
    let barras = '', rotulos = '';
    meses.forEach((x, i) => {
      const cx = passo * i + passo / 2, alt = x.v ? Math.max(2, (base - topo) * x.v / max) : 0, y = base - alt;
      const r = Math.min(4, alt, larg / 2);
      const d = alt ? `M${cx - larg / 2} ${base}V${y + r}Q${cx - larg / 2} ${y} ${cx - larg / 2 + r} ${y}H${cx + larg / 2 - r}Q${cx + larg / 2} ${y} ${cx + larg / 2} ${y + r}V${base}Z` : '';
      const txt = `${nomeMesLongo(x)}: ${fmt.dinheiro(x.v, info)}`;
      barras += `<g class="barra" tabindex="0" role="img" aria-label="${esc(txt)}" data-dica="${esc(txt)}"><rect class="alvo" x="${passo * i}" y="${topo - 10}" width="${passo}" height="${base - topo + 10}"/>${d ? `<path d="${d}"/>` : ''}</g>`;
      rotulos += `<text x="${cx}" y="${base + 16}" text-anchor="middle">${esc(nomeMes(x))}</text>`;
      if (i === iMax && x.v) rotulos += `<text class="valor" x="${Math.min(W - 4, Math.max(4, cx))}" y="${y - 6}" text-anchor="${i > 9 ? 'end' : i < 2 ? 'start' : 'middle'}">${esc(fmt.dinheiro(x.v, info))}</text>`;
    });
    const seletor = moedas.length > 1
      ? `<label class="sr-only" for="graficoMoeda">${t('graf.moeda')}</label><select id="graficoMoeda">${moedas.map(k => { const [c] = k.split('|'); return `<option value="${esc(k)}"${k === escolhida ? ' selected' : ''}>${esc(c)}</option>`; }).join('')}</select>`
      : `<span class="graf-moeda">${esc(cod)}</span>`;
    caixa.innerHTML = `<div class="graf-topo"><h4 id="t-graf">${t('graf.titulo')}</h4>${seletor}</div>
      <div class="graf-area"><svg viewBox="0 0 ${W} ${H}" role="group" aria-labelledby="t-graf" preserveAspectRatio="none"><line class="eixo" x1="0" y1="${base}" x2="${W}" y2="${base}"/>${barras}${rotulos}</svg><div class="graf-dica" id="grafDica" hidden></div></div>
      <button class="btn btn-ghost" type="button" data-acao="ver-tabela" aria-expanded="false" aria-controls="graficoTabela">${t('graf.tabela')}</button>
      <table class="graf-tabela" id="graficoTabela" hidden><thead><tr><th scope="col">${t('graf.mes')}</th><th scope="col">${t('graf.lucro')}</th></tr></thead><tbody>${meses.map(x => `<tr><td>${esc(nomeMesLongo(x))}</td><td>${esc(fmt.dinheiro(x.v, info))}</td></tr>`).join('')}</tbody></table>`;
    const sel = $('#graficoMoeda');
    if (sel) sel.addEventListener('change', () => { gravarTexto(K.grafico, sel.value); renderGrafico(); });
    const dica = $('#grafDica'), area = caixa.querySelector('.graf-area');
    const mostrarDica = g => {
      dica.textContent = g.dataset.dica; dica.hidden = false;
      const a = area.getBoundingClientRect(), b = g.getBoundingClientRect();
      dica.style.left = Math.max(0, Math.min(a.width - dica.offsetWidth, b.left - a.left + b.width / 2 - dica.offsetWidth / 2)) + 'px';
      $$('.barra', caixa).forEach(x => x.classList.toggle('on', x === g));
    };
    const esconder = () => { dica.hidden = true; $$('.barra', caixa).forEach(x => x.classList.remove('on')); };
    $$('.barra', caixa).forEach(g => {
      g.addEventListener('pointerenter', () => mostrarDica(g));
      g.addEventListener('focus', () => mostrarDica(g));
      g.addEventListener('pointerleave', esconder);
      g.addEventListener('blur', esconder);
    });
  }

  /* ---------------- export: spreadsheet (CSV) and printed report ---------------- */
  const estadoTexto = r => t('rotulo.' + (atrasado(r, hojeDia()) ? 'vencido' : r.status));
  function exportarCSV() {
    if (!registros.length) return toast(t('toast.nadaExportar'));
    // where the decimal mark is a comma, spreadsheets expect ";" between columns
    const decimal = fmt.sepDecimal(), sep = decimal === ',' ? ';' : ',';
    const num = (v, casas) => (v / 10 ** casas).toFixed(casas).replace('.', decimal);
    // a cell that starts with = + - @ could run as a formula in a spreadsheet: it gets a leading quote
    const cel = v => {
      let s = String(v == null ? '' : v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return /["\n\r;,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const cab = ['ref', 'papel', 'pessoa', 'idPessoa', 'situacao', 'moeda', 'valor', 'total', 'pago', 'saldo', 'encargos', 'de', 'dp', 'parcelas', 'obs', 'registrado', 'codigo'].map(k => t('csv.' + k));
    const linhas = [cab.map(cel).join(sep)];
    for (const r of registros.slice().sort((a, b) => a.de - b.de)) {
      const casas = r.casas == null ? 2 : r.casas, s = situacaoDe(r);
      const saldo = emAberto(r) ? s.saldo : 0;
      linhas.push([
        r.id ? `${r.id.slice(0, 4)}-${r.id.slice(4, 8)}` : '', t(r.papel === 'credor' ? 'csv.credor' : 'csv.devedor'), nomePessoa(r), r.outroId || '',
        estadoTexto(r), r.moeda || 'BRL', num(r.valor, casas), num(r.total, casas), num(s.pago, casas), num(saldo, casas), num(s.encargos, casas),
        isoDeDia(r.de), isoDeDia(r.dp), r.parcelas || 1, r.obs || '', r.criadoEm ? new Date(r.criadoEm).toISOString().slice(0, 10) : '', r.codigo
      ].map(cel).join(sep));
    }
    salvarArquivo(t('csv.arquivo', { data: isoDeDia(hojeDia()) }), 'text/csv;charset=utf-8', '﻿' + linhas.join('\r\n') + '\r\n');
  }
  function relatorioPDF() {
    const [ini, fim] = intervalo(), dentro = d => d >= ini && d <= fim;
    const ativos = registros.filter(r => dentro(r.de) || dentro(r.dp) || recibosDe(r).some(x => dentro(x.dia)) || (r.status === 'quitado' && dentro(diaQuitado(r))))
      .sort((a, b) => a.de - b.de);
    const rotuloPeriodo = $('input[name="periodo"]:checked + label');
    const nomePeriodo = rotuloPeriodo ? rotuloPeriodo.textContent : '';
    const faixa = Number.isFinite(ini) ? ` (${fmt.data(ini)} – ${fmt.data(Number.isFinite(fim) ? fim : hojeDia())})` : '';
    const linhas = ativos.map(r => {
      const s = situacaoDe(r);
      return `<tr><td>${fmt.data(r.de)}</td><td>${esc(nomePessoa(r))}</td><td>${t(r.papel === 'credor' ? 'csv.credor' : 'csv.devedor')}</td><td class="num">${dinheiro(r.valor, r)}</td><td class="num">${dinheiro(r.total, r)}</td><td class="num">${dinheiro(s.pago, r)}</td><td class="num">${dinheiro(emAberto(r) ? s.saldo : 0, r)}</td><td>${fmt.data(r.dp)}</td><td>${esc(estadoTexto(r))}</td></tr>`;
    }).join('');
    const gerado = momentoDe(new Date());
    $('#relatorio').innerHTML = `<header class="rel-topo"><b>DebtID</b><span>${t('rel.titulo')}</span></header>
      <p class="rel-meta">${t('rel.meta', { periodo: esc(nomePeriodo), faixa, nome: esc(perfil.nome), id: esc(perfil.id), gerado: fmt.momento(gerado.ts, gerado.tz) })}</p>
      <div class="summary">${$('#lucroCards').innerHTML}</div>
      <h3>${t('rel.registros', { n: ativos.length })}</h3>
      ${ativos.length ? `<table class="rel-tabela"><thead><tr><th>${t('csv.de')}</th><th>${t('csv.pessoa')}</th><th>${t('csv.papel')}</th><th>${t('csv.valor')}</th><th>${t('csv.total')}</th><th>${t('csv.pago')}</th><th>${t('csv.saldo')}</th><th>${t('csv.dp')}</th><th>${t('csv.situacao')}</th></tr></thead><tbody>${linhas}</tbody></table>` : `<p>${t('rel.vazio')}</p>`}
      <p class="rel-nota">${t('rel.nota')}</p>`;
    imprimirComo(t('rel.arquivo', { data: isoDeDia(hojeDia()) }), true);
  }

  /* ---------------- settings ---------------- */
  function renderAjustes() {
    if (!perfil) return;
    $('#perfilNome').textContent = perfil.nome;
    $('#perfilId').textContent = perfil.id;
    D.idLongoDe(D._interno.deB64url(perfil.pub)).then(x => { $('#perfilIdLongo').textContent = x; });
    $('#avatar').textContent = inicial(perfil.nome);
    $('#f-nome-ajuste').value = perfil.nome;
    $$('input[name="ui"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    $$('input[name="tema"]').forEach(i => { i.checked = i.value === temaPref(); });
    $$('input[name="idioma"]').forEach(i => { i.checked = i.value === DebtIDIdioma.atual(); });
    $$('input[name="texto"]').forEach(i => { i.checked = i.value === (raiz.dataset.texto || 'normal'); });
    pintarBotaoMoeda($('#btnMoedaPadrao'), moedaPadrao());
    renderTravaAjustes();
    renderIcones();
    renderLembretesAjustes();
    renderContatos();
    const ultimo = +lerTexto(K.backupEm) || 0;
    $('#ultimoBackup').textContent = ultimo ? t('bk.ultimo', { data: fmt.data(Math.floor(ultimo / 864e5)) }) : t('bk.nunca');
  }
  $('#formNome').addEventListener('submit', e => {
    e.preventDefault();
    const nome = limparNome($('#f-nome-ajuste').value);
    if (nome.length < 2) return toast(t('toast.digiteNome'));
    perfil = { ...perfil, nome: nome.slice(0, 80) };
    guardarPerfil(); renderAjustes(); toast(t('toast.nomeAtualizado'));
  });
  const mostrar = (id, sim) => { $(id).hidden = !sim; };

  // lock settings
  function renderTravaAjustes() {
    const el = $('#travaAjustes');
    if (!trava) {
      const cofreEstado = estadoCofre();
      let celular = '';
      if (cofreEstado !== 'indisponivel') {
        celular = `<button class="btn" type="button" data-acao="trava-celular"${cofreEstado === 'ok' ? '' : ' disabled'}>${ico('digital')}${t('trava.usarCelular')}</button>`;
      }
      const semBloqueio = cofreEstado === 'sem-bloqueio' ? `<p class="hint">${t('trava.semBloqueio')}</p>` : '';
      el.innerHTML = `<p class="hint">${t('trava.desligada')}</p><div class="btns"><button class="btn btn-alt" type="button" data-acao="trava-criar">${ico('cadeado')}${t('trava.criar')}</button>${celular}</div>${semBloqueio}`;
      return;
    }
    const tempo = tempoTrava(), celular = modoCelular();
    el.innerHTML = `<p class="hint">${t(celular ? 'trava.ligadaCelular' : 'trava.ligada')}</p>
      <div class="ajuste"><h4 id="t-trava-tempo">${t('trava.tempo')}</h4>
        <div class="seg" role="radiogroup" aria-labelledby="t-trava-tempo">
          ${[0, 60, 300].map(s => `<input type="radio" name="travaTempo" id="tt-${s}" value="${s}"${tempo === s ? ' checked' : ''}><label for="tt-${s}">${t('trava.tempo' + s)}</label>`).join('')}
        </div></div>
      <div class="btns">${celular ? '' : `<button class="btn" type="button" data-acao="trava-trocar">${t('trava.trocar')}</button>`}<button class="btn btn-ghost" type="button" data-acao="trava-remover">${t('trava.remover')}</button></div>`;
  }
  async function novoPin() {
    const p1 = await perguntar({ titulo: t('trava.novoT'), texto: t('trava.novo'), ok: t('modal.continuar'), campo: { rotulo: t('trava.pin'), max: 12, senha: true } });
    if (!p1) return null;
    if (!/^\d{4,12}$/.test(p1.texto)) { toast(t('trava.pinInvalido')); return null; }
    if (/^(\d)\1+$/.test(p1.texto) || '0123456789012'.includes(p1.texto) || '9876543210987'.includes(p1.texto)) { toast(t('trava.pinFraco')); return null; }
    const p2 = await perguntar({ titulo: t('trava.repetirT'), texto: t('trava.repetir'), ok: t('modal.confirmar'), campo: { rotulo: t('trava.pin'), max: 12, senha: true } });
    if (!p2) return null;
    if (p2.texto !== p1.texto) { toast(t('trava.pinDif')); return null; }
    return p1.texto;
  }
  async function acaoTrava(acao) {
    if (acao === 'trava-criar') {
      const pin = await novoPin();
      if (!pin) return;
      await ligarTravaPin(pin);
      zerarErrosTrava(); renderTravaAjustes(); toast(t('trava.criada'));
    } else if (acao === 'trava-celular') {
      if (estadoCofre() !== 'ok') return;
      const ok = await perguntar({ titulo: t('trava.celularT'), texto: t('trava.celular'), ok: t('trava.celularOk') });
      if (!ok) return;
      const chave = chaveDados || D.chaveTrava.novaChaveDados();
      const r = await cofre('cofreGuardar', b64Padrao(chave));
      if (r.r === 'cancelado') return;
      let caixa = null; // { iv, ct } from the Keystore
      if (r.r === 'ok') {
        try { caixa = JSON.parse(r.dados); } catch { /* not JSON */ }
      }
      if (!caixa || !caixa.iv || !caixa.ct) { toastErro(new D.ChaveErro('GENERICO')); return; }
      trava = { v: 2, modo: 'celular', celular: { iv: caixa.iv, ct: caixa.ct }, tempo: 60 };
      chaveDados = chave;
      gravarJSON(K.trava, trava);
      await guardarPerfil();
      zerarErrosTrava(); renderTravaAjustes(); toast(t('trava.criada'));
    } else if (acao === 'trava-trocar') {
      if (!(await pedirPin(t('trava.pedirTrocar')))) return;
      const pin = await novoPin();
      if (!pin) return;
      await ligarTravaPin(pin, tempoTrava()); // the same data key, wrapped with the new PIN
      renderTravaAjustes(); toast(t('trava.trocada'));
    } else if (acao === 'trava-remover') {
      if (!(await pedirPin(t('trava.pedirRemover')))) return;
      const eraCelular = modoCelular();
      trava = null; gravarTexto(K.trava, null); gravarTexto(K.travaErros, null);
      await guardarPerfil(); // stored without encryption again
      chaveDados = null;
      if (eraCelular) apagarCofre();
      renderTravaAjustes(); toast(t('trava.removida'));
    }
  }

  // contacts settings
  function renderContatos() {
    const el = $('#listaContatos');
    if (!contatos.length) { el.innerHTML = `<p class="hint">${t('contatos.vazio')}</p>`; return; }
    el.innerHTML = '<ul class="contatos">' + contatos.slice().sort((a, b) => nomeContato(a).localeCompare(nomeContato(b), locale())).map(c => `<li>
      <span class="avatar">${esc(inicial(nomeContato(c)))}</span>
      <span class="ct-main"><b>${esc(nomeContato(c))}</b>${c.apelido ? `<small>${esc(c.nome)}</small>` : ''}<code>${esc(c.idLongo || c.id)}</code></span>
      <span class="ct-acoes"><button class="btn btn-ghost" type="button" data-acao="contato-renomear" data-pub="${esc(c.pub)}">${t('contatos.renomear')}</button><button class="btn btn-ghost" type="button" data-acao="contato-remover" data-pub="${esc(c.pub)}">${t('contatos.remover')}</button></span>
    </li>`).join('') + '</ul>';
  }
  async function acaoContato(acao, pub) {
    const c = contatoDe(pub);
    if (!c) return;
    if (acao === 'contato-renomear') {
      const r = await perguntar({ titulo: t('contatos.renomearT'), texto: t('contatos.renomearTexto', { nome: c.nome }), ok: t('modal.salvar'), campo: { rotulo: t('contatos.apelido'), padrao: c.apelido || c.nome, max: 80 } });
      if (!r) return;
      c.apelido = r.texto && r.texto !== c.nome ? r.texto.slice(0, 80) : null;
    } else {
      const ok = await perguntar({ titulo: t('contatos.removerT'), texto: t('contatos.removerTexto', { nome: nomeContato(c) }), ok: t('contatos.remover'), perigo: true });
      if (!ok) return;
      contatos = contatos.filter(x => x.pub !== pub);
    }
    salvarContatos(); renderContatos();
  }

  /* ---------------- app icon (Android app): logo A is the default, C is the alternative ---------------- */
  /*<icones>*/
  const ICONES = [
    { k: 'a', forma: 'A', cor: 'padrao', fundo: '#0E0E0E', tinta: '#FFFFFF', ponto: '#9DBF3E' },
    { k: 'a-claro', forma: 'A', cor: 'claro', fundo: '#FFFFFF', tinta: '#111111', ponto: '#7FA22A' },
    { k: 'a-amarelo', forma: 'A', cor: 'amarelo', fundo: '#F8CB47', tinta: '#1C1B1F', ponto: '#EC4C86' },
    { k: 'a-limao', forma: 'A', cor: 'limao', fundo: '#DFF45C', tinta: '#1C1B1F', ponto: '#A35CF0' },
    { k: 'a-rosa', forma: 'A', cor: 'rosa', fundo: '#EC4C86', tinta: '#FFFFFF', ponto: '#F8CB47' },
    { k: 'a-pastel', forma: 'A', cor: 'pastel', fundo: '#FFD9DC', tinta: '#1C1B1F', ponto: '#1E9E8C' },
    { k: 'a-lilas', forma: 'A', cor: 'lilas', fundo: '#8F9CF3', tinta: '#1C1B1F', ponto: '#FFFFFF' },
    { k: 'a-roxo', forma: 'A', cor: 'roxo', fundo: '#A35CF0', tinta: '#FFFFFF', ponto: '#DFF45C' },
    { k: 'a-verdeAgua', forma: 'A', cor: 'verdeAgua', fundo: '#1E9E8C', tinta: '#FFFFFF', ponto: '#F8CB47' },
    { k: 'a-floresta', forma: 'A', cor: 'floresta', fundo: '#1F4D3A', tinta: '#F1EBDD', ponto: '#D9A441' },
    { k: 'a-ceu', forma: 'A', cor: 'ceu', fundo: '#BFE6FF', tinta: '#0B2A4A', ponto: '#FF5C1F' },
    { k: 'a-azul', forma: 'A', cor: 'azul', fundo: '#1F4FD8', tinta: '#FFFFFF', ponto: '#7FE0FF' },
    { k: 'a-meiaNoite', forma: 'A', cor: 'meiaNoite', fundo: '#121A33', tinta: '#E6ECFF', ponto: '#FF6FAE' },
    { k: 'a-laranja', forma: 'A', cor: 'laranja', fundo: '#FF5C1F', tinta: '#FFFFFF', ponto: '#1C1B1F' },
    { k: 'a-ambar', forma: 'A', cor: 'ambar', fundo: '#F7931A', tinta: '#FFFFFF', ponto: '#1C1B1F' },
    { k: 'a-vinho', forma: 'A', cor: 'vinho', fundo: '#6B1E3A', tinta: '#F7E6D7', ponto: '#F2B24C' },
    { k: 'a-areia', forma: 'A', cor: 'areia', fundo: '#EFE4D2', tinta: '#3B2F2A', ponto: '#C8553D' },
    { k: 'a-neon', forma: 'A', cor: 'neon', fundo: '#000000', tinta: '#39FF14', ponto: '#FF2BD6' },
    { k: 'c', forma: 'C', cor: 'padrao', fundo: '#0E0E0E', tinta: '#FFFFFF' },
    { k: 'c-claro', forma: 'C', cor: 'claro', fundo: '#FFFFFF', tinta: '#111111' },
    { k: 'c-limao', forma: 'C', cor: 'limao', fundo: '#DFF45C', tinta: '#1C1B1F' },
    { k: 'c-amarelo', forma: 'C', cor: 'amarelo', fundo: '#F8CB47', tinta: '#1C1B1F' },
    { k: 'c-rosa', forma: 'C', cor: 'rosa', fundo: '#EC4C86', tinta: '#FFFFFF' },
    { k: 'c-pastel', forma: 'C', cor: 'pastel', fundo: '#FFD9DC', tinta: '#C8553D' },
    { k: 'c-lilas', forma: 'C', cor: 'lilas', fundo: '#8F9CF3', tinta: '#1C1B1F' },
    { k: 'c-roxo', forma: 'C', cor: 'roxo', fundo: '#A35CF0', tinta: '#FFFFFF' },
    { k: 'c-verdeAgua', forma: 'C', cor: 'verdeAgua', fundo: '#1E9E8C', tinta: '#FFFFFF' },
    { k: 'c-floresta', forma: 'C', cor: 'floresta', fundo: '#1F4D3A', tinta: '#D9A441' },
    { k: 'c-ceu', forma: 'C', cor: 'ceu', fundo: '#BFE6FF', tinta: '#0B2A4A' },
    { k: 'c-azul', forma: 'C', cor: 'azul', fundo: '#1F4FD8', tinta: '#FFFFFF' },
    { k: 'c-meiaNoite', forma: 'C', cor: 'meiaNoite', fundo: '#121A33', tinta: '#FF6FAE' },
    { k: 'c-laranja', forma: 'C', cor: 'laranja', fundo: '#FF5C1F', tinta: '#FFFFFF' },
    { k: 'c-ambar', forma: 'C', cor: 'ambar', fundo: '#F7931A', tinta: '#1C1B1F' },
    { k: 'c-vinho', forma: 'C', cor: 'vinho', fundo: '#6B1E3A', tinta: '#F2B24C' },
    { k: 'c-areia', forma: 'C', cor: 'areia', fundo: '#EFE4D2', tinta: '#3B2F2A' },
    { k: 'c-neon', forma: 'C', cor: 'neon', fundo: '#000000', tinta: '#39FF14' }
  ];
  /*</icones>*/
  const svgIcone = i => `<svg viewBox="0 0 256 256" aria-hidden="true"><rect width="256" height="256" fill="${i.fundo}"/><g transform="translate(19.2 19.2) scale(.85)">${i.forma === 'A'
    ? `<rect x="64" y="52" width="36" height="152" rx="6" fill="${i.tinta}"/><path d="M116 52A76 76 0 0 1 116 204V168A40 40 0 0 0 116 88Z" fill="${i.tinta}"/><circle cx="133" cy="128" r="13" fill="${i.ponto}"/>`
    : `<path fill="${i.tinta}" fill-rule="evenodd" d="M82 76H166A52 52 0 0 1 166 180H82L38 136V120ZM66 128A14 14 0 1 0 94 128A14 14 0 1 0 66 128Z"/>`}</g></svg>`;
  function renderIcones() {
    const a = app(), pode = !!(a && a.trocarIcone);
    $('#ajusteIcone').hidden = !pode;
    if (!pode) return;
    let atualIcone = 'a';
    try { atualIcone = a.icone ? a.icone() : 'a'; } catch { atualIcone = 'a'; }
    const grupo = forma => {
      const titulo = t(forma === 'A' ? 'icone.logoA' : 'icone.logoC');
      return `<h4>${titulo}</h4><div class="icones" role="radiogroup" aria-label="${esc(titulo)}">` +
        ICONES.filter(i => i.forma === forma).map(i =>
          `<label class="icone-op"><input type="radio" name="icone" value="${i.k}"${i.k === atualIcone ? ' checked' : ''}>${svgIcone(i)}<span>${t('cor.' + i.cor)}</span></label>`).join('') + '</div>';
    };
    $('#icones').innerHTML = grupo('A') + grupo('C');
  }
  function trocarIcone(k) {
    const a = app();
    let ok = false;
    try { ok = !!(a && a.trocarIcone && a.trocarIcone(k)); } catch { ok = false; }
    toast(t(ok ? 'icone.trocado' : 'icone.erro'));
    if (!ok) renderIcones();
  }

  /* ---------------- due-date reminders (Android app) ---------------- */
  const cfgLembretes = () => { const c = lerJSON(K.lembretes, null); return { ligado: !!(c && c.ligado), dias: c && [1, 3, 7].includes(c.dias) ? c.dias : 3 }; };
  const podeLembrar = () => { const a = app(); return !!(a && a.lembretes); };
  function renderLembretesAjustes() {
    const el = $('#lembretesAjustes'), sec = $('#secLembretes');
    sec.hidden = !podeLembrar();
    if (!podeLembrar()) return;
    const c = cfgLembretes();
    el.innerHTML = `<label class="check"><input type="checkbox" id="lembretesCheck"${c.ligado ? ' checked' : ''}><span>${t('lemb.ligar')}</span></label>
      <div class="ajuste" ${c.ligado ? '' : 'hidden'}><h4 id="t-lemb-dias">${t('lemb.antes')}</h4>
        <div class="seg" role="radiogroup" aria-labelledby="t-lemb-dias">
          ${[1, 3, 7].map(d => `<input type="radio" name="lembreteDias" id="ld-${d}" value="${d}"${c.dias === d ? ' checked' : ''}><label for="ld-${d}">${fmt.dias(d)}</label>`).join('')}
        </div></div>`;
    $('#lembretesCheck').addEventListener('change', e => ligarLembretes(e.target.checked));
  }
  function ligarLembretes(ligar) {
    const a = app();
    const salvar = ok => { gravarJSON(K.lembretes, { ...cfgLembretes(), ligado: ok }); agendarLembretes(); renderLembretesAjustes(); if (ligar) toast(t(ok ? 'lemb.ligados' : 'lemb.negados')); };
    if (!ligar || !a) return salvar(false);
    let estado = 'ok';
    try { estado = a.notificacoes ? a.notificacoes() : 'ok'; } catch { estado = 'ok'; }
    if (estado === 'ok') return salvar(true);
    window.__debtidNotif = ok => { window.__debtidNotif = null; salvar(!!ok); };
    try { a.pedirNotificacoes(); } catch { window.__debtidNotif = null; salvar(false); }
  }
  // Sends the next reminders to the app, which shows them as notifications even when it is closed.
  function agendarLembretes() {
    const a = app();
    if (!a || !a.lembretes) return;
    const c = cfgLembretes(), lista = [];
    if (c.ligado && perfil) {
      const agora = Date.now();
      for (const r of registros) {
        if (!emAberto(r)) continue;
        const s = situacaoDe(r);
        for (const p of s.parcelas) {
          if (p.restante <= 0) continue;
          for (const antes of [c.dias, 0]) {
            const x = new Date((p.dia - antes) * 864e5);
            const quando = new Date(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 9, 0, 0).getTime();
            if (quando <= agora) continue;
            const valor = dinheiro(p.restante, r), nome = nomePessoa(r);
            lista.push({
              id: `${r.k}:${p.n}:${antes}`, quando,
              titulo: antes ? t('lemb.tituloAntes', { dias: fmt.dias(antes) }) : t('lemb.tituloHoje'),
              texto: t(r.papel === 'credor' ? 'lemb.receber' : 'lemb.pagar', { nome, valor }) + ((r.parcelas || 1) > 1 ? ' · ' + t('venc.parcela', { n: p.n, de: r.parcelas }) : '')
            });
          }
        }
      }
    }
    lista.sort((x, y) => x.quando - y.quando);
    const pacote = { canal: t('lemb.canal'), publico: t('lemb.publico'), lista: lista.slice(0, 60) };
    try { a.lembretes(JSON.stringify(pacote)); } catch { /* ignore */ }
  }

  /* ---------------- backup ---------------- */
  $('#btnBackup').addEventListener('click', async () => {
    const abrir = $('#formBackup').hidden;
    if (abrir && !(await pedirPin(t('trava.pedirBackup')))) return;
    mostrar('#formBackup', abrir); mostrar('#formRestaurar', false); mostrar('#saidaBackup', false); $('#msgBackup').innerHTML = '';
    if (abrir) { $('#f-bk1').focus(); pintarForca(); }
  });
  $('#btnRestaurar').addEventListener('click', () => {
    const abrir = $('#formRestaurar').hidden;
    mostrar('#formRestaurar', abrir); mostrar('#formBackup', false); mostrar('#saidaBackup', false); $('#msgBackup').innerHTML = '';
    if (abrir) $('#f-rs-codigo').focus();
  });
  function pintarForca() {
    const f = D.forcaSenha($('#f-bk1').value), el = $('#forcaSenha');
    el.dataset.n = String(f);
    el.querySelector('span').textContent = t('bk.forca' + f);
  }
  $('#f-bk1').addEventListener('input', pintarForca);
  $('#formBackup').addEventListener('submit', async e => {
    e.preventDefault();
    const s1 = $('#f-bk1').value, s2 = $('#f-bk2').value;
    if (s1.length < 10) { $('#msgBackup').innerHTML = alertaHTML(t('bk.senhaCurtaT'), t('bk.senhaCurta')); return; }
    if (D.forcaSenha(s1) < 1) { $('#msgBackup').innerHTML = alertaHTML(t('bk.senhaFracaT'), t('bk.senhaFraca')); return; }
    if (s1 !== s2) { $('#msgBackup').innerHTML = alertaHTML(t('bk.difT'), t('bk.dif')); return; }
    if (!perfil || !perfil.jwk || !perfil.jwk.d) { $('#msgBackup').innerHTML = alertaErro(new D.ChaveErro('GENERICO')); return; } // locked: no key to save
    const btn = e.submitter || $('#formBackup button[type="submit"]'); btn.disabled = true;
    $('#msgBackup').innerHTML = `<p class="hint">${t('bk.gerando')}</p>`;
    try {
      const codigo = await D.exportarBackup({
        tipo: 'debtid-backup', v: 2, perfil, registros, contatos, ui: raiz.dataset.ui, tema: lerTexto(K.tema), moeda: lerTexto(K.moeda), idioma: lerTexto(K.idioma)
      }, s1);
      $('#codigoBackup').textContent = codigo;
      mostrar('#formBackup', false); mostrar('#saidaBackup', true); $('#msgBackup').innerHTML = '';
      $('#f-bk1').value = $('#f-bk2').value = '';
      gravarTexto(K.backupEm, String(Date.now()));
      renderAjustes();
    } catch (err) {
      $('#msgBackup').innerHTML = alertaErro(err);
    } finally { btn.disabled = false; }
  });
  const PESO = { aguardando: 0, registrado: 0, validado: 1, quitado: 2, cancelado: 3 };
  async function restaurar(codigo, senha, msgEl, btn) {
    if (btn) btn.disabled = true;
    msgEl.innerHTML = `<p class="hint">${t('bk.abrindo')}</p>`;
    try {
      const obj = await D.importarBackup(codigo, senha);
      if (!obj || obj.tipo !== 'debtid-backup' || !obj.perfil || !obj.perfil.jwk || !obj.perfil.id) throw new D.ChaveErro('BACKUP_FORMATO');
      msgEl.innerHTML = '';
      if (perfil && perfil.id !== obj.perfil.id) {
        const ok = await perguntar({ titulo: t('modal.trocarT'), texto: t('modal.trocar', { a: perfil.id, b: obj.perfil.id }), ok: t('modal.trocarOk') });
        if (!ok) return;
      }
      if (perfil && !(await pedirPin(t('trava.pedirRestaurar')))) return;
      perfil = { ...obj.perfil };
      await guardarPerfil();
      const entrada = Array.isArray(obj.registros) ? obj.registros.filter(r => r && r.codigo) : [];
      await migrarRegistros(entrada);
      for (const r of entrada) {
        const ja = registros.find(x => x.k === r.k);
        if (!ja) { registros.push(r); continue; }
        const rids = new Set(recibosDe(ja).map(x => x.rid));
        const recibos = [...recibosDe(ja), ...recibosDe(r).filter(x => !rids.has(x.rid))];
        if ((PESO[r.status] || 0) > (PESO[ja.status] || 0)) Object.assign(ja, r);
        ja.recibos = recibos;
      }
      for (const c of Array.isArray(obj.contatos) ? obj.contatos : []) {
        if (c && c.pub && !contatoDe(c.pub)) contatos.push(c);
      }
      salvarContatos();
      salvarRegistros();
      if (obj.ui) aplicarUI(obj.ui);
      if (obj.tema === 'dark' || obj.tema === 'light') { gravarTexto(K.tema, obj.tema); aplicarTema(); }
      if (obj.moeda && D.MOEDAS[obj.moeda]) { gravarTexto(K.moeda, obj.moeda); definirMoedaForm(obj.moeda); }
      gravarTexto(K.backupEm, String(Date.now()));
      toast(t('toast.backupRestaurado'));
      irPara('registros');
    } catch (err) {
      msgEl.innerHTML = alertaErro(err);
    } finally { if (btn) btn.disabled = false; }
  }
  $('#formRestaurar').addEventListener('submit', e => {
    e.preventDefault();
    restaurar($('#f-rs-codigo').value, $('#f-rs-senha').value, $('#msgBackup'), e.submitter);
  });
  function apagarTudo() {
    [K.perfil, K.regs, K.contatos, K.trava, K.travaErros, K.backupEm, K.backupAdiado].forEach(k => gravarTexto(k, null));
    perfil = null; registros = []; contatos = []; trava = null; atual = null; chaveDados = null;
    apagarCofre();
    agendarLembretesVazio();
  }
  const agendarLembretesVazio = () => { const a = app(); if (a && a.lembretes) { try { a.lembretes('[]'); } catch { /* ignore */ } } };
  $('#btnApagar').addEventListener('click', async () => {
    const ok = await perguntar({ titulo: t('modal.apagarT'), texto: t('modal.apagar'), ok: t('modal.apagarOk'), perigo: true });
    if (!ok) return;
    if (!(await pedirPin(t('trava.pedirApagar')))) return;
    apagarTudo();
    irPara('boas-vindas');
  });

  /* ---------------- onboarding ---------------- */
  function prepararBoasVindas() {
    $$('input[name="ui-bv"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    $$('input[name="idioma-bv"]').forEach(i => { i.checked = i.value === DebtIDIdioma.atual(); });
    passoBV('#bv0'); mostrar('#formRestaurarBV', false); $('#msgBV').innerHTML = '';
  }
  function passoBV(id) {
    ['#bv0', '#bv1', '#bv2'].forEach(x => mostrar(x, x === id));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  $('#bvIdioma').addEventListener('click', () => {
    aplicarIdioma(DebtIDIdioma.atual(), true);
    passoBV('#bv1');
  });
  $('#bvVoltarIdioma').addEventListener('click', () => passoBV('#bv0'));
  $('#bvContinuar').addEventListener('click', () => {
    aplicarUI(raiz.dataset.ui);
    passoBV('#bv2');
    setTimeout(() => $('#f-nome').focus(), 50);
  });
  $('#bvVoltar').addEventListener('click', () => passoBV('#bv1'));
  $('#bvTenhoBackup').addEventListener('click', () => {
    const abrir = $('#formRestaurarBV').hidden;
    mostrar('#formRestaurarBV', abrir);
    if (abrir) $('#f-bv-codigo').focus();
  });
  $('#formRestaurarBV').addEventListener('submit', e => {
    e.preventDefault();
    restaurar($('#f-bv-codigo').value, $('#f-bv-senha').value, $('#msgBV'), e.submitter);
  });
  $('#formPerfil').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = limparNome($('#f-nome').value);
    if (mostrarErros(nome.length < 2 ? { nome: t('erro.nome') } : {}, $('#formPerfil'))) return;
    const btn = $('#btnCriarPerfil'); btn.disabled = true;
    try {
      perfil = await D.criarPerfil(nome.slice(0, 80));
      if (!gravarJSON(K.perfil, perfil)) toast(t('toast.perfilNaoSalvo'));
      else toast(t('toast.perfilCriado'));
      irPara('inicio');
    } catch (err) {
      $('#msgBV').innerHTML = alertaErro(err);
    } finally { btn.disabled = false; }
  });

  /* ---------------- language ---------------- */
  // the language pickers (cards in the onboarding, a grid in Settings), from the list in i18n.js
  function pintarIdiomas() {
    $('#idiomasBV').innerHTML = DebtIDIdiomas.map(i => `<label class="ui-op idioma-op" lang="${i.tag}">
        <input type="radio" name="idioma-bv" value="${i.k}">
        <span class="lang-tag" aria-hidden="true">${i.k.toUpperCase()}</span>
        <b>${i.nome}</b>${i.nota ? `<small>${i.nota}</small>` : ''}
      </label>`).join('');
    $('#idiomasAjuste').innerHTML = DebtIDIdiomas.map(i =>
      `<input type="radio" name="idioma" id="id-${i.k}" value="${i.k}"><label for="id-${i.k}" lang="${i.tag}">${i.nome}</label>`).join('');
  }
  pintarIdiomas();
  function aplicarIdioma(l, salvar) {
    // amounts already typed are re-read in the old language and rewritten in the new one
    const v = D.lerNumero(campo('valor').value, true);
    const taxas = ['taxa', 'multa', 'mora'].map(n => [n, D.lerNumero(campo(n).value, false)]);
    const lang = DebtIDIdioma.aplicar(l);
    D.definirIdioma(lang);
    if (salvar) gravarTexto(K.idioma, lang);
    $$('input[name="idioma"],input[name="idioma-bv"]').forEach(i => { i.checked = i.value === lang; });
    if (v > 0) campo('valor').value = textoValor(v, moedaForm);
    for (const [n, x] of taxas) if (x >= 0 && campo(n).value.trim()) campo(n).value = fmt.numEntrada(Math.round(x * 10000) / 10000);
    $$('.field.invalid').forEach(f => limparErroCampo(f));
    ['#msgConf', '#msgBackup', '#msgBV'].forEach(id => { $(id).innerHTML = ''; });
    aplicarTema();
    pintarMoedas();
    pintarContatoForm();
    atualizaDicas();
    const v2 = location.hash.slice(1);
    if (v2 === 'registros') renderRegistros();
    if (v2 === 'ajustes') renderAjustes();
    if (v2 === 'detalhe' && atual) renderDetalhe();
    agendarLembretes();
  }

  /* ---------------- startup ---------------- */
  aplicarIdioma(DebtIDIdioma.atual(), false);
  aplicarUI(raiz.dataset.ui);
  aplicarTexto(lerTexto(K.texto));
  aplicarTema();
  verificarLeitor();
  if (trava && perfil) bloquear();
  migrarRegistros(registros).then(mudou => {
    if (mudou) gravarJSON(K.regs, registros);
    rota();
    agendarLembretes();
  });
})();
