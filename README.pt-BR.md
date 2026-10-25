<p align="center"><img src="docs/logo.png" width="120" alt="Logo do DebtID"></p>

<h1 align="center">DebtID</h1>

<p align="center"><a href="README.md">English</a> · <b>Português</b> · <a href="README.es.md">Español</a></p>

<p align="center">Calculadora e registro de empréstimos em qualquer moeda. Os dois lados assinam, e um QR code deixa qualquer pessoa conferir o registro em segundos.<br>
Funciona sem internet, sem conta e sem servidor, em 12 idiomas.</p>

---

## Baixar

Baixe o `DebtID.apk` na página de [versões](https://github.com/obbbykn97/DebtID-multi/releases/latest) e abra o arquivo no celular para instalar. Se o Android pedir, permita a instalação de apps baixados pelo navegador.

Também dá para usar no computador: baixe o arquivo `web/dist/index.html` e abra no navegador.

## Como funciona

1. Quem registra o empréstimo escolhe a moeda e informa o valor, a taxa e as datas. Se quiser, também define parcelas, multa por atraso e uma observação. O DebtID gera um código assinado e mostra o QR code dele.
2. A outra pessoa lê o QR code no DebtID dela, confere os valores e confirma com a própria assinatura.
3. Quem registrou lê de volta o QR code de confirmação. A partir daí, o empréstimo está validado pelos dois, nos dois celulares.
4. Quando o dinheiro volta, quem emprestou assina um recibo e quem deve lê o QR dele. O pagamento aparece nos dois celulares, e quem pagou guarda a prova.

Qualquer um dos dois pode começar o registro.

## Recursos

### Empréstimos

- Mais de 150 moedas, além de Bitcoin, Ether e Tether. A moeda faz parte do código assinado, e valores em moedas diferentes nunca são somados. O app não converte moedas, porque não usa internet.
- Juros simples ou compostos, ao mês, ao ano ou uma vez sobre o total. O total aparece enquanto você digita e é arredondado para cima na menor fração da moeda (centavo, satoshi…).
- Parcelas iguais, multa e juros por atraso e uma observação ("para o conserto do carro"), tudo dentro do código assinado.
- A opção "Só registrar" guarda o empréstimo só para o seu controle. A confirmação da outra pessoa pode ser pedida depois.

### Recibos e pagamentos

- Quem emprestou assina recibos de pagamento parcial, de quitação e de cancelamento. O cancelamento serve para um empréstimo registrado errado, e depois dá para criar o registro corrigido.
- Cada registro mostra o saldo, as parcelas, os encargos e a linha do tempo do empréstimo.
- O recibo sai pronto para imprimir ou salvar em PDF, com as duas assinaturas, os pagamentos e o QR code. Em português, inglês e espanhol, os valores aparecem por extenso; nos outros idiomas, em números com o nome da moeda.

### Organização

- Busca, ordenação, filtros (atrasados, quitados, cancelados e outros), visão por pessoa e próximos vencimentos.
- Lucro por período, com gráfico mês a mês, planilha de todos os registros (CSV) e relatório em PDF.
- Lembretes de vencimento no Android, mesmo com o app fechado. Na tela bloqueada aparece só uma linha neutra, sem nomes nem valores.

### Privacidade e segurança

- Contatos reconhecidos pela chave. O app avisa quando um ID aparece pela primeira vez e alerta para um possível golpe quando alguém usa o nome de um contato com outra chave. Também dá para prender um empréstimo à chave de um contato, e aí só essa pessoa consegue confirmar.
- Trava opcional, ligada em Ajustes, com um PIN ou, no Android 11 ou mais novo, com a digital, o rosto ou o bloqueio de tela do celular. Com a trava ligada, a chave de assinatura fica guardada criptografada.
- Backup com senha do perfil, dos registros e dos contatos. O app lembra de fazer um backup quando há registros novos.

### Idiomas e aparência

- 12 idiomas, os mais falados do mundo segundo o Ethnologue: inglês, chinês (mandarim), hindi, espanhol, árabe, francês, bengali, português, indonésio, urdu, russo e alemão. Em árabe e urdu, que se leem da direita para a esquerda, a tela se espelha.
- Duas aparências, *Profissional* e *Soft*, com tema claro e escuro, opção de texto grande e 36 ícones de app para escolher.

## Segurança

O que as assinaturas garantem:

- Cada perfil tem um par de chaves ECDSA P-256, criado no próprio aparelho. A chave privada só sai dele dentro do backup, que é criptografado com AES-256-GCM e uma chave derivada da senha (PBKDF2 com 600 mil rodadas).
- O código carrega os dados e as assinaturas. Se qualquer parte mudar, a assinatura deixa de valer. Os testes alteram cada byte de um código e conferem que todos os códigos alterados são recusados.
- Um recibo aponta para a impressão digital do empréstimo e precisa ser assinado pelo credor daquele empréstimo.

Os limites:

- A assinatura mostra qual chave assinou, não quem é a pessoa. Qualquer um pode criar um perfil com qualquer nome. Por isso, na primeira vez, confira o ID completo pessoalmente ou numa chamada de vídeo.
- O registro vale mais entre as duas pessoas envolvidas. Para alguém de fora, o código mostra que duas chaves combinaram algo; ligar uma chave a uma pessoa real depende de outras provas.
- As datas vêm do relógio de cada celular, e quem tiver um código consegue ler os dados do empréstimo. A assinatura protege contra alteração, não esconde nada.
- Sem a trava, a chave fica protegida só pelo isolamento de apps do Android. Com a trava por PIN, ela fica criptografada com o PIN; se alguém copiar os dados de um celular com root, um computador consegue testar PINs curtos, então um PIN mais longo protege mais. Com a trava pelo bloqueio do celular, a chave que abre tudo fica no chip de segurança do Android e só funciona depois da digital, do rosto ou do bloqueio de tela.
- Não é uma assinatura digital com certificado oficial (ICP-Brasil). É um registro informal do que as duas pessoas combinaram, e a lei pode limitar juros e multas.

Para avisar sobre uma falha de segurança, veja o [SECURITY.md](SECURITY.md).

## Para quem quer mexer no código

### Organização

```
web/src/           código da página (HTML, CSS e JS, sem dependências; textos em i18n.js)
web/src/idiomas/   textos dos outros nove idiomas, um arquivo por idioma
web/build.py       junta tudo em um único arquivo e calcula a Content Security Policy
web/dist/          o index.html pronto, que abre direto no navegador
web/test/          testes automáticos (node --test)
app/               app Android (uma WebView que carrega web/dist/index.html)
app/icones/        as cores dos ícones e o script que gera os arquivos
docs/              logo
```

### Como rodar

- Depois de editar `web/src`: `python3 web/build.py`
- Testes: `node --test web/test/*.test.mjs` (Node 20 ou mais novo).
- Depois de mudar as cores dos ícones: `python3 app/icones/gerar_icones.py` e `python3 web/build.py`
- Android: `./gradlew assembleRelease` (precisa do JDK 17 e do Android SDK).
- No GitHub Actions, cada push e cada pull request rodam os testes e geram o `DebtID.apk`. Os pushes na `main` publicam o APK em **Releases** quando a chave de assinatura está configurada.

### Assinatura do APK

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

Adicione os dois em *Settings → Secrets and variables → Actions*. Nunca coloque o arquivo `.jks` no repositório. Sem os secrets, o workflow ainda gera um APK de teste (em *Artifacts*), mas não publica uma versão.

## Licença

[MIT](LICENSE)
