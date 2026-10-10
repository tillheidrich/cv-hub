/**
 * FAQ der Startseite mit den Werten, die gerade gelten (Vorlagenzahl, Preis,
 * Gratis-Grenze, offene Registrierung). Eine Funktion für die sichtbare FAQ
 * und für den FAQPage-Datenblock der vorgerenderten Seite.
 */
import type { Offer } from '../billing/api';
import { priceOf } from '../billing/format';
import { freeTierLimited } from '../billing/freeTier';
import { registrationOpen } from '../billing/hooks';
import { PICKABLE_THEMES } from '../templates/theme';
import { FREETIER_I18N } from '../ui/i18n/freetier';
import type { UiLang } from '../ui/i18n';
import { BRAND } from './brand.js';
import { faqItems } from './copy';

export function faqFor(lang: UiLang, offer: Offer | null) {
  return faqItems(lang, {
    brand: BRAND.name,
    n: PICKABLE_THEMES.length,
    price: priceOf(offer, lang),
    days: offer?.days ?? 90,
    hasOffer: !!offer,
    registrationOpen: registrationOpen(offer),
    limitedAccess: freeTierLimited(offer) ? FREETIER_I18N[lang].landingFaqAccess : null,
    limited: freeTierLimited(offer),
  });
}
