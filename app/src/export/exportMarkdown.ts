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
import type { CVData } from '../data/types';
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
  out.push(`template: ${settings?.template || 'hamburg'}`);
  out.push(`lang: ${labels?.lang || 'de'}`);
  out.push(`fontScale: ${settings?.fontScale ?? 1.0}`);
  out.push(`fontPairing: ${settings?.fontPairing || 'auto'}`);
  out.push(`pageMode: ${settings?.pageMode || 'one'}`);
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

  return out.join('\n');
}
