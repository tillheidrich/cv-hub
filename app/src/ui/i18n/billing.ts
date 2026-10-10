/**
 * Texte rund um den Bewerbungs-Pass (Runde 4, 09.10.2026): Angebotsseite,
 * Freischalt-Paneel, Registrierung, Bestellübersicht, Danke-Seite, „Mein Pass",
 * Widerruf. Vier Sprachen, im Deutschen wird geduzt wie überall in der App.
 *
 * Grundsatz aus dem Reddit-Bericht vom 08.10.2026: Die Klage Nummer eins in
 * diesem Markt sind Abo-Fallen und Download-Schranken. Deshalb steht der Preis
 * früh und vollständig da, was zum Pass gehört, steht vor der Arbeit am Knopf,
 * und es gibt keine Countdowns, keine erfundenen Zahlen, keine Siegel.
 *
 * Diese Texte gelten OHNE Gratis-Grenze (Verkauf zu oder FREE_TIER_LIMITS aus).
 * Mit Grenze ersetzt billing/format.ts → billingFor() die betroffenen Stellen
 * durch ui/i18n/freetier.ts (Vorlagen-Staffel, 10.10.2026). Deshalb hier keine
 * „nie/immer"-Zusagen zum Export: Sie würden der Fassung mit Grenze
 * widersprechen. MCP heißt „Claude und andere MCP-Programme"; ChatGPT steht
 * nur bei der Markdown-Brücke.
 *
 * Preise und Tage kommen als fertige Zeichenketten aus /api/billing/offer
 * (formatPrice in billing/api.ts); hier steht nur der Satz drumherum.
 */
import type { UiLang } from '../i18n';

export type FeatureKey = 'sync' | 'share' | 'versions' | 'mcp' | 'apiKeys';
export type UnlockKey = FeatureKey | 'account';

interface Item { title: string; body: string }
interface Qa { q: string; a: string }
/** Zelle der Vergleichstabelle: true = enthalten, false = nicht, Text = Angabe. */
type Cell = boolean | string;

export interface BillingStrings {
  locale: string;
  // Rahmen
  home: string;
  toTool: string;
  langLabel: string;
  footerLabel: string;
  pricing: string;
  imprint: string;
  privacy: string;
  terms: string;
  withdrawalPolicy: string;
  withdrawLink: string;
  // Angebot
  productName: string;
  oneTime: string;
  priceFacts: (days: number) => string[];
  vatNote: string;
  getPass: string;
  extendPass: string;
  continueFree: string;
  features: Record<FeatureKey, Item>;
  freeList: (templates: number) => string[];
  // Angebotsseite
  pEyebrow: string;
  pH1a: string;
  pH1b: (price: string) => string;
  pLede: string;
  freeTitle: string;
  freePrice: string;
  freeSub: string;
  freeCta: string;
  passSub: (days: number) => string;
  tableTitle: string;
  tableFeature: string;
  tableFree: string;
  tablePass: string;
  yes: string;
  no: string;
  tableRows: (templates: number, price: string, days: number) => { label: string; free: Cell; pass: Cell }[];
  stepsTitle: string;
  steps: (days: number) => Item[];
  faqTitle: string;
  faq: (price: string, days: number) => Qa[];
  closing: string;
  pricingSoon: string;
  landingEyebrow: string;
  landingH: (price: string) => string;
  landingLede: string;
  landingMore: string;
  // Freischalt-Paneel
  unlock: Record<UnlockKey, Item>;
  unlockFreeNote: string;
  unlockSeeAll: string;
  unlockHaveAccount: string;
  close: string;
  // Registrierung und Anmeldung
  regTitle: string;
  regSub: string;
  email: string;
  password: string;
  passwordHint: string;
  showPw: string;
  hidePw: string;
  age16: string;
  privacyNote: [string, string, string];
  regSubmit: string;
  busy: string;
  haveAccount: string;
  loginTitle: string;
  loginSub: string;
  identifier: string;
  loginSubmit: string;
  noAccount: string;
  twofaLabel: string;
  twofaSubmit: string;
  errEmail: string;
  errPwShort: string;
  errAge16: string;
  errAltcha: string;
  errGeneric: string;
  errTooMany: (s?: number) => string;
  inviteOnly: string;
  // E-Mail bestätigen
  confirmBanner: (email: string) => string;
  confirmBannerNoMail: string;
  resend: string;
  resent: string;
  resendFailed: string;
  confirming: string;
  confirmedTitle: string;
  confirmedBody: string;
  confirmInvalid: string;
  /** E-Mail-Wechsel bestätigt (Sicherheitsbefund M2, 09.10.2026). */
  confirmedChangeTitle: string;
  confirmedChangeBody: (email: string) => string;
  confirmEmailTaken: string;
  /** Kauf ohne bestätigte Adresse: 403 `email_unconfirmed` (N1). */
  coUnconfirmedTitle: string;
  coUnconfirmedBody: (email: string | null) => string;
  coResend: string;
  /** Bestätigungslink für öffentlichen Widerruf und öffentliche Kündigung
   *  (/widerruf/bestaetigen, /kuendigen/bestaetigen; H2/M1). */
  dcTitleWithdraw: string;
  dcTitleCancel: string;
  dcIntroWithdraw: string;
  dcIntroCancel: string;
  dcWhy: string;
  dcDoneWithdrawTitle: string;
  dcDoneWithdrawBody: (orderNo: string, received: string, confirmed: string) => string;
  dcDoneCancelTitle: string;
  dcDoneCancelBody: (orderNo: string, received: string, effective: string) => string;
  dcMail: string;
  dcUsedTitle: string;
  dcUsedBody: (received: string | null) => string;
  dcExpiredTitle: string;
  dcExpiredBody: (received: string | null) => string;
  dcInvalidTitle: string;
  dcInvalidBody: string;
  dcManualTitle: string;
  dcManualBody: string;
  dcAgainWithdraw: string;
  dcAgainCancel: string;
  continue: string;
  // Bestellübersicht
  coTitle: string;
  coSteps: [string, string, string];
  coStepOf: (n: number, total: number) => string;
  coSignedInAs: (who: string) => string;
  coSignOut: string;
  billingName: string;
  billingNameHint: string;
  coOtherCountry: string;
  country: string;
  countryHint: string;
  summaryTitle: string;
  sumProduct: string;
  sumIncluded: string;
  sumTerm: string;
  sumTermText: (days: number, end: string, fromLaterEnd: boolean) => string;
  sumNoRenewal: string;
  sumTotal: string;
  sumPayment: string;
  sumPaymentText: string;
  sumPaymentMethods: (list: string) => string;
  sumWithdrawal: string;
  sumWithdrawalText: string;
  acceptTerms: [string, string, string];
  ackWithdrawal: [string, string, string];
  age18: string;
  orderButton: string;
  orderBusy: string;
  orderAfter: string;
  errTerms: string;
  errWithdrawal: string;
  errAge18: string;
  errName: string;
  errClosed: string;
  activeUntil: (date: string) => string;
  unlimitedNote: string;
  // Danke-Seite
  tkChecking: string;
  tkOrderNo: (no: string) => string;
  tkPaidTitle: string;
  tkPaidBody: (date: string) => string;
  tkMail: string;
  tkToEditor: string;
  tkOpenTitle: string;
  tkOpenBody: string;
  tkStill: string;
  tkReload: string;
  tkFailedTitle: string;
  tkFailedBody: string;
  tkCanceledTitle: string;
  tkCanceledBody: string;
  tkExpiredTitle: string;
  tkExpiredBody: string;
  tkWithdrawnTitle: string;
  tkWithdrawnBody: string;
  tkRetry: string;
  tkNoOrder: string;
  tkLogin: string;
  tkToPass: string;
  imTitle: string;
  imBody: string;
  imButton: (n: number) => string;
  imWorking: (i: number, n: number) => string;
  imDone: (n: number) => string;
  imFailed: (name: string) => string;
  imUpdated: (date: string) => string;
  // Mein Pass
  mpTitle: string;
  mpUnlimited: string;
  mpPilot: (date: string) => string;
  mpPassActive: (date: string, days: number) => string;
  mpPassExpired: (date: string) => string;
  mpNone: string;
  mpOrders: string;
  mpOrdersEmpty: string;
  mpInvoice: string;
  mpStatus: Record<string, string>;
  mpWithdrawUntil: (date: string) => string;
  mpWithdraw: string;
  mpWithdrawTitle: string;
  mpWithdrawBody: (orderNo: string, amount: string) => string;
  mpWithdrawConfirm: string;
  cancel: string;
  mpWithdrawDone: (date: string, time: string) => string;
  mpRefund: (status: string) => string;
  /** Stände einer Mollie-Erstattung (queued, pending, processing, refunded, failed, canceled). */
  refundStatus: Record<string, string>;
  mpLoading: string;
  mpLoadFailed: string;
  // Öffentlicher Widerruf
  wdTitle: string;
  wdLede: string;
  wdAccountHint: string;
  wdName: string;
  wdEmail: string;
  wdEmailHint: string;
  wdOrderNo: string;
  wdOrderNoHint: string;
  wdStart: string;
  wdReviewTitle: string;
  wdReviewBody: string;
  wdConfirm: string;
  wdBack: string;
  wdDoneTitle: string;
  wdDoneBody: (date: string, time: string, email: string) => string;
  wdNotFound: string;
  wdFields: string;
  wdNoOrderNo: string;
  cnEffectiveEnd: string;
  cnPrint: string;
  cnCancelPass: string;
  wdFormTitle: string;
  wdFormLede: string;
  wdDownload: string;
  wdCopy: string;
  wdCopied: string;
  // Rechtstexte
  lgPending: string;
  lgTranslation: string;
  lgVersion: (v: string) => string;
}

const de: BillingStrings = {
  locale: 'de-DE',
  home: 'Startseite',
  toTool: 'Zum Werkzeug',
  langLabel: 'Sprache der Oberfläche',
  footerLabel: 'Rechtliches',
  pricing: 'Preise',
  imprint: 'Impressum',
  privacy: 'Datenschutz',
  terms: 'AGB',
  withdrawalPolicy: 'Widerrufsbelehrung',
  withdrawLink: 'Vertrag widerrufen',
  productName: 'Bewerbungs-Pass',
  oneTime: 'einmalig',
  priceFacts: d => [`${d} Tage`, 'kein Abo', 'endet von selbst', '14 Tage Geld zurück'],
  vatNote: 'Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  getPass: 'Pass holen',
  extendPass: 'Pass verlängern',
  continueFree: 'Weiter ohne Konto',
  features: {
    sync: { title: 'Speichern über Geräte', body: 'Deine Lebensläufe liegen auf unserem Server und sind an jedem Gerät da, an dem du angemeldet bist.' },
    share: { title: 'Sharelinks', body: 'Ein Link statt Anhang. Mit Ablaufdatum, jederzeit widerrufbar, und du siehst, wie oft er aufgerufen wurde.' },
    versions: { title: 'Versionen am Server', body: 'Bis zu 25 ältere Stände je Lebenslauf, auf jedem Gerät abrufbar.' },
    mcp: { title: 'KI verbinden (MCP)', body: 'Claude und andere MCP-Programme lesen und ändern deinen Lebenslauf direkt, ohne Kopieren und Einfügen.' },
    apiKeys: { title: 'API-Schlüssel', body: 'Für eigene Skripte und Werkzeuge, die mit deinem Konto arbeiten.' },
  },
  freeList: n => [
    `Alle ${n} Vorlagen und das Anschreiben`,
    'PDF, Word (gestaltet und als ATS-Fassung), HTML, Markdown, JSON',
    'Daten bleiben in deinem Browser, mit Sicherungsdatei',
    'Versionen im Browser, LinkedIn-Import, ATS-Prüfung',
  ],
  pEyebrow: 'Preise',
  pH1a: 'Alles im Browser ist kostenlos.',
  pH1b: p => `Der Pass kostet ${p} einmalig.`,
  pLede: 'Schreiben, gestalten, PDF und Word: ohne Konto. Der Bewerbungs-Pass bringt dazu, was einen Server braucht, für die Zeit deiner Bewerbungen.',
  freeTitle: 'Ohne Konto',
  freePrice: '0 €',
  freeSub: 'Ohne Anmeldung, ohne Ablaufdatum',
  freeCta: 'Ohne Konto loslegen',
  passSub: d => `${d} Tage für deine Bewerbungsphase`,
  tableTitle: 'Ohne Konto und mit Pass im Vergleich',
  tableFeature: 'Funktion',
  tableFree: 'Ohne Konto',
  tablePass: 'Mit Pass',
  yes: 'enthalten',
  no: 'nicht enthalten',
  tableRows: (n, price, d) => [
    { label: `Alle ${n} Vorlagen, Anschreiben`, free: true, pass: true },
    { label: 'PDF, Word, ATS-Fassung, HTML, JSON', free: true, pass: true },
    { label: 'Wo deine Daten liegen', free: 'In deinem Browser', pass: 'Auf dem Server' },
    { label: 'Versionen', free: 'Im Browser (20)', pass: 'Am Server (25)' },
    { label: 'Speichern über Geräte', free: 'Mit Sicherungsdatei', pass: true },
    { label: 'Sharelinks mit Ablauf, Widerruf und Aufrufzählung', free: false, pass: true },
    { label: 'KI verbinden per MCP', free: 'Markdown-Brücke', pass: true },
    { label: 'API-Schlüssel', free: false, pass: true },
    { label: 'Preis', free: '0 €', pass: `${price} einmalig, ${d} Tage` },
  ],
  stepsTitle: 'So läuft der Kauf',
  steps: d => [
    { title: 'Konto anlegen', body: 'E-Mail-Adresse und Passwort. Mehr brauchen wir nicht.' },
    { title: 'Bestellung prüfen', body: 'Du siehst Preis, Laufzeit und Widerrufsrecht, bevor du bestellst. Bezahlt wird über Mollie.' },
    { title: 'Pass ist aktiv', body: `Sofort nach der Zahlung, für ${d} Tage. Danach endet er von selbst, ohne Kündigung.` },
  ],
  faqTitle: 'Fragen zum Pass',
  faq: (price, d) => [
    { q: `Was passiert nach ${d} Tagen?`, a: 'Der Pass endet, und dein Konto wechselt auf Nur-Lesen. Du kannst weiter alles lesen, exportieren (PDF, Word, JSON, Datenexport) und löschen. Ändern und neue Sharelinks gehen erst wieder mit einem neuen Pass. Wir löschen nichts, ohne es dir vorher per E-Mail anzukündigen.' },
    { q: 'Ist das ein Abo?', a: `Nein. Du zahlst einmal ${price}. Es gibt keine Testphase, die in ein Abo übergeht, und keine gespeicherte Zahlungsart für spätere Abbuchungen.` },
    { q: 'Kann ich verlängern?', a: `Ja, mit einem neuen Kauf, auch vor dem Ende. Die neuen ${d} Tage hängen sich an das bisherige Ende an, es geht kein Tag verloren.` },
    { q: 'Wie widerrufe ich?', a: `Innerhalb von 14 Tagen nach dem Kauf: im Konto unter „Mein Pass" mit „Vertrag widerrufen" oder ohne Anmeldung über den Link „Vertrag widerrufen" unten auf jeder Seite; dann bestätigst du den Widerruf noch über einen Link, den wir an die E-Mail-Adresse der Bestellung schicken. Du bekommst die vollen ${price} zurück, auch wenn du den Pass schon genutzt hast. Dein Konto und deine Inhalte bleiben; du kannst sie lesen, als Datenexport herunterladen und löschen.` },
    { q: 'Brauche ich den Pass für PDF oder Word?', a: 'Nein. Ohne Konto bekommst du alle Vorlagen, PDF, beide Word-Fassungen und die übrigen Formate, und deine Daten bleiben in deinem Browser. Was zum Pass gehört, steht hier und am jeweiligen Knopf, bevor du anfängst.' },
    { q: 'Wie bezahle ich?', a: 'Über Mollie, einen Zahlungsdienstleister aus den Niederlanden. Die Zahlungsart wählst du auf der Bezahlseite von Mollie. Karten- oder Kontodaten sehen wir nicht.' },
    { q: 'Bekomme ich eine Rechnung?', a: 'Ja. Sie kommt als PDF mit der Bestellbestätigung per E-Mail und liegt in deinem Konto unter „Mein Pass".' },
    { q: 'Warum kostet das überhaupt etwas?', a: 'Speicher, Sharelinks und die MCP-Verbindung laufen auf einem Server, und der kostet Geld. Deshalb gehören sie zum Pass. Die quelloffene Fassung kannst du auch selbst betreiben.' },
  ],
  closing: 'Fang ohne Konto an. Den Pass kannst du später immer noch holen.',
  pricingSoon: 'Der Verkauf ist noch nicht geöffnet. Ohne Konto kannst du schon jetzt alles nutzen, was im Browser läuft.',
  landingEyebrow: 'Preise',
  landingH: p => `Kostenlos im Browser. ${p} einmalig für den Pass.`,
  landingLede: 'Vorlagen, PDF und Word sind ohne Konto frei. Der Bewerbungs-Pass bringt Speichern über Geräte, Sharelinks, Versionen am Server und die KI-Verbindung.',
  landingMore: 'Alles zu den Preisen',
  unlock: {
    sync: { title: 'Speichern über Geräte gibt es mit dem Pass.', body: 'Dein Lebenslauf liegt dann auf unserem Server und ist an jedem Gerät da, an dem du angemeldet bist.' },
    share: { title: 'Sharelinks gibt es mit dem Pass.', body: 'Ein Link statt Anhang: mit Ablaufdatum, jederzeit widerrufbar, und du siehst, wie oft er aufgerufen wurde.' },
    versions: { title: 'Versionen am Server gibt es mit dem Pass.', body: 'Bis zu 25 ältere Stände je Lebenslauf, auf jedem Gerät. Im Browser hast du weiterhin die letzten 20.' },
    mcp: { title: 'KI verbinden gibt es mit dem Pass.', body: 'Claude und andere MCP-Programme lesen und ändern deinen Lebenslauf direkt. Die Markdown-Brücke zu ChatGPT, Claude oder einem anderen Modell funktioniert auch ohne Pass.' },
    apiKeys: { title: 'API-Schlüssel gibt es mit dem Pass.', body: 'Für eigene Skripte und Werkzeuge, die mit deinem Konto arbeiten.' },
    account: { title: 'Ein Konto mit dem Bewerbungs-Pass', body: 'Speichern über Geräte, Sharelinks, Versionen am Server und die KI-Verbindung, für die Zeit deiner Bewerbungen.' },
  },
  unlockFreeNote: 'PDF und Word bleiben ohne Konto kostenlos.',
  unlockSeeAll: 'Was der Pass alles kann',
  unlockHaveAccount: 'Schon ein Konto? Anmelden',
  close: 'Schließen',
  regTitle: 'Konto anlegen',
  regSub: 'Danach prüfst du die Bestellung. Bezahlt wird erst im nächsten Schritt.',
  email: 'E-Mail-Adresse',
  password: 'Passwort',
  passwordHint: 'Mindestens 8 Zeichen.',
  showPw: 'Passwort zeigen',
  hidePw: 'Passwort verbergen',
  age16: 'Ich bin mindestens 16 Jahre alt.',
  privacyNote: ['Wir nutzen deine E-Mail-Adresse für die Anmeldung, die Bestätigung und die Rechnung. Mehr dazu in der ', 'Datenschutzerklärung', '.'],
  regSubmit: 'Konto anlegen und weiter',
  busy: 'Einen Moment …',
  haveAccount: 'Schon ein Konto? Anmelden',
  loginTitle: 'Anmelden',
  loginSub: 'Melde dich an, dann geht es mit der Bestellung weiter.',
  identifier: 'E-Mail-Adresse oder Nutzername',
  loginSubmit: 'Anmelden und weiter',
  noAccount: 'Noch kein Konto? Konto anlegen',
  twofaLabel: 'Code aus der E-Mail (6 Ziffern)',
  twofaSubmit: 'Code bestätigen',
  errEmail: 'Bitte gib eine gültige E-Mail-Adresse an.',
  errPwShort: 'Das Passwort braucht mindestens 8 Zeichen.',
  errAge16: 'Ein Konto gibt es ab 16 Jahren. Bitte bestätige dein Alter.',
  errAltcha: 'Bitte warte, bis die Prüfung „Ich bin kein Roboter" fertig ist.',
  errGeneric: 'Das hat nicht geklappt. Bitte versuch es noch einmal.',
  errTooMany: s => (s ? `Zu viele Versuche. Bitte warte ${Math.ceil(s / 60)} Minuten.` : 'Zu viele Versuche. Bitte warte ein paar Minuten.'),
  inviteOnly: 'Konten gibt es auf dieser Instanz nur mit Einladung.',
  confirmBanner: e => `Bitte bestätige deine E-Mail-Adresse. Den Link haben wir an ${e} geschickt.`,
  confirmBannerNoMail: 'Bitte bestätige deine E-Mail-Adresse über den Link in unserer Mail.',
  resend: 'Erneut senden',
  resent: 'Gesendet. Schau auch im Spam-Ordner nach.',
  resendFailed: 'Senden hat nicht geklappt. Bitte später noch einmal.',
  confirming: 'E-Mail-Adresse wird bestätigt …',
  confirmedTitle: 'E-Mail-Adresse bestätigt.',
  confirmedBody: 'Danke. Dein Konto ist vollständig eingerichtet.',
  confirmInvalid: 'Der Link ist ungültig oder abgelaufen. Melde dich an und lass dir einen neuen schicken.',
  confirmedChangeTitle: 'E-Mail-Adresse geändert.',
  confirmedChangeBody: e => `Ab jetzt gilt ${e}. Die bisherige Adresse bekommt eine Nachricht über die Änderung.`,
  confirmEmailTaken: 'Diese Adresse gehört inzwischen zu einem anderen Konto. Bitte wähle in den Einstellungen eine andere.',
  coUnconfirmedTitle: 'Bitte bestätige zuerst deine E-Mail-Adresse.',
  coUnconfirmedBody: e => `Dorthin schicken wir Rechnung, Bestellbestätigung und Widerrufsbelehrung. ${e ? `Den Link haben wir an ${e} geschickt.` : 'Den Link findest du in unserer Mail.'} Danach kannst du hier direkt weiter bestellen.`,
  coResend: 'Bestätigungsmail erneut senden',
  dcTitleWithdraw: 'Widerruf bestätigen',
  dcTitleCancel: 'Kündigung bestätigen',
  dcIntroWithdraw: 'Du hast über unser Formular einen Widerruf abgeschickt. Mit dem Knopf bestätigst du ihn: Dann erstatten wir den Preis und der Pass endet. Für die Frist zählt der Eingang deiner Erklärung, nicht dieser Klick.',
  dcIntroCancel: 'Du hast über unser Formular eine Kündigung abgeschickt. Mit dem Knopf bestätigst du sie: Dann endet der Pass zum gewählten Zeitpunkt. Es zählt der Eingang deiner Erklärung, nicht dieser Klick.',
  dcWhy: 'Warum dieser Schritt: Das Formular ist ohne Anmeldung erreichbar. Der Link in der Mail an die Adresse der Bestellung stellt sicher, dass nur du deinen Pass beenden kannst.',
  dcDoneWithdrawTitle: 'Dein Widerruf ist bestätigt.',
  dcDoneWithdrawBody: (no, r, c) => `Bestellung ${no}. Eingegangen am ${r}, bestätigt am ${c}.`,
  dcDoneCancelTitle: 'Deine Kündigung ist bestätigt.',
  dcDoneCancelBody: (no, r, e) => `Bestellung ${no}. Eingegangen am ${r}. Der Pass endet am ${e}.`,
  dcMail: 'Die Bestätigung kommt zusätzlich per E-Mail.',
  dcUsedTitle: 'Diese Erklärung ist schon bestätigt.',
  dcUsedBody: r => `${r ? `Eingegangen am ${r}. ` : ''}Du musst nichts mehr tun.`,
  dcExpiredTitle: 'Dieser Bestätigungslink ist abgelaufen.',
  dcExpiredBody: r => `Deine Erklärung ist trotzdem bei uns eingegangen${r ? ` (am ${r})` : ''}. Wir melden uns per E-Mail. Du kannst sie auch noch einmal abschicken.`,
  dcInvalidTitle: 'Dieser Bestätigungslink ist ungültig.',
  dcInvalidBody: 'Nimm bitte den vollständigen Link aus unserer letzten Mail. Du kannst die Erklärung auch noch einmal abschicken.',
  dcManualTitle: 'Das ließ sich nicht automatisch erledigen.',
  dcManualBody: 'Deine Erklärung ist bei uns eingegangen. Wir melden uns innerhalb von zwei Werktagen per E-Mail.',
  dcAgainWithdraw: 'Widerruf noch einmal abschicken',
  dcAgainCancel: 'Kündigung noch einmal abschicken',
  continue: 'Weiter',
  coTitle: 'Bestellung prüfen',
  coSteps: ['Konto', 'Bestellung', 'Bezahlen'],
  coStepOf: (n, t) => `Schritt ${n} von ${t}`,
  coSignedInAs: w => `Angemeldet als ${w}`,
  coSignOut: 'Abmelden',
  billingName: 'Name für die Rechnung',
  billingNameHint: 'So steht es auf der Rechnung.',
  coOtherCountry: 'Anderes Land',
  country: 'Land',
  countryHint: 'Für die Rechnung und unsere Umsatzsteuer-Pflichten.',
  summaryTitle: 'Deine Bestellung',
  sumProduct: 'Produkt',
  sumIncluded: 'Enthalten',
  sumTerm: 'Laufzeit',
  sumTermText: (d, end, later) => later
    ? `${d} Tage, angehängt an deinen laufenden Pass, also bis ${end}.`
    : `${d} Tage ab Zahlungseingang, also bis ${end}.`,
  sumNoRenewal: 'Endet von selbst. Keine Verlängerung, kein Abo, keine Kündigung nötig.',
  sumTotal: 'Gesamtpreis',
  sumPayment: 'Bezahlung',
  sumPaymentText: 'Über Mollie. Die Zahlungsart wählst du auf der nächsten Seite.',
  sumPaymentMethods: l => `Über Mollie: ${l}. Die Zahlungsart wählst du auf der nächsten Seite.`,
  sumWithdrawal: 'Widerruf',
  sumWithdrawalText: '14 Tage. Bei Widerruf bekommst du den vollen Betrag zurück, auch wenn du den Pass schon genutzt hast.',
  acceptTerms: ['Ich habe die ', 'AGB', ' gelesen und bin einverstanden.'],
  ackWithdrawal: ['Ich habe die ', 'Widerrufsbelehrung', ' zur Kenntnis genommen.'],
  age18: 'Ich bin volljährig (mindestens 18 Jahre).',
  orderButton: 'zahlungspflichtig bestellen',
  orderBusy: 'Weiterleitung zu Mollie …',
  orderAfter: 'Du wirst zu Mollie weitergeleitet. Dort kannst du noch abbrechen. Bezahlt ist erst, wenn Mollie die Zahlung bestätigt.',
  errTerms: 'Bitte bestätige, dass du die AGB gelesen hast.',
  errWithdrawal: 'Bitte bestätige, dass du die Widerrufsbelehrung zur Kenntnis genommen hast.',
  errAge18: 'Kaufen kannst du ab 18 Jahren.',
  errName: 'Bitte gib einen Namen für die Rechnung an.',
  errClosed: 'Der Verkauf ist gerade nicht geöffnet.',
  activeUntil: d => `Dein Pass läuft noch bis ${d}. Ein neuer Kauf verlängert ihn ab diesem Tag.`,
  unlimitedNote: 'Dein Konto ist schon unbegrenzt freigeschaltet. Einen Pass brauchst du nicht.',
  tkChecking: 'Wir fragen bei Mollie nach dem Stand deiner Zahlung …',
  tkOrderNo: n => `Bestellung ${n}`,
  tkPaidTitle: 'Dein Pass ist aktiv.',
  tkPaidBody: d => `Er läuft bis ${d} und endet dann von selbst.`,
  tkMail: 'Die Bestellbestätigung mit Rechnung und Widerrufsbelehrung ist per E-Mail unterwegs.',
  tkToEditor: 'Zum Editor',
  tkOpenTitle: 'Die Zahlung ist noch nicht bestätigt.',
  tkOpenBody: 'Manche Zahlungsarten brauchen ein paar Minuten, eine Überweisung auch länger. Diese Seite fragt weiter nach. Du kannst sie auch schließen: Sobald die Zahlung da ist, ist dein Pass aktiv und die Bestätigung kommt per E-Mail.',
  tkStill: 'Wir fragen weiter nach …',
  tkReload: 'Jetzt nachsehen',
  tkFailedTitle: 'Die Zahlung ist fehlgeschlagen.',
  tkFailedBody: 'Es wurde nichts abgebucht. Du kannst es mit derselben oder einer anderen Zahlungsart noch einmal versuchen.',
  tkCanceledTitle: 'Du hast die Zahlung abgebrochen.',
  tkCanceledBody: 'Es wurde nichts abgebucht, und es ist keine Bestellung offen.',
  tkExpiredTitle: 'Die Zahlung ist abgelaufen.',
  tkExpiredBody: 'Es wurde nichts abgebucht. Starte die Bestellung einfach noch einmal.',
  tkWithdrawnTitle: 'Diese Bestellung ist widerrufen.',
  tkWithdrawnBody: 'Der Betrag wird erstattet. Details findest du unter „Mein Pass".',
  tkRetry: 'Noch einmal versuchen',
  tkNoOrder: 'Zu dieser Adresse gehört keine Bestellung. Deine Bestellungen findest du unter „Mein Pass".',
  tkLogin: 'Bitte melde dich an, um den Stand deiner Bestellung zu sehen.',
  tkToPass: 'Zu „Mein Pass"',
  imTitle: 'Lokale Profile ins Konto übernehmen',
  imBody: 'In diesem Browser liegen Lebensläufe aus dem Arbeiten ohne Konto. Wähle aus, was ins Konto soll. Die Kopien im Browser bleiben, bis du sie löschst.',
  imButton: n => (n === 1 ? '1 Profil übernehmen' : `${n} Profile übernehmen`),
  imWorking: (i, n) => `Übernehme ${i} von ${n} …`,
  imDone: n => (n === 1 ? '1 Profil ist jetzt in deinem Konto.' : `${n} Profile sind jetzt in deinem Konto.`),
  imFailed: n => `„${n}" ließ sich nicht übernehmen.`,
  imUpdated: d => `angelegt am ${d}`,
  mpTitle: 'Mein Pass',
  mpUnlimited: 'Dein Konto ist unbegrenzt freigeschaltet.',
  mpPilot: d => `Pilot-Zugang bis ${d}.`,
  mpPassActive: (d, n) => `Bewerbungs-Pass aktiv bis ${d}, noch ${n === 1 ? 'ein Tag' : `${n} Tage`}.`,
  mpPassExpired: d => `Dein Pass ist am ${d} abgelaufen. Lesen und Exportieren gehen weiter.`,
  mpNone: 'Du hast noch keinen Pass. Lesen und Exportieren gehen, Speichern im Konto nicht.',
  mpOrders: 'Bestellungen',
  mpOrdersEmpty: 'Noch keine Bestellungen.',
  mpInvoice: 'Rechnung (PDF)',
  mpStatus: { open: 'offen', pending: 'in Bearbeitung', authorized: 'autorisiert', paid: 'bezahlt', failed: 'fehlgeschlagen', canceled: 'abgebrochen', expired: 'abgelaufen', withdrawn: 'widerrufen', refunded: 'erstattet' },
  mpWithdrawUntil: d => `Widerruf möglich bis ${d}`,
  mpWithdraw: 'Vertrag widerrufen',
  mpWithdrawTitle: 'Widerruf bestätigen?',
  mpWithdrawBody: (no, amt) => `Du widerrufst den Vertrag zur Bestellung ${no}. Der Pass wird um die Tage dieser Bestellung gekürzt, und du bekommst ${amt} zurück.`,
  mpWithdrawConfirm: 'Widerruf bestätigen',
  cancel: 'Abbrechen',
  mpWithdrawDone: (d, t) => `Dein Widerruf ist am ${d} um ${t} Uhr eingegangen. Die Bestätigung ist per E-Mail unterwegs.`,
  mpRefund: s => `Erstattung: ${s}`,
  refundStatus: { queued: 'eingeplant', pending: 'in Bearbeitung', processing: 'in Bearbeitung', refunded: 'erstattet', failed: 'fehlgeschlagen, wir melden uns', canceled: 'abgebrochen' },
  mpLoading: 'Wird geladen …',
  mpLoadFailed: 'Die Bestellungen ließen sich nicht laden.',
  wdTitle: 'Vertrag widerrufen',
  wdLede: 'Du kannst den Kauf eines Bewerbungs-Passes innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen. Du bekommst den vollen Betrag zurück.',
  wdAccountHint: 'Mit Konto geht es auch dort: ⋯ → Mein Pass → Vertrag widerrufen.',
  wdName: 'Dein Name',
  wdEmail: 'E-Mail-Adresse',
  wdEmailHint: 'Die Adresse, mit der du bestellt hast.',
  wdOrderNo: 'Bestellnummer',
  wdOrderNoHint: 'Steht in der Bestellbestätigung und auf der Rechnung.',
  wdStart: 'Vertrag widerrufen',
  wdReviewTitle: 'Bitte prüfe deine Angaben.',
  wdReviewBody: 'Mit „Widerruf bestätigen" erklärst du den Widerruf. Die Eingangsbestätigung bekommst du sofort per E-Mail.',
  wdConfirm: 'Widerruf bestätigen',
  wdBack: 'Angaben ändern',
  wdDoneTitle: 'Dein Widerruf ist eingegangen.',
  wdDoneBody: (d, t, e) => `Eingang: ${d}, ${t} Uhr. Die Bestätigung haben wir an ${e} geschickt. Den Betrag erstatten wir über dieselbe Zahlungsart.`,
  wdNotFound: 'Zu dieser Bestellnummer und E-Mail-Adresse finden wir keine Bestellung. Bitte prüfe beides.',
  wdFields: 'Bitte fülle alle Felder aus.',
  wdNoOrderNo: 'ohne Nummer, Zuordnung über die E-Mail-Adresse',
  cnEffectiveEnd: 'zum Ende der Laufzeit',
  cnPrint: 'Seite drucken oder als PDF sichern',
  cnCancelPass: 'Pass kündigen',
  wdFormTitle: 'Muster-Widerrufsformular',
  wdFormLede: 'Du kannst auch formlos widerrufen, zum Beispiel per E-Mail, oder dieses Formular nutzen. Es ist nicht vorgeschrieben.',
  wdDownload: 'Als Textdatei herunterladen',
  wdCopy: 'Text kopieren',
  wdCopied: 'Kopiert.',
  lgPending: 'Dieser Text wird gerade fertiggestellt. Bis dahin ist der Verkauf geschlossen.',
  lgTranslation: 'Maßgeblich ist die deutsche Fassung.',
  lgVersion: v => `Fassung ${v}`,
};

const en: BillingStrings = {
  locale: 'en-GB',
  home: 'Home',
  toTool: 'Open the tool',
  langLabel: 'Interface language',
  footerLabel: 'Legal',
  pricing: 'Pricing',
  imprint: 'Legal notice',
  privacy: 'Privacy',
  terms: 'Terms',
  withdrawalPolicy: 'Right of withdrawal',
  withdrawLink: 'Withdraw from contract',
  productName: 'Application Pass',
  oneTime: 'one-off',
  priceFacts: d => [`${d} days`, 'no subscription', 'ends by itself', '14-day money back'],
  vatNote: 'Final price. No VAT is charged under the German small business rule (§ 19 UStG).',
  getPass: 'Get the pass',
  extendPass: 'Extend the pass',
  continueFree: 'Continue without an account',
  features: {
    sync: { title: 'Save across devices', body: 'Your résumés are stored on our server and are there on every device you sign in on.' },
    share: { title: 'Share links', body: 'A link instead of an attachment. With an expiry date, revocable at any time, and you see how often it was opened.' },
    versions: { title: 'Versions on the server', body: 'Up to 25 earlier states per résumé, available on every device.' },
    mcp: { title: 'Connect AI (MCP)', body: 'Claude and other MCP programs read and edit your résumé directly, without copy and paste.' },
    apiKeys: { title: 'API keys', body: 'For your own scripts and tools that work with your account.' },
  },
  freeList: n => [
    `All ${n} templates and the cover letter`,
    'PDF, Word (designed and ATS version), HTML, Markdown, JSON',
    'Data stays in your browser, with a backup file',
    'Versions in the browser, LinkedIn import, ATS check',
  ],
  pEyebrow: 'Pricing',
  pH1a: 'Everything in the browser is free.',
  pH1b: p => `The pass costs ${p}, once.`,
  pLede: 'Writing, design, PDF and Word: no account needed. The Application Pass adds what needs a server, for as long as you are applying.',
  freeTitle: 'Without an account',
  freePrice: '€0',
  freeSub: 'No sign-up, no expiry',
  freeCta: 'Start without an account',
  passSub: d => `${d} days for your job search`,
  tableTitle: 'Without an account and with the pass',
  tableFeature: 'Feature',
  tableFree: 'Without account',
  tablePass: 'With pass',
  yes: 'included',
  no: 'not included',
  tableRows: (n, price, d) => [
    { label: `All ${n} templates, cover letter`, free: true, pass: true },
    { label: 'PDF, Word, ATS version, HTML, JSON', free: true, pass: true },
    { label: 'Where your data lives', free: 'In your browser', pass: 'On the server' },
    { label: 'Versions', free: 'In the browser (20)', pass: 'On the server (25)' },
    { label: 'Save across devices', free: 'With a backup file', pass: true },
    { label: 'Share links with expiry, revocation and view count', free: false, pass: true },
    { label: 'Connect AI via MCP', free: 'Markdown bridge', pass: true },
    { label: 'API keys', free: false, pass: true },
    { label: 'Price', free: '€0', pass: `${price} once, ${d} days` },
  ],
  stepsTitle: 'How buying works',
  steps: d => [
    { title: 'Create an account', body: 'E-mail address and password. That is all we need.' },
    { title: 'Review the order', body: 'You see price, term and your right of withdrawal before you order. Payment runs through Mollie.' },
    { title: 'The pass is active', body: `Right after payment, for ${d} days. Then it ends by itself, no cancellation needed.` },
  ],
  faqTitle: 'Questions about the pass',
  faq: (price, d) => [
    { q: `What happens after ${d} days?`, a: 'The pass ends and your account switches to read-only. You can still read, export (PDF, Word, JSON, data export) and delete everything. Editing and new share links need a new pass. We never delete anything without telling you by e-mail first.' },
    { q: 'Is this a subscription?', a: `No. You pay ${price} once. There is no trial that turns into a subscription and no stored payment method for later charges.` },
    { q: 'Can I extend it?', a: `Yes, with another purchase, also before it ends. The new ${d} days are added to the current end date, so you lose no days.` },
    { q: 'How do I withdraw?', a: `Within 14 days of buying: in your account under "My pass" with "Withdraw from contract", or without signing in via the "Withdraw from contract" link at the bottom of every page; then you confirm the withdrawal via a link we send to the e-mail address of the order. You get the full ${price} back, even if you have already used the pass. Your account and your content stay; you can read them, download them as a data export and delete them.` },
    { q: 'Do I need the pass for PDF or Word?', a: 'No. Without an account you get every template, PDF, both Word versions and the other formats, and your data stays in your browser. What belongs to the pass is shown here and on the button before you start.' },
    { q: 'How do I pay?', a: 'Through Mollie, a payment provider based in the Netherlands. You choose the payment method on the Mollie checkout page. We never see card or bank details.' },
    { q: 'Do I get an invoice?', a: 'Yes. It comes as a PDF with the order confirmation by e-mail and is in your account under "My pass".' },
    { q: 'Why does it cost anything?', a: 'Storage, share links and the MCP connection run on a server, and that costs money. That is why they are part of the pass. You can also run the open-source version yourself.' },
  ],
  closing: 'Start without an account. You can still get the pass later.',
  pricingSoon: 'Sales are not open yet. Without an account you can already use everything that runs in the browser.',
  landingEyebrow: 'Pricing',
  landingH: p => `Free in the browser. ${p} once for the pass.`,
  landingLede: 'Templates, PDF and Word are free without an account. The Application Pass adds saving across devices, share links, versions on the server and the AI connection.',
  landingMore: 'See pricing',
  unlock: {
    sync: { title: 'Saving across devices comes with the pass.', body: 'Your résumé is then stored on our server and is there on every device you sign in on.' },
    share: { title: 'Share links come with the pass.', body: 'A link instead of an attachment: with an expiry date, revocable at any time, and you see how often it was opened.' },
    versions: { title: 'Versions on the server come with the pass.', body: 'Up to 25 earlier states per résumé, on every device. In the browser you keep the last 20.' },
    mcp: { title: 'Connecting AI comes with the pass.', body: 'Claude and other MCP programs read and edit your résumé directly. The Markdown bridge to ChatGPT, Claude or another model works without the pass too.' },
    apiKeys: { title: 'API keys come with the pass.', body: 'For your own scripts and tools that work with your account.' },
    account: { title: 'An account with the Application Pass', body: 'Save across devices, share links, versions on the server and the AI connection, for as long as you are applying.' },
  },
  unlockFreeNote: 'PDF and Word stay free without an account.',
  unlockSeeAll: 'Everything the pass includes',
  unlockHaveAccount: 'Already have an account? Sign in',
  close: 'Close',
  regTitle: 'Create an account',
  regSub: 'Next you review the order. Payment only happens in the step after that.',
  email: 'E-mail address',
  password: 'Password',
  passwordHint: 'At least 8 characters.',
  showPw: 'Show password',
  hidePw: 'Hide password',
  age16: 'I am at least 16 years old.',
  privacyNote: ['We use your e-mail address for signing in, the confirmation and the invoice. More in the ', 'privacy policy', '.'],
  regSubmit: 'Create account and continue',
  busy: 'One moment …',
  haveAccount: 'Already have an account? Sign in',
  loginTitle: 'Sign in',
  loginSub: 'Sign in and the order continues.',
  identifier: 'E-mail address or username',
  loginSubmit: 'Sign in and continue',
  noAccount: 'No account yet? Create one',
  twofaLabel: 'Code from the e-mail (6 digits)',
  twofaSubmit: 'Confirm code',
  errEmail: 'Please enter a valid e-mail address.',
  errPwShort: 'The password needs at least 8 characters.',
  errAge16: 'Accounts are available from age 16. Please confirm your age.',
  errAltcha: 'Please wait until the "I am not a robot" check has finished.',
  errGeneric: 'That did not work. Please try again.',
  errTooMany: s => (s ? `Too many attempts. Please wait ${Math.ceil(s / 60)} minutes.` : 'Too many attempts. Please wait a few minutes.'),
  inviteOnly: 'Accounts on this instance are invite-only.',
  confirmBanner: e => `Please confirm your e-mail address. We sent the link to ${e}.`,
  confirmBannerNoMail: 'Please confirm your e-mail address using the link in our e-mail.',
  resend: 'Send again',
  resent: 'Sent. Please also check your spam folder.',
  resendFailed: 'Sending failed. Please try again later.',
  confirming: 'Confirming your e-mail address …',
  confirmedTitle: 'E-mail address confirmed.',
  confirmedBody: 'Thank you. Your account is fully set up.',
  confirmInvalid: 'This link is invalid or has expired. Sign in and request a new one.',
  confirmedChangeTitle: 'E-mail address changed.',
  confirmedChangeBody: e => `From now on ${e} applies. Your previous address gets a message about the change.`,
  confirmEmailTaken: 'This address now belongs to another account. Please choose a different one in the settings.',
  coUnconfirmedTitle: 'Please confirm your e-mail address first.',
  coUnconfirmedBody: e => `That is where we send the invoice, order confirmation and withdrawal information. ${e ? `We sent the link to ${e}.` : 'You will find the link in our e-mail.'} Afterwards you can continue your order right here.`,
  coResend: 'Send confirmation e-mail again',
  dcTitleWithdraw: 'Confirm withdrawal',
  dcTitleCancel: 'Confirm cancellation',
  dcIntroWithdraw: 'You sent a withdrawal through our form. The button confirms it: then we refund the price and the pass ends. The time your declaration was received counts for the deadline, not this click.',
  dcIntroCancel: 'You sent a cancellation through our form. The button confirms it: then the pass ends at the time you chose. The time your declaration was received counts, not this click.',
  dcWhy: 'Why this step: the form works without signing in. The link in the e-mail to the address of the order makes sure only you can end your pass.',
  dcDoneWithdrawTitle: 'Your withdrawal is confirmed.',
  dcDoneWithdrawBody: (no, r, c) => `Order ${no}. Received on ${r}, confirmed on ${c}.`,
  dcDoneCancelTitle: 'Your cancellation is confirmed.',
  dcDoneCancelBody: (no, r, e) => `Order ${no}. Received on ${r}. The pass ends on ${e}.`,
  dcMail: 'The confirmation also comes by e-mail.',
  dcUsedTitle: 'This declaration is already confirmed.',
  dcUsedBody: r => `${r ? `Received on ${r}. ` : ''}There is nothing more you need to do.`,
  dcExpiredTitle: 'This confirmation link has expired.',
  dcExpiredBody: r => `Your declaration has still reached us${r ? ` (on ${r})` : ''}. We will get back to you by e-mail. You can also send it again.`,
  dcInvalidTitle: 'This confirmation link is not valid.',
  dcInvalidBody: 'Please use the complete link from our latest e-mail. You can also send the declaration again.',
  dcManualTitle: 'This could not be done automatically.',
  dcManualBody: 'Your declaration has reached us. We will get back to you by e-mail within two working days.',
  dcAgainWithdraw: 'Send the withdrawal again',
  dcAgainCancel: 'Send the cancellation again',
  continue: 'Continue',
  coTitle: 'Review your order',
  coSteps: ['Account', 'Order', 'Payment'],
  coStepOf: (n, t) => `Step ${n} of ${t}`,
  coSignedInAs: w => `Signed in as ${w}`,
  coSignOut: 'Sign out',
  billingName: 'Name for the invoice',
  billingNameHint: 'This is how it appears on the invoice.',
  coOtherCountry: 'Other country',
  country: 'Country',
  countryHint: 'For the invoice and our VAT obligations.',
  summaryTitle: 'Your order',
  sumProduct: 'Product',
  sumIncluded: 'Included',
  sumTerm: 'Term',
  sumTermText: (d, end, later) => later
    ? `${d} days, added to your current pass, so until ${end}.`
    : `${d} days from payment, so until ${end}.`,
  sumNoRenewal: 'Ends by itself. No renewal, no subscription, nothing to cancel.',
  sumTotal: 'Total price',
  sumPayment: 'Payment',
  sumPaymentText: 'Through Mollie. You choose the payment method on the next page.',
  sumPaymentMethods: l => `Through Mollie: ${l}. You choose the payment method on the next page.`,
  sumWithdrawal: 'Withdrawal',
  sumWithdrawalText: '14 days. If you withdraw, you get the full amount back, even if you have already used the pass.',
  acceptTerms: ['I have read and accept the ', 'terms', '.'],
  ackWithdrawal: ['I have taken note of the ', 'withdrawal policy', '.'],
  age18: 'I am of legal age (at least 18).',
  orderButton: 'Order with obligation to pay',
  orderBusy: 'Redirecting to Mollie …',
  orderAfter: 'You will be redirected to Mollie, where you can still cancel. Payment is only complete once Mollie confirms it.',
  errTerms: 'Please confirm that you have read the terms.',
  errWithdrawal: 'Please confirm that you have taken note of the withdrawal policy.',
  errAge18: 'You need to be 18 to buy.',
  errName: 'Please enter a name for the invoice.',
  errClosed: 'Sales are not open right now.',
  activeUntil: d => `Your pass runs until ${d}. A new purchase extends it from that day.`,
  unlimitedNote: 'Your account already has unlimited access. You do not need a pass.',
  tkChecking: 'Asking Mollie about your payment …',
  tkOrderNo: n => `Order ${n}`,
  tkPaidTitle: 'Your pass is active.',
  tkPaidBody: d => `It runs until ${d} and then ends by itself.`,
  tkMail: 'The order confirmation with invoice and withdrawal policy is on its way by e-mail.',
  tkToEditor: 'Open the editor',
  tkOpenTitle: 'The payment is not confirmed yet.',
  tkOpenBody: 'Some payment methods take a few minutes, a bank transfer longer. This page keeps checking. You can also close it: as soon as the payment arrives your pass is active and the confirmation comes by e-mail.',
  tkStill: 'Still checking …',
  tkReload: 'Check now',
  tkFailedTitle: 'The payment failed.',
  tkFailedBody: 'Nothing was charged. You can try again with the same or another payment method.',
  tkCanceledTitle: 'You cancelled the payment.',
  tkCanceledBody: 'Nothing was charged, and no order is pending.',
  tkExpiredTitle: 'The payment expired.',
  tkExpiredBody: 'Nothing was charged. Simply start the order again.',
  tkWithdrawnTitle: 'This order has been withdrawn.',
  tkWithdrawnBody: 'The amount is being refunded. Details are under "My pass".',
  tkRetry: 'Try again',
  tkNoOrder: 'There is no order for this address. You find your orders under "My pass".',
  tkLogin: 'Please sign in to see the status of your order.',
  tkToPass: 'Go to "My pass"',
  imTitle: 'Move local profiles into your account',
  imBody: 'This browser holds résumés from working without an account. Choose what should go into your account. The copies in the browser stay until you delete them.',
  imButton: n => (n === 1 ? 'Move 1 profile' : `Move ${n} profiles`),
  imWorking: (i, n) => `Moving ${i} of ${n} …`,
  imDone: n => (n === 1 ? '1 profile is now in your account.' : `${n} profiles are now in your account.`),
  imFailed: n => `"${n}" could not be moved.`,
  imUpdated: d => `created ${d}`,
  mpTitle: 'My pass',
  mpUnlimited: 'Your account has unlimited access.',
  mpPilot: d => `Pilot access until ${d}.`,
  mpPassActive: (d, n) => `Application Pass active until ${d}, ${n === 1 ? '1 day' : `${n} days`} left.`,
  mpPassExpired: d => `Your pass ended on ${d}. Reading and exporting still work.`,
  mpNone: 'You do not have a pass yet. Reading and exporting work, saving in the account does not.',
  mpOrders: 'Orders',
  mpOrdersEmpty: 'No orders yet.',
  mpInvoice: 'Invoice (PDF)',
  mpStatus: { open: 'open', pending: 'pending', authorized: 'authorised', paid: 'paid', failed: 'failed', canceled: 'cancelled', expired: 'expired', withdrawn: 'withdrawn', refunded: 'refunded' },
  mpWithdrawUntil: d => `Withdrawal possible until ${d}`,
  mpWithdraw: 'Withdraw from contract',
  mpWithdrawTitle: 'Confirm withdrawal?',
  mpWithdrawBody: (no, amt) => `You are withdrawing from the contract for order ${no}. The pass is shortened by the days of this order, and you get ${amt} back.`,
  mpWithdrawConfirm: 'Confirm withdrawal',
  cancel: 'Cancel',
  mpWithdrawDone: (d, t) => `Your withdrawal was received on ${d} at ${t}. The confirmation is on its way by e-mail.`,
  mpRefund: s => `Refund: ${s}`,
  refundStatus: { queued: 'scheduled', pending: 'in progress', processing: 'in progress', refunded: 'refunded', failed: 'failed, we will contact you', canceled: 'cancelled' },
  mpLoading: 'Loading …',
  mpLoadFailed: 'The orders could not be loaded.',
  wdTitle: 'Withdraw from contract',
  wdLede: 'You can withdraw from the purchase of an Application Pass within 14 days without giving reasons. You get the full amount back.',
  wdAccountHint: 'With an account you can also do it there: ⋯ → My pass → Withdraw from contract.',
  wdName: 'Your name',
  wdEmail: 'E-mail address',
  wdEmailHint: 'The address you ordered with.',
  wdOrderNo: 'Order number',
  wdOrderNoHint: 'It is in the order confirmation and on the invoice.',
  wdStart: 'Withdraw from contract',
  wdReviewTitle: 'Please check your details.',
  wdReviewBody: 'With "Confirm withdrawal" you declare the withdrawal. You get the confirmation of receipt by e-mail right away.',
  wdConfirm: 'Confirm withdrawal',
  wdBack: 'Change details',
  wdDoneTitle: 'Your withdrawal has been received.',
  wdDoneBody: (d, t, e) => `Received: ${d}, ${t}. We sent the confirmation to ${e}. We refund the amount via the same payment method.`,
  wdNotFound: 'We cannot find an order with this order number and e-mail address. Please check both.',
  wdFields: 'Please fill in all fields.',
  wdNoOrderNo: 'no number, matched by e-mail address',
  cnEffectiveEnd: 'at the end of the term',
  cnPrint: 'Print or save this page as PDF',
  cnCancelPass: 'Cancel the pass',
  wdFormTitle: 'Model withdrawal form',
  wdFormLede: 'You can also withdraw informally, for example by e-mail, or use this form. It is not mandatory.',
  wdDownload: 'Download as text file',
  wdCopy: 'Copy text',
  wdCopied: 'Copied.',
  lgPending: 'This text is being finalised. Sales stay closed until then.',
  lgTranslation: 'This is a translation for convenience. The German version is the legally binding one.',
  lgVersion: v => `Version ${v}`,
};

const fr: BillingStrings = {
  locale: 'fr-FR',
  home: 'Accueil',
  toTool: 'Ouvrir l’outil',
  langLabel: 'Langue de l’interface',
  footerLabel: 'Mentions légales',
  pricing: 'Tarifs',
  imprint: 'Mentions légales',
  privacy: 'Confidentialité',
  terms: 'CGV',
  withdrawalPolicy: 'Droit de rétractation',
  withdrawLink: 'Se rétracter du contrat',
  productName: 'Pass candidature',
  oneTime: 'en une fois',
  priceFacts: d => [`${d} jours`, 'pas d’abonnement', 'prend fin tout seul', 'remboursé sous 14 jours'],
  vatNote: 'Prix final. Pas de TVA facturée (régime des petites entreprises, § 19 UStG).',
  getPass: 'Obtenir le pass',
  extendPass: 'Prolonger le pass',
  continueFree: 'Continuer sans compte',
  features: {
    sync: { title: 'Enregistrer sur plusieurs appareils', body: 'Vos CV sont stockés sur notre serveur et disponibles sur chaque appareil où vous êtes connecté.' },
    share: { title: 'Liens de partage', body: 'Un lien au lieu d’une pièce jointe. Avec date d’expiration, révocable à tout moment, et vous voyez combien de fois il a été ouvert.' },
    versions: { title: 'Versions sur le serveur', body: 'Jusqu’à 25 états antérieurs par CV, accessibles sur chaque appareil.' },
    mcp: { title: 'Connecter une IA (MCP)', body: 'Claude et d’autres programmes MCP lisent et modifient directement votre CV, sans copier-coller.' },
    apiKeys: { title: 'Clés API', body: 'Pour vos propres scripts et outils qui travaillent avec votre compte.' },
  },
  freeList: n => [
    `Les ${n} modèles et la lettre de motivation`,
    'PDF, Word (mis en page et version ATS), HTML, Markdown, JSON',
    'Les données restent dans votre navigateur, avec fichier de sauvegarde',
    'Versions dans le navigateur, import LinkedIn, contrôle ATS',
  ],
  pEyebrow: 'Tarifs',
  pH1a: 'Tout ce qui tourne dans le navigateur est gratuit.',
  pH1b: p => `Le pass coûte ${p}, une seule fois.`,
  pLede: 'Rédiger, mettre en page, PDF et Word : sans compte. Le Pass candidature ajoute ce qui a besoin d’un serveur, le temps de vos candidatures.',
  freeTitle: 'Sans compte',
  freePrice: '0 €',
  freeSub: 'Sans inscription, sans date de fin',
  freeCta: 'Commencer sans compte',
  passSub: d => `${d} jours pour votre recherche d’emploi`,
  tableTitle: 'Sans compte et avec le pass',
  tableFeature: 'Fonction',
  tableFree: 'Sans compte',
  tablePass: 'Avec le pass',
  yes: 'inclus',
  no: 'non inclus',
  tableRows: (n, price, d) => [
    { label: `Les ${n} modèles, lettre de motivation`, free: true, pass: true },
    { label: 'PDF, Word, version ATS, HTML, JSON', free: true, pass: true },
    { label: 'Où sont vos données', free: 'Dans votre navigateur', pass: 'Sur le serveur' },
    { label: 'Versions', free: 'Dans le navigateur (20)', pass: 'Sur le serveur (25)' },
    { label: 'Enregistrer sur plusieurs appareils', free: 'Avec fichier de sauvegarde', pass: true },
    { label: 'Liens de partage avec expiration, révocation et compteur', free: false, pass: true },
    { label: 'Connecter une IA via MCP', free: 'Pont Markdown', pass: true },
    { label: 'Clés API', free: false, pass: true },
    { label: 'Prix', free: '0 €', pass: `${price} une fois, ${d} jours` },
  ],
  stepsTitle: 'Comment se passe l’achat',
  steps: d => [
    { title: 'Créer un compte', body: 'Adresse e-mail et mot de passe. Il ne nous faut rien de plus.' },
    { title: 'Vérifier la commande', body: 'Vous voyez le prix, la durée et le droit de rétractation avant de commander. Le paiement passe par Mollie.' },
    { title: 'Le pass est actif', body: `Dès le paiement, pour ${d} jours. Ensuite il prend fin tout seul, sans résiliation.` },
  ],
  faqTitle: 'Questions sur le pass',
  faq: (price, d) => [
    { q: `Que se passe-t-il après ${d} jours ?`, a: 'Le pass prend fin et votre compte passe en lecture seule. Vous pouvez toujours tout lire, exporter (PDF, Word, JSON, export des données) et supprimer. Modifier et créer de nouveaux liens de partage demandent un nouveau pass. Nous ne supprimons rien sans vous prévenir d’abord par e-mail.' },
    { q: 'Est-ce un abonnement ?', a: `Non. Vous payez ${price} une seule fois. Pas de période d’essai qui devient un abonnement, pas de moyen de paiement enregistré pour des prélèvements ultérieurs.` },
    { q: 'Puis-je prolonger ?', a: `Oui, avec un nouvel achat, aussi avant la fin. Les ${d} nouveaux jours s’ajoutent à la date de fin actuelle, vous ne perdez aucun jour.` },
    { q: 'Comment me rétracter ?', a: `Dans les 14 jours suivant l’achat : dans votre compte sous « Mon pass » avec « Se rétracter du contrat », ou sans connexion via le lien « Se rétracter du contrat » en bas de chaque page ; vous confirmez alors la rétractation via un lien envoyé à l’adresse e-mail de la commande. Vous récupérez les ${price}, même si vous avez déjà utilisé le pass. Votre compte et vos contenus restent ; vous pouvez les lire, les télécharger sous forme d’export de données et les supprimer.` },
    { q: 'Ai-je besoin du pass pour le PDF ou Word ?', a: 'Non. Sans compte, vous avez tous les modèles, le PDF, les deux versions Word et les autres formats, et vos données restent dans votre navigateur. Ce qui relève du pass est indiqué ici et sur le bouton avant que vous ne commenciez.' },
    { q: 'Comment payer ?', a: 'Via Mollie, un prestataire de paiement basé aux Pays-Bas. Vous choisissez le moyen de paiement sur la page de Mollie. Nous ne voyons ni carte ni coordonnées bancaires.' },
    { q: 'Est-ce que je reçois une facture ?', a: 'Oui. Elle arrive en PDF avec la confirmation de commande par e-mail et se trouve dans votre compte sous « Mon pass ».' },
    { q: 'Pourquoi est-ce payant ?', a: 'Le stockage, les liens de partage et la connexion MCP tournent sur un serveur, et il coûte de l’argent. C’est pourquoi ils font partie du pass. Vous pouvez aussi héberger vous-même la version open source.' },
  ],
  closing: 'Commencez sans compte. Vous pourrez toujours prendre le pass plus tard.',
  pricingSoon: 'La vente n’est pas encore ouverte. Sans compte, vous pouvez déjà utiliser tout ce qui tourne dans le navigateur.',
  landingEyebrow: 'Tarifs',
  landingH: p => `Gratuit dans le navigateur. ${p} une fois pour le pass.`,
  landingLede: 'Modèles, PDF et Word sont gratuits sans compte. Le Pass candidature ajoute l’enregistrement sur plusieurs appareils, les liens de partage, les versions sur le serveur et la connexion IA.',
  landingMore: 'Voir les tarifs',
  unlock: {
    sync: { title: 'L’enregistrement sur plusieurs appareils est inclus dans le pass.', body: 'Votre CV est alors stocké sur notre serveur et disponible sur chaque appareil où vous êtes connecté.' },
    share: { title: 'Les liens de partage sont inclus dans le pass.', body: 'Un lien au lieu d’une pièce jointe : avec date d’expiration, révocable à tout moment, et vous voyez combien de fois il a été ouvert.' },
    versions: { title: 'Les versions sur le serveur sont incluses dans le pass.', body: 'Jusqu’à 25 états antérieurs par CV, sur chaque appareil. Dans le navigateur, vous gardez les 20 derniers.' },
    mcp: { title: 'La connexion IA est incluse dans le pass.', body: 'Claude et d’autres programmes MCP lisent et modifient directement votre CV. Le pont Markdown vers ChatGPT, Claude ou un autre modèle fonctionne aussi sans pass.' },
    apiKeys: { title: 'Les clés API sont incluses dans le pass.', body: 'Pour vos propres scripts et outils qui travaillent avec votre compte.' },
    account: { title: 'Un compte avec le Pass candidature', body: 'Enregistrement sur plusieurs appareils, liens de partage, versions sur le serveur et connexion IA, le temps de vos candidatures.' },
  },
  unlockFreeNote: 'PDF et Word restent gratuits sans compte.',
  unlockSeeAll: 'Tout ce que contient le pass',
  unlockHaveAccount: 'Déjà un compte ? Se connecter',
  close: 'Fermer',
  regTitle: 'Créer un compte',
  regSub: 'Ensuite vous vérifiez la commande. Le paiement n’a lieu qu’à l’étape suivante.',
  email: 'Adresse e-mail',
  password: 'Mot de passe',
  passwordHint: 'Au moins 8 caractères.',
  showPw: 'Afficher le mot de passe',
  hidePw: 'Masquer le mot de passe',
  age16: 'J’ai au moins 16 ans.',
  privacyNote: ['Nous utilisons votre adresse e-mail pour la connexion, la confirmation et la facture. Plus de détails dans la ', 'politique de confidentialité', '.'],
  regSubmit: 'Créer le compte et continuer',
  busy: 'Un instant …',
  haveAccount: 'Déjà un compte ? Se connecter',
  loginTitle: 'Se connecter',
  loginSub: 'Connectez-vous, puis la commande continue.',
  identifier: 'Adresse e-mail ou nom d’utilisateur',
  loginSubmit: 'Se connecter et continuer',
  noAccount: 'Pas encore de compte ? En créer un',
  twofaLabel: 'Code reçu par e-mail (6 chiffres)',
  twofaSubmit: 'Valider le code',
  errEmail: 'Veuillez saisir une adresse e-mail valide.',
  errPwShort: 'Le mot de passe doit comporter au moins 8 caractères.',
  errAge16: 'Un compte est possible à partir de 16 ans. Veuillez confirmer votre âge.',
  errAltcha: 'Veuillez attendre la fin de la vérification « Je ne suis pas un robot ».',
  errGeneric: 'Cela n’a pas fonctionné. Veuillez réessayer.',
  errTooMany: s => (s ? `Trop de tentatives. Veuillez patienter ${Math.ceil(s / 60)} minutes.` : 'Trop de tentatives. Veuillez patienter quelques minutes.'),
  inviteOnly: 'Sur cette instance, les comptes sont uniquement sur invitation.',
  confirmBanner: e => `Veuillez confirmer votre adresse e-mail. Nous avons envoyé le lien à ${e}.`,
  confirmBannerNoMail: 'Veuillez confirmer votre adresse e-mail avec le lien de notre message.',
  resend: 'Renvoyer',
  resent: 'Envoyé. Pensez à vérifier vos spams.',
  resendFailed: 'L’envoi a échoué. Veuillez réessayer plus tard.',
  confirming: 'Confirmation de l’adresse e-mail …',
  confirmedTitle: 'Adresse e-mail confirmée.',
  confirmedBody: 'Merci. Votre compte est entièrement configuré.',
  confirmInvalid: 'Ce lien n’est pas valide ou a expiré. Connectez-vous et demandez-en un nouveau.',
  confirmedChangeTitle: 'Adresse e-mail modifiée.',
  confirmedChangeBody: e => `Désormais, c’est ${e} qui compte. L’ancienne adresse reçoit un message signalant le changement.`,
  confirmEmailTaken: 'Cette adresse appartient désormais à un autre compte. Choisissez-en une autre dans les paramètres.',
  coUnconfirmedTitle: 'Veuillez d’abord confirmer votre adresse e-mail.',
  coUnconfirmedBody: e => `C’est là que nous envoyons la facture, la confirmation de commande et les informations sur la rétractation. ${e ? `Nous avons envoyé le lien à ${e}.` : 'Le lien se trouve dans notre e-mail.'} Ensuite, vous pouvez continuer votre commande ici.`,
  coResend: 'Renvoyer l’e-mail de confirmation',
  dcTitleWithdraw: 'Confirmer la rétractation',
  dcTitleCancel: 'Confirmer la résiliation',
  dcIntroWithdraw: 'Vous avez envoyé une rétractation via notre formulaire. Le bouton la confirme : nous remboursons alors le prix et le pass prend fin. Pour le délai, c’est la réception de votre déclaration qui compte, pas ce clic.',
  dcIntroCancel: 'Vous avez envoyé une résiliation via notre formulaire. Le bouton la confirme : le pass prend alors fin au moment choisi. C’est la réception de votre déclaration qui compte, pas ce clic.',
  dcWhy: 'Pourquoi cette étape : le formulaire fonctionne sans connexion. Le lien envoyé à l’adresse de la commande garantit que vous seul pouvez mettre fin à votre pass.',
  dcDoneWithdrawTitle: 'Votre rétractation est confirmée.',
  dcDoneWithdrawBody: (no, r, c) => `Commande ${no}. Reçue le ${r}, confirmée le ${c}.`,
  dcDoneCancelTitle: 'Votre résiliation est confirmée.',
  dcDoneCancelBody: (no, r, e) => `Commande ${no}. Reçue le ${r}. Le pass prend fin le ${e}.`,
  dcMail: 'La confirmation arrive aussi par e-mail.',
  dcUsedTitle: 'Cette déclaration est déjà confirmée.',
  dcUsedBody: r => `${r ? `Reçue le ${r}. ` : ''}Vous n’avez plus rien à faire.`,
  dcExpiredTitle: 'Ce lien de confirmation a expiré.',
  dcExpiredBody: r => `Votre déclaration nous est quand même parvenue${r ? ` (le ${r})` : ''}. Nous vous répondons par e-mail. Vous pouvez aussi l’envoyer à nouveau.`,
  dcInvalidTitle: 'Ce lien de confirmation n’est pas valide.',
  dcInvalidBody: 'Utilisez le lien complet de notre dernier e-mail. Vous pouvez aussi envoyer la déclaration à nouveau.',
  dcManualTitle: 'Cela n’a pas pu se faire automatiquement.',
  dcManualBody: 'Votre déclaration nous est parvenue. Nous vous répondons par e-mail sous deux jours ouvrés.',
  dcAgainWithdraw: 'Envoyer à nouveau la rétractation',
  dcAgainCancel: 'Envoyer à nouveau la résiliation',
  continue: 'Continuer',
  coTitle: 'Vérifier la commande',
  coSteps: ['Compte', 'Commande', 'Paiement'],
  coStepOf: (n, t) => `Étape ${n} sur ${t}`,
  coSignedInAs: w => `Connecté en tant que ${w}`,
  coSignOut: 'Se déconnecter',
  billingName: 'Nom sur la facture',
  billingNameHint: 'C’est ainsi qu’il apparaîtra sur la facture.',
  coOtherCountry: 'Autre pays',
  country: 'Pays',
  countryHint: 'Pour la facture et nos obligations de TVA.',
  summaryTitle: 'Votre commande',
  sumProduct: 'Produit',
  sumIncluded: 'Inclus',
  sumTerm: 'Durée',
  sumTermText: (d, end, later) => later
    ? `${d} jours, ajoutés à votre pass en cours, donc jusqu’au ${end}.`
    : `${d} jours à partir du paiement, donc jusqu’au ${end}.`,
  sumNoRenewal: 'Prend fin tout seul. Pas de reconduction, pas d’abonnement, rien à résilier.',
  sumTotal: 'Prix total',
  sumPayment: 'Paiement',
  sumPaymentText: 'Via Mollie. Vous choisissez le moyen de paiement sur la page suivante.',
  sumPaymentMethods: l => `Via Mollie : ${l}. Vous choisissez le moyen de paiement sur la page suivante.`,
  sumWithdrawal: 'Rétractation',
  sumWithdrawalText: '14 jours. En cas de rétractation, vous récupérez la totalité du montant, même si vous avez déjà utilisé le pass.',
  acceptTerms: ['J’ai lu et j’accepte les ', 'CGV', '.'],
  ackWithdrawal: ['J’ai pris connaissance des ', 'informations sur le droit de rétractation', '.'],
  age18: 'Je suis majeur (au moins 18 ans).',
  orderButton: 'Commander avec obligation de paiement',
  orderBusy: 'Redirection vers Mollie …',
  orderAfter: 'Vous serez redirigé vers Mollie, où vous pouvez encore annuler. Le paiement n’est effectif qu’une fois confirmé par Mollie.',
  errTerms: 'Veuillez confirmer avoir lu les CGV.',
  errWithdrawal: 'Veuillez confirmer avoir pris connaissance du droit de rétractation.',
  errAge18: 'L’achat est possible à partir de 18 ans.',
  errName: 'Veuillez indiquer un nom pour la facture.',
  errClosed: 'La vente n’est pas ouverte en ce moment.',
  activeUntil: d => `Votre pass court jusqu’au ${d}. Un nouvel achat le prolonge à partir de ce jour.`,
  unlimitedNote: 'Votre compte a déjà un accès illimité. Vous n’avez pas besoin de pass.',
  tkChecking: 'Nous demandons à Mollie l’état de votre paiement …',
  tkOrderNo: n => `Commande ${n}`,
  tkPaidTitle: 'Votre pass est actif.',
  tkPaidBody: d => `Il court jusqu’au ${d} puis prend fin tout seul.`,
  tkMail: 'La confirmation de commande avec facture et informations sur la rétractation arrive par e-mail.',
  tkToEditor: 'Ouvrir l’éditeur',
  tkOpenTitle: 'Le paiement n’est pas encore confirmé.',
  tkOpenBody: 'Certains moyens de paiement prennent quelques minutes, un virement plus longtemps. Cette page continue de vérifier. Vous pouvez aussi la fermer : dès que le paiement arrive, votre pass est actif et la confirmation arrive par e-mail.',
  tkStill: 'Vérification en cours …',
  tkReload: 'Vérifier maintenant',
  tkFailedTitle: 'Le paiement a échoué.',
  tkFailedBody: 'Rien n’a été débité. Vous pouvez réessayer avec le même moyen de paiement ou un autre.',
  tkCanceledTitle: 'Vous avez annulé le paiement.',
  tkCanceledBody: 'Rien n’a été débité et aucune commande n’est en attente.',
  tkExpiredTitle: 'Le paiement a expiré.',
  tkExpiredBody: 'Rien n’a été débité. Relancez simplement la commande.',
  tkWithdrawnTitle: 'Cette commande a fait l’objet d’une rétractation.',
  tkWithdrawnBody: 'Le montant est remboursé. Les détails sont dans « Mon pass ».',
  tkRetry: 'Réessayer',
  tkNoOrder: 'Aucune commande ne correspond à cette adresse. Vos commandes se trouvent dans « Mon pass ».',
  tkLogin: 'Veuillez vous connecter pour voir l’état de votre commande.',
  tkToPass: 'Aller à « Mon pass »',
  imTitle: 'Transférer les profils locaux dans le compte',
  imBody: 'Ce navigateur contient des CV créés sans compte. Choisissez ce qui doit aller dans votre compte. Les copies dans le navigateur restent jusqu’à ce que vous les supprimiez.',
  imButton: n => (n === 1 ? 'Transférer 1 profil' : `Transférer ${n} profils`),
  imWorking: (i, n) => `Transfert ${i} sur ${n} …`,
  imDone: n => (n === 1 ? '1 profil est maintenant dans votre compte.' : `${n} profils sont maintenant dans votre compte.`),
  imFailed: n => `« ${n} » n’a pas pu être transféré.`,
  imUpdated: d => `créé le ${d}`,
  mpTitle: 'Mon pass',
  mpUnlimited: 'Votre compte a un accès illimité.',
  mpPilot: d => `Accès pilote jusqu’au ${d}.`,
  mpPassActive: (d, n) => `Pass candidature actif jusqu’au ${d}, encore ${n === 1 ? '1 jour' : `${n} jours`}.`,
  mpPassExpired: d => `Votre pass a pris fin le ${d}. Lire et exporter restent possibles.`,
  mpNone: 'Vous n’avez pas encore de pass. Lire et exporter fonctionnent, enregistrer dans le compte non.',
  mpOrders: 'Commandes',
  mpOrdersEmpty: 'Pas encore de commande.',
  mpInvoice: 'Facture (PDF)',
  mpStatus: { open: 'ouverte', pending: 'en cours', authorized: 'autorisée', paid: 'payée', failed: 'échouée', canceled: 'annulée', expired: 'expirée', withdrawn: 'rétractée', refunded: 'remboursée' },
  mpWithdrawUntil: d => `Rétractation possible jusqu’au ${d}`,
  mpWithdraw: 'Se rétracter du contrat',
  mpWithdrawTitle: 'Confirmer la rétractation ?',
  mpWithdrawBody: (no, amt) => `Vous vous rétractez du contrat de la commande ${no}. Le pass est raccourci des jours de cette commande et vous récupérez ${amt}.`,
  mpWithdrawConfirm: 'Confirmer la rétractation',
  cancel: 'Annuler',
  mpWithdrawDone: (d, t) => `Votre rétractation a été reçue le ${d} à ${t}. La confirmation arrive par e-mail.`,
  mpRefund: s => `Remboursement : ${s}`,
  refundStatus: { queued: 'planifié', pending: 'en cours', processing: 'en cours', refunded: 'remboursé', failed: 'échoué, nous vous contactons', canceled: 'annulé' },
  mpLoading: 'Chargement …',
  mpLoadFailed: 'Les commandes n’ont pas pu être chargées.',
  wdTitle: 'Se rétracter du contrat',
  wdLede: 'Vous pouvez vous rétracter de l’achat d’un Pass candidature dans les 14 jours sans donner de motif. Vous récupérez la totalité du montant.',
  wdAccountHint: 'Avec un compte, c’est aussi possible là-bas : ⋯ → Mon pass → Se rétracter du contrat.',
  wdName: 'Votre nom',
  wdEmail: 'Adresse e-mail',
  wdEmailHint: 'L’adresse utilisée pour la commande.',
  wdOrderNo: 'Numéro de commande',
  wdOrderNoHint: 'Il figure dans la confirmation de commande et sur la facture.',
  wdStart: 'Se rétracter du contrat',
  wdReviewTitle: 'Veuillez vérifier vos informations.',
  wdReviewBody: 'Avec « Confirmer la rétractation », vous déclarez la rétractation. Vous recevez immédiatement l’accusé de réception par e-mail.',
  wdConfirm: 'Confirmer la rétractation',
  wdBack: 'Modifier',
  wdDoneTitle: 'Votre rétractation a été reçue.',
  wdDoneBody: (d, t, e) => `Reçue le ${d} à ${t}. Nous avons envoyé la confirmation à ${e}. Nous remboursons le montant par le même moyen de paiement.`,
  wdNotFound: 'Aucune commande ne correspond à ce numéro et à cette adresse e-mail. Veuillez vérifier les deux.',
  wdFields: 'Veuillez remplir tous les champs.',
  wdNoOrderNo: 'sans numéro, attribution par l’adresse e-mail',
  cnEffectiveEnd: 'à la fin de la durée',
  cnPrint: 'Imprimer ou enregistrer en PDF',
  cnCancelPass: 'Résilier le pass',
  wdFormTitle: 'Modèle de formulaire de rétractation',
  wdFormLede: 'Vous pouvez aussi vous rétracter sans formalité, par exemple par e-mail, ou utiliser ce formulaire. Il n’est pas obligatoire.',
  wdDownload: 'Télécharger en fichier texte',
  wdCopy: 'Copier le texte',
  wdCopied: 'Copié.',
  lgPending: 'Ce texte est en cours de finalisation. La vente reste fermée d’ici là.',
  lgTranslation: 'Traduction fournie pour information. Seule la version allemande fait foi.',
  lgVersion: v => `Version ${v}`,
};

const es: BillingStrings = {
  locale: 'es-ES',
  home: 'Inicio',
  toTool: 'Abrir la herramienta',
  langLabel: 'Idioma de la interfaz',
  footerLabel: 'Aviso legal',
  pricing: 'Precios',
  imprint: 'Aviso legal',
  privacy: 'Privacidad',
  terms: 'Condiciones',
  withdrawalPolicy: 'Derecho de desistimiento',
  withdrawLink: 'Desistir del contrato',
  productName: 'Pase de candidatura',
  oneTime: 'pago único',
  priceFacts: d => [`${d} días`, 'sin suscripción', 'termina solo', '14 días de devolución'],
  vatNote: 'Precio final. No se cobra IVA (régimen de pequeñas empresas, § 19 UStG).',
  getPass: 'Conseguir el pase',
  extendPass: 'Ampliar el pase',
  continueFree: 'Seguir sin cuenta',
  features: {
    sync: { title: 'Guardar en varios dispositivos', body: 'Tus currículums se guardan en nuestro servidor y están en cada dispositivo en el que inicies sesión.' },
    share: { title: 'Enlaces para compartir', body: 'Un enlace en lugar de un adjunto. Con fecha de caducidad, revocable en cualquier momento, y ves cuántas veces se abrió.' },
    versions: { title: 'Versiones en el servidor', body: 'Hasta 25 estados anteriores por currículum, disponibles en cada dispositivo.' },
    mcp: { title: 'Conectar IA (MCP)', body: 'Claude y otros programas MCP leen y editan tu currículum directamente, sin copiar y pegar.' },
    apiKeys: { title: 'Claves API', body: 'Para tus propios scripts y herramientas que trabajan con tu cuenta.' },
  },
  freeList: n => [
    `Las ${n} plantillas y la carta de presentación`,
    'PDF, Word (con diseño y versión ATS), HTML, Markdown, JSON',
    'Los datos se quedan en tu navegador, con archivo de copia',
    'Versiones en el navegador, importación de LinkedIn, revisión ATS',
  ],
  pEyebrow: 'Precios',
  pH1a: 'Todo lo que funciona en el navegador es gratis.',
  pH1b: p => `El pase cuesta ${p}, una sola vez.`,
  pLede: 'Escribir, diseñar, PDF y Word: sin cuenta. El Pase de candidatura añade lo que necesita un servidor, mientras dure tu búsqueda.',
  freeTitle: 'Sin cuenta',
  freePrice: '0 €',
  freeSub: 'Sin registro, sin fecha de fin',
  freeCta: 'Empezar sin cuenta',
  passSub: d => `${d} días para tu búsqueda de empleo`,
  tableTitle: 'Sin cuenta y con el pase',
  tableFeature: 'Función',
  tableFree: 'Sin cuenta',
  tablePass: 'Con el pase',
  yes: 'incluido',
  no: 'no incluido',
  tableRows: (n, price, d) => [
    { label: `Las ${n} plantillas, carta de presentación`, free: true, pass: true },
    { label: 'PDF, Word, versión ATS, HTML, JSON', free: true, pass: true },
    { label: 'Dónde están tus datos', free: 'En tu navegador', pass: 'En el servidor' },
    { label: 'Versiones', free: 'En el navegador (20)', pass: 'En el servidor (25)' },
    { label: 'Guardar en varios dispositivos', free: 'Con archivo de copia', pass: true },
    { label: 'Enlaces con caducidad, revocación y contador de visitas', free: false, pass: true },
    { label: 'Conectar IA por MCP', free: 'Puente Markdown', pass: true },
    { label: 'Claves API', free: false, pass: true },
    { label: 'Precio', free: '0 €', pass: `${price} una vez, ${d} días` },
  ],
  stepsTitle: 'Así funciona la compra',
  steps: d => [
    { title: 'Crear una cuenta', body: 'Correo electrónico y contraseña. No necesitamos más.' },
    { title: 'Revisar el pedido', body: 'Ves el precio, la duración y el derecho de desistimiento antes de pedir. El pago se hace con Mollie.' },
    { title: 'El pase está activo', body: `Justo después del pago, durante ${d} días. Luego termina solo, sin cancelar nada.` },
  ],
  faqTitle: 'Preguntas sobre el pase',
  faq: (price, d) => [
    { q: `¿Qué pasa después de ${d} días?`, a: 'El pase termina y tu cuenta pasa a solo lectura. Puedes seguir leyendo, exportando (PDF, Word, JSON, exportación de datos) y borrando todo. Editar y crear enlaces nuevos requiere un pase nuevo. No borramos nada sin avisarte antes por correo.' },
    { q: '¿Es una suscripción?', a: `No. Pagas ${price} una vez. No hay periodo de prueba que se convierta en suscripción ni un medio de pago guardado para cargos posteriores.` },
    { q: '¿Puedo ampliarlo?', a: `Sí, con otra compra, también antes de que termine. Los ${d} días nuevos se suman a la fecha de fin actual, no pierdes ningún día.` },
    { q: '¿Cómo desisto?', a: `En los 14 días siguientes a la compra: en tu cuenta en «Mi pase» con «Desistir del contrato», o sin iniciar sesión con el enlace «Desistir del contrato» al pie de cada página; entonces confirmas el desistimiento con un enlace que enviamos al correo del pedido. Recibes los ${price} completos, aunque ya hayas usado el pase. Tu cuenta y tus contenidos se quedan; puedes leerlos, descargarlos como exportación de datos y borrarlos.` },
    { q: '¿Necesito el pase para el PDF o Word?', a: 'No. Sin cuenta tienes todas las plantillas, el PDF, las dos versiones de Word y los demás formatos, y tus datos se quedan en tu navegador. Lo que forma parte del pase se indica aquí y en el botón antes de empezar.' },
    { q: '¿Cómo pago?', a: 'Con Mollie, un proveedor de pagos de los Países Bajos. Eliges el medio de pago en la página de Mollie. Nunca vemos datos de tarjeta ni de cuenta.' },
    { q: '¿Recibo una factura?', a: 'Sí. Llega en PDF con la confirmación del pedido por correo y está en tu cuenta en «Mi pase».' },
    { q: '¿Por qué cuesta algo?', a: 'El almacenamiento, los enlaces y la conexión MCP funcionan en un servidor, y eso cuesta dinero. Por eso forman parte del pase. También puedes alojar tú mismo la versión de código abierto.' },
  ],
  closing: 'Empieza sin cuenta. El pase lo puedes conseguir más tarde.',
  pricingSoon: 'La venta aún no está abierta. Sin cuenta ya puedes usar todo lo que funciona en el navegador.',
  landingEyebrow: 'Precios',
  landingH: p => `Gratis en el navegador. ${p} una vez por el pase.`,
  landingLede: 'Plantillas, PDF y Word son gratis sin cuenta. El Pase de candidatura añade guardar en varios dispositivos, enlaces para compartir, versiones en el servidor y la conexión con IA.',
  landingMore: 'Ver precios',
  unlock: {
    sync: { title: 'Guardar en varios dispositivos viene con el pase.', body: 'Tu currículum se guarda entonces en nuestro servidor y está en cada dispositivo en el que inicies sesión.' },
    share: { title: 'Los enlaces para compartir vienen con el pase.', body: 'Un enlace en lugar de un adjunto: con fecha de caducidad, revocable en cualquier momento, y ves cuántas veces se abrió.' },
    versions: { title: 'Las versiones en el servidor vienen con el pase.', body: 'Hasta 25 estados anteriores por currículum, en cada dispositivo. En el navegador conservas los últimos 20.' },
    mcp: { title: 'Conectar IA viene con el pase.', body: 'Claude y otros programas MCP leen y editan tu currículum directamente. El puente Markdown a ChatGPT, Claude u otro modelo funciona también sin pase.' },
    apiKeys: { title: 'Las claves API vienen con el pase.', body: 'Para tus propios scripts y herramientas que trabajan con tu cuenta.' },
    account: { title: 'Una cuenta con el Pase de candidatura', body: 'Guardar en varios dispositivos, enlaces para compartir, versiones en el servidor y la conexión con IA, mientras dure tu búsqueda.' },
  },
  unlockFreeNote: 'PDF y Word siguen siendo gratis sin cuenta.',
  unlockSeeAll: 'Todo lo que incluye el pase',
  unlockHaveAccount: '¿Ya tienes cuenta? Iniciar sesión',
  close: 'Cerrar',
  regTitle: 'Crear una cuenta',
  regSub: 'Después revisas el pedido. El pago llega en el paso siguiente.',
  email: 'Correo electrónico',
  password: 'Contraseña',
  passwordHint: 'Al menos 8 caracteres.',
  showPw: 'Mostrar contraseña',
  hidePw: 'Ocultar contraseña',
  age16: 'Tengo al menos 16 años.',
  privacyNote: ['Usamos tu correo para el inicio de sesión, la confirmación y la factura. Más información en la ', 'política de privacidad', '.'],
  regSubmit: 'Crear cuenta y continuar',
  busy: 'Un momento …',
  haveAccount: '¿Ya tienes cuenta? Iniciar sesión',
  loginTitle: 'Iniciar sesión',
  loginSub: 'Inicia sesión y el pedido continúa.',
  identifier: 'Correo electrónico o nombre de usuario',
  loginSubmit: 'Iniciar sesión y continuar',
  noAccount: '¿Aún sin cuenta? Crear una',
  twofaLabel: 'Código del correo (6 cifras)',
  twofaSubmit: 'Confirmar código',
  errEmail: 'Introduce un correo electrónico válido.',
  errPwShort: 'La contraseña necesita al menos 8 caracteres.',
  errAge16: 'Las cuentas son a partir de 16 años. Confirma tu edad.',
  errAltcha: 'Espera a que termine la comprobación «No soy un robot».',
  errGeneric: 'No ha funcionado. Inténtalo de nuevo.',
  errTooMany: s => (s ? `Demasiados intentos. Espera ${Math.ceil(s / 60)} minutos.` : 'Demasiados intentos. Espera unos minutos.'),
  inviteOnly: 'En esta instancia las cuentas son solo por invitación.',
  confirmBanner: e => `Confirma tu correo electrónico. Te hemos enviado el enlace a ${e}.`,
  confirmBannerNoMail: 'Confirma tu correo electrónico con el enlace de nuestro mensaje.',
  resend: 'Reenviar',
  resent: 'Enviado. Revisa también la carpeta de spam.',
  resendFailed: 'No se pudo enviar. Inténtalo más tarde.',
  confirming: 'Confirmando tu correo electrónico …',
  confirmedTitle: 'Correo electrónico confirmado.',
  confirmedBody: 'Gracias. Tu cuenta está completamente configurada.',
  confirmInvalid: 'El enlace no es válido o ha caducado. Inicia sesión y pide uno nuevo.',
  confirmedChangeTitle: 'Correo electrónico cambiado.',
  confirmedChangeBody: e => `A partir de ahora vale ${e}. Tu dirección anterior recibe un aviso del cambio.`,
  confirmEmailTaken: 'Esta dirección pertenece ahora a otra cuenta. Elige otra en los ajustes.',
  coUnconfirmedTitle: 'Primero confirma tu correo electrónico.',
  coUnconfirmedBody: e => `Allí enviamos la factura, la confirmación del pedido y la información sobre el desistimiento. ${e ? `Te enviamos el enlace a ${e}.` : 'El enlace está en nuestro correo.'} Después puedes seguir con el pedido aquí mismo.`,
  coResend: 'Reenviar el correo de confirmación',
  dcTitleWithdraw: 'Confirmar desistimiento',
  dcTitleCancel: 'Confirmar cancelación',
  dcIntroWithdraw: 'Enviaste un desistimiento con nuestro formulario. El botón lo confirma: entonces devolvemos el precio y el pase termina. Para el plazo cuenta la recepción de tu declaración, no este clic.',
  dcIntroCancel: 'Enviaste una cancelación con nuestro formulario. El botón la confirma: entonces el pase termina en el momento que elegiste. Cuenta la recepción de tu declaración, no este clic.',
  dcWhy: 'Por qué este paso: el formulario funciona sin iniciar sesión. El enlace enviado al correo del pedido garantiza que solo tú puedes terminar tu pase.',
  dcDoneWithdrawTitle: 'Tu desistimiento está confirmado.',
  dcDoneWithdrawBody: (no, r, c) => `Pedido ${no}. Recibido el ${r}, confirmado el ${c}.`,
  dcDoneCancelTitle: 'Tu cancelación está confirmada.',
  dcDoneCancelBody: (no, r, e) => `Pedido ${no}. Recibida el ${r}. El pase termina el ${e}.`,
  dcMail: 'La confirmación llega también por correo.',
  dcUsedTitle: 'Esta declaración ya está confirmada.',
  dcUsedBody: r => `${r ? `Recibida el ${r}. ` : ''}No tienes que hacer nada más.`,
  dcExpiredTitle: 'Este enlace de confirmación ha caducado.',
  dcExpiredBody: r => `Tu declaración nos ha llegado igualmente${r ? ` (el ${r})` : ''}. Te escribimos por correo. También puedes enviarla de nuevo.`,
  dcInvalidTitle: 'Este enlace de confirmación no es válido.',
  dcInvalidBody: 'Usa el enlace completo de nuestro último correo. También puedes enviar la declaración de nuevo.',
  dcManualTitle: 'No se pudo hacer automáticamente.',
  dcManualBody: 'Tu declaración nos ha llegado. Te escribimos por correo en dos días laborables.',
  dcAgainWithdraw: 'Enviar de nuevo el desistimiento',
  dcAgainCancel: 'Enviar de nuevo la cancelación',
  continue: 'Continuar',
  coTitle: 'Revisar el pedido',
  coSteps: ['Cuenta', 'Pedido', 'Pago'],
  coStepOf: (n, t) => `Paso ${n} de ${t}`,
  coSignedInAs: w => `Sesión iniciada como ${w}`,
  coSignOut: 'Cerrar sesión',
  billingName: 'Nombre para la factura',
  billingNameHint: 'Así aparece en la factura.',
  coOtherCountry: 'Otro país',
  country: 'País',
  countryHint: 'Para la factura y nuestras obligaciones de IVA.',
  summaryTitle: 'Tu pedido',
  sumProduct: 'Producto',
  sumIncluded: 'Incluye',
  sumTerm: 'Duración',
  sumTermText: (d, end, later) => later
    ? `${d} días, añadidos a tu pase actual, es decir, hasta el ${end}.`
    : `${d} días desde el pago, es decir, hasta el ${end}.`,
  sumNoRenewal: 'Termina solo. Sin renovación, sin suscripción, nada que cancelar.',
  sumTotal: 'Precio total',
  sumPayment: 'Pago',
  sumPaymentText: 'Con Mollie. Eliges el medio de pago en la página siguiente.',
  sumPaymentMethods: l => `Con Mollie: ${l}. Eliges el medio de pago en la página siguiente.`,
  sumWithdrawal: 'Desistimiento',
  sumWithdrawalText: '14 días. Si desistes, recibes el importe completo, aunque ya hayas usado el pase.',
  acceptTerms: ['He leído y acepto las ', 'condiciones', '.'],
  ackWithdrawal: ['He tomado nota de la ', 'información sobre el desistimiento', '.'],
  age18: 'Soy mayor de edad (al menos 18 años).',
  orderButton: 'Pedido con obligación de pago',
  orderBusy: 'Redirigiendo a Mollie …',
  orderAfter: 'Te llevamos a Mollie, donde aún puedes cancelar. El pago solo está hecho cuando Mollie lo confirma.',
  errTerms: 'Confirma que has leído las condiciones.',
  errWithdrawal: 'Confirma que has tomado nota de la información sobre el desistimiento.',
  errAge18: 'Puedes comprar a partir de 18 años.',
  errName: 'Introduce un nombre para la factura.',
  errClosed: 'La venta no está abierta en este momento.',
  activeUntil: d => `Tu pase dura hasta el ${d}. Una compra nueva lo amplía desde ese día.`,
  unlimitedNote: 'Tu cuenta ya tiene acceso ilimitado. No necesitas un pase.',
  tkChecking: 'Preguntando a Mollie por el estado de tu pago …',
  tkOrderNo: n => `Pedido ${n}`,
  tkPaidTitle: 'Tu pase está activo.',
  tkPaidBody: d => `Dura hasta el ${d} y luego termina solo.`,
  tkMail: 'La confirmación del pedido con la factura y la información sobre el desistimiento va de camino por correo.',
  tkToEditor: 'Abrir el editor',
  tkOpenTitle: 'El pago aún no está confirmado.',
  tkOpenBody: 'Algunos medios de pago tardan unos minutos, una transferencia más. Esta página sigue comprobando. También puedes cerrarla: en cuanto llegue el pago, tu pase estará activo y la confirmación llegará por correo.',
  tkStill: 'Seguimos comprobando …',
  tkReload: 'Comprobar ahora',
  tkFailedTitle: 'El pago ha fallado.',
  tkFailedBody: 'No se ha cobrado nada. Puedes intentarlo de nuevo con el mismo medio de pago u otro.',
  tkCanceledTitle: 'Has cancelado el pago.',
  tkCanceledBody: 'No se ha cobrado nada y no queda ningún pedido abierto.',
  tkExpiredTitle: 'El pago ha caducado.',
  tkExpiredBody: 'No se ha cobrado nada. Vuelve a empezar el pedido.',
  tkWithdrawnTitle: 'Has desistido de este pedido.',
  tkWithdrawnBody: 'El importe se está devolviendo. Los detalles están en «Mi pase».',
  tkRetry: 'Intentar de nuevo',
  tkNoOrder: 'No hay ningún pedido para esta dirección. Tus pedidos están en «Mi pase».',
  tkLogin: 'Inicia sesión para ver el estado de tu pedido.',
  tkToPass: 'Ir a «Mi pase»',
  imTitle: 'Pasar los perfiles locales a la cuenta',
  imBody: 'En este navegador hay currículums creados sin cuenta. Elige qué debe pasar a tu cuenta. Las copias del navegador se quedan hasta que las borres.',
  imButton: n => (n === 1 ? 'Pasar 1 perfil' : `Pasar ${n} perfiles`),
  imWorking: (i, n) => `Pasando ${i} de ${n} …`,
  imDone: n => (n === 1 ? '1 perfil está ahora en tu cuenta.' : `${n} perfiles están ahora en tu cuenta.`),
  imFailed: n => `«${n}» no se pudo pasar.`,
  imUpdated: d => `creado el ${d}`,
  mpTitle: 'Mi pase',
  mpUnlimited: 'Tu cuenta tiene acceso ilimitado.',
  mpPilot: d => `Acceso piloto hasta el ${d}.`,
  mpPassActive: (d, n) => `Pase de candidatura activo hasta el ${d}, ${n === 1 ? 'queda 1 día' : `quedan ${n} días`}.`,
  mpPassExpired: d => `Tu pase terminó el ${d}. Leer y exportar siguen funcionando.`,
  mpNone: 'Aún no tienes pase. Leer y exportar funcionan, guardar en la cuenta no.',
  mpOrders: 'Pedidos',
  mpOrdersEmpty: 'Aún no hay pedidos.',
  mpInvoice: 'Factura (PDF)',
  mpStatus: { open: 'abierto', pending: 'en proceso', authorized: 'autorizado', paid: 'pagado', failed: 'fallido', canceled: 'cancelado', expired: 'caducado', withdrawn: 'desistido', refunded: 'devuelto' },
  mpWithdrawUntil: d => `Desistimiento posible hasta el ${d}`,
  mpWithdraw: 'Desistir del contrato',
  mpWithdrawTitle: '¿Confirmar el desistimiento?',
  mpWithdrawBody: (no, amt) => `Desistes del contrato del pedido ${no}. El pase se acorta en los días de este pedido y recibes ${amt}.`,
  mpWithdrawConfirm: 'Confirmar desistimiento',
  cancel: 'Cancelar',
  mpWithdrawDone: (d, t) => `Tu desistimiento se recibió el ${d} a las ${t}. La confirmación va de camino por correo.`,
  mpRefund: s => `Devolución: ${s}`,
  refundStatus: { queued: 'programada', pending: 'en curso', processing: 'en curso', refunded: 'devuelto', failed: 'fallida, te contactaremos', canceled: 'cancelada' },
  mpLoading: 'Cargando …',
  mpLoadFailed: 'No se pudieron cargar los pedidos.',
  wdTitle: 'Desistir del contrato',
  wdLede: 'Puedes desistir de la compra de un Pase de candidatura en un plazo de 14 días sin indicar motivos. Recibes el importe completo.',
  wdAccountHint: 'Con cuenta también puedes hacerlo allí: ⋯ → Mi pase → Desistir del contrato.',
  wdName: 'Tu nombre',
  wdEmail: 'Correo electrónico',
  wdEmailHint: 'La dirección con la que hiciste el pedido.',
  wdOrderNo: 'Número de pedido',
  wdOrderNoHint: 'Aparece en la confirmación del pedido y en la factura.',
  wdStart: 'Desistir del contrato',
  wdReviewTitle: 'Revisa tus datos.',
  wdReviewBody: 'Con «Confirmar desistimiento» declaras el desistimiento. Recibes el acuse de recibo por correo al momento.',
  wdConfirm: 'Confirmar desistimiento',
  wdBack: 'Cambiar datos',
  wdDoneTitle: 'Hemos recibido tu desistimiento.',
  wdDoneBody: (d, t, e) => `Recibido: ${d}, ${t}. Hemos enviado la confirmación a ${e}. Devolvemos el importe por el mismo medio de pago.`,
  wdNotFound: 'No encontramos ningún pedido con este número y este correo. Revisa ambos.',
  wdFields: 'Rellena todos los campos.',
  wdNoOrderNo: 'sin número, asignación por el correo',
  cnEffectiveEnd: 'al final de la duración',
  cnPrint: 'Imprimir o guardar como PDF',
  cnCancelPass: 'Cancelar el pase',
  wdFormTitle: 'Modelo de formulario de desistimiento',
  wdFormLede: 'También puedes desistir sin formalidades, por ejemplo por correo, o usar este formulario. No es obligatorio.',
  wdDownload: 'Descargar como archivo de texto',
  wdCopy: 'Copiar texto',
  wdCopied: 'Copiado.',
  lgPending: 'Este texto se está terminando. Hasta entonces la venta sigue cerrada.',
  lgTranslation: 'Traducción informativa. Solo la versión alemana es vinculante.',
  lgVersion: v => `Versión ${v}`,
};

export const BILLING_I18N: Record<UiLang, BillingStrings> = { de, en, fr, es };

/** Datum in der Oberflächensprache, deutsche Zeit (Laufzeiten rechnet der
 *  Server in Europe/Berlin). */
export function fmtDate(iso: string, lang: UiLang): string {
  try {
    return new Date(iso).toLocaleDateString(BILLING_I18N[lang].locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  } catch { return iso.slice(0, 10); }
}
export function fmtTime(iso: string, lang: UiLang): string {
  try {
    return new Date(iso).toLocaleTimeString(BILLING_I18N[lang].locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
  } catch { return iso.slice(11, 16); }
}
