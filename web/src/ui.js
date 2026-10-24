/* =====================================================================
   DebtID — interface
   ===================================================================== */
(() => {
  'use strict';
  const D = DebtID, { fmt, extenso } = D;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const raiz = document.documentElement;
  const TITULO = document.title;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ico = n => `<svg class="ico" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const rs = s => s.replace('R$ ', '<i>R$</i>');
  const app = () => window.DebtIDApp || null; // ponte do app Android (só existe no APK)

  /* ---------------- armazenamento local ---------------- */
  const K = { perfil: 'debtid.perfil', regs: 'debtid.registros', ui: 'debtid.ui', tema: 'debtid.tema' };
  const lerJSON = (k, padrao) => { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch { return padrao; } };
  const gravarJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const lerTexto = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravarTexto = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

  let perfil = lerJSON(K.perfil, null);
  if (perfil && (!perfil.jwk || !perfil.pub || !perfil.id)) perfil = null;
  let registros = lerJSON(K.regs, []);
  if (!Array.isArray(registros)) registros = [];
  const salvarRegistros = () => {
    if (!gravarJSON(K.regs, registros)) toast('Não consegui salvar neste aparelho.');
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

  /* ---------------- aparência e tema ---------------- */
  const prefEscuro = matchMedia('(prefers-color-scheme: dark)');
  const temaPref = () => { const t = lerTexto(K.tema); return t === 'dark' || t === 'light' ? t : 'sistema'; };
  function corDasBarras() {
    const cs = getComputedStyle(raiz);
    const pro = raiz.dataset.ui === 'pro', escuro = raiz.dataset.theme === 'dark';
    const topo = cs.getPropertyValue(pro ? '--band' : '--bg').trim();
    const base = cs.getPropertyValue(pro ? '--band' : '--card').trim();
    $('meta[name="theme-color"]').setAttribute('content', topo);
    const a = app();
    if (a && a.barras) { try { a.barras(topo, !pro && !escuro, base, !pro && !escuro); } catch { /* ignora */ } }
  }
  function aplicarTema() {
    const pref = temaPref();
    const t = pref === 'sistema' ? (prefEscuro.matches ? 'dark' : 'light') : pref;
    raiz.dataset.theme = t;
    const rot = t === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro';
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
  });

  /* ---------------- avisos ---------------- */
  let timerToast;
  function toast(t) {
    const x = $('#toast'); x.textContent = t; x.classList.add('show');
    clearTimeout(timerToast); timerToast = setTimeout(() => x.classList.remove('show'), 2600);
  }
  function perguntar({ titulo, texto, ok = 'Confirmar', perigo = false }) {
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
  const ERROS = {
    VAZIA: ['Nenhum código', 'Cole um código ou leia um QR code.'],
    FORMATO: ['Código não reconhecido', 'Não encontrei um código do DebtID nesse texto. Ele termina com um traço e 4 caracteres de conferência.'],
    CHECKSUM: ['Código digitado errado', 'O código está incompleto ou com algum caractere trocado. Confira maiúsculas e minúsculas, ou leia o QR.'],
    CORROMPIDA: ['Código corrompido', 'O código passou na conferência, mas os dados internos não puderam ser lidos.'],
    VERSAO: ['Versão desconhecida', 'Este código foi gerado por uma versão do DebtID que este app não conhece.'],
    INCONSISTENTE: ['Dados inconsistentes', 'O total gravado não bate com o recálculo. O código pode ter sido adulterado.'],
    ASSINATURA: ['Assinatura inválida', 'O código foi alterado depois de assinado. Não confie neste registro.'],
    PROPRIA: ['Mesmo perfil dos dois lados', 'O registro precisa ser confirmado por outra pessoa, com outro perfil.'],
    NAO_E_PROPOSTA: ['Nada para confirmar', 'Este código já está validado.'],
    SEM_CRIPTO: ['Navegador sem suporte', 'Este navegador não tem as funções de criptografia necessárias. Use o app ou um navegador atualizado.'],
    SENHA: ['Senha incorreta', 'A senha não abre este backup.'],
    BACKUP_FORMATO: ['Backup inválido', 'Esse texto não é um backup do DebtID ou está incompleto.']
  };
  const msgDe = err => ERROS[err && err.codigo] || ['Algo deu errado', (err && err.message) || 'Tente de novo.'];
  const alertaHTML = (titulo, texto, ok = false) =>
    `<div class="alert${ok ? ' ok' : ''}"><i>${ico(ok ? 'check' : 'alerta')}</i><div><b>${esc(titulo)}</b><p>${esc(texto)}</p></div></div>`;

  /* ---------------- navegação ---------------- */
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

  /* ---------------- formulário ---------------- */
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
  const DICAS = {
    total: 'Aplicada uma única vez sobre o valor, qualquer que seja o prazo.',
    mes: 'Juros simples proporcionais aos dias do prazo (mês comercial de 30 dias).',
    ano: 'Juros simples proporcionais aos dias do prazo (ano de 365 dias).'
  };
  const marcado = n => (form.querySelector(`input[name="${n}"]:checked`) || {}).value;
  function atualizaDicas() {
    $('#hintModo').textContent = DICAS[marcado('modo') || 'mes'];
    const credor = marcado('papel') !== 'devedor';
    $('#l-outro').textContent = credor ? 'Nome de quem pega emprestado' : 'Nome de quem empresta';
    const de = diaDeISO(campo('de').value), dp = diaDeISO(campo('dp').value);
    const caixa = $('#prazoAoVivo'), ok = de != null && dp != null && dp >= de;
    caixa.classList.toggle('off', !ok);
    caixa.lastElementChild.textContent = ok ? 'Prazo: ' + fmt.dias(dp - de) : 'Prazo: —';
  }
  form.addEventListener('change', atualizaDicas);
  form.addEventListener('input', e => {
    if (e.target.type === 'date') atualizaDicas();
    const f = e.target.closest('.field');
    if (f && f.classList.contains('invalid')) { f.classList.remove('invalid'); const er = f.querySelector('.err'); if (er) er.textContent = ''; }
  });
  atualizaDicas();
  const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 });
  campo('valor').addEventListener('blur', () => {
    const n = D.lerNumero(campo('valor').value, true);
    if (n > 0) campo('valor').value = nf2.format(Math.round(n * 100) / 100);
  });
  campo('taxa').addEventListener('blur', () => {
    const n = D.lerNumero(campo('taxa').value, false);
    if (n >= 0) campo('taxa').value = nfT.format(Math.round(n * 10000) / 10000);
  });
  const limparNome = s => String(s).normalize('NFC').replace(/\s+/g, ' ').trim();

  function lerFormulario() {
    const erros = {};
    const outro = limparNome(campo('outro').value);
    if (!outro) erros.outro = marcado('papel') === 'devedor' ? 'Informe quem empresta.' : 'Informe quem pega emprestado.';
    else if (outro.length > 80) erros.outro = 'Use no máximo 80 caracteres.';
    const v = D.lerNumero(campo('valor').value, true), valor = Math.round(v * 100);
    if (!campo('valor').value.trim()) erros.valor = 'Informe o valor emprestado.';
    else if (!Number.isFinite(v)) erros.valor = 'Valor inválido. Ex.: 1.250,00';
    else if (valor < 1) erros.valor = 'O valor precisa ser maior que zero.';
    else if (valor > D.LIMITES.valor) erros.valor = 'Valor máximo: R$ 1 bilhão.';
    const t = D.lerNumero(campo('taxa').value, false), taxa = Math.round(t * 10000);
    if (!campo('taxa').value.trim()) erros.taxa = 'Informe a taxa (pode ser 0).';
    else if (!Number.isFinite(t)) erros.taxa = 'Taxa inválida. Ex.: 2,5';
    else if (taxa > D.LIMITES.taxa) erros.taxa = 'Taxa máxima: 1000%.';
    const de = diaDeISO(campo('de').value), dp = diaDeISO(campo('dp').value);
    if (de == null) erros.de = 'Escolha a data do empréstimo.';
    if (dp == null) erros.dp = 'Escolha a data de pagamento.';
    else if (de != null && dp < de) erros.dp = 'O pagamento não pode ser antes do empréstimo.';
    else if (de != null && dp - de > D.LIMITES.dias) erros.dp = 'Prazo máximo: 100 anos.';
    return { erros, dados: { papel: marcado('papel') === 'devedor' ? 'devedor' : 'credor', nomeOutro: outro, valor, taxa, modo: marcado('modo') || 'mes', de, dp } };
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
      await abrirModelo(m, { aviso: 'Registrado e assinado por você.' });
    } catch (err) {
      const [t, x] = msgDe(err); toast(`${t}: ${x}`);
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------------- conferir ---------------- */
  async function abrirTexto(txt) {
    if (!perfil) { toast('Crie seu perfil primeiro.'); return; }
    try {
      const m = await D.lerCodigo(txt);
      $('#f-codigo').value = ''; $('#msgConf').innerHTML = '';
      await abrirModelo(m);
    } catch (err) {
      const [t, x] = msgDe(err);
      $('#msgConf').innerHTML = alertaHTML(t, x);
      if (location.hash !== '#conferir') irPara('conferir');
    }
  }
  $('#vform').addEventListener('submit', e => { e.preventDefault(); abrirTexto($('#f-codigo').value); });
  $('#f-codigo').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); abrirTexto($('#f-codigo').value); }
  });
  $('#limparConf').addEventListener('click', () => { $('#f-codigo').value = ''; $('#msgConf').innerHTML = ''; $('#f-codigo').focus(); });
  window.DebtIDAbrir = abrirTexto; // usado pelo app ao receber um código compartilhado

  /* ---------------- leitor de QR ---------------- */
  async function verificarLeitor() {
    let pode = false;
    const a = app();
    if (a && a.lerQR) pode = true;
    else if ('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try { pode = (await BarcodeDetector.getSupportedFormats()).includes('qr_code'); } catch { pode = false; }
    }
    document.body.classList.toggle('pode-ler-qr', pode);
  }
  function lerQR() {
    const a = app();
    if (a && a.lerQR) {
      return new Promise(res => {
        window.__debtidQR = (texto, erro) => { window.__debtidQR = null; if (erro) toast(erro); res(texto ? String(texto) : null); };
        try { a.lerQR(); } catch { window.__debtidQR = null; res(null); }
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
      toast('Não deu para abrir a câmera. Libere o acesso ou cole o código.');
      return null;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    tela.hidden = false; video.srcObject = stream;
    try { await video.play(); } catch { /* segue */ }
    return new Promise(res => {
      let ativo = true;
      const fim = txt => {
        if (!ativo) return;
        ativo = false;
        stream.getTracks().forEach(t => t.stop());
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
        } catch { /* tenta de novo */ }
        setTimeout(procurar, 180);
      };
      procurar();
    });
  }
  async function lerEAbrir() {
    const txt = await lerQR();
    if (txt) abrirTexto(txt);
  }

  /* ---------------- copiar, compartilhar, imprimir ---------------- */
  async function copiar(texto) {
    const a = app();
    if (a && a.copiar) { try { if (a.copiar(texto)) return true; } catch { /* segue */ } }
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(texto); return true; }
    } catch { /* plano B */ }
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
    if (a && a.compartilhar) { try { a.compartilhar(texto); return; } catch { /* segue */ } }
    if (navigator.share) {
      try { await navigator.share({ text: texto }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    toast(await copiar(texto) ? 'Copiado. Cole na conversa para enviar.' : 'Não deu para compartilhar.');
  }
  function imprimir() {
    const m = atual.m;
    const nome = `Recibo DebtID - ${m.devedor.nome} - ${fmt.data(m.dados.de).replace(/\//g, '-')}`;
    const a = app();
    if (a && a.imprimir) { try { a.imprimir(nome); return; } catch { /* segue */ } }
    document.title = nome;
    const fim = () => { document.title = TITULO; window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    window.print();
  }

  /* ---------------- detalhe de um registro ---------------- */
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
          if (estavaAguardando && !aviso) aviso = 'Pronto! Registro validado pelos dois.';
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
      titulo = `Aguardando ${esc(outra.nome)} confirmar`;
      texto = `Mostre o QR code para ${esc(outra.nome)} ler no DebtID, ou envie o código por mensagem. Depois, leia aqui o QR de confirmação que vai aparecer no celular dessa pessoa.`;
      botoes = `<button class="btn btn-dark so-qr" type="button" data-acao="ler-qr">${ico('camera')}Ler confirmação</button>
                <button class="btn" type="button" data-acao="colar">${ico('copiar')}Colar confirmação</button>`;
    } else if (ctx === 'recebida') {
      const souDevedor = m.emissor === 'credor';
      cls = 'st-recebida'; icone = 'doc';
      titulo = `${esc(emissor.nome)} registrou um empréstimo com você`;
      texto = souDevedor
        ? `Segundo ${esc(emissor.nome)}, você pegou ${fmt.brl(d.valor)} emprestado em ${fmt.data(d.de)} e vai pagar ${fmt.brl(c.total)} até ${fmt.data(d.dp)}.`
        : `Segundo ${esc(emissor.nome)}, você emprestou ${fmt.brl(d.valor)} em ${fmt.data(d.de)} e vai receber ${fmt.brl(c.total)} até ${fmt.data(d.dp)}.`;
      texto += ' Confira os dados antes de assinar.';
      botoes = `<button class="btn btn-primary" type="button" data-acao="confirmar">${ico('chave')}Confirmar e assinar</button>
                <button class="btn" type="button" data-acao="recusar">Não reconheço</button>`;
    } else if (ctx === 'validado') {
      cls = 'st-validado'; icone = 'check';
      titulo = 'Validado pelos dois';
      texto = `${esc(m.credor.nome)} e ${esc(m.devedor.nome)} assinaram este registro.`;
      if (extra.recemConfirmado) texto += ` Agora mostre o QR para ${esc(emissor.nome)} ler, para o registro ficar validado no celular dessa pessoa também.`;
      if (d.dp < hojeDia()) texto += ` O pagamento venceu em ${fmt.data(d.dp)}.`;
      if (reg) botoes = `<button class="btn" type="button" data-acao="quitar">${ico('check')}Marcar como quitado</button>`;
    } else if (ctx === 'quitado') {
      cls = 'st-quitado'; icone = 'check';
      titulo = 'Quitado';
      texto = `Marcado como quitado em ${new Date(reg.quitadoEm || Date.now()).toLocaleDateString('pt-BR')}. Essa marcação fica só neste aparelho.`;
      botoes = `<button class="btn" type="button" data-acao="desquitar">${ico('desfazer')}Desfazer</button>`;
    } else if (ctx === 'terceiro') {
      cls = 'st-terceiro'; icone = 'escudo';
      titulo = 'Registro validado';
      texto = `Assinado por ${esc(m.credor.nome)} e ${esc(m.devedor.nome)}. Você não participa deste empréstimo.`;
    } else {
      cls = 'st-antigo'; icone = 'alerta';
      titulo = 'Código antigo, sem assinatura';
      texto = 'Gerado por uma versão anterior do app. Mostra os dados, mas não comprova quem registrou.';
    }
    return `<section class="status ${cls}"><span class="st-ico">${ico(icone)}</span><div><h3>${titulo}</h3><p>${texto}</p>${botoes ? `<div class="btns">${botoes}</div>` : ''}</div></section>`;
  }

  function qrHTML() {
    const { m, ctx } = atual;
    if (ctx === 'recebida') return '';
    const aguardando = ctx === 'aguardando';
    const legenda = aguardando ? `Código para ${esc(parteOutra(m).nome)} confirmar` : m.tipo === 'v1' ? 'Código antigo' : 'Código do registro validado';
    const dica = aguardando ? 'Mostre o QR na tela ou envie o código por mensagem.' : 'Qualquer pessoa com o DebtID confere as assinaturas por este código.';
    return `<section class="qr-card">
      <div class="qr">${D.QR.svg(m.codigo, { nivel: 'M', rotulo: 'QR code do registro' })}</div>
      <div class="qr-info">
        <p class="kicker">${legenda}</p>
        <code class="codigo">${esc(m.codigo)}</code>
        <div class="btns">
          <button class="btn btn-alt" type="button" data-acao="copiar">${ico('copiar')}Copiar código</button>
          <button class="btn" type="button" data-acao="enviar">${ico('enviar')}Compartilhar</button>
          ${aguardando ? '' : `<button class="btn" type="button" data-acao="imprimir">${ico('imprimir')}Imprimir / PDF</button>`}
        </div>
        <p class="hint">${dica}</p>
      </div>
    </section>`;
  }

  function resumoHTML(m) {
    const c = m.calc, d = m.dados;
    const pct = d.valor ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(c.lucro / d.valor * 100) : '0';
    return `<div class="summary">
      <div class="stat s-1"><span>Total a pagar</span><b>${rs(fmt.brl(c.total))}</b><small>arredondado para cima</small></div>
      <div class="stat s-2"><span>Lucro do credor</span><b>${rs(fmt.brl(c.lucro))}</b><small>${pct}% do valor</small></div>
      <div class="stat s-3"><span>Prazo</span><b>${fmt.dias(c.dias)}</b><small>${fmt.dataCurta(d.de)} → ${fmt.dataCurta(d.dp)}</small></div>
      <div class="stat s-4"><span>Juros calculados</span><b>${rs(fmt.brl4(c.jurosCentavos))}</b><small>antes do arredondamento</small></div>
    </div>`;
  }

  function textoJuros(d, c) {
    if (d.taxa === 0) return 'O empréstimo é feito <b>sem juros</b>.';
    const prop = d.modo === 'total' ? 'aplicados uma única vez sobre o valor emprestado'
      : `proporcionais aos ${fmt.dias(c.dias)} de prazo (${d.modo === 'mes' ? 'mês comercial de 30 dias' : 'ano de 365 dias'})`;
    return `Sobre esse valor incidem juros simples de <b>${fmt.taxa(d.taxa)} ${fmt.modo(d.modo)}</b>, ${prop}, o que soma <b>${fmt.brl(c.lucro)}</b> de juros.`;
  }

  function reciboHTML(m) {
    const c = m.calc, d = m.dados;
    const credor = esc(m.credor.nome), devedor = esc(m.devedor.nome);
    const linha = (rot, val, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><dt>${rot}</dt><dd>${val}</dd></div>`;
    const assinatura = (parte, papel) => parte.assinou
      ? `<div class="sig"><span class="selo">${ico('check')}</span><span class="sig-role">${papel}</span><b>${esc(parte.nome)}</b><small>ID ${esc(parte.id)}</small><small>Assinou em ${fmt.momento(parte.ts, parte.tz)}</small>${parte.nomeInformado && parte.nomeInformado !== parte.nome ? `<small>Informado como “${esc(parte.nomeInformado)}”</small>` : ''}</div>`
      : `<div class="sig off"><span class="sig-role">${papel}</span><b>${esc(parte.nome)}</b><small>${m.tipo === 'v1' ? 'Sem assinatura digital' : 'Aguardando confirmação'}</small></div>`;
    let situacao, nota, situacaoCurta;
    if (m.tipo === 'validado') {
      situacao = `Registro assinado digitalmente por ${credor} e por ${devedor} no DebtID.`;
      situacaoCurta = 'Validado pelos dois';
      nota = 'Assinado com chaves que ficam só no aparelho de cada pessoa. Confira no DebtID, em Conferir.';
    } else if (m.tipo === 'proposta') {
      situacao = `Registrado e assinado por ${esc(parteEmissora(m).nome)}; aguardando a assinatura de ${esc(parteOutra(m).nome)}.`;
      situacaoCurta = 'Aguardando confirmação';
      nota = `Ainda falta a assinatura de ${esc(parteOutra(m).nome)}. Confira no DebtID, em Conferir.`;
    } else {
      situacao = 'Registro antigo, sem assinatura digital.';
      situacaoCurta = 'Sem assinatura';
      nota = 'Código antigo, sem assinatura digital.';
    }
    const confirmado = m.confirmadoEm ? fmt.momento(m.confirmadoEm.ts, m.confirmadoEm.tz) : '—';
    return `
      <header class="rc-head"><div class="rc-brand"><span class="brand-mark" aria-hidden="true"><svg viewBox="28 28 52 52"><path class="bm-d" d="M41 37H50A17 17 0 0 1 50 71H41Z"/><circle class="bm-p" cx="52.5" cy="54" r="4.6"/></svg></span>DebtID</div><span class="rc-ref">Ref. ${esc(m.ref)}</span></header>
      <div class="rc-body">
        <p class="kicker">Recibo e termo de compromisso</p>
        <h3 class="rc-title">Recibo de empréstimo</h3>
        <p class="rc-text">Eu, <b>${devedor}</b>, declaro que recebi de <b>${credor}</b>, em ${fmt.dataExtenso(d.de)}, a quantia de <b>${fmt.brl(d.valor)}</b> (${extenso(d.valor)}), a título de empréstimo.</p>
        <p class="rc-text">${textoJuros(d, c)} Comprometo-me a pagar a ${credor} o total de <b>${fmt.brl(c.total)}</b> (${extenso(c.total)}) até <b>${fmt.dataExtenso(d.dp)}</b>, no prazo de <b>${fmt.dias(c.dias)}</b> contados da data do empréstimo.</p>
        <p class="rc-note">${situacao} Juros simples, com o total arredondado para cima no centavo.</p>
        <dl class="rc-grid">
          ${linha('Credor', credor)}
          ${linha('Devedor', devedor)}
          ${linha('Valor emprestado', fmt.brl(d.valor))}
          ${linha('Taxa de juros', d.taxa === 0 ? 'sem juros' : `${fmt.taxa(d.taxa)} ${fmt.modo(d.modo)}`)}
          ${linha('Data do empréstimo', fmt.data(d.de))}
          ${linha('Data de pagamento', fmt.data(d.dp))}
          ${linha('Prazo', fmt.dias(c.dias))}
          ${linha('Juros calculados', fmt.brl4(c.jurosCentavos))}
          ${linha('Lucro do credor', fmt.brl(c.lucro))}
          ${linha('Situação', situacaoCurta)}
          ${linha('Registrado em', fmt.momento(d.ts, d.tz))}
          ${linha('Confirmado em', confirmado)}
          ${linha('Total a pagar', fmt.brl(c.total), 'hl')}
        </dl>
        <div class="rc-sign">${assinatura(m.credor, 'Credor')}${assinatura(m.devedor, 'Devedor')}</div>
      </div>
      <div class="rc-key">
        <div class="rc-qr">${D.QR.svg(m.codigo, { nivel: 'M', margem: 2, rotulo: 'QR code do registro' })}</div>
        <div>
          <p class="rc-key-label">Código de verificação</p>
          <code>${esc(m.codigo)}</code>
          <p class="rc-key-note">${ico('cadeado')}<span>${nota}</span></p>
        </div>
      </div>`;
  }

  function renderDetalhe() {
    const { m, reg } = atual;
    $('#detalhe').innerHTML = statusHTML() + qrHTML() + resumoHTML(m) +
      `<article class="receipt">${reciboHTML(m)}</article>` +
      (reg ? `<div class="form-foot"><button class="btn btn-ghost" type="button" data-acao="excluir">${ico('lixo')}Excluir registro deste aparelho</button></div>` : '');
  }

  function mensagemCompartilhar() {
    const { m, ctx } = atual;
    if (ctx === 'aguardando') {
      return `${perfil.nome} registrou um empréstimo com você no DebtID: ${fmt.brl(m.calc.total)} até ${fmt.data(m.dados.dp)}.\n` +
             `Para confirmar, abra o DebtID, toque em Conferir e cole este código:\n\n${m.codigo}`;
    }
    if (m.tipo === 'validado' && parteEmissora(m).id !== perfil.id && papelDe(m)) {
      return `Confirmei nosso empréstimo no DebtID. Abra o DebtID, toque em Conferir e cole este código para validar:\n\n${m.codigo}`;
    }
    return `Empréstimo registrado no DebtID (Ref. ${m.ref}). Código para conferir:\n\n${m.codigo}`;
  }

  async function confirmarAtual(botao) {
    const m = atual.m;
    const meuPapel = m.emissor === 'credor' ? 'devedor' : 'credor';
    const outro = parteEmissora(m);
    const acao = meuPapel === 'devedor'
      ? `pegou ${fmt.brl(m.dados.valor)} emprestado de ${outro.nome}`
      : `emprestou ${fmt.brl(m.dados.valor)} para ${outro.nome}`;
    const ok = await perguntar({
      titulo: 'Confirmar e assinar?',
      texto: `Sua assinatura confirma que você ${acao}, com total de ${fmt.brl(m.calc.total)} até ${fmt.data(m.dados.dp)}. Depois de assinado, não dá para desfazer.`,
      ok: 'Assinar'
    });
    if (!ok) return;
    if (botao) botao.disabled = true;
    try {
      const cod = await D.confirmarProposta(perfil, m.codigo);
      const mv = await D.lerCodigo(cod);
      upsert(registroDe(mv, meuPapel, 'validado'));
      await abrirModelo(mv, { recemConfirmado: true, aviso: 'Assinado! Agora mostre o QR de volta.' });
    } catch (err) {
      const [t, x] = msgDe(err); toast(`${t}: ${x}`);
      if (botao) botao.disabled = false;
    }
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-acao]');
    if (!b) return;
    const acao = b.dataset.acao;
    if (acao === 'ler-qr') return lerEAbrir();
    if (acao === 'copiar-backup') return toast(await copiar($('#codigoBackup').textContent) ? 'Backup copiado.' : 'Não deu para copiar.');
    if (acao === 'enviar-backup') return compartilhar($('#codigoBackup').textContent);
    if (!atual) return;
    const { reg } = atual;
    switch (acao) {
      case 'colar': irPara('conferir'); setTimeout(() => $('#f-codigo').focus(), 60); break;
      case 'confirmar': confirmarAtual(b); break;
      case 'recusar': atual = null; irPara('conferir'); toast('Nada foi assinado.'); break;
      case 'copiar': toast(await copiar(atual.m.codigo) ? 'Código copiado.' : 'Não deu para copiar. Selecione o código.'); break;
      case 'enviar': compartilhar(mensagemCompartilhar()); break;
      case 'imprimir': imprimir(); break;
      case 'quitar':
        atual.reg = upsert({ id: reg.id, status: 'quitado', quitadoEm: Date.now(), atualizadoEm: Date.now() });
        atual.ctx = 'quitado'; renderDetalhe(); toast('Marcado como quitado.'); break;
      case 'desquitar':
        atual.reg = upsert({ id: reg.id, status: 'validado', quitadoEm: null, atualizadoEm: Date.now() });
        atual.ctx = 'validado'; renderDetalhe(); break;
      case 'excluir':
        if (await perguntar({ titulo: 'Excluir registro?', texto: 'Ele some deste aparelho. Quem tiver o código continua podendo conferir.', ok: 'Excluir', perigo: true })) {
          registros = registros.filter(r => r.id !== reg.id); salvarRegistros();
          atual = null; irPara('registros'); toast('Registro excluído.');
        }
        break;
    }
  });

  /* ---------------- registros ---------------- */
  const ROTULO = { aguardando: 'Aguardando', validado: 'Validado', quitado: 'Quitado' };
  function renderRegistros() {
    const filtro = ($('input[name="filtro"]:checked') || {}).value || 'todos';
    const dia = hojeDia();
    const validos = registros.filter(r => r.status === 'validado');
    const soma = papel => validos.filter(r => r.papel === papel).reduce((s, r) => s + r.total, 0);
    $('#totais').innerHTML =
      `<div class="stat s-2"><span>A receber</span><b>${rs(fmt.brl(soma('credor')))}</b><small>validados, sem quitados</small></div>` +
      `<div class="stat s-3"><span>A pagar</span><b>${rs(fmt.brl(soma('devedor')))}</b><small>validados, sem quitados</small></div>`;
    const lista = registros.filter(r => filtro === 'todos' || r.status === filtro)
      .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));
    const el = $('#lista');
    if (!registros.length) {
      el.innerHTML = `<div class="vazio"><b>Nenhum registro ainda</b><p>Quando você registrar ou confirmar um empréstimo, ele aparece aqui.</p><a class="btn btn-primary" href="#inicio">${ico('plus')}Novo registro</a></div>`;
      return;
    }
    if (!lista.length) { el.innerHTML = '<div class="vazio">Nada com esse filtro.</div>'; return; }
    el.innerHTML = lista.map(r => {
      const recebe = r.papel === 'credor';
      const vencido = r.status === 'validado' && r.dp < dia;
      const quando = r.status === 'quitado' ? 'quitado' : (vencido ? 'venceu ' : 'vence ') + fmt.data(r.dp);
      return `<button class="reg" type="button" data-reg="${esc(r.id)}">
        <span class="reg-ico ${recebe ? 'rec' : 'pag'}">${ico(recebe ? 'baixo' : 'cima')}</span>
        <span class="reg-main"><b>${esc(r.outro)}</b><small>${recebe ? 'Você emprestou' : 'Você deve'} · ${quando}</small></span>
        <span class="reg-side"><b>${fmt.brl(r.total)}</b><span class="chip ${vencido ? 'vencido' : r.status}">${vencido ? 'Vencido' : ROTULO[r.status]}</span></span>
      </button>`;
    }).join('');
  }
  $('#lista').addEventListener('click', async e => {
    const b = e.target.closest('[data-reg]');
    if (!b) return;
    const r = registros.find(x => x.id === b.dataset.reg);
    if (!r) return;
    try { await abrirModelo(await D.lerCodigo(r.codigo)); } catch (err) { const [t, x] = msgDe(err); toast(`${t}: ${x}`); }
  });

  /* ---------------- ajustes ---------------- */
  function renderAjustes() {
    if (!perfil) return;
    $('#perfilNome').textContent = perfil.nome;
    $('#perfilId').textContent = perfil.id;
    $('#avatar').textContent = (perfil.nome.trim()[0] || '?').toUpperCase();
    $('#f-nome-ajuste').value = perfil.nome;
    $$('input[name="ui"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    $$('input[name="tema"]').forEach(i => { i.checked = i.value === temaPref(); });
  }
  $('#formNome').addEventListener('submit', e => {
    e.preventDefault();
    const nome = limparNome($('#f-nome-ajuste').value);
    if (nome.length < 2) return toast('Digite seu nome.');
    perfil = { ...perfil, nome: nome.slice(0, 80) };
    gravarJSON(K.perfil, perfil); renderAjustes(); toast('Nome atualizado.');
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
    if (s1.length < 6) { $('#msgBackup').innerHTML = alertaHTML('Senha curta', 'Use pelo menos 6 caracteres.'); return; }
    if (s1 !== s2) { $('#msgBackup').innerHTML = alertaHTML('Senhas diferentes', 'As duas senhas precisam ser iguais.'); return; }
    const btn = e.submitter || $('#formBackup button'); btn.disabled = true;
    try {
      const codigo = await D.exportarBackup({ tipo: 'debtid-backup', v: 1, perfil, registros, ui: raiz.dataset.ui, tema: lerTexto(K.tema) }, s1);
      $('#codigoBackup').textContent = codigo;
      mostrar('#formBackup', false); mostrar('#saidaBackup', true); $('#msgBackup').innerHTML = '';
      $('#f-bk1').value = $('#f-bk2').value = '';
    } catch (err) {
      const [t, x] = msgDe(err); $('#msgBackup').innerHTML = alertaHTML(t, x);
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
          titulo: 'Trocar de perfil?',
          texto: `Isso troca o perfil atual (ID ${perfil.id}) pelo do backup (ID ${obj.perfil.id}). Os registros dos dois continuam guardados.`,
          ok: 'Trocar'
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
      toast('Backup restaurado.');
      irPara('registros');
    } catch (err) {
      const [t, x] = msgDe(err); msgEl.innerHTML = alertaHTML(t, x);
    } finally { if (btn) btn.disabled = false; }
  }
  $('#formRestaurar').addEventListener('submit', e => {
    e.preventDefault();
    restaurar($('#f-rs-codigo').value, $('#f-rs-senha').value, $('#msgBackup'), e.submitter);
  });
  $('#btnApagar').addEventListener('click', async () => {
    const ok = await perguntar({
      titulo: 'Apagar tudo?',
      texto: 'Seu perfil, sua chave de assinatura e todos os registros saem deste aparelho. Sem backup, não dá para recuperar.',
      ok: 'Apagar tudo', perigo: true
    });
    if (!ok) return;
    try { [K.perfil, K.regs].forEach(k => localStorage.removeItem(k)); } catch { /* ignora */ }
    perfil = null; registros = []; atual = null;
    irPara('boas-vindas');
  });

  /* ---------------- boas-vindas ---------------- */
  function prepararBoasVindas() {
    $$('input[name="ui-bv"]').forEach(i => { i.checked = i.value === raiz.dataset.ui; });
    mostrar('#bv1', true); mostrar('#bv2', false); mostrar('#formRestaurarBV', false); $('#msgBV').innerHTML = '';
  }
  $('#bvContinuar').addEventListener('click', () => {
    aplicarUI(raiz.dataset.ui);
    mostrar('#bv1', false); mostrar('#bv2', true);
    window.scrollTo({ top: 0, behavior: 'instant' });
    setTimeout(() => $('#f-nome').focus(), 50);
  });
  $('#bvVoltar').addEventListener('click', () => { mostrar('#bv2', false); mostrar('#bv1', true); });
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
    if (mostrarErros(nome.length < 2 ? { nome: 'Digite seu nome completo.' } : {}, $('#formPerfil'))) return;
    const btn = $('#btnCriarPerfil'); btn.disabled = true;
    try {
      perfil = await D.criarPerfil(nome.slice(0, 80));
      if (!gravarJSON(K.perfil, perfil)) toast('Atenção: não consegui salvar o perfil neste aparelho.');
      toast('Perfil criado!');
      irPara('inicio');
    } catch (err) {
      const [t, x] = msgDe(err); $('#msgBV').innerHTML = alertaHTML(t, x);
    } finally { btn.disabled = false; }
  });

  /* ---------------- início ---------------- */
  aplicarUI(raiz.dataset.ui);
  aplicarTema();
  verificarLeitor();
  rota();
})();
