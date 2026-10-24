<p align="center"><img src="docs/logo.png" width="120" alt="Logo do DebtID"></p>

# DebtID

Registro de empréstimos assinado pelos dois lados. Calcula juros simples, gera recibo em PDF e um QR code que qualquer pessoa confere em segundos. Tudo roda no aparelho, sem servidor e sem conta online.

## Como funciona

1. **Quem registra** preenche o empréstimo (valor, taxa, datas) e o DebtID gera um código assinado, com QR code.
2. **A outra pessoa** lê o QR no DebtID dela, confere os valores e confirma com a própria assinatura.
3. **Quem registrou** lê o QR de confirmação. Pronto: o registro fica **validado pelos dois**, nos dois celulares.

Funciona nos dois sentidos: tanto quem empresta quanto quem pega emprestado pode registrar primeiro.

## Recursos

- Juros simples (no total, ao mês ou ao ano), com o total sempre arredondado para cima no centavo.
- Recibo com valores por extenso, assinaturas digitais e QR code, pronto para imprimir ou salvar em PDF.
- Histórico com status (aguardando, validado, quitado, vencido) e totais a receber e a pagar.
- Duas aparências, **Profissional** e **Soft**, cada uma com tema claro e escuro.
- Backup do perfil e dos registros protegido por senha.
- No Android: leitor de QR do Google Play Services (sem permissão de câmera) e receber códigos pelo menu *Compartilhar* de outros apps.

## Segurança, sem exagero

- Cada perfil tem um par de chaves **ECDSA P-256** criado no aparelho com a Web Crypto API. A chave privada não sai do aparelho, a não ser no backup cifrado (PBKDF2 + AES-256-GCM).
- O **ID do perfil** (ex.: `7EB1-744C-3B50`) é derivado da chave pública. Confira o ID da outra pessoa uma vez; depois é ele que aparece nos recibos.
- O código de um registro leva os dados do empréstimo e as assinaturas. Qualquer alteração invalida a assinatura; um checksum de 4 caracteres pega erros de digitação.
- Assinatura não é sigilo: quem tem o código consegue ler os dados do empréstimo.
- Não é uma assinatura com certificado oficial (ICP-Brasil). Serve como registro e prova informal do que foi combinado.

## Estrutura

```
web/src/        fonte da página (HTML, CSS e JS, sem dependências)
web/montar.py   junta tudo em um único arquivo
web/dist/       index.html pronto: abre direto no navegador
app/            app Android (WebView que carrega web/dist/index.html)
```

## Como rodar

- **Navegador:** abra `web/dist/index.html`.
- **Depois de editar `web/src`:** `python3 web/montar.py`
- **Android:** `./gradlew assembleRelease` (JDK 17 e Android SDK).
- **GitHub Actions:** cada push na `main` gera o `DebtID.apk` e publica em **Releases**.

## Assinatura do APK

Sem configuração, o Actions assina com uma chave de teste guardada em cache. Para uma chave fixa de produção:

```bash
keytool -genkeypair -keystore debtid.jks -alias debtid -keyalg RSA -keysize 2048 -validity 10950
base64 -w0 debtid.jks   # cole a saída no segredo DEBTID_KEYSTORE_B64
```

Em *Settings → Secrets and variables → Actions*, crie `DEBTID_KEYSTORE_B64` e `DEBTID_KEYSTORE_PASSWORD`. Nunca coloque o `.jks` no repositório.

## Licença

MIT. Veja [LICENSE](LICENSE).
