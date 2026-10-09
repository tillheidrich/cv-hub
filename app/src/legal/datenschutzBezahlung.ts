/**
 * Abschnitte für die Datenschutzerklärung (screens/LegalPages.tsx), die mit
 * offener Registrierung und Bewerbungs-Pass dazukommen.
 *
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 *
 * Einbau: Die bestehende Erklärung duzt; diese Abschnitte auch. Sie ersetzen
 * den Satz „Konten gibt es derzeit nur mit Einladung" und ergänzen die
 * Abschnitte „Mit Konto" und „Speicherdauer". Wo die bestehende Erklärung
 * schon Mail-Provider und Hoster als Auftragsverarbeiter nennt,
 * nicht doppeln.
 *
 * Belegte Annahmen:
 * - Mollie ist für die Zahlungsdaten EIGENER Verantwortlicher, kein
 *   Auftragsverarbeiter (Mollie-Datenschutzerklärung, Stand 18.07.2026:
 *   „handelt Mollie als Verantwortlicher"; Auftragsverarbeiter nur beim
 *   Rechnungsprodukt). → Kein AVV mit Mollie, aber Nennung als Empfänger.
 * - Aufbewahrung: Rechnungen 8 Jahre (§ 14b Abs. 1 UStG, § 147 Abs. 3 AO in
 *   der Fassung des Vierten Bürokratieentlastungsgesetzes, seit 01.01.2025),
 *   Aufzeichnungen 10 Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO). Fristbeginn: Ende
 *   des Kalenderjahres (§ 147 Abs. 4 AO, § 14b Abs. 1 Satz 3 UStG), NICHT die
 *   Kontolöschung. Das weicht von der ursprünglichen Vorgabe („10 Jahre nach
 *   Kontolöschung") ab — der Server muss nach Kalenderjahr rechnen.
 *
 * Voraussetzungen im Code, damit die Texte stimmen (sonst Text anpassen):
 * - An Mollie gehen nur Betrag, Währung, Beschreibung, Redirect-/Webhook-URL
 *   und die interne Bestell-ID als metadata. KEIN Name, KEINE E-Mail.
 * - Vom Mollie-Payment speichern wir nur ID, Status, Zahlungsart, Zeitpunkte,
 *   Betrag und Erstattungsstatus — keine Karten- oder Kontonummern.
 * - ALTCHA läuft selbst gehostet, ohne Cookie, ohne Drittanbieter.
 * - Janitor löscht unbestätigte Konten ohne Kauf nach 48 h.
 */
import type { Bilingual, LegalSection } from './types';

export interface PrivacyBillingTexts {
  sections: LegalSection[];
}

export const DATENSCHUTZ_BEZAHLUNG: Bilingual<PrivacyBillingTexts> = {
  version: '2026-10-09',
  de: {
    sections: [
      {
        id: 'registrierung',
        title: 'Registrierung und Bestätigungsmail',
        paragraphs: [
          'Ein Konto kannst du selbst anlegen. Dafür speichern wir deine E-Mail-Adresse, einen Hash deines Passworts (bcrypt), den Zeitpunkt der Registrierung und deine Bestätigung, dass du mindestens 16 Jahre alt bist. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag). Ohne E-Mail-Adresse und Passwort können wir kein Konto anlegen; weitere Angaben sind freiwillig.',
          'Damit niemand fremde Adressen einträgt, schicken wir dir eine Bestätigungsmail mit einem Link. Erst wenn du ihn anklickst, gilt die Adresse als bestätigt. Den Zeitpunkt der Bestätigung speichern wir als Nachweis. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO (berechtigtes Interesse, Missbrauch fremder Adressen zu verhindern). Die Mail verschicken wir über unseren Mail-Dienstleister (siehe „Auftragsverarbeiter").',
          'Wird ein Konto nicht innerhalb von 48 Stunden bestätigt und wurde dazu nichts gekauft, löschen wir es mit allen Daten automatisch.',
        ],
      },
      {
        id: 'altcha',
        title: 'Schutz vor automatisierten Anmeldungen (ALTCHA)',
        paragraphs: [
          'Bei Registrierung und beim öffentlichen Widerrufsformular löst dein Browser eine kleine Rechenaufgabe (Proof-of-Work, Software ALTCHA). Das läuft auf unserem eigenen Server, ohne Cookie und ohne Drittanbieter; es werden dabei keine Daten über dich gesammelt oder an andere übermittelt. Der Server prüft nur, ob die Aufgabe richtig gelöst wurde. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz vor Spam und Missbrauch).',
        ],
      },
      {
        id: 'bestellung',
        title: 'Kauf des Bewerbungs-Passes',
        paragraphs: [
          'Wenn du einen Pass kaufst, speichern wir: Bestellnummer, Name für die Rechnung, E-Mail-Adresse, Land, Betrag, Zeitpunkte von Bestellung, Zahlung und Freischaltung, Zahlungsstatus und Zahlungsart, die Kennung der Zahlung bei Mollie, die Rechnungsnummer, die Versionen der AGB und der Widerrufsbelehrung, die zum Zeitpunkt der Bestellung galten, sowie deine Bestätigungen (AGB, Volljährigkeit, bei Käufen aus dem Ausland: Kauf als Privatperson). Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und, soweit wir die Daten für Rechnung und Buchhaltung brauchen, Art. 6 Abs. 1 lit. c DSGVO (Pflichten aus Steuerrecht).',
          'Das Land brauchen wir, weil sich die Umsatzsteuer bei digitalen Leistungen an Privatkunden im EU-Ausland nach dem Wohnsitzland richten kann. Wir werten die Verkäufe je Land deshalb zusammengefasst aus, um steuerliche Schwellen zu überwachen. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO.',
          'Wir schicken dir per E-Mail die Bestellbestätigung mit Vertragsunterlagen und Rechnung sowie 14 und 3 Tage vor dem Ende des Passes eine Erinnerung. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO; die Bestätigung ist außerdem gesetzlich vorgeschrieben (Art. 6 Abs. 1 lit. c DSGVO, § 312f BGB).',
        ],
      },
      {
        id: 'mollie',
        title: 'Zahlungsdienstleister Mollie',
        paragraphs: [
          'Die Zahlung wickelt die Mollie B.V. (Amsterdam, Niederlande) ab, ein in der EU zugelassenes Zahlungsinstitut. Bei der Bestellung übermitteln wir an Mollie nur den Betrag, die Währung, eine Beschreibung mit der Bestellnummer, eine interne Bestellkennung, die Sprache der Bezahlseite und die Adressen, an die Mollie dich und die Zahlungsbestätigung zurückschickt. Deinen Namen und deine E-Mail-Adresse übermitteln wir nicht.',
          'Deine Zahlungsdaten (zum Beispiel Kartennummer, Kontoverbindung oder PayPal-Konto) gibst du direkt auf der Zahlungsseite von Mollie ein. Wir bekommen sie nicht zu sehen. Von Mollie erhalten wir nur den Status der Zahlung, die gewählte Zahlungsart und bei einer Erstattung deren Stand.',
          'Mollie verarbeitet deine Zahlungsdaten als eigener Verantwortlicher, also nicht in unserem Auftrag, um die Zahlung auszuführen und um eigene gesetzliche Pflichten zu erfüllen, etwa nach dem Geldwäscherecht und den Regeln für Zahlungsdienste. Wählst du eine Zahlungsart eines weiteren Anbieters (etwa PayPal oder Apple Pay), ist auch dieser Anbieter für seine Verarbeitung selbst verantwortlich. Einzelheiten stehen in der Datenschutzerklärung von Mollie: https://www.mollie.com/de/privacy. Rechtsgrundlage für die Übermittlung an Mollie: Art. 6 Abs. 1 lit. b DSGVO.',
        ],
      },
      {
        id: 'widerruf-kuendigung',
        title: 'Widerruf, Kündigung, Erstattung',
        paragraphs: [
          'Widerrufst oder kündigst du über unsere Formulare, speichern wir Name, E-Mail-Adresse, Bestellnummer, Inhalt der Erklärung sowie Datum und Uhrzeit des Eingangs und schicken dir eine Eingangsbestätigung. Bei einem Widerruf veranlassen wir die Erstattung über Mollie und speichern deren Stand. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO (§ 356a und § 312k BGB verlangen Funktion und Bestätigung) und lit. f (Nachweis, dass wir die Erklärung erhalten und bearbeitet haben). Beim öffentlichen Formular nutzen wir zusätzlich ALTCHA und eine Begrenzung der Anfragen nach IP-Adresse wie oben beschrieben.',
          'Diese Angaben bewahren wir zusammen mit der zugehörigen Bestellung auf (siehe „Aufbewahrung nach dem Kauf").',
        ],
      },
      {
        id: 'aufbewahrung',
        title: 'Aufbewahrung nach dem Kauf, auch nach Löschung des Kontos',
        paragraphs: [
          'Löschst du dein Konto, löschen wir Lebensläufe, Anschreiben, Fotos, Versionen, Sharelinks, Schlüssel und alle übrigen Kontodaten. Aus Bestellungen behalten wir nur, was das Steuerrecht verlangt: Bestellnummer, Rechnungsnummer, Name für die Rechnung, E-Mail-Adresse, Land, Betrag, Datum, Zahlungs-, Widerrufs- und Erstattungsstatus und die Rechnung selbst. Diese Daten sperren wir für jede andere Nutzung.',
          'Rechnungen bewahren wir acht Jahre auf (§ 14b Abs. 1 UStG, § 147 Abs. 1 Nr. 4, Abs. 3 AO), die übrigen Bestellangaben als Teil unserer Aufzeichnungen zehn Jahre (§ 147 Abs. 1 Nr. 1, Abs. 3 AO). Die Fristen beginnen jeweils mit dem Ende des Kalenderjahres, in dem die Rechnung ausgestellt oder die Bestellung erfasst wurde. Danach löschen wir die Daten. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO; das Recht auf Löschung ist insoweit eingeschränkt (Art. 17 Abs. 3 lit. b DSGVO).',
        ],
      },
      {
        id: 'empfaenger-bezahlung',
        title: 'Empfänger beim Kauf',
        paragraphs: [
          'Bestelldaten sehen bei uns nur wir selbst. Empfänger sind Mollie (siehe oben, eigener Verantwortlicher), unser Mail-Dienstleister und unser Server-Anbieter (beide Auftragsverarbeiter, siehe oben) sowie, soweit gesetzlich verlangt, Finanzbehörden und unsere Steuerberatung. Wir übermitteln Bestelldaten nicht in Länder außerhalb der EU; zu Übermittlungen durch Mollie siehe deren Datenschutzerklärung.',
        ],
      },
    ],
  },
  en: {
    sections: [
      {
        id: 'registrierung',
        title: 'Registration and confirmation e-mail',
        paragraphs: [
          'You can create an account yourself. For this we store your e-mail address, a hash of your password (bcrypt), the time of registration and your confirmation that you are at least 16 years old. Legal basis: Art. 6(1)(b) GDPR (contract of use). We cannot create an account without an e-mail address and password; further details are voluntary.',
          'To prevent anyone from entering other people\'s addresses, we send you a confirmation e-mail with a link. Only when you click it is the address considered confirmed. We store the time of confirmation as proof. Legal basis: Art. 6(1)(b) and (f) GDPR (legitimate interest in preventing misuse of other people\'s addresses). We send the e-mail via our e-mail service provider (see "Processors").',
          'If an account is not confirmed within 48 hours and nothing has been bought for it, we delete it automatically together with all its data.',
        ],
      },
      {
        id: 'altcha',
        title: 'Protection against automated sign-ups (ALTCHA)',
        paragraphs: [
          'At registration and on the public withdrawal form, your browser solves a small computing task (proof of work, ALTCHA software). This runs on our own server, without cookies and without third parties; no data about you is collected or passed on. The server only checks whether the task was solved correctly. Legal basis: Art. 6(1)(f) GDPR (protection against spam and misuse).',
        ],
      },
      {
        id: 'bestellung',
        title: 'Buying the application pass',
        paragraphs: [
          'When you buy a pass, we store: order number, name for the invoice, e-mail address, country, amount, times of order, payment and activation, payment status and method, the payment identifier at Mollie, the invoice number, the versions of the Terms and of the withdrawal information valid at the time of the order, and your confirmations (Terms, being of age, for purchases from abroad: buying as a private individual). Legal basis: Art. 6(1)(b) GDPR (contract) and, insofar as we need the data for invoicing and bookkeeping, Art. 6(1)(c) GDPR (tax law obligations).',
          'We need the country because VAT on digital services to private customers in other EU countries can depend on the country of residence. We therefore evaluate sales per country in aggregated form to monitor tax thresholds. Legal basis: Art. 6(1)(c) GDPR.',
          'We e-mail you the order confirmation with contract documents and invoice, and a reminder 14 and 3 days before the pass ends. Legal basis: Art. 6(1)(b) GDPR; the confirmation is also required by law (Art. 6(1)(c) GDPR, § 312f BGB).',
        ],
      },
      {
        id: 'mollie',
        title: 'Payment provider Mollie',
        paragraphs: [
          'Payments are handled by Mollie B.V. (Amsterdam, Netherlands), a payment institution licensed in the EU. When you order, we only send Mollie the amount, the currency, a description with the order number, an internal order identifier, the language of the payment page and the addresses to which Mollie returns you and the payment confirmation. We do not send your name or e-mail address.',
          'You enter your payment details (for example card number, bank account or PayPal account) directly on Mollie\'s payment page. We never see them. From Mollie we only receive the payment status, the chosen payment method and, for a refund, its status.',
          'Mollie processes your payment data as an independent controller, i.e. not on our behalf, in order to execute the payment and to meet its own legal obligations, for example under anti-money-laundering and payment services rules. If you choose a payment method of another provider (such as PayPal or Apple Pay), that provider is also responsible for its own processing. Details are in Mollie\'s privacy policy: https://www.mollie.com/de/privacy. Legal basis for the transfer to Mollie: Art. 6(1)(b) GDPR.',
        ],
      },
      {
        id: 'widerruf-kuendigung',
        title: 'Withdrawal, cancellation, refund',
        paragraphs: [
          'If you withdraw or cancel via our forms, we store name, e-mail address, order number, the content of the declaration and the date and time of receipt and send you an acknowledgement. For a withdrawal we initiate the refund via Mollie and store its status. Legal basis: Art. 6(1)(c) GDPR (§ 356a and § 312k BGB require the function and the acknowledgement) and (f) (proof that we received and processed the declaration). On the public form we additionally use ALTCHA and an IP-based rate limit as described above.',
          'We keep this information together with the related order (see "Retention after purchase").',
        ],
      },
      {
        id: 'aufbewahrung',
        title: 'Retention after purchase, including after account deletion',
        paragraphs: [
          'If you delete your account, we delete CVs, cover letters, photos, versions, share links, keys and all other account data. From orders we keep only what tax law requires: order number, invoice number, invoice name, e-mail address, country, amount, date, payment, withdrawal and refund status, and the invoice itself. We block this data for any other use.',
          'We keep invoices for eight years (§ 14b(1) UStG, § 147(1) no. 4, (3) AO) and the other order details, as part of our records, for ten years (§ 147(1) no. 1, (3) AO). Each period starts at the end of the calendar year in which the invoice was issued or the order was recorded. After that we delete the data. Legal basis: Art. 6(1)(c) GDPR; the right to erasure is restricted to that extent (Art. 17(3)(b) GDPR).',
        ],
      },
      {
        id: 'empfaenger-bezahlung',
        title: 'Recipients when you buy',
        paragraphs: [
          'Only we ourselves see order data. Recipients are Mollie (see above, independent controller), our e-mail service provider and our server provider (both processors, see above) and, where required by law, tax authorities and our tax adviser. We do not transfer order data to countries outside the EU; for transfers by Mollie, see its privacy policy.',
        ],
      },
    ],
  },
};
