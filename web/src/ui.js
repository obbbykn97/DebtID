/* =====================================================================
   DebtID — user interface (texts live in i18n.js, in Portuguese and English)
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
  const rs = s => s.replace('R$ ', '<i>R$</i>');
  const app = () => window.DebtIDApp || null; // Android app bridge (only exists inside the APK)

  /* ---------------- local storage ---------------- */
  const K = { perfil: 'debtid.perfil', regs: 'debtid.registros', ui: 'debtid.ui', tema: 'debtid.tema', idioma: 'debtid.idioma' };
  const lerJSON = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } };
  const gravarJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const lerTexto = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarTexto = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* no storage */ } };

  let perfil = lerJSON(K.perfil, null);
  if (perfil && (!perfil.jwk || !perfil.pub || !perfil.id)) perfil = null;
  let registros = lerJSON(K.regs, []);
  if (!Array.isArray(registros)) registros = [];
  const salvarRegistros = () => {
    if (!gravarJSON(K.regs, registros)) toast(t('toast.semSalvar'));
  };
  function upsert(r) {
    const i = registros.findIndex(x => x.id === r.id);
    if (i >= 0) registros[i] = { ...registros[i], ...r };
    else registros.push({ criadoEm: Date.now(), ...r });
    salvarRegistros();
    return registros.find(x => x.id === r.id);
  }
  const registroDe = (m, papel, status) => {
    const outro = papel === 'credor' ? m.devedor : m.credor;
    return { id: m.idHex, papel, status, codigo: m.codigo, outro: outro.nome, valor: m.dados.valor, total: m.calc.total, de: m.dados.de, dp: m.dados.dp, atualizadoEm: Date.now() };
  };
  const hojeDia = () => { const h = new Date(); return Math.round(Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()) / 86400000); };

  /* ---------------- look and theme ---------------- */
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
  }
  function aplicarUI(ui) {
    raiz.dataset.ui = ui === 'soft' ? 'soft' : 'pro';
    gravarTexto(K.ui, raiz.dataset.ui);
    $$('input[name="ui"],input[name="ui-bv"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    corDasBarras();
  }
  $('#temaBtn').addEventListener('click', () => {
    gravarTexto(K.tema, raiz.dataset.theme === 'dark' ? 'light' : 'dark');
    aplicarTema();
  });
  const aoMudarSistema = () => { if (temaPref() === 'sistema') aplicarTema(); };
  if (prefEscuro.addEventListener) prefEscuro.addEventListener('change', aoMudarSistema);
  else if (prefEscuro.addListener) prefEscuro.addListener(aoMudarSistema);
  document.addEventListener('change', e => {
    if (e.target.name === 'ui' || e.target.name === 'ui-bv') aplicarUI(e.target.value);
    if (e.target.name === 'tema') { gravarTexto(K.tema, e.target.value === 'sistema' ? null : e.target.value); aplicarTema(); }
    if (e.target.name === 'filtro') renderRegistros();
    if (e.target.name === 'idioma' || e.target.name === 'idioma-bv') aplicarIdioma(e.target.value, true);
  });

  /* ---------------- toasts and dialogs ---------------- */
  let timerToast;
  function toast(msg) {
    const x = $('#toast'); x.textContent = msg; x.classList.add('show');
    clearTimeout(timerToast); timerToast = setTimeout(() => x.classList.remove('show'), 2600);
  }
  function perguntar({ titulo, texto, ok = t('modal.confirmar'), perigo = false }) {
    return new Promise(res => {
      const m = $('#modal'), bOk = $('#modalOk'), bNao = $('#modalCancelar');
      $('#modalTitulo').textContent = titulo; $('#modalTexto').textContent = texto;
      bOk.textContent = ok; bOk.className = 'btn ' + (perigo ? 'btn-danger' : 'btn-primary');
      m.hidden = false; bOk.focus();
      const tecla = e => { if (e.key === 'Escape') fim(false); };
      const fim = v => { m.hidden = true; bOk.onclick = bNao.onclick = m.onclick = null; document.removeEventListener('keydown', tecla); res(v); };
      bOk.onclick = () => fim(true); bNao.onclick = () => fim(false);
      m.onclick = e => { if (e.target === m) fim(false); };
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

  /* ---------------- navigation ---------------- */
  const VIEWS = ['inicio', 'conferir', 'registros', 'ajustes', 'detalhe', 'boas-vindas'];
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
    if (v === 'inicio') $('#assinaComo').textContent = perfil ? perfil.nome : '—';
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
    if (location.hash !== '#inicio' && location.hash !== '') { irPara('inicio'); }
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
    const t = Date.UTC(y, mo - 1, d), x = new Date(t);
    if (x.getUTCMonth() !== mo - 1 || x.getUTCDate() !== d) return null;
    return Math.round(t / 86400000);
  };
  const isoLocal = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const hoje = new Date();
  campo('de').value = isoLocal(hoje);
  campo('dp').value = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 30));
  const marcado = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value;
  function atualizaDicas() {
    const composto = marcado('tipo') === 'compostos';
    const opTotal = $('#m-total');
    opTotal.disabled = composto; // compound interest needs a period (month or year)
    if (composto && opTotal.checked) $('#m-mes').checked = true;
    const modo = marcado('modo') || 'mes';
    $('#hintModo').textContent = t(`dica.${composto ? 'compostos' : 'simples'}.${modo}`);
    const credor = marcado('papel') !== 'devedor';
    $('#l-outro').textContent = t(credor ? 'form.outroDevedor' : 'form.outroCredor');
    const de = diaDeISO(campo('de').value), dp = diaDeISO(campo('dp').value);
    const caixa = $('#prazoAoVivo'), ok = de != null && dp != null && dp >= de;
    caixa.classList.toggle('off', !ok);
    caixa.lastElementChild.textContent = ok ? t('form.prazo', { x: fmt.dias(dp - de) }) : t('form.prazoVazio');
    // live total preview while typing
    const v = D.lerNumero(campo('valor').value, true), tx = D.lerNumero(campo('taxa').value, false);
    const valor = Math.round(v * 100), taxa = Math.round(tx * 10000);
    const previa = $('#totalAoVivo');
    const temPrevia = ok && valor >= 1 && valor <= D.LIMITES.valor && taxa >= 0 && taxa <= D.LIMITES.taxa && dp - de <= D.LIMITES.dias;
    previa.classList.toggle('off', !temPrevia);
    previa.lastElementChild.textContent = temPrevia
      ? t('form.totalPrevia', { x: fmt.brl(D.calcular({ valor, taxa, modo, composto, de, dp }).total) })
      : t('form.totalVazio');
  }
  form.addEventListener('change', atualizaDicas);
  form.addEventListener('input', e => {
    atualizaDicas();
    const f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) { f.classList.remove('invalid'); const er = f.querySelector('.err'); if (er) er.textContent = ''; }
  });
  atualizaDicas();
  campo('valor').addEventListener('blur', () => {
    const n = D.lerNumero(campo('valor').value, true);
    if (n > 0) campo('valor').value = fmt.num2(Math.round(n * 100) / 100);
  });
  campo('taxa').addEventListener('blur', () => {
    const n = D.lerNumero(campo('taxa').value, false);
    if (n >= 0) campo('taxa').value = fmt.num(Math.round(n * 10000) / 10000);
  });
  const limparNome = s => String(s).normalize('NFC').replace(/\s+/g, ' ').trim();

  function lerFormulario() {
    const erros = {};
    const outro = limparNome(campo('outro').value);
    if (!outro) erros.outro = t(marcado('papel') === 'devedor' ? 'erro.outroCredor' : 'erro.outroDevedor');
    else if (outro.length > 80) erros.outro = t('erro.max80');
    const v = D.lerNumero(campo('valor').value, true), valor = Math.round(v * 100);
    if (!campo('valor').value.trim()) erros.valor = t('erro.valorVazio');
    else if (!Number.isFinite(v)) erros.valor = t('erro.valorInvalido');
    else if (valor < 1) erros.valor = t('erro.valorZero');
    else if (valor > D.LIMITES.valor) erros.valor = t('erro.valorMax');
    const tx = D.lerNumero(campo('taxa').value, false), taxa = Math.round(tx * 10000);
    if (!campo('taxa').value.trim()) erros.taxa = t('erro.taxaVazia');
    else if (!Number.isFinite(tx)) erros.taxa = t('erro.taxaInvalida');
    else if (taxa > D.LIMITES.taxa) erros.taxa = t('erro.taxaMax');
    const de = diaDeISO(campo('de').value), dp = diaDeISO(campo('dp').value);
    if (de == null) erros.de = t('erro.de');
    if (dp == null) erros.dp = t('erro.dp');
    else if (de != null && dp < de) erros.dp = t('erro.dpAntes');
    else if (de != null && dp - de > D.LIMITES.dias) erros.dp = t('erro.prazoMax');
    return { erros, dados: { papel: marcado('papel') === 'devedor' ? 'devedor' : 'credor', nomeOutro: outro, valor, taxa, modo: marcado('modo') || 'mes', composto: marcado('tipo') === 'compostos', de, dp } };
  }
  function mostrarErros(erros, alvo = form) {
    alvo.querySelectorAll('.field[data-f]').forEach(f => {
      const msg = erros[f.dataset.f] || '';
      f.classList.toggle('invalid', !!msg);
      const er = f.querySelector('.err'); if (er) er.textContent = msg;
    });
    const primeiro = Object.keys(erros)[0];
    if (primeiro) { const c = alvo.querySelector(`.field[data-f="${primeiro}"] input`); if (c) c.focus(); }
    return !!primeiro;
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const { erros, dados } = lerFormulario();
    if (mostrarErros(erros)) return;
    const btn = $('#btnRegistrar'); btn.disabled = true;
    try {
      const codigo = await D.criarProposta(perfil, dados);
      const m = await D.lerCodigo(codigo);
      upsert(registroDe(m, dados.papel, 'aguardando'));
      campo('outro').value = ''; campo('valor').value = ''; campo('taxa').value = '';
      await abrirModelo(m, { aviso: t('toast.registrado') });
    } catch (err) {
      const [ti, x] = msgDe(err); toast(`${ti}: ${x}`);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------------- check a code ---------------- */
  async function abrirTexto(txt) {
    if (!perfil) { toast(t('toast.criePerfil')); return; }
    try {
      const m = await D.lerCodigo(txt);
      $('#f-codigo').value = ''; $('#msgConf').innerHTML = '';
      await abrirModelo(m);
    } catch (err) {
      const [ti, x] = msgDe(err);
      $('#msgConf').innerHTML = alertaHTML(ti, x);
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

  /* ---------------- copy, share, print ---------------- */
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
  function imprimir() {
    const m = atual.m;
    const nome = t('rc.pdf', { nome: m.devedor.nome, data: fmt.data(m.dados.de).replace(/\//g, '-').replace(/,/g, '') });
    const a = app();
    if (a && a.print) { try { a.print(nome); return; } catch { /* fall through */ } }
    document.title = nome;
    const fim = () => { document.title = TITULO; window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    window.print();
  }

  /* ---------------- record details ---------------- */
  const papelDe = m => (m.credor.id === perfil.id ? 'credor' : m.devedor.id === perfil.id ? 'devedor' : null);
  const parteEmissora = m => (m.emissor === 'credor' ? m.credor : m.devedor);
  const parteOutra = m => (m.emissor === 'credor' ? m.devedor : m.credor);

  async function abrirModelo(m, opts = {}) {
    let reg = m.idHex ? registros.find(r => r.id === m.idHex) : null;
    let ctx, aviso = opts.aviso;
    if (m.tipo === 'v1') {
      ctx = 'antigo';
    } else if (m.tipo === 'proposta') {
      if (reg && reg.status !== 'aguardando' && reg.codigo !== m.codigo) {
        return abrirModelo(await D.lerCodigo(reg.codigo), opts);
      }
      if (parteEmissora(m).id === perfil.id) {
        if (!reg) reg = upsert(registroDe(m, m.emissor, 'aguardando'));
        ctx = 'aguardando';
      } else {
        ctx = 'recebida';
      }
    } else {
      const meu = papelDe(m);
      if (meu) {
        if (!reg || reg.status === 'aguardando') {
          const estavaAguardando = !!reg;
          reg = upsert(registroDe(m, meu, 'validado'));
          if (estavaAguardando && !aviso) aviso = t('toast.validado');
        }
        ctx = reg.status === 'quitado' ? 'quitado' : 'validado';
      } else {
        ctx = 'terceiro';
      }
    }
    atual = { m, ctx, reg, extra: opts };
    renderDetalhe();
    irPara('detalhe');
    if (aviso) toast(aviso);
  }

  function statusHTML() {
    const { m, ctx, reg, extra } = atual;
    const emissor = m.emissor ? parteEmissora(m) : null, outra = m.emissor ? parteOutra(m) : null;
    const d = m.dados, c = m.calc;
    let cls, icone, titulo, texto, botoes = '';
    if (ctx === 'aguardando') {
      cls = 'st-aguardando'; icone = 'relogio';
      titulo = t('st.aguardandoT', { nome: esc(outra.nome) });
      texto = t('st.aguardando', { nome: esc(outra.nome) });
      botoes = `<button class="btn btn-dark so-qr" type="button" data-acao="ler-qr">${ico('camera')}${t('st.lerConf')}</button>
                <button class="btn" type="button" data-acao="colar">${ico('copiar')}${t('st.colarConf')}</button>`;
    } else if (ctx === 'recebida') {
      const souDevedor = m.emissor === 'credor';
      cls = 'st-recebida'; icone = 'doc';
      titulo = t('st.recebidaT', { nome: esc(emissor.nome) });
      texto = t(souDevedor ? 'st.recebidaDevedor' : 'st.recebidaCredor',
        { nome: esc(emissor.nome), valor: fmt.brl(d.valor), de: fmt.data(d.de), total: fmt.brl(c.total), dp: fmt.data(d.dp) });
      texto += ' ' + t('st.confira');
      botoes = `<button class="btn btn-primary" type="button" data-acao="confirmar">${ico('chave')}${t('st.confirmar')}</button>
                <button class="btn" type="button" data-acao="recusar">${t('st.naoReconheco')}</button>`;
    } else if (ctx === 'validado') {
      cls = 'st-validado'; icone = 'check';
      titulo = t('st.validadoT');
      texto = t('st.validado', { a: esc(m.credor.nome), b: esc(m.devedor.nome) });
      if (extra.recemConfirmado) texto += ' ' + t('st.mostreVolta', { nome: esc(emissor.nome) });
      if (d.dp < hojeDia()) texto += ' ' + t('st.venceu', { data: fmt.data(d.dp) });
      if (reg) botoes = `<button class="btn" type="button" data-acao="quitar">${ico('check')}${t('st.quitar')}</button>`;
    } else if (ctx === 'quitado') {
      cls = 'st-quitado'; icone = 'check';
      titulo = t('st.quitadoT');
      const q = new Date(reg.quitadoEm || Date.now());
      texto = t('st.quitado', { data: fmt.data(Math.round(Date.UTC(q.getFullYear(), q.getMonth(), q.getDate()) / 86400000)) });
      botoes = `<button class="btn" type="button" data-acao="desquitar">${ico('desfazer')}${t('st.desfazer')}</button>`;
    } else if (ctx === 'terceiro') {
      cls = 'st-terceiro'; icone = 'escudo';
      titulo = t('st.terceiroT');
      texto = t('st.terceiro', { a: esc(m.credor.nome), b: esc(m.devedor.nome) });
    } else {
      cls = 'st-antigo'; icone = 'alerta';
      titulo = t('st.antigoT');
      texto = t('st.antigo');
    }
    return `<section class="status ${cls}"><span class="st-ico">${ico(icone)}</span><div><h3>${titulo}</h3><p>${texto}</p>${botoes ? `<div class="btns">${botoes}</div>` : ''}</div></section>`;
  }

  function qrHTML() {
    const { m, ctx } = atual;
    if (ctx === 'recebida') return '';
    const aguardando = ctx === 'aguardando';
    const legenda = aguardando ? t('qr.paraConfirmar', { nome: esc(parteOutra(m).nome) }) : t(m.tipo === 'v1' ? 'qr.antigo' : 'qr.validado');
    const dica = t(aguardando ? 'qr.dicaAg' : 'qr.dica');
    return `<section class="qr-card">
      <div class="qr">${D.QR.svg(m.codigo, { nivel: 'M', rotulo: esc(t('qr.rotulo')) })}</div>
      <div class="qr-info">
        <p class="kicker">${legenda}</p>
        <code class="codigo">${esc(m.codigo)}</code>
        <div class="btns">
          <button class="btn btn-alt" type="button" data-acao="copiar">${ico('copiar')}${t('qr.copiar')}</button>
          <button class="btn" type="button" data-acao="enviar">${ico('enviar')}${t('aj.compartilhar')}</button>
          ${aguardando ? '' : `<button class="btn" type="button" data-acao="imprimir">${ico('imprimir')}${t('qr.imprimir')}</button>`}
        </div>
        <p class="hint">${dica}</p>
      </div>
    </section>`;
  }

  function resumoHTML(m) {
    const c = m.calc, d = m.dados;
    const pct = fmt.num(d.valor ? Math.round(c.lucro / d.valor * 10000) / 100 : 0);
    return `<div class="summary">
      <div class="stat s-1"><span>${t('res.total')}</span><b>${rs(fmt.brl(c.total))}</b><small>${t('res.totalNota')}</small></div>
      <div class="stat s-2"><span>${t('res.lucro')}</span><b>${rs(fmt.brl(c.lucro))}</b><small>${t('res.lucroNota', { pct })}</small></div>
      <div class="stat s-3"><span>${t('res.prazo')}</span><b>${fmt.dias(c.dias)}</b><small>${fmt.dataCurta(d.de)} → ${fmt.dataCurta(d.dp)}</small></div>
      <div class="stat s-4"><span>${t('res.juros')}</span><b>${rs(fmt.brl4(c.jurosCentavos))}</b><small>${t('res.jurosNota')}</small></div>
    </div>`;
  }

  function textoJuros(d, c) {
    if (d.taxa === 0) return t('juros.sem');
    const v = { taxa: `${fmt.taxa(d.taxa)} ${fmt.modo(d.modo)}`, dias: fmt.dias(c.dias), juros: fmt.brl(c.lucro),
                base: t(d.modo === 'mes' ? 'juros.baseMes' : 'juros.baseAno') };
    if (d.composto) return t('juros.compostos', v);
    return t(d.modo === 'total' ? 'juros.simplesTotal' : 'juros.simples', v);
  }

  function reciboHTML(m) {
    const c = m.calc, d = m.dados;
    const credor = esc(m.credor.nome), devedor = esc(m.devedor.nome);
    const linha = (rot, val, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><dt>${rot}</dt><dd>${val}</dd></div>`;
    const assinatura = (parte, papel) => parte.assinou
      ? `<div class="sig"><span class="selo">${ico('check')}</span><span class="sig-role">${papel}</span><b>${esc(parte.nome)}</b><small>ID ${esc(parte.id)}</small><small>${t('rc.assinou', { quando: fmt.momento(parte.ts, parte.tz) })}</small>${parte.nomeInformado && parte.nomeInformado !== parte.nome ? `<small>${t('rc.informado', { nome: esc(parte.nomeInformado) })}</small>` : ''}</div>`
      : `<div class="sig off"><span class="sig-role">${papel}</span><b>${esc(parte.nome)}</b><small>${t(m.tipo === 'v1' ? 'rc.semAssinatura' : 'rc.aguardando')}</small></div>`;
    let situacao, nota, situacaoCurta;
    if (m.tipo === 'validado') {
      situacao = t('rc.situacaoVal', { a: credor, b: devedor });
      situacaoCurta = t('rc.curtaVal');
      nota = t('rc.notaVal');
    } else if (m.tipo === 'proposta') {
      const a = esc(parteEmissora(m).nome), b = esc(parteOutra(m).nome);
      situacao = t('rc.situacaoProp', { a, b });
      situacaoCurta = t('rc.curtaProp');
      nota = t('rc.notaProp', { b });
    } else {
      situacao = t('rc.situacaoV1');
      situacaoCurta = t('rc.curtaV1');
      nota = t('rc.notaV1');
    }
    const confirmado = m.confirmadoEm ? fmt.momento(m.confirmadoEm.ts, m.confirmadoEm.tz) : '—';
    const taxa = d.taxa === 0 ? t('rc.semJuros')
      : `${fmt.taxa(d.taxa)} ${fmt.modo(d.modo)}${d.modo === 'total' ? '' : t(d.composto ? 'rc.compostos' : 'rc.simples')}`;
    return `
      <header class="rc-head"><div class="rc-brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="28 28 52 52"><path class="bm-d" d="M41 37H50A17 17 0 0 1 50 71H41Z"/><circle class="bm-p" cx="52.5" cy="54" r="4.6"/></svg></span>DebtID</div><span class="rc-ref">Ref. ${esc(m.ref)}</span></header>
      <div class="rc-body">
        <p class="kicker">${t('rc.kicker')}</p>
        <h3 class="rc-title">${t('rc.titulo')}</h3>
        <p class="rc-text">${t('rc.p1', { devedor, credor, data: fmt.dataExtenso(d.de), valor: fmt.brl(d.valor), extenso: extenso(d.valor) })}</p>
        <p class="rc-text">${t('rc.p2', { juros: textoJuros(d, c), credor, total: fmt.brl(c.total), extenso: extenso(c.total), data: fmt.dataExtenso(d.dp), dias: fmt.dias(c.dias) })}</p>
        <p class="rc-note">${situacao} ${t('rc.arred', { tipo: t(d.composto ? 'rc.tipoCompostos' : 'rc.tipoSimples') })}</p>
        <dl class="rc-grid">
          ${linha(t('rc.credor'), credor)}
          ${linha(t('rc.devedor'), devedor)}
          ${linha(t('rc.valor'), fmt.brl(d.valor))}
          ${linha(t('rc.taxa'), taxa)}
          ${linha(t('rc.de'), fmt.data(d.de))}
          ${linha(t('rc.dp'), fmt.data(d.dp))}
          ${linha(t('rc.prazo'), fmt.dias(c.dias))}
          ${linha(t('rc.juros'), fmt.brl4(c.jurosCentavos))}
          ${linha(t('rc.lucro'), fmt.brl(c.lucro))}
          ${linha(t('rc.situacao'), situacaoCurta)}
          ${linha(t('rc.registrado'), fmt.momento(d.ts, d.tz))}
          ${linha(t('rc.confirmado'), confirmado)}
          ${linha(t('rc.total'), fmt.brl(c.total), 'hl')}
        </dl>
        <div class="rc-sign">${assinatura(m.credor, t('rc.credor'))}${assinatura(m.devedor, t('rc.devedor'))}</div>
      </div>
      <div class="rc-key">
        <div class="rc-qr">${D.QR.svg(m.codigo, { nivel: 'M', margem: 2, rotulo: esc(t('qr.rotulo')) })}</div>
        <div>
          <p class="rc-key-label">${t('rc.codigo')}</p>
          <code>${esc(m.codigo)}</code>
          <p class="rc-key-note">${ico('cadeado')}<span>${nota}</span></p>
        </div>
      </div>`;
  }

  function renderDetalhe() {
    const { m, reg } = atual;
    $('#detalhe').innerHTML = statusHTML() + qrHTML() + resumoHTML(m) +
      `<article class="receipt">${reciboHTML(m)}</article>` +
      (reg ? `<div class="form-foot"><button class="btn btn-ghost" type="button" data-acao="excluir">${ico('lixo')}${t('det.excluir')}</button></div>` : '');
  }

  function mensagemCompartilhar() {
    const { m, ctx } = atual;
    if (ctx === 'aguardando') {
      return t('share.aguardando', { eu: perfil.nome, total: fmt.brl(m.calc.total), data: fmt.data(m.dados.dp), codigo: m.codigo });
    }
    if (m.tipo === 'validado' && parteEmissora(m).id !== perfil.id && papelDe(m)) return t('share.confirmei', { codigo: m.codigo });
    return t('share.geral', { ref: m.ref, codigo: m.codigo });
  }

  async function confirmarAtual(botao) {
    const m = atual.m;
    const meuPapel = m.emissor === 'credor' ? 'devedor' : 'credor';
    const outro = parteEmissora(m);
    const ok = await perguntar({
      titulo: t('modal.assinarT'),
      texto: t(meuPapel === 'devedor' ? 'modal.assinarDevedor' : 'modal.assinarCredor',
        { valor: fmt.brl(m.dados.valor), nome: outro.nome, total: fmt.brl(m.calc.total), data: fmt.data(m.dados.dp) }),
      ok: t('modal.assinarOk')
    });
    if (!ok) return;
    if (botao) botao.disabled = true;
    try {
      const cod = await D.confirmarProposta(perfil, m.codigo);
      const mv = await D.lerCodigo(cod);
      upsert(registroDe(mv, meuPapel, 'validado'));
      await abrirModelo(mv, { recemConfirmado: true, aviso: t('toast.assinado') });
    } catch (err) {
      const [ti, x] = msgDe(err); toast(`${ti}: ${x}`);
      if (botao) botao.disabled = false;
    }
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    if (acao === 'ler-qr') return lerEAbrir();
    if (acao === 'copiar-backup') return toast(t(await copiar($('#codigoBackup').textContent) ? 'toast.backupCopiado' : 'toast.semCopiarCurto'));
    if (acao === 'enviar-backup') return compartilhar($('#codigoBackup').textContent);
    if (!atual) return;
    const { reg } = atual;
    switch (acao) {
      case 'colar': irPara('conferir'); setTimeout(() => $('#f-codigo').focus(), 60); break;
      case 'confirmar': confirmarAtual(b); break;
      case 'recusar': atual = null; irPara('conferir'); toast(t('toast.nadaAssinado')); break;
      case 'copiar': toast(t(await copiar(atual.m.codigo) ? 'toast.codigoCopiado' : 'toast.semCopiar')); break;
      case 'enviar': compartilhar(mensagemCompartilhar()); break;
      case 'imprimir': imprimir(); break;
      case 'quitar':
        atual.reg = upsert({ id: reg.id, status: 'quitado', quitadoEm: Date.now(), atualizadoEm: Date.now() });
        atual.ctx = 'quitado'; renderDetalhe(); toast(t('toast.quitado')); break;
      case 'desquitar':
        atual.reg = upsert({ id: reg.id, status: 'validado', quitadoEm: null, atualizadoEm: Date.now() });
        atual.ctx = 'validado'; renderDetalhe(); break;
      case 'excluir':
        if (await perguntar({ titulo: t('modal.excluirT'), texto: t('modal.excluir'), ok: t('modal.excluirOk'), perigo: true })) {
          registros = registros.filter(r => r.id !== reg.id); salvarRegistros();
          atual = null; irPara('registros'); toast(t('toast.excluido'));
        }
        break;
    }
  });

  /* ---------------- records list ---------------- */
  function renderRegistros() {
    const filtro = ($('input[name="filtro"]:checked') || {}).value || 'todos';
    const dia = hojeDia();
    const validos = registros.filter(r => r.status === 'validado');
    const soma = papel => validos.filter(r => r.papel === papel).reduce((s, r) => s + r.total, 0);
    $('#totais').innerHTML =
      `<div class="stat s-2"><span>${t('reg.receber')}</span><b>${rs(fmt.brl(soma('credor')))}</b><small>${t('reg.totaisNota')}</small></div>` +
      `<div class="stat s-3"><span>${t('reg.pagar')}</span><b>${rs(fmt.brl(soma('devedor')))}</b><small>${t('reg.totaisNota')}</small></div>`;
    const lista = registros.filter(r => filtro === 'todos' || r.status === filtro)
      .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
    const el = $('#lista');
    if (!registros.length) {
      el.innerHTML = `<div class="vazio"><b>${t('reg.vazioT')}</b><p>${t('reg.vazio')}</p><a class="btn btn-primary" href="#inicio">${ico('plus')}${t('comum.novoRegistro')}</a></div>`;
      return;
    }
    if (!lista.length) { el.innerHTML = `<div class="vazio">${t('reg.filtroVazio')}</div>`; return; }
    el.innerHTML = lista.map(r => {
      const recebe = r.papel === 'credor';
      const vencido = r.status === 'validado' && r.dp < dia;
      const quando = r.status === 'quitado' ? t('reg.quitado') : t(vencido ? 'reg.venceu' : 'reg.vence', { data: fmt.data(r.dp) });
      return `<button class="reg" type="button" data-reg="${esc(r.id)}">
        <span class="reg-ico ${recebe ? 'rec' : 'pag'}">${ico(recebe ? 'baixo' : 'cima')}</span>
        <span class="reg-main"><b>${esc(r.outro)}</b><small>${t(recebe ? 'reg.emprestou' : 'reg.deve')} · ${quando}</small></span>
        <span class="reg-side"><b>${fmt.brl(r.total)}</b><span class="chip ${vencido ? 'vencido' : r.status}">${t('rotulo.' + (vencido ? 'vencido' : r.status))}</span></span>
      </button>`;
    }).join('');
  }
  $('#lista').addEventListener('click', async e => {
    const b = e.target.closest('[data-reg]');
    if (!b) return;
    const r = registros.find(x => x.id === b.dataset.reg);
    if (!r) return;
    try { await abrirModelo(await D.lerCodigo(r.codigo)); } catch (err) { const [ti, x] = msgDe(err); toast(`${ti}: ${x}`); }
  });

  /* ---------------- settings ---------------- */
  function renderAjustes() {
    if (!perfil) return;
    $('#perfilNome').textContent = perfil.nome;
    $('#perfilId').textContent = perfil.id;
    $('#avatar').textContent = (perfil.nome.trim()[0] || '?').toUpperCase();
    $('#f-nome-ajuste').value = perfil.nome;
    $$('input[name="ui"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    $$('input[name="tema"]').forEach(i => { i.checked = i.value === temaPref(); });
    $$('input[name="idioma"]').forEach(i => { i.checked = i.value === DebtIDIdioma.atual(); });
  }
  $('#formNome').addEventListener('submit', e => {
    e.preventDefault();
    const nome = limparNome($('#f-nome-ajuste').value);
    if (nome.length < 2) return toast(t('toast.digiteNome'));
    perfil = { ...perfil, nome: nome.slice(0, 80) };
    gravarJSON(K.perfil, perfil); renderAjustes(); toast(t('toast.nomeAtualizado'));
  });
  const mostrar = (id, sim) => { $(id).hidden = !sim; };
  $('#btnBackup').addEventListener('click', () => {
    const abrir = $('#formBackup').hidden;
    mostrar('#formBackup', abrir); mostrar('#formRestaurar', false); mostrar('#saidaBackup', false); $('#msgBackup').innerHTML = '';
    if (abrir) $('#f-bk1').focus();
  });
  $('#btnRestaurar').addEventListener('click', () => {
    const abrir = $('#formRestaurar').hidden;
    mostrar('#formRestaurar', abrir); mostrar('#formBackup', false); mostrar('#saidaBackup', false); $('#msgBackup').innerHTML = '';
    if (abrir) $('#f-rs-codigo').focus();
  });
  $('#formBackup').addEventListener('submit', async e => {
    e.preventDefault();
    const s1 = $('#f-bk1').value, s2 = $('#f-bk2').value;
    if (s1.length < 6) { $('#msgBackup').innerHTML = alertaHTML(t('bk.senhaCurtaT'), t('bk.senhaCurta')); return; }
    if (s1 !== s2) { $('#msgBackup').innerHTML = alertaHTML(t('bk.difT'), t('bk.dif')); return; }
    const btn = e.submitter || $('#formBackup button'); btn.disabled = true;
    try {
      const codigo = await D.exportarBackup({ tipo: 'debtid-backup', v: 1, perfil, registros, ui: raiz.dataset.ui, tema: lerTexto(K.tema) }, s1);
      $('#codigoBackup').textContent = codigo;
      mostrar('#formBackup', false); mostrar('#saidaBackup', true); $('#msgBackup').innerHTML = '';
      $('#f-bk1').value = $('#f-bk2').value = '';
    } catch (err) {
      const [ti, x] = msgDe(err); $('#msgBackup').innerHTML = alertaHTML(ti, x);
    } finally { btn.disabled = false; }
  });
  const PESO = { aguardando: 0, validado: 1, quitado: 2 };
  async function restaurar(codigo, senha, msgEl, btn) {
    if (btn) btn.disabled = true;
    try {
      const obj = await D.importarBackup(codigo, senha);
      if (!obj || obj.tipo !== 'debtid-backup' || !obj.perfil || !obj.perfil.jwk || !obj.perfil.id) throw new D.ChaveErro('BACKUP_FORMATO');
      if (perfil && perfil.id !== obj.perfil.id) {
        const ok = await perguntar({
          titulo: t('modal.trocarT'),
          texto: t('modal.trocar', { a: perfil.id, b: obj.perfil.id }),
          ok: t('modal.trocarOk')
        });
        if (!ok) return;
      }
      perfil = { ...obj.perfil };
      gravarJSON(K.perfil, perfil);
      for (const r of Array.isArray(obj.registros) ? obj.registros : []) {
        if (!r || !r.id || !r.codigo) continue;
        const ja = registros.find(x => x.id === r.id);
        if (!ja) registros.push(r);
        else if ((PESO[r.status] || 0) > (PESO[ja.status] || 0)) Object.assign(ja, r);
      }
      salvarRegistros();
      if (obj.ui) aplicarUI(obj.ui);
      if (obj.tema === 'dark' || obj.tema === 'light') { gravarTexto(K.tema, obj.tema); aplicarTema(); }
      msgEl.innerHTML = '';
      toast(t('toast.backupRestaurado'));
      irPara('registros');
    } catch (err) {
      const [ti, x] = msgDe(err); msgEl.innerHTML = alertaHTML(ti, x);
    } finally { if (btn) btn.disabled = false; }
  }
  $('#formRestaurar').addEventListener('submit', e => {
    e.preventDefault();
    restaurar($('#f-rs-codigo').value, $('#f-rs-senha').value, $('#msgBackup'), e.submitter);
  });
  $('#btnApagar').addEventListener('click', async () => {
    const ok = await perguntar({
      titulo: t('modal.apagarT'),
      texto: t('modal.apagar'),
      ok: t('modal.apagarOk'), perigo: true
    });
    if (!ok) return;
    try { [K.perfil, K.regs].forEach(k => localStorage.removeItem(k)); } catch { /* ignore */ }
    perfil = null; registros = []; atual = null;
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
      const [ti, x] = msgDe(err); $('#msgBV').innerHTML = alertaHTML(ti, x);
    } finally { btn.disabled = false; }
  });

  /* ---------------- language ---------------- */
  function aplicarIdioma(l, salvar) {
    // amounts already typed are re-read in the old language and rewritten in the new one
    const v = D.lerNumero(campo('valor').value, true), tx = D.lerNumero(campo('taxa').value, false);
    const lang = DebtIDIdioma.aplicar(l);
    D.definirIdioma(lang);
    if (salvar) gravarTexto(K.idioma, lang);
    $$('input[name="idioma"],input[name="idioma-bv"]').forEach(i => { i.checked = i.value === lang; });
    if (v > 0) campo('valor').value = fmt.num2(Math.round(v * 100) / 100);
    if (tx >= 0 && campo('taxa').value.trim()) campo('taxa').value = fmt.num(Math.round(tx * 10000) / 10000);
    $$('.field.invalid').forEach(f => { f.classList.remove('invalid'); const er = f.querySelector('.err'); if (er) er.textContent = ''; });
    ['#msgConf', '#msgBackup', '#msgBV'].forEach(id => { $(id).innerHTML = ''; });
    aplicarTema();
    atualizaDicas();
    const v2 = location.hash.slice(1);
    if (v2 === 'registros') renderRegistros();
    if (v2 === 'detalhe' && atual) renderDetalhe();
  }

  /* ---------------- startup ---------------- */
  aplicarIdioma(DebtIDIdioma.atual(), false);
  aplicarUI(raiz.dataset.ui);
  aplicarTema();
  verificarLeitor();
  rota();
})();
