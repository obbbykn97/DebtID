import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar } from './carregar.mjs';
const D = carregar(), base = { de:20000,dp:20030,parcelas:1,multa:0,mora:0 };
const regras = (p={}) => ({ multaTipo:'nenhuma',multaValor:0,moraTipo:'nenhuma',moraTaxa:0,moraPeriodo:'mes',capitalizacao:'dia',incluirMultaNaBase:false,...p });
const saldo = (terms,hoje,pagamentos=[],total=100000) => D.situacao({...base,encargosAtraso:terms},total,pagamentos,hoje);
test('multa percentual uma vez sobre principal vencido',()=>{
  assert.equal(saldo(regras({multaTipo:'percentual',multaValor:20000}),20030).saldo,100000);
  assert.equal(saldo(regras({multaTipo:'percentual',multaValor:20000}),20031).saldo,102000);
  assert.equal(saldo(regras({multaTipo:'percentual',multaValor:20000}),20060,[{dia:20029,valor:40000}]).saldo,61200);
});
test('multa fixa cobrada uma vez em todas as parcelas',()=>{
  assert.equal(D.situacao({...base,parcelas:3,encargosAtraso:regras({multaTipo:'fixa',multaValor:500})},90000,[],20031).saldo,90500);
});
test('juros simples e compostos mensais, simples diários',()=>{
  assert.equal(saldo(regras({moraTipo:'simples',moraTaxa:100000}),20090).saldo,120000);
  assert.equal(saldo(regras({moraTipo:'composta',moraTaxa:100000,capitalizacao:'mes'}),20090).saldo,121000);
  assert.equal(saldo(regras({moraTipo:'simples',moraTaxa:10000,moraPeriodo:'dia'}),20032).saldo,102000);
});
test('pagamento parcial reduz base e juros futuros',()=>{
  assert.equal(saldo(regras({moraTipo:'simples',moraTaxa:100000}),20090,[{dia:20060,valor:50000}]).saldo,65000);
});
test('cobrança sobre multa exige seleção explícita',()=>{
  const e=regras({multaTipo:'fixa',multaValor:10000,moraTipo:'simples',moraTaxa:100000});
  assert.equal(saldo(e,20060).saldo,120000);
  assert.equal(saldo({...e,incluirMultaNaBase:true},20060).saldo,121000);
});
test('proposta e confirmação v5 assinadas, recibo v4 compatível e contrato v4 preservado',async()=>{
  const ana=await D.criarPerfil('Ana'),bruno=await D.criarPerfil('Bruno');
  const termos=regras({multaTipo:'percentual',multaValor:20000,moraTipo:'composta',moraTaxa:10000});
  const data={papel:'credor',nomeOutro:'Bruno',moeda:'BRL',valor:100000,taxa:0,modo:'mes',composto:false,de:20000,dp:20030};
  const proposta=await D.criarProposta(ana,{...data,encargosAtraso:termos});
  const assinado=await D.lerCodigo(await D.confirmarProposta(bruno,proposta));
  assert.equal(assinado.versao,5);assert.equal(assinado.dados.encargosAtraso.moraTipo,'composta');
  const recibo=await D.lerCodigo(await D.criarRecibo(ana,assinado,{tipo:'pagamento',valor:50000,dia:20030}));
  assert.equal(D.conferirRecibo(assinado,recibo),null);
  assert.equal((await D.lerCodigo(await D.criarProposta(ana,{...data,multa:20000,mora:10000}))).versao,4);
});
test('capitalização diária e mensal diferem; não cobra juros antes do vencimento',()=>{
  const e=regras({moraTipo:'composta',moraTaxa:100000,capitalizacao:'dia'});
  assert.equal(saldo(e,20029).saldo,100000);
  assert.ok(saldo(e,20075).saldo>saldo({...e,capitalizacao:'mes'},20075).saldo);
  assert.equal(saldo(e,20075,[{dia:20030,valor:100000}]).saldo,0);
});
test('juros absurdos geram erro em vez de infinito',()=>{
  assert.throws(()=>saldo(regras({moraTipo:'composta',moraTaxa:10000000,moraPeriodo:'dia'}),20200),RangeError);
});
test('ordem de entrada de pagamentos não muda cálculo',()=>{
  const e=regras({moraTipo:'simples',moraTaxa:10000}),p=[{dia:20042,valor:10000},{dia:20037,valor:30000}];
  assert.equal(saldo(e,20090,p).saldo,saldo(e,20090,p.slice().reverse()).saldo);
});
