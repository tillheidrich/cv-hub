/**
 * Mailtexte rund um Konto und Bewerbungs-Pass.
 *
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 *
 * Die Mails verschickt der Server (pdf-service/mail.js). Diese Datei liegt im
 * Frontend-Ordner, damit Texte an einer Stelle gepflegt werden; der Server
 * kann sie per Build-Schritt übernehmen oder die Texte spiegeln. Wer spiegelt,
 * übernimmt `version` mit.
 *
 * Rechtliche Anforderungen je Mail (Wortlaut im Gesetz):
 * - orderConfirmation: Vertragsbestätigung auf dauerhaftem Datenträger,
 *   spätestens bevor die Leistung beginnt (§ 312f Abs. 2 BGB), mit allen
 *   Angaben nach Art. 246a EGBGB → Anhänge: AGB (Fassung der Bestellung),
 *   Widerrufsbelehrung + Muster-Formular, Rechnung. Die Mail im selben Schritt
 *   wie die Freischaltung senden, nicht „später gesammelt".
 * - withdrawalReceipt: unverzüglich, dauerhafter Datenträger, mindestens
 *   Inhalt der Erklärung (Name, Vertrag, Kommunikationsmittel) sowie Datum
 *   und Uhrzeit des Eingangs (§ 356a Abs. 4 BGB). Auch bei Widerruf per Brief
 *   oder freier E-Mail schicken (dann § 356 Abs. 1 S. 2 nicht zwingend, aber
 *   gleiche Behandlung = weniger Fehler).
 * - cancellationReceipt: sofort, Textform, Inhalt, Datum, Uhrzeit des Zugangs,
 *   Beendigungszeitpunkt (§ 312k Abs. 4 BGB).
 * - Uhrzeiten immer mit Zeitzone (Europe/Berlin) und Sekunden.
 * - Absender und Fußzeile: Verkäuferdaten aus Env (SELLER_*).
 */
import type { Bilingual, MailText } from './types';

export interface MailTexts {
  orderConfirmation: MailText;
  /** Liste der Anhänge, damit Mail und Code dieselben Namen benutzen. */
  orderAttachments: string[];
  withdrawalReceipt: MailText;
  refundDone: MailText;
  cancellationReceipt: MailText;
  registrationConfirmation: MailText;
  /** § 37 VSBG: nur senden, wenn eine Streitigkeit nicht beigelegt wurde. */
  disputeUnresolved: MailText;
  footer: string[];
}

export const MAILS: Bilingual<MailTexts> = {
  version: '2026-10-09',
  de: {
    orderConfirmation: {
      subject: 'Bestellbestätigung {{ORDER_NO}} – Ihr Bewerbungs-Pass für {{PRODUCT_NAME}}',
      body: [
        'Guten Tag {{CUSTOMER_NAME}},',
        '',
        'vielen Dank für Ihre Bestellung. Ihre Zahlung ist eingegangen, der Pass ist freigeschaltet. Damit ist der Vertrag geschlossen. Hier sind die Einzelheiten:',
        '',
        'Bestellnummer: {{ORDER_NO}}',
        'Vertragsschluss: {{ORDER_DATE}}',
        'Produkt: {{PRODUCT_NAME}} – Bewerbungs-Pass, {{DAYS}} Tage',
        'Leistungen: Speichern auf unserem Server und Zugriff von mehreren Geräten, Sharelinks, Versionen am Server, KI-Verbindung per MCP, API-Schlüssel',
        'Preis: {{PRICE}} einmalig (Endpreis; gemäß § 19 UStG wird keine Umsatzsteuer berechnet)',
        'Pass gültig bis: {{PASS_UNTIL}}',
        'Ende: automatisch, kein Abo, keine Verlängerung, keine weitere Abbuchung',
        'Rechnungsnummer: {{INVOICE_NO}}',
        '',
        'Widerruf: Sie können den Vertrag bis einschließlich {{WITHDRAWABLE_UNTIL}} ohne Angabe von Gründen widerrufen und erhalten dann den vollen Preis zurück, auch wenn Sie den Pass schon nutzen. Am einfachsten geht das über „Vertrag widerrufen": {{BASE_URL}}/widerruf',
        'Kündigen können Sie jederzeit über „Verträge hier kündigen" in der Fußzeile jeder Seite.',
        '',
        'Es gilt das gesetzliche Mängelhaftungsrecht für digitale Dienstleistungen. Aktualisierungen einschließlich Sicherheitsaktualisierungen stellen wir für die gesamte Laufzeit bereit.',
        '',
        'Im Anhang finden Sie die Rechnung, unsere AGB in der Fassung {{TERMS_VERSION}}, die bei Ihrer Bestellung galt, sowie die Widerrufsbelehrung mit dem Muster-Widerrufsformular. Bitte speichern Sie diese Mail mit den Anhängen. Ihre Bestellungen und Rechnungen finden Sie auch im Konto unter „Mein Pass".',
        '',
        'Fragen? Antworten Sie einfach auf diese Mail oder rufen Sie an: {{SELLER_PHONE}}.',
      ],
    },
    orderAttachments: [
      'Rechnung-{{INVOICE_NO}}.pdf',
      'AGB-{{TERMS_VERSION}}.pdf',
      'Widerrufsbelehrung-und-Muster-Widerrufsformular.pdf',
    ],
    withdrawalReceipt: {
      subject: 'Eingangsbestätigung Ihres Widerrufs – Bestellung {{ORDER_NO}}',
      body: [
        'Guten Tag {{CUSTOMER_NAME}},',
        '',
        'Ihr Widerruf ist bei uns eingegangen.',
        '',
        'Eingang: {{RECEIVED_AT}}',
        'Inhalt Ihrer Erklärung: Widerruf des Vertrags über den Bewerbungs-Pass aus der Bestellung {{ORDER_NO}}',
        'Name: {{CUSTOMER_NAME}}',
        'Bestätigung an: {{CUSTOMER_EMAIL}}',
        '',
        'Erstattung: {{PRICE}}, vollständig, auf dasselbe Zahlungsmittel, mit dem Sie bezahlt haben. Stand: {{REFUND_STATUS}}. Wir zahlen spätestens innerhalb von 14 Tagen ab heute zurück; meist geht es schneller. Ihnen entstehen dafür keine Kosten.',
        '',
        'Der Pass aus dieser Bestellung ist beendet. Ihr Konto und Ihre Inhalte bleiben erhalten; Sie können sie weiter lesen, exportieren und löschen.',
        '',
        'Bitte heben Sie diese Mail als Beleg auf.',
      ],
    },
    refundDone: {
      subject: 'Erstattung ausgeführt – Bestellung {{ORDER_NO}}',
      body: [
        'Guten Tag {{CUSTOMER_NAME}},',
        '',
        'die Erstattung von {{PRICE}} für die Bestellung {{ORDER_NO}} ist ausgeführt. Je nach Zahlungsart sehen Sie den Betrag in einigen Tagen auf Ihrem Konto.',
      ],
    },
    cancellationReceipt: {
      subject: 'Kündigungsbestätigung – Bewerbungs-Pass {{ORDER_NO}}',
      body: [
        'Guten Tag {{CUSTOMER_NAME}},',
        '',
        'wir bestätigen den Eingang Ihrer Kündigung.',
        '',
        'Eingang: {{RECEIVED_AT}}',
        'Vertrag: Bewerbungs-Pass für {{PRODUCT_NAME}}, Bestellung {{ORDER_NO}}',
        'Art der Kündigung: {{CANCEL_KIND}}',
        'Kündigungsgrund: {{CANCEL_REASON}}',
        'Der Vertrag endet am: {{CANCEL_EFFECTIVE}}',
        'Bestätigung an: {{CUSTOMER_EMAIL}}',
        '',
        'Ihr Konto und Ihre Inhalte bleiben erhalten; nach dem Ende können Sie sie weiter lesen, exportieren und löschen.',
        'Bei einer außerordentlichen Kündigung prüfen wir den Grund und melden uns innerhalb von zwei Werktagen zur Erstattung für die restliche Laufzeit.',
        'Bis einschließlich {{WITHDRAWABLE_UNTIL}} können Sie den Vertrag stattdessen auch widerrufen und erhalten dann den vollen Preis zurück: {{BASE_URL}}/widerruf',
        '',
        'Bitte heben Sie diese Mail als Beleg auf.',
      ],
    },
    registrationConfirmation: {
      subject: 'Bitte bestätigen Sie Ihre E-Mail-Adresse für {{PRODUCT_NAME}}',
      body: [
        'Hallo,',
        '',
        'mit dieser E-Mail-Adresse wurde ein Konto bei {{PRODUCT_NAME}} angelegt. Bitte bestätigen Sie die Adresse mit diesem Link:',
        '',
        '{{CONFIRM_URL}}',
        '',
        'Der Link gilt 48 Stunden. Wird die Adresse bis dahin nicht bestätigt und wurde nichts gekauft, löschen wir das Konto mit allen Daten automatisch.',
        '',
        'Sie haben kein Konto angelegt? Dann hat jemand Ihre Adresse eingetragen. Sie müssen nichts tun; das Konto verschwindet nach 48 Stunden von selbst.',
        '',
        'Das Konto ist kostenlos. Es entstehen keine Kosten, solange Sie nicht ausdrücklich einen Pass kaufen.',
      ],
    },
    disputeUnresolved: {
      subject: 'Ihr Anliegen zur Bestellung {{ORDER_NO}}',
      body: [
        'Guten Tag {{CUSTOMER_NAME}},',
        '',
        'leider konnten wir uns in Ihrem Anliegen nicht einigen. Wir sind gesetzlich verpflichtet, Sie auf die zuständige Verbraucherschlichtungsstelle hinzuweisen:',
        '',
        'Universalschlichtungsstelle des Bundes, Zentrum für Schlichtung e. V., Straßburger Straße 8, 77694 Kehl am Rhein, www.universalschlichtungsstelle.de',
        '',
        'Wir sind nicht verpflichtet und nicht bereit, an einem Streitbeilegungsverfahren vor dieser Stelle teilzunehmen.',
      ],
    },
    footer: [
      '{{SELLER_NAME}} · {{SELLER_ADDRESS}}',
      'Telefon {{SELLER_PHONE}} · {{SELLER_EMAIL}}',
      'Kleinunternehmer gemäß § 19 UStG',
    ],
  },
  en: {
    orderConfirmation: {
      subject: 'Order confirmation {{ORDER_NO}} – your application pass for {{PRODUCT_NAME}}',
      body: [
        'Hello {{CUSTOMER_NAME}},',
        '',
        'thank you for your order. Your payment has arrived and the pass is active. The contract is now concluded. Here are the details:',
        '',
        'Order number: {{ORDER_NO}}',
        'Contract concluded: {{ORDER_DATE}}',
        'Product: {{PRODUCT_NAME}} – application pass, {{DAYS}} days',
        'Features: storage on our server and access from several devices, share links, server-side versions, AI connection via MCP, API keys',
        'Price: {{PRICE}} once (final price; no VAT charged under § 19 UStG)',
        'Pass valid until: {{PASS_UNTIL}}',
        'End: automatic, no subscription, no renewal, no further charge',
        'Invoice number: {{INVOICE_NO}}',
        '',
        'Withdrawal: you can withdraw from the contract up to and including {{WITHDRAWABLE_UNTIL}} without giving reasons and will get the full price back, even if you are already using the pass. The easiest way is "Withdraw from contract": {{BASE_URL}}/widerruf',
        'You can cancel at any time via "Cancel contracts here" in the footer of every page.',
        '',
        'The statutory liability for defects for digital services applies. We provide updates, including security updates, for the entire term.',
        '',
        'Attached are the invoice, our Terms in version {{TERMS_VERSION}} valid at the time of your order, and the withdrawal information with the model withdrawal form. Please keep this e-mail and its attachments. You can also find your orders and invoices in your account under "My pass".',
        '',
        'Questions? Just reply to this e-mail or call: {{SELLER_PHONE}}.',
        '',
        'This English text is a reading aid; the German version is binding.',
      ],
    },
    orderAttachments: [
      'Invoice-{{INVOICE_NO}}.pdf',
      'Terms-{{TERMS_VERSION}}.pdf',
      'Withdrawal-information-and-model-form.pdf',
    ],
    withdrawalReceipt: {
      subject: 'Acknowledgement of your withdrawal – order {{ORDER_NO}}',
      body: [
        'Hello {{CUSTOMER_NAME}},',
        '',
        'we have received your withdrawal.',
        '',
        'Received: {{RECEIVED_AT}}',
        'Content of your declaration: withdrawal from the contract for the application pass from order {{ORDER_NO}}',
        'Name: {{CUSTOMER_NAME}}',
        'Acknowledgement to: {{CUSTOMER_EMAIL}}',
        '',
        'Refund: {{PRICE}}, in full, to the same means of payment you used. Status: {{REFUND_STATUS}}. We refund within 14 days from today at the latest; usually faster. You incur no costs for this.',
        '',
        'The pass from this order has ended. Your account and your content remain; you can still read, export and delete them.',
        '',
        'Please keep this e-mail as a record.',
      ],
    },
    refundDone: {
      subject: 'Refund completed – order {{ORDER_NO}}',
      body: [
        'Hello {{CUSTOMER_NAME}},',
        '',
        'the refund of {{PRICE}} for order {{ORDER_NO}} has been carried out. Depending on the payment method, you will see it in your account within a few days.',
      ],
    },
    cancellationReceipt: {
      subject: 'Cancellation confirmation – application pass {{ORDER_NO}}',
      body: [
        'Hello {{CUSTOMER_NAME}},',
        '',
        'we confirm receipt of your cancellation.',
        '',
        'Received: {{RECEIVED_AT}}',
        'Contract: application pass for {{PRODUCT_NAME}}, order {{ORDER_NO}}',
        'Type of cancellation: {{CANCEL_KIND}}',
        'Reason: {{CANCEL_REASON}}',
        'The contract ends on: {{CANCEL_EFFECTIVE}}',
        'Confirmation to: {{CUSTOMER_EMAIL}}',
        '',
        'Your account and your content remain; after the end you can still read, export and delete them.',
        'For an extraordinary cancellation we check the reason and get back to you within two working days about a refund for the remaining term.',
        'Up to and including {{WITHDRAWABLE_UNTIL}} you can instead withdraw from the contract and get the full price back: {{BASE_URL}}/widerruf',
        '',
        'Please keep this e-mail as a record.',
      ],
    },
    registrationConfirmation: {
      subject: 'Please confirm your e-mail address for {{PRODUCT_NAME}}',
      body: [
        'Hello,',
        '',
        'an account at {{PRODUCT_NAME}} has been created with this e-mail address. Please confirm the address with this link:',
        '',
        '{{CONFIRM_URL}}',
        '',
        'The link is valid for 48 hours. If the address is not confirmed by then and nothing was bought, we delete the account and all its data automatically.',
        '',
        'You did not create an account? Then someone entered your address. You do not need to do anything; the account disappears by itself after 48 hours.',
        '',
        'The account is free. There are no costs unless you expressly buy a pass.',
      ],
    },
    disputeUnresolved: {
      subject: 'Your request regarding order {{ORDER_NO}}',
      body: [
        'Hello {{CUSTOMER_NAME}},',
        '',
        'unfortunately we could not reach an agreement on your request. We are required by law to refer you to the competent consumer arbitration board:',
        '',
        'Universalschlichtungsstelle des Bundes, Zentrum für Schlichtung e. V., Straßburger Straße 8, 77694 Kehl am Rhein, Germany, www.universalschlichtungsstelle.de',
        '',
        'We are neither obliged nor willing to participate in dispute resolution proceedings before this board.',
      ],
    },
    footer: [
      '{{SELLER_NAME}} · {{SELLER_ADDRESS}}',
      'Phone {{SELLER_PHONE}} · {{SELLER_EMAIL}}',
      'Small business under § 19 UStG (no VAT charged)',
    ],
  },
};
