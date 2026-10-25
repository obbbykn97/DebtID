// Tests for the interface texts (web/src/i18n.js): no repeated keys, the three languages have the
// same keys and the same {placeholders}, and every key the page asks for exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fonte = fs.readFileSync(new URL('../src/i18n.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const corpo = fs.readFileSync(new URL('../src/body.html', import.meta.url), 'utf8');
const ctx = {};
new Function('ctx', fonte.replace(/const DebtIDIdioma[\s\S]*$/, '') + '\nctx.T = DebtIDTextos;')(ctx);
const T = ctx.T;
const IDIOMAS = ['pt', 'en', 'es'];

test('nenhuma chave repetida (a segunda apagaria a primeira sem aviso)', () => {
  const blocos = fonte.split(/\n  (?:pt|en|es): \{\n/).slice(1);
  assert.equal(blocos.length, 3);
  for (const [i, b] of blocos.entries()) {
    const chaves = [...b.split('\n  }')[0].matchAll(/"([^"]+)":\s/g)].map(m => m[1]);
    const repetidas = chaves.filter((k, j) => chaves.indexOf(k) !== j);
    assert.deepEqual(repetidas, [], `${IDIOMAS[i]}: ${repetidas.join(', ')}`);
  }
});

test('os três idiomas têm as mesmas chaves e os mesmos {campos}', () => {
  const campos = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  for (const l of ['en', 'es']) {
    assert.deepEqual(Object.keys(T[l]).filter(k => !(k in T.pt)), [], `${l} tem chaves a mais`);
    assert.deepEqual(Object.keys(T.pt).filter(k => !(k in T[l])), [], `${l} tem chaves a menos`);
    for (const k of Object.keys(T.pt)) assert.equal(campos(T[l][k]), campos(T.pt[k]), `${l} ${k}`);
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
