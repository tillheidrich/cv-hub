/**
 * Anbieter dieser Instanz — die EINE Stelle im Frontend, an der Name,
 * Anschrift und Kontakt stehen.
 *
 * Gelesen von: Impressum und Datenschutz (screens/LegalPages.tsx), den
 * Vertragstexten rund um den Bewerbungs-Pass (billing/legalTexts.ts füllt
 * damit {{SELLER_NAME}}, {{SELLER_ADDRESS}} …), dem Muster-Widerrufsformular
 * und dem „Inhalt melden"-Link geteilter Lebensläufe.
 *
 * VOR DEM BETRIEB AUSFÜLLEN: Die Werte unten sind Platzhalter. Wer CV-Hub
 * betreibt, trägt hier die eigenen Angaben ein und baut das Frontend neu.
 * Rechnungen und Mails nimmt der Server aus SELLER_NAME, SELLER_ADDRESS,
 * SELLER_EMAIL und SELLER_PHONE — die Werte dort sollen mit diesen hier
 * übereinstimmen.
 */
export interface Operator {
  /** Name der natürlichen Person (Impressum, § 5 DDG). */
  name: string;
  /** Geschäftsbezeichnung als Verkäufer (AGB, Rechnung). */
  tradeName: string;
  street: string;
  postalCode: string;
  city: string;
  country: { de: string; en: string };
  email: string;
  /** Website des Anbieters (ohne Protokoll). */
  web: string | null;
  /** Telefon: für das bezahlte Angebot Pflicht (Art. 246a § 1 Abs. 1 Nr. 3
   *  EGBGB). Eine geschäftliche Nummer — keine private eintragen. Solange
   *  sie fehlt, steht in Impressum und AGB nur die E-Mail-Adresse. */
  phone: string | null;
  /** Kleinunternehmer nach § 19 UStG: Preise sind Endpreise ohne USt. */
  smallBusiness: boolean;
}

// Vor dem Betrieb ausfüllen — Platzhalter, keine echten Angaben.
export const OPERATOR: Operator = {
  name: 'Your Name',
  tradeName: 'Your Name',
  street: 'Example Street 1',
  postalCode: '12345',
  city: 'Example City',
  country: { de: 'Deutschland', en: 'Germany' },
  email: 'contact@example.com',
  web: 'example.com',
  phone: null,
  smallBusiness: true,
};

/** Anschrift in einer Zeile, z. B. für {{SELLER_ADDRESS}}. */
export function operatorAddressLine(lang: 'de' | 'en' = 'de'): string {
  const o = OPERATOR;
  return `${o.street}, ${o.postalCode} ${o.city}, ${o.country[lang]}`;
}
