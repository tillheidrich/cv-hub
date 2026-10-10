/**
 * Text, Seitenmaß und Befunde des Anschreibens für Prüfen-Paneel und Dialog.
 * Eigene Datei, damit CheckViews.tsx nur Bausteine der Oberfläche exportiert.
 */
import { useEffect, useMemo, useState } from 'react';
import type { CVData, CoverLetterData } from '../data/types';
import type { ExportRenderConfig } from '../export/exportHtml';
import { coverLetterExportText, measureCoverLetter, type PageMeasure } from './docText';
import { checkCoverLetter, type Finding } from './coverLetterCheck';

export interface CoverReport {
  text: string;
  findings: Finding[];
  /** undefined = wird noch gemessen, null = Messung nicht möglich. */
  measure: PageMeasure | null | undefined;
}

/** Misst verzögert nach (250 ms), damit Tippen im Editor nicht jedes Mal misst.
 *  Die Messung gehört zu genau einem Stand (Schlüssel); ein neuer Stand gilt
 *  als „wird gemessen", bis seine Messung da ist. */
export function useCoverReport(cv: CVData, cl: CoverLetterData | undefined, cfg: ExportRenderConfig | undefined, enabled = true): CoverReport | null {
  const text = useMemo(() => {
    if (!enabled || !cl || !cfg) return '';
    try { return coverLetterExportText(cv, cl, cfg); } catch { return ''; }
  }, [cv, cl, cfg, enabled]);
  const key = useMemo(() => ({ cv, cl, cfg }), [cv, cl, cfg]);
  const [done, setDone] = useState<{ key: object; m: PageMeasure | null } | null>(null);
  useEffect(() => {
    if (!enabled || !key.cl || !key.cfg) return;
    let alive = true;
    const timer = setTimeout(() => {
      measureCoverLetter(key.cv, key.cl!, key.cfg!)
        .then(m => { if (alive) setDone({ key, m }); })
        .catch(() => { if (alive) setDone({ key, m: null }); });
    }, 250);
    return () => { alive = false; clearTimeout(timer); };
  }, [key, enabled]);
  const measure = done && done.key === key ? done.m : undefined;
  return useMemo(() => {
    if (!enabled || !cl || !cfg) return null;
    return { text, measure, findings: checkCoverLetter({ cv, cl, text, measure: measure ?? undefined }) };
  }, [enabled, cv, cl, cfg, text, measure]);
}
