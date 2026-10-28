import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carregar } from './carregar.mjs';
const D=carregar();
async function emprestimo(){
  const credor=await D.criarPerfil('Credor'),devedor=await D.criarPerfil('Devedor'),estranho=await D.criarPerfil('Estranho');
  const p=await D.criarProposta(credor,{papel:'credor',nomeOutro:'Devedor',moeda:'BRL',valor:100000,taxa:0,modo:'mes',composto:false,de:20000,dp:20030});
  return {credor,devedor,estranho,contrato:await D.lerCodigo(await D.confirmarProposta(devedor,p))};
}
test('ambos podem propor, contraparte aprova com assinatura',async()=>{
  const {credor,devedor,contrato}=await emprestimo();
  for(const [a,b] of [[credor,devedor],[devedor,credor]]){
    const pedido=await D.criarSolicitacaoPagamento(a,contrato,{valor:20000,dia:20020});
    const m=await D.lerCodigo(pedido);assert.equal(m.tipo,'solicitacao-pagamento');
    assert.equal(D.conferirMovimento(contrato,m),null);
    const confirmado=await D.lerCodigo(await D.responderSolicitacaoPagamento(b,pedido,true));
    assert.equal(confirmado.tipo,'confirmacao-pagamento');assert.equal(confirmado.aprovado,true);
    assert.equal(D.conferirMovimento(contrato,confirmado),null);assert.equal(confirmado.rid,m.rid);
  }
});
test('pedido pendente e resposta rejeitada não autorizam pagamento',async()=>{
 const {credor,devedor,contrato}=await emprestimo();
 const cod=await D.criarSolicitacaoPagamento(devedor,contrato,{valor:15000,dia:20021});
 const pendente=await D.lerCodigo(cod);assert.equal(pendente.tipo,'solicitacao-pagamento');
 const negado=await D.lerCodigo(await D.responderSolicitacaoPagamento(credor,cod,false));
 assert.equal(negado.tipo,'confirmacao-pagamento');assert.equal(negado.aprovado,false);
 assert.equal(D.conferirMovimento(contrato,negado),null);
});
test('terceiros e próprio solicitante não podem confirmar',async()=>{
 const {credor,devedor,estranho,contrato}=await emprestimo();
 await assert.rejects(()=>D.criarSolicitacaoPagamento(estranho,contrato,{valor:15000,dia:20021}));
 const cod=await D.criarSolicitacaoPagamento(devedor,contrato,{valor:15000,dia:20021});
 assert.notEqual(D.conferirMovimento(contrato,await D.lerCodigo(await D.responderSolicitacaoPagamento(estranho,cod,true))),null);
 await assert.rejects(()=>D.responderSolicitacaoPagamento(devedor,cod,true));
});
test('mensagem de empréstimo diferente é rejeitada',async()=>{
 const {credor,contrato}=await emprestimo(),outro=await emprestimo();
 const cod=await D.criarSolicitacaoPagamento(credor,contrato,{valor:20000,dia:20021});
 assert.notEqual(D.conferirMovimento(outro.contrato,await D.lerCodigo(cod)),null);
});
test('estorno assinado referencia confirmação e não apaga original',async()=>{
 const {credor,devedor,contrato}=await emprestimo();
 const pedido=await D.criarSolicitacaoPagamento(devedor,contrato,{valor:20000,dia:20020});
 const pg=await D.lerCodigo(await D.responderSolicitacaoPagamento(credor,pedido,true));
 const cod=await D.criarSolicitacaoPagamento(credor,contrato,{operacao:'estorno',alvoRid:pg.rid,valor:20000,dia:20020});
 const req=await D.lerCodigo(cod);assert.equal(req.tipo,'solicitacao-estorno');assert.equal(req.alvoRid,pg.rid);
 const resposta=await D.lerCodigo(await D.responderSolicitacaoPagamento(devedor,cod,true));
 assert.equal(resposta.tipo,'confirmacao-estorno');assert.equal(D.conferirMovimento(contrato,resposta),null);
});
