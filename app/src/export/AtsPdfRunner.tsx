import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DocumentPreview, { type FitInfo } from '../preview/DocumentPreview';
import ResumeRenderer from '../templates/ResumeRenderer';
import { getTheme, resolvePairing } from '../templates/theme';
import type { Metrics } from '../templates/metrics';
import type { CVData, PageFormat, PageMode, SectionKey } from '../data/types';

export interface AtsPdfJob {
  id: number;
  themeId: string;
  data: CVData;
  fontScale: number;
  pageMode: PageMode;
  pageFormat: PageFormat;
  hiddenSections: SectionKey[];
  sectionOrder: SectionKey[];
  forcedBreaks: SectionKey[];
  resolve: (fit: FitInfo) => void;
  reject: (err: Error) => void;
}

/** Höchstens so lange wird auf die Messung gewartet. */
const MAX_WAIT_MS = 20_000;

/**
 * Unsichtbarer Messlauf für die ATS-Fassung (Wahl der Vorlage und
 * Begründung: export/atsPdfTemplate.ts).
 *
 * Zwei Durchgänge: Der erste kann mit Ersatzschriften gemessen sein, wenn die
 * Schrift der ATS-Vorlage bis dahin auf der Seite nicht vorkam. Nach dem
 * ersten Ergebnis wird auf `document.fonts.ready` gewartet und neu gerechnet —
 * genommen wird erst das zweite Ergebnis.
 */
export function AtsPdfRunner({ job }: { job: AtsPdfJob }) {
  const theme = useMemo(() => getTheme(job.themeId), [job.themeId]);
  const pairing = useMemo(() => resolvePairing(theme, 'auto'), [theme]);
  const [pass, setPass] = useState(1);
  const done = useRef(false);
  const settle = useRef<number | undefined>(undefined);

  const render = useCallback((M: Metrics, pageBlocks: string[][] | undefined, measure: boolean, asideCap: number) => (
    <ResumeRenderer data={job.data} theme={theme} pairing={pairing} metrics={M} measure={measure} pageBlocks={pageBlocks}
      hiddenSections={job.hiddenSections} sectionOrder={job.sectionOrder} pageFormat={job.pageFormat}
      forcedBreaks={job.forcedBreaks} asideSkillCap={asideCap} />
  ), [job, theme, pairing]);

  const onFit = useCallback((info: FitInfo) => {
    if (done.current) return;
    if (pass === 1) {
      const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
      (fonts ? fonts.ready : Promise.resolve()).then(() => setPass(2));
      return;
    }
    // Ein letzter Bericht kann kurz nach dem ersten kommen (Seitenspalte,
    // Rücknahme der Aufweitung) — den abwarten.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      job.resolve(info);
    }, 300);
  }, [job, pass]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (done.current) return;
      done.current = true;
      job.reject(new Error('timeout'));
    }, MAX_WAIT_MS);
    return () => { window.clearTimeout(t); window.clearTimeout(settle.current); };
  }, [job]);

  return (
    <div aria-hidden data-noprint data-ats-pdf-runner={job.themeId}
      style={{ position: 'fixed', left: '-30000px', top: 0, visibility: 'hidden', pointerEvents: 'none' }}>
      {/* Neuer Schlüssel je Durchgang: frische Messung, und der zweite Bericht
          kommt auch dann, wenn er dem ersten gleicht (DocumentPreview meldet
          ein unverändertes Ergebnis sonst nicht noch einmal). */}
      <DocumentPreview key={pass} render={render} userScale={job.fontScale} pageMode={job.pageMode} pageFormat={job.pageFormat}
        contentKey={`ats|${job.id}`} onFit={onFit} />
    </div>
  );
}
