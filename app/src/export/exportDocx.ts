// DOCX-Export in zwei Fassungen — beide laufen vollständig im Browser und
// öffnen in Word wie in LibreOffice.
//
//   'design'  Die gewählte Vorlage, so nah wie Word es zulässt: Farbfläche der
//             Seitenspalte als Tabellenzelle mit Hintergrund, Akzentfarben,
//             Datumsspalte, Kopfbalken. Eine Einschränkung, die nicht zu
//             beheben ist: Word kennt keine randabfallende Farbfläche über die
//             ganze Blatthöhe — die Fläche endet dort, wo ihr Inhalt endet.
//             Wer das braucht, verschickt das PDF.
//   'ats'     Einspaltig, ohne Tabellen, ohne Flächen: Word-Überschriftsstile,
//             native Aufzählungen, linearer Textfluss. Das ist die Fassung für
//             Portale, die die Datei maschinell auslesen.
//
// Voreinstellung ist 'design' — wer eine Word-Datei will, will meistens das
// Dokument sehen, das er gebaut hat. Die ATS-Fassung steht daneben, benannt
// und erklärt, statt sie stillschweigend zu erzwingen.
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat,
  TabStopType, BorderStyle, Table, TableRow, TableCell, TableLayoutType,
  WidthType, ShadingType, VerticalAlign, ImageRun,
} from 'docx';
import type { CVData, PersonalInfo } from '../data/types';
import { getTheme } from '../templates/theme';
import { socialLabel, socialDisplay } from '../templates/ResumeRenderer';

const val = (s?: string | null) => (s || '').trim();

/** Rechte Textkante bei 0.5" Rändern auf A4: 21.0cm − 2×1.27cm ≈ 18.46 cm.
 *  In Twips (1/1440 Zoll): 18.46/2.54*1440 ≈ 10460. */
const RIGHT_TAB = 10460;

/**
 * Farbe des Themes in ein Hex umrechnen, das Word versteht.
 *
 * Die Themes sind teilweise in OKLCH notiert; `docx` will `RRGGBB`. Statt eine
 * Farbmathe-Bibliothek mitzuschleppen, lassen wir den Browser rechnen: Farbe an
 * ein Element hängen, `getComputedStyle` liefert immer `rgb(...)`. Der Export
 * läuft ohnehin clientseitig.
 */
function toHex(color: string, fallback = '1A1A1A'): string {
  try {
    // Über die Leinwand statt über getComputedStyle: Chromium gibt moderne
    // Farbräume (die Themes sind in OKLCH notiert) als `oklch(...)` zurück,
    // nicht als `rgb(...)`. Die Leinwand rechnet dagegen jede Farbe, die der
    // Browser versteht, in sRGB-Bildpunkte um — genau das, was Word braucht.
    // Vorher scheiterte die Umrechnung still und der Word-Export war grau.
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    if (ctx.fillStyle === '#000000' && !/^#?0{3,6}$|black|oklch\(0[^0-9]/i.test(color.trim())) {
      // fillStyle bleibt unverändert, wenn der Browser die Farbe nicht kennt.
      return fallback;
    }
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch {
    return fallback;
  }
}

/**
 * Schriftwahl für Word.
 *
 * Bewusst NICHT die Schrift der Vorlage: Inter, Space Grotesk oder Archivo sind
 * auf einem fremden Windows-Rechner nicht installiert, Word ersetzt sie dann
 * still durch irgendetwas. Stattdessen die zur Paarung passende Systemschrift,
 * die seit Jahrzehnten überall liegt — das Dokument sieht dann beim Empfänger
 * so aus, wie es beim Absender aussah.
 */
function wordFont(themeId?: string): { body: string; heading: string } {
  const t = themeId ? getTheme(themeId) : undefined;
  const serifPairings = ['inter-playfair', 'lora-source', 'merri-source', 'garamond-archivo', 'plex-corporate', 'libre-inter'];
  const serifHeading = t ? serifPairings.includes(t.defaultPairing) : false;
  return { body: 'Calibri', heading: serifHeading ? 'Georgia' : 'Calibri' };
}

/** Ein Wert, der Zeilenumbrüche tragen darf (Anschrift), als Word-Runs.
 *  Word kennt keinen „\n" im Text — ohne echten Umbruch klebten Straße und
 *  Ort in einer Zeile aneinander. */
function multiRuns(text: string, opts: Record<string, unknown>): TextRun[] {
  const lines = (text || '').split('\n');
  return lines.map((l, i) => new TextRun({ ...opts, text: l, break: i > 0 ? 1 : undefined } as never));
}

/** Derselbe Wert für Kontexte, die alles in EINE Zeile setzen (ATS-Fassung,
 *  Kopfzeilen): Umbruch wird zum Komma, nicht zum verschluckten Zeichen. */
const oneLine = (s?: string | null) => (s || '').replace(/\s*\n\s*/g, ', ').trim();

/** Contact + personal detail lines, ATS-friendly (label: value, plain text). */
function personalLines(p: PersonalInfo, fields: CVData['labels']['fields']): string[] {
  const contact = [val(p.email), val(p.phone), oneLine(p.location), val(p.website)].filter(Boolean);
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

/**
 * Bewerbungsfoto als Word-Bild.
 *
 * Nur in der Design-Fassung: Bilder sind für Lebenslauf-Parser bestenfalls
 * unsichtbar, und die ATS-Fassung daneben kommt ganz ohne aus. Für die Optik
 * ist das Foto dagegen der halbe Kopfbereich — es wegzulassen hieße, die
 * Vorlage nicht zu zeigen.
 */
function photoRun(dataUrl: string, widthMm: number, heightMm: number, alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]): Paragraph | null {
  const m = /^data:image\/(png|jpe?g|gif|bmp);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const type = kind === 'jpg' || kind === 'jpeg' ? 'jpg' : kind === 'png' ? 'png' : kind === 'gif' ? 'gif' : 'bmp';
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Paragraph({
      spacing: { after: 160 },
      alignment,
      children: [new ImageRun({
        data: bytes,
        type: type as 'png' | 'jpg' | 'gif' | 'bmp',
        transformation: { width: Math.round((widthMm / 25.4) * 96), height: Math.round((heightMm / 25.4) * 96) },
      })],
    });
  } catch {
    return null;
  }
}

/** mm → Twips (1/1440 Zoll). */
const mm = (v: number) => Math.round((v / 25.4) * 1440);

const PAGE_W = mm(210);
const PAGE_H = mm(297);

/** Welche Fassung gebaut wird — siehe Kopfkommentar. */
export type DocxVariant = 'design' | 'ats';

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const NO_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

/** Farbsatz für einen Bereich des Dokuments (Hauptspalte oder Farbfläche). */
interface Pal { ink: string; soft: string; accent: string; }

/**
 * Bausteine des Lebenslaufs als Word-Absätze.
 *
 * Bewusst eine Fabrik statt fester Absätze: dieselben Inhalte werden einmal in
 * der Hauptspalte (dunkle Schrift auf Weiß) und einmal in der Farbfläche
 * (helle Schrift auf Vollton) gebraucht. Die Struktur — Überschrift, Eintrag,
 * Aufzählung — bleibt in beiden Fällen dieselbe, damit ein Parser dieselben
 * Abschnitte findet, egal wie die Vorlage aussieht.
 */
function makeParts(cv: CVData, pal: Pal, fonts: { body: string; heading: string }, rightTab: number, dateTab: number | null) {
  const val2 = val;
  const H1 = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 260, after: 90 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 4, color: pal.accent } },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, color: pal.accent, characterSpacing: 16, font: fonts.body, size: 19 })],
    });
  /** Überschrift ohne Linie — für die schmale Farbfläche, wo eine Linie über
   *  die halbe Spaltenbreite unruhig wirkt. */
  const H1Plain = (text: string) =>
    new Paragraph({
      spacing: { before: 220, after: 70 },
      children: [new TextRun({ text: text.toUpperCase(), bold: true, color: pal.accent, characterSpacing: 16, font: fonts.body, size: 17 })],
    });
  const H2 = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 20 }, children: [new TextRun({ text, bold: true, color: pal.ink, font: fonts.heading })] });

  /** Eintragskopf. Zwei Formen, je nach Vorlage:
   *  — Datum rechtsbündig am Textrand (Sidebar- und Bandlayouts)
   *  — Datum in einer linken Spalte (tabellarische, DIN-nahe Vorlagen)
   *  Beides über Tabstopps, nicht über verschachtelte Tabellen: ein Tabstopp
   *  ist für jeden Parser schlicht Leerraum, eine Tabelle nicht. */
  const H2Dated = (text: string, dates: string) => {
    if (!dates) return H2(text);
    if (dateTab !== null) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 170, after: 20 },
        indent: { left: dateTab, hanging: dateTab },
        tabStops: [{ type: TabStopType.LEFT, position: dateTab }],
        children: [
          new TextRun({ text: dates, color: pal.soft, size: 18, font: fonts.body }),
          new TextRun({ text: '\t', font: fonts.body }),
          new TextRun({ text, bold: true, color: pal.ink, font: fonts.heading }),
        ],
      });
    }
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 160, after: 20 },
      tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
      children: [
        new TextRun({ text, bold: true, color: pal.ink, font: fonts.heading }),
        new TextRun({ text: `\t${dates}`, color: pal.soft, size: 18, font: fonts.body }),
      ],
    });
  };
  /** Zeile unter dem Eintragskopf (Firma · Ort). Rückt in tabellarischen
   *  Vorlagen auf dieselbe Kante wie der Titel darüber. */
  const meta = (text: string, opts: { bold?: boolean } = {}) =>
    new Paragraph({
      spacing: { after: 40 },
      indent: dateTab !== null ? { left: dateTab } : undefined,
      children: [new TextRun({ text, color: pal.accent, bold: opts.bold, size: 20, font: fonts.body })],
    });
  const para = (text: string, opts: { color?: string; size?: number } = {}) =>
    new Paragraph({
      spacing: { after: 40 },
      indent: dateTab !== null ? { left: dateTab } : undefined,
      children: [new TextRun({ text, color: opts.color ?? pal.ink, size: opts.size, font: fonts.body })],
    });
  const bullet = (text: string) =>
    new Paragraph({
      numbering: { reference: 'cv-bullets', level: 0 },
      spacing: { after: 20 },
      indent: dateTab !== null ? { left: dateTab + 360, hanging: 260 } : undefined,
      children: [new TextRun({ text, color: pal.ink, font: fonts.body })],
    });

  const sec = cv.labels.sections;
  const fields = cv.labels.fields;

  /** Hauptspalte: Profil, Beruf, Ausbildung — die Abschnitte, die gelesen werden. */
  const mainBlocks = (skills: CVData['skillGroups']): Paragraph[] => {
    const out: Paragraph[] = [];
    if (val2(cv.profile?.text)) { out.push(H1(sec.profile)); out.push(para(val2(cv.profile.text), { color: pal.soft })); }
    const exp = (cv.experience || []).filter(e => !e.hidden);
    if (exp.length) {
      out.push(H1(sec.experience));
      for (const e of exp) {
        const dates = [val2(e.start), val2(e.end)].filter(Boolean).join(' – ');
        if (val2(e.role)) out.push(H2Dated(val2(e.role), dates));
        const m = [val2(e.company), val2(e.location)].filter(Boolean).join('  ·  ');
        if (m) out.push(meta(m, { bold: true }));
        for (const b of e.bullets || []) if (val2(b)) out.push(bullet(val2(b)));
      }
    }
    if ((cv.education || []).length) {
      out.push(H1(sec.education));
      for (const e of cv.education) {
        const dates = [val2(e.start), val2(e.end)].filter(Boolean).join(' – ');
        if (val2(e.degree)) out.push(H2Dated(val2(e.degree), dates));
        const m = [val2(e.institution), val2(e.location)].filter(Boolean).join('  ·  ');
        if (m) out.push(meta(m));
        if (val2(e.notes)) out.push(para(val2(e.notes), { color: pal.soft, size: 19 }));
      }
    }
    for (const g of skills) {
      const items = (g.items || []).map(val2).filter(Boolean);
      if (!items.length) continue;
      out.push(H1(val2(g.label) || 'Skills'));
      out.push(para(items.join(', ')));
    }
    const add = (cv.additionalExperience || []).map(val2).filter(Boolean);
    if (add.length) { out.push(H1(sec.additional)); for (const a of add) out.push(bullet(a)); }
    return out;
  };

  /** Farbfläche: Kontakt, Eckdaten, Sprachen, die ersten Skill-Gruppen. */
  const asideBlocks = (skills: CVData['skillGroups'], withName: boolean, withContact = true): Paragraph[] => {
    const p = cv.personal;
    const out: Paragraph[] = [];
    if (withName) {
      out.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: val2(p.name), bold: true, size: 34, color: pal.ink, font: fonts.heading })] }));
      if (val2(p.title)) out.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: val2(p.title).toUpperCase(), bold: true, color: pal.accent, characterSpacing: 16, size: 17, font: fonts.body })] }));
    }
    if (withContact) {
      const rows: [string, string][] = [
        [fields.email, val2(p.email)], [fields.phone, val2(p.phone)], [fields.address, val2(p.location)],
      ];
      if (val2(p.website)) rows.push([fields.web, val2(p.website)]);
      for (const s of p.socials || []) if (val2(s.value)) rows.push([socialLabel(s), socialDisplay(s)]);
      if (val2(p.linkedin)) rows.push(['LinkedIn', val2(p.linkedin)]);
      out.push(H1Plain(sec.personal));
      for (const [l, v] of rows) {
        if (!v) continue;
        out.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l.toUpperCase(), bold: true, color: pal.accent, size: 15, characterSpacing: 14, font: fonts.body })] }));
        out.push(new Paragraph({ spacing: { after: 90 }, children: multiRuns(v, { color: pal.ink, size: 18, font: fonts.body }) }));
      }
    }
    const details: [string, string][] = ([
      [fields.birthDate, val2(p.birthDate)], [fields.birthPlace, val2(p.birthPlace)],
      [fields.nationality, val2(p.nationality)], [fields.maritalStatus, val2(p.maritalStatus)],
      [fields.driversLicense, val2(p.driversLicense)],
    ] as [string, string][]).filter(r => r[1]);
    if (details.length) {
      out.push(H1Plain(sec.details));
      for (const [l, v] of details) {
        out.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l.toUpperCase(), bold: true, color: pal.accent, size: 15, characterSpacing: 14, font: fonts.body })] }));
        out.push(new Paragraph({ spacing: { after: 90 }, children: multiRuns(v, { color: pal.ink, size: 18, font: fonts.body }) }));
      }
    }
    if ((cv.languages || []).length) {
      out.push(H1Plain(sec.languages));
      for (const l of cv.languages) {
        out.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: val2(l.language), bold: true, color: pal.ink, size: 18, font: fonts.body })] }));
        if (val2(l.level)) out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: val2(l.level), color: pal.soft, size: 17, font: fonts.body })] }));
      }
    }
    for (const g of skills) {
      const items = (g.items || []).map(val2).filter(Boolean);
      if (!items.length) continue;
      out.push(H1Plain(val2(g.label) || 'Skills'));
      for (const it of items) {
        out.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: `· ${it}`, color: pal.ink, size: 18, font: fonts.body })] }));
      }
    }
    return out;
  };

  return { H1, H2, H2Dated, para, bullet, meta, mainBlocks, asideBlocks };
}

/** Build the DOCX document for a CV. */
export function buildDocx(cv: CVData, themeId?: string, variant: DocxVariant = 'design'): Document {
  const sec = cv.labels.sections;
  const fields = cv.labels.fields;
  const p = cv.personal;
  const theme = themeId ? getTheme(themeId) : undefined;
  const accent = theme ? toHex(theme.colors.accent) : '1A1A1A';
  const ink = theme ? toHex(theme.colors.ink, '1A1A1A') : '1A1A1A';
  const soft = theme ? toHex(theme.colors.inkSoft, '5A5A5A') : '5A5A5A';
  const fonts = wordFont(themeId);

  const numbering = {
    config: [{
      reference: 'cv-bullets',
      levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
    }],
  };
  const styles = {
    default: {
      document: { run: { font: fonts.body, size: 21, color: ink } },
      title: { run: { font: fonts.heading, size: 44, bold: true, color: ink }, paragraph: { spacing: { after: 40 } } },
      heading1: { run: { font: fonts.body, size: 19, bold: true, color: accent }, paragraph: { spacing: { before: 240, after: 80 } } },
      heading2: { run: { font: fonts.heading, size: 23, bold: true, color: ink } },
    },
  };
  const docMeta = {
    creator: 'CV-Hub',
    title: val(p.name) ? `${val(p.name)} — CV` : 'CV',
    description: 'Lebenslauf aus CV-Hub',
  };

  const layout = theme?.layout ?? 'single-column';
  const hasAside = variant === 'design'
    && (layout === 'sidebar-left' || layout === 'sidebar-right' || layout === 'header-band');
  const tabular = variant === 'design'
    && (layout === 'single-column' || layout === 'timeline' || layout === 'top-centered');

  // ── Einspaltige Fassung (ATS) ────────────────────────────────────────────
  if (!hasAside && !tabular) {
    const P = makeParts(cv, { ink, soft, accent }, fonts, RIGHT_TAB, null);
    const kids: Paragraph[] = [];
    kids.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 20 }, children: [new TextRun({ text: val(p.name) || 'CV', bold: true })] }));
    if (val(p.title)) kids.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: val(p.title).toUpperCase(), bold: true, color: accent, characterSpacing: 24, size: 19 })] }));
    for (const line of personalLines(p, fields)) kids.push(P.para(line));
    kids.push(...P.mainBlocks(cv.skillGroups || []));
    if ((cv.languages || []).length) {
      kids.push(P.H1(sec.languages));
      for (const l of cv.languages) {
        const t = [val(l.language), val(l.level)].filter(Boolean).join(' — ');
        if (t) kids.push(P.bullet(t));
      }
    }
    return new Document({
      ...docMeta, numbering, styles,
      sections: [{ properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children: kids }],
    });
  }

  // ── Tabellarische Vorlagen: eine Spalte, aber mit Datumsspalte ───────────
  if (tabular) {
    // 30 mm statt der 26 mm der Bildschirmfassung: Calibri setzt „08/2018 –
    // 02/2021" breiter als die Vorlagenschrift, und ein Datum, das in den
    // Titel läuft, ist schlimmer als vier Millimeter mehr Spalte.
    const dateTab = mm(30);
    const P = makeParts(cv, { ink, soft, accent }, fonts, RIGHT_TAB, dateTab);
    const centered = layout === 'top-centered';
    const kids: Paragraph[] = [];
    /* Befund vom 14.09.2026, zweiter Teil: Der tabellarische Zweig hatte nie
     * ein Foto — betroffen waren Wien, Lyon und Antwerpen, also alle
     * zentrierten Vorlagen mit Bewerbungsfoto. Auf dem Bildschirm steht es
     * rechts neben dem Namen; in Word wäre ein umflossenes Bild unnötig
     * zerbrechlich, deshalb steht es als eigene Zeile darüber — bei
     * zentriertem Kopf mittig, sonst rechtsbündig. */
    if (theme?.photo !== 'none' && val(p.photo)) {
      const foto = photoRun(val(p.photo), 26, 26 * 1.25, centered ? AlignmentType.CENTER : AlignmentType.RIGHT);
      if (foto) kids.push(foto);
    }
    kids.push(new Paragraph({
      spacing: { after: 20 }, alignment: centered ? AlignmentType.CENTER : undefined,
      children: [new TextRun({ text: val(p.name) || 'CV', bold: true, size: 44, color: ink, font: fonts.heading })],
    }));
    if (val(p.title)) kids.push(new Paragraph({
      spacing: { after: 80 }, alignment: centered ? AlignmentType.CENTER : undefined,
      children: [new TextRun({ text: val(p.title).toUpperCase(), bold: true, color: accent, characterSpacing: 24, size: 19, font: fonts.body })],
    }));
    for (const line of personalLines(p, fields)) {
      kids.push(new Paragraph({
        spacing: { after: 40 }, alignment: centered ? AlignmentType.CENTER : undefined,
        border: undefined,
        children: [new TextRun({ text: line, color: soft, size: 18, font: fonts.body })],
      }));
    }
    kids.push(new Paragraph({
      spacing: { after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, space: 6, color: accent } },
      children: [],
    }));
    kids.push(...P.mainBlocks(cv.skillGroups || []));
    if ((cv.languages || []).length) {
      kids.push(P.H1(sec.languages));
      for (const l of cv.languages) {
        const t = [val(l.language), val(l.level)].filter(Boolean).join(' — ');
        if (t) kids.push(P.bullet(t));
      }
    }
    return new Document({
      ...docMeta, numbering, styles,
      sections: [{ properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: mm(18), bottom: mm(16), left: mm(20), right: mm(18) } } }, children: kids }],
    });
  }

  // ── Vorlagen mit Farbfläche ─────────────────────────────────────────────
  // Die Seitenränder stehen auf 0; die Abstände kommen aus den Zellrändern.
  // Nur so reicht die Farbfläche bis an die Blattkante — genau das macht diese
  // Vorlagen aus. Nach unten endet sie mit ihrem Inhalt; Word kann eine Fläche
  // nicht über die Restseite ziehen, ohne den Textfluss zu zerschneiden.
  const panelBg = theme ? toHex(theme.colors.panelBg, 'EFEFEF') : 'EFEFEF';
  const panelInk = theme ? toHex(theme.colors.panelInk, '1A1A1A') : '1A1A1A';
  const panelSoft = theme ? toHex(theme.colors.panelInkSoft, '5A5A5A') : '5A5A5A';
  const panelAccent = theme ? toHex(theme.colors.panelAccent, accent) : accent;

  const sideW = mm(theme?.sidebarMm ?? (layout === 'header-band' ? 58 : 62));
  const mainW = PAGE_W - sideW;
  const mainPadL = mm(11);
  const mainPadR = mm(12);
  const Pm = makeParts(cv, { ink, soft, accent }, fonts, mainW - mainPadL - mainPadR, null);
  const band = layout === 'header-band';
  // Im Bandlayout trägt nur der Kopfbalken die Farbfläche; die Nebenspalte
  // darunter steht — wie in der Vorlage — auf Weiß mit feiner Trennlinie.
  const asidePal = band ? { ink, soft, accent } : { ink: panelInk, soft: panelSoft, accent: panelAccent };
  const Pa = makeParts(cv, asidePal, fonts, sideW - mm(18), null);

  // Word liest Tabellen zeilenweise von links: bei linker Seitenspalte steht
  // deren Inhalt im Dokument VOR der Hauptspalte. Deshalb wandert der Name dort
  // in die Spalte — sonst begänne die Datei für jeden Parser mit „PERSÖNLICHES,
  // E-MAIL, …" und der Name käme irgendwann später. Bei rechter Seitenspalte
  // und im Bandlayout führt die Hauptspalte ohnehin.
  const nameInAside = layout === 'sidebar-left';
  const asideSkills = (cv.skillGroups || []).slice(0, 2);
  const mainSkills = (cv.skillGroups || []).slice(2);

  const mainChildren: Paragraph[] = [];
  if (!band && !nameInAside) {
    mainChildren.push(new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: val(p.name) || 'CV', bold: true, size: 44, color: ink, font: fonts.heading })] }));
    if (val(p.title)) mainChildren.push(new Paragraph({
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, space: 8, color: accent } },
      children: [new TextRun({ text: val(p.title).toUpperCase(), bold: true, color: accent, characterSpacing: 24, size: 19, font: fonts.body })],
    }));
  }
  mainChildren.push(...Pm.mainBlocks(mainSkills));

  const asideCell = new TableCell({
    width: { size: sideW, type: WidthType.DXA },
    shading: band ? undefined : { type: ShadingType.CLEAR, color: 'auto', fill: panelBg },
    borders: band
      ? { ...NO_BORDERS, right: { style: BorderStyle.SINGLE, size: 4, color: toHex(theme?.colors.rule ?? '#cccccc', 'CCCCCC') } }
      : undefined,
    margins: { top: mm(14), bottom: mm(16), left: mm(9), right: mm(9) },
    verticalAlign: VerticalAlign.TOP,
    children: [
      ...(theme?.photo !== 'none' && val(p.photo) && !band
        ? [photoRun(val(p.photo), 34, 34 * 1.25)].filter(Boolean) as Paragraph[]
        : []),
      ...Pa.asideBlocks(asideSkills, nameInAside, !band),
    ],
  });
  const mainCell = new TableCell({
    width: { size: mainW, type: WidthType.DXA },
    margins: { top: mm(14), bottom: mm(16), left: mainPadL, right: mainPadR },
    verticalAlign: VerticalAlign.TOP,
    children: mainChildren,
  });

  const body = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: PAGE_W, type: WidthType.DXA },
    borders: NO_BORDERS,
    columnWidths: layout === 'sidebar-right' ? [mainW, sideW] : [sideW, mainW],
    rows: [new TableRow({ children: layout === 'sidebar-right' ? [mainCell, asideCell] : [asideCell, mainCell] })],
  });

  const children: (Table | Paragraph)[] = [];
  if (band) {
    const bandCell = new TableCell({
      width: { size: PAGE_W, type: WidthType.DXA },
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: panelBg },
      margins: { top: mm(13), bottom: mm(13), left: mm(16), right: mm(16) },
      children: [
        ...(theme?.photo !== 'none' && val(p.photo)
          ? [photoRun(val(p.photo), 26, 26 * 1.2)].filter(Boolean) as Paragraph[]
          : []),
        new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: val(p.name) || 'CV', bold: true, size: 40, color: panelInk, font: fonts.heading })] }),
        ...(val(p.title) ? [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: val(p.title).toUpperCase(), bold: true, color: panelAccent, characterSpacing: 20, size: 18, font: fonts.body })] })] : []),
        ...personalLines(p, fields).map(line => new Paragraph({
          spacing: { after: 20 }, children: [new TextRun({ text: line, color: panelSoft, size: 17, font: fonts.body })],
        })),
      ],
    });
    children.push(new Table({
      layout: TableLayoutType.FIXED,
      width: { size: PAGE_W, type: WidthType.DXA },
      borders: NO_BORDERS,
      columnWidths: [PAGE_W],
      rows: [new TableRow({ children: [bandCell] })],
    }));
  }
  children.push(body);

  return new Document({
    ...docMeta, numbering, styles,
    sections: [{
      properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children,
    }],
  });
}

/**
 * Macht aus jedem Foto ein Rasterbild als Data-URL — das Einzige, was Word
 * einbetten kann.
 *
 * Befund vom 14.09.2026: Im Word-Export fehlte das Bild. `photoRun` nimmt nur
 * `data:image/(png|jpeg|gif|bmp);base64` und lieferte sonst stillschweigend
 * `null`. Gespeicherte Fotos liegen aber als **Adresse** vor
 * (`https://…/pdfapi/api/photo/…`), nicht als Data-URL — und das
 * Platzhalterbild der Testdaten ist ein SVG, das Word ebenfalls nicht kennt.
 * Beide Fälle fielen unter denselben Tisch, ohne dass irgendwo etwas stand.
 *
 * Geholt und umgewandelt wird im Browser über die Leinwand; scheitert es
 * (fremde Domain ohne CORS, Bild weg), bleibt es beim Export ohne Foto — dann
 * aber nachvollziehbar, weil der Aufrufer es erfährt.
 */
export async function photoAsRaster(src: string): Promise<string | null> {
  const v = (src || '').trim();
  if (!v) return null;
  if (/^data:image\/(png|jpe?g|gif|bmp);base64,/i.test(v)) return v;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Bild nicht ladbar'));
    });
    img.src = v;
    await loaded;
    // Grenze nach oben: ein 4000-px-Foto bläht die Word-Datei ohne jeden
    // sichtbaren Gewinn — 35 × 45 mm bei 300 dpi sind rund 414 × 532 px.
    const maxW = 900;
    const scale = Math.min(1, maxW / (img.naturalWidth || maxW));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round((img.naturalWidth || maxW) * scale));
    c.height = Math.max(1, Math.round((img.naturalHeight || maxW) * scale));
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    // Weiß hinterlegen: PNG mit Transparenz wird in Word sonst schwarz.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Liefert den Lebenslauf mit einem Foto, das Word einbetten kann. */
export async function withRasterPhoto(cv: CVData): Promise<CVData> {
  const src = val(cv.personal?.photo);
  if (!src) return cv;
  const raster = await photoAsRaster(src);
  if (!raster) return { ...cv, personal: { ...cv.personal, photo: '' } };
  if (raster === src) return cv;
  return { ...cv, personal: { ...cv.personal, photo: raster } };
}

/** Build + trigger a browser download. */
export async function exportDocx(cv: CVData, themeId?: string, variant: DocxVariant = 'design'): Promise<void> {
  // Foto zuerst in ein Format bringen, das Word kennt — sonst fehlt es
  // stillschweigend (siehe `photoAsRaster`).
  const doc = buildDocx(variant === 'design' ? await withRasterPhoto(cv) : cv, themeId, variant);
  const blob = await Packer.toBlob(doc);
  const name = (val(cv.personal?.name) || 'lebenslauf').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lebenslauf';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}${variant === 'ats' ? '-ats' : ''}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
