/**
 * Page format catalogue. A CV almost always lives on A4 (Europe) or
 * US Letter (North America). Legal and A5 are included because some
 * markets ask for them (Legal for academic CVs in the US, A5 for
 * compact one-pagers).
 */

export type PageFormat = 'a4' | 'letter' | 'legal' | 'a5';

export interface PageFormatSpec {
  /** Stable id used in profile.settings.pageFormat */
  id: PageFormat;
  /** Friendly label for the picker */
  label: string;
  /** Region / use-case hint */
  hint: string;
  /** Width in millimetres */
  widthMm: number;
  /** Height in millimetres */
  heightMm: number;
  /** Playwright `page.pdf({ format })` value */
  playwrightFormat: string;
}

export const PAGE_FORMATS: Record<PageFormat, PageFormatSpec> = {
  a4: {
    id: 'a4', label: 'A4', hint: 'Europa · Standard',
    widthMm: 210, heightMm: 297, playwrightFormat: 'A4',
  },
  letter: {
    id: 'letter', label: 'US Letter', hint: 'USA, Kanada',
    widthMm: 216, heightMm: 279, playwrightFormat: 'Letter',
  },
  legal: {
    id: 'legal', label: 'US Legal', hint: 'USA · Akademische CVs',
    widthMm: 216, heightMm: 356, playwrightFormat: 'Legal',
  },
  a5: {
    id: 'a5', label: 'A5', hint: 'Kompakt · Halbe Höhe',
    widthMm: 148, heightMm: 210, playwrightFormat: 'A5',
  },
};

export const PAGE_FORMAT_LIST: PageFormatSpec[] = Object.values(PAGE_FORMATS);

export function getPageFormat(id?: PageFormat | string): PageFormatSpec {
  if (id && id in PAGE_FORMATS) return PAGE_FORMATS[id as PageFormat];
  return PAGE_FORMATS.a4;
}

// ── Seitenzahl ──────────────────────────────────────────────────────────────
//
// Frage vom 10.10.2026: „wollen wir von Max. 3 Seiten auf 4 oder so gehen?"
// Entscheidung: bis vier Seiten als Ziel wählbar. Begründung: Für die
// Maschine ist die Seitenzahl kein Kriterium (Personio nennt keine, Textkernel
// deckelt die Texterkennung erst bei zehn Seiten). Für den Menschen gilt in
// Deutschland eine bis zwei Seiten (Bundesagentur für Arbeit), in Wissenschaft
// und Technik mit Publikationen oder Projektlisten auch mehr. Ab Seite drei
// sagt das Prüfen-Paneel das dazu (LONG_CV_HINT).
//
// Was über vier Seiten hinausgeht, wird nie still abgeschnitten: Die Vorschau
// setzt weiter bis zur Grenze des PDF-Dienstes (pdf-service/pdf.js, MAX_PAGES)
// und meldet den Überlauf. Bis zum 10.10.2026 schnitt der Seitenmodus „Auto"
// bei drei Seiten ab, ohne etwas zu sagen.

/** Größte Seitenzahl, die das Werkzeug ohne Überlaufmeldung setzt. */
export const MAX_CV_PAGES = 4;
/** Grenze des PDF-Dienstes (pdf-service/pdf.js, MAX_PAGES). Bis hierhin
 *  wird gesetzt, auch wenn MAX_CV_PAGES überschritten ist — damit nichts
 *  fehlt, sondern nur gemeldet wird. */
export const PDF_MAX_PAGES = 6;

/** Hinweis ab der dritten Seite, für das Prüfen-Paneel. */
export const LONG_CV_HINT: Record<'de' | 'en' | 'fr' | 'es', (pages: number) => string> = {
  de: n => `${n} Seiten. In Deutschland sind ein bis zwei Seiten üblich, in Wissenschaft und Technik auch mehr, etwa mit Publikationen oder einer Projektliste.${n > MAX_CV_PAGES ? ` Über ${MAX_CV_PAGES} Seiten liest das kaum noch jemand ganz: kürzen oder eine Kurzfassung beilegen.` : ''}`,
  en: n => `${n} pages. In Germany one to two pages are usual; in academia and engineering more is fine, for example with publications or a project list.${n > MAX_CV_PAGES ? ` Beyond ${MAX_CV_PAGES} pages hardly anyone reads it all: shorten it or add a short version.` : ''}`,
  fr: n => `${n} pages. En Allemagne, une à deux pages sont l’usage ; dans la recherche et la technique, davantage est courant, par exemple avec des publications ou une liste de projets.${n > MAX_CV_PAGES ? ` Au-delà de ${MAX_CV_PAGES} pages, presque personne ne lit tout : raccourcissez ou joignez une version courte.` : ''}`,
  es: n => `${n} páginas. En Alemania lo habitual son una o dos páginas; en ciencia y tecnología también más, por ejemplo con publicaciones o una lista de proyectos.${n > MAX_CV_PAGES ? ` Más de ${MAX_CV_PAGES} páginas casi nadie las lee enteras: acorta o añade una versión breve.` : ''}`,
};
