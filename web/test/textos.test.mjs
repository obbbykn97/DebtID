// Tests for the interface texts (web/src/i18n.js and web/src/idiomas/*.js): no repeated keys, every
// language has the same keys, {placeholders} and HTML tags as Portuguese, and every key the page
// asks for exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fonte = fs.readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const pastaExtras = new URL('../src/idiomas/', import.meta.url);
const extras = (fs.existsSync(pastaExtras) ? fs.readdirSync(pastaExtras) : []).filter(f => f.endsWith('.js')).sort()
  .map(f => ({ k: f.slice(0, -3), texto: fs.readFileSync(new URL(f, pastaExtras), 'utf8') }));
const ui = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const corpo = fs.readFileSync(new URL('../src/body.html', import.meta.url), 'utf8');
const ctx = {};
new Function('ctx', fonte.replace(/const DebtIDIdioma = [\s\S]*$/, '') + '\n' + extras.map(x => x.texto).join('\n') +
  '\nctx.T = DebtIDTextos; ctx.L = DebtIDIdiomas;')(ctx);
const T = ctx.T;
const IDIOMAS = ctx.L.map(x => x.k);

const chavesDe = bloco => [...bloco.matchAll(/^\s*"([^"]+)":\s|,\s*"([^"]+)":\s/gm)].map(m => m[1] || m[2]);
const repetidas = chaves => chaves.filter((k, j) => chaves.indexOf(k) !== j);

test('nenhuma chave repetida (a segunda apagaria a primeira sem aviso)', () => {
  const blocos = fonte.split(/\n  (?:pt|en|es): \{\n/).slice(1);
  assert.equal(blocos.length, 3);
  for (const [i, b] of blocos.entries()) {
    const r = repetidas(chavesDe(b.split('\n  }')[0]));
    assert.deepEqual(r, [], `${['pt', 'en', 'es'][i]}: ${r.join(', ')}`);
  }
  for (const x of extras) {
    const r = repetidas(chavesDe(x.texto));
    assert.deepEqual(r, [], `${x.k}: ${r.join(', ')}`);
  }
});

test('cada idioma da lista tem textos, e cada arquivo de textos está na lista', () => {
  for (const l of IDIOMAS) assert.ok(T[l], `faltam os textos de ${l}`);
  for (const x of extras) {
    assert.ok(IDIOMAS.includes(x.k), `${x.k}.js não está em DebtIDIdiomas`);
    assert.ok(new RegExp(`^DebtIDTextos\\.${x.k} = \\{`, 'm').test(x.texto), `${x.k}.js deve definir DebtIDTextos.${x.k}`);
  }
});

test('todos os idiomas têm as mesmas chaves, {campos} e marcações HTML do português', () => {
  const campos = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  const tags = s => [...String(s).matchAll(/<\/?([a-z]+)/g)].map(m => m[0]).sort().join(',');
  const partes = s => String(s).split('|').length;
  for (const l of IDIOMAS.filter(x => x !== 'pt')) {
    assert.deepEqual(Object.keys(T[l]).filter(k => !(k in T.pt)), [], `${l} tem chaves a mais`);
    assert.deepEqual(Object.keys(T.pt).filter(k => !(k in T[l])), [], `${l} tem chaves a menos`);
    for (const k of Object.keys(T.pt)) {
      assert.equal(campos(T[l][k]), campos(T.pt[k]), `${l} ${k}: campos`);
      assert.equal(tags(T[l][k]), tags(T.pt[k]), `${l} ${k}: marcações`);
      if (k.startsWith('erros.')) assert.equal(partes(T[l][k]), 2, `${l} ${k}: título|texto`);
      assert.ok(String(T[l][k]).trim(), `${l} ${k}: vazio`);
    }
  }
});

test('toda chave usada na página existe', () => {
  const usadas = new Set([
    ...[...ui.matchAll(/\bt\(\s*'([^']+)'\s*[,)]/g)].map(m => m[1]),
    ...[...corpo.matchAll(/data-i18n(?:-html|-ph|-aria)?="([^"]+)"/g)].map(m => m[1])
  ]);
  // only whole keys are checked here (keys built at run time, like t('erros.' + codigo), are not)
  const faltam = [...usadas].filter(k => !(k in T.pt));
  assert.deepEqual(faltam, []);
});
