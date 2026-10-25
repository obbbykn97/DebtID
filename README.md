<p align="center"><img src="docs/logo.png" width="120" alt="DebtID logo"></p>

<h1 align="center">DebtID</h1>

<p align="center"><b>English</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.es.md">Español</a></p>

<p align="center">A loan calculator and IOU in any currency. Both sides sign it, and a QR code lets anyone check the record in seconds.<br>
It works offline, with no account and no server, in 12 languages.</p>

---

## Download

Download `DebtID.apk` from the [releases page](https://github.com/obbbykn97/DebtID-multi/releases/latest) and open the file on your phone to install it. If Android asks, allow installing apps downloaded by the browser.

You can also use it on a computer: download `web/dist/index.html` and open it in a browser.

## How it works

1. The person who records the loan picks the currency and enters the amount, rate and dates. They can also set installments, a late fee and a note. DebtID creates a signed code and shows it as a QR code.
2. The other person scans the QR code in their own DebtID, checks the numbers and confirms with their own signature.
3. The first person scans the confirmation QR code back. The loan is now validated by both sides, on both phones.
4. When money is paid back, the lender signs a receipt and the borrower scans its QR code. The payment shows on both phones, and the borrower keeps the proof.

Either side can start the record.

## Features

### Loans

- More than 150 currencies, plus Bitcoin, Ether and Tether. The currency is part of the signed code, and amounts in different currencies are never added together. The app doesn't convert currencies, since it never goes online.
- Simple or compound interest, per month, per year or once over the whole loan. The total updates as you type and rounds up to the currency's smallest unit (cents, satoshis…).
- Equal installments, a late fee, late interest and a note ("for the car repair"), all inside the signed code.
- A "Just record" option keeps a loan for your own tracking. You can ask the other person to confirm it later.

### Receipts and payments

- The lender signs receipts for partial payments, the settlement and cancellations. A cancellation is for a loan entered by mistake, and you can then create the corrected record.
- Each record shows its balance, installments, late charges and a timeline of the loan.
- The receipt is ready to print or save as a PDF, with both signatures, the payments and the QR code. In English, Portuguese and Spanish it spells out the amounts in words; in the other languages it shows them in figures with the currency's name.

### Keeping track

- Search, sorting, filters (late, paid, cancelled and more), a by-person view and the next due dates.
- Profit by period, with a monthly chart, a spreadsheet of all records (CSV) and a PDF report.
- Due-date reminders on Android, even with the app closed. The lock screen shows a neutral line with no names or amounts.

### Privacy and security

- Contacts recognized by their key. The app tells you when an ID shows up for the first time and warns you about a possible scam when someone uses a contact's name with a different key. A loan can also be tied to a contact's key, so that only that person can confirm it.
- An optional lock, turned on in Settings, with a PIN or, on Android 11 and later, with your fingerprint, face or the phone's screen lock. With the lock on, the signing key is stored encrypted.
- A password-protected backup of your profile, records and contacts. The app reminds you to back up when there are new records.

### Languages and look

- 12 languages, the most spoken in the world according to Ethnologue: English, Mandarin Chinese, Hindi, Spanish, Arabic, French, Bengali, Portuguese, Indonesian, Urdu, Russian and German. Arabic and Urdu read right to left, and the screen mirrors.
- Two looks, *Professional* and *Soft*, each with light and dark themes, a large-text option and 36 app icons to choose from.

## Security

What the signatures guarantee:

- Each profile has an ECDSA P-256 key pair created on the device. The private key only leaves it inside the backup, which is encrypted with AES-256-GCM and a key derived from the password (PBKDF2 with 600,000 rounds).
- A code carries the data and the signatures. If any part changes, the signature no longer matches. The tests change every byte of a code and check that every changed code is refused.
- A receipt points to the loan's fingerprint and must be signed by that loan's lender.

The limits:

- A signature shows which key signed, not who the person is. Anyone can create a profile under any name, so the first time, check the full ID in person or on a video call.
- The record carries the most weight between the two people involved. To an outsider, a code shows that two keys agreed on something; tying a key to a real person takes other evidence.
- Dates come from each phone's clock, and anyone holding a code can read the loan details. The signature prevents changes; it doesn't hide anything.
- Without the lock, the key is protected only by Android's app sandbox. With the PIN lock, it is encrypted with the PIN; if someone copies the data off a rooted phone, a computer can try short PINs, so a longer PIN protects more. With the phone's lock, the key that opens everything lives in Android's security chip and only works after your fingerprint, face or screen lock.
- This is not a certified, legally recognized e-signature. It is an informal record of what two people agreed to, and the law may limit interest and late fees.

To report a security problem, see [SECURITY.md](SECURITY.md).

## For developers

### Project layout

```
web/src/           page source (HTML, CSS and JS, no dependencies; texts in i18n.js)
web/src/idiomas/   texts for the other nine languages, one file each
web/build.py       bundles everything into one file and computes the Content Security Policy
web/dist/          the built index.html, which opens directly in a browser
web/test/          automated tests (node --test)
app/               Android app (a WebView that loads web/dist/index.html)
app/icones/        the icon colors and the script that generates the icon files
docs/              logo
```

### Running it

- After editing `web/src`: `python3 web/build.py`
- Tests: `node --test web/test/*.test.mjs` (Node 20 or later).
- After changing the icon colors: `python3 app/icones/gerar_icones.py`, then `python3 web/build.py`
- Android: `./gradlew assembleRelease` (needs JDK 17 and the Android SDK).
- On GitHub Actions, every push and pull request runs the tests and builds `DebtID.apk`. Pushes to `main` publish it under **Releases** when the signing key is configured.

### Signing the APK

Android only installs an update over an existing app when both versions are signed with the same key. The workflow reads that key from two repository secrets:

| Secret | Value |
| --- | --- |
| `DEBTID_KEYSTORE_B64` | the keystore file, base64-encoded |
| `DEBTID_KEYSTORE_PASSWORD` | the keystore password |

To create your own key (for a fork, for example):

```bash
keytool -genkeypair -keystore debtid.jks -alias debtid -keyalg EC -groupname secp256r1 -validity 10950
base64 -w0 debtid.jks   # paste the output into DEBTID_KEYSTORE_B64
```

Add both under *Settings → Secrets and variables → Actions*. Never commit the `.jks` file. Without the secrets, the workflow still builds a test APK (under *Artifacts*) but doesn't publish a release.

## License

[MIT](LICENSE)
