/**
 * Alle Wege, einen vorhandenen Lebenslauf mitzubringen, an einer Stelle
 * (19.10.2026, Laien-Durchgang). Läuft vollständig im Browser, also auch in
 * der Demo ohne Konto.
 *
 *  • eingefügter Text (ChatGPT, Claude, aus Word oder einer PDF kopiert)
 *    → import/textImport.ts, tolerant; das eigene Export-Format erkennt er
 *    und liest es streng
 *  • Word (.docx) → Text → wie oben
 *  • Text/Markdown (.txt, .md)
 *  • LinkedIn-Export (ZIP/CSV)
 *  • Datensicherung dieses Werkzeugs und JSON Resume (.json)
 *  • RenderCV-YAML und .tex aus diesem Werkzeug
 *
 * Bis zum 19.10. las die Übersicht nur Dateien und das Export-Format, und
 * der Import im Editor ersetzte den ganzen Lebenslauf durch das, was der
 * strenge Parser erkannte. Bei normaler ChatGPT-Ausgabe war das fast nichts.
 */
import type { AppProfile, CVData, Lang } from '../data/types';
import { withAllLangs } from '../data/storage';
import { jsonResumeToCv, isJsonResume } from '../export/jsonResume';
import { readCodeImport } from './rendercv';
import { importCvText, docxToText, type TextImportResult } from './textImport';

export interface ImportResult {
  /** Inhalt für die bearbeitete Sprache. */
  cv?: CVData;
  /** Vollständiges Profil (Datensicherung dieses Werkzeugs). */
  profile?: AppProfile;
  /** Woher es kam, für die Bestätigung („Word", „LinkedIn" …). */
  what: string;
  /** Nicht sicher zugeordnete Zeilen. */
  unsorted: string[];
  found?: TextImportResult['found'];
}

export class ImportError extends Error {
  kind: 'pdf' | 'empty' | 'unknown' | 'docx';
  constructor(kind: 'pdf' | 'empty' | 'unknown' | 'docx') { super(kind); this.kind = kind; }
}

/** Fertiger Inhalt aus einem Ergebnis: nicht Zugeordnetes als eigener
 *  Abschnitt mit diesem Titel („Weitere Angaben"). */
export function importedCv(r: ImportResult, unsortedTitle: string): CVData | undefined {
  return r.cv ? withUnsorted(r.cv, r.unsorted, unsortedTitle) : undefined;
}

/** Name aus dem Ergebnis, für den Titel in der Übersicht. */
export function importedName(r: ImportResult): string {
  const p = r.cv?.personal ?? r.profile?.data?.[r.profile.settings?.lang ?? 'de']?.personal;
  return (p?.name ?? '').trim();
}

/** Nicht zugeordnete Zeilen als eigener Abschnitt, damit nichts verloren geht. */
export function withUnsorted(cv: CVData, unsorted: string[], title: string): CVData {
  if (!unsorted.length) return cv;
  const id = `weitere-${Date.now().toString(36)}`;
  return { ...cv, customSections: [...(cv.customSections ?? []), { id, title, items: unsorted.slice(0, 60) }] };
}

export function readText(text: string, base: CVData, lang: Lang, what = 'Text'): ImportResult {
  if (!text.trim()) throw new ImportError('empty');
  const r = importCvText(text, base, lang);
  return { cv: r.cv, what, unsorted: r.unsorted, found: r.found };
}

export async function readImportFile(file: File, base: CVData, lang: Lang): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') throw new ImportError('pdf');
  if (name.endsWith('.zip') || name.endsWith('.csv')) {
    const befund = await (await import('./linkedinImport')).importLinkedIn(file, base);
    const g = befund.gefunden;
    return { cv: befund.cv, what: `LinkedIn · ${g.stationen} / ${g.ausbildung} / ${g.skills} / ${g.sprachen}`, unsorted: [] };
  }
  if (name.endsWith('.docx')) {
    let text: string;
    try { text = await docxToText(await file.arrayBuffer()); } catch { throw new ImportError('docx'); }
    return readText(text, base, lang, 'Word');
  }
  if (name.endsWith('.doc')) throw new ImportError('docx');
  const text = await file.text();
  /* RenderCV-YAML oder eine .tex-Datei aus diesem Werkzeug (import/rendercv.ts). */
  const code = await readCodeImport(file.name, text, base);
  if (code) return { ...code, unsorted: [] };
  if (name.endsWith('.json') || text.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (isJsonResume(parsed)) return { cv: jsonResumeToCv(parsed, base), what: 'JSON Resume', unsorted: [] };
      if (parsed && parsed.id && parsed.data) return { profile: withAllLangs(parsed as AppProfile), what: 'Sicherung', unsorted: [] };
      if (parsed && parsed.personal && parsed.experience !== undefined) return { cv: parsed as CVData, what: 'JSON', unsorted: [] };
    } catch { /* kein JSON: als Text lesen */ }
  }
  return readText(text, base, lang, name.endsWith('.md') || name.endsWith('.markdown') ? 'Markdown' : 'Text');
}
