#!/usr/bin/env python3
"""Bundles web/src (HTML, CSS, texts and JS) into a single self-contained index.html with no external dependencies.

Usage: python3 web/build.py [output path]   (default: web/dist/index.html)
"""
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
<title>DebtID</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='18 18 72 72'%3E%3Crect x='18' y='18' width='72' height='72' rx='16' fill='%230E0E0E'/%3E%3Cg transform='translate(54 54) scale(1.1) translate(-54 -54)'%3E%3Cpath d='M41 37H50A17 17 0 0 1 50 71H41Z' fill='none' stroke='%23fff' stroke-width='8'/%3E%3Ccircle cx='52.5' cy='54' r='4.6' fill='%239DBF3E'/%3E%3C/g%3E%3C/svg%3E">
<script>
(function () { // apply look, theme and language before the first paint (no flash)
  var d = document.documentElement, u, t, l;
  try { u = localStorage.getItem('debtid.ui'); t = localStorage.getItem('debtid.tema'); l = localStorage.getItem('debtid.idioma'); } catch (e) {}
  d.setAttribute('data-ui', u === 'soft' || u === 'pro' ? u : 'pro');
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  d.setAttribute('data-theme', t);
  if (l !== 'pt' && l !== 'en') l = /^pt/i.test(navigator.language || '') ? 'pt' : 'en';
  d.setAttribute('data-lang', l);
  d.lang = l === 'en' ? 'en' : 'pt-BR';
  if (l === 'en') d.className += ' i18n-espera'; // page text is written in Portuguese: hide it until it is translated
})();
</script>
'''


def build(target: Path) -> Path:
    css = (SRC / 'styles.css').read_text(encoding='utf-8')
    body = (SRC / 'body.html').read_text(encoding='utf-8')
    textos = (SRC / 'i18n.js').read_text(encoding='utf-8')
    core = (SRC / 'core.js').read_text(encoding='utf-8')
    ui = (SRC / 'ui.js').read_text(encoding='utf-8')
    html = (HEAD + '<style>\n' + css + '</style>\n</head>\n<body>\n' + body +
            '\n<script>\n' + textos + '</script>\n' +
            '<script>\n/*<core>*/\n' + core + '/*</core>*/\n</script>\n<script>\n' + ui + '</script>\n</body>\n</html>\n')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding='utf-8')
    return target


if __name__ == '__main__':
    import sys
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'index.html'
    print(build(out), f'{out.stat().st_size / 1024:.1f} KB')
