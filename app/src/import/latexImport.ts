/**
 * LaTeX zurücklesen — aber nur unsere eigenen Dateien.
 *
 * Ein Lebenslauf in LaTeX ist ein Programm: Makros, eigene Klassen, bedingte
 * Abschnitte. Daraus zuverlässig Felder zu gewinnen, kann niemand
 * versprechen; ein halb erkannter Lebenslauf, der still Stationen verliert,
 * wäre schlimmer als eine klare Absage. Deshalb trägt jede Datei aus
 * `export/exportLatex.ts` hinter `\end{document}` einen Kommentarblock mit
 * den Daten (JSON, Base64). Diesen Block liest diese Datei — sonst nichts.
 *
 * Der LaTeX-Teil selbst wird nicht ausgewertet und nicht ausgeführt. Was im
 * Datenblock steht, geht durch `sanitizeCv`: nur bekannte Felder, nur
 * Zeichenketten, Längen- und Mengengrenzen, neue Kennungen. Damit kann eine
 * präparierte Datei nichts in den Lebenslauf schreiben, was das Formular
 * nicht auch könnte.
 */
import type { CVData, SocialPlatform, UILabels } from '../data/types';

export const LATEX_DATA_BEGIN = '% ---- cv-daten v1 (Wiederimport, bitte nicht bearbeiten) ----';
export const LATEX_DATA_END = '% ---- cv-daten ende ----';

/** Größte Datei, die gelesen wird (der Datenblock eines vollen Lebenslaufs
 *  ohne Foto liegt bei rund 10 KB). */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

/** Ist das eine .tex-Datei aus diesem Werkzeug? */
export function isOwnLatex(text: string): boolean {
  return typeof text === 'string' && text.includes(LATEX_DATA_BEGIN);
}

/** Sieht die Datei überhaupt nach LaTeX aus (für eine verständliche Absage)? */
export function looksLikeLatex(text: string): boolean {
  return /\\documentclass|\\begin\{document\}/.test(text.slice(0, 20000));
}

export class ImportRefused extends Error {
  /** `foreign-latex`: LaTeX, aber nicht von hier. `broken`: Datenblock
   *  beschädigt. `too-large`, `yaml`, `not-rendercv`: siehe rendercv.ts. */
  code: 'foreign-latex' | 'broken' | 'too-large' | 'yaml' | 'not-rendercv';
  constructor(code: ImportRefused['code']) {
    super(code);
    this.code = code;
  }
}

/** Liest den Datenblock einer exportierten .tex-Datei. */
export function latexToCv(text: string, base: CVData): CVData {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportRefused('too-large');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex(l => l.trim() === LATEX_DATA_BEGIN);
  if (start < 0) throw new ImportRefused(looksLikeLatex(text) ? 'foreign-latex' : 'broken');
  let enc = '';
  let closed = false;
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l === LATEX_DATA_END) { closed = true; break; }
    const m = /^%\s?([A-Za-z0-9+/=]{1,200})$/.exec(l);
    if (!m) throw new ImportRefused('broken');
    enc += m[1];
  }
  if (!closed || !enc) throw new ImportRefused('broken');
  let parsed: unknown;
  try {
    const bin = atob(enc);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ImportRefused('broken');
  }
  const o = parsed as { format?: unknown; version?: unknown; cv?: unknown };
  if (!o || o.format !== 'cv-latex' || o.version !== 1 || !o.cv || typeof o.cv !== 'object') throw new ImportRefused('broken');
  return sanitizeCv(o.cv, base);
}

// ── Bereinigen ───────────────────────────────────────────────────────────────

const PLATFORMS: SocialPlatform[] = ['linkedin', 'github', 'xing', 'twitter', 'bluesky', 'mastodon', 'instagram', 'youtube', 'tiktok', 'behance', 'dribbble', 'medium', 'substack'];

const str = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const list = (v: unknown, max = 200): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const strs = (v: unknown, max = 100): string[] => list(v, max).map(x => str(x, 2000)).filter(x => x.trim() !== '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
/** Optionales Feld nur setzen, wenn es Text trägt — wie im Formular. */
function opt<T extends object>(o: T, k: string, v: string): T {
  if (v.trim()) (o as Record<string, unknown>)[k] = v;
  return o;
}

/** Labels: die der Zielsprache, überschrieben von den mitgebrachten, wenn
 *  sie dieselbe Sprache meinen — sonst stünde „Berufserfahrung" über einer
 *  englischen Fassung. */
function mergeLabels(raw: unknown, base: UILabels): UILabels {
  const r = obj(raw);
  if (r.lang !== base.lang) return base;
  const pick = <K extends 'sections' | 'fields' | 'misc'>(k: K): UILabels[K] => {
    const src = obj(r[k]);
    const out = { ...base[k] } as Record<string, string>;
    const allowed = k === 'sections'
      ? [...Object.keys(base.sections), 'projects', 'certificates', 'volunteering', 'publications', 'skills']
      : Object.keys(base[k]);
    for (const key of allowed) { const v = str(src[key], 200); if (v.trim()) out[key] = v; }
    return out as UILabels[K];
  };
  return { ...base, sections: pick('sections'), fields: pick('fields'), misc: pick('misc') };
}

/**
 * Macht aus beliebigem JSON einen Lebenslauf: nur bekannte Felder, nur
 * Text, höchstens 200 Einträge je Liste und 5000 Zeichen je Feld. Was nicht
 * passt, fällt weg — es wird nichts geraten.
 */
export function sanitizeCv(raw: unknown, base: CVData): CVData {
  const r = obj(raw);
  const p = obj(r.personal);
  const personal: CVData['personal'] = {
    name: str(p.name, 200), title: str(p.title, 300), location: str(p.location, 500),
    email: str(p.email, 300), phone: str(p.phone, 100),
  };
  for (const k of ['subtitle', 'website', 'birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense', 'signatureCity', 'signatureDate'] as const) {
    opt(personal, k, str(p[k], 500));
  }
  const socials = list(p.socials, 30).map(obj)
    .filter(s => PLATFORMS.includes(s.platform as SocialPlatform) && str(s.value).trim())
    .map(s => ({ id: nid('soc'), platform: s.platform as SocialPlatform, value: str(s.value, 500) }));
  /* Ältere Profile tragen LinkedIn und Instagram noch in eigenen Feldern
   * (types.ts, `linkedin`/`instagram`) — die wandern in die Liste. */
  if (!socials.length) {
    for (const platform of ['linkedin', 'instagram'] as const) {
      const v = str(p[platform], 500);
      if (v.trim()) socials.push({ id: nid('soc'), platform, value: v });
    }
  }
  if (socials.length) personal.socials = socials;

  const cv: CVData = {
    personal,
    profile: { text: str(obj(r.profile).text, 8000) },
    experience: list(r.experience).map(obj).map(e => {
      const x: CVData['experience'][number] = {
        id: nid('exp'), role: str(e.role, 300), company: str(e.company, 300), location: str(e.location, 300),
        start: str(e.start, 60), end: str(e.end, 60), bullets: strs(e.bullets),
      };
      if (e.hidden === true) x.hidden = true;
      return x;
    }),
    education: list(r.education).map(obj).map(e => opt(opt({
      id: nid('edu'), degree: str(e.degree, 300), institution: str(e.institution, 300),
      start: str(e.start, 60), end: str(e.end, 60),
    } as CVData['education'][number], 'location', str(e.location, 300)), 'notes', str(e.notes, 2000))),
    skillGroups: list(r.skillGroups, 50).map(obj).map(g => ({ label: str(g.label, 200), items: strs(g.items) })),
    languages: list(r.languages, 50).map(obj).map(l => {
      const x: CVData['languages'][number] = { language: str(l.language, 100), level: str(l.level, 200) };
      if (typeof l.dots === 'number' && Number.isFinite(l.dots)) x.dots = Math.max(1, Math.min(5, Math.round(l.dots)));
      return x;
    }),
    labels: mergeLabels(r.labels, base.labels),
  };
  const add = strs(r.additionalExperience);
  if (add.length) cv.additionalExperience = add;
  const projects = list(r.projects).map(obj).map(e => {
    const x = { id: nid('prj'), title: str(e.title, 300) } as NonNullable<CVData['projects']>[number];
    opt(x, 'role', str(e.role, 300)); opt(x, 'start', str(e.start, 60)); opt(x, 'end', str(e.end, 60));
    opt(x, 'url', str(e.url, 500)); opt(x, 'description', str(e.description, 4000));
    const b = strs(e.bullets); if (b.length) x.bullets = b;
    return x;
  });
  if (projects.length) cv.projects = projects;
  const certificates = list(r.certificates).map(obj).map(e => {
    const x = { id: nid('cert'), name: str(e.name, 300) } as NonNullable<CVData['certificates']>[number];
    opt(x, 'issuer', str(e.issuer, 300)); opt(x, 'date', str(e.date, 60)); opt(x, 'credentialId', str(e.credentialId, 200)); opt(x, 'url', str(e.url, 500));
    return x;
  });
  if (certificates.length) cv.certificates = certificates;
  const volunteering = list(r.volunteering).map(obj).map(e => {
    const x = { id: nid('vol'), role: str(e.role, 300), organization: str(e.organization, 300) } as NonNullable<CVData['volunteering']>[number];
    opt(x, 'location', str(e.location, 300)); opt(x, 'start', str(e.start, 60)); opt(x, 'end', str(e.end, 60));
    const b = strs(e.bullets); if (b.length) x.bullets = b;
    return x;
  });
  if (volunteering.length) cv.volunteering = volunteering;
  const publications = list(r.publications).map(obj).map(e => {
    const x = { id: nid('pub'), title: str(e.title, 500) } as NonNullable<CVData['publications']>[number];
    opt(x, 'publisher', str(e.publisher, 300)); opt(x, 'date', str(e.date, 60)); opt(x, 'url', str(e.url, 500)); opt(x, 'description', str(e.description, 2000));
    return x;
  });
  if (publications.length) cv.publications = publications;
  const custom = list(r.customSections, 30).map(obj).map(c => {
    const x = { id: nid('sec'), title: str(c.title, 200) } as NonNullable<CVData['customSections']>[number];
    const items = strs(c.items); if (items.length) x.items = items;
    const entries = list(c.entries).map(obj).map(e => {
      const y = { id: nid('ent') } as NonNullable<NonNullable<CVData['customSections']>[number]['entries']>[number];
      opt(y, 'title', str(e.title, 300)); opt(y, 'subtitle', str(e.subtitle, 300)); opt(y, 'date', str(e.date, 60)); opt(y, 'text', str(e.text, 4000));
      return y;
    });
    if (entries.length) x.entries = entries;
    return x;
  });
  if (custom.length) cv.customSections = custom;
  return cv;
}
