/**
 * Unified filename helper for every exported file (PDF, HTML, MD, JSON).
 *
 * Goals:
 *   1. Sortierbar — Datum in ISO-Form, damit die Dateien in jedem
 *      Dateimanager chronologisch stehen.
 *   2. Verschickbar — sieht im Mailanhang ordentlich aus: Dokumentart in der
 *      Sprache des Dokuments, Vor- und Nachname mit Bindestrich.
 *
 * Bis 17.11.2026 hieß jede Datei „Lebenslauf_…"/„Anschreiben_…", auch ein
 * englischer CV, und trug die Uhrzeit (`_1430`). Wer sich auf Englisch
 * bewirbt, schickt aber „CV_…", und die Uhrzeit hat im Anhang an eine
 * Personalabteilung nichts zu suchen. Jetzt nur noch das Datum; zwei Exporte
 * am selben Tag nummeriert der Browser selbst.
 *
 * Output examples:
 *   Lebenslauf_Lena-Brandt_2026-05-29.pdf
 *   CV_Lena-Brandt_2026-05-29.pdf
 *   Cover-Letter_Lena-Brandt_2026-05-29.docx
 */

import type { Lang } from '../data/types';

export type DocumentKind = 'lebenslauf' | 'anschreiben';

const LABEL: Record<Lang, Record<DocumentKind, string>> = {
  de: { lebenslauf: 'Lebenslauf', anschreiben: 'Anschreiben' },
  en: { lebenslauf: 'CV', anschreiben: 'Cover-Letter' },
  fr: { lebenslauf: 'CV', anschreiben: 'Lettre-de-motivation' },
  es: { lebenslauf: 'CV', anschreiben: 'Carta-de-presentacion' },
};

/** Dokumentart als Wort in der Sprache des Dokuments („CV", „Anschreiben") —
 *  auch für Titel und PDF-Metadaten. */
export function documentLabel(kind: DocumentKind, lang: Lang | string | undefined): string {
  return (LABEL[lang as Lang] ?? LABEL.de)[kind];
}

/** Strip accents, transliterate the German Eszett, keep letters + digits. */
function cleanName(raw: string): string {
  const cleaned = (raw || '')
    .trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // strip combining marks
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return 'Dokument';
  // Title-case each word so "lena brandt" → "Lena-Brandt".
  return cleaned.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('-');
}

/** Current local date as YYYY-MM-DD. */
function datestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Dateiname ohne Endung: `CV_Lena-Brandt_2026-05-29`. */
export function exportBasename(kind: DocumentKind, name: string, lang: Lang | string | undefined = 'de'): string {
  return `${documentLabel(kind, lang)}_${cleanName(name)}_${datestamp()}`;
}

/**
 * Build a filename like `CV_Lena-Brandt_2026-05-29.pdf`.
 *
 * @param kind     'lebenslauf' or 'anschreiben'
 * @param name     full display name (typically `personal.name`)
 * @param ext      'pdf' | 'html' | 'md' | 'json' (no leading dot)
 * @param lang     Sprache des Dokuments (`labels.lang`), nicht der Oberfläche
 */
export function exportFilename(kind: DocumentKind, name: string, ext: string, lang: Lang | string | undefined = 'de'): string {
  return `${exportBasename(kind, name, lang)}.${ext}`;
}
