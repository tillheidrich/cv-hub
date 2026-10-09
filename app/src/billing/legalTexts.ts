/**
 * Schnittstelle zu den Vertragstexten unter app/src/legal/.
 *
 * Die Texte selbst schreibt und verantwortet der Rechtstexte-Teil
 * (agb.ts, widerruf.ts, bestellung.ts, kuendigung.ts,
 * datenschutzBezahlung.ts, mails.ts) als typisierte Objekte
 * `{ version, de, en }` mit Platzhaltern wie {{SELLER_NAME}}, {{PRICE}}.
 * Diese Datei wählt die Sprache, füllt die Platzhalter und gibt die Texte
 * den Seiten.
 *
 * Gefüllt wird mit
 *  - den Anbieterdaten aus data/operator.ts (dieselbe Quelle wie das
 *    Impressum, keine zweite Kopie),
 *  - Preis, Laufzeit und Produktname aus GET /api/billing/offer.
 *
 * Sprachen: Vertrag, AGB und Belehrung gibt es auf Deutsch (maßgeblich) und
 * Englisch (Lesehilfe); fr/es lesen dort Englisch mit Hinweis. Die Bedientexte
 * (Bestellübersicht, Widerrufs- und Kündigungsformular) gibt es zusätzlich
 * auf Französisch und Spanisch (ui/i18n/billingLegal.ts).
 */
import type { UiLang } from '../ui/i18n';
import { OPERATOR, operatorAddressLine } from '../data/operator';
import {
  AGB, WIDERRUF, BESTELLUNG, KUENDIGUNG, DATENSCHUTZ_BEZAHLUNG, READING_AID_NOTICE,
  fillPlaceholders,
} from '../legal';
import type { Bilingual, LegalSection, PlaceholderValues, CancellationTexts, WithdrawalFunction } from '../legal';
import { ORDER_UI, WITHDRAW_FN, CANCEL_UI, type OrderUiTexts } from '../ui/i18n/billingLegal';
import { formatPrice, type Offer } from './api';

export type ContractLang = 'de' | 'en';

/** Vertragstexte gibt es auf Deutsch und Englisch; fr/es lesen Englisch. */
export function legalLang(lang: UiLang): ContractLang {
  return lang === 'de' ? 'de' : 'en';
}

const LOCALE: Record<UiLang, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };

/** Ohne PRODUCT_NAME heißt das Produkt wie beim Server (mailtexts): CV-Hub. */
export function productNameOf(offer: Offer | null): string {
  return (offer?.productName || '').trim() || 'CV-Hub';
}

/** Platzhalter aus Anbieterdaten und Angebot. Zahlungsarten: aus dem Angebot
 *  (`paymentMethods`, z. B. aus der Mollie-Methodenliste), sonst ein Satz,
 *  dass die Auswahl bei Mollie steht. § 312j Abs. 1 BGB verlangt die
 *  konkreten Zahlungsmittel — der Rückfall ist nur ein Notbehelf, bis der
 *  Server sie mitliefert. */
export function legalVars(offer: Offer | null, lang: UiLang): PlaceholderValues {
  const L = legalLang(lang);
  const methodsFallback: Record<UiLang, string> = {
    de: 'den Zahlungsarten, die Mollie auf der Bezahlseite anbietet',
    en: 'the payment methods Mollie offers on the payment page',
    fr: 'les moyens de paiement proposés par Mollie sur la page de paiement',
    es: 'los medios de pago que Mollie ofrece en la página de pago',
  };
  return {
    SELLER_NAME: OPERATOR.tradeName,
    SELLER_ADDRESS: operatorAddressLine(L),
    SELLER_EMAIL: OPERATOR.email,
    SELLER_PHONE: OPERATOR.phone ?? '',
    PRODUCT_NAME: productNameOf(offer),
    PRICE: offer ? formatPrice(offer.priceCents, offer.currency, LOCALE[lang], true) : '',
    DAYS: offer ? String(offer.days) : '90',
    BASE_URL: typeof window !== 'undefined' ? window.location.origin : '',
    PAYMENT_METHODS: offer?.paymentMethods?.length ? offer.paymentMethods.join(', ') : methodsFallback[lang],
    TERMS_VERSION: AGB.version,
  };
}

/** Platzhalter füllen. Fehlt die Telefonnummer (OPERATOR.phone), fällt die
 *  Angabe „Telefon: …" weg, statt als „Telefon: ," stehen zu bleiben.
 *  Unbekannte Platzhalter bleiben sichtbar — billingcheck findet sie. */
export function fill(text: string, vars: PlaceholderValues): string {
  let t = text;
  if (!vars.SELLER_PHONE) {
    t = t.replace(/(Telefon|Phone|Téléphone|Teléfono)\s+\{\{SELLER_PHONE\}\},\s*/g, '');
    t = t.replace(/^\s*(Telefon|Phone|Téléphone|Teléfono)\s*:?\s*\{\{SELLER_PHONE\}\}\s*$/gm, '');
    t = t.replace(/,?\s*(Telefon|Phone|Téléphone|Teléfono)\s*:?\s*\{\{SELLER_PHONE\}\}/g, '');
  }
  return fillPlaceholders(t, vars);
}

/** Alle Zeichenketten eines Objekts füllen (rekursiv, Arrays eingeschlossen). */
export function fillDeep<T>(obj: T, vars: PlaceholderValues): T {
  if (typeof obj === 'string') return fill(obj, vars) as unknown as T;
  if (Array.isArray(obj)) return obj.map(x => fillDeep(x, vars)).filter(x => x !== '') as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) out[k] = fillDeep(v, vars);
    return out as T;
  }
  return obj;
}

/** Ein zweisprachiges Dokument in der passenden Fassung, gefüllt. */
export function contract<T>(doc: Bilingual<T>, lang: UiLang, offer: Offer | null): { t: T; version: string; translated: boolean; notice: string | null } {
  const L = legalLang(lang);
  return {
    t: fillDeep(doc[L], legalVars(offer, lang)),
    version: doc.version,
    translated: L !== 'de',
    notice: L === 'de' ? null : READING_AID_NOTICE.en,
  };
}

export const terms = (lang: UiLang, offer: Offer | null) => contract(AGB, lang, offer);
export const withdrawal = (lang: UiLang, offer: Offer | null) => contract(WIDERRUF, lang, offer);
export const privacyBilling = (lang: UiLang, offer: Offer | null) => contract(DATENSCHUTZ_BEZAHLUNG, lang, offer);

/** Bedientexte der Bestellübersicht: de/en aus legal/bestellung.ts, fr/es
 *  aus ui/i18n/billingLegal.ts — gleiche Gestalt, gleiche Platzhalter. */
export function orderUi(lang: UiLang, offer: Offer | null): OrderUiTexts {
  const src: OrderUiTexts = lang === 'fr' || lang === 'es' ? ORDER_UI[lang] : BESTELLUNG[lang];
  const vars = legalVars(offer, lang);
  const filled = fillDeep(src, vars);
  // „CV-Hub – Bewerbungs-Pass" steht schon im Namen; ein leerer
  // Produktname hinterließe sonst „ – Bewerbungs-Pass".
  filled.summary.productLine = filled.summary.productLine.replace(/^\s*[–-]\s*/, '');
  return filled;
}

export function withdrawFn(lang: UiLang, offer: Offer | null): WithdrawalFunction {
  const src = lang === 'fr' || lang === 'es' ? WITHDRAW_FN[lang] : WIDERRUF[lang].fn;
  return fillDeep(src, legalVars(offer, lang));
}

export function cancelUi(lang: UiLang, offer: Offer | null): CancellationTexts {
  const src = lang === 'fr' || lang === 'es' ? CANCEL_UI[lang] : KUENDIGUNG[lang];
  return fillDeep(src, legalVars(offer, lang));
}

/** Text des Muster-Widerrufsformulars (legal/widerruf.ts → form), gefüllt. */
export function modelWithdrawalForm(lang: UiLang, offer: Offer | null): string {
  const f = withdrawal(lang, offer).t.form;
  return [f.title, '', f.intro, '', ...f.lines.flatMap((l, i) => (i === 0 ? [l, ''] : [l, '______________', ''])), f.footnote].join('\n');
}

export type { LegalSection };
