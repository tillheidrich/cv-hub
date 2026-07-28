import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PageMode, PageFormat, UILabels } from '../data/types';
import { getPageFormat } from '../data/pageFormats';

const MM_TO_PX = 96 / 25.4;          // 3.7795

/** Editor tab IDs — kept in sync with EditorPanel's Tab union. */
export type EditorTab = 'personal' | 'profil' | 'erfahrung' | 'bildung' | 'skills' | 'sprachen';

interface Props {
  /** render the document at a given density; `measure` = natural-height mode */
  render: (density: number, pages: number, measure: boolean) => React.ReactNode;
  /** user font-size multiplier from the slider */
  userScale: number;
  pageMode: PageMode;
  /** Page format (drives single-page height for the fit algorithm). */
  pageFormat?: PageFormat;
  /** extra viewport scaling (mobile fit) */
  viewportScale?: number;
  /** called with the resolved page count + whether content was auto-shrunk */
  onFit?: (info: { pages: number; density: number; shrunk: boolean }) => void;
  /** UI labels — needed so we can match section titles back to an editor tab
   *  when the user clicks somewhere in the rendered CV. */
  labels?: UILabels;
  /** click-to-edit jump — fired with the editor tab matching the clicked
   *  area of the preview. Pass undefined to disable. */
  onEdit?: (tab: EditorTab) => void;
  /** Manual page-break mode: when true, the underlying renderer already
   *  emits N .cv-page divs (one per page), so DocumentPreview should not
   *  layer its own slicing on top — that would double-paginate visually. */
  manualPaginated?: boolean;
}

/**
 * Maps a clicked DOM node inside the rendered CV to the editor tab that
 * controls that area. Walks up to the nearest <section>, reads its heading
 * text, and matches against the user's UI labels. Falls back to 'personal'
 * for clicks in the header/contact area (which usually has no <section>
 * wrapper) and to 'skills' for clicks inside a section whose title doesn't
 * match any known label (every other section type is a skill group, since
 * those carry user-supplied labels like "Tech" or "Methoden").
 */
function detectEditorTab(target: HTMLElement, labels: UILabels): EditorTab {
  let cur: HTMLElement | null = target;
  let section: HTMLElement | null = null;
  while (cur) {
    if (cur.tagName === 'SECTION') { section = cur; break; }
    cur = cur.parentElement;
  }
  if (!section) {
    // Top-of-page click — almost always the name / contact / photo block.
    return 'personal';
  }
  const heading = section.querySelector('h1, h2, h3, h4');
  const text = (heading?.textContent || '').trim();
  const sec = labels.sections;
  if (text === sec.profile) return 'profil';
  if (text === sec.experience) return 'erfahrung';
  if (text === sec.education) return 'bildung';
  if (text === sec.languages) return 'sprachen';
  if (text === sec.personal || text === sec.details || text === sec.additional) return 'personal';
  // Unknown title → user-named skill group (e.g. "Tech", "Methoden").
  return 'skills';
}

/**
 * Renders a CV / cover-letter and fits it to an exact number of A4 pages.
 *
 * A hidden measuring copy is rendered at the *candidate* density; its real
 * height is fed back and the density is iterated until the content fills the
 * target page(s) — not merely fits under them. Content height does not scale
 * linearly with density (smaller text wraps less), so a single linear estimate
 * leaves large empty space; the fixed-point loop converges in ~3-5 steps.
 */
export default function DocumentPreview({ render, userScale, pageMode, pageFormat = 'a4', viewportScale = 1, onFit, labels, onEdit, manualPaginated }: Props) {
  /* Click-to-edit: walks up from the clicked DOM node to the nearest <section>
     in the rendered CV, matches its title against the user's labels, and
     opens the matching editor tab. No-op if onEdit isn't wired. */
  const handlePreviewClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!onEdit || !labels) return;
    const tgt = e.target as HTMLElement | null;
    if (!tgt) return;
    // Ignore clicks on links/buttons inside the preview so we don't steal
    // genuine navigation intent.
    if (tgt.closest('a, button, input, textarea, select')) return;
    // Ignore clicks on screen-only overlays (the "Seite N / M" chip etc.).
    if (tgt.closest('[data-noprint]')) return;
    onEdit(detectEditorTab(tgt, labels));
  }, [onEdit, labels]);
  const measureRef = useRef<HTMLDivElement>(null);
  const PAGE_PX = getPageFormat(pageFormat).heightMm * MM_TO_PX;
  const PAGE_WIDTH_MM = getPageFormat(pageFormat).widthMm;
  const [density, setDensity] = useState(userScale);
  const [pages, setPages] = useState(1);
  const iterRef = useRef(0);
  const sigRef = useRef('');
  const reportedRef = useRef('');

  const sig = `${userScale}|${pageMode}`;

  const report = useCallback((p: number, dens: number) => {
    if (!onFit) return;
    const key = `${p}|${dens.toFixed(3)}`;
    if (key === reportedRef.current) return;
    reportedRef.current = key;
    onFit({ pages: p, density: dens, shrunk: dens < userScale - 0.005 });
  }, [onFit, userScale]);

  useLayoutEffect(() => {
    const el = measureRef.current?.firstElementChild as HTMLElement | undefined;
    if (!el) return;
    const h = el.scrollHeight;
    if (!h || h < 10) return;

    // inputs changed → restart the fit from the user's chosen scale
    if (sigRef.current !== sig) {
      sigRef.current = sig;
      iterRef.current = 0;
      if (density !== userScale) {
        queueMicrotask(() => setDensity(userScale));
        return;
      }
    }

    // ── auto: never shrink, just count the pages the content needs ──────────
    if (pageMode === 'auto') {
      const p = Math.min(3, Math.max(1, Math.ceil(h / PAGE_PX - 0.06)));
      if (p !== pages) queueMicrotask(() => setPages(p));
      if (density !== userScale) queueMicrotask(() => setDensity(userScale));
      report(p, userScale);
      return;
    }

    // ── one / two: iterate density so the content fills the target ──────────
    const requestedPages = pageMode === 'three' ? 3 : pageMode === 'two' ? 2 : 1;
    if (pages !== requestedPages) {
      queueMicrotask(() => setPages(requestedPages));
      return;
    }
    const target = pages * PAGE_PX;
    const ratio = target / h;
    const DENSITY_FLOOR = 0.65;  // anything smaller becomes unreadable

    const filled = h <= target * 1.006 && h >= target * 0.955;
    const cappedShort = ratio > 1 && density >= userScale - 0.002;
    if (filled || cappedShort || iterRef.current > 9) {
      report(pages, density);
      return;
    }

    // Floor reached AND content still overflows → escalate to next page count
    // instead of clipping content. This stops the 'tiny illegible single page'
    // failure mode where density bottoms out but content keeps spilling past
    // the page edge.
    if (pageMode === 'one' && pages === 1 && density <= DENSITY_FLOOR + 0.005 && h > target * 1.02) {
      queueMicrotask(() => { setPages(2); setDensity(userScale); });
      iterRef.current = 0;
      return;
    }

    iterRef.current += 1;
    const next = Math.min(userScale, Math.max(DENSITY_FLOOR, density * ratio));
    if (Math.abs(next - density) > 0.003) queueMicrotask(() => setDensity(next));
    else report(pages, density);
  }, [density, pageMode, pages, report, sig, userScale]);

  return (
    <>
      {/* Hidden measuring copy — rendered at the candidate density */}
      <div
        ref={measureRef}
        data-noprint
        aria-hidden
        style={{ position: 'fixed', left: '-10000px', top: 0, width: `${PAGE_WIDTH_MM}mm`, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {render(density, 1, true)}
      </div>

      {/*
        Visible copy.

        Single-page mode: render the document once, no slicing.

        Multi-page mode: render the SAME content N times, each inside a fixed-
        height viewport (1 physical page) with overflow:hidden, where the inner
        content is translated up by `page * PAGE_PX`. This shows the content
        sliced into real physical pages with a visible white gap and shadow
        between them — exactly what the user will get in the PDF. No more
        "is this text on page 1 or 2?" confusion.

        For print (browser Drucken button on ShareView) we collapse the slices
        back into a single natural flow so the browser print engine paginates
        cleanly with our page-break-inside hints.
      */}
      <div
        className={`cv-scale-wrapper${onEdit ? ' cv-clickable' : ''}`}
        onClick={handlePreviewClick}
        style={{
          transformOrigin: 'top center',
          transform: viewportScale < 1 ? `scale(${viewportScale})` : undefined,
          width: viewportScale < 1 ? `${PAGE_WIDTH_MM}mm` : undefined,
          position: 'relative',
          cursor: onEdit ? 'pointer' : undefined,
        }}
      >
        {pages === 1 || manualPaginated ? (
          /* Manual mode: the renderer itself returns N .cv-page divs stacked
             vertically — we just display them. The user's "hard page break"
             choice has already been honoured upstream, so we don't slice. */
          render(density, pages, false)
        ) : (
          <div className="cv-page-stack" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {Array.from({ length: pages }, (_, i) => (
              <div
                key={`slice-${i}`}
                className="cv-page-slice"
                style={{
                  position: 'relative',
                  width: `${PAGE_WIDTH_MM}mm`,
                  height: `${PAGE_PX}px`,
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 12px 32px -8px rgba(0,0,0,0.18)',
                  borderRadius: '2px',
                }}
              >
                <div
                  className="cv-page-slice-inner"
                  style={{
                    transform: i === 0 ? undefined : `translateY(-${i * PAGE_PX}px)`,
                    width: `${PAGE_WIDTH_MM}mm`,
                  }}
                >
                  {render(density, 1, true)}
                </div>
                <div
                  data-noprint
                  aria-hidden
                  style={{
                    position: 'absolute',
                    right: '-68px',
                    top: '8px',
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase',
                    color: 'rgba(0,0,0,0.42)', background: '#F5F4F1',
                    padding: '3px 8px', whiteSpace: 'nowrap',
                    borderRadius: '2px',
                  }}
                >
                  Seite {i + 1} / {pages}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`
        @media print {
          /* Collapse the multi-page slice view to a single natural flow so the
             browser's print engine paginates by itself using page-break-inside
             hints from the renderer. */
          .cv-page-stack { display: block !important; gap: 0 !important; }
          .cv-page-slice { height: auto !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
          .cv-page-slice + .cv-page-slice { display: none !important; }
          .cv-page-slice-inner { transform: none !important; }
        }
      `}</style>
    </>
  );
}
