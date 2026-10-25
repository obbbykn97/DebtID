<p align="center"><img src="docs/logo.png" width="120" alt="Logo do DebtID"></p>

<h1 align="center">DebtID</h1>

<p align="center"><a href="README.md">English</a> · <b>Português</b></p>

<p align="center">Calculadora e registro de empréstimos em qualquer moeda, que os dois lados assinam, com um QR code que qualquer pessoa confere em segundos.<br>
Tudo roda no aparelho: sem servidor, sem conta e sem acesso à internet.</p>

---

## Como funciona

1. **Quem registra o empréstimo** escolhe a moeda e informa o valor, a taxa e as datas (e, se quiser, parcelas, multa por atraso e uma observação). O DebtID gera um código assinado, mostrado como QR code.
2. **A outra pessoa** lê o QR code no DebtID dela, confere os valores e confirma com a própria assinatura.
3. **Quem registrou** lê de volta o QR code de confirmação. Pronto: o empréstimo fica **validado pelos dois**, nos dois celulares.
4. **Quando o dinheiro é devolvido**, quem emprestou assina um **recibo** (pagamento parcial, quitação ou cancelamento) e quem deve lê o QR dele. O pagamento aparece nos dois celulares, e quem pagou fica com a prova.

Qualquer um dos lados pode começar: quem empresta ou quem pega emprestado.

## Recursos

- **Qualquer moeda**: mais de 150 moedas do mundo, além de Bitcoin (o padrão), Ether e Tether, com busca por nome ou código. A moeda padrão fica em *Ajustes* e dá para trocar em cada empréstimo. A moeda faz parte do código assinado, o total arredonda para cima na menor fração da moeda (centavo, satoshi…) e valores em moedas diferentes nunca são somados. Não há conversão entre moedas: o app funciona sem internet.
- **Juros simples ou compostos**: aplicados uma vez sobre o empréstimo todo, ao mês (mês comercial de 30 dias) ou ao ano, com prévia do total enquanto você digita. O total é sempre arredondado para cima.
- **Parcelas, multa e juros por atraso**: o total é dividido em parcelas iguais, com vencimentos espalhados até a data de pagamento; a multa vale uma vez e os juros por atraso, ao mês, sobre o que faltar pagar depois de cada vencimento. Tudo vai dentro do código assinado.
- **Observação** no empréstimo ("para o conserto do carro"), também assinada.
- **Recibos assinados** por quem emprestou: pagamentos parciais, quitação e cancelamento (para um empréstimo registrado errado, seguido do registro corrigido). O saldo, cada parcela e os encargos aparecem no registro.
- **Contatos**: as pessoas cujo ID você conferiu, reconhecidas pela chave. O DebtID avisa quando um ID é novo e **alerta para possível golpe** quando alguém usa o nome de um contato com outra chave. Um empréstimo pode ficar preso à chave de um contato, para que só essa pessoa consiga confirmar.
- **Recibo** com os valores por extenso, as duas assinaturas digitais, os pagamentos e o QR code, pronto para imprimir ou salvar em PDF.
- **Registros**: busca, ordenação, filtros (atrasados, aguardando, validados, só registro, quitados, cancelados), **visão por pessoa** com quanto cada uma deve, próximos vencimentos e linha do tempo de cada empréstimo.
- **Lucro por período**: lucro recebido (a parte dos juros em cada pagamento, pela data do pagamento) e lucro a receber, neste mês, neste ano, desde o começo ou entre datas escolhidas, com **gráfico mês a mês** (também em tabela). Quem deve vê também os juros pagos e a pagar.
- **Exportar**: planilha de todos os registros (CSV) e relatório do período para imprimir (PDF).
- **Lembretes de vencimento** no Android, mesmo com o app fechado (na tela bloqueada aparece só uma linha neutra).
- **Trava do app** com PIN, e digital ou rosto no Android 10+. O PIN também é pedido antes de backups, restauração e apagar dados.
- **Opção "Só registrar"**: guarda o empréstimo para o seu controle sem pedir a confirmação da outra pessoa, e dá para pedir a confirmação depois.
- **Três idiomas**: português, inglês e espanhol. O app pergunta na primeira vez que você abre e dá para trocar quando quiser em *Ajustes*. Opção de texto grande.
- **Duas aparências**, *Profissional* e *Soft*, cada uma com tema claro e escuro.
- **Backup protegido por senha** do perfil, dos registros e dos contatos, com lembrete quando há registros novos e nenhum backup recente.
- **App Android**: leitura de QR pelo Google Play services (sem permissão de câmera), e dá para receber códigos direto do menu *Compartilhar* de outro app.

## Segurança, sem exagero

O que as assinaturas garantem:

- Cada perfil tem um par de chaves **ECDSA P-256** criado no próprio aparelho com a Web Crypto API. A chave privada nunca sai do aparelho, a não ser dentro do backup criptografado (PBKDF2 com 600 mil rodadas + AES-256-GCM; backups de versões anteriores continuam abrindo).
- O código carrega os dados e as assinaturas. **Qualquer alteração invalida a assinatura** (os testes alteram cada byte de um código e conferem que todos são recusados), e uma conferência de 4 caracteres pega erros de digitação. Códigos novos usam uma única forma de assinatura, então não dá para reescrevê-los num segundo código válido.
- Um recibo fica ligado ao empréstimo pela impressão digital dele e precisa ser assinado pelo credor daquele empréstimo.

O que elas não garantem, e como o app ajuda:

- **A assinatura prova qual chave assinou, não quem é a pessoa.** Qualquer um cria um perfil com qualquer nome. Por isso o DebtID mostra o **ID completo** (24 caracteres, começando pelo ID curto dos recibos), guarda os **contatos pela chave** e avisa quando um ID é novo ou quando o nome de um contato aparece com outra chave. Confira o ID completo pessoalmente, ou numa chamada de vídeo, na primeira vez.
- O registro vale mais entre as duas pessoas envolvidas. Para terceiros (família, um juiz), o código mostra que duas chaves combinaram; ligar uma chave a uma pessoa real ainda depende de outras provas.
- As datas vêm do relógio de cada celular.
- Assinar não é esconder: quem tiver um código consegue ler os dados do empréstimo.
- Códigos da primeira versão (v1) não têm assinatura. Eles ainda abrem, com um aviso claro, e não provam nada.
- As chaves ficam protegidas pelo isolamento de apps do Android, não por uma criptografia extra: um celular com root ou comprometido pode expô-las. A trava do app protege contra quem pega seu celular desbloqueado.
- A página só executa os próprios scripts (Content Security Policy com hash dos scripts) e o app não tem permissão de internet.
- Não é uma assinatura digital com certificado oficial (ICP-Brasil). É um registro informal e uma prova do que as duas pessoas combinaram. A lei pode limitar juros e multas.

## Organização do projeto

```
web/src/        código da página (HTML, CSS e JS, sem dependências; textos em i18n.js)
web/build.py    junta tudo em um único arquivo (e calcula a Content Security Policy)
web/dist/       o index.html pronto, que abre direto no navegador
web/test/       testes automáticos do núcleo (node --test)
app/            app Android (uma WebView que carrega web/dist/index.html, mais lembretes e desbloqueio)
docs/           logo
```

## Como rodar

- **No navegador:** abra `web/dist/index.html`.
- **Depois de editar `web/src`:** `python3 web/build.py`
- **Testes:** `node --test web/test/*.test.mjs` (Node 20 ou mais novo).
- **Android:** `./gradlew assembleRelease` (precisa do JDK 17 e do Android SDK).
- **GitHub Actions:** cada push e pull request roda os testes e gera o `DebtID.apk`; os pushes na `main` publicam em **Releases** quando a chave de assinatura está configurada.

## Assinatura do APK

O Android só instala uma atualização por cima do app quando os dois foram assinados com a mesma chave. O workflow lê essa chave de dois secrets do repositório:

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
