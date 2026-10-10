/**
 * Begriffe aus einer Stellenanzeige und ihr Abgleich mit einem Text.
 *
 * Bis zum 10.10.2026 stand diese Logik im ATS-Dialog und kannte nur den
 * Lebenslauf. Jetzt prüfen Lebenslauf, Anschreiben und beide zusammen mit
 * derselben Regel: Was hier als Begriff gilt, gilt überall als Begriff.
 *
 * Kein Modell, keine Synonyme: Gesucht wird wörtlich (ohne Groß-/Klein-
 * schreibung und Akzente). Das ist absichtlich streng. Ob ein bestimmtes
 * Bewerbermanagement-System Synonyme erkennt, wissen wir nicht; ein wörtlicher
 * Treffer funktioniert in jedem.
 */

// Lowercased, deduplicated, accent-insensitive stoplist for German + English
// (+ the most frequent French/Spanish words). Anything in here is NOT a
// "hard skill" candidate.
export const STOPWORDS = new Set<string>(`
a an the and or but if then else for to of in on at by from with without about into
ist sind das der die den dem des ein eine einen einer eines auf in mit von zu für aus
am im uns euch wir ihr du sie er es seine ihre sein dass ob nicht keine kein
und oder aber wenn dann sonst also wie sowie sowohl als wenn auch nur noch nun
sehr mehr meisten viel viele etwa ungefähr ungefaehr ca circa über ueber unter
durch nach vor jeder jede jedes alle alles man wer was wann wo warum weil dass
unsere unseres unserer unserem unseren ihres ihrer
position rolle role job stelle bewerbung verantwortung verantwortlich aufgaben
sie sind wir suchen wir bieten profil anforderungen erfahrung kenntnisse
über über uns ueber uns about us we are looking for we offer profile requirements experience knowledge
m w d
years jahre jahren months monate tag tage week wochen
gut good very strong stark fließend fliessend
ausgezeichnete excellent exzellent excellent
deine dein dein deinem ihrem ihres your you
team teams projekt projekte unternehmen company firma firmen
neue new aktuelle current bisherige past
have has hatte habe haben besitzen verfügen verfuegen
should sollte soll soll können koennen muss
mindestens at least minimum minimal
desirable nice to have wünschenswert wuenschenswert
benefits vorteile angebot stellenangebot
bewerben bewerbung apply application interview
de en english englisch german
title titel
ansprechpartner ansprechpartnerin ansprechperson kontakt contact frau herr
gmbh ag se kg ug ltd inc llc plc sas sarl
le la les un une des du et ou en pour par avec sans sur dans nous vous notre votre
el los las unos unas del y o para por con sin sobre nuestro nuestra su sus
`.split(/\s+/).filter(Boolean));

const UMLAUT: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Klein, ohne Akzente, Umlaute als ae/oe/ue/ss. */
export function fold(text: string): string {
  return text.toLowerCase()
    .replace(/[äöüß]/g, ch => UMLAUT[ch] || ch)
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function tokenize(text: string): Set<string> {
  // Bindestrich steht am Ende der Klasse und braucht dort keine Maskierung.
  const tokens = fold(text).split(/[^a-z0-9+#./-]+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
  return new Set(tokens);
}

export function extractCandidates(jd: string): string[] {
  // Multi-pass extraction:
  //   1. Capitalised multi-word phrases (Adobe Photoshop, Microsoft Excel)
  //   2. Acronyms (SEO, CRM, ATS) — 2-5 uppercase letters/digits
  //   3. Tech-stack identifiers with dots / pluses / hashes (Node.js, C#)
  const phrases = new Set<string>();
  // Unicode-Klassen: vorher brach „Verstärkung" am „ä" ab und wurde zu „Verst".
  const phraseRe = /(?<![\p{L}\p{N}])(\p{Lu}[\p{L}\p{N}+]+(?:\s+\p{Lu}[\p{L}\p{N}+]+){0,2})(?![\p{L}\p{N}])/gu;
  let m;
  while ((m = phraseRe.exec(jd))) {
    // Artikel und Anreden am Anfang gehören nicht zum Begriff („Die Nordlicht Software").
    const p = m[1].replace(/^(?:Die|Der|Das|Den|Dem|Des|Ein|Eine|Wir|Sie|Du|Ihr|Unser|Unsere|The|Our|We|You|Your|Le|La|Les|Nous|Vous|El|Los|Las|Nuestro|Nuestra)\s+/, '');
    if (/^(?:Frau|Herr|Ms|Mrs|Mr|Mme|Sra|Sr)\b/.test(p)) continue;
    if (p) phrases.add(p);
  }
  const acronymRe = /\b[A-Z][A-Z0-9]{1,4}\b/g;
  while ((m = acronymRe.exec(jd))) phrases.add(m[0]);
  const techRe = /\b[A-Za-z][a-zA-Z0-9]*(?:[+#.][a-zA-Z0-9]+)+\b/g;
  while ((m = techRe.exec(jd))) phrases.add(m[0]);

  return Array.from(phrases)
    .filter(p => {
      const folded = p.toLowerCase().replace(/[^a-z0-9]/g, '');
      return folded.length >= 2 && !STOPWORDS.has(folded);
    })
    .sort()
    .slice(0, 80);
}

export interface TermMatch { term: string; inJd: number }

/** Begriffe der Anzeige, nach Häufigkeit in der Anzeige sortiert. */
export function jobTerms(jd: string, max = 40): TermMatch[] {
  const seen = new Set<string>();
  const out: TermMatch[] = [];
  for (const cand of extractCandidates(jd)) {
    const key = cand.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const esc = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const inJd = (jd.match(new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'giu')) || []).length;
    out.push({ term: cand, inJd });
  }
  return out.sort((a, b) => b.inJd - a.inJd).slice(0, max);
}

/** Ein Text, gegen den Begriffe geprüft werden. */
export interface Haystack { lower: string; tokens: Set<string> }

export function haystack(text: string): Haystack {
  return { lower: fold(text), tokens: tokenize(text) };
}

/** Steht der Begriff im Text — als Teilzeichenkette oder mit allen Wörtern? */
export function contains(h: Haystack, term: string): boolean {
  if (h.lower.includes(fold(term))) return true;
  const t = Array.from(tokenize(term));
  return t.length > 0 && t.every(x => h.tokens.has(x));
}
