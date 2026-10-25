<p align="center"><img src="docs/logo.png" width="120" alt="DebtID logo"></p>

<h1 align="center">DebtID</h1>

<p align="center"><b>English</b> · <a href="README.pt-BR.md">Português</a></p>

<p align="center">A loan calculator and IOU in any currency that both sides sign — with a QR code anyone can verify in seconds.<br>
Everything runs on the device: no server, no account, no network access.</p>

---

## How it works

1. **The person who records the loan** picks the currency and enters the amount, rate and dates (and, if they want, installments, a late fee and a note). DebtID creates a signed code, shown as a QR code.
2. **The other person** scans the QR code in their own DebtID, checks the numbers and confirms with their own signature.
3. **The first person** scans the confirmation QR code back. Done: the loan is **validated by both sides**, on both phones.
4. **When money is paid back**, the lender signs a **receipt** (a partial payment, the final settlement or a cancellation) and the borrower scans it. The payment then shows on both phones, and the borrower keeps proof of it.

Either side can start: the lender or the borrower.

## Features

- **Any currency**: 150+ world currencies plus Bitcoin (the default), Ether and Tether, with search by name or code. Pick a default in *Settings* and change it for any loan. The currency is part of the signed code, totals round up to the currency's smallest unit (cents, satoshis…) and amounts in different currencies are never added together. There is no conversion between currencies: the app works offline.
- **Simple or compound interest** — applied once over the whole loan, per month (30-day months) or per year, with a live total preview. Totals always round up.
- **Installments, late fee and late interest**: split the total into equal installments with due dates spread up to the payment date; a one-time fee and a monthly interest on what is still unpaid after each due date. All of it is inside the signed code.
- **A note** on the loan ("for the car repair"), also signed.
- **Signed receipts** from the lender: partial payments, settlement and cancellation (for a loan entered by mistake, followed by a corrected one). The balance, each installment and the late charges show on the record.
- **Contacts**: the people whose ID you checked, recognized by their key. DebtID warns you about an ID it has never seen and **warns about a possible scam** when someone uses a contact's name with another key. A loan can be tied to a contact's key so that only that person can confirm it.
- **Receipt** with amounts spelled out, both digital signatures, payments and the QR code, ready to print or save as PDF.
- **Records**: search, sort, filters (late, pending, validated, record only, paid, cancelled), a **by-person** view with what each person owes, the next due dates and a timeline for each loan.
- **Profit by period**: profit received (the share of interest in each payment, by payment date) and profit to receive, for this month, this year, all time or chosen dates, with a **monthly chart** (also as a table). Borrowers also see interest paid and to pay.
- **Export**: a spreadsheet of all records (CSV) and a printable report of the period (PDF).
- **Due-date reminders** on Android, even with the app closed (on the lock screen only a neutral line shows).
- **App lock** with a PIN, and fingerprint or face on Android 10+. The PIN is also asked before backups, restoring and erasing data.
- **Just record** option: save a loan for your own control without asking the other person to confirm, and ask for confirmation later if you want.
- **Three languages**: English, Brazilian Portuguese and Spanish. The app asks on first launch and you can switch any time in *Settings*. Large text option.
- **Two looks**, *Professional* and *Soft*, each with light and dark themes.
- **Password-protected backup** of your profile, records and contacts, with a reminder when you have new records and no recent backup.
- **Android app**: QR scanning through Google Play services (no camera permission), and codes can be received straight from another app's *Share* menu.

## Security, without the hype

What the signatures guarantee:

- Each profile has an **ECDSA P-256** key pair created on the device with the Web Crypto API. The private key never leaves the device, except inside the encrypted backup (PBKDF2 with 600,000 rounds + AES-256-GCM; backups made by older versions still open).
- A code carries the data and the signatures. **Any change invalidates the signature** (the tests change every byte of a code and check that all of them are refused), and a 4-character checksum catches typos. New codes use one canonical signature form, so they cannot be rewritten into a second valid code.
- A receipt is tied to its loan by the loan's fingerprint and must be signed by that loan's lender.

What they don't guarantee, and how the app helps:

- **A signature proves which key signed, not who the person is.** Anyone can create a profile with any name. That is why DebtID shows the **full ID** (24 characters, starting with the short ID in the receipts), keeps **contacts by key**, and warns when an ID is new or when a contact's name shows up with another key. Check the full ID in person, or on a video call, the first time.
- The record is strongest between the two people involved. To a third party (a family member, a judge), a code shows that two keys agreed; tying a key to a real person still depends on other evidence.
- Dates come from each phone's clock.
- Signing is not secrecy: anyone holding a code can read the loan details.
- Codes from the very first version (v1) have no signature. They still open, with a clear warning, and prove nothing.
- The keys are protected by Android's app sandbox, not by extra encryption: a rooted or compromised phone can expose them. The app lock keeps out someone holding your unlocked phone.
- The page runs only its own scripts (a Content Security Policy with script hashes) and the app has no network permission.
- This is not a certified, legally recognized e-signature. It is an informal record and proof of what both people agreed to. The law may limit interest and late fees.

## Project layout

```
web/src/        page source (HTML, CSS and JS, no dependencies; texts in i18n.js)
web/build.py    bundles everything into one file (and computes the Content Security Policy)
web/dist/       the built index.html — opens directly in a browser
web/test/       automated tests of the core (node --test)
app/            Android app (a WebView that loads web/dist/index.html, plus reminders and unlock)
docs/           logo
```

## Running it

- **In a browser:** open `web/dist/index.html`.
- **After editing `web/src`:** `python3 web/build.py`
- **Tests:** `node --test web/test/*.test.mjs` (Node 20+).
- **Android:** `./gradlew assembleRelease` (needs JDK 17 and the Android SDK).
- **GitHub Actions:** every push and pull request runs the tests and builds `DebtID.apk`; pushes to `main` publish it under **Releases** when the signing key is configured.

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
