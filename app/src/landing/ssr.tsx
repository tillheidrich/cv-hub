/**
 * Einstieg für das Vorrendern beim Bau (scripts/landing-prerender.mjs).
 *
 *   vite build --config src/landing/vite.ssr.config.ts
 *   → node_modules/.cache/landing-ssr/ssr.mjs
 *
 * Rendert die echte LandingScreen- bzw. PricingPage-Komponente mit
 * react-dom/server zu HTML, ohne Browser (kein Chromium im Bau-Image). Dazu
 * die Daten, die der Kopf der Seite braucht (Texte, FAQ, Vorlagenzahl), aus
 * denselben Quellen wie die Seite selbst.
 */
import { renderToString } from 'react-dom/server';
import LandingScreen, { type LandingSsr } from '../screens/LandingScreen';
import PricingPage from '../billing/PricingPage';
import type { Offer } from '../billing/api';
import { billingFor, priceOf } from '../billing/format';
import { PICKABLE_THEMES } from '../templates/theme';
import type { UiLang } from '../ui/i18n';
import { LANDING_COPY, LANDING_LANGS, landingPath } from './copy';
import { faqFor } from './faqFor';
import { SHOTS } from './shots.gen';
import { BRAND } from './brand.js';
import { SOURCE_REPO_URL } from '../data/urls';

const noop = () => {};
const g = globalThis as unknown as { __CV_SSR_OFFER__?: Offer | null; __CV_SSR_LANG__?: UiLang };

export function renderLanding(o: LandingSsr): string {
  g.__CV_SSR_OFFER__ = o.offer;
  g.__CV_SSR_LANG__ = o.lang;
  return renderToString(<LandingScreen ssr={o} lang={o.lang} onSignIn={noop} onDemoStart={noop} onLangChange={noop} />);
}

export function renderPricing(lang: UiLang, offer: Offer | null): string {
  g.__CV_SSR_OFFER__ = offer;
  g.__CV_SSR_LANG__ = lang;
  return renderToString(<PricingPage />);
}

/** Alles, was der Kopf einer Fassung braucht. */
export function landingMeta(lang: UiLang, offer: Offer | null) {
  const t = LANDING_COPY[lang];
  const n = PICKABLE_THEMES.length;
  return {
    path: landingPath(lang),
    title: `${t.meta.title(n)} · ${BRAND.name}`,
    description: t.meta.description(n),
    ogAlt: t.meta.ogAlt,
    h1: `${t.hero.h1a} ${t.hero.h1b}`,
    faq: faqFor(lang, offer),
    features: t.features.items.map(f => f.title),
    proof: t.hero.proof,
    langName: t.langName,
  };
}

export function pricingMeta(lang: UiLang, offer: Offer | null) {
  const t = billingFor(lang, offer);
  return {
    title: `${t.pricing} · ${BRAND.name}`,
    description: t.pLede,
    price: priceOf(offer, lang),
    productName: t.productName,
  };
}

export const SSR_INFO = {
  brand: BRAND,
  langs: LANDING_LANGS,
  templates: PICKABLE_THEMES.map(t => ({ id: t.id, name: t.name, layout: t.layout })),
  shots: SHOTS,
  repo: SOURCE_REPO_URL,
};
