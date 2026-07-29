// ATS-clean DOCX export. Single column, real Word heading styles (so parsers
// get logical structure), native bullet lists, NO tables / text boxes / columns
// / images — exactly what Applicant Tracking Systems parse reliably. Runs fully
// client-side (works in demo mode too). No AI involved.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat,
} from 'docx';
import type { CVData, PersonalInfo } from '../data/types';

const val = (s?: string | null) => (s || '').trim();

/** Contact + personal detail lines, ATS-friendly (label: value, plain text). */
function personalLines(p: PersonalInfo, fields: CVData['labels']['fields']): string[] {
  const contact = [val(p.email), val(p.phone), val(p.location), val(p.website)].filter(Boolean);
  const socials = (p.socials || []).map(s => val(s.value)).filter(Boolean);
  if (val(p.linkedin)) socials.push(val(p.linkedin));
  const line1 = [...contact, ...socials].join('  ·  ');
  const detail = [
    p.birthDate && `${fields.birthDate}: ${val(p.birthDate)}`,
    p.birthPlace && `${fields.birthPlace}: ${val(p.birthPlace)}`,
    p.nationality && `${fields.nationality}: ${val(p.nationality)}`,
    p.maritalStatus && `${fields.maritalStatus}: ${val(p.maritalStatus)}`,
    p.driversLicense && `${fields.driversLicense}: ${val(p.driversLicense)}`,
  ].filter(Boolean).join('  ·  ');
  return [line1, detail].filter(Boolean) as string[];
}

/** Build the ATS-clean DOCX document for a CV. */
export function buildDocx(cv: CVData): Document {
  const sec = cv.labels.sections;
  const fields = cv.labels.fields;
  const p = cv.personal;
  const kids: Paragraph[] = [];

  const H1 = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 260, after: 90 }, children: [new TextRun({ text, bold: true })] });
  const H2 = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 20 }, children: [new TextRun({ text, bold: true })] });
  const para = (text: string, opts: { italics?: boolean } = {}) =>
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text, italics: opts.italics })] });
  const bullet = (text: string) =>
    new Paragraph({ text, numbering: { reference: 'cv-bullets', level: 0 }, spacing: { after: 20 } });

  // ── Header: name (Title), role (subtitle), contact ──────────────────────
  kids.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 20 }, children: [new TextRun({ text: val(p.name) || val(sec.personal) || 'CV', bold: true })] }));
  if (val(p.title)) kids.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: val(p.title), italics: true })] }));
  for (const line of personalLines(p, fields)) kids.push(para(line));

  // ── Profile ─────────────────────────────────────────────────────────────
  if (val(cv.profile?.text)) { kids.push(H1(sec.profile)); kids.push(para(val(cv.profile.text))); }

  // ── Experience ──────────────────────────────────────────────────────────
  const exp = (cv.experience || []).filter(e => !e.hidden);
  if (exp.length) {
    kids.push(H1(sec.experience));
    for (const e of exp) {
      if (val(e.role)) kids.push(H2(val(e.role)));
      const meta = [val(e.company), val(e.location), [val(e.start), val(e.end)].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
      if (meta) kids.push(para(meta, { italics: true }));
      for (const b of e.bullets || []) if (val(b)) kids.push(bullet(val(b)));
    }
  }

  // ── Education ───────────────────────────────────────────────────────────
  if ((cv.education || []).length) {
    kids.push(H1(sec.education));
    for (const e of cv.education) {
      if (val(e.degree)) kids.push(H2(val(e.degree)));
      const meta = [val(e.institution), val(e.location), [val(e.start), val(e.end)].filter(Boolean).join(' – ')].filter(Boolean).join('  ·  ');
      if (meta) kids.push(para(meta, { italics: true }));
      if (val(e.notes)) kids.push(para(val(e.notes)));
    }
  }

  // ── Skills — each group is its own self-labelled section (as in the app),
  //    items rendered inline (dense + very parseable for ATS) ───────────────
  for (const g of cv.skillGroups || []) {
    const items = (g.items || []).map(val).filter(Boolean);
    if (!items.length && !val(g.label)) continue;
    kids.push(H1(val(g.label) || 'Skills'));
    kids.push(para(items.join(', ')));
  }

  // ── Languages ───────────────────────────────────────────────────────────
  if ((cv.languages || []).length) {
    kids.push(H1(sec.languages));
    for (const l of cv.languages) {
      const t = [val(l.language), val(l.level)].filter(Boolean).join(' — ');
      if (t) kids.push(bullet(t));
    }
  }

  // ── Additional ──────────────────────────────────────────────────────────
  const add = (cv.additionalExperience || []).map(val).filter(Boolean);
  if (add.length) { kids.push(H1(sec.additional)); for (const a of add) kids.push(bullet(a)); }

  return new Document({
    creator: 'CV-Hub',
    title: val(p.name) ? `${val(p.name)} — CV` : 'CV',
    description: 'ATS-ready résumé exported from CV-Hub',
    numbering: {
      config: [{
        reference: 'cv-bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
      }],
    },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 21 } }, // 10.5pt
        title: { run: { font: 'Calibri', size: 40, bold: true }, paragraph: { spacing: { after: 40 } } },
        heading1: { run: { font: 'Calibri', size: 26, bold: true }, paragraph: { spacing: { before: 240, after: 80 } } },
        heading2: { run: { font: 'Calibri', size: 22, bold: true } },
      },
    },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, // 0.5"
      children: kids,
    }],
  });
}

/** Build + trigger a browser download of the ATS DOCX. */
export async function exportDocx(cv: CVData): Promise<void> {
  const doc = buildDocx(cv);
  const blob = await Packer.toBlob(doc);
  const name = (val(cv.personal?.name) || 'lebenslauf').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lebenslauf';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
