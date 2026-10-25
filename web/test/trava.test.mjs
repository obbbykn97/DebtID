// Tests for the signing key under the app lock (chaveTrava in core.js): the data key wrapped with
// the PIN, the profile stored without its private key, and signing again after unlocking.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar, hoje } from './carregar.mjs';

const D = carregar();
const T = D.chaveTrava;
const dia0 = hoje() - 10;
const base = () => ({ papel: 'credor', nomeOutro: 'Bruno', moeda: 'BRL', valor: 100000, taxa: 50000, modo: 'mes', composto: false, de: dia0, dp: dia0 + 90 });
const igual = (a, b) => assert.deepEqual(Array.from(a), Array.from(b));

test('o PIN certo abre a chave de dados; o errado não', async () => {
  const chave = T.novaChaveDados();
  const emb = await T.embrulharComPin('482615', chave);
  assert.equal(emb.it, 600000);
  igual(await T.abrirComPin('482615', emb), chave);
  assert.equal(await T.abrirComPin('482616', emb), null);
  assert.equal(await T.abrirComPin('482615', { ...emb, ct: emb.ct.slice(0, -2) + 'AA' }), null);
  assert.equal(await T.abrirComPin('482615', null), null);
});

test('o perfil guardado fica sem a chave privada, e volta a assinar com a chave de dados', async () => {
  const ana = await D.criarPerfil('Ana Souza');
  const chave = T.novaChaveDados();
  const guardado = await T.protegerPerfil(ana, chave);
  assert.equal(guardado.jwk.d, undefined);
  assert.ok(guardado.dCifrado && guardado.dCifrado.ct);
  assert.doesNotMatch(JSON.stringify(guardado), new RegExp(ana.jwk.d.replace(/[-]/g, '\\-')));
  assert.equal(guardado.pub, ana.pub);
  assert.equal(guardado.id, ana.id);

  const aberto = await T.abrirPerfil(guardado, chave);
  assert.equal(aberto.jwk.d, ana.jwk.d);
  assert.equal(aberto.dCifrado, undefined);
  const prop = await D.criarProposta(aberto, base());
  const lido = await D.lerCodigo(prop);
  assert.equal(lido.tipo, 'proposta');
  assert.equal(lido.credor.id, ana.id); // signed by Ana's key, opened again

  // the wrong data key, or a profile with another public key, does not open it
  assert.equal(await T.abrirPerfil(guardado, T.novaChaveDados()), null);
  const outro = await D.criarPerfil('Bruno');
  assert.equal(await T.abrirPerfil({ ...guardado, pub: outro.pub }, chave), null);
});

test('proteger duas vezes não perde a chave, e um perfil aberto passa direto', async () => {
  const ana = await D.criarPerfil('Ana');
  const chave = T.novaChaveDados();
  const guardado = await T.protegerPerfil(ana, chave);
  assert.equal(await T.protegerPerfil(guardado, chave), guardado);
  assert.equal(await T.abrirPerfil(ana, chave), ana);
});
