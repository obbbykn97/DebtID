#!/usr/bin/env python3
"""Bundles web/src (HTML, CSS, texts and JS) into a single self-contained index.html with no external dependencies.

Usage: python3 web/build.py [output path]   (default: web/dist/index.html)
"""
import base64
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'

HEAD = '''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#141414">
<meta name="description" content="DebtID: calculadora e registro de empréstimos assinado pelos dois lados, com QR code. Tudo fica no seu aparelho.">
<meta http-equiv="Content-Security-Policy" content="__CSP__">
<title>DebtID</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' rx='56' fill='%230E0E0E'/%3E%3Cg transform='translate(19.2 19.2) scale(.85)'%3E%3Crect x='64' y='52' width='36' height='152' rx='6' fill='%23fff'/%3E%3Cpath d='M116 52A76 76 0 0 1 116 204V168A40 40 0 0 0 116 88Z' fill='%23fff'/%3E%3Ccircle cx='133' cy='128' r='13' fill='%239DBF3E'/%3E%3C/g%3E%3C/svg%3E">
<script>
(function () { // apply look, theme, text size and language before the first paint (no flash)
  var d = document.documentElement, u, t, l, x, n = (navigator.language || '').toLowerCase().split('-')[0];
  var idiomas = /^(en|zh|hi|es|ar|fr|bn|pt|id|ur|ru|de)$/;
  try { u = localStorage.getItem('debtid.ui'); t = localStorage.getItem('debtid.tema'); l = localStorage.getItem('debtid.idioma'); x = localStorage.getItem('debtid.texto'); } catch (e) {}
  d.setAttribute('data-ui', u === 'soft' || u === 'pro' ? u : 'pro');
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  d.setAttribute('data-theme', t);
  if (x === 'grande') d.setAttribute('data-texto', 'grande');
  if (n === 'in') n = 'id'; // older Android name for Indonesian
  if (!idiomas.test(l)) l = idiomas.test(n) ? n : 'en';
  d.setAttribute('data-lang', l);
  d.lang = { pt: 'pt-BR', zh: 'zh-CN' }[l] || l;
  if (l === 'ar' || l === 'ur') d.dir = 'rtl';
  if (l !== 'pt') d.className += ' i18n-espera'; // page text is written in Portuguese: hide it until it is translated
})();
</script>
'''


def sha(js: str) -> str:
    return "'sha256-" + base64.b64encode(hashlib.sha256(js.encode('utf-8')).digest()).decode() + "'"


def ler(nome: str) -> str:
    return (SRC / nome).read_text(encoding='utf-8')


def textos() -> str:
    """i18n.js, then one file per extra language (web/src/idiomas/*.js), then the call that applies the language."""
    extras = ''.join('\n' + p.read_text(encoding='utf-8') for p in sorted((SRC / 'idiomas').glob('*.js')))
    return '\n' + ler('i18n.js') + extras + '\nDebtIDIdioma.aplicar(document.documentElement.dataset.lang);\n'


def build(target: Path) -> Path:
    scripts = [textos(), '\n/*<core>*/\n' + ler('core.js') + '/*</core>*/\n', '\n' + ler('ui.js')]
    inicio = HEAD.split('<script>', 1)[1].split('</script>', 1)[0]
    # Content Security Policy: only these exact scripts may run (by hash), nothing is loaded from
    # the network, and no injected markup can run code. Inline styles stay allowed.
    csp = ("default-src 'none'; script-src " + ' '.join(sha(x) for x in [inicio] + scripts) +
           "; style-src 'unsafe-inline'; img-src data: blob:; media-src blob: mediastream:; "
           "connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'")
    tags = '\n'.join(f'<script>{js}</script>' for js in scripts)
    html = (HEAD.replace('__CSP__', csp) + '<style>\n' + ler('styles.css') + '</style>\n</head>\n<body>\n' + ler('body.html') +
            '\n' + tags + '\n</body>\n</html>\n')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding='utf-8')
    return target


if __name__ == '__main__':
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'index.html'
    print(build(out), f'{out.stat().st_size / 1024:.1f} KB')
