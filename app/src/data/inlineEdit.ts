// ── Direktes Bearbeiten in der Vorschau ─────────────────────────────────────
//
// Bisher gab es zwei getrennte Welten: links das Formular, rechts das Bild.
// Wer eine Formulierung ändern wollte, musste erst das passende Feld suchen.
// Jetzt klickt man in den Text und schreibt.
//
// Die Struktur bleibt dabei unangetastet — es entstehen keine frei
// platzierbaren Absätze, sondern es ändern sich Felder, die es ohnehin gibt.
// Genau darauf beruht, dass der Seitenumbruch vorhersagbar bleibt und der
// Export (PDF, Word, JSON) dieselben Daten sieht wie der Bildschirm.
//
// Adressiert wird ein Feld über einen Pfad wie
//   personal.name
//   profile.text
//   experience.<id>.role
//   experience.<id>.bullets.2
//   education.<id>.notes
//   skills.<index>.items.3
//   languages.<index>.level
//   additional.4
//   labels.sections.experience
//   labels.fields.nationality
//   socials.<id>
// — bewusst über die stabile ID des Eintrags, nicht über seine Position: die
// Reihenfolge kann sich zwischen Tastendruck und Übernahme ändern.

import type { CVData, CoverLetterData } from './types';

export type InlinePath = string;

/** Felder, in denen ein Zeilenumbruch etwas bedeutet.
 *
 *  Eine Anschrift steht auf zwei Zeilen — Straße, dann Postleitzahl und Ort.
 *  Bisher war das nicht möglich: das Formularfeld war einzeilig, die
 *  Übernahme faltete jeden Umbruch zu einem Leerzeichen zusammen, und der
 *  Renderer hätte ihn ohnehin nicht dargestellt. Für alle anderen Felder
 *  bleibt das Zusammenfalten richtig: ein Firmenname über zwei Zeilen ist
 *  ein Versehen, kein Satzwunsch. */
export const MULTILINE_PATHS = new Set<string>([
  'personal.location',
  'personal.birthPlace',
  'personal.driversLicense',
  'cl.companyAddress',
]);

export function isMultiline(path: InlinePath): boolean {
  return MULTILINE_PATHS.has(path) || /\.notes$/.test(path) || path === 'profile.text' || path === 'cl.mainBody';
}

/** Umbrüche erhalten, alles andere normalisieren: Leerzeichen je Zeile
 *  zusammenfassen, mehr als eine Leerzeile eindampfen, Ränder abschneiden. */
function keepBreaks(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const setAt = <T>(arr: T[], i: number, v: T): T[] => arr.map((x, j) => (j === i ? v : x));

/** Wendet eine Textänderung aus der Vorschau auf die Daten an. */
export function applyInlineEdit(cv: CVData, path: InlinePath, value: string): CVData {
  const v = value.replace(/\s+/g, ' ').trim();
  const p = path.split('.');

  /* Beschriftungen sind Daten, keine Konstanten.
   *
   * Sektionstitel („BERUFSERFAHRUNG"), Feldbezeichnungen („STAATSANGEHÖRIG-
   * KEIT") und die Fußzeile kamen bisher aus einer festen Tabelle je Sprache
   * und waren an keiner Stelle änderbar — genau die linke Leiste war damit
   * unantastbar. Sie liegen ohnehin auf dem Datensatz (`cv.labels`), und weil
   * jede Sprache ihren eigenen Datensatz hat, ist eine Änderung automatisch
   * sprachspezifisch und überlebt den Sprachwechsel. */
  if (p[0] === 'labels' && (p[1] === 'sections' || p[1] === 'fields' || p[1] === 'misc')) {
    const group = p[1] as 'sections' | 'fields' | 'misc';
    return { ...cv, labels: { ...cv.labels, [group]: { ...cv.labels[group], [p[2]]: v } } };
  }

  /* Kontaktkanäle: adressiert über die stabile ID, nicht über die Position. */
  if (p[0] === 'socials') {
    const id = p[1];
    return {
      ...cv,
      personal: {
        ...cv.personal,
        socials: (cv.personal.socials ?? []).map(x => (x.id === id ? { ...x, value: v } : x)),
      },
    };
  }

  if (p[0] === 'personal') return { ...cv, personal: { ...cv.personal, [p[1]]: isMultiline(path) ? keepBreaks(value) : value.trim() } };
  if (p[0] === 'profile') return { ...cv, profile: { ...cv.profile, text: keepBreaks(value) } };

  if (p[0] === 'experience') {
    const id = p[1];
    return {
      ...cv,
      experience: cv.experience.map(e => {
        if (e.id !== id) return e;
        if (p[2] === 'bullets') {
          const i = Number(p[3]);
          return { ...e, bullets: setAt(e.bullets, i, value.trim()) };
        }
        return { ...e, [p[2]]: v };
      }),
    };
  }

  if (p[0] === 'education') {
    const id = p[1];
    return {
      ...cv,
      education: cv.education.map(e => (e.id === id ? { ...e, [p[2]]: p[2] === 'notes' ? keepBreaks(value) : v } : e)),
    };
  }

  if (p[0] === 'skills') {
    const gi = Number(p[1]);
    const ii = Number(p[3]);
    return {
      ...cv,
      skillGroups: cv.skillGroups.map((g, i) => {
        if (i !== gi) return g;
        if (p[2] === 'label') return { ...g, label: v };
        return { ...g, items: setAt(g.items, ii, v) };
      }),
    };
  }

  if (p[0] === 'languages') {
    const i = Number(p[1]);
    return { ...cv, languages: cv.languages.map((l, j) => (j === i ? { ...l, [p[2]]: v } : l)) };
  }

  if (p[0] === 'additional') {
    const i = Number(p[1]);
    return { ...cv, additionalExperience: setAt(cv.additionalExperience || [], i, v) };
  }

  return cv;
}

/** Fügt hinter dem adressierten Stichpunkt einen leeren ein und liefert den
 *  Pfad des neuen — die Vorschau setzt den Schreibzeiger dorthin. */
export function insertAfter(cv: CVData, path: InlinePath): { data: CVData; focus: InlinePath } | null {
  const p = path.split('.');
  if (p[0] === 'experience' && p[2] === 'bullets') {
    const id = p[1];
    const i = Number(p[3]);
    return {
      data: {
        ...cv,
        experience: cv.experience.map(e => (e.id === id
          ? { ...e, bullets: [...e.bullets.slice(0, i + 1), '', ...e.bullets.slice(i + 1)] }
          : e)),
      },
      focus: `experience.${id}.bullets.${i + 1}`,
    };
  }
  if (p[0] === 'skills' && p[2] === 'items') {
    const gi = Number(p[1]);
    const ii = Number(p[3]);
    return {
      data: {
        ...cv,
        skillGroups: cv.skillGroups.map((g, i) => (i === gi
          ? { ...g, items: [...g.items.slice(0, ii + 1), '', ...g.items.slice(ii + 1)] }
          : g)),
      },
      focus: `skills.${gi}.items.${ii + 1}`,
    };
  }
  if (p[0] === 'additional') {
    const i = Number(p[1]);
    const items = cv.additionalExperience || [];
    return {
      data: { ...cv, additionalExperience: [...items.slice(0, i + 1), '', ...items.slice(i + 1)] },
      focus: `additional.${i + 1}`,
    };
  }
  return null;
}

/** Entfernt den adressierten Stichpunkt und liefert den Pfad des Vorgängers. */
export function removeAt(cv: CVData, path: InlinePath): { data: CVData; focus: InlinePath | null } | null {
  const p = path.split('.');
  if (p[0] === 'experience' && p[2] === 'bullets') {
    const id = p[1];
    const i = Number(p[3]);
    const entry = cv.experience.find(e => e.id === id);
    if (!entry || entry.bullets.length <= 1) return null;
    return {
      data: {
        ...cv,
        experience: cv.experience.map(e => (e.id === id ? { ...e, bullets: e.bullets.filter((_, j) => j !== i) } : e)),
      },
      focus: i > 0 ? `experience.${id}.bullets.${i - 1}` : null,
    };
  }
  if (p[0] === 'skills' && p[2] === 'items') {
    const gi = Number(p[1]);
    const ii = Number(p[3]);
    const g = cv.skillGroups[gi];
    if (!g || g.items.length <= 1) return null;
    return {
      data: { ...cv, skillGroups: cv.skillGroups.map((x, i) => (i === gi ? { ...x, items: x.items.filter((_, j) => j !== ii) } : x)) },
      focus: ii > 0 ? `skills.${gi}.items.${ii - 1}` : null,
    };
  }
  if (p[0] === 'additional') {
    const i = Number(p[1]);
    const items = cv.additionalExperience || [];
    if (items.length <= 1) return null;
    return {
      data: { ...cv, additionalExperience: items.filter((_, j) => j !== i) },
      focus: i > 0 ? `additional.${i - 1}` : null,
    };
  }
  return null;
}

/** Felder des Anschreibens, die in der Vorschau beschreibbar sind.
 *  Pfade tragen das Präfix `cl.`, damit die App sie beim Übernehmen an die
 *  Anschreiben-Daten weiterreicht statt an den Lebenslauf. */
export const CL_FIELDS = [
  'company', 'contactPerson', 'companyAddress', 'city', 'date', 'subject',
  'salutation', 'intro', 'mainBody', 'companyReference', 'motivation', 'closing', 'signoff',
] as const;
export type ClField = typeof CL_FIELDS[number];

export function isCoverLetterPath(path: InlinePath): boolean {
  return path.startsWith('cl.');
}

export function applyCoverLetterEdit(cl: CoverLetterData, path: InlinePath, value: string): CoverLetterData {
  const field = path.slice(3) as ClField;
  if (!(CL_FIELDS as readonly string[]).includes(field)) return cl;
  return { ...cl, [field]: isMultiline(path) ? keepBreaks(value) : value.replace(/\s+/g, ' ').trim() };
}
