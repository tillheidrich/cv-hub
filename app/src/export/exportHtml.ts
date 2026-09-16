import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResumeRenderer from '../templates/ResumeRenderer';
import CoverLetterRenderer from '../templates/CoverLetterRenderer';
import { getTheme, resolvePairing } from '../templates/theme';
import type { AccentId, PaperId, CVData, CoverLetterData, FontPairingId, PageFormat, SectionKey } from '../data/types';
import { metricsFor, type Metrics } from '../templates/metrics';
import { getPageFormat } from '../data/pageFormats';
import { exportFilename } from './filename';

/** Headless-Chrome PDF service — path-routed on the app domain. Override via VITE_PDF_SERVICE. */
const PDF_SERVICE: string =
  (import.meta.env.VITE_PDF_SERVICE as string | undefined) || '/pdfapi';

/** Schriften kommen von der eigenen Domain, nicht von Google. Das spart bei
 *  jedem PDF-Aufbau zwei Netzrunden zu einem fremden Host, macht den Export
 *  spürbar schneller und hält die Zusage ein, dass keine IP-Adressen an Google
 *  gehen. `public/fonts.css` wird beim Build aus den @fontsource-Paketen
 *  erzeugt (scripts/build-fonts.mjs). */
const FONT_LINK = typeof window !== 'undefined'
  ? `${window.location.origin}/fonts.css`
  : '/fonts.css';

export interface ExportRenderConfig {
  themeId: string;
  /** Gewählte Akzentfarbe — ohne sie exportierte das PDF in der Vorlagenfarbe
   *  und sah anders aus als die Vorschau. */
  accentId?: AccentId;
  /** Gewählte Papierfarbe — aus demselben Grund wie der Akzent: ohne sie
   *  druckte das PDF auf der Vorlagenfarbe und wich von der Vorschau ab. */
  paperId?: PaperId;
  pairingId: FontPairingId;
  /** Aufgelöste Metriken aus der Vorschau — dieselben Werte, dieselbe Optik. */
  metrics?: Metrics;
  /** Umbruchergebnis aus der Vorschau: Block-IDs je Seite. Das PDF bekommt
   *  exakt die Seiten, die der Nutzer gesehen hat — kein zweiter
   *  Umbruchalgorithmus, keine Abweichung. */
  pageBlocks?: string[][];
  hiddenSections?: SectionKey[];
  sectionOrder?: SectionKey[];
  pageFormat?: PageFormat;
  /** Sektionen mit erzwungenem Seitenumbruch. */
  forcedBreaks?: SectionKey[];
  /** Skill-Gruppen in der Seitenspalte — aus der Vorschau übernommen, sonst
   *  läuft die Spalte im PDF über und der Inhalt fehlt kommentarlos. */
  asideSkillCap?: number;
  /** @deprecated Altlast aus der Zeit vor dem Metrik-System. */
  density?: number;
  /** @deprecated Seitenzahl kommt jetzt aus `pageBlocks`. */
  pages?: number;
}

function download(filename: string, blob: Blob): void {
  // Der Link muss im Dokument hängen und die Object-URL darf NICHT sofort
  // wieder freigegeben werden — sonst brechen Safari und Firefox den Download
  // gelegentlich mitten im Speichern ab. Gleiches Muster wie in Klarbild.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Liest den Dateinamen aus dem Content-Disposition-Header. Der Server kennt
 *  den kanonischen Namen (inkl. Zeitstempel) — den hier nachzubauen hieße,
 *  zwei Exporte derselben Minute wieder gleich zu benennen. */
function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) { try { return decodeURIComponent(utf8[1]); } catch { /* fällt unten durch */ } }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}


function wrapDocument(title: string, body: string, pageFormat: PageFormat = 'a4'): string {
  const fmt = getPageFormat(pageFormat);
  const w = `${fmt.widthMm}mm`;
  const h = `${fmt.heightMm}mm`;

  // Kein Zerschneiden mehr. Der Renderer liefert bereits N fertige
  // `.cv-page`-Elemente — jede auf genau eine physische Seite gepinnt (Höhe
  // und `contain: paint` weiter unten, sonst umbricht Safari den Überhang
  // auf ein Extrablatt), mit dem
  // Inhalt, den der Paginator dieser Seite zugewiesen hat. Chromium muss
  // nur noch nach jeder Seite umbrechen. Vorher wurde derselbe Fließtext
  // N-mal ausgegeben und per `translateY` verschoben; genau daher kamen die
  // Schnitte mitten im Satz.
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link href="${FONT_LINK}" rel="stylesheet">
<style>
  *, *::before, *::after {
    box-sizing: border-box; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  /* Hard-pin the chosen page size with zero margins so browser print never rescales/shifts. */
  @page { size: ${w} ${h}; margin: 0 !important; }
  html, body {
    background: #ffffff;
    width: ${w};
    margin: 0 !important;
    padding: 0 !important;
    font-family: 'Inter', system-ui, sans-serif;
  }
  /* Screen preview: center the page horizontally for nicer reading. */
  body { display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
  .cv-page {
    width: ${w};
    height: ${h};
    margin: 0 !important;
    padding: 0;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
    /* WebKit (Safari) ignoriert "overflow: hidden" beim Seitenumbruch: was
       unten herausragt, landet dort auf einem zusätzlichen Blatt — aus zwei
       Seiten werden vier. "contain" macht die Seite zu einem monolithischen
       Kasten: sie wird nie zerschnitten, und der Überhang wird auch im Druck
       abgeschnitten statt umbrochen. Damit druckt Safari genau das, was am
       Bildschirm zu sehen ist. */
    contain: paint;
  }
  .cv-page:last-of-type { page-break-after: auto; break-after: auto; }

/* ── Isolation des gesetzten Dokuments ───────────────────────────────────────
   Wortgleich in app/src/index.css und im Export-HTML (export/exportHtml.ts).
   Grund: in der App liegt Tailwinds Preflight über allem, im exportierten
   HTML nur ein Minimal-Reset. Ohne diesen Block misst die Vorschau andere
   Blockhöhen als das PDF — und weil die Seitenaufteilung aus genau diesen
   Höhen berechnet wird, wandern Umbrüche. Inline-Styles des Renderers
   gewinnen gegen diese Regeln; hier wird nur neutralisiert, was der Renderer
   NICHT selbst setzt. */
.cv-page, .cv-page * {
  margin: 0;
  padding: 0;
  border: 0 solid;
  box-sizing: border-box;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  font-style: inherit;
  list-style: none;
  text-decoration: none;
  text-align: inherit;
  vertical-align: baseline;
}

  /* Nur für Screenreader und Textextraktion sichtbar — trägt u. a. das
     Sprachniveau, das visuell als Punkteskala erscheint. */
  .cv-sr-only {
    position: absolute; width: 1px; height: 1px;
    padding: 0; margin: -1px; overflow: hidden;
    clip: rect(0 0 0 0); clip-path: inset(50%);
    white-space: nowrap; border: 0;
  }

  /* Sicherheitsnetz, falls eine Seite doch minimal überläuft: Chromium soll
     dann an einer Blockgrenze brechen, nicht mitten in einem Stichpunkt.
     Im Normalfall greift keine dieser Regeln, weil jede .cv-page bereits
     genau den Inhalt trägt, der auf sie passt. */
  .cv-page [data-cv-section] { break-inside: avoid; }
  .cv-page p { orphans: 2; widows: 2; }

  /* Sticky print-tip banner — visible on screen, hidden when printing. */
  .print-tip {
    position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
    z-index: 9999; background: #1C1917; color: #F5F4F1;
    padding: 10px 18px; font-size: 12px; font-weight: 600;
    letter-spacing: 0.04em; box-shadow: 0 6px 24px rgba(0,0,0,0.18);
    max-width: 92vw; line-height: 1.5; border-radius: 4px;
  }
  .print-tip kbd {
    background: rgba(245,244,241,0.18); padding: 1px 6px;
    border-radius: 3px; font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 11px; font-weight: 500;
  }
  .print-tip button {
    margin-left: 14px; background: transparent; border: 1px solid rgba(245,244,241,0.4);
    color: #F5F4F1; padding: 3px 10px; font-size: 11px; cursor: pointer;
    font-family: inherit; border-radius: 3px;
  }
  @media print {
    html, body { width: ${w}; height: auto; background: #ffffff !important; }
    body { display: block !important; }
    .cv-page {
      width: ${w} !important;
      height: ${h} !important;
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
      overflow: hidden !important;
      contain: paint;
      break-inside: avoid-page;
      page-break-inside: avoid;
    }
    .print-tip { display: none !important; }
    /* Belt-and-suspenders: kill any UA padding around the page edges. */
    @page :first { margin: 0 !important; }
    @page :left  { margin: 0 !important; }
    @page :right { margin: 0 !important; }
  }
</style>
</head>
<body>
<div class="print-tip" id="print-tip">
  <strong>Druck-Tipp:</strong> Strg/⌘+P → <em>Ränder: Keine</em>, <em>Hintergrundgrafiken: An</em>.
  <button onclick="document.getElementById('print-tip').remove()">Verstanden</button>
</div>
${body}
<script>
/* Der Kasten einer Seite ist auf die Blatthöhe gepinnt und schneidet ab, was
   nicht hineinpasst — sonst schiebt Safari den Überhang auf ein Extrablatt.
   Abschneiden darf aber nicht heimlich passieren: Fremde Browser setzen Text
   minimal anders als der, in dem der Umbruch berechnet wurde. Passt etwas
   nicht mehr, sagt der Hinweis oben, welche Seite betroffen ist. */
function checkOverflow() {
  var tip = document.getElementById('print-tip');
  if (!tip) return;
  var over = [];
  var pages = document.querySelectorAll('.cv-page');
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i], max = 0;
    for (var j = 0; j < p.children.length; j++) {
      var c = p.children[j];
      max = Math.max(max, c.scrollHeight, c.getBoundingClientRect().height);
    }
    if (max - p.clientHeight > 2) over.push(i + 1);
  }
  if (!over.length) return;
  tip.innerHTML = '<strong>Hinweis:</strong> In diesem Browser passt der Inhalt von Seite '
    + over.join(', ') + ' nicht ganz auf das Blatt; der Überhang wird abgeschnitten. '
    + 'Das PDF aus dem Editor ist maßgeblich \u2014 oder im Editor etwas kürzen.'
    + '<button onclick="this.parentNode.remove()">Verstanden</button>';
  tip.style.background = '#fef3c7';
  tip.style.color = '#7c2d12';
}
/* Erst messen, wenn Schriften und Bild geladen sind: mit Ersatzschrift ist der
   Satz höher, das ergäbe einen Fehlalarm. */
window.addEventListener('load', function () {
  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () { setTimeout(checkOverflow, 0); });
});
</script>
</body>
</html>`;
}

// ── HTML builders ───────────────────────────────────────────────────────────

function buildResumeHtml(data: CVData, cfg: ExportRenderConfig): string {
  const theme = getTheme(cfg.themeId, cfg.accentId, cfg.paperId);
  const pairing = resolvePairing(theme, cfg.pairingId);
  const body = renderToStaticMarkup(
    createElement(ResumeRenderer, {
      data, theme, pairing,
      metrics: cfg.metrics ?? metricsFor(0, cfg.density ?? 1),
      pageBlocks: cfg.pageBlocks,
      hiddenSections: cfg.hiddenSections,
      sectionOrder: cfg.sectionOrder,
      pageFormat: cfg.pageFormat,
      forcedBreaks: cfg.forcedBreaks,
      asideSkillCap: cfg.asideSkillCap,
    }),
  );
  // The <title> becomes the default filename when the user prints the HTML
  // via Ctrl/Cmd+P → "Save as PDF". Using the same canonical export filename
  // (without extension) means the printed PDF inherits the good
  // 'Lebenslauf_Lena-Brandt_2026-06-01_0930' format instead of the prosey
  // 'Lena Brandt – Lebenslauf' the browser would otherwise pick.
  const title = exportFilename('lebenslauf', data.personal.name, '').replace(/\.$/, '');
  return wrapDocument(title, body, cfg.pageFormat);
}

function buildCoverLetterHtml(cvData: CVData, clData: CoverLetterData, cfg: ExportRenderConfig): string {
  const theme = getTheme(cfg.themeId, cfg.accentId, cfg.paperId);
  const pairing = resolvePairing(theme, cfg.pairingId);
  const body = renderToStaticMarkup(
    createElement(CoverLetterRenderer, { cvData, clData, theme, pairing, metrics: cfg.metrics ?? metricsFor(0, cfg.density ?? 1), pageFormat: cfg.pageFormat }),
  );
  const title = exportFilename('anschreiben', cvData.personal.name, '').replace(/\.$/, '');
  return wrapDocument(title, body, cfg.pageFormat);
}

/**
 * Liest den Text aus dem TATSÄCHLICH exportierten Dokument, in der Reihenfolge
 * des DOM — und damit in der Reihenfolge, in der die Wörter auch im
 * PDF-Content-Stream landen.
 *
 * Das ist der Unterschied zu einer aus den Rohdaten zusammengesetzten
 * Textansicht: die kann gar nicht auffallen lassen, wenn im Export etwas fehlt,
 * doppelt steht oder in der falschen Spaltenreihenfolge ausgegeben wird. Genau
 * solche Fehler hat es in diesem Renderer schon gegeben (Sektionen doppelt bei
 * header-band; Seitenspalte vor dem Namen im Textstrom).
 *
 * Bewusst KEINE Aussage darüber, was ein bestimmtes ATS daraus macht — geprüft
 * wird die Reihenfolge und die Vollständigkeit, nicht das Parse-Ergebnis.
 */
export function extractExportText(data: CVData, cfg: ExportRenderConfig): string {
  const html = buildResumeHtml(data, cfg);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('style, script, .print-tip').forEach(el => el.remove());

  const lines: string[] = [];
  const BLOCK = new Set(['DIV', 'P', 'LI', 'UL', 'SECTION', 'H1', 'H2', 'H3', 'H4', 'ARTICLE']);
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) {
        // An Blockgrenzen neue Zeile, innerhalb eines Blocks anhängen.
        if (lines.length && !lines[lines.length - 1].endsWith('\u0000')) lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + t;
        else lines.push(t);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const block = BLOCK.has(el.tagName);
    if (block) lines.push('');
    el.childNodes.forEach(walk);
    if (block) lines.push('');
  };
  doc.querySelectorAll('.cv-page').forEach((pageEl, i) => {
    if (i > 0) lines.push('', `--- Seite ${i + 1} ---`, '');
    pageEl.childNodes.forEach(walk);
  });

  return lines
    .map(l => l.trim())
    .filter((l, i, arr) => l || (arr[i - 1] && arr[i - 1].trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Nur für den Umbruch-Prüfstand: gibt das Export-HTML zurück, statt es
 *  herunterzuladen. So lässt sich das echte PDF im Test erzeugen. */
export function buildResumeHtmlForTest(data: CVData, cfg: ExportRenderConfig): string {
  return buildResumeHtml(data, cfg);
}

// ── HTML export (standalone file) ───────────────────────────────────────────

export function exportHtml(data: CVData, cfg: ExportRenderConfig): void {
  download(exportFilename('lebenslauf', data.personal.name, 'html'),
    new Blob([buildResumeHtml(data, cfg)], { type: 'text/html;charset=utf-8' }));
}

export function exportCoverLetterHtml(cvData: CVData, clData: CoverLetterData, cfg: ExportRenderConfig): void {
  download(exportFilename('anschreiben', cvData.personal.name, 'html'),
    new Blob([buildCoverLetterHtml(cvData, clData, cfg)], { type: 'text/html;charset=utf-8' }));
}

// ── Direct PDF export (no print dialog) ─────────────────────────────────────

export interface PdfExportArgs {
  data: CVData;
  cfg: ExportRenderConfig;
  isCover?: boolean;
  coverLetter?: CoverLetterData;
}

/**
 * Renders a print-quality PDF via the headless-Chrome service and downloads it
 * directly — no browser print dialog. Throws on failure so the caller can
 * fall back to window.print().
 */
export async function exportPdf({ data, cfg, isCover, coverLetter }: PdfExportArgs): Promise<{ pages: number; bytes: number }> {
  const html = isCover && coverLetter
    ? buildCoverLetterHtml(data, coverLetter, cfg)
    : buildResumeHtml(data, cfg);
  const filename = exportFilename(isCover ? 'anschreiben' : 'lebenslauf', data.personal.name, 'pdf');

  const pageFormat = cfg.pageFormat || 'a4';
  const resp = await fetch(`${PDF_SERVICE}/api/pdf`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename, pageFormat }),
  });
  if (!resp.ok) {
    // Der Dienst schickt bei Fehlern JSON mit Klartext — den zeigen wir dem
    // Nutzer, statt ihn mit einer nackten Statusnummer stehen zu lassen.
    const detail = await resp.json().then(j => (j && typeof j.error === 'string' ? j.error : '')).catch(() => '');
    if (resp.status === 429) throw new Error('Zu viele PDF-Exporte in kurzer Zeit. In ein paar Minuten nochmal.');
    throw new Error(detail || `PDF-Dienst antwortete mit ${resp.status}`);
  }
  const blob = await resp.blob();
  if (blob.type.indexOf('pdf') === -1 && blob.size < 1000) {
    throw new Error('Der PDF-Dienst hat kein gültiges PDF geliefert.');
  }
  download(filenameFromHeader(resp.headers.get('Content-Disposition'), filename), blob);
  return { pages: cfg.pageBlocks?.length || 1, bytes: blob.size };
}
