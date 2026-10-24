#!/usr/bin/env python3
"""Junta src/ (CSS, HTML e JS) em um único index.html, sem dependências externas."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SRC = RAIZ / 'src'

CABECA = '''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#141414">
<meta name="description" content="DebtID: calculadora e registro de empréstimos assinado pelos dois lados, com QR code. Tudo fica no seu aparelho.">
<title>DebtID</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='18 18 72 72'%3E%3Crect x='18' y='18' width='72' height='72' rx='16' fill='%230E0E0E'/%3E%3Cg transform='translate(54 54) scale(1.1) translate(-54 -54)'%3E%3Cpath d='M41 37H50A17 17 0 0 1 50 71H41Z' fill='none' stroke='%23fff' stroke-width='8'/%3E%3Ccircle cx='52.5' cy='54' r='4.6' fill='%239DBF3E'/%3E%3C/g%3E%3C/svg%3E">
<script>
(function () { // aparência e tema antes da primeira pintura
  var d = document.documentElement, u, t;
  try { u = localStorage.getItem('debtid.ui'); t = localStorage.getItem('debtid.tema'); } catch (e) {}
  d.setAttribute('data-ui', u === 'soft' || u === 'pro' ? u : 'pro');
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  d.setAttribute('data-theme', t);
})();
</script>
'''


def montar(destino: Path) -> Path:
    css = (SRC / 'estilo.css').read_text(encoding='utf-8')
    corpo = (SRC / 'corpo.html').read_text(encoding='utf-8')
    nucleo = (SRC / 'nucleo.js').read_text(encoding='utf-8')
    ui = (SRC / 'ui.js').read_text(encoding='utf-8')
    html = (CABECA + '<style>\n' + css + '</style>\n</head>\n<body>\n' + corpo +
            '\n<script>\n/*<nucleo>*/\n' + nucleo + '/*</nucleo>*/\n</script>\n<script>\n' + ui + '</script>\n</body>\n</html>\n')
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding='utf-8')
    return destino


if __name__ == '__main__':
    import sys
    alvo = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / 'dist' / 'index.html'
    print(montar(alvo), f'{alvo.stat().st_size / 1024:.1f} KB')
