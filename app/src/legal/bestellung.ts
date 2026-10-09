/**
 * Texte für Angebotsseite (/preise) und Bestellübersicht (/kauf) nach
 * § 312j BGB, dazu die Pflichtangaben der Kleinbetragsrechnung.
 *
 * KEINE RECHTSBERATUNG — vor Livegang anwaltlich prüfen lassen.
 *
 * Was wohin muss (Wortlaut im Gesetz):
 * - SPÄTESTENS BEI BEGINN des Bestellvorgangs, klar und deutlich (§ 312j
 *   Abs. 1): Lieferbeschränkungen und akzeptierte Zahlungsmittel
 *   → `start.restriction`, `start.payment` auf /preise UND oben auf /kauf.
 * - UNMITTELBAR VOR dem Knopf, hervorgehoben (§ 312j Abs. 2 mit Art. 246a § 1
 *   Abs. 1 Satz 1 Nr. 1, 5–8, 11a, 14, 15 EGBGB; Fassung seit 27.09.2026):
 *   wesentliche Eigenschaften (Nr. 1), Gesamtpreis (Nr. 5), Laufzeit (Nr. 14).
 *   Nr. 6 (personalisierter Preis), 7 (Zusatzkosten), 8 (Abo-Gesamtpreis),
 *   11a (Haltbarkeitsgarantie), 15 (Mindestdauer) treffen nicht zu.
 *   → `summary.*` als ein Kasten direkt über dem Knopf, NICHT hinter einem
 *   Aufklapper, NICHT nur verlinkt.
 * - Vor der Bestellung zugänglich (§ 312d, Art. 246a § 1): Identität, Anschrift,
 *   Telefon, E-Mail (Nr. 2–4), Mängelrecht digitale Dienstleistungen (Nr. 11b),
 *   Aktualisierungen (Nr. 11c), Funktionalität/Kompatibilität (Nr. 17, 18),
 *   Widerrufsbelehrung + Muster-Formular + Widerrufsfunktion (Abs. 2)
 *   → `seller`, `info.*`, Links auf /agb und /widerrufsbelehrung.
 * - Knopf: nichts anderes als „zahlungspflichtig bestellen" (§ 312j Abs. 3).
 *   Sonst kommt KEIN Vertrag zustande (Abs. 4).
 *
 * NICHT einbauen: ein Häkchen „Ich verlange, dass vor Ablauf der
 * Widerrufsfrist begonnen wird" (§ 357a Abs. 2). Es dient nur dem Wertersatz,
 * den wir nicht verlangen, und kostet Abschluss.
 */
import type { Bilingual } from './types';

export interface OrderTexts {
  start: {
    /** Lieferbeschränkung (§ 312j Abs. 1). */
    restriction: string;
    /** Zahlungsmittel (§ 312j Abs. 1); {{PAYMENT_METHODS}} aus Mollie. */
    payment: string;
  };
  pageTitle: string;
  /** Hinweis zum Prüfen und Korrigieren (Art. 246c Nr. 3 EGBGB). */
  correctionHint: string;
  fields: {
    billingName: string;
    billingNameHelp: string;
    country: string;
    countryHelp: string;
    /** Nur wenn Land ≠ DE: Abfrage, dass als Verbraucher gekauft wird. */
    consumerAbroad: string;
    countryNotAvailable: string;
  };
  summary: {
    title: string;
    productLine: string;
    featuresTitle: string;
    features: string[];
    freeStays: string;
    priceLabel: string;
    priceValue: string;
    priceNote: string;
    termLabel: string;
    termValue: string;
    endLabel: string;
    endValue: string;
  };
  /** Generöser Widerruf, als eigene ruhige Zeile unter der Zusammenfassung. */
  withdrawalHighlight: string;
  checkboxes: {
    terms: string;
    adult: string;
  };
  /** Link-Zeile statt Häkchen: Kenntnisnahme der Belehrung, keine Zustimmung. */
  withdrawalNotice: string;
  button: string;
  afterButton: string;
  errors: {
    terms: string;
    adult: string;
    billingName: string;
    consumerAbroad: string;
  };
  info: {
    warranty: string;
    updates: string;
    compatibility: string;
  };
  seller: {
    title: string;
    lines: string[];
  };
  thanks: {
    pending: string;
    paid: string;
    failed: string;
    canceled: string;
    expired: string;
    open: string;
  };
  /** Angebotsseite (/preise): Freischalt-Hinweis an gesperrten Funktionen. */
  unlockHint: string;
  /** Pflichtangaben der Rechnung (§ 33 i. V. m. § 34a UStDV). */
  invoice: {
    title: string;
    sellerLabel: string;
    invoiceNoLabel: string;
    dateLabel: string;
    customerLabel: string;
    serviceLabel: string;
    serviceValue: string;
    periodLabel: string;
    amountLabel: string;
    taxNote: string;
    paidNote: string;
  };
}

export const BESTELLUNG: Bilingual<OrderTexts> = {
  version: '2026-10-09',
  de: {
    start: {
      restriction: 'Den Pass können Privatpersonen aus Deutschland und den anderen Ländern der Europäischen Union kaufen, Unternehmen nur mit Sitz in Deutschland.',
      payment: 'Bezahlen können Sie mit: {{PAYMENT_METHODS}}. Die Zahlung läuft über unseren Zahlungsdienstleister Mollie.',
    },
    pageTitle: 'Bestellübersicht',
    correctionHint: 'Bitte prüfen Sie Ihre Angaben. Bis zum Klick auf „zahlungspflichtig bestellen" können Sie alles in den Feldern ändern.',
    fields: {
      billingName: 'Name für die Rechnung',
      billingNameHelp: 'Ihr Vor- und Nachname oder der Name Ihres Unternehmens.',
      country: 'Land',
      countryHelp: 'Wir brauchen das Land für die Rechnung und aus steuerlichen Gründen.',
      consumerAbroad: 'Ich kaufe als Privatperson, nicht für ein Unternehmen.',
      countryNotAvailable: 'Aus diesem Land können wir den Pass derzeit leider nicht verkaufen. Alle kostenlosen Funktionen können Sie trotzdem nutzen.',
    },
    summary: {
      title: 'Ihre Bestellung',
      productLine: '{{PRODUCT_NAME}} – Bewerbungs-Pass, {{DAYS}} Tage',
      featuresTitle: 'Das schaltet der Pass frei:',
      features: [
        'Lebensläufe, Anschreiben und Fotos auf unserem Server in Deutschland speichern und von mehreren Geräten aus bearbeiten',
        'Sharelinks zum Teilen eines Lebenslaufs, jederzeit widerrufbar',
        'Frühere Versionen am Server wiederherstellen',
        'KI-Programme per MCP verbinden',
        'API-Schlüssel für eigene Programme',
      ],
      freeStays: 'Alle Vorlagen, PDF-, Word- und ATS-Export bleiben auch ohne Pass kostenlos.',
      priceLabel: 'Preis',
      priceValue: '{{PRICE}} einmalig',
      priceNote: 'Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet. Keine weiteren Kosten.',
      termLabel: 'Laufzeit',
      termValue: '{{DAYS}} Tage ab Freischaltung',
      endLabel: 'Ende',
      endValue: 'Endet automatisch nach {{DAYS}} Tagen. Kein Abo, keine Verlängerung, keine weitere Abbuchung. Kündigen können Sie trotzdem jederzeit.',
    },
    withdrawalHighlight: '14 Tage Widerrufsrecht mit voller Erstattung: Wenn Sie den Kauf innerhalb von 14 Tagen widerrufen, erhalten Sie den ganzen Preis zurück, auch wenn Sie den Pass schon genutzt haben.',
    checkboxes: {
      terms: 'Ich habe die AGB gelesen und bin mit ihrer Geltung einverstanden.',
      adult: 'Ich bin mindestens 18 Jahre alt.',
    },
    withdrawalNotice: 'Lesen Sie vor der Bestellung die Widerrufsbelehrung mit dem Muster-Widerrufsformular. Wir schicken Ihnen beides mit der Bestellbestätigung zu.',
    button: 'zahlungspflichtig bestellen',
    afterButton: 'Danach geht es zu Mollie, wo Sie die Zahlungsart wählen. Der Vertrag kommt zustande, wenn die Zahlung erfolgreich ist.',
    errors: {
      terms: 'Bitte bestätigen Sie die AGB.',
      adult: 'Den Pass dürfen nur Volljährige kaufen.',
      billingName: 'Bitte geben Sie einen Namen für die Rechnung an.',
      consumerAbroad: 'Aus dem Ausland können wir den Pass nur an Privatpersonen verkaufen. Bitte bestätigen Sie das.',
    },
    info: {
      warranty: 'Für den Pass gilt das gesetzliche Mängelhaftungsrecht für digitale Dienstleistungen.',
      updates: 'Aktualisierungen, einschließlich Sicherheitsaktualisierungen, stellen wir für die gesamte Laufzeit des Passes bereit. Sie kommen automatisch beim Laden der Seite.',
      compatibility: 'Läuft in aktuellen Versionen von Chrome, Edge, Firefox und Safari. Für die KI-Verbindung brauchen Sie ein Programm mit MCP-Unterstützung.',
    },
    seller: {
      title: 'Ihr Vertragspartner',
      lines: [
        '{{SELLER_NAME}}',
        '{{SELLER_ADDRESS}}',
        'Telefon: {{SELLER_PHONE}}',
        'E-Mail: {{SELLER_EMAIL}}',
      ],
    },
    thanks: {
      pending: 'Wir warten auf die Bestätigung Ihrer Zahlung. Das dauert meist nur wenige Sekunden.',
      paid: 'Danke! Ihr Pass ist freigeschaltet bis {{PASS_UNTIL}}. Die Bestellbestätigung mit Rechnung ist per E-Mail unterwegs.',
      failed: 'Die Zahlung ist fehlgeschlagen. Es wurde nichts abgebucht und kein Vertrag geschlossen. Sie können es erneut versuchen.',
      canceled: 'Sie haben die Zahlung abgebrochen. Es wurde nichts abgebucht und kein Vertrag geschlossen.',
      expired: 'Die Zahlung ist nicht rechtzeitig abgeschlossen worden. Es wurde nichts abgebucht und kein Vertrag geschlossen.',
      open: 'Die Zahlung ist noch nicht abgeschlossen. Bei manchen Zahlungsarten dauert die Bestätigung länger; wir schicken Ihnen eine E-Mail, sobald der Pass freigeschaltet ist.',
    },
    unlockHint: 'Mit dem Bewerbungs-Pass ({{PRICE}} für {{DAYS}} Tage, kein Abo).',
    invoice: {
      title: 'Rechnung',
      sellerLabel: 'Leistender Unternehmer',
      invoiceNoLabel: 'Rechnungsnummer',
      dateLabel: 'Rechnungsdatum',
      customerLabel: 'Leistungsempfänger',
      serviceLabel: 'Leistung',
      serviceValue: '1 × {{PRODUCT_NAME}} – Bewerbungs-Pass, Nutzung der Konto-Funktionen für {{DAYS}} Tage (Bestellung {{ORDER_NO}})',
      periodLabel: 'Leistungszeitraum',
      amountLabel: 'Betrag',
      taxNote: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Steuerbefreiung für Kleinunternehmer).',
      paidNote: 'Bezahlt über Mollie am {{ORDER_DATE}}.',
    },
  },
  en: {
    start: {
      restriction: 'The pass can be bought by private individuals from Germany and the other countries of the European Union, and by businesses established in Germany only.',
      payment: 'You can pay with: {{PAYMENT_METHODS}}. Payment is handled by our payment provider Mollie.',
    },
    pageTitle: 'Order overview',
    correctionHint: 'Please check your details. Until you click "zahlungspflichtig bestellen" ("order with obligation to pay") you can change everything in the fields.',
    fields: {
      billingName: 'Name for the invoice',
      billingNameHelp: 'Your first and last name or the name of your business.',
      country: 'Country',
      countryHelp: 'We need the country for the invoice and for tax reasons.',
      consumerAbroad: 'I am buying as a private individual, not for a business.',
      countryNotAvailable: 'Unfortunately we cannot sell the pass to this country at the moment. You can still use all free features.',
    },
    summary: {
      title: 'Your order',
      productLine: '{{PRODUCT_NAME}} – application pass, {{DAYS}} days',
      featuresTitle: 'The pass unlocks:',
      features: [
        'Save CVs, cover letters and photos on our server in Germany and edit them from several devices',
        'Share links to share a CV, revocable at any time',
        'Restore earlier versions from the server',
        'Connect AI programs via MCP',
        'API keys for your own programs',
      ],
      freeStays: 'All templates, PDF, Word and ATS exports stay free without a pass.',
      priceLabel: 'Price',
      priceValue: '{{PRICE}} once',
      priceNote: 'Final price. No VAT is charged under § 19 of the German VAT Act (small business scheme). No further costs.',
      termLabel: 'Term',
      termValue: '{{DAYS}} days from activation',
      endLabel: 'End',
      endValue: 'Ends automatically after {{DAYS}} days. No subscription, no renewal, no further charge. You can still cancel at any time.',
    },
    withdrawalHighlight: '14-day right of withdrawal with a full refund: if you withdraw within 14 days, you get the whole price back, even if you have already used the pass.',
    checkboxes: {
      terms: 'I have read the Terms and agree to them.',
      adult: 'I am at least 18 years old.',
    },
    withdrawalNotice: 'Before ordering, please read the withdrawal information and the model withdrawal form. We send both with the order confirmation.',
    button: 'zahlungspflichtig bestellen',
    afterButton: 'Next you go to Mollie to choose the payment method. The contract is concluded when the payment succeeds.',
    errors: {
      terms: 'Please confirm the Terms.',
      adult: 'Only adults may buy the pass.',
      billingName: 'Please enter a name for the invoice.',
      consumerAbroad: 'Outside Germany we can only sell the pass to private individuals. Please confirm this.',
    },
    info: {
      warranty: 'The statutory liability for defects for digital services applies to the pass.',
      updates: 'We provide updates, including security updates, for the entire term of the pass. They arrive automatically when the page loads.',
      compatibility: 'Works in current versions of Chrome, Edge, Firefox and Safari. For the AI connection you need a program with MCP support.',
    },
    seller: {
      title: 'Your contracting party',
      lines: [
        '{{SELLER_NAME}}',
        '{{SELLER_ADDRESS}}',
        'Phone: {{SELLER_PHONE}}',
        'E-mail: {{SELLER_EMAIL}}',
      ],
    },
    thanks: {
      pending: 'We are waiting for confirmation of your payment. This usually takes only a few seconds.',
      paid: 'Thank you! Your pass is active until {{PASS_UNTIL}}. The order confirmation with invoice is on its way by e-mail.',
      failed: 'The payment failed. Nothing was charged and no contract was concluded. You can try again.',
      canceled: 'You cancelled the payment. Nothing was charged and no contract was concluded.',
      expired: 'The payment was not completed in time. Nothing was charged and no contract was concluded.',
      open: 'The payment is not complete yet. With some payment methods confirmation takes longer; we will e-mail you as soon as the pass is active.',
    },
    unlockHint: 'With the application pass ({{PRICE}} for {{DAYS}} days, no subscription).',
    invoice: {
      title: 'Invoice',
      sellerLabel: 'Supplier',
      invoiceNoLabel: 'Invoice number',
      dateLabel: 'Invoice date',
      customerLabel: 'Customer',
      serviceLabel: 'Service',
      serviceValue: '1 × {{PRODUCT_NAME}} – application pass, use of account features for {{DAYS}} days (order {{ORDER_NO}})',
      periodLabel: 'Service period',
      amountLabel: 'Amount',
      taxNote: 'No VAT is charged under § 19 UStG (German small business scheme).',
      paidNote: 'Paid via Mollie on {{ORDER_DATE}}.',
    },
  },
};
