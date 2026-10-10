/**
 * Artikel aus dem Magazin, auf die die Tipps verweisen.
 *
 * Die Artikel liegen als statische Seiten unter `/magazin/<slug>/` auf
 * derselben Domain (Quelle: app/content/magazin).
 * Der Pfad ist relativ, damit ein Domainwechsel hier nichts ändert. Neue
 * Artikel: Slug und Titel hier ergänzen, dann bei den passenden Tipps in
 * content/*.ts unter `magazin` eintragen. Die Artikel sind auf Deutsch; in
 * den anderen Oberflächensprachen steht das dabei.
 */
export const MAGAZIN_BASE = '/magazin/';

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
} as const;

export type MagazinSlug = keyof typeof MAGAZIN;

export const magazinUrl = (slug: MagazinSlug) => `${MAGAZIN_BASE}${slug}/`;
