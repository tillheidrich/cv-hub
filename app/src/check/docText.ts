/**
 * Text und Seitenmaß des Anschreibens, so wie der Export es erzeugt.
 *
 * Der Lebenslauf hat dafür `extractExportText` in export/exportHtml.ts. Fürs
 * Anschreiben gab es nichts, deshalb prüfte der ATS-Dialog bis zum 10.10.2026
 * nur den Lebenslauf. Hier entsteht dasselbe Markup wie in
 * `coverLetterBody()` des Exports (gleicher Renderer, gleiche Vorlage, gleiche
 * Metriken), und `textLikePdf` liest es in der Reihenfolge der PDF-Textebene.
 * Wer den Export ändert, ändert damit auch diese Prüfung: Beide rufen
 * `CoverLetterRenderer` mit denselben Werten auf.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CoverLetterRenderer from '../templates/CoverLetterRenderer';
import { getTheme, resolvePairing } from '../templates/theme';
import { metricsFor } from '../templates/metrics';
import { getPageFormat } from '../data/pageFormats';
import { textLikePdf, type ExportRenderConfig } from '../export/exportHtml';
import type { CVData, CoverLetterData } from '../data/types';

function coverLetterMarkup(cv: CVData, cl: CoverLetterData, cfg: ExportRenderConfig, measure = false): string {
  const theme = getTheme(cfg.themeId, cfg.accentId, cfg.paperId);
  const pairing = resolvePairing(theme, cfg.pairingId);
  return renderToStaticMarkup(createElement(CoverLetterRenderer, {
    cvData: cv, clData: cl, theme, pairing,
    metrics: cfg.metrics ?? metricsFor(0, cfg.density ?? 1),
    pageFormat: cfg.pageFormat, measure,
  }));
}

/** Text des exportierten Anschreibens in Lesereihenfolge des PDF. */
export function coverLetterExportText(cv: CVData, cl: CoverLetterData, cfg: ExportRenderConfig): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${coverLetterMarkup(cv, cl, cfg)}</body></html>`, 'text/html');
  doc.querySelectorAll('style, script').forEach(el => el.remove());
  return textLikePdf(doc);
}

export interface PageMeasure {
  /** Passt der Inhalt auf die eine Seite? */
  fits: boolean;
  /** Wie viel zu viel, in Millimetern (0, wenn es passt). */
  overMm: number;
}

/**
 * Misst, ob das Anschreiben auf seine Seite passt.
 *
 * Die Seite des Anschreibens hat im Export eine feste Höhe und schneidet
 * Überlauf ab (`overflow: hidden` im Renderer). Ein zu langer Text verschwindet
 * im PDF also still am unteren Rand. Gemessen wird im Messmodus des Renderers
 * (Seite so hoch wie ihr Inhalt) in einem unsichtbaren Kasten mit den Schriften
 * der Seite.
 */
export async function measureCoverLetter(cv: CVData, cl: CoverLetterData, cfg: ExportRenderConfig): Promise<PageMeasure | null> {
  if (typeof document === 'undefined') return null;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;contain:layout style;';
  host.innerHTML = coverLetterMarkup(cv, cl, cfg, true);
  document.body.appendChild(host);
  try {
    try { await document.fonts?.ready; } catch { /* ohne Font-API weiter */ }
    const page = host.querySelector('.cv-page') as HTMLElement | null;
    if (!page) return null;
    const fmt = getPageFormat(cfg.pageFormat);
    const pxPerMm = 96 / 25.4;
    const limit = fmt.heightMm * pxPerMm;
    const h = page.getBoundingClientRect().height;
    // 1 px Spielraum für Rundung.
    const over = Math.max(0, h - limit - 1);
    return { fits: over === 0, overMm: Math.round(over / pxPerMm) };
  } finally {
    host.remove();
  }
}

const LANG_WORDS: Record<'de' | 'en' | 'fr' | 'es', string[]> = {
  de: ['und', 'ich', 'die', 'der', 'das', 'nicht', 'mit', 'für', 'ist', 'bei', 'als', 'habe', 'sie', 'auf', 'mich'],
  en: ['and', 'the', 'i', 'to', 'of', 'my', 'with', 'for', 'is', 'have', 'in', 'as', 'at', 'your', 'you'],
  fr: ['et', 'le', 'la', 'les', 'de', 'des', 'je', 'mon', 'ma', 'pour', 'avec', 'est', 'vous', 'votre', 'une'],
  es: ['y', 'el', 'la', 'los', 'las', 'de', 'mi', 'para', 'con', 'es', 'que', 'su', 'en', 'una', 'del'],
};

/** Grobe Spracherkennung über häufige Funktionswörter. `null` bei zu wenig Text. */
export function guessLang(text: string): 'de' | 'en' | 'fr' | 'es' | null {
  const words = text.toLowerCase().split(/[^a-zà-ÿäöüß]+/).filter(Boolean);
  if (words.length < 30) return null;
  let best: 'de' | 'en' | 'fr' | 'es' | null = null;
  let bestScore = 0;
  let second = 0;
  for (const [lang, list] of Object.entries(LANG_WORDS) as ['de' | 'en' | 'fr' | 'es', string[]][]) {
    const set = new Set(list);
    const score = words.filter(w => set.has(w)).length / words.length;
    if (score > bestScore) { second = bestScore; bestScore = score; best = lang; }
    else if (score > second) second = score;
  }
  // Nur eine klare Mehrheit zählt.
  return bestScore >= 0.06 && bestScore > second * 1.5 ? best : null;
}
