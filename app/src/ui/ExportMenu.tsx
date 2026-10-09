import { useCallback, useRef, useState } from 'react';
import type { CVData, CoverLetterData, Lang } from '../data/types';
import { exportHtml, exportCoverLetterHtml, exportPdf, type ExportRenderConfig } from '../export/exportHtml';
import { exportDocx } from '../export/exportDocx';
import { exportMarkdown } from '../export/exportMarkdown';
import { exportJson } from '../export/exportJson';
import { exportJsonResume } from '../export/jsonResume';
import { exportTemplateKit } from '../export/exportTemplate';
import { clToMarkdown } from '../import/markdownBridge';
import { saveText } from '../export/saveFile';
import { exportFilename } from '../export/filename';
import { track } from '../data/track';
import { api, pdfServiceAnswered } from '../data/api';
import { atsPdfTemplateFor } from '../export/atsPdfTemplate';
import { getTheme } from '../templates/theme';
import type { AtsLevel } from '../templates/atsScore';
import { Icon } from './Icon';
import { Menu, MenuItem } from './Overlay';
import type { UiLang } from './i18n';
import { DESIGN_I18N } from './i18n/design';
import { FASSUNG_I18N } from './i18n/fassung';

/**
 * „PDF herunterladen | ▾" — der einzige Primärknopf der Oberfläche.
 *
 * Das Menü gliedert die Ausgaben nach Zweck statt nach Dateiendung
 * (Personas-Bericht, Hürde 10): PDF · Für Bewerbungsportale · Weitere Formate
 * · Für KI und Entwickler. „Word – ATS-Fassung" steht bei den Portalen oben
 * und trägt bei riskanten und mittleren Vorlagen die Marke „empfohlen".
 * Fachbegriffe stehen höchstens klein dahinter.
 */
export default function ExportMenu({ uiLang, data, coverLetter, exportConfig, docType, demoMode, atsLevel, onPrintFallback, onOpenAll, onShare, onAtsPdf, compact }: {
  uiLang: UiLang;
  data: CVData;
  coverLetter?: CoverLetterData;
  exportConfig: ExportRenderConfig;
  docType: 'resume' | 'cover-letter';
  demoMode: boolean;
  atsLevel: AtsLevel;
  onPrintFallback: () => void;
  onOpenAll: () => void;
  onShare: () => void;
  /** ATS-Fassung als PDF — derselbe Inhalt in einer einspaltigen Vorlage
   *  (App.tsx `exportAtsPdf`, export/AtsPdfRunner.tsx). */
  onAtsPdf?: () => Promise<{ pages: number; bytes: number; template: string }>;
  compact?: boolean;
}) {
  const d = DESIGN_I18N[uiLang];
  const F = FASSUNG_I18N[uiLang];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const isCover = docType === 'cover-letter';
  const close = useCallback(() => setOpen(false), []);
  const flash = (text: string, error?: boolean) => {
    setMsg({ text, error });
    window.setTimeout(() => setMsg(null), error ? 9000 : 6000);
  };

  async function pdf() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await exportPdf({ data, cfg: exportConfig, isCover, coverLetter });
      track('export_pdf', { docType: isCover ? 'cover' : 'resume', demo: demoMode });
      flash(d.pdfDone(res.pages, Math.max(1, Math.round(res.bytes / 1024))));
    } catch (err) {
      /* Hat der Dienst geantwortet (413 zu groß, 429 Kontingent, 503
       * ausgelastet), zählt seine Antwort — im Klartext, ohne Druckdialog.
       * Der Rückfall auf den Browserdruck bleibt für den Fall, dass er gar
       * nicht zu erreichen war (data/api.ts, `pdfServiceAnswered`). */
      if (!pdfServiceAnswered(err)) onPrintFallback();
      else flash(d.pdfFailed(err instanceof Error ? err.message : '?'), true);
    } finally {
      setBusy(false);
    }
  }

  async function atsPdf() {
    if (busy || !onAtsPdf) return;
    setBusy(true);
    setMsg({ text: F.atsPdfBusy });
    try {
      const r = await onAtsPdf();
      flash(F.atsPdfDone(r.pages, Math.max(1, Math.round(r.bytes / 1024)), r.template));
    } catch (err) {
      flash(F.atsPdfFailed(err instanceof Error ? err.message : '?'), true);
    } finally {
      setBusy(false);
    }
  }
  /** Word entsteht im Browser — der Server erfährt nur über dieses Ereignis
   *  davon (Auswertung je Einladungscode). Ohne Konto gibt es den Weg nicht. */
  const docxEvent = () => { if (!demoMode) void api.event('docx'); };

  const run = (fn: () => void | Promise<void>) => () => { setOpen(false); void fn(); };
  const recommend = atsLevel !== 'high';

  return (
    <div style={{ position: 'relative' }}>
      <div className="ui-split">
        <button type="button" className="ui-btn ui-btn-primary" onClick={pdf} disabled={busy} aria-busy={busy}
          style={{ minHeight: compact ? '44px' : '40px' }}>
          {busy ? <span className="cv-spin" aria-hidden style={{ marginRight: 0 }} /> : <Icon name="download" size={15} />}
          <span className={compact ? undefined : 'ui-hide-md'}>{busy ? d.pdfBusy : d.pdfDownload}</span>
          {!compact && <span className="cv-sr-only">{d.pdfDownload}</span>}
        </button>
        <button ref={trigger} type="button" className="ui-btn ui-btn-primary" aria-haspopup="menu" aria-expanded={open}
          aria-label={d.pdfMore} onClick={() => setOpen(v => !v)} style={{ minHeight: compact ? '44px' : '40px' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </div>
      <Menu open={open} onClose={close} label={d.pdfMore} triggerRef={trigger} width={340}>
        <div className="ui-menu-label">{d.secPdf}</div>
        <MenuItem onSelect={run(pdf)} icon={<Icon name="download" size={15} />}>{d.pdfDownload}</MenuItem>
        {!isCover && (
          <>
            <div className="ui-menu-label">{d.secPortals}</div>
            <MenuItem onSelect={run(() => { track('export_docx_ats'); docxEvent(); return exportDocx(data, exportConfig, 'ats'); })}
              icon={<Icon name="file-text" size={15} />} sub={d.wordAtsSub}
              tag={recommend ? <span className="ui-tag">{d.recommended}</span> : undefined}>
              {d.wordAts}
            </MenuItem>
            {onAtsPdf && (
              <MenuItem onSelect={run(atsPdf)} icon={<Icon name="download" size={15} />}
                sub={F.atsPdfSub(getTheme(atsPdfTemplateFor(data)).name)}
                tag={recommend ? <span className="ui-tag">{d.recommended}</span> : undefined}>
                {F.atsPdf}
              </MenuItem>
            )}
          </>
        )}
        <div className="ui-menu-label">{d.secMore}</div>
        {isCover ? (
          <>
            <MenuItem onSelect={run(() => { if (coverLetter) exportCoverLetterHtml(data, coverLetter, exportConfig); })} icon={<Icon name="globe" size={15} />}>{d.clHtml}</MenuItem>
            <MenuItem onSelect={run(() => {
              if (!coverLetter) return;
              saveText(exportFilename('anschreiben', data.personal.name, 'md'),
                clToMarkdown(coverLetter, data.labels?.lang ?? 'de', exportConfig.themeId || 'espoo'), 'text/markdown');
            })} icon={<Icon name="markdown" size={15} />}>{d.clMd}</MenuItem>
          </>
        ) : (
          <>
            <MenuItem onSelect={run(() => { track('export_docx'); docxEvent(); return exportDocx(data, exportConfig, 'design'); })} icon={<Icon name="file-text" size={15} />} sub={d.wordDesignSub}>{d.wordDesign}</MenuItem>
            <MenuItem onSelect={run(() => exportHtml(data, exportConfig))} icon={<Icon name="globe" size={15} />} sub={d.htmlSub}>{d.html}</MenuItem>
          </>
        )}
        <MenuItem onSelect={run(onShare)} icon={<Icon name="share" size={15} />} sub={d.shareLinkSub}>{d.shareLink}</MenuItem>
        {!isCover && (
          <>
            <div className="ui-menu-label">{d.secDev}</div>
            <MenuItem onSelect={run(() => exportMarkdown(data))} icon={<Icon name="markdown" size={15} />} sub={d.mdSub}>{d.mdLabel}</MenuItem>
            <MenuItem onSelect={run(() => exportJson(data))} icon={<Icon name="braces" size={15} />} sub={d.jsonSub}>{d.jsonLabel}</MenuItem>
            <MenuItem onSelect={run(() => { track('export_json_resume'); exportJsonResume(data); })} icon={<Icon name="puzzle" size={15} />} sub={d.jsonResumeSub}>{d.jsonResumeLabel}</MenuItem>
            <MenuItem onSelect={run(async () => { track('export_template_kit'); await exportTemplateKit(exportConfig, (data.labels?.lang ?? 'de') as Lang); })} icon={<Icon name="package" size={15} />} sub={d.kitSub}>{d.kitLabel}</MenuItem>
          </>
        )}
        <div className="ui-menu-sep" />
        <MenuItem onSelect={run(onOpenAll)} sub={d.allWaysSub}>{d.allWays}</MenuItem>
      </Menu>
      <div role="status" aria-live="polite" className={msg ? 'ui-pill' : 'cv-sr-only'}
        style={msg ? { position: 'absolute', top: 'calc(100% + 8px)', right: 0, padding: '8px 14px', whiteSpace: 'nowrap', fontSize: 'var(--t-sm)', color: msg.error ? 'var(--ats-low-ink)' : 'var(--ink)', zIndex: 300, maxWidth: '80vw', overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}>
        {msg?.text ?? ''}
      </div>
    </div>
  );
}
