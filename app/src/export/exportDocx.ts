// DOCX-Export in zwei Fassungen — beide laufen vollständig im Browser und
// öffnen in Word wie in LibreOffice.
//
//   'design'  Die gewählte Vorlage, so nah wie Word es zulässt: randabfallende
//             Farbfläche der Seitenspalte, Akzentfarben, Datumsspalte,
//             Kopfbalken.
//
//             Bis zum 17.09.2026 stand hier, eine Farbfläche über die ganze
//             Blatthöhe sei in Word nicht zu haben — sie endete dort, wo ihr
//             Inhalt endete, und Seite 2 zeigte einen halbhohen Farbklotz mit
//             ausgefranster Unterkante. Das stimmte nur für den Weg, den wir
//             genommen hatten (Hintergrund einer Tabellenzelle). Word kennt
//             sehr wohl frei auf der Seite verankerte Objekte: ein
//             einfarbiges Bild in der Kopfzeile, an der Seite ausgerichtet,
//             hinter dem Text — das wiederholt sich von selbst auf jedem
//             Blatt und reicht bis an alle vier Kanten. Siehe `sideBandHeader`.
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
  WidthType, ShadingType, VerticalAlign, ImageRun, LineRuleType,
  Header, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
} from 'docx';
import type { CVData, PersonalInfo, SectionKey } from '../data/types';
import { getTheme } from '../templates/theme';
import type { HeadingStyle, ResumeTheme } from '../templates/theme';
import { socialLabel, socialDisplay } from '../templates/ResumeRenderer';
import { getPageFormat } from '../data/pageFormats';
import type { ExportRenderConfig } from './exportHtml';
import { exportFilename } from './filename';
import { saveBlob } from './saveFile';

const val = (s?: string | null) => (s || '').trim();

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
function wordFont(t?: ResumeTheme): { body: string; heading: string } {
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

/** Contact + personal detail lines, ATS-friendly (label: value, plain text).
 *
 * `hidden` ist nicht kosmetisch: Wer den Abschnitt „Eckdaten" ausblendet,
 * nimmt Geburtsdatum, Geburtsort, Staatsangehörigkeit und Familienstand
 * bewusst aus der Bewerbung — genau die Felder, an denen aussortiert wird,
 * bevor jemand die Qualifikation liest. Bis zum 19.09.2026 hat der
 * Word-Export diese Einstellung ignoriert und die Zeile trotzdem gesetzt:
 * Vorschau ohne Eckdaten, Word-Datei mit. Wer die Datei verschickt hat, hat
 * preisgegeben, was er ausdrücklich zurückhalten wollte. */
function personalLines(p: PersonalInfo, fields: CVData['labels']['fields'], hidden: Set<SectionKey>): string[] {
  const contact = [val(p.email), val(p.phone), oneLine(p.location), val(p.website)].filter(Boolean);
  const socials = (p.socials || []).map(s => val(s.value)).filter(Boolean);
  if (val(p.linkedin)) socials.push(val(p.linkedin));
  const line1 = [...contact, ...socials].join('  ·  ');
  const detail = hidden.has('details') ? '' : [
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

/**
 * Eine einfarbige Fläche als PNG — der Baustein für die randabfallende
 * Seitenspalte.
 *
 * Word kennt kein Rechteck, das man auf ein Blatt legt; es kennt aber ein
 * **Bild**, das man frei auf der Seite verankert. Ein Bild aus einer einzigen
 * Farbe ist dasselbe wie ein Rechteck, nur dass Word es versteht. Gezeichnet
 * wird auf der Leinwand, weil der Export ohnehin im Browser läuft und der
 * Rest der Datei (Farbumrechnung, Foto) dieselbe benutzt.
 *
 * Bewusst 64×288 statt 1×1: manche Betrachter glätten beim Hochskalieren, und
 * ein einzelner Bildpunkt, der auf 297 mm gezogen wird, kann an den Kanten
 * ausfransen. Eine Vollton-PNG dieser Größe wiegt ein paar hundert Byte.
 */
function solidPng(hex: string): Uint8Array | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 288;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = `#${hex}`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/png').split(',')[1];
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/** mm → Twips (1/1440 Zoll). */
const mm = (v: number) => Math.round((v / 25.4) * 1440);

/* Blattmaße standen hier als feste A4-Konstanten. Sie leben jetzt in
 * `buildDocx`, abgeleitet aus dem gewählten Format (data/pageFormats.ts). */

/**
 * Die Seitenspalte als randabfallende Farbfläche — auf jedem Blatt.
 *
 * Der Träger ist die Kopfzeile, nicht der Textkörper: Was in der Kopfzeile
 * steht, setzt Word auf jede Seite, ohne dass wir wissen müssen, wie viele es
 * werden. Das Bild selbst fließt nicht mit (`floating`), ist an der **Seite**
 * ausgerichtet statt am Satzspiegel und liegt hinter dem Text — es verschiebt
 * also nichts und verdeckt nichts.
 *
 * `x` ist der linke Rand der Fläche in Twips: 0 bei linker Seitenspalte,
 * Blattbreite minus Spaltenbreite bei rechter.
 */
function sideBandHeader(fillHex: string, x: number, widthTw: number, heightTw: number): Header | null {
  const data = solidPng(fillHex);
  if (!data) return null;
  const emu = (tw: number) => Math.round(tw * 635); // 1 Twip = 635 EMU
  const px = (tw: number) => Math.round(tw / 15); // 1440 Twip = 96 Bildpunkte
  return new Header({
    children: [new Paragraph({
      /* Die Kopfzeile trägt nur das Bild. Ein leerer Absatz bekäme trotzdem
       * die volle Standardzeilenhöhe und schöbe den Text nach unten — ein
       * Kleinstlauf mit fester Zeilenhöhe hält sie flach. */
      spacing: { before: 0, after: 0, line: 14, lineRule: LineRuleType.EXACT },
      children: [new ImageRun({
        data,
        type: 'png',
        transformation: { width: px(widthTw), height: px(heightTw) },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: emu(x) },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          wrap: { type: TextWrappingType.NONE },
          behindDocument: true,
          allowOverlap: true,
        },
      })],
    })],
  });
}

/** Welche Fassung gebaut wird — siehe Kopfkommentar. */
export type DocxVariant = 'design' | 'ats';

/* Welche Abschnitte die Hauptspalte überhaupt tragen kann.
 *
 * Zwei Sätze, weil zwei Bauformen: Vorlagen mit Nebenspalte geben Sprachen
 * (und die Eckdaten) dorthin ab, einspaltige tragen die Sprachen im Fluss.
 * Das entspricht `MAIN_ORDER_SIDEBAR` / `DEFAULT_MAIN_ORDER` im Renderer
 * (templates/ResumeRenderer.tsx). `details` fehlt in beiden, weil die Eckdaten
 * in Word im Kopfbereich bzw. in der Nebenspalte stehen, nicht im Textfluss. */
const MAIN_ORDER_ASIDE: SectionKey[] = ['profile', 'experience', 'education', 'skills', 'additional'];
const MAIN_ORDER_FLOW: SectionKey[] = ['profile', 'experience', 'education', 'skills', 'languages', 'additional'];

/**
 * Die vom Nutzer gewählte Abschnittsreihenfolge auf das anwenden, was diese
 * Bauform tragen kann.
 *
 * Wortgleich zur Rechnung im Renderer (ResumeRenderer.tsx, `mainOrder`) — und
 * das ist der Punkt: Zwei Reihenfolgen-Algorithmen nebeneinander driften
 * auseinander, und dann steht in Word etwas anderes als in der Vorschau.
 * Abschnitte, die der Nutzer nicht sortiert hat, rutschen an die Stelle, an
 * der sie in der Vorlagenreihenfolge stehen — vor den nächsten bekannten
 * Nachbarn, statt hinten angehängt zu werden.
 */
function orderedSections(defaultOrder: SectionKey[], sectionOrder?: SectionKey[]): SectionKey[] {
  if (!sectionOrder || !sectionOrder.length) return defaultOrder;
  const ownable = new Set<SectionKey>(defaultOrder);
  const userKeys = sectionOrder.filter(k => ownable.has(k));
  const userSet = new Set<SectionKey>(userKeys);
  const out: SectionKey[] = [...userKeys];
  for (let i = 0; i < defaultOrder.length; i++) {
    const k = defaultOrder[i];
    if (userSet.has(k)) continue;
    let insertAt = out.length;
    for (let j = i + 1; j < defaultOrder.length; j++) {
      const idx = out.indexOf(defaultOrder[j]);
      if (idx >= 0) { insertAt = idx; break; }
    }
    out.splice(insertAt, 0, k);
    userSet.add(k);
  }
  return out;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const NO_BORDERS = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};

/** Überschriftsform der Vorlage — dieselben acht Formen wie in der Vorschau. */
type HeadStyle = HeadingStyle;

/** Farbsatz für einen Bereich des Dokuments (Hauptspalte oder Farbfläche). */
interface Pal { ink: string; soft: string; accent: string; accentInk?: string; }

/**
 * Bausteine des Lebenslaufs als Word-Absätze.
 *
 * Bewusst eine Fabrik statt fester Absätze: dieselben Inhalte werden einmal in
 * der Hauptspalte (dunkle Schrift auf Weiß) und einmal in der Farbfläche
 * (helle Schrift auf Vollton) gebraucht. Die Struktur — Überschrift, Eintrag,
 * Aufzählung — bleibt in beiden Fällen dieselbe, damit ein Parser dieselben
 * Abschnitte findet, egal wie die Vorlage aussieht.
 */
function makeParts(
  cv: CVData,
  pal: Pal,
  fonts: { body: string; heading: string },
  rightTab: number,
  dateTab: number | null,
  headStyle: HeadStyle = 'caps-tracked',
  bulletChar = '\u25AA',
  /** Abschnitte, die der Nutzer ausgeblendet hat. Siehe `personalLines`:
   *  Das ist eine Datenschutz-Einstellung, keine Geschmacksfrage. */
  hidden: Set<SectionKey> = new Set(),
) {
  const val2 = val;
  /* Sektionsüberschriften.
   *
   * Bis zum 16.09.2026 trug jede Vorlage in Word dieselbe Überschrift:
   * gesperrte Versalien in der Akzentfarbe mit einer Linie über die ganze
   * Spaltenbreite. Im Browser hat jede Vorlage ihre eigene — Terrakotta einen
   * Serifentitel mit kurzem Farbbalken darunter, Lissabon einen Balken davor,
   * die Register-Vorlagen einen Strich darüber. Genau das meinte Till mit den
   * fehlenden Farbleisten: nicht die Farbe fehlte, die Form fehlte.
   *
   * Word kennt keine freien Rechtecke, aber es kennt Absatzrahmen. Damit
   * lässt sich jede der acht Formen nachbauen:
   *   — kurzer Balken darunter → leerer Absatz mit Unterlinie und rechtem
   *     Einzug, der ihn auf Balkenbreite kürzt
   *   — Balken davor          → linker Rahmen am Überschriftsabsatz
   *   — Strich darüber        → oberer Rahmen
   *   — Farbfläche            → Hinterlegung am Textlauf selbst
   * Der Text bleibt dabei ein gewöhnlicher Absatz mit Überschriftsformat:
   * Für einen Parser ändert sich nichts. */
  const HEAD_SIZES: Record<HeadStyle, [number, number]> = {
    /* [Hauptspalte, Nebenspalte] in halben Punkt. */
    'serif': [26, 21], 'display': [34, 23], 'rule-over': [24, 19],
    'block': [18, 17], 'bar': [19, 17], 'caps-plain': [19, 17],
    'caps-rule': [19, 17], 'caps-tracked': [19, 17],
  };
  const serifish = (st: HeadStyle) => st === 'serif' || st === 'display';

  /** Leerer Absatz, dessen Unterlinie den Farbbalken bildet. `width` in Twips. */
  const barUnder = (width: number, thickness: number, color: string) =>
    new Paragraph({
      spacing: { before: 40, after: 70, line: 20, lineRule: LineRuleType.EXACT },
      indent: { right: Math.max(0, rightTab - width) },
      border: { bottom: { style: BorderStyle.SINGLE, size: thickness, space: 0, color } },
      /* Ein leerer Absatz ist für Word und LibreOffice ein Sonderfall: ohne
       * Textlauf bekommt er die volle Standardzeilenhöhe zurück. Ein Lauf mit
       * Kleinstgrad hält den Balken flach. */
      children: [new TextRun({ text: '', size: 2, font: fonts.body })],
    });

  const H1For = (text: string, aside: boolean): Paragraph[] => {
    const st = headStyle;
    const size = HEAD_SIZES[st][aside ? 1 : 0];
    const label = serifish(st) ? text : text.toUpperCase();
    const run = new TextRun({
      text: label,
      bold: true,
      color: st === 'block' ? (pal.accentInk || 'FFFFFF') : pal.ink,
      characterSpacing: serifish(st) ? 0 : 16,
      font: serifish(st) ? fonts.heading : fonts.body,
      size,
      ...(st === 'block' ? { shading: { type: ShadingType.CLEAR, color: 'auto', fill: pal.accent } } : {}),
    });
    /* Überschriftsformat NUR in der Hauptspalte.
     *
     * Words „Überschrift 1" bringt „Absätze nicht trennen" mit. In der
     * Nebenspalte steht der ganze Lebenslauf in EINER Tabellenzeile; sobald
     * dort jede Überschrift am nächsten Absatz klebt, weigert sich
     * LibreOffice, die Zeile über zwei Seiten zu brechen — und schiebt die
     * komplette Spalte auf Seite 2, während Seite 1 leer bleibt. Genau das
     * war der Befund vom 16.09. Die Gliederung geht nicht verloren: die
     * Hauptspalte trägt die Überschriftsebenen, und ein Parser liest die
     * Nebenspalte ohnehin als Block. */
    const base = {
      ...(aside ? {} : { heading: HeadingLevel.HEADING_1, keepNext: true }),
      spacing: { before: aside ? 220 : 260, after: st === 'serif' ? 0 : (aside ? 70 : 90) },
      children: [run],
    };
    switch (st) {
      case 'serif':
        return [new Paragraph(base), barUnder(aside ? 320 : 460, 12, pal.accent)];
      case 'display':
        return [new Paragraph({ ...base, border: { top: { style: BorderStyle.SINGLE, size: 20, space: 8, color: pal.ink } } })];
      case 'rule-over':
        return [new Paragraph({ ...base, border: { top: { style: BorderStyle.SINGLE, size: 12, space: 6, color: pal.accent } } })];
      case 'caps-rule':
        return [new Paragraph({ ...base, border: { bottom: { style: BorderStyle.SINGLE, size: 4, space: 4, color: pal.accent } } })];
      case 'block':
        return [new Paragraph(base)];
      case 'caps-plain':
        return [new Paragraph(base)];
      /* Balken vor der Zeile: waagerecht im Browser, in Word ein senkrechter
       * Rahmen links. Dieselbe Geste — eine Farbmarke vor der Überschrift —
       * mit den Mitteln, die ein Absatz hat. */
      case 'bar':
      case 'caps-tracked':
      default:
        return [new Paragraph({ ...base, indent: { left: 110 }, border: { left: { style: BorderStyle.SINGLE, size: 18, space: 6, color: pal.accent } } })];
    }
  };

  const H1 = (text: string) => H1For(text, false);
  /** Dieselbe Form in der schmalen Spalte, nur kleiner gesetzt. */
  const H1Plain = (text: string) => H1For(text, true);
  const H2 = (text: string) =>
    new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 160, after: 20 }, children: [new TextRun({ text, bold: true, color: pal.ink, font: fonts.heading })] });

  /** Eintragskopf. Zwei Formen, je nach Vorlage:
   *  — Datum rechtsbündig am Textrand (Sidebar- und Bandlayouts)
   *  — Datum in einer linken Spalte (tabellarische, DIN-nahe Vorlagen)
   *  Beides über Tabstopps, nicht über verschachtelte Tabellen: ein Tabstopp
   *  ist für jeden Parser schlicht Leerraum, eine Tabelle nicht. */
  const H2Dated = (text: string, dates0: string) => {
    if (!dates0) return H2(text);
    /* Die Datumsangabe darf nicht umbrechen.
     *
     * Sie hängt an einem rechten Tabstopp. Passt sie hinter einen langen Titel
     * nicht mehr in die Zeile, schiebt Word sie weiter — und bricht sie dann
     * mitten entzwei: „2010 –" in der einen Zeile, „2014" in der nächsten.
     * Mit geschützten Leerzeichen rutscht sie als Ganzes in die Folgezeile,
     * rechtsbündig, und bleibt lesbar. */
    const dates = dates0.replace(/ /g, ' ');
    if (dateTab !== null) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        keepNext: true,
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
      keepNext: true,
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
      keepNext: true,
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

  /** Hauptspalte: Profil, Beruf, Ausbildung — die Abschnitte, die gelesen werden.
   *
   * `order` kommt von außen, statt hier fest zu stehen: Die Reihenfolge der
   * Abschnitte ist eine Einstellung des Nutzers (Profil nach vorn, Ausbildung
   * vor den Beruf — je nachdem, worauf es in der Bewerbung ankommt). Bis zum
   * 19.09.2026 war sie in Word fest verdrahtet, und die Word-Datei zeigte eine
   * andere Gliederung als die Vorschau daneben. */
  const mainBlocks = (skills: CVData['skillGroups'], order: SectionKey[]): Paragraph[] => {
    const out: Paragraph[] = [];
    for (const key of order) {
      /* Ausgeblendetes bleibt ausgeblendet — auch hier. Siehe `personalLines`. */
      if (hidden.has(key)) continue;

      if (key === 'profile') {
        if (val2(cv.profile?.text)) { out.push(...H1(sec.profile)); out.push(para(val2(cv.profile.text), { color: pal.soft })); }
        continue;
      }

      if (key === 'experience') {
        const exp = (cv.experience || []).filter(e => !e.hidden);
        if (!exp.length) continue;
        out.push(...H1(sec.experience));
        for (const e of exp) {
          const dates = [val2(e.start), val2(e.end)].filter(Boolean).join(' – ');
          if (val2(e.role)) out.push(H2Dated(val2(e.role), dates));
          const m = [val2(e.company), val2(e.location)].filter(Boolean).join('  ·  ');
          if (m) out.push(meta(m, { bold: true }));
          for (const b of e.bullets || []) if (val2(b)) out.push(bullet(val2(b)));
        }
        continue;
      }

      if (key === 'education') {
        if (!(cv.education || []).length) continue;
        out.push(...H1(sec.education));
        for (const e of cv.education) {
          const dates = [val2(e.start), val2(e.end)].filter(Boolean).join(' – ');
          if (val2(e.degree)) out.push(H2Dated(val2(e.degree), dates));
          const m = [val2(e.institution), val2(e.location)].filter(Boolean).join('  ·  ');
          if (m) out.push(meta(m));
          if (val2(e.notes)) out.push(para(val2(e.notes), { color: pal.soft, size: 19 }));
        }
        continue;
      }

      if (key === 'skills') {
        /* Skill-Gruppen als Liste, nicht als Komma-Wurst.
         *
         * Hier stand `items.join(', ')`: Aus fünf Stichpunkten wurde ein
         * Fließsatz — „HubSpot (CRM, CMS, Formulare, Reporting), Salesforce
         * (als Anwender), GA4, Umami, …". Bei Einträgen, die selbst Kommas
         * enthalten, ist nicht mehr zu erkennen, wo einer aufhört. In der
         * Vorschau steht dort eine Aufzählung; in Word jetzt auch, mit
         * demselben Zeichen wie die übrigen Listen der Vorlage. Zweispaltig
         * wie in der Vorschau wäre eine verschachtelte Tabelle — die kostet
         * mehr an Maschinenlesbarkeit, als die gesparten Zeilen wert sind. */
        for (const g of skills) {
          const items = (g.items || []).map(val2).filter(Boolean);
          if (!items.length) continue;
          out.push(...H1(val2(g.label) || 'Skills'));
          for (const it of items) out.push(bullet(it));
        }
        continue;
      }

      if (key === 'languages') {
        /* Sprachen stehen nur dort im Fluss, wo die Vorlage keine Nebenspalte
         * hat — sonst sitzen sie dort (siehe `asideBlocks`), und die
         * Reihenfolge der Hauptspalte kennt sie gar nicht. */
        if (!(cv.languages || []).length) continue;
        out.push(...H1(sec.languages));
        for (const l of cv.languages) {
          const t = [val2(l.language), val2(l.level)].filter(Boolean).join(' — ');
          if (t) out.push(bullet(t));
        }
        continue;
      }

      if (key === 'additional') {
        const add = (cv.additionalExperience || []).map(val2).filter(Boolean);
        if (add.length) { out.push(...H1(sec.additional)); for (const a of add) out.push(bullet(a)); }
        continue;
      }
      /* 'details' steht in dieser Fassung im Kopfbereich (siehe
       * `personalLines`), nicht im Textfluss — deshalb hier kein Zweig. */
    }
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
      out.push(...H1Plain(sec.personal));
      for (const [l, v] of rows) {
        if (!v) continue;
        out.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l.toUpperCase(), bold: true, color: pal.accent, size: 15, characterSpacing: 14, font: fonts.body })] }));
        out.push(new Paragraph({ spacing: { after: 90 }, children: multiRuns(v, { color: pal.ink, size: 18, font: fonts.body }) }));
      }
    }
    /* Eckdaten in der Nebenspalte: dieselbe Einstellung, derselbe Grund wie in
     * `personalLines` — ausgeblendet heißt ausgeblendet, auch in Word. Ohne
     * diese Zeile stand Geburtsdatum und Staatsangehörigkeit in der
     * Word-Datei, obwohl die Vorschau sie nicht zeigte. */
    const details: [string, string][] = hidden.has('details') ? [] : ([
      [fields.birthDate, val2(p.birthDate)], [fields.birthPlace, val2(p.birthPlace)],
      [fields.nationality, val2(p.nationality)], [fields.maritalStatus, val2(p.maritalStatus)],
      [fields.driversLicense, val2(p.driversLicense)],
    ] as [string, string][]).filter(r => r[1]);
    if (details.length) {
      out.push(...H1Plain(sec.details));
      for (const [l, v] of details) {
        out.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: l.toUpperCase(), bold: true, color: pal.accent, size: 15, characterSpacing: 14, font: fonts.body })] }));
        out.push(new Paragraph({ spacing: { after: 90 }, children: multiRuns(v, { color: pal.ink, size: 18, font: fonts.body }) }));
      }
    }
    if (!hidden.has('languages') && (cv.languages || []).length) {
      out.push(...H1Plain(sec.languages));
      for (const l of cv.languages) {
        /* Die Punkteskala steht in der Vorschau neben der Sprache und fehlte
         * in Word ganz. Sie ist dort kein Bild, sondern Schrift: gefüllte und
         * leere Kreise in der Akzentfarbe. Die geschriebene Stufe („C1")
         * bleibt darunter stehen — die Punkte ersetzen sie nicht, sie zeigen
         * sie nur auf einen Blick. */
        const dots = Math.max(0, Math.min(5, Math.round(l.dots ?? 0)));
        out.push(new Paragraph({
          spacing: { after: 0 },
          children: [
            new TextRun({ text: val2(l.language), bold: true, color: pal.ink, size: 18, font: fonts.body }),
            ...(dots ? [
              new TextRun({ text: `  ${'\u25CF'.repeat(dots)}`, color: pal.accent, size: 14, font: fonts.body }),
              ...(dots < 5 ? [new TextRun({ text: '\u25CB'.repeat(5 - dots), color: pal.soft, size: 14, font: fonts.body })] : []),
            ] : []),
          ],
        }));
        if (val2(l.level)) out.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: val2(l.level), color: pal.soft, size: 17, font: fonts.body })] }));
      }
    }
    for (const g of hidden.has('skills') ? [] : skills) {
      const items = (g.items || []).map(val2).filter(Boolean);
      if (!items.length) continue;
      out.push(...H1Plain(val2(g.label) || 'Skills'));
      for (const it of items) {
        /* Nicht über die Word-Nummerierung: die traegt die Akzentfarbe der
         * Hauptspalte, und die ist auf der Farbflaeche oft dieselbe wie der
         * Untergrund — bei Bordeaux waere das Zeichen weinrot auf weinrot.
         * Also ein gesetztes Zeichen in der Farbe DIESER Spalte.
         *
         * Der haengende Einzug ist der eigentliche Punkt: vorher stand das
         * Zeichen im Text („· Wissensraeume und Dokumentation"), und die
         * zweite Zeile ruckte unter das Zeichen statt unter den Text. */
        out.push(new Paragraph({
          spacing: { after: 30 },
          indent: { left: 170, hanging: 170 },
          children: [
            new TextRun({ text: `${bulletChar}\u2002`, color: pal.accent, size: 16, font: fonts.body }),
            new TextRun({ text: it, color: pal.ink, size: 18, font: fonts.body }),
          ],
        }));
      }
    }
    return out;
  };

  return { H1, H2, H2Dated, para, bullet, meta, mainBlocks, asideBlocks };
}

/**
 * Build the DOCX document for a CV.
 *
 * `cfg` ist dieselbe Konfiguration, aus der HTML und PDF gebaut werden
 * (`ExportRenderConfig`, siehe export/exportHtml.ts). Bis zum 19.09.2026 bekam
 * diese Funktion nur die Vorlagen-Kennung — und damit wich die Word-Datei in
 * vier Punkten von dem ab, was der Nutzer in der Vorschau sah: ausgeblendete
 * Abschnitte standen doch darin, die Abschnittsreihenfolge war fest
 * verdrahtet, Akzent- und Papierfarbe fielen auf die Vorlagenwerte zurück,
 * und gedruckt wurde immer auf A4. Ein Parameter für alles vier, damit der
 * nächste Regler nicht wieder vergessen wird.
 */
export function buildDocx(cv: CVData, cfg: ExportRenderConfig, variant: DocxVariant = 'design'): Document {
  const fields = cv.labels.fields;
  const p = cv.personal;
  /* Akzent- und Papierfarbe gehören in die Vorlage hinein, nicht daneben.
   * Für HTML und PDF ist das längst so (exportHtml.ts:27–32); ohne die beiden
   * Kennungen druckte Word in der Farbe der Vorlage statt in der gewählten. */
  const theme = cfg.themeId ? getTheme(cfg.themeId, cfg.accentId, cfg.paperId) : undefined;
  /* Ausgeblendete Abschnitte — die Einstellung wiegt schwerer als sie aussieht,
   * siehe `personalLines`. Gilt für BEIDE Fassungen, auch die ATS-Fassung. */
  const hidden = new Set<SectionKey>(cfg.hiddenSections ?? []);
  /* Blattmaß aus der Einstellung, nicht aus einer Konstante: Wer US Letter
   * wählt, bekam PDF und HTML in Letter und die Word-Datei in A4. */
  const fmt = getPageFormat(cfg.pageFormat);
  const PAGE_W = mm(fmt.widthMm);
  const PAGE_H = mm(fmt.heightMm);
  const accent = theme ? toHex(theme.colors.accent) : '1A1A1A';
  const ink = theme ? toHex(theme.colors.ink, '1A1A1A') : '1A1A1A';
  const soft = theme ? toHex(theme.colors.inkSoft, '5A5A5A') : '5A5A5A';
  const accentInk = theme ? toHex(theme.colors.accentInk, 'FFFFFF') : 'FFFFFF';
  /* Überschriftsform der Vorlage. Die ATS-Fassung bleibt bewusst bei der
   * schlichtesten Form: dort zählt Lesbarkeit für Maschinen, nicht Haltung. */
  const headStyle: HeadStyle = variant === 'ats' ? 'caps-plain' : (theme?.heading ?? 'caps-tracked');
  const fonts = wordFont(theme);

  /* Aufzählungszeichen wie in der Vorschau: die Vorlagen setzen Strich, Punkt,
   * Quadrat oder Pfeil — in Word stand überall derselbe schwarze Punkt. Die
   * ATS-Fassung behält ihn bewusst: dort zählt, dass jeder Parser die Zeile
   * als Listenpunkt erkennt, nicht die Handschrift der Vorlage. */
  const BULLET_CHARS: Record<string, string> = {
    dash: '–', dot: '•', chevron: '•', square: '▪', arrow: '→',
  };
  const bulletChar = variant === 'ats' ? '•' : (BULLET_CHARS[theme?.bullet ?? 'dot'] ?? '•');
  const bulletColor = variant === 'ats' ? undefined : accent;
  const numbering = {
    config: [{
      reference: 'cv-bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: bulletChar, alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 260 } }, ...(bulletColor ? { run: { color: bulletColor } } : {}) },
      }],
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
  /* Dokumenteigenschaften: der Mensch, nicht das Werkzeug.
   *
   * Vorher standen hier Name und Zweck des Programms. Das ist ein Stempel, den
   * jeder Empfänger in den Eigenschaften der Datei sieht — und niemand hat ihn
   * verlangt. Autor ist, wer den Lebenslauf schreibt. */
  const docMeta = {
    creator: val(p.name) || '',
    lastModifiedBy: val(p.name) || '',
    title: val(p.name) ? `${val(p.name)} — ${val(p.title) || 'CV'}` : 'CV',
    description: '',
  };

  const layout = theme?.layout ?? 'single-column';
  const hasAside = variant === 'design'
    && (layout === 'sidebar-left' || layout === 'sidebar-right' || layout === 'header-band');
  const tabular = variant === 'design'
    && (layout === 'single-column' || layout === 'timeline' || layout === 'top-centered');

  // ── Einspaltige Fassung (ATS) ────────────────────────────────────────────
  if (!hasAside && !tabular) {
    /* Rechte Textkante = Blattbreite minus der beiden 0.5"-Ränder unten.
     * Vorher stand hier eine feste Zahl für A4; auf Letter oder A5 hing die
     * Datumsspalte damit neben dem Blatt. */
    const rightTab = PAGE_W - 720 - 720;
    const P = makeParts(cv, { ink, soft, accent, accentInk }, fonts, rightTab, null, headStyle, bulletChar, hidden);
    const kids: Paragraph[] = [];
    kids.push(new Paragraph({ heading: HeadingLevel.TITLE, spacing: { after: 20 }, children: [new TextRun({ text: val(p.name) || 'CV', bold: true })] }));
    if (val(p.title)) kids.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: val(p.title).toUpperCase(), bold: true, color: accent, characterSpacing: 24, size: 19 })] }));
    for (const line of personalLines(p, fields, hidden)) kids.push(P.para(line));
    /* Auch die ATS-Fassung bleibt sonst, wie sie ist — einspaltig, ohne
     * Tabelle, ohne Kopfzeile. Nur Ausgeblendetes und die Reihenfolge folgen
     * dem, was der Nutzer eingestellt hat. */
    kids.push(...P.mainBlocks(cv.skillGroups || [], orderedSections(MAIN_ORDER_FLOW, cfg.sectionOrder)));
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
    // Rechte Textkante aus dem Blattmaß und den Rändern dieser Bauform
    // (unten: links 20 mm, rechts 18 mm) — nicht aus einer A4-Konstanten.
    const rightTab = PAGE_W - mm(20) - mm(18);
    const P = makeParts(cv, { ink, soft, accent, accentInk }, fonts, rightTab, dateTab, headStyle, bulletChar, hidden);
    const centered = layout === 'top-centered';
    const kids: Paragraph[] = [];
    /* Befund vom 14.09.2026, zweiter Teil: Der tabellarische Zweig hatte nie
     * ein Foto — betroffen waren Wien, Lyon und Antwerpen, also alle
     * zentrierten Vorlagen mit Bewerbungsfoto. Auf dem Bildschirm steht es
     * rechts neben dem Namen; in Word wäre ein umflossenes Bild unnötig
     * zerbrechlich, deshalb steht es als eigene Zeile darüber — bei
     * zentriertem Kopf mittig, sonst rechtsbündig. */
    if (theme?.photo !== 'none' && val(p.photo)) {
      const foto = photoRun(val(p.photo), 26, theme?.photo === 'circle' ? 26 : 26 * 1.25, centered ? AlignmentType.CENTER : AlignmentType.RIGHT);
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
    for (const line of personalLines(p, fields, hidden)) {
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
    kids.push(...P.mainBlocks(cv.skillGroups || [], orderedSections(MAIN_ORDER_FLOW, cfg.sectionOrder)));
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
  const Pm = makeParts(cv, { ink, soft, accent, accentInk }, fonts, mainW - mainPadL - mainPadR, null, headStyle, bulletChar, hidden);
  const band = layout === 'header-band';
  /* Seitenspalte ohne Farbfläche.
   *
   * Sechs Vorlagen — Rotterdam, Lille, Antwerpen und Nachbarn — setzen
   * `panelFill: false`: Die Spalte ist dort kein Farbfeld, sondern nur eine
   * Spalte, getrennt durch eine Haarlinie. Der Export hat das nie gelesen und
   * die Zelle trotzdem mit `panelBg` hinterlegt; dass nichts auffiel, lag
   * allein daran, dass `panelBg` dieser Vorlagen weiß ist. Wer die
   * Papierfarbe wechselt, hätte den Balken gesehen, den die Vorlage gerade
   * nicht haben will. Jetzt steht es da, wo es hingehört. */
  const plainPanel = !band && theme?.panelFill === false;
  // Im Bandlayout trägt nur der Kopfbalken die Farbfläche; die Nebenspalte
  // darunter steht — wie in der Vorlage — auf Weiß mit feiner Trennlinie.
  const asidePal = band || plainPanel
    ? { ink, soft, accent, accentInk }
    : { ink: panelInk, soft: panelSoft, accent: panelAccent, accentInk: panelBg };
  const Pa = makeParts(cv, asidePal, fonts, sideW - mm(18), null, headStyle, bulletChar, hidden);

  // Word liest Tabellen zeilenweise von links: bei linker Seitenspalte steht
  // deren Inhalt im Dokument VOR der Hauptspalte. Deshalb wandert der Name dort
  // in die Spalte — sonst begänne die Datei für jeden Parser mit „PERSÖNLICHES,
  // E-MAIL, …" und der Name käme irgendwann später. Bei rechter Seitenspalte
  // und im Bandlayout führt die Hauptspalte ohnehin.
  /* Wo der Name steht, entscheidet die Vorlage — nicht der Export.
   *
   * Hier stand `layout === 'sidebar-left'`: In JEDER Vorlage mit linker
   * Seitenspalte wanderte der Name in die Spalte, mit dem Argument, ein
   * Parser lese Tabellen zeilenweise und fände ihn sonst zu spät. Nur setzen
   * die Vorlagen selbst ein Merkmal dafür (`nameInSidebar`), und die meisten
   * setzen es NICHT — Bordeaux etwa zeigt den Namen als große Serifenzeile
   * oben in der Hauptspalte. Die Word-Datei zeigte ihn klein unter dem Foto.
   * Wer eine Vorlage aussucht, bekommt damit im Word-Export eine andere.
   * Das Parser-Argument trägt ohnehin nicht weit: die Seitenspalte führt so
   * oder so, und für Maschinen steht die ATS-Fassung daneben. */
  const nameInAside = !!theme?.nameInSidebar;
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
  mainChildren.push(...Pm.mainBlocks(mainSkills, orderedSections(MAIN_ORDER_ASIDE, cfg.sectionOrder)));

  const asideCell = new TableCell({
    width: { size: sideW, type: WidthType.DXA },
    shading: band || plainPanel ? undefined : { type: ShadingType.CLEAR, color: 'auto', fill: panelBg },
    borders: band || plainPanel
      ? { ...NO_BORDERS, [layout === 'sidebar-right' ? 'left' : 'right']: { style: BorderStyle.SINGLE, size: 4, color: toHex(theme?.colors.rule ?? '#cccccc', 'CCCCCC') } }
      : undefined,
    margins: { top: mm(14), bottom: mm(16), left: mm(9), right: mm(9) },
    verticalAlign: VerticalAlign.TOP,
    children: [
      ...(theme?.photo !== 'none' && val(p.photo) && !band
        // Ein Kreis braucht ein Quadrat. Mit dem Hochformat der übrigen
        // Formen wäre er im Dokument eine Ellipse.
        ? [photoRun(val(p.photo), 34, theme?.photo === 'circle' ? 34 : 34 * 1.25)].filter(Boolean) as Paragraph[]
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
          ? [photoRun(val(p.photo), 26, theme?.photo === 'circle' ? 26 : 26 * 1.2)].filter(Boolean) as Paragraph[]
          : []),
        new Paragraph({ spacing: { after: 10 }, children: [new TextRun({ text: val(p.name) || 'CV', bold: true, size: 40, color: panelInk, font: fonts.heading })] }),
        ...(val(p.title) ? [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: val(p.title).toUpperCase(), bold: true, color: panelAccent, characterSpacing: 20, size: 18, font: fonts.body })] })] : []),
        ...personalLines(p, fields, hidden).map(line => new Paragraph({
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

  /* Die randabfallende Farbfläche. Nur für die Seitenspalten-Layouts: Im
   * Bandlayout ist die Fläche der Kopfbalken selbst, der endet gewollt mit
   * seinem Inhalt. Die Zelle behält ihre Hinterlegung — sie deckt denselben
   * Bereich in derselben Farbe ab und springt ein, falls das Bild nicht
   * zustande kommt (Leinwand nicht verfügbar). Man sieht keine Naht. */
  const header = band || plainPanel
    ? null
    : sideBandHeader(panelBg, layout === 'sidebar-right' ? PAGE_W - sideW : 0, sideW, PAGE_H);

  return new Document({
    ...docMeta, numbering, styles,
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H },
          margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
        },
      },
      ...(header ? { headers: { default: header } } : {}),
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
export type PhotoShape = 'circle' | 'rounded' | 'rect' | 'none';

/**
 * Die Form gehört ins Bild, nicht ins Dokument.
 *
 * Befund aus der Benutzung: Ein Foto, das im Browser rund ist, kam in Word
 * eckig an. Word kann Bilder zwar zuschneiden, aber `docx` reicht dafür keine
 * Handhabe durch — und selbst wenn: Ein Empfänger, der das Bild anfasst,
 * hätte plötzlich ein Quadrat. Deshalb wird die Form hier in die Bildpunkte
 * gebrannt. Was Word bekommt, IST rund.
 *
 * Die Fläche außerhalb der Maske wird mit der Farbe hinterlegt, auf der das
 * Bild später sitzt — nicht mit Weiß. Auf Terrakottas cremefarbenem Kopfband
 * wäre ein weißes Quadrat um den Kreis genau der Fehler, den die Maske
 * vermeiden soll. Transparenz scheidet aus: Word stellt transparente PNGs in
 * manchen Fassungen schwarz dar.
 */
export async function photoAsRaster(
  src: string,
  shape: PhotoShape = 'rect',
  bgHex = 'FFFFFF',
): Promise<string | null> {
  const v = (src || '').trim();
  if (!v) return null;
  // Eine fertige Data-URL wird nur dann unverändert durchgereicht, wenn keine
  // Form aufgeprägt werden muss — sonst muss auch sie über die Leinwand.
  if (shape !== 'circle' && shape !== 'rounded' && /^data:image\/(png|jpe?g|gif|bmp);base64,/i.test(v)) return v;
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
    const nw = img.naturalWidth || maxW;
    const nh = img.naturalHeight || maxW;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) return null;

    const hinterlegen = () => {
      ctx.fillStyle = `#${bgHex.replace(/^#/, '')}`;
      ctx.fillRect(0, 0, c.width, c.height);
    };

    if (shape === 'circle') {
      // Kreis heißt quadratisch, und quadratisch heißt: mittig beschneiden,
      // nicht stauchen. Ein gestauchtes Gesicht wäre schlimmer als ein eckiges.
      const seite = Math.min(maxW, Math.min(nw, nh));
      c.width = seite; c.height = seite;
      hinterlegen();
      ctx.save();
      ctx.beginPath();
      ctx.arc(seite / 2, seite / 2, seite / 2, 0, Math.PI * 2);
      ctx.clip();
      const q = Math.min(nw, nh);
      ctx.drawImage(img, (nw - q) / 2, (nh - q) / 2, q, q, 0, 0, seite, seite);
      ctx.restore();
      return c.toDataURL('image/png');
    }

    const scale = Math.min(1, maxW / nw);
    c.width = Math.max(1, Math.round(nw * scale));
    c.height = Math.max(1, Math.round(nh * scale));
    hinterlegen();

    if (shape === 'rounded') {
      const r = Math.round(c.width * 0.08);
      ctx.save();
      ctx.beginPath();
      // roundRect kennt nicht jede Fassung — der Pfad von Hand ist billiger
      // als eine Fallunterscheidung, die irgendwann niemand mehr prüft.
      ctx.moveTo(r, 0);
      ctx.lineTo(c.width - r, 0); ctx.quadraticCurveTo(c.width, 0, c.width, r);
      ctx.lineTo(c.width, c.height - r); ctx.quadraticCurveTo(c.width, c.height, c.width - r, c.height);
      ctx.lineTo(r, c.height); ctx.quadraticCurveTo(0, c.height, 0, c.height - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, 0, 0, c.width, c.height);
      ctx.restore();
      return c.toDataURL('image/png');
    }

    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** Liefert den Lebenslauf mit einem Foto, das Word einbetten kann — in der
 *  Form, die die Vorlage vorsieht, und auf ihrer Hintergrundfarbe. */
export async function withRasterPhoto(cv: CVData, cfg: ExportRenderConfig): Promise<CVData> {
  const src = val(cv.personal?.photo);
  if (!src) return cv;
  // Auch hier die vollständige Konfiguration: Die gewählte Papierfarbe
  // verschiebt `panelBg` — und das ist die Fläche, auf der das Foto sitzt und
  // mit der seine Maske hinterlegt wird.
  const theme = cfg.themeId ? getTheme(cfg.themeId, cfg.accentId, cfg.paperId) : undefined;
  const shape = (theme?.photo ?? 'rect') as PhotoShape;
  // Hinter dem Foto liegt die Fläche, auf der es im Dokument sitzt: im
  // Bandlayout und in der Nebenspalte die Panel-Farbe, sonst das Papier.
  const bg = toHex(theme ? theme.colors.panelBg : '#ffffff', 'FFFFFF');
  const raster = await photoAsRaster(src, shape, bg);
  if (!raster) return { ...cv, personal: { ...cv.personal, photo: '' } };
  if (raster === src) return cv;
  return { ...cv, personal: { ...cv.personal, photo: raster } };
}

/** Build + trigger a browser download. */
export async function exportDocx(cv: CVData, cfg: ExportRenderConfig, variant: DocxVariant = 'design'): Promise<void> {
  // Foto zuerst in ein Format bringen, das Word kennt — sonst fehlt es
  // stillschweigend (siehe `photoAsRaster`).
  const doc = buildDocx(variant === 'design' ? await withRasterPhoto(cv, cfg) : cv, cfg, variant);
  const blob = await Packer.toBlob(doc);
  /* Der Dateiname kommt aus `exportFilename` wie bei PDF, HTML und JSON.
   * Vorher wurde er hier eigens gebaut („lena-brandt.docx") — zwei Exporte
   * hintereinander hießen gleich, der Browser hängte „(1)" an, und im
   * Postfach des Empfängers lag eine Datei, die nicht nach Bewerbung aussah.
   * Die ATS-Fassung behält ihre Kennzeichnung, sonst sind die beiden Dateien
   * im Ordner nicht auseinanderzuhalten. */
  const name = exportFilename('lebenslauf', val(cv.personal?.name), 'docx');
  saveBlob(variant === 'ats' ? name.replace(/\.docx$/, '-ATS.docx') : name, blob);
}
