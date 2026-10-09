// ── Eigene Abschnitte: eine Stelle für alle Ausgänge ────────────────────────
//
// Projekte, Zertifikate, Ehrenamt, Publikationen und freie Abschnitte laufen
// durch sieben Ausgänge: Vorschau/PDF, Word (zwei Fassungen), Markdown (Browser
// und Server), JSON Resume, ATS-Klartext. Was „befüllt" heißt, welche
// Überschrift gilt und in welcher Reihenfolge die Einträge stehen, steht
// deshalb hier und nirgends sonst — sonst zeigt Word einen Eintrag, den das
// PDF für leer hält.
//
// Alles hier ist tolerant gegen fremde Daten: Ein JSON-Import kann statt einer
// Liste irgendetwas liefern, und ein Lebenslauf darf daran nicht zerbrechen.

import type {
  CVData, Lang, SectionKey, ProjectEntry, CertificateEntry, VolunteerEntry,
  PublicationEntry, CustomSection, CustomEntry,
} from './types';
import { EXTRA_SECTION_LABELS } from './labels';
import { DEFAULT_SECTION_ORDER } from './types';

export type ExtraSectionKey = 'projects' | 'certificates' | 'volunteering' | 'publications' | 'custom';
/** Die vier festen Abschnitte — die mit einer Überschrift aus `labels`. */
export type FixedExtraKey = Exclude<ExtraSectionKey, 'custom'>;

export const EXTRA_SECTION_KEYS: ExtraSectionKey[] = ['projects', 'certificates', 'volunteering', 'publications', 'custom'];
export const FIXED_EXTRA_KEYS: FixedExtraKey[] = ['projects', 'certificates', 'volunteering', 'publications'];

export const isExtraKey = (k: string): k is ExtraSectionKey => (EXTRA_SECTION_KEYS as string[]).includes(k);

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim();
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? v.filter(x => x && typeof x === 'object') as T[] : []);
const lines = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : []);

/** Überschrift eines festen Abschnitts: eigene Beschriftung des Profils,
 *  sonst die Vorgabe der Dokumentsprache. */
export function sectionHeading(labels: CVData['labels'] | undefined, key: FixedExtraKey): string {
  const own = s((labels?.sections as Record<string, unknown> | undefined)?.[key]);
  if (own) return own;
  const lang = (labels?.lang ?? 'de') as Lang;
  return (EXTRA_SECTION_LABELS[lang] ?? EXTRA_SECTION_LABELS.de)[key];
}

// ── Befüllte Einträge ────────────────────────────────────────────────────────
// Ein Eintrag zählt, sobald irgendein Feld Text trägt. Ein angelegter, aber
// leerer Eintrag erscheint nirgends — wie eine leere Zeile im Formular.

export function projectsOf(cv: CVData): ProjectEntry[] {
  return list<ProjectEntry>(cv.projects).filter(p =>
    s(p.title) || s(p.role) || s(p.description) || s(p.url) || lines(p.bullets).length);
}

export function certificatesOf(cv: CVData): CertificateEntry[] {
  return list<CertificateEntry>(cv.certificates).filter(c =>
    s(c.name) || s(c.issuer) || s(c.credentialId) || s(c.url));
}

export function volunteeringOf(cv: CVData): VolunteerEntry[] {
  return list<VolunteerEntry>(cv.volunteering).filter(v =>
    s(v.role) || s(v.organization) || lines(v.bullets).length);
}

export function publicationsOf(cv: CVData): PublicationEntry[] {
  return list<PublicationEntry>(cv.publications).filter(p =>
    s(p.title) || s(p.publisher) || s(p.url) || s(p.description));
}

export function customEntriesOf(sec: CustomSection): CustomEntry[] {
  return list<CustomEntry>(sec.entries).filter(e => s(e.title) || s(e.subtitle) || s(e.text));
}

export function customItemsOf(sec: CustomSection): string[] {
  return lines(sec.items);
}

/** Freie Abschnitte mit Inhalt. Eine Überschrift ohne Inhalt ist keiner. */
export function customSectionsOf(cv: CVData): CustomSection[] {
  return list<CustomSection>(cv.customSections).filter(c => customItemsOf(c).length || customEntriesOf(c).length);
}

export function bulletsOf(e: { bullets?: unknown }): string[] {
  return lines(e.bullets);
}

/** Hat der Abschnitt etwas zu zeigen? */
export function hasExtra(cv: CVData, key: ExtraSectionKey): boolean {
  switch (key) {
    case 'projects': return projectsOf(cv).length > 0;
    case 'certificates': return certificatesOf(cv).length > 0;
    case 'volunteering': return volunteeringOf(cv).length > 0;
    case 'publications': return publicationsOf(cv).length > 0;
    case 'custom': return customSectionsOf(cv).length > 0;
  }
}

// ── Kleinteile für die Ausgabe ───────────────────────────────────────────────

/** „01/2023 – 06/2024", „seit 2019" gibt es nicht: fehlt ein Ende, steht nur
 *  der Anfang; fehlt der Anfang, nur das Ende. `present` wird übersetzt. */
export function dateRange(start: unknown, end: unknown, presentLabel: string): string {
  const a = s(start);
  const raw = s(end);
  const b = raw === 'present' || raw === 'heute' ? presentLabel : raw;
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

/** Anzeigeform eines Links: ohne Protokoll, ohne „www.", ohne Schrägstrich am Ende. */
export function shortLink(url: unknown): string {
  return s(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

/** Verweisziel eines Links, den der Mensch mit oder ohne Protokoll getippt hat. */
export function linkHref(url: unknown): string {
  const t = s(url);
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

// ── Klartext ─────────────────────────────────────────────────────────────────

/** Alle Wörter der neuen Abschnitte — für den Begriffsabgleich der
 *  ATS-Prüfung, der sonst nur Berufsweg, Skills und Ausbildung kennt. */
export function extraSectionsText(cv: CVData): string {
  const out: string[] = [];
  for (const p of projectsOf(cv)) out.push(s(p.title), s(p.role), s(p.description), ...bulletsOf(p));
  for (const c of certificatesOf(cv)) out.push(s(c.name), s(c.issuer));
  for (const v of volunteeringOf(cv)) out.push(s(v.role), s(v.organization), ...bulletsOf(v));
  for (const p of publicationsOf(cv)) out.push(s(p.title), s(p.publisher), s(p.description));
  for (const c of customSectionsOf(cv)) {
    out.push(s(c.title), ...customItemsOf(c));
    for (const e of customEntriesOf(c)) out.push(s(e.title), s(e.subtitle), s(e.text));
  }
  return out.filter(Boolean).join(' ');
}

/** Die neuen Abschnitte als Klartext in Großbuchstaben-Gliederung — dieselbe
 *  Form wie die übrige Notizblock-Ansicht der ATS-Prüfung. */
export function extraSectionsPlain(cv: CVData): string[] {
  const out: string[] = [];
  const present = cv.labels?.misc?.present || 'present';
  const head = (t: string) => out.push(t.toLocaleUpperCase());
  const ps = projectsOf(cv);
  if (ps.length) {
    head(sectionHeading(cv.labels, 'projects'));
    for (const p of ps) {
      out.push([s(p.title), s(p.role)].filter(Boolean).join(' - '));
      const d = dateRange(p.start, p.end, present); if (d) out.push(d);
      if (s(p.url)) out.push(s(p.url));
      if (s(p.description)) out.push(s(p.description));
      for (const b of bulletsOf(p)) out.push(`* ${b}`);
      out.push('');
    }
  }
  const cs = certificatesOf(cv);
  if (cs.length) {
    head(sectionHeading(cv.labels, 'certificates'));
    for (const c of cs) out.push([s(c.name), s(c.issuer), s(c.date), s(c.credentialId), s(c.url)].filter(Boolean).join(' - '));
    out.push('');
  }
  const vs = volunteeringOf(cv);
  if (vs.length) {
    head(sectionHeading(cv.labels, 'volunteering'));
    for (const v of vs) {
      out.push([s(v.role), s(v.organization), s(v.location)].filter(Boolean).join(' - '));
      const d = dateRange(v.start, v.end, present); if (d) out.push(d);
      for (const b of bulletsOf(v)) out.push(`* ${b}`);
      out.push('');
    }
  }
  const pubs = publicationsOf(cv);
  if (pubs.length) {
    head(sectionHeading(cv.labels, 'publications'));
    for (const p of pubs) {
      out.push([s(p.title), s(p.publisher), s(p.date)].filter(Boolean).join(' - '));
      if (s(p.url)) out.push(s(p.url));
      if (s(p.description)) out.push(s(p.description));
    }
    out.push('');
  }
  for (const c of customSectionsOf(cv)) {
    head(s(c.title) || '—');
    for (const it of customItemsOf(c)) out.push(`* ${it}`);
    for (const e of customEntriesOf(c)) {
      out.push([s(e.title), s(e.subtitle), s(e.date)].filter(Boolean).join(' - '));
      if (s(e.text)) out.push(s(e.text));
    }
    out.push('');
  }
  return out;
}

// ── Reihenfolge ──────────────────────────────────────────────────────────────

/** Gespeicherte Reihenfolge um die Schlüssel ergänzen, die sie noch nicht
 *  kennt — jeweils vor dem nächsten bekannten Nachbarn der Vorgabe. Dieselbe
 *  Regel wie im Renderer (`mainOrder`) und in Word (`orderedSections`). */
export function completeOrder(defaultOrder: SectionKey[], saved?: SectionKey[]): SectionKey[] {
  if (!saved || !saved.length) return [...defaultOrder];
  const known = new Set<SectionKey>(defaultOrder);
  const out: SectionKey[] = saved.filter((k, i) => known.has(k) && saved.indexOf(k) === i);
  const have = new Set(out);
  for (let i = 0; i < defaultOrder.length; i++) {
    const k = defaultOrder[i];
    if (have.has(k)) continue;
    let at = out.length;
    for (let j = i + 1; j < defaultOrder.length; j++) {
      const idx = out.indexOf(defaultOrder[j]);
      if (idx >= 0) { at = idx; break; }
    }
    out.splice(at, 0, k);
    have.add(k);
  }
  return out;
}

/** Reihenfolge für „Abschnitte ordnen": gespeicherte Reihenfolge, ergänzt um
 *  die Schlüssel, die sie noch nicht kennt — ohne die eigenen Abschnitte, in
 *  denen nichts steht. Fünf leere Zeilen zum Sortieren helfen niemandem. */
export function sectionOrderFor(cv: CVData, saved?: SectionKey[]): SectionKey[] {
  return completeOrder(DEFAULT_SECTION_ORDER, saved).filter(k => !isExtraKey(k) || hasExtra(cv, k));
}

/** Neue, stabile Kennung für einen Eintrag. */
export function newExtraId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
