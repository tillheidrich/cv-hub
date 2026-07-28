import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ResumeRenderer from '../templates/ResumeRenderer';
import CoverLetterRenderer from '../templates/CoverLetterRenderer';
import { getTheme, resolvePairing } from '../templates/theme';
import type { CVData, CoverLetterData, FontPairingId, PageFormat, SectionKey } from '../data/types';
import { getPageFormat } from '../data/pageFormats';
import { exportFilename } from './filename';

/** Headless-Chrome PDF service — path-routed on the app domain. Override via VITE_PDF_SERVICE. */
const PDF_SERVICE: string =
  (import.meta.env.VITE_PDF_SERVICE as string | undefined) || '/pdfapi';

const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&family=Merriweather:wght@400;700&family=Source+Serif+4:wght@400;600;700&family=Space+Grotesk:wght@400;500;600;700&family=EB+Garamond:wght@400;500;600&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap';

export interface ExportRenderConfig {
  themeId: string;
  pairingId: FontPairingId;
  density: number;
  pages: number;
  hiddenSections?: SectionKey[];
  sectionOrder?: SectionKey[];
  pageFormat?: PageFormat;
  /** Manual page assignment per section — when set with pages > 1 the
   *  ResumeRenderer emits N independent .cv-page divs, so we skip the
   *  print-slice wrapper (which would double-paginate). */
  sectionPages?: Partial<Record<SectionKey, number>>;
}

function download(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function wrapDocument(title: string, body: string, pageFormat: PageFormat = 'a4', pages = 1): string {
  const fmt = getPageFormat(pageFormat);
  const w = `${fmt.widthMm}mm`;
  const h = `${fmt.heightMm}mm`;

  // Multi-page PDF/HTML output: we don't trust Chromium to natively paginate
  // a single .cv-page that has height: N*pageHeight and overflow:hidden —
  // experimentally Chromium clips at page 1 in that setup. Instead, emit the
  // rendered body N times, each inside a fixed-height "print-slice" that's
  // exactly one physical page tall, with the inner body translated up by the
  // slice's index so each slice shows a different vertical chunk of the same
  // content. `page-break-after: always` on the slice guarantees N physical
  // pages in the resulting PDF. This is the same model the on-screen
  // DocumentPreview uses, just emitted as actual DOM for the print engine.
  const bodyMaybeSliced = pages > 1
    ? Array.from({ length: pages }, (_, i) => `<div class="print-slice"><div class="print-inner" style="transform:translateY(-${i * fmt.heightMm}mm)">${body}</div></div>`).join('\n')
    : body;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
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
    margin: 0 !important;
    padding: 0;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .cv-page:last-of-type { page-break-after: auto; break-after: auto; }
  /* Keep multi-page exports clean: avoid splitting sections / entries / bullets
     across pages. The browser print engine picks the next clean break point. */
  .cv-page section { page-break-inside: avoid; break-inside: avoid-page; }
  .cv-page li, .cv-page p { page-break-inside: avoid; break-inside: avoid; }

  /* Multi-page slice container — used only when pages > 1. Each slice is
     exactly one physical page tall, clips its contents, and forces a hard
     page break after itself so Chromium always emits N pages. The inner
     wrapper is translated up so each slice shows a different vertical chunk
     of the same rendered .cv-page below it. */
  .print-slice {
    width: ${w};
    height: ${h};
    overflow: hidden;
    position: relative;
    page-break-after: always;
    break-after: page;
  }
  .print-slice:last-of-type { page-break-after: auto; break-after: auto; }
  .print-inner { width: ${w}; }

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
      margin: 0 !important;
      box-shadow: none !important;
      border: none !important;
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
${bodyMaybeSliced}
</body>
</html>`;
}

// ── HTML builders ───────────────────────────────────────────────────────────

function buildResumeHtml(data: CVData, cfg: ExportRenderConfig): string {
  const theme = getTheme(cfg.themeId);
  const pairing = resolvePairing(theme, cfg.pairingId);
  const body = renderToStaticMarkup(
    createElement(ResumeRenderer, { data, theme, pairing, density: cfg.density, pages: cfg.pages, hiddenSections: cfg.hiddenSections, sectionOrder: cfg.sectionOrder, pageFormat: cfg.pageFormat, sectionPages: cfg.sectionPages }),
  );
  // The <title> becomes the default filename when the user prints the HTML
  // via Ctrl/Cmd+P → "Save as PDF". Using the same canonical export filename
  // (without extension) means the printed PDF inherits the good
  // 'Lebenslauf_Lena-Brandt_2026-06-01_0930' format instead of the prosey
  // 'Lena Brandt – Lebenslauf' the browser would otherwise pick.
  const title = exportFilename('lebenslauf', data.personal.name, '').replace(/\.$/, '');
  // Manual page-break mode: the renderer already emitted N .cv-page divs,
  // so we pass pages=1 to wrapDocument to skip the print-slice wrapper.
  // Without this we'd double-paginate.
  const effectivePagesForWrap = cfg.sectionPages ? 1 : (cfg.pages || 1);
  return wrapDocument(title, body, cfg.pageFormat, effectivePagesForWrap);
}

function buildCoverLetterHtml(cvData: CVData, clData: CoverLetterData, cfg: ExportRenderConfig): string {
  const theme = getTheme(cfg.themeId);
  const pairing = resolvePairing(theme, cfg.pairingId);
  const body = renderToStaticMarkup(
    createElement(CoverLetterRenderer, { cvData, clData, theme, pairing, density: cfg.density, pages: cfg.pages, pageFormat: cfg.pageFormat }),
  );
  const title = exportFilename('anschreiben', cvData.personal.name, '').replace(/\.$/, '');
  return wrapDocument(title, body, cfg.pageFormat, cfg.pages || 1);
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
export async function exportPdf({ data, cfg, isCover, coverLetter }: PdfExportArgs): Promise<void> {
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
    throw new Error(`PDF-Service antwortete mit ${resp.status}`);
  }
  const blob = await resp.blob();
  if (blob.type.indexOf('pdf') === -1 && blob.size < 1000) {
    throw new Error('PDF-Service lieferte kein gültiges PDF');
  }
  download(filename, blob);
}
