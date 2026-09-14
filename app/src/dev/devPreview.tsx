// ── Umbruch-Prüfstand ───────────────────────────────────────────────────────
// Rendert einen Lebenslauf mit Demo-Daten außerhalb der App, damit sich
// Seitenumbrüche und Vorlagen ohne Login/Klickweg prüfen (und automatisiert
// screenshotten) lassen.
//
//   /dev-preview.html?tpl=hamburg&mode=one
//   /dev-preview.html?tpl=berlin&mode=two&len=long
//
// `len=long` verdreifacht die Stichpunkte — so lässt sich gezielt testen, was
// passiert, wenn der Inhalt NICHT auf eine Seite passt.

import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import ResumeRenderer, { type InlineEditApi } from '../templates/ResumeRenderer';
import CoverLetterRenderer from '../templates/CoverLetterRenderer';
import { applyInlineEdit, applyCoverLetterEdit, isCoverLetterPath, insertAfter, removeAt } from '../data/inlineEdit';
import DocumentPreview, { type FitInfo } from '../preview/DocumentPreview';
import { getTheme, resolvePairing, THEMES } from '../templates/theme';
import { contentKeyOf } from '../preview/contentKey';
import { buildResumeHtmlForTest } from '../export/exportHtml';
import { exportTemplateKit } from '../export/exportTemplate';
import { buildDocx, withRasterPhoto, type DocxVariant } from '../export/exportDocx';
import { Packer } from 'docx';
import { getMdTemplate } from '../export/markdownTemplate';
import { demoDE } from '../data/demo-de';
import { DEFAULT_COVER_LETTERS } from '../data/storage';
import { PERSONAS } from './personas';
import type { AccentId, PaperId, CVData, CoverLetterData, PageMode } from '../data/types';
import { FS, type Metrics } from '../templates/metrics';
import '../index.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/lora/600.css';
import '@fontsource/merriweather/700.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/ibm-plex-serif/600.css';
import '@fontsource/libre-baskerville/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/archivo/400.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/caveat/500.css';

const q = new URLSearchParams(location.search);
const tpl = q.get('tpl') || THEMES[0].id;
const mode = (q.get('mode') || 'one') as PageMode;
const len = q.get('len') || 'normal';
const persona = q.get('p') || 'demo';
/** `doc=cl` zeigt das Anschreiben statt des Lebenslaufs. */
const doc = q.get('doc') === 'cl' ? 'cl' : 'cv';
const accent = (q.get('accent') || 'auto') as AccentId;
const paper = (q.get('paper') || 'auto') as PaperId;
/** Nutzerregler für die Schriftgröße — 1 = Normalstellung. */
const userScale = Number(q.get('scale') || '1');
const source: CVData = PERSONAS[persona] ?? demoDE;

function stretch(d: CVData): CVData {
  if (len === 'normal') return d;
  const factor = len === 'long' ? 3 : 2;
  return {
    ...d,
    experience: d.experience.map(e => ({
      ...e,
      bullets: Array.from({ length: e.bullets.length * factor }, (_, i) => e.bullets[i % e.bullets.length]),
    })),
  };
}

function Harness() {
  const [fit, setFit] = useState<FitInfo | null>(null);
  // Der Prüfstand hält die Daten selbst, damit sich das direkte Bearbeiten
  // ohne Anmeldung und ohne Server prüfen lässt.
  const [live, setLive] = useState<CVData>(source);
  const [letter, setLetter] = useState<CoverLetterData>(() => ({ ...DEFAULT_COVER_LETTERS.de }));
  // End-to-End-Prüfung: liefert exakt das HTML, das auch an den PDF-Dienst
  // geht — inklusive der Seitenaufteilung, die die Vorschau berechnet hat.
  (window as unknown as { __exportHtml?: () => string }).__exportHtml = () =>
    buildResumeHtmlForTest(stretch(live), {
      themeId: tpl, accentId: accent, paperId: paper, pairingId: 'auto',
      metrics: fit?.metrics, pageBlocks: fit?.pageBlocks, asideSkillCap: fit?.asideCap,
    });
  (window as unknown as { __mdTemplate?: (k: 'cv' | 'cl', l: 'de' | 'en') => string }).__mdTemplate = getMdTemplate;
  // Vorlagen-Export „ohne Daten": baut das ZIP und stößt den Download an,
  // damit scripts/kitcheck.mjs das echte Paket prüft und nicht eine
  // Nachbildung davon.
  (window as unknown as { __exportKit?: () => Promise<void> }).__exportKit = () =>
    exportTemplateKit({ themeId: tpl, accentId: accent, paperId: paper, pairingId: 'auto' }, 'de', stretch(live));
  // Word-Export im Prüfstand: liefert die fertige Datei als Base64, damit
  // scripts/docxcheck.mjs sie speichern, mit LibreOffice rendern und ansehen
  // kann. Behauptungen über „sieht in Word gut aus" sind sonst nicht prüfbar.
  (window as unknown as { __docx?: (v: DocxVariant) => Promise<string> }).__docx = async (v: DocxVariant) => {
    const blob = await Packer.toBlob(buildDocx(v === 'design' ? await withRasterPhoto(stretch(live)) : stretch(live), tpl, v));
    const buf = await blob.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const theme = getTheme(tpl, accent, paper);
  const pairing = resolvePairing(theme, 'auto');
  const data = stretch(live);
  const focusInline = (path: string | null) => {
    if (!path) return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.querySelector(`.cv-scale-wrapper [data-cv-edit="${path}"]`) as HTMLElement | null;
      if (!el) return;
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(r);
    }));
  };
  const inlineEdit: InlineEditApi = {
    commit: (path, value) => {
      if (isCoverLetterPath(path)) { setLetter(c => applyCoverLetterEdit(c, path, value)); return; }
      setLive(d => applyInlineEdit(d, path, value));
    },
    split: path => { const r = insertAfter(live, path); if (!r) return; setLive(r.data); focusInline(r.focus); },
    remove: path => { const r = removeAt(live, path); if (!r) return; setLive(r.data); focusInline(r.focus); },
  };
  const render = (M: Metrics, pageBlocks: string[][] | undefined, measure: boolean, asideCap: number) => (
    doc === 'cl'
      ? <CoverLetterRenderer cvData={data} clData={letter} theme={theme} pairing={pairing} metrics={M} measure={measure} inlineEdit={measure ? undefined : inlineEdit} />
      : <ResumeRenderer data={data} theme={theme} pairing={pairing} metrics={M} pageBlocks={pageBlocks} measure={measure} asideSkillCap={asideCap} inlineEdit={measure ? undefined : inlineEdit} />
  );
  return (
    <>
      <div className="hud" data-hud>
        {theme.name} · {persona} · {mode} · {len} · {fit ? `${fit.pages}S · c=${fit.condense.toFixed(2)} · ${(FS.body * fit.metrics.t * 0.75).toFixed(1)}pt${fit.overflow ? ' · ÜBERLAUF' : ''}` : '…'}
      </div>
      <div className="harness">
        <DocumentPreview render={render} userScale={userScale} pageMode={mode} onFit={setFit} contentKey={contentKeyOf(doc === 'cl' ? letter : data, doc, tpl, accent)} />
      </div>
    </>
  );
}

createRoot(document.getElementById('dev-root')!).render(<Harness />);
