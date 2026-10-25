// Tests for the languages formatted through Intl (zh, hi, ar, fr, bn, id, ur, ru, de): amounts,
// dates, days, rates, currency names, digits typed on other keyboards, and right-to-left text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar } from './carregar.mjs';

const D = carregar();
const { fmt } = D;
const NOVOS = ['zh', 'hi', 'ar', 'fr', 'bn', 'id', 'ur', 'ru', 'de'];
// strips the invisible marks (no-break spaces, bidi isolates and marks) so the text can be compared
const limpo = s => String(s).replace(/[  ]/g, ' ').replace(/[⁦-⁩‎‏؜]/g, '');
const DIA = 20366; // 5 Oct 2025

test('cada idioma novo é aceito, e um idioma desconhecido volta para o português', () => {
  for (const l of NOVOS) assert.equal(D.definirIdioma(l), l);
  assert.equal(D.definirIdioma('xx'), 'pt');
  assert.equal(D.definirIdioma('__proto__'), 'pt');
});

test('valores, datas e prazos usam sempre algarismos latinos', () => {
  for (const l of NOVOS) {
    D.definirIdioma(l);
    const textos = [fmt.dinheiro(123456789, D.MOEDAS.USD), fmt.data(DIA), fmt.dataCurta(DIA), fmt.dataExtenso(DIA),
      fmt.momento(DIA * 86400 + 3600, -12), fmt.dias(45), fmt.taxa(25000), D.extenso(123450, D.MOEDAS.EUR)];
    for (const t of textos) assert.doesNotMatch(t, /[٠-٩۰-۹०-९০-৯]/, `${l}: ${t}`);
  }
  D.definirIdioma('pt');
});

test('formatos de alguns idiomas', () => {
  D.definirIdioma('de');
  assert.equal(limpo(fmt.dinheiro(123456, D.MOEDAS.EUR)), '€ 1.234,56');
  assert.equal(limpo(fmt.data(DIA)), '05.10.2025');
  assert.equal(fmt.dias(5), '5 Tage');
  assert.equal(limpo(fmt.taxaModo(25000, 'mes')), '2,5 % pro Monat');
  D.definirIdioma('ru');
  assert.equal(fmt.dias(5), '5 дней');
  assert.equal(fmt.dias(1), '1 день');
  assert.equal(limpo(D.extenso(123450, D.MOEDAS.EUR)), '1 234,50 евро');
  D.definirIdioma('fr');
  assert.equal(limpo(D.extenso(200, D.MOEDAS.EUR)), '2 euros');
  D.definirIdioma('hi');
  assert.equal(limpo(fmt.dinheiro(1234567800, D.MOEDAS.INR)), '₹ 1,23,45,678.00');
  D.definirIdioma('zh');
  assert.equal(fmt.taxaModo(25000, 'mes'), '2.5%/月');
  assert.equal(fmt.nomeMoeda(D.MOEDAS.BTC), '比特币');
  assert.equal(fmt.nomeMoeda(D.MOEDAS.BRL), '巴西雷亚尔');
  D.definirIdioma('pt');
});

test('moedas que o navegador não conhece aparecem com o código', () => {
  D.definirIdioma('ru');
  assert.equal(limpo(D.extenso(150000000, D.MOEDAS.BTC)), '1,50000000 BTC');
  assert.equal(limpo(D.extenso(250, D.MOEDAS.USDT)), '2,50 USDT');
  D.definirIdioma('pt');
});

test('em árabe e urdu, valores e fuso ficam isolados da direção do texto', () => {
  for (const l of ['ar', 'ur']) {
    D.definirIdioma(l);
    assert.match(fmt.dinheiro(1000, D.MOEDAS.USD), /^⁦.*⁩$/);
    assert.match(D.extenso(1000, D.MOEDAS.USD), /^⁨.*⁩$/); // a phrase: direction from its first letter
    assert.match(fmt.momento(DIA * 86400, -12), /⁦\(UTC−03:00\)⁩$/);
  }
  D.definirIdioma('de');
  assert.doesNotMatch(fmt.dinheiro(1000, D.MOEDAS.USD), /[⁦⁩]/);
  D.definirIdioma('pt');
});

test('números digitados em teclados árabe, urdu, hindi, bengali ou de largura total', () => {
  D.definirIdioma('ar');
  assert.equal(D.lerNumero('١٢٣٫٥'), 123.5);
  assert.equal(D.lerNumero('١٬٢٥٠٫٥٠', true), 1250.5);
  assert.equal(D.lerNumero('٢٫٥٪'), 2.5);
  D.definirIdioma('ur');
  assert.equal(D.lerNumero('۱۲۳'), 123);
  D.definirIdioma('hi');
  assert.equal(D.lerNumero('१,२५०.५०', true), 1250.5);
  D.definirIdioma('bn');
  assert.equal(D.lerNumero('১২৩.৪'), 123.4);
  D.definirIdioma('zh');
  assert.equal(D.lerNumero('１２３．５'), 123.5);
  D.definirIdioma('de');
  assert.equal(D.lerNumero('1.250,50', true), 1250.5);
  assert.equal(D.lerNumero('2,5'), 2.5);
  D.definirIdioma('fr');
  assert.equal(D.lerNumero('1 250,50', true), 1250.5);
  D.definirIdioma('pt');
});

test('os formatos de português, inglês e espanhol não mudaram', () => {
  D.definirIdioma('pt');
  assert.equal(fmt.data(DIA), '05/10/2025');
  assert.equal(fmt.taxaModo(25000, 'mes'), '2,5% ao mês');
  assert.equal(fmt.dinheiro(123456, D.MOEDAS.BRL), 'R$ 1.234,56');
  D.definirIdioma('en');
  assert.equal(fmt.data(DIA), 'Oct 5, 2025');
  assert.equal(fmt.dias(1), '1 day');
  D.definirIdioma('es');
  assert.equal(fmt.taxaModo(25000, 'ano'), '2,5% al año');
  D.definirIdioma('pt');
});
