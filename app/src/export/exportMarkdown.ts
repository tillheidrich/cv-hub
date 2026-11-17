/**
 * Markdown-Export ohne Server.
 *
 * Es gibt zwei Wege zu einer .md-Datei: die Bridge auf dem Server
 * (`pdf-service/markdown.js`) und diese Fassung hier, die ohne Anmeldung und
 * ohne Netz auskommt — im Demo-Modus und immer dann, wenn der Server nicht
 * antwortet.
 *
 * Bis zum 16.09.2026 schrieben beide ein ANDERES Markdown: der Server mit
 * Frontmatter und festen Abschnittsnamen, diese Fassung mit übersetzten
 * Überschriften, kursiven Datumszeilen und ohne Frontmatter. Sichtbar wurde
 * das erst, als jeder Ausgang einmal wirklich durchgemessen wurde
 * (`scripts/exportcheck.mjs`): die Datei ließ sich nicht zurückspielen, weil
 * der Parser weder Vorlage noch Sprache noch die Abschnitte fand. „Rund-um
 * bearbeitbar" stand am Knopf, stimmte aber nur für den einen Weg.
 *
 * Deshalb baut diese Datei jetzt exakt dasselbe Format wie die Bridge.
 *
 * Seit 17.11.2026 stehen Überschriften und Feldschlüssel in der Sprache des
 * Lebenslaufs (export/markdownHeads.ts): ein englischer CV schreibt
 * „## Experience“ und „- Phone:“, nicht „## Berufserfahrung“ und
 * „- Telefon:“. Die Parser lesen alle vier Sprachen.
 */
import type { CVData, ProjectEntry, CertificateEntry, VolunteerEntry, PublicationEntry, CustomSection, CustomEntry } from '../data/types';
import { saveText } from './saveFile';
import { exportFilename } from './filename';
import { mdHeadsOf } from './markdownHeads';
import { isPresentWord } from '../data/extraSections';

export function exportMarkdown(data: CVData): void {
  const md = buildMarkdown(data);
  saveText(exportFilename('lebenslauf', data.personal.name, 'md', data.labels?.lang), md, 'text/markdown');
}

const v = (s?: string | null) => (s || '').trim();

/** Kopfzeile eines Eintrags: „Firma · Ort · 01/2020 – heute“. */
function metaLine(parts: (string | undefined)[], start?: string, end?: string): string {
  const dates = `${v(start)} – ${v(end)}`.trim();
  return [...parts.map(v), dates !== '–' ? dates : ''].filter(Boolean).join(' · ');
}

export function buildMarkdown(data: CVData, settings?: {
  template?: string; fontScale?: number; fontPairing?: string; pageMode?: string;
}): string {
  const { personal: p, profile, experience, education, skillGroups, languages, additionalExperience, labels } = data;
  const H = mdHeadsOf(labels?.lang || 'de');
  /* Ende einer Stelle wie im PDF (data/extraSections.ts `endLabel`) und wie
   * am Server (`jobEnd`): „today“, „heute“ … und ein leeres Ende bei
   * vorhandenem Beginn werden zur Beschriftung der Sprache. */
  const presentLbl = v(labels?.misc?.present) || H.present;
  const jobEnd = (start?: string, end?: string) => (isPresentWord(end) || (!v(end) && v(start)) ? presentLbl : v(end));
  const out: string[] = [];

  out.push('---');
  /* Vorlage und Satz nur, wenn sie bekannt sind. Bis zum 08.10.2026 stand
   * hier ohne Einstellungen „template: hamburg" — und wer die Datei über ein
   * Konto zurückspielte, bekam stillschweigend Hamburg als Vorlage. */
  if (settings?.template) out.push(`template: ${settings.template}`);
  out.push(`lang: ${labels?.lang || 'de'}`);
  if (settings) {
    out.push(`fontScale: ${settings.fontScale ?? 1.0}`);
    out.push(`fontPairing: ${settings.fontPairing || 'auto'}`);
    out.push(`pageMode: ${settings.pageMode || 'one'}`);
  }
  out.push('---');
  out.push('');

  out.push(`# ${v(p.name)}`);
  if (v(p.title)) out.push(`**${v(p.title)}**`);
  out.push('');

  out.push(`## ${H.contact}`);
  if (v(p.email)) out.push(`- ${H.email}: ${v(p.email)}`);
  if (v(p.phone)) out.push(`- ${H.phone}: ${v(p.phone)}`);
  if (v(p.location)) out.push(`- ${H.location}: ${v(p.location)}`);
  if (v(p.website)) out.push(`- ${H.website}: ${v(p.website)}`);
  for (const s of (p.socials || [])) {
    if (v(s.value)) out.push(`- ${s.platform.charAt(0).toUpperCase()}${s.platform.slice(1)}: ${v(s.value)}`);
  }
  if (v(p.linkedin)) out.push(`- LinkedIn: ${v(p.linkedin)}`);
  if (v(p.instagram)) out.push(`- Instagram: ${v(p.instagram)}`);
  if (v(p.birthDate)) out.push(`- ${H.birthDate}: ${v(p.birthDate)}`);
  if (v(p.driversLicense)) out.push(`- ${H.driversLicense}: ${v(p.driversLicense)}`);
  if (v(p.nationality)) out.push(`- ${H.nationality}: ${v(p.nationality)}`);
  if (v(p.maritalStatus)) out.push(`- ${H.maritalStatus}: ${v(p.maritalStatus)}`);
  out.push('');

  if (v(profile?.text)) {
    out.push(`## ${H.profile}`);
    out.push(v(profile.text));
    out.push('');
  }

  const sichtbar = (experience || []).filter(e => !e.hidden);
  if (sichtbar.length) {
    out.push(`## ${H.experience}`);
    out.push('');
    for (const e of sichtbar) {
      out.push(`### ${v(e.role)}`);
      const meta = metaLine([e.company, e.location], e.start, jobEnd(e.start, e.end));
      if (meta) out.push(meta);
      for (const b of (e.bullets || [])) if (v(b)) out.push(`- ${v(b)}`);
      out.push('');
    }
  }

  if ((education || []).length) {
    out.push(`## ${H.education}`);
    out.push('');
    for (const e of education) {
      out.push(`### ${v(e.degree)}`);
      const meta = metaLine([e.institution, e.location], e.start, e.end);
      if (meta) out.push(meta);
      if (v(e.notes)) out.push(v(e.notes));
      out.push('');
    }
  }

  if ((skillGroups || []).length) {
    out.push(`## ${H.skills}`);
    out.push('');
    for (const g of skillGroups) {
      out.push(`### ${v(g.label)}`);
      for (const item of (g.items || [])) if (v(item)) out.push(`- ${v(item)}`);
      out.push('');
    }
  }

  if ((languages || []).length) {
    out.push(`## ${H.languages}`);
    for (const l of languages) {
      // Die Punkteskala reist als „(N/5)" mit — sonst geht sie auf dem Weg
      // durch einen Texteditor verloren. Der Parser nimmt sie wieder heraus.
      const suffix = (typeof l.dots === 'number' && l.dots >= 1 && l.dots <= 5) ? ` (${l.dots}/5)` : '';
      out.push(`- ${v(l.language)} — ${v(l.level)}${suffix}`);
    }
    out.push('');
  }

  if ((additionalExperience || []).length) {
    out.push(`## ${H.additional}`);
    for (const item of (additionalExperience || [])) if (v(item)) out.push(`- ${item}`);
    out.push('');
  }

  out.push(...extraSectionsToMarkdown(data));

  return out.join('\n');
}

// ── Eigene Abschnitte ───────────────────────────────────────────────────────
// Zeile für Zeile dasselbe wie `extraSectionsToMarkdown` in
// pdf-service/markdown.js (dort steht das Format beschrieben). Gelesen wird es
// in import/markdownBridge.ts. Geprüft in scripts/sectionsroundtrip.mjs: beide
// Schreiber liefern für dieselben Daten denselben Text.

/** Wie `v`, aber auch für Werte, die keine Zeichenkette sind (fremdes JSON). */
const w = (x: unknown): string => (x == null ? '' : String(x)).trim();
const extraList = <T>(x: unknown): T[] => (Array.isArray(x) ? x.filter(e => e && typeof e === 'object') as T[] : []);
const extraLines = (x: unknown): string[] => (Array.isArray(x) ? x.map(w).filter(Boolean) : []);

function periodLine(start?: string, end?: string, key = 'Zeitraum'): string {
  const a = w(start), b = w(end);
  if (!a && !b) return '';
  return `${key}: ${[a, '–', b].filter(Boolean).join(' ')}`;
}

export function extraSectionsToMarkdown(cv: CVData): string[] {
  const H = mdHeadsOf(cv.labels?.lang || 'de');
  const out: string[] = [];
  const heading = (t: string) => out.push(t ? `### ${t}` : '###');
  const field = (k: string, x?: string) => { if (w(x)) out.push(`${k}: ${w(x)}`); };
  const text = (x?: string) => { if (w(x)) out.push(w(x)); };
  const bullets = (x?: unknown) => { for (const b of extraLines(x)) out.push(`- ${b}`); };

  const projects = extraList<ProjectEntry>(cv.projects).filter(p => w(p.title) || w(p.role) || w(p.description) || w(p.url) || extraLines(p.bullets).length);
  if (projects.length) {
    out.push(`## ${H.projects}`, '');
    for (const p of projects) {
      heading(w(p.title));
      field(H.role, p.role);
      const per = periodLine(p.start, p.end, H.period); if (per) out.push(per);
      field(H.link, p.url);
      text(p.description);
      bullets(p.bullets);
      out.push('');
    }
  }

  const certs = extraList<CertificateEntry>(cv.certificates).filter(c => w(c.name) || w(c.issuer) || w(c.credentialId) || w(c.url));
  if (certs.length) {
    out.push(`## ${H.certificates}`, '');
    for (const c of certs) {
      heading(w(c.name));
      field(H.issuer, c.issuer);
      field(H.date, c.date);
      field(H.credentialId, c.credentialId);
      field(H.link, c.url);
      out.push('');
    }
  }

  const vols = extraList<VolunteerEntry>(cv.volunteering).filter(x => w(x.role) || w(x.organization) || extraLines(x.bullets).length);
  if (vols.length) {
    out.push(`## ${H.volunteering}`, '');
    for (const x of vols) {
      heading(w(x.role));
      const dates = (w(x.start) || w(x.end)) ? `${w(x.start)} – ${w(x.end)}`.trim() : '';
      const meta = [w(x.organization), w(x.location), dates].filter(Boolean).join(' · ');
      if (meta) out.push(meta);
      bullets(x.bullets);
      out.push('');
    }
  }

  const pubs = extraList<PublicationEntry>(cv.publications).filter(p => w(p.title) || w(p.publisher) || w(p.url) || w(p.description));
  if (pubs.length) {
    out.push(`## ${H.publications}`, '');
    for (const p of pubs) {
      heading(w(p.title));
      field(H.publisher, p.publisher);
      field(H.date, p.date);
      field(H.link, p.url);
      text(p.description);
      out.push('');
    }
  }

  for (const c of extraList<CustomSection>(cv.customSections)) {
    const items = extraLines(c.items);
    const entries = extraList<CustomEntry>(c.entries).filter(e => w(e.title) || w(e.subtitle) || w(e.text));
    if (!items.length && !entries.length) continue;
    out.push(`## ${H.custom}: ${w(c.title)}`.trimEnd());
    for (const it of items) out.push(`- ${it}`);
    out.push('');
    for (const e of entries) {
      heading(w(e.title));
      field(H.subtitle, e.subtitle);
      field(H.date, e.date);
      text(e.text);
      out.push('');
    }
  }
  return out;
}
