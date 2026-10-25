<p align="center"><img src="docs/logo.png" width="120" alt="Logo do DebtID"></p>

<h1 align="center">DebtID</h1>

<p align="center"><a href="README.md">English</a> · <b>Português</b> · <a href="README.es.md">Español</a></p>

<p align="center">Calculadora e registro de empréstimos em qualquer moeda. Os dois lados assinam, e um QR code deixa qualquer pessoa conferir o registro em segundos.<br>
Tudo roda no aparelho, sem servidor, sem conta e sem internet.</p>

---

## Como funciona

1. Quem registra o empréstimo escolhe a moeda e informa o valor, a taxa e as datas. Se quiser, também define parcelas, multa por atraso e uma observação. O DebtID gera um código assinado e mostra o QR code dele.
2. A outra pessoa lê o QR code no DebtID dela, confere os valores e confirma com a própria assinatura.
3. Quem registrou lê de volta o QR code de confirmação. A partir daí, o empréstimo está validado pelos dois, nos dois celulares.
4. Quando o dinheiro volta, quem emprestou assina um recibo (de um pagamento parcial, da quitação ou de um cancelamento) e quem deve lê o QR dele. O pagamento aparece nos dois celulares e quem pagou guarda a prova.

Qualquer um dos dois pode começar o registro.

## Recursos

- Mais de 150 moedas, além de Bitcoin (a moeda padrão), Ether e Tether, com busca por nome ou código. A moeda padrão fica em *Ajustes*, e dá para escolher outra em cada empréstimo. Ela faz parte do código assinado. O total é arredondado para cima na menor fração da moeda (centavo, satoshi…), e valores em moedas diferentes nunca são somados. O app não converte moedas, porque não usa internet.
- Juros simples ou compostos, aplicados uma vez sobre o empréstimo, ao mês (mês comercial de 30 dias) ou ao ano. O total aparece enquanto você digita.
- Parcelas iguais, com vencimentos espalhados até a data de pagamento. A multa por atraso vale uma vez e os juros por atraso correm ao mês sobre o que faltar pagar depois de cada vencimento. Tudo isso vai dentro do código assinado.
- Uma observação no empréstimo ("para o conserto do carro"), também assinada.
- Recibos assinados por quem emprestou: pagamento parcial, quitação e cancelamento. O cancelamento serve para um empréstimo registrado errado, e depois dá para criar o registro corrigido. O registro mostra o saldo, cada parcela e os encargos.
- Contatos reconhecidos pela chave. O DebtID avisa quando um ID nunca apareceu antes e alerta para um possível golpe quando alguém usa o nome de um contato com outra chave. Também dá para prender um empréstimo à chave de um contato, e aí só essa pessoa consegue confirmar.
- Recibo com os valores por extenso, as duas assinaturas, os pagamentos e o QR code, pronto para imprimir ou salvar em PDF.
- Lista de registros com busca, ordenação e filtros (atrasados, aguardando, validados, só registro, quitados e cancelados), visão por pessoa, próximos vencimentos e a linha do tempo de cada empréstimo.
- Lucro por período: o recebido conta a parte dos juros de cada pagamento, pela data do pagamento, e o a receber conta o que falta nos empréstimos em aberto. Dá para ver o mês, o ano, tudo ou um intervalo de datas, com um gráfico mês a mês (que também abre como tabela). Quem deve vê os juros pagos e a pagar.
- Planilha de todos os registros (CSV) e relatório do período para imprimir (PDF).
- Lembretes de vencimento no Android, mesmo com o app fechado. Na tela bloqueada aparece só uma linha neutra, sem nomes nem valores.
- Trava com PIN, e com digital ou rosto no Android 10 ou mais novo. O PIN também é pedido antes de backups, de restaurar e de apagar os dados.
- Opção "Só registrar", que guarda o empréstimo só para o seu controle. A confirmação da outra pessoa pode ser pedida depois.
- Português, inglês e espanhol. O app pergunta o idioma na primeira vez e dá para trocar em *Ajustes*, onde também há a opção de texto grande.
- Duas aparências, *Profissional* e *Soft*, cada uma com tema claro e escuro, e 36 ícones de app para escolher.
- Backup com senha do perfil, dos registros e dos contatos. O app lembra de fazer um backup quando há registros novos.
- No Android, o QR é lido pelo Google Play services (o app não pede permissão de câmera), e os códigos podem chegar pelo menu *Compartilhar* de outro app.

## Segurança

O que as assinaturas garantem:

- Cada perfil tem um par de chaves ECDSA P-256, criado no próprio aparelho com a Web Crypto API. A chave privada só sai do aparelho dentro do backup, que é criptografado com AES-256-GCM e uma chave derivada da senha (PBKDF2 com 600 mil rodadas). Backups feitos por versões anteriores continuam abrindo.
- O código carrega os dados e as assinaturas. Se qualquer parte mudar, a assinatura deixa de valer. Os testes alteram cada byte de um código e conferem que todos os códigos alterados são recusados. Uma conferência de 4 caracteres pega erros de digitação. Os códigos novos usam uma única forma de assinatura, então não dá para transformá-los num segundo código válido.
- Um recibo aponta para a impressão digital do empréstimo e precisa ser assinado pelo credor daquele empréstimo.

Os limites:

- A assinatura mostra qual chave assinou. Ela não mostra quem é a pessoa, e qualquer um pode criar um perfil com qualquer nome. Por isso o app mostra o ID completo (24 caracteres, começando pelo ID curto que aparece nos recibos), guarda os contatos pela chave e avisa quando um ID é novo ou quando o nome de um contato aparece com outra chave. Na primeira vez, confira o ID completo pessoalmente ou numa chamada de vídeo.
- O registro vale mais entre as duas pessoas envolvidas. Para alguém de fora (família, um juiz), o código mostra que duas chaves combinaram algo. Ligar uma chave a uma pessoa real depende de outras provas.
- As datas vêm do relógio de cada celular.
- Quem tiver um código consegue ler os dados do empréstimo. A assinatura protege contra alteração, não esconde nada.
- Os códigos da primeira versão (v1) não têm assinatura. Eles ainda abrem, com um aviso, e não servem como prova.
- As chaves ficam protegidas pelo isolamento de apps do Android, sem uma criptografia extra por cima. Num celular com root ou invadido, elas podem vazar. A trava do app protege contra quem pega o seu celular desbloqueado.
- A página só executa os próprios scripts (Content Security Policy com o hash de cada script) e o app não tem permissão de internet.
- Não é uma assinatura digital com certificado oficial (ICP-Brasil). É um registro informal do que as duas pessoas combinaram. A lei pode limitar juros e multas.

Para avisar sobre uma falha de segurança, veja o [SECURITY.md](SECURITY.md).

## Organização do projeto

```
web/src/        código da página (HTML, CSS e JS, sem dependências; textos em i18n.js)
web/build.py    junta tudo em um único arquivo e calcula a Content Security Policy
web/dist/       o index.html pronto, que abre direto no navegador
web/test/       testes automáticos do núcleo e dos textos (node --test)
app/            app Android (uma WebView que carrega web/dist/index.html, mais lembretes, desbloqueio e ícones)
app/icones/     as cores dos ícones (icones.json) e o script que gera os arquivos
docs/           logo
```

## Como rodar

- No navegador: abra `web/dist/index.html`.
- Depois de editar `web/src`: `python3 web/build.py`
- Testes: `node --test web/test/*.test.mjs` (Node 20 ou mais novo).
- Depois de mudar as cores dos ícones: `python3 app/icones/gerar_icones.py` e `python3 web/build.py`
- Android: `./gradlew assembleRelease` (precisa do JDK 17 e do Android SDK).
- No GitHub Actions, cada push e cada pull request rodam os testes e geram o `DebtID.apk`. Os pushes na `main` publicam o APK em **Releases** quando a chave de assinatura está configurada.

## Assinatura do APK

O Android só instala uma atualização por cima do app quando as duas versões foram assinadas com a mesma chave. O workflow lê essa chave de dois secrets do repositório:

| Secret | Valor |
| --- | --- |
| `DEBTID_KEYSTORE_B64` | o arquivo da keystore em base64 |
| `DEBTID_KEYSTORE_PASSWORD` | a senha da keystore |

Para criar a sua própria chave (num fork, por exemplo):

```bash
keytool -genkeypair -keystore debtid.jks -alias debtid -keyalg EC -groupname secp256r1 -validity 10950
base64 -w0 debtid.jks   # cole a saída em DEBTID_KEYSTORE_B64
```

Adicione os dois em *Settings → Secrets and variables → Actions*. Nunca coloque o arquivo `.jks` no repositório. Sem os secrets, o workflow ainda gera um APK de teste (em *Artifacts*), mas não publica uma release.

## Licença

[MIT](LICENSE)
