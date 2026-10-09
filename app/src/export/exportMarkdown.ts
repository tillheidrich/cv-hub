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
 * Deshalb baut diese Datei jetzt exakt dasselbe Format wie die Bridge. Die
 * Abschnittsnamen sind dort bewusst deutsch und fest — sie sind Schlüssel für
 * den Parser, keine Beschriftung für Menschen; die Sprache des Inhalts steht
 * im Frontmatter.
 */
import type { CVData, ProjectEntry, CertificateEntry, VolunteerEntry, PublicationEntry, CustomSection, CustomEntry } from '../data/types';
import { saveText } from './saveFile';
import { exportFilename } from './filename';

export function exportMarkdown(data: CVData): void {
  const md = buildMarkdown(data);
  saveText(exportFilename('lebenslauf', data.personal.name, 'md'), md, 'text/markdown');
}

const v = (s?: string | null) => (s || '').trim();

/** Kopfzeile eines Eintrags: „Firma · Ort · 01/2020 – heute". */
function metaLine(parts: (string | undefined)[], start?: string, end?: string): string {
  const dates = `${v(start)} – ${v(end)}`.trim();
  return [...parts.map(v), dates !== '–' ? dates : ''].filter(Boolean).join(' · ');
}

export function buildMarkdown(data: CVData, settings?: {
  template?: string; fontScale?: number; fontPairing?: string; pageMode?: string;
}): string {
  const { personal: p, profile, experience, education, skillGroups, languages, additionalExperience, labels } = data;
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

  out.push('## Kontakt');
  if (v(p.email)) out.push(`- E-Mail: ${v(p.email)}`);
  if (v(p.phone)) out.push(`- Telefon: ${v(p.phone)}`);
  if (v(p.location)) out.push(`- Ort: ${v(p.location)}`);
  if (v(p.website)) out.push(`- Website: ${v(p.website)}`);
  for (const s of (p.socials || [])) {
    if (v(s.value)) out.push(`- ${s.platform.charAt(0).toUpperCase()}${s.platform.slice(1)}: ${v(s.value)}`);
  }
  if (v(p.linkedin)) out.push(`- LinkedIn: ${v(p.linkedin)}`);
  if (v(p.instagram)) out.push(`- Instagram: ${v(p.instagram)}`);
  if (v(p.birthDate)) out.push(`- Geburtsdatum: ${v(p.birthDate)}`);
  if (v(p.driversLicense)) out.push(`- Führerschein: ${v(p.driversLicense)}`);
  if (v(p.nationality)) out.push(`- Staatsangehörigkeit: ${v(p.nationality)}`);
  if (v(p.maritalStatus)) out.push(`- Familienstand: ${v(p.maritalStatus)}`);
  out.push('');

  if (v(profile?.text)) {
    out.push('## Profil');
    out.push(v(profile.text));
    out.push('');
  }

  const sichtbar = (experience || []).filter(e => !e.hidden);
  if (sichtbar.length) {
    out.push('## Berufserfahrung');
    out.push('');
    for (const e of sichtbar) {
      out.push(`### ${v(e.role)}`);
      const meta = metaLine([e.company, e.location], e.start, e.end === 'present' ? labels?.misc?.present : e.end);
      if (meta) out.push(meta);
      for (const b of (e.bullets || [])) if (v(b)) out.push(`- ${v(b)}`);
      out.push('');
    }
  }

  if ((education || []).length) {
    out.push('## Ausbildung');
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
    out.push('## Skills');
    out.push('');
    for (const g of skillGroups) {
      out.push(`### ${v(g.label)}`);
      for (const item of (g.items || [])) if (v(item)) out.push(`- ${v(item)}`);
      out.push('');
    }
  }

  if ((languages || []).length) {
    out.push('## Sprachen');
    for (const l of languages) {
      // Die Punkteskala reist als „(N/5)" mit — sonst geht sie auf dem Weg
      // durch einen Texteditor verloren. Der Parser nimmt sie wieder heraus.
      const suffix = (typeof l.dots === 'number' && l.dots >= 1 && l.dots <= 5) ? ` (${l.dots}/5)` : '';
      out.push(`- ${v(l.language)} — ${v(l.level)}${suffix}`);
    }
    out.push('');
  }

  if ((additionalExperience || []).length) {
    out.push('## Weiteres');
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

function periodLine(start?: string, end?: string): string {
  const a = w(start), b = w(end);
  if (!a && !b) return '';
  return `Zeitraum: ${[a, '–', b].filter(Boolean).join(' ')}`;
}

export function extraSectionsToMarkdown(cv: CVData): string[] {
  const out: string[] = [];
  const heading = (t: string) => out.push(t ? `### ${t}` : '###');
  const field = (k: string, x?: string) => { if (w(x)) out.push(`${k}: ${w(x)}`); };
  const text = (x?: string) => { if (w(x)) out.push(w(x)); };
  const bullets = (x?: unknown) => { for (const b of extraLines(x)) out.push(`- ${b}`); };

  const projects = extraList<ProjectEntry>(cv.projects).filter(p => w(p.title) || w(p.role) || w(p.description) || w(p.url) || extraLines(p.bullets).length);
  if (projects.length) {
    out.push('## Projekte', '');
    for (const p of projects) {
      heading(w(p.title));
      field('Rolle', p.role);
      const per = periodLine(p.start, p.end); if (per) out.push(per);
      field('Link', p.url);
      text(p.description);
      bullets(p.bullets);
      out.push('');
    }
  }

  const certs = extraList<CertificateEntry>(cv.certificates).filter(c => w(c.name) || w(c.issuer) || w(c.credentialId) || w(c.url));
  if (certs.length) {
    out.push('## Zertifikate', '');
    for (const c of certs) {
      heading(w(c.name));
      field('Aussteller', c.issuer);
      field('Datum', c.date);
      field('Kennung', c.credentialId);
      field('Link', c.url);
      out.push('');
    }
  }

  const vols = extraList<VolunteerEntry>(cv.volunteering).filter(x => w(x.role) || w(x.organization) || extraLines(x.bullets).length);
  if (vols.length) {
    out.push('## Ehrenamt', '');
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
    out.push('## Publikationen', '');
    for (const p of pubs) {
      heading(w(p.title));
      field('Verlag', p.publisher);
      field('Datum', p.date);
      field('Link', p.url);
      text(p.description);
      out.push('');
    }
  }

  for (const c of extraList<CustomSection>(cv.customSections)) {
    const items = extraLines(c.items);
    const entries = extraList<CustomEntry>(c.entries).filter(e => w(e.title) || w(e.subtitle) || w(e.text));
    if (!items.length && !entries.length) continue;
    out.push(`## Abschnitt: ${w(c.title)}`.trimEnd());
    for (const it of items) out.push(`- ${it}`);
    out.push('');
    for (const e of entries) {
      heading(w(e.title));
      field('Untertitel', e.subtitle);
      field('Datum', e.date);
      text(e.text);
      out.push('');
    }
  }
  return out;
}
