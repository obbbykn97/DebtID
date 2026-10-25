// Tests for the core: interest math, formatting, signatures, codes and backups.
// Run with: node --test web/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar, hoje } from './carregar.mjs';

const D = carregar();
const I = D._interno;
const dia0 = 20000; // a fixed day (2024-10-04), so the math does not depend on today's date

const base = (extra = {}) => ({ papel: 'credor', nomeOutro: 'Bruno', moeda: 'BRL', valor: 100000, taxa: 50000, modo: 'mes', composto: false, de: dia0, dp: dia0 + 90, ...extra });

test('juros simples ao mês, 90 dias', () => {
  const c = D.calcular({ valor: 100000, taxa: 50000, modo: 'mes', composto: false, de: dia0, dp: dia0 + 90 });
  assert.equal(c.total, 115000);
  assert.equal(c.lucro, 15000);
});

test('juros compostos ao mês arredondam para cima', () => {
  const c = D.calcular({ valor: 100000, taxa: 50000, modo: 'mes', composto: true, de: dia0, dp: dia0 + 90 });
  assert.equal(c.total, 115763); // 1000 × 1.05³ = 1157.625 → 1157.63
});

test('taxa no total e sem juros', () => {
  assert.equal(D.calcular({ valor: 12345, taxa: 100000, modo: 'total', composto: false, de: dia0, dp: dia0 }).total, 13580);
  assert.equal(D.calcular({ valor: 12345, taxa: 0, modo: 'ano', composto: false, de: dia0, dp: dia0 + 400 }).total, 12345);
});

test('juros ao ano usam 365 dias', () => {
  assert.equal(D.calcular({ valor: 36500, taxa: 100000, modo: 'ano', composto: false, de: dia0, dp: dia0 + 365 }).total, 40150);
});

test('o total nunca é menor que o valor e é sempre inteiro', () => {
  for (let v = 1; v < 5000; v += 37) {
    for (const taxa of [0, 1, 999, 12345, 99999, 10000000]) {
      for (const modo of ['total', 'mes', 'ano']) {
        for (const composto of [false, true]) {
          if (composto && modo === 'total') continue;
          const c = D.calcular({ valor: v, taxa, modo, composto, de: dia0, dp: dia0 + 45 });
          assert.ok(Number.isSafeInteger(c.total) && c.total >= v, `${v} ${taxa} ${modo} ${composto}`);
        }
      }
    }
  }
});

test('valores por extenso', () => {
  D.definirIdioma('pt');
  assert.equal(D.extenso(24035, D.MOEDAS.BRL), 'duzentos e quarenta reais e trinta e cinco centavos');
  assert.equal(D.extenso(100, D.MOEDAS.BRL), 'um real');
  assert.equal(D.extenso(200000000, D.MOEDAS.BRL), 'dois milhões de reais');
  D.definirIdioma('en');
  assert.equal(D.extenso(24035, D.MOEDAS.USD), 'two hundred forty US dollars and thirty-five cents');
  D.definirIdioma('pt');
});

test('leitura de números digitados', () => {
  D.definirIdioma('pt');
  assert.equal(D.lerNumero('1.250,50', true), 1250.5);
  assert.equal(D.lerNumero('2,5', false), 2.5);
  assert.equal(D.lerNumero('1.000', true), 1000);
  assert.ok(Number.isNaN(D.lerNumero('abc', true)));
  D.definirIdioma('en');
  assert.equal(D.lerNumero('1,250.50', true), 1250.5);
  D.definirIdioma('pt');
});

test('fluxo completo: proposta, confirmação e leitura', async () => {
  const ana = await D.criarPerfil('Ana'), bruno = await D.criarPerfil('Bruno');
  assert.match(ana.id, /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
  const prop = await D.criarProposta(ana, base());
  const mp = await D.lerCodigo(prop);
  assert.equal(mp.tipo, 'proposta');
  assert.equal(mp.credor.id, ana.id);
  assert.equal(mp.devedor.assinou, false);
  const val = await D.confirmarProposta(bruno, prop);
  const mv = await D.lerCodigo(val);
  assert.equal(mv.tipo, 'validado');
  assert.equal(mv.credor.id, ana.id);
  assert.equal(mv.devedor.id, bruno.id);
  assert.equal(mv.calc.total, 115000);
  assert.equal(mv.idHex, mp.idHex);
});

test('não dá para confirmar a própria proposta', async () => {
  const ana = await D.criarPerfil('Ana');
  const prop = await D.criarProposta(ana, base());
  await assert.rejects(D.confirmarProposta(ana, prop), e => e.codigo === 'PROPRIA');
});

test('qualquer byte alterado é recusado', async () => {
  const ana = await D.criarPerfil('Ana'), bruno = await D.criarPerfil('Bruno');
  const val = await D.confirmarProposta(bruno, await D.criarProposta(ana, base()));
  const { dados } = I.desembalar(val);
  for (let i = 2; i < dados.length; i++) {
    const c = Uint8Array.from(dados); c[i] ^= 1;
    await assert.rejects(D.lerCodigo(I.embalar(c)), undefined, `byte ${i}`);
  }
});

test('código com erro de digitação é detectado pela conferência', async () => {
  const ana = await D.criarPerfil('Ana');
  const prop = await D.criarProposta(ana, base());
  const errado = prop.slice(0, 10) + (prop[10] === 'A' ? 'B' : 'A') + prop.slice(11);
  await assert.rejects(D.lerCodigo(errado), e => e.codigo === 'CHECKSUM');
});

test('o código é encontrado dentro de uma mensagem colada', async () => {
  const ana = await D.criarPerfil('Ana');
  const prop = await D.criarProposta(ana, base());
  // the app's own message, with the code broken across two lines (as some chat apps do)
  const msg = `Ana registrou um empréstimo com você no DebtID.\nPara confirmar, cole este código:\n\n${prop.slice(0, 30)}\n${prop.slice(30)}`;
  assert.equal((await D.lerCodigo(msg)).tipo, 'proposta');
  assert.equal((await D.lerCodigo(`  ${prop}  `)).tipo, 'proposta');
});

test('backup: abre com a senha certa e recusa a errada', async () => {
  const ana = await D.criarPerfil('Ana');
  const bk = await D.exportarBackup({ perfil: ana }, 'uma senha longa');
  assert.equal((await D.importarBackup(bk, 'uma senha longa')).perfil.id, ana.id);
  await assert.rejects(D.importarBackup(bk, 'outra senha'), e => e.codigo === 'SENHA');
});

test('QR code gera um SVG', () => {
  const svg = D.QR.svg('DebtID-teste-123', { nivel: 'M' });
  assert.match(svg, /^<svg[^>]+viewBox="0 0 \d+ \d+"/);
  assert.ok(svg.includes('<path d="M'));
});

test('hoje está num intervalo plausível', () => {
  assert.ok(hoje() > 20000 && hoje() < 120000);
});
