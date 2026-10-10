import { useMemo, useState } from 'react';
import type { CVData, CoverLetterData, PageMode } from '../data/types';
import { extractExportText, type ExportRenderConfig } from '../export/exportHtml';
import type { FitInfo, EditorTab } from '../preview/DocumentPreview';
import type { AtsLevel } from '../templates/atsScore';
import AtsCheckModal from '../screens/AtsCheckModal';
import KnowledgePanel from '../knowledge/KnowledgePanel';
import { FitSummary } from './DesignPanel';
import AtsLine from './AtsLine';
import type { UiLang } from './i18n';
import { DESIGN_I18N } from './i18n/design';
import { PRUEFEN_I18N, type CheckDoc, type PruefenStrings } from './i18n/pruefen';
import { useFreeTier } from '../billing/freeTier';
import { PassNote } from '../billing/PassLock';
import { SevMark } from '../check/CheckViews';
import { useCoverReport } from '../check/useCoverReport';
import { checkBoth, type Finding } from '../check/coverLetterCheck';
import '../check/check.css';

const DOC_KEY = 'cv-check-doc';
function readDoc(): CheckDoc | null {
  try { const v = localStorage.getItem(DOC_KEY); return v === 'resume' || v === 'cover' || v === 'both' ? v : null; } catch { return null; }
}
function writeDoc(d: CheckDoc) { try { localStorage.setItem(DOC_KEY, d); } catch { /* ohne Speicher weiter */ } }

/**
 * Prüfen: Lebenslauf, Anschreiben oder beides.
 *
 * Lebenslauf: passt die Seite, wie liest ein Portal die Vorlage, Prüfung mit
 * Abgleich gegen eine Stellenanzeige. Anschreiben: Lesbarkeit und
 * Vollständigkeit aus dem exportierten Text (check/), Abgleich, Stilhinweise.
 * Beides: Name, Kontakt, Sprache und Begriffe in beiden Unterlagen.
 *
 * Die Wahl merkt sich der Browser; ohne gespeicherte Wahl folgt sie dem
 * Dokument, das gerade offen ist (`docType`). Auf dem Telefon stehen die
 * Tipps darunter (dort gibt es keine eigene Schiene).
 */
export default function CheckPanel({ uiLang, fit, pageMode, data, coverLetter, exportConfig, atsLevel, onJump, onLoadAts, onLoadAtsPdf, withTips, docType }: {
  uiLang: UiLang; fit: FitInfo | null; pageMode: PageMode; data: CVData; coverLetter?: CoverLetterData;
  exportConfig: ExportRenderConfig; atsLevel: AtsLevel; onJump: (t: EditorTab) => void; onLoadAts: () => void;
  onLoadAtsPdf?: () => void;
  withTips?: boolean;
  /** Welches Dokument im Editor offen ist (App: 'resume' | 'cover-letter'). */
  docType?: string;
}) {
  const d = DESIGN_I18N[uiLang];
  const t = PRUEFEN_I18N[uiLang];
  const ft = useFreeTier();
  const coverOpen = docType === 'cover' || docType === 'cover-letter';
  // Eine bewusste Wahl gilt; ohne sie folgt die Prüfung dem offenen Dokument.
  const [picked, setPicked] = useState<CheckDoc | null>(readDoc);
  const doc: CheckDoc = picked ?? (coverOpen ? 'cover' : 'resume');
  const [modal, setModal] = useState<CheckDoc | null>(null);
  const setDoc = (x: CheckDoc) => { setPicked(x); writeDoc(x); };

  const coverAllowed = ft.coverLetter && !!coverLetter;
  const report = useCoverReport(data, coverLetter, exportConfig, doc !== 'resume' && coverAllowed);
  const bothFindings = useMemo<Finding[]>(() => {
    if (doc !== 'both' || !report || !coverLetter) return [];
    let cvText = '';
    try { cvText = extractExportText(data, exportConfig); } catch { /* leer */ }
    return checkBoth({ cv: data, cl: coverLetter, cvText, clText: report.text });
  }, [doc, report, coverLetter, data, exportConfig]);

  return (
    <div className="ui-panel-body">
      <div className="ui-section" style={{ paddingTop: 4 }}>
        <div className="ui-seg ck-panel-docs" role="radiogroup" aria-label={t.docLabel} data-check-docs>
          {(['resume', 'cover', 'both'] as const).map(x => (
            <button key={x} type="button" role="radio" aria-checked={doc === x} onClick={() => setDoc(x)} data-doc={x}>{t.doc[x]}</button>
          ))}
        </div>
      </div>

      {doc === 'resume' && (
        <>
          <div className="ui-section">
            <h3 className="ui-label">{d.checkPage}</h3>
            <FitSummary fit={fit} pageMode={pageMode} data={data} onJump={onJump} uiLang={uiLang} />
          </div>
          <div className="ui-section">
            <h3 className="ui-label">{d.checkPortals}</h3>
            <AtsLine level={atsLevel} uiLang={uiLang} onLoadAts={onLoadAts} onLoadAtsPdf={onLoadAtsPdf} />
            <OpenButton title={d.checkRead} sub={d.checkReadSub} onClick={() => setModal('resume')} />
          </div>
        </>
      )}

      {doc !== 'resume' && !coverAllowed && (
        <div className="ui-section" data-cover-locked>
          <h3 className="ui-label">{doc === 'cover' ? t.coverHeading : t.bothHeading}</h3>
          <p className="ui-hint" style={{ margin: '0 0 10px' }}>{t.passBody}</p>
          <PassNote feature="coverLetter" label={t.passLabel} />
        </div>
      )}

      {doc === 'cover' && coverAllowed && report && (
        <div className="ui-section" data-cover-summary>
          <h3 className="ui-label">{t.coverHeading}</h3>
          {report.measure === undefined && <p className="ck-measuring" role="status">{t.measuring}</p>}
          <Summary findings={report.findings} t={t} />
          <OpenButton title={t.openCover} sub={t.openCoverSub} onClick={() => setModal('cover')} />
        </div>
      )}

      {doc === 'both' && coverAllowed && report && (
        <div className="ui-section" data-both-summary>
          <h3 className="ui-label">{t.bothHeading}</h3>
          <Summary findings={bothFindings} t={t} />
          <OpenButton title={t.openBoth} sub={t.openBothSub} onClick={() => setModal('both')} />
        </div>
      )}

      {withTips && (
        <div className="ui-section ui-panel-fill" style={{ padding: 0 }}>
          <h3 className="ui-label" style={{ padding: '12px 20px 0' }}>{d.checkTips}</h3>
          <KnowledgePanel data={data} coverLetter={coverLetter} docType={doc === 'cover' ? 'cover' : 'resume'} embedded />
        </div>
      )}
      {modal && <AtsCheckModal data={data} coverLetter={coverLetter} exportConfig={exportConfig} initialDoc={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function OpenButton({ title, sub, onClick }: { title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" className="ui-btn ui-btn-soft ck-open" onClick={onClick}>
      <span>
        <span className="ck-open-title">{title}</span>
        <span className="ck-open-sub">{sub}</span>
      </span>
      <span aria-hidden>→</span>
    </button>
  );
}

/** Kurzfassung: Anzahl offener Punkte und die ersten vier. */
function Summary({ findings, t }: { findings: Finding[]; t: PruefenStrings }) {
  const open = findings.filter(f => f.sev !== 'ok');
  const fehler = open.filter(f => f.sev === 'fehler').length;
  const shown = open.slice(0, 4);
  return (
    <div data-findings>
      <p className="ck-panel-summary">{open.length ? t.summary(fehler, open.length - fehler) : t.noneOpen}</p>
      {shown.length > 0 && (
        <ul className="ck-panel-list">
          {shown.map((f, i) => (
            <li key={f.id + i} data-finding={f.id} data-sev={f.sev}><SevMark sev={f.sev} /><span>{t.finding[f.id](f.args ?? [])}</span></li>
          ))}
        </ul>
      )}
      {open.length > shown.length && <p className="ui-hint" style={{ margin: '4px 0 0' }}>{t.more(open.length - shown.length)}</p>}
    </div>
  );
}
