<p align="center"><img src="docs/logo.png" width="120" alt="DebtID logo"></p>

<h1 align="center">DebtID</h1>

<p align="center"><b>English</b> · <a href="README.pt-BR.md">Português</a> · <a href="README.es.md">Español</a></p>

<p align="center">A loan calculator and IOU in any currency. Both sides sign it, and a QR code lets anyone check the record in seconds.<br>
Everything runs on the device, with no server, no account and no network access.</p>

---

## How it works

1. The person who records the loan picks the currency and enters the amount, rate and dates. They can also set installments, a late fee and a note. DebtID creates a signed code and shows it as a QR code.
2. The other person scans the QR code in their own DebtID, checks the numbers and confirms with their own signature.
3. The first person scans the confirmation QR code back. The loan is now validated by both sides, on both phones.
4. When money is paid back, the lender signs a receipt (for a partial payment, the settlement or a cancellation) and the borrower scans it. The payment then shows on both phones, and the borrower keeps the proof.

Either side can start the record.

## Features

- More than 150 currencies, plus Bitcoin (the default), Ether and Tether, with search by name or code. Pick a default in *Settings* and change it for any loan. The currency is part of the signed code. Totals round up to the currency's smallest unit (cents, satoshis…), and amounts in different currencies are never added together. The app doesn't convert currencies, since it never goes online.
- Simple or compound interest, applied once over the whole loan, per month (30-day months) or per year. The total updates as you type.
- Equal installments, with due dates spread out until the payment date. A late fee applies once, and late interest runs per month on whatever is still unpaid after each due date. All of it goes inside the signed code.
- A note on the loan ("for the car repair"), also signed.
- Receipts signed by the lender for partial payments, the settlement and cancellations. A cancellation is for a loan entered by mistake, and you can then create the corrected record. Each record shows its balance, every installment and any late charges.
- Contacts recognized by their key. DebtID tells you when an ID has never shown up before and warns you about a possible scam when someone uses a contact's name with a different key. A loan can also be tied to a contact's key so that only that person can confirm it.
- A receipt with both signatures, the payments and the QR code, ready to print or save as a PDF. In English, Portuguese and Spanish it spells out the amounts in words; in the other languages it shows them in figures with the currency's name.
- A records list with search, sorting and filters (late, pending, validated, record only, paid and cancelled), a by-person view, the next due dates and a timeline for each loan.
- Profit by period. Profit received counts the interest share of each payment, by payment date; profit to receive counts what is still due on open loans. You can view this month, this year, all time or a date range, with a monthly chart that also opens as a table. Borrowers see interest paid and still to pay.
- A spreadsheet of all records (CSV) and a printable report for the period (PDF).
- Due-date reminders on Android, even with the app closed. The lock screen shows a neutral line with no names or amounts.
- An app lock with a PIN, and with fingerprint or face on Android 10 and later. The PIN is also asked before backups, restoring and erasing data.
- A "Just record" option that keeps a loan for your own tracking. You can ask the other person to confirm it later.
- 12 languages, the most spoken in the world according to Ethnologue: English, Mandarin Chinese, Hindi, Spanish, Arabic, French, Bengali, Portuguese, Indonesian, Urdu, Russian and German. Arabic and Urdu read right to left, and the screen mirrors. On first launch the app suggests the phone's language; you can switch in *Settings*, which also has a large-text option.
- Two looks, *Professional* and *Soft*, each with light and dark themes, and 36 app icons to choose from.
- A password-protected backup of your profile, records and contacts. The app reminds you to back up when there are new records.
- On Android, QR codes are scanned through Google Play services (the app asks for no camera permission), and codes can come in from another app's *Share* menu.

## Security

What the signatures guarantee:

- Each profile has an ECDSA P-256 key pair created on the device with the Web Crypto API. The private key only leaves the device inside the backup, which is encrypted with AES-256-GCM and a key derived from the password (PBKDF2 with 600,000 rounds). Backups made by older versions still open.
- A code carries the data and the signatures. If any part changes, the signature no longer matches. The tests change every byte of a code and check that every changed code is refused. A 4-character checksum catches typos. New codes use a single form of signature, so they can't be turned into a second valid code.
- A receipt points to the loan's fingerprint and must be signed by that loan's lender.

The limits:

- A signature shows which key signed. It doesn't show who the person is, and anyone can create a profile under any name. That is why the app shows the full ID (24 characters, starting with the short ID printed on receipts), keeps contacts by key, and warns when an ID is new or when a contact's name shows up with another key. The first time, check the full ID in person or on a video call.
- The record carries the most weight between the two people involved. To an outsider (a relative, a judge), a code shows that two keys agreed on something. Tying a key to a real person takes other evidence.
- Dates come from each phone's clock.
- Anyone holding a code can read the loan details. The signature prevents changes; it doesn't hide anything.
- Codes from the first version (v1) have no signature. They still open, with a warning, and don't count as proof.
- The keys are protected by Android's app sandbox, with no extra encryption on top. A rooted or compromised phone can leak them. The app lock protects against someone holding your unlocked phone.
- The page runs only its own scripts (a Content Security Policy with a hash for each script), and the app has no network permission.
- This is not a certified, legally recognized e-signature. It is an informal record of what two people agreed to. The law may limit interest and late fees.

To report a security problem, see [SECURITY.md](SECURITY.md).

## Project layout

```
web/src/        page source (HTML, CSS and JS, no dependencies; texts in i18n.js)
web/src/idiomas/  texts for the other nine languages, one file each
web/build.py    bundles everything into one file and computes the Content Security Policy
web/dist/       the built index.html, which opens directly in a browser
web/test/       automated tests of the core, the texts and the language formats (node --test)
app/            Android app (a WebView that loads web/dist/index.html, plus reminders, unlock and icons)
app/icones/     the icon colors (icones.json) and the script that generates the icon files
docs/           logo
```

## Running it

- In a browser: open `web/dist/index.html`.
- After editing `web/src`: `python3 web/build.py`
- Tests: `node --test web/test/*.test.mjs` (Node 20 or later).
- After changing the icon colors: `python3 app/icones/gerar_icones.py`, then `python3 web/build.py`
- Android: `./gradlew assembleRelease` (needs JDK 17 and the Android SDK).
- On GitHub Actions, every push and pull request runs the tests and builds `DebtID.apk`. Pushes to `main` publish it under **Releases** when the signing key is configured.

## Signing the APK

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
