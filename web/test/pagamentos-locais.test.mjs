import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar } from './carregar.mjs';

const D = carregar();
const dados = { de: 20500, dp: 20530, parcelas: 1, multa: 0, mora: 0 };
const saldo = pagamentos => D.situacao(dados, 100000, D.pagamentosLocaisAtivos(pagamentos), 20515).saldo;

test('pagamentos locais: adicionar, corrigir e anular recalcula o saldo', () => {
  const pagamentos = [{ id: 'p1', dia: 20505, valor: 20000 }];
  assert.equal(saldo(pagamentos), 80000);
  assert.equal(saldo([{ ...pagamentos[0], valor: 15000 }]), 85000);
  assert.equal(saldo([{ ...pagamentos[0], anulado: true }]), 100000);
});

test('pagamentos antigos sem id continuam válidos; anulados nunca entram no saldo', () => {
  assert.equal(saldo([{ dia: 20505, valor: 20000 }, { id: 'p2', dia: 20505, valor: 10000, anulado: true }]), 80000);
});
