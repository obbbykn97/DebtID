// Tests for the v4 format: notes, installments, late charges, the other person's key,
// receipts, low-s signatures and the stronger backup. Old codes must keep opening.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { carregar } from './carregar.mjs';

const D = carregar();
const I = D._interno;
const F = JSON.parse(fs.readFileSync(new URL('./fixtures-v3.json', import.meta.url), 'utf8'));
const dia0 = 20000;
const local = x => JSON.parse(JSON.stringify(x)); // values from the sandbox, as plain local values
const base = (extra = {}) => ({ papel: 'credor', nomeOutro: 'Bruno', moeda: 'BRL', valor: 30000, taxa: 0, modo: 'mes', composto: false, de: dia0, dp: dia0 + 90, ...extra });
const perfis = async () => ({ ana: await D.criarPerfil('Ana'), bruno: await D.criarPerfil('Bruno'), carla: await D.criarPerfil('Carla') });

test('códigos v3 antigos continuam abrindo', async () => {
  const p = await D.lerCodigo(F.propostaV3), v = await D.lerCodigo(F.validadoV3);
  assert.equal(p.tipo, 'proposta');
  assert.equal(v.tipo, 'validado');
  assert.equal(v.credor.id, F.anaId);
  assert.equal(v.devedor.id, F.brunoId);
  assert.equal(v.calc.total, F.total);
  assert.equal(v.idHex, F.idHex);
  assert.equal(p.hash, v.hash, 'a proposta e o código validado têm a mesma impressão digital');
  assert.equal(v.dados.parcelas, 1);
});

test('backup antigo (v1) continua abrindo', async () => {
  const obj = await D.importarBackup(F.backupV1, F.senhaV1);
  assert.equal(obj.perfil.id, F.anaId);
  assert.equal(obj.registros.length, 1);
});

test('backup novo (v2) usa 600 mil rodadas e abre', async () => {
  const { ana } = await perfis();
  const bk = await D.exportarBackup({ perfil: ana }, 'cavalo bateria grampo correto');
  const b = I.deB64url(bk.slice(5, -5));
  assert.equal(b[4], 2);
  assert.equal((await D.importarBackup(bk, 'cavalo bateria grampo correto')).perfil.id, ana.id);
  await assert.rejects(D.importarBackup(bk, 'cavalo bateria grampo errado'), e => e.codigo === 'SENHA');
});

test('força da senha', () => {
  assert.equal(D.forcaSenha('123456'), 0);
  assert.equal(D.forcaSenha('aaaaaaaaaaaa'), 0);
  assert.ok(D.forcaSenha('Ab1!efghijkl') >= 3);
  assert.ok(D.forcaSenha('cavalo bateria grampo correto') >= 3);
});

test('observação, parcelas, multa e mora vão no código assinado', async () => {
  const { ana, bruno } = await perfis();
  const prop = await D.criarProposta(ana, base({ obs: '  Para o conserto   do carro ', parcelas: 3, multa: 20000, mora: 10000 }));
  const m = await D.lerCodigo(await D.confirmarProposta(bruno, prop));
  assert.equal(m.versao, 4);
  assert.equal(m.dados.obs, 'Para o conserto do carro');
  assert.equal(m.dados.parcelas, 3);
  assert.equal(m.dados.multa, 20000);
  assert.equal(m.dados.mora, 10000);
  const { dados } = I.desembalar(m.codigo);
  for (let i = 2; i < dados.length; i++) {
    const c = Uint8Array.from(dados); c[i] ^= 1;
    await assert.rejects(D.lerCodigo(I.embalar(c)), undefined, `byte ${i}`);
  }
});

test('observação longa demais é recusada', async () => {
  const { ana } = await perfis();
  await assert.rejects(D.criarProposta(ana, base({ obs: 'x'.repeat(281) })), RangeError);
});

test('parcelas precisam de um dia cada e de pelo menos uma unidade cada', async () => {
  const { ana } = await perfis();
  await assert.rejects(D.criarProposta(ana, base({ parcelas: 5, dp: dia0 + 3 })));
  await assert.rejects(D.criarProposta(ana, base({ parcelas: 5, valor: 3 })));
});

test('divisão das parcelas', () => {
  const p = D.parcelasDe({ de: dia0, dp: dia0 + 90, parcelas: 3 }, 30100);
  assert.deepEqual(local(p.map(x => x.valor)), [10033, 10033, 10034]);
  assert.deepEqual(local(p.map(x => x.dia)), [dia0 + 30, dia0 + 60, dia0 + 90]);
  assert.equal(p.reduce((s, x) => s + x.valor, 0), 30100);
  assert.deepEqual(local(D.parcelasDe({ de: dia0, dp: dia0 + 10, parcelas: 1 }, 500)), [{ n: 1, dia: dia0 + 10, valor: 500 }]);
});

test('saldo com pagamentos parciais e sem encargos', () => {
  const d = { de: dia0, dp: dia0 + 90, parcelas: 3, multa: 0, mora: 0 };
  const s = D.situacao(d, 30000, [{ dia: dia0 + 10, valor: 12000 }], dia0 + 40);
  assert.equal(s.pago, 12000);
  assert.equal(s.saldo, 18000);
  assert.equal(s.encargos, 0);
  assert.equal(s.parcelas[0].restante, 0);
  assert.equal(s.parcelas[1].restante, 8000);
  assert.equal(s.proxima.n, 2);
  assert.equal(s.atrasadas, 0);
});

test('multa e mora sobre parcela atrasada', () => {
  // 1 parcela de 10.000 vencida há 30 dias: multa 2% = 200, mora 1% ao mês = 100
  const d = { de: dia0, dp: dia0 + 30, parcelas: 1, multa: 20000, mora: 10000 };
  const s = D.situacao(d, 10000, [], dia0 + 60);
  assert.equal(s.encargos, 300);
  assert.equal(s.saldo, 10300);
  assert.equal(s.atrasadas, 1);
  // pagar em dia não gera encargos
  assert.equal(D.situacao(d, 10000, [{ dia: dia0 + 30, valor: 10000 }], dia0 + 90).saldo, 0);
  // pagar metade com 15 dias de atraso: multa 200 sobre 10.000; mora 50 até o pagamento e 50 depois sobre 5.000
  const p = D.situacao(d, 10000, [{ dia: dia0 + 45, valor: 5000 }], dia0 + 75);
  assert.equal(p.encargos, 300);
  assert.equal(p.saldo, 5300);
  // pagamento acima do principal paga os encargos
  const q = D.situacao(d, 10000, [{ dia: dia0 + 60, valor: 10300 }], dia0 + 120);
  assert.equal(q.saldo, 0);
  assert.equal(q.encargosPagos, 300);
});

test('chave da outra pessoa: só ela pode confirmar', async () => {
  const { ana, bruno, carla } = await perfis();
  const prop = await D.criarProposta(ana, base({ pubOutro: bruno.pub }));
  const mp = await D.lerCodigo(prop);
  assert.equal(mp.devedor.id, bruno.id);
  assert.equal(mp.devedor.assinou, false);
  await assert.rejects(D.confirmarProposta(carla, prop), e => e.codigo === 'OUTRA_PESSOA');
  const mv = await D.lerCodigo(await D.confirmarProposta(bruno, prop));
  assert.equal(mv.devedor.id, bruno.id);
  await assert.rejects(D.criarProposta(ana, base({ pubOutro: ana.pub })), e => e.codigo === 'PROPRIA');
});

test('ID longo começa pelo ID curto', async () => {
  const { ana } = await perfis();
  const longo = await D.idLongoDe(I.deB64url(ana.pub));
  assert.match(longo, /^([0-9A-F]{4}-){5}[0-9A-F]{4}$/);
  assert.ok(longo.startsWith(ana.id));
});

test('assinaturas novas usam o s baixo e o s alto é recusado em códigos v4', async () => {
  const { ana, bruno } = await perfis();
  for (let i = 0; i < 8; i++) {
    const val = await D.confirmarProposta(bruno, await D.criarProposta(ana, base()));
    const { dados } = I.desembalar(val);
    assert.ok(I.sBaixo(dados.slice(-64)));
    const alto = Uint8Array.from(dados);
    const s = BigInt('0x' + Array.from(alto.slice(-32), x => x.toString(16).padStart(2, '0')).join(''));
    const h = (I.ORDEM - s).toString(16).padStart(64, '0');
    for (let k = 0; k < 32; k++) alto[alto.length - 32 + k] = parseInt(h.substr(k * 2, 2), 16);
    await assert.rejects(D.lerCodigo(I.embalar(alto)), e => e.codigo === 'ASSINATURA');
  }
});

test('recibos: pagamento, quitação e cancelamento assinados pelo credor', async () => {
  const { ana, bruno, carla } = await perfis();
  const mv = await D.lerCodigo(await D.confirmarProposta(bruno, await D.criarProposta(ana, base({ parcelas: 3 }))));
  const r1 = await D.lerCodigo(await D.criarRecibo(ana, mv, { tipo: 'pagamento', valor: 10000, dia: dia0 + 30 }));
  assert.equal(r1.tipo, 'recibo');
  assert.equal(r1.hash, mv.hash);
  assert.equal(r1.recibo.valor, 10000);
  assert.equal(r1.recibo.id, ana.id);
  assert.equal(D.conferirRecibo(mv, r1), null);
  const r2 = await D.lerCodigo(await D.criarRecibo(ana, mv, { tipo: 'pagamento', valor: 10000, dia: dia0 + 30 }));
  assert.notEqual(r1.recibo.rid, r2.recibo.rid, 'dois pagamentos iguais geram recibos diferentes');
  const q = await D.lerCodigo(await D.criarRecibo(ana, mv, { tipo: 'quitacao', valor: 0, dia: dia0 + 60 }));
  assert.equal(q.recibo.tipo, 'quitacao');
  const c = await D.lerCodigo(await D.criarRecibo(ana, mv, { tipo: 'cancelamento', valor: 999, dia: dia0 }));
  assert.equal(c.recibo.valor, 0);
  // the debtor cannot sign a receipt for the creditor
  await assert.rejects(D.criarRecibo(bruno, mv, { tipo: 'pagamento', valor: 1, dia: dia0 }), e => e.codigo === 'NAO_CREDOR');
  // a receipt from someone else (Carla, with her own loan) does not match this loan
  const outro = await D.lerCodigo(await D.confirmarProposta(bruno, await D.criarProposta(carla, base())));
  const rc = await D.lerCodigo(await D.criarRecibo(carla, outro, { tipo: 'quitacao', dia: dia0 }));
  assert.equal(D.conferirRecibo(mv, rc), 'OUTRO_EMPRESTIMO');
  // tampering with a receipt is refused
  const { dados } = I.desembalar(r1.codigo);
  for (let i = 2; i < dados.length; i++) {
    const x = Uint8Array.from(dados); x[i] ^= 1;
    await assert.rejects(D.lerCodigo(I.embalar(x)), undefined, `byte ${i}`);
  }
});

test('recibo para empréstimo antigo (v3) também funciona', async () => {
  const obj = await D.importarBackup(F.backupV1, F.senhaV1);
  const mv = await D.lerCodigo(F.validadoV3);
  const r = await D.lerCodigo(await D.criarRecibo(obj.perfil, mv, { tipo: 'quitacao', valor: F.total, dia: 20360 }));
  assert.equal(D.conferirRecibo(mv, r), null);
});

test('PIN: guarda só o hash e confere', async () => {
  const t = await D.hashPin('482916');
  assert.ok(!JSON.stringify(t).includes('482916'));
  assert.equal(await D.conferirPin('482916', t), true);
  assert.equal(await D.conferirPin('482917', t), false);
  assert.equal(await D.conferirPin('482916', null), false);
});
