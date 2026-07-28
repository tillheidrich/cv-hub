/**
 * Unified filename helper for every exported file (PDF, HTML, MD, JSON).
 *
 * Goals:
 *   1. Eindeutig — every download has a unique name, so the browser never
 *      appends `(1)`, `(2)`, ….
 *   2. Sortierbar — date prefix in ISO-like form so files list chronologically
 *      in any file manager.
 *   3. Verschickbar — looks clean in an email attachment: capitalized
 *      "Lebenslauf"/"Anschreiben", proper first-last name with hyphen.
 *
 * Output examples:
 *   Lebenslauf_Lena-Brandt_2026-05-29_1430.pdf
 *   Anschreiben_Lena-Brandt_2026-05-29_1430.docx
 */

export type DocumentKind = 'lebenslauf' | 'anschreiben';

const LABEL: Record<DocumentKind, string> = {
  lebenslauf:  'Lebenslauf',
  anschreiben: 'Anschreiben',
};

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

/** Current local time as YYYY-MM-DD_HHMM. */
function timestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Build a filename like `Lebenslauf_Lena-Brandt_2026-05-29_1430.pdf`.
 *
 * @param kind     'lebenslauf' or 'anschreiben'
 * @param name     full display name (typically `personal.name`)
 * @param ext      'pdf' | 'html' | 'md' | 'json' (no leading dot)
 */
export function exportFilename(kind: DocumentKind, name: string, ext: string): string {
  return `${LABEL[kind]}_${cleanName(name)}_${timestamp()}.${ext}`;
}
