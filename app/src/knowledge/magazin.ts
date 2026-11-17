/**
 * Magazin-Artikel, auf die die Tipps und die Startseite verweisen.
 *
 * Die Artikel liegen als statische Seiten auf derselben Domain (Quelle:
 * app/content/magazin, Bau scripts/magazin-build.mjs): deutsche unter
 * `/magazin/<slug>/`, englische unter `/en/magazine/<slug>/`. Die Pfade sind
 * relativ, damit ein Domainwechsel hier nichts ändert.
 *
 * Neue Artikel: Slug und Titel in MAGAZIN ergänzen, dann bei den passenden
 * Tipps in content/*.ts unter `magazin` eintragen. Gibt es zu einem Artikel
 * eine englische Fassung (gleicher `translationKey` im Frontmatter), in
 * MAGAZIN_FASSUNGEN Slug und Titel der Fassung eintragen: Dann verlinken die
 * englische Oberfläche und die englische Startseite die Fassung, ohne
 * Sprachhinweis. Sonst bleibt es beim deutschen Artikel mit Hinweis.
 */
export const MAGAZIN_BASE = '/magazin/';

/** Pfade der Ausgaben, gleichlautend in scripts/magazin-lib.mjs (AUSGABEN). */
export const MAGAZIN_AUSGABEN = { de: '/magazin/', en: '/en/magazine/' } as const;
export type MagazinAusgabe = keyof typeof MAGAZIN_AUSGABEN;

export const MAGAZIN = {
  'wie-bewerbermanagement-systeme-lebenslaeufe-lesen': 'Wie Bewerbermanagement-Systeme Lebensläufe wirklich lesen',
  'lebenslauf-pdf-oder-word': 'Lebenslauf als PDF oder Word?',
  'lebenslauf-mit-ki-schreiben-ohne-erfindungen': 'Lebenslauf mit KI schreiben, ohne dass etwas erfunden wird',
  'lebenslauf-maschinenlesbar-checkliste': 'Lebenslauf maschinenlesbar machen: die Checkliste',
  'luecke-im-lebenslauf': 'Lücke im Lebenslauf: Was Studien zeigen und was hilft',
  'anschreiben-2026-pflicht-oder-ueberholt': 'Anschreiben 2026: Pflicht, Kür oder überholt?',
  'bewerben-wenn-ki-vorsortiert': 'Bewerben, wenn KI vorsortiert: Was hilft und was Mythos ist',
  'ki-verordnung-recruiting-bewerber': 'KI im Recruiting: Was die KI-Verordnung Bewerbern bringt',
  'gehalt-stellenanzeige-entgelttransparenz': 'Gehalt in der Stellenanzeige: Was die EU-Richtlinie ändert',
  'lebenslauf-mcp-ki-verbinden': 'Claude direkt am Lebenslauf arbeiten lassen: MCP erklärt',
} as const;

export type MagazinSlug = keyof typeof MAGAZIN;

/** Veröffentlichte Fassungen in anderen Sprachen: deutscher Slug → Sprache →
 *  Slug und Titel der Fassung. Nur eintragen, was es wirklich gibt (sonst
 *  zeigt der Link auf die 404 der englischen Ausgabe). */
export const MAGAZIN_FASSUNGEN: Partial<Record<MagazinSlug, Partial<Record<Exclude<MagazinAusgabe, 'de'>, { slug: string; title: string }>>>> = {
  'lebenslauf-mcp-ki-verbinden': { en: { slug: 'cv-mcp-claude-chatgpt', title: 'Let Claude edit your CV directly: the MCP connection explained' } },
};

/** Englische Artikel ohne deutsches Gegenstück (Bewerben aus dem Ausland,
 *  17.11.2026), für Verweise aus Startseite und Tipps. */
export const MAGAZIN_EN = {
  'german-cv-guide': 'How to write a German CV: a guide for international applicants',
  'indian-resume-to-german-cv': 'Indian resume to German CV: what to change, line by line',
  'cgpa-german-cv': 'How to show your CGPA on a German CV',
  'english-or-german-cv': 'English or German CV for tech jobs in Germany?',
  'cv-opportunity-card-blue-card': 'Your CV for the Opportunity Card and the EU Blue Card',
} as const;
export type MagazinEnSlug = keyof typeof MAGAZIN_EN;
export const magazinEnUrl = (slug: MagazinEnSlug | string) => `${MAGAZIN_AUSGABEN.en}${slug}/`;

/** Kurzer Hinweis an einem deutschen Artikel auf einer anderssprachigen
 *  Seite, in der Sprache der Seite. */
export const MAGAZIN_NUR_DEUTSCH: Record<string, string> = { en: 'in German', fr: 'en allemand', es: 'en alemán' };

/** Übersicht des Magazins für eine Seitensprache: Englisch hat eine eigene
 *  Ausgabe, Französisch und Spanisch noch nicht (dort das deutsche). */
export const magazinStart = (lang: string): string => (lang === 'en' ? MAGAZIN_AUSGABEN.en : MAGAZIN_AUSGABEN.de);

export interface MagazinLink {
  href: string;
  title: string;
  /** Sprache des verlinkten Artikels (für hrefLang/lang). */
  lang: string;
}

/** Link auf einen Artikel für eine Seitensprache: die Fassung in dieser
 *  Sprache, wenn es sie gibt, sonst der deutsche Artikel. Ein Sprachhinweis
 *  gehört nur dazu, wenn `lang` des Ergebnisses nicht die Seitensprache ist. */
export function magazinLink(slug: MagazinSlug, lang: string = 'de'): MagazinLink {
  /* Französisch und Spanisch: lieber die englische Fassung als die deutsche. */
  const f = lang !== 'de' ? MAGAZIN_FASSUNGEN[slug]?.en : undefined;
  if (f) return { href: `${MAGAZIN_AUSGABEN.en}${f.slug}/`, title: f.title, lang: 'en' };
  return { href: `${MAGAZIN_BASE}${slug}/`, title: MAGAZIN[slug], lang: 'de' };
}

export const magazinUrl = (slug: MagazinSlug, lang: string = 'de') => magazinLink(slug, lang).href;

/** Was die Startseite von einem Artikel braucht (dist/magazin/index.json). */
export interface MagazinAuswahlArtikel {
  slug: string;
  url?: string;
  lang: string;
  alternates?: { lang: string; url: string }[];
}

const PFAD_RE = /^\/(?:magazin|en\/magazine)\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/;

/** Pfad eines Artikels aus dem Index; ohne (gültige) url wie vor den Ausgaben. */
export function artikelHref(a: MagazinAuswahlArtikel): string {
  if (a.url && PFAD_RE.test(a.url)) return a.url;
  return `${a.lang === 'en' ? MAGAZIN_AUSGABEN.en : MAGAZIN_AUSGABEN.de}${a.slug}/`;
}

/**
 * Artikel für den Magazin-Abschnitt einer Startseite, neueste zuerst
 * (Reihenfolge der Eingabe). Eigene Sprache zuerst; gibt es davon mindestens
 * drei, nur diese. Sonst wird mit deutschen aufgefüllt, außer solchen, die
 * schon eine Fassung in der Seitensprache haben; die Seite kennzeichnet sie
 * mit MAGAZIN_NUR_DEUTSCH. Dieselbe Regel beim Vorrendern und in der App.
 */
export function magazinAuswahl<T extends MagazinAuswahlArtikel>(alle: T[], lang: string, max = 6): T[] {
  const eigene = alle.filter(a => a.lang === lang);
  if (eigene.length >= 3 || lang === 'de') return eigene.slice(0, max);
  const deutsch = alle.filter(a => a.lang === 'de' && !(a.alternates || []).some(x => x.lang === lang));
  return [...eigene, ...deutsch].slice(0, max);
}
