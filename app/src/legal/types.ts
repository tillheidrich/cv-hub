/**
 * Gemeinsame Typen und Platzhalter für die Rechtstexte rund um den
 * Bewerbungs-Pass (Ordner `src/legal`, Stand 2026-10-09).
 *
 * KEINE RECHTSBERATUNG. Die Texte sind ein fachlich begründeter Entwurf
 * (Belege: Recherche, nicht Teil dieses Repositorys). Vor dem Livegang anwaltlich
 * prüfen lassen.
 *
 * Regeln für alle Dateien in diesem Ordner:
 * - Verkäuferdaten stehen NIE im Text, nur als Platzhalter. Gefüllt wird zur
 *   Laufzeit (Frontend: aus `data/operator.ts`; Server/Mails: aus den
 *   Env-Variablen SELLER_*).
 * - `de` ist die maßgebliche Fassung. `en` ist eine Lesehilfe; jede englische
 *   Seite zeigt `READING_AID_NOTICE.en` gut sichtbar oben.
 * - Wird ein Text inhaltlich geändert: `version` hochsetzen. Der Server
 *   speichert zu jeder Bestellung die AGB- und Belehrungs-Version
 *   (TERMS_VERSION), damit später belegbar ist, was galt.
 */

export type LegalLang = 'de' | 'en';

/** Ein Rechtstext in beiden Sprachen mit gemeinsamer Version. */
export interface Bilingual<T> {
  /** ISO-Datum der Fassung, z. B. '2026-10-09'. */
  version: string;
  de: T;
  en: T;
}

/** Ein Abschnitt eines längeren Rechtstexts (AGB, Datenschutz). */
export interface LegalSection {
  /** Stabiler Anker für Links, z. B. 'widerruf'. */
  id: string;
  title: string;
  /** Absätze. Nummerierte Absätze tragen ihre Nummer im Text, z. B. '(1) …'. */
  paragraphs: string[];
  /** Optionale Aufzählung nach den Absätzen. */
  list?: string[];
  /** Optionale Absätze nach der Aufzählung. */
  after?: string[];
}

/** Eine Mail: Betreff und reiner Text (der Server kann daraus HTML machen). */
export interface MailText {
  subject: string;
  /** Zeilen; leere Zeichenkette = Leerzeile. */
  body: string[];
}

/**
 * Alle Platzhalter, die in diesem Ordner vorkommen. Die ersten sieben sind
 * im Schnittstellenvertrag festgelegt, die übrigen braucht es für Mails und
 * Bestellübersicht.
 */
export const PLACEHOLDERS = {
  SELLER_NAME: 'Firmierung des Verkäufers (Env SELLER_NAME)',
  SELLER_ADDRESS: 'Ladungsfähige Anschrift in einer Zeile (Env SELLER_ADDRESS)',
  SELLER_EMAIL: 'E-Mail des Verkäufers (Env SELLER_EMAIL)',
  SELLER_PHONE: 'Telefonnummer des Verkäufers, Pflicht nach Art. 246a § 1 Abs. 1 Nr. 3 EGBGB (Env SELLER_PHONE)',
  PRODUCT_NAME: 'Produktname (Env PRODUCT_NAME)',
  PRICE: 'Preis formatiert, z. B. „9,00 €" / "€9.00" (aus PASS_PRICE_CENTS)',
  DAYS: 'Laufzeit in Tagen, z. B. „90" (Env PASS_DAYS)',
  BASE_URL: 'Öffentliche Adresse ohne Schrägstrich am Ende, z. B. https://cv.example.com',
  PAYMENT_METHODS: 'Aktivierte Zahlungsarten als Text, z. B. „Kreditkarte, Apple Pay, PayPal"',
  ORDER_NO: 'Bestellnummer',
  ORDER_DATE: 'Datum und Uhrzeit des Vertragsschlusses (Europe/Berlin)',
  INVOICE_NO: 'Rechnungsnummer (INVOICE_PREFIX + laufende Nummer)',
  PASS_UNTIL: 'Neues Ende des Passes (Datum, Europe/Berlin)',
  WITHDRAWABLE_UNTIL: 'Letzter Tag der Widerrufsfrist (Datum, Europe/Berlin)',
  CUSTOMER_NAME: 'Name des Kunden (Rechnungsname)',
  CUSTOMER_EMAIL: 'E-Mail-Adresse des Kunden',
  RECEIVED_AT: 'Datum und Uhrzeit des Eingangs einer Erklärung (Europe/Berlin, mit Sekunden)',
  REFUND_STATUS: 'Stand der Erstattung in Worten',
  CANCEL_EFFECTIVE: 'Zeitpunkt, zu dem eine Kündigung wirkt',
  CANCEL_KIND: 'Art der Kündigung in Worten',
  CANCEL_REASON: 'Kündigungsgrund (nur bei außerordentlicher Kündigung, sonst „—")',
  CONFIRM_URL: 'Link zur Bestätigung der E-Mail-Adresse',
  TERMS_VERSION: 'Version der AGB (Env TERMS_VERSION)',
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDERS;
export type PlaceholderValues = Partial<Record<PlaceholderKey, string>>;

/**
 * Ersetzt `{{SCHLÜSSEL}}` durch Werte. Fehlende Werte bleiben sichtbar als
 * `{{SCHLÜSSEL}}` stehen — das ist Absicht: ein ungefüllter Platzhalter soll
 * im Test auffallen und nie still verschwinden.
 */
export function fillPlaceholders(text: string, values: PlaceholderValues): string {
  return text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key: string) => {
    const v = values[key as PlaceholderKey];
    return v === undefined ? whole : v;
  });
}

/** Findet ungefüllte Platzhalter (für Tests und eine Startprüfung). */
export function missingPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{([A-Z_]+)\}\}/g)) found.add(m[1]);
  return [...found];
}

/** Hinweis, der über jeder englischen Fassung stehen muss. */
export const READING_AID_NOTICE: Bilingual<string> = {
  version: '2026-10-09',
  de: 'Die englische Fassung ist eine Lesehilfe. Maßgeblich ist allein die deutsche Fassung.',
  en: 'This English version is provided for convenience only. Only the German version is legally binding.',
};

/** Hinweis für interne Kopfzeilen und Code-Kommentare, nicht für Kunden. */
export const NOT_LEGAL_ADVICE =
  'Entwurf ohne Rechtsberatung. Vor Livegang anwaltlich prüfen lassen.';
