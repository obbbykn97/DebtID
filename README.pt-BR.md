<p align="center"><img src="docs/logo.png" width="120" alt="Logo do DebtID"></p>

<h1 align="center">DebtID</h1>

<p align="center"><a href="README.md">English</a> · <b>Português</b></p>

<p align="center">Calculadora e registro de empréstimos em qualquer moeda, que os dois lados assinam, com um QR code que qualquer pessoa confere em segundos.<br>
Tudo roda no aparelho: sem servidor, sem conta e sem acesso à internet.</p>

---

## Como funciona

1. **Quem registra o empréstimo** escolhe a moeda e informa o valor, a taxa e as datas. O DebtID gera um código assinado, mostrado como QR code.
2. **A outra pessoa** lê o QR code no DebtID dela, confere os valores e confirma com a própria assinatura.
3. **Quem registrou** lê de volta o QR code de confirmação. Pronto: o empréstimo fica **validado pelos dois**, nos dois celulares.

Qualquer um dos lados pode começar: quem empresta ou quem pega emprestado.

## Recursos

- **Qualquer moeda**: mais de 150 moedas do mundo, além de Bitcoin (o padrão), Ether e Tether, com busca por nome ou código. A moeda padrão fica em *Ajustes* e dá para trocar em cada empréstimo. A moeda faz parte do código assinado, o total arredonda para cima na menor fração da moeda (centavo, satoshi…) e valores em moedas diferentes nunca são somados. Não há conversão entre moedas: o app funciona sem internet.
- **Juros simples ou compostos**: aplicados uma vez sobre o empréstimo todo, ao mês (mês comercial de 30 dias) ou ao ano, com prévia do total enquanto você digita. O total é sempre arredondado para cima.
- **Recibo** com os valores por extenso, as duas assinaturas digitais e o QR code, pronto para imprimir ou salvar em PDF.
- **Registros** com situação (aguardando, validado, só registro, quitado, vencido) e o total do que você tem a receber e a pagar.
- **Lucro por período**: lucro recebido (empréstimos quitados, pela data do pagamento) e lucro a receber (em aberto, pela data de vencimento), neste mês, neste ano, desde o começo ou entre datas escolhidas. Quem deve vê também os juros pagos e a pagar.
- **Opção "Só registrar"**: guarda o empréstimo para o seu controle sem pedir a confirmação da outra pessoa, e dá para pedir a confirmação depois.
- **Dois idiomas**, português e inglês. O app pergunta na primeira vez que você abre e dá para trocar quando quiser em *Ajustes*.
- **Duas aparências**, *Profissional* e *Soft*, cada uma com tema claro e escuro.
- **Backup protegido por senha** do perfil e dos registros, para trocar de celular e manter o mesmo ID.
- **App Android**: leitura de QR pelo Google Play services (sem permissão de câmera), e dá para receber códigos direto do menu *Compartilhar* de outro app.

## Segurança, sem exagero

- Cada perfil tem um par de chaves **ECDSA P-256** criado no próprio aparelho com a Web Crypto API. A chave privada nunca sai do aparelho, a não ser dentro do backup criptografado (PBKDF2 + AES-256-GCM).
- O **ID do perfil** (por exemplo `7EB1-744C-3B50`) vem da chave pública. Confira o ID da outra pessoa uma vez; daí em diante é ele que aparece nos recibos.
- O código de um empréstimo carrega os dados e as assinaturas. Qualquer alteração invalida a assinatura, e uma conferência de 4 caracteres pega erros de digitação.
- Assinar não é esconder: quem tiver um código consegue ler os dados do empréstimo.
- Não é uma assinatura digital com certificado oficial (ICP-Brasil). É um registro informal e uma prova do que as duas pessoas combinaram.

## Organização do projeto

```
web/src/        código da página (HTML, CSS e JS, sem dependências; textos em i18n.js)
web/build.py    junta tudo em um único arquivo
web/dist/       o index.html pronto, que abre direto no navegador
app/            app Android (uma WebView que carrega web/dist/index.html)
docs/           logo
```

## Como rodar

- **No navegador:** abra `web/dist/index.html`.
- **Depois de editar `web/src`:** `python3 web/build.py`
- **Android:** `./gradlew assembleRelease` (precisa do JDK 17 e do Android SDK).
- **GitHub Actions:** cada push na `main` gera o `DebtID.apk` e, quando a chave de assinatura está configurada, publica em **Releases**.

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
