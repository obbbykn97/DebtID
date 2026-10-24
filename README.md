<p align="center"><img src="docs/logo.png" width="120" alt="DebtID logo"></p>

<h1 align="center">DebtID</h1>

<p align="center"><b>English</b> · <a href="README.pt-BR.md">Português</a></p>

<p align="center">A loan calculator and IOU in any currency that both sides sign — with a QR code anyone can verify in seconds.<br>
Everything runs on the device: no server, no account, no network access.</p>

---

## How it works

1. **The person who records the loan** picks the currency and enters the amount, rate and dates. DebtID creates a signed code, shown as a QR code.
2. **The other person** scans the QR code in their own DebtID, checks the numbers and confirms with their own signature.
3. **The first person** scans the confirmation QR code back. Done: the loan is **validated by both sides**, on both phones.

Either side can start: the lender or the borrower.

## Features

- **Any currency**: 150+ world currencies plus Bitcoin (the default), Ether and Tether, with search by name or code. Pick a default in *Settings* and change it for any loan. The currency is part of the signed code, totals round up to the currency's smallest unit (cents, satoshis…) and amounts in different currencies are never added together. There is no conversion between currencies: the app works offline.
- **Simple or compound interest** — applied once over the whole loan, per month (30-day months) or per year, with a live total preview. Totals always round up.
- **Receipt** with amounts spelled out, both digital signatures and the QR code, ready to print or save as PDF.
- **Records** with status (pending, validated, paid, overdue) and running totals of what you are owed and what you owe.
- **Two languages**, English and Brazilian Portuguese. The app asks on first launch and you can switch any time in *Settings*.
- **Two looks**, *Professional* and *Soft*, each with light and dark themes.
- **Password-protected backup** of your profile and records, so you can move to a new phone and keep the same ID.
- **Android app**: QR scanning through Google Play services (no camera permission), and codes can be received straight from another app's *Share* menu.

## Security, without the hype

- Each profile has an **ECDSA P-256** key pair created on the device with the Web Crypto API. The private key never leaves the device, except inside the encrypted backup (PBKDF2 + AES-256-GCM).
- The **profile ID** (e.g. `7EB1-744C-3B50`) is derived from the public key. Check the other person's ID once; from then on it is what appears on receipts.
- A loan code carries the loan data and the signatures. Any change invalidates the signature, and a 4-character checksum catches typos.
- Signing is not secrecy: anyone holding a code can read the loan details.
- This is not a certified, legally recognized e-signature. It is an informal record and proof of what both people agreed to.

## Project layout

```
web/src/        page source (HTML, CSS and JS, no dependencies; texts in i18n.js)
web/build.py    bundles everything into one file
web/dist/       the built index.html — opens directly in a browser
app/            Android app (a WebView that loads web/dist/index.html)
docs/           logo
```

## Running it

- **In a browser:** open `web/dist/index.html`.
- **After editing `web/src`:** `python3 web/build.py`
- **Android:** `./gradlew assembleRelease` (needs JDK 17 and the Android SDK).
- **GitHub Actions:** every push to `main` builds `DebtID.apk` and, when the signing key is configured, publishes it under **Releases**.

## Signing the APK

Android only installs an update over an existing app when both are signed with the same key. The workflow reads that key from two repository secrets:

| Secret | Value |
| --- | --- |
| `DEBTID_KEYSTORE_B64` | the keystore file, base64-encoded |
| `DEBTID_KEYSTORE_PASSWORD` | the keystore password |

To create your own key (for a fork, for example):

```bash
keytool -genkeypair -keystore debtid.jks -alias debtid -keyalg EC -groupname secp256r1 -validity 10950
base64 -w0 debtid.jks   # paste the output into DEBTID_KEYSTORE_B64
```

Add both under *Settings → Secrets and variables → Actions*. Never commit the `.jks` file. Without the secrets, the workflow still builds a test APK (available under *Artifacts*) but does not publish a release.

## License

[MIT](LICENSE)
