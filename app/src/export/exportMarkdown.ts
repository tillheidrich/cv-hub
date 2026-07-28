import type { CVData } from '../data/types';
import { exportFilename } from './filename';

export function exportMarkdown(data: CVData): void {
  const md = buildMarkdown(data);
  download(exportFilename('lebenslauf', data.personal.name, 'md'), md, 'text/markdown');
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildMarkdown(data: CVData): string {
  const { personal, profile, experience, education, skillGroups, languages, additionalExperience, labels } = data;
  const { sections, fields, misc } = labels;

  const lines: string[] = [];

  // ── Header ──────────────────────────────────────────────────────────────────
  lines.push(`# ${personal.name}`);
  lines.push('');
  lines.push(`**${personal.title}**`);
  lines.push('');

  // Contact inline
  const contact: string[] = [
    `${fields.email}: ${personal.email}`,
    `${fields.phone}: ${personal.phone}`,
    `${fields.address}: ${personal.location}`,
  ];
  if (personal.website) contact.push(`${fields.web}: ${personal.website}`);
  if (personal.linkedin) contact.push(`${fields.linkedin}: ${personal.linkedin}`);
  lines.push(contact.join(' · '));
  lines.push('');

  // Personal details
  const details: string[] = [];
  if (personal.birthDate)      details.push(`${fields.birthDate}: ${personal.birthDate}`);
  if (personal.birthPlace)     details.push(`${fields.birthPlace}: ${personal.birthPlace}`);
  if (personal.maritalStatus)  details.push(`${fields.maritalStatus}: ${personal.maritalStatus}`);
  if (personal.nationality)    details.push(`${fields.nationality}: ${personal.nationality}`);
  if (personal.driversLicense) details.push(`${fields.driversLicense}: ${personal.driversLicense}`);
  if (details.length > 0) {
    lines.push(details.join(' · '));
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // ── Profile ────────────────────────────────────────────────────────────────
  lines.push(`## ${sections.profile}`);
  lines.push('');
  lines.push(profile.text);
  lines.push('');

  // ── Experience ─────────────────────────────────────────────────────────────
  lines.push(`## ${sections.experience}`);
  lines.push('');

  for (const e of experience.filter(e => !e.hidden)) {
    const end = e.end === 'present' || e.end === 'heute' ? misc.present : e.end;
    lines.push(`### ${e.role} – ${e.company}, ${e.location}`);
    lines.push(`*${e.start} – ${end}*`);
    lines.push('');
    for (const bullet of e.bullets) {
      lines.push(`- ${bullet}`);
    }
    lines.push('');
  }

  // ── Education ──────────────────────────────────────────────────────────────
  lines.push(`## ${sections.education}`);
  lines.push('');

  for (const e of education) {
    lines.push(`### ${e.degree}`);
    lines.push(`${e.institution} · ${e.start}–${e.end}`);
    if (e.notes) lines.push(`*${e.notes}*`);
    lines.push('');
  }

  // ── Skills ─────────────────────────────────────────────────────────────────
  for (const group of skillGroups) {
    lines.push(`## ${group.label}`);
    lines.push('');
    lines.push(group.items.join(' · '));
    lines.push('');
  }

  // ── Languages ──────────────────────────────────────────────────────────────
  lines.push(`## ${sections.languages}`);
  lines.push('');
  for (const l of languages) {
    lines.push(`- **${l.language}**: ${l.level}`);
  }
  lines.push('');

  // ── Additional ─────────────────────────────────────────────────────────────
  if (additionalExperience && additionalExperience.length > 0) {
    lines.push(`## ${sections.additional}`);
    lines.push('');
    for (const item of additionalExperience) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
