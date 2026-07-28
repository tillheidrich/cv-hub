/**
 * LinkedIn Data Export Importer
 *
 * LinkedIn lets users download a ZIP from:
 * Settings → Data Privacy → Get a copy of your data
 *
 * The ZIP contains CSV files. We parse the relevant ones:
 *   Profile.csv        → PersonalInfo
 *   Positions.csv      → ExperienceEntry[]
 *   Education.csv      → EducationEntry[]
 *   Skills.csv         → flat skill list
 *   Languages.csv      → LanguageEntry[]
 *
 * No scraping. No API calls. Everything stays in the browser.
 */

import type { CVData, ExperienceEntry, EducationEntry, SkillGroup, LanguageEntry } from '../data/types';
import { labelsDE } from '../data/labels';

// ── CSV parser (no dependency needed – LinkedIn CSVs are well-formed) ────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Date normalisation (LinkedIn uses YYYY-MM-DD or "Present") ───────────────

function normalizeDate(raw: string): string {
  if (!raw || raw === '' || raw.toLowerCase() === 'present' || raw.toLowerCase() === 'heute') {
    return 'present';
  }
  // YYYY-MM-DD → MM/YYYY
  const match = raw.match(/^(\d{4})-(\d{2})(-\d{2})?$/);
  if (match) return `${match[2]}/${match[1]}`;
  // YYYY → YYYY
  if (/^\d{4}$/.test(raw)) return raw;
  return raw;
}

// ── Bullet splitting ─────────────────────────────────────────────────────────

function splitBullets(description: string): string[] {
  if (!description) return [];
  // Split on common delimiters: newline, "• ", "- ", numbered "1. "
  const parts = description
    .replace(/\r\n/g, '\n')
    .split(/\n+|(?:^|\n)\s*[-•]\s*|(?:^|\n)\s*\d+\.\s*/m)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  return parts.length > 0 ? parts : [description.trim()];
}

// ── Individual CSV parsers ───────────────────────────────────────────────────

function parseProfile(rows: Record<string, string>[]): Partial<CVData['personal']> {
  if (rows.length === 0) return {};
  const r = rows[0];
  return {
    name: [r['First Name'], r['Last Name']].filter(Boolean).join(' '),
    title: r['Headline'] ?? '',
    location: r['Geo Location'] ?? r['Location'] ?? '',
  };
}

function parsePositions(rows: Record<string, string>[]): ExperienceEntry[] {
  return rows
    .filter(r => r['Company Name'] || r['Title'])
    .map((r, idx) => ({
      id: `li-exp-${idx}`,
      role: r['Title'] ?? '',
      company: r['Company Name'] ?? '',
      location: r['Location'] ?? '',
      start: normalizeDate(r['Started On'] ?? ''),
      end: normalizeDate(r['Finished On'] ?? 'present'),
      bullets: splitBullets(r['Description'] ?? ''),
    }));
}

function parseEducation(rows: Record<string, string>[]): EducationEntry[] {
  return rows
    .filter(r => r['School Name'] || r['Degree Name'])
    .map((r, idx) => ({
      id: `li-edu-${idx}`,
      degree: ([r['Degree Name'], r['Field Of Study']].filter(Boolean).join(', ')) || (r['School Name'] ?? ''),
      institution: r['School Name'] ?? '',
      start: normalizeDate(r['Start Date'] ?? ''),
      end: normalizeDate(r['End Date'] ?? ''),
      notes: r['Notes'] ?? r['Description'] ?? undefined,
    }));
}

function parseSkills(rows: Record<string, string>[]): SkillGroup {
  const items = rows
    .map(r => r['Name'] ?? r['Skill'] ?? '')
    .filter(Boolean);
  return { label: 'Skills', items };
}

function parseLanguages(rows: Record<string, string>[]): LanguageEntry[] {
  return rows
    .filter(r => r['Name'])
    .map(r => ({
      language: r['Name'] ?? '',
      level: r['Proficiency'] ?? '',
    }));
}

// ── ZIP reading (native File API + DataView, no jszip needed) ────────────────
// We use a simple approach: read ZIP entries via the browser FileReader API.
// For most LinkedIn exports, the ZIP structure is flat (no subdirectories).

interface ZipEntry { name: string; data: Uint8Array }

async function readZipEntries(file: File): Promise<ZipEntry[]> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < bytes.length - 4) {
    // Local file header signature: 0x04034b50
    if (view.getUint32(offset, true) !== 0x04034b50) break;

    const flags         = view.getUint16(offset + 6,  true);
    const compression   = view.getUint16(offset + 8,  true);
    const compSize      = view.getUint32(offset + 18, true);
    const uncompSize    = view.getUint32(offset + 22, true);
    const nameLen       = view.getUint16(offset + 26, true);
    const extraLen      = view.getUint16(offset + 28, true);
    const name          = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLen));
    const dataStart     = offset + 30 + nameLen + extraLen;

    if (compression === 0) {
      // Stored (no compression)
      entries.push({ name, data: bytes.slice(dataStart, dataStart + uncompSize) });
    } else if (compression === 8) {
      // Deflate – use DecompressionStream if available
      try {
        const compressed = bytes.slice(dataStart, dataStart + compSize);
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressed);
        writer.close();
        const chunks: Uint8Array[] = [];
        const reader = ds.readable.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const out = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
        let pos = 0;
        for (const c of chunks) { out.set(c, pos); pos += c.length; }
        entries.push({ name, data: out });
      } catch {
        // DecompressionStream not available – skip deflated entries
      }
    }

    // Data descriptor present (bit 3 of flags set): 12 extra bytes after data
    const descriptorSize = (flags & 0x8) ? 12 : 0;
    offset = dataStart + compSize + descriptorSize;
  }

  return entries;
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface LinkedInImportResult {
  partial: Partial<CVData>;
  warnings: string[];
}

export async function importLinkedIn(file: File): Promise<LinkedInImportResult> {
  const warnings: string[] = [];
  const csvMap: Record<string, string> = {};

  const isZip = file.name.toLowerCase().endsWith('.zip');

  if (isZip) {
    const entries = await readZipEntries(file);
    for (const entry of entries) {
      const baseName = entry.name.split('/').pop() ?? entry.name;
      csvMap[baseName.toLowerCase()] = new TextDecoder('utf-8').decode(entry.data);
    }
  } else if (file.name.toLowerCase().endsWith('.csv')) {
    // Single CSV file – detect type from header
    const text = await file.text();
    csvMap[file.name.toLowerCase()] = text;
  } else {
    throw new Error('Bitte eine LinkedIn ZIP-Datei oder einzelne CSV-Datei hochladen.');
  }

  // Helper: get CSV rows for a known filename variant
  function getRows(candidates: string[]): Record<string, string>[] {
    for (const c of candidates) {
      if (csvMap[c]) return parseCSV(csvMap[c]);
    }
    return [];
  }

  const profileRows  = getRows(['profile.csv']);
  const positionRows = getRows(['positions.csv']);
  const educRows     = getRows(['education.csv']);
  const skillRows    = getRows(['skills.csv']);
  const langRows     = getRows(['languages.csv']);

  if (profileRows.length === 0 && positionRows.length === 0) {
    warnings.push('Keine bekannten LinkedIn-CSV-Dateien gefunden. Stelle sicher, dass du die vollständige LinkedIn-Datenexport-ZIP hochlädst.');
  }

  const partialPersonal = parseProfile(profileRows);
  const experience      = parsePositions(positionRows);
  const education       = parseEducation(educRows);
  const skillGroup      = parseSkills(skillRows);
  const languages       = parseLanguages(langRows);

  if (experience.length === 0) warnings.push('Keine Berufserfahrung gefunden (positions.csv fehlt oder ist leer).');
  if (education.length === 0)  warnings.push('Keine Ausbildung gefunden (education.csv fehlt oder ist leer).');

  const partial: Partial<CVData> = {
    personal: {
      name: partialPersonal.name ?? '',
      title: partialPersonal.title ?? '',
      location: partialPersonal.location ?? '',
      email: '',
      phone: '',
    },
    experience,
    education,
    skillGroups: skillGroup.items.length > 0 ? [skillGroup] : [],
    languages: languages.length > 0 ? languages : [],
    labels: labelsDE,
  };

  return { partial, warnings };
}
