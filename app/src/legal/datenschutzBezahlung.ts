/**
 * Abschnitte für die Datenschutzerklärung (screens/LegalPages.tsx), die mit
 * offener Registrierung und Bewerbungs-Pass dazukommen.
 *
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 *
 * Fassung 2026-10-10 (Prüfteam J1): wie die ganze Datenschutzerklärung in
 * der Sie-Form; an den Code angeglichen (ALTCHA auch bei der öffentlichen
 * Kündigung, nie bezahlte Bestellungen 30 Tage, Zugangscodes, Aufbewahrung
 * wie janitor.js: Bestellungen samt Rechnungsangaben zehn Jahre ab Ende des
 * Zahlungsjahres, nicht zugeordnete Erklärungen drei Jahre). Seit B4
 * (10.10.2026, P1) speichert der Server die Bestätigung „Kauf als
 * Privatperson" mit der Bestellung (orders.consumer_confirmed); sie steht
 * wieder in der Liste. Ebenfalls B4 (P6): Rechnung und Stornobeleg als PDF.
 *
 * Einbau: Früher duzte die Erklärung; seit 2026-10-10 siezt sie. Sie ersetzen
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
  version: '2026-10-10',
  de: {
    sections: [
      {
        id: 'registrierung',
        title: 'Registrierung und Bestätigungsmail',
        paragraphs: [
          'Ein Konto können Sie selbst anlegen. Dafür speichern wir Ihre E-Mail-Adresse, einen Hash Ihres Passworts (bcrypt), den Zeitpunkt der Registrierung und Ihre Bestätigung, dass Sie mindestens 16 Jahre alt sind. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag). Ohne E-Mail-Adresse und Passwort können wir kein Konto anlegen; weitere Angaben sind freiwillig.',
          'Damit niemand fremde Adressen einträgt, schicken wir Ihnen eine Bestätigungsmail mit einem Link. Erst wenn Sie ihn anklicken, gilt die Adresse als bestätigt. Den Zeitpunkt der Bestätigung speichern wir als Nachweis. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und f DSGVO (berechtigtes Interesse, Missbrauch fremder Adressen zu verhindern). Die Mail verschicken wir über unseren Mail-Dienstleister (siehe „Empfänger und Auftragsverarbeiter").',
          'Wird ein Konto nicht innerhalb von 48 Stunden bestätigt und wurde dazu nichts gekauft, löschen wir es mit allen Daten automatisch.',
        ],
      },
      {
        id: 'altcha',
        title: 'Schutz vor automatisierten Anfragen (ALTCHA)',
        paragraphs: [
          'Bei der Registrierung sowie beim öffentlichen Widerrufs- und Kündigungsformular löst Ihr Browser eine kleine Rechenaufgabe (Proof-of-Work, Software ALTCHA). Das läuft auf unserem eigenen Server, ohne Cookie und ohne Drittanbieter; dabei werden keine Daten über Sie gesammelt oder an andere übermittelt. Der Server prüft nur, ob die Aufgabe richtig gelöst wurde, und merkt sich eine gelöste Aufgabe bis zu ihrem Ablauf, damit sie nicht zweimal verwendet wird. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz vor Spam und Missbrauch).',
        ],
      },
      {
        id: 'bestellung',
        title: 'Kauf des Bewerbungs-Passes',
        paragraphs: [
          'Wenn Sie einen Pass kaufen, speichern wir: Bestellnummer, Name für die Rechnung, E-Mail-Adresse, Land, Betrag, Zeitpunkte von Bestellung, Zahlung und Freischaltung, Zahlungsstatus und Zahlungsart, die Kennung der Zahlung bei Mollie, die Rechnungsnummer, die Fassungen der AGB und der Widerrufsbelehrung, die bei der Bestellung galten, Ihre Bestätigung, dass Sie volljährig sind, und bei einem Kauf aus einem anderen EU-Staat als Deutschland Ihre Bestätigung, dass Sie als Privatperson kaufen (Nachweis für die Umsatzsteuer). Die Rechnung und, nach einem Widerruf, den Stornobeleg speichern wir beim Ausstellen einmal als PDF und geben Ihnen später genau diese Dokumente heraus. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und, soweit wir die Daten für Rechnung und Buchhaltung brauchen, Art. 6 Abs. 1 lit. c DSGVO (Pflichten aus dem Steuerrecht).',
          'Das Land brauchen wir, weil sich die Umsatzsteuer bei digitalen Leistungen an Privatkunden im EU-Ausland nach dem Wohnsitzland richten kann. Wir werten die Verkäufe je Land deshalb zusammengefasst aus, um steuerliche Schwellen zu überwachen. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO.',
          'Wir schicken Ihnen per E-Mail die Bestellbestätigung mit Vertragsunterlagen und Rechnung sowie 14 und 3 Tage vor dem Ende des Passes eine Erinnerung. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO; die Bestätigung ist außerdem gesetzlich vorgeschrieben (Art. 6 Abs. 1 lit. c DSGVO, § 312f BGB).',
          'Bestellungen, die nie bezahlt wurden (abgebrochen, fehlgeschlagen, abgelaufen), löschen wir nach 30 Tagen.',
        ],
      },
      {
        id: 'mollie',
        title: 'Zahlungsdienstleister Mollie',
        paragraphs: [
          'Die Zahlung wickelt die Mollie B.V. (Amsterdam, Niederlande) ab, ein in der EU zugelassenes Zahlungsinstitut. Bei der Bestellung übermitteln wir an Mollie nur den Betrag, die Währung, eine Beschreibung mit der Bestellnummer, eine interne Bestellkennung, die Sprache der Bezahlseite und die Adressen, an die Mollie Sie und die Zahlungsbestätigung zurückschickt. Ihren Namen und Ihre E-Mail-Adresse übermitteln wir nicht.',
          'Ihre Zahlungsdaten (zum Beispiel Kartennummer, Kontoverbindung oder PayPal-Konto) geben Sie direkt auf der Zahlungsseite von Mollie ein. Wir bekommen sie nicht zu sehen. Von Mollie erhalten wir nur den Status der Zahlung, die gewählte Zahlungsart und bei einer Erstattung deren Stand.',
          'Mollie verarbeitet Ihre Zahlungsdaten als eigener Verantwortlicher, also nicht in unserem Auftrag, um die Zahlung auszuführen und um eigene gesetzliche Pflichten zu erfüllen, etwa nach dem Geldwäscherecht und den Regeln für Zahlungsdienste. Wählen Sie eine Zahlungsart eines weiteren Anbieters (etwa PayPal oder Apple Pay), ist auch dieser Anbieter für seine Verarbeitung selbst verantwortlich. Einzelheiten stehen in der Datenschutzerklärung von Mollie: https://www.mollie.com/de/privacy. Rechtsgrundlage für die Übermittlung an Mollie: Art. 6 Abs. 1 lit. b DSGVO.',
        ],
      },
      {
        id: 'zugangscodes',
        title: 'Zugangscodes (Gutscheine)',
        paragraphs: [
          'Lösen Sie einen Zugangscode ein, speichern wir in Ihrem Konto, welchen Code (bei persönlichen Codes nur als Hash mit den letzten vier Zeichen) Sie wann eingelöst haben und welchen Zeitraum er freigeschaltet hat. Ein eingegebener Code bleibt bis zu 24 Stunden in Ihrem Browser gemerkt, damit Sie ihn nach der Anmeldung nicht noch einmal eintippen müssen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Löschen Sie Ihr Konto, bleibt nur die Zählung der Einlösung ohne Bezug zu Ihnen stehen.',
        ],
      },
      {
        id: 'widerruf-kuendigung',
        title: 'Widerruf, Kündigung, Erstattung',
        paragraphs: [
          'Widerrufen oder kündigen Sie über unsere Formulare, speichern wir Name, E-Mail-Adresse, Bestellnummer, Inhalt der Erklärung sowie Datum und Uhrzeit des Eingangs und schicken Ihnen eine Eingangsbestätigung. Ohne Anmeldung schicken wir zusätzlich einen Bestätigungslink an die E-Mail-Adresse der Bestellung und speichern dafür nur einen Hash des Links. Bei einem Widerruf veranlassen wir die Erstattung über Mollie und speichern deren Stand. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO (§ 356a und § 312k BGB verlangen Funktion und Bestätigung) und lit. f (Nachweis, dass wir die Erklärung erhalten und bearbeitet haben). Beim öffentlichen Formular nutzen wir zusätzlich ALTCHA und eine Begrenzung der Anfragen nach IP-Adresse wie oben beschrieben.',
          'Erklärungen, die zu einer Bestellung gehören, bewahren wir zusammen mit dieser Bestellung auf (siehe „Aufbewahrung nach dem Kauf"). Erklärungen, die sich keiner Bestellung zuordnen ließen, löschen wir nach drei Jahren (regelmäßige Verjährungsfrist, § 195 BGB).',
        ],
      },
      {
        id: 'aufbewahrung',
        title: 'Aufbewahrung nach dem Kauf, auch nach Löschung des Kontos',
        paragraphs: [
          'Löschen Sie Ihr Konto, löschen wir Lebensläufe, Anschreiben, Fotos, Versionen, Sharelinks, Schlüssel und alle übrigen Kontodaten. Aus Bestellungen behalten wir nur, was das Steuer- und Handelsrecht verlangt oder was wir zum Nachweis des Vertrags brauchen: Bestellnummer, Rechnungsnummer, Name für die Rechnung, E-Mail-Adresse, Land, Betrag, Datum, Zahlungs-, Widerrufs- und Erstattungsstatus sowie die daraus erzeugte Rechnung. Diese Daten sperren wir für jede andere Nutzung.',
          'Die Bestelldaten einschließlich der Rechnungsangaben bewahren wir zehn Jahre auf, gerechnet ab dem Ende des Kalenderjahres, in dem die Zahlung einging (§ 147 Abs. 1, 3 und 4 AO, § 14b Abs. 1 UStG). Danach löschen wir sie automatisch. Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO; das Recht auf Löschung ist insoweit eingeschränkt (Art. 17 Abs. 3 lit. b DSGVO).',
        ],
      },
      {
        id: 'empfaenger-bezahlung',
        title: 'Empfänger beim Kauf',
        paragraphs: [
          'Bestelldaten sehen bei uns nur wir selbst. Empfänger sind Mollie (siehe oben, eigener Verantwortlicher), unser Mail-Dienstleister und unser Server-Anbieter (beide Auftragsverarbeiter, siehe „Empfänger und Auftragsverarbeiter") sowie, soweit gesetzlich verlangt, Finanzbehörden und unsere Steuerberatung. Wir übermitteln Bestelldaten nicht in Länder außerhalb der EU; zu Übermittlungen durch Mollie siehe deren Datenschutzerklärung.',
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
          'To prevent anyone from entering other people\'s addresses, we send you a confirmation e-mail with a link. Only when you click it is the address considered confirmed. We store the time of confirmation as proof. Legal basis: Art. 6(1)(b) and (f) GDPR (legitimate interest in preventing misuse of other people\'s addresses). We send the e-mail via our e-mail service provider (see "Recipients and processors").',
          'If an account is not confirmed within 48 hours and nothing has been bought for it, we delete it automatically together with all its data.',
        ],
      },
      {
        id: 'altcha',
        title: 'Protection against automated requests (ALTCHA)',
        paragraphs: [
          'At registration and on the public withdrawal and cancellation forms, your browser solves a small computing task (proof of work, ALTCHA software). This runs on our own server, without cookies and without third parties; no data about you is collected or passed on. The server only checks whether the task was solved correctly and remembers a solved task until it expires so that it cannot be used twice. Legal basis: Art. 6(1)(f) GDPR (protection against spam and misuse).',
        ],
      },
      {
        id: 'bestellung',
        title: 'Buying the application pass',
        paragraphs: [
          'When you buy a pass, we store: order number, name for the invoice, e-mail address, country, amount, times of order, payment and activation, payment status and method, the payment identifier at Mollie, the invoice number, the versions of the Terms and of the withdrawal information valid at the time of the order, your confirmation that you are of age and, for a purchase from an EU country other than Germany, your confirmation that you are buying as a private individual (evidence for VAT purposes). We store the invoice and, after a withdrawal, the credit note once as a PDF when they are issued and later hand out exactly these documents. Legal basis: Art. 6(1)(b) GDPR (contract) and, insofar as we need the data for invoicing and bookkeeping, Art. 6(1)(c) GDPR (tax law obligations).',
          'We need the country because VAT on digital services to private customers in other EU countries can depend on the country of residence. We therefore evaluate sales per country in aggregated form to monitor tax thresholds. Legal basis: Art. 6(1)(c) GDPR.',
          'We e-mail you the order confirmation with contract documents and invoice, and a reminder 14 and 3 days before the pass ends. Legal basis: Art. 6(1)(b) GDPR; the confirmation is also required by law (Art. 6(1)(c) GDPR, § 312f BGB).',
          'Orders that were never paid (cancelled, failed, expired) are deleted after 30 days.',
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
        id: 'zugangscodes',
        title: 'Access codes (vouchers)',
        paragraphs: [
          'If you redeem an access code, we store in your account which code you redeemed (personal codes only as a hash with the last four characters), when, and which period it unlocked. A code you entered is remembered in your browser for up to 24 hours so that you do not have to type it again after signing in. Legal basis: Art. 6(1)(b) GDPR. If you delete your account, only the count of the redemption remains, without any link to you.',
        ],
      },
      {
        id: 'widerruf-kuendigung',
        title: 'Withdrawal, cancellation, refund',
        paragraphs: [
          'If you withdraw or cancel via our forms, we store name, e-mail address, order number, the content of the declaration and the date and time of receipt and send you an acknowledgement. Without signing in, we additionally send a confirmation link to the e-mail address of the order and store only a hash of that link. For a withdrawal we initiate the refund via Mollie and store its status. Legal basis: Art. 6(1)(c) GDPR (§ 356a and § 312k BGB require the function and the acknowledgement) and (f) (proof that we received and processed the declaration). On the public forms we additionally use ALTCHA and an IP-based rate limit as described above.',
          'Declarations that belong to an order are kept together with that order (see "Retention after purchase"). Declarations that could not be matched to any order are deleted after three years (standard limitation period, § 195 BGB).',
        ],
      },
      {
        id: 'aufbewahrung',
        title: 'Retention after purchase, including after account deletion',
        paragraphs: [
          'If you delete your account, we delete CVs, cover letters, photos, versions, share links, keys and all other account data. From orders we keep only what tax and commercial law require or what we need as proof of the contract: order number, invoice number, invoice name, e-mail address, country, amount, date, payment, withdrawal and refund status, and the invoice generated from them. We block this data for any other use.',
          'We keep order data including the invoice details for ten years, counted from the end of the calendar year in which the payment was received (§ 147(1), (3) and (4) AO, § 14b(1) UStG). After that we delete it automatically. Legal basis: Art. 6(1)(c) GDPR; the right to erasure is restricted to that extent (Art. 17(3)(b) GDPR).',
        ],
      },
      {
        id: 'empfaenger-bezahlung',
        title: 'Recipients when you buy',
        paragraphs: [
          'Only we ourselves see order data. Recipients are Mollie (see above, independent controller), our e-mail service provider and our server provider (both processors, see "Recipients and processors") and, where required by law, tax authorities and our tax adviser. We do not transfer order data to countries outside the EU; for transfers by Mollie, see its privacy policy.',
        ],
      },
    ],
  },
};
