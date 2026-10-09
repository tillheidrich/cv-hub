import { useState } from 'react';
import type { CVData, CoverLetterData, PageMode } from '../data/types';
import type { ExportRenderConfig } from '../export/exportHtml';
import type { FitInfo, EditorTab } from '../preview/DocumentPreview';
import type { AtsLevel } from '../templates/atsScore';
import AtsCheckModal from '../screens/AtsCheckModal';
import KnowledgePanel from '../knowledge/KnowledgePanel';
import { FitSummary } from './DesignPanel';
import AtsLine from './AtsLine';
import type { UiLang } from './i18n';
import { DESIGN_I18N } from './i18n/design';

/**
 * Prüfen: passt die Seite, wie liest ein Portal die Vorlage, und die
 * ATS-Prüfung mit Abgleich gegen eine Stellenanzeige. Auf dem Telefon stehen
 * die Tipps darunter (dort gibt es keine eigene Schiene).
 */
export default function CheckPanel({ uiLang, fit, pageMode, data, coverLetter, exportConfig, atsLevel, onJump, onLoadAts, withTips }: {
  uiLang: UiLang; fit: FitInfo | null; pageMode: PageMode; data: CVData; coverLetter?: CoverLetterData;
  exportConfig: ExportRenderConfig; atsLevel: AtsLevel; onJump: (t: EditorTab) => void; onLoadAts: () => void;
  withTips?: boolean;
}) {
  const d = DESIGN_I18N[uiLang];
  const [atsOpen, setAtsOpen] = useState(false);
  return (
    <div className="ui-panel-body">
      <div className="ui-section" style={{ paddingTop: 4 }}>
        <h3 className="ui-label">{d.checkPage}</h3>
        <FitSummary fit={fit} pageMode={pageMode} data={data} onJump={onJump} uiLang={uiLang} />
      </div>
      <div className="ui-section">
        <h3 className="ui-label">{d.checkPortals}</h3>
        <AtsLine level={atsLevel} uiLang={uiLang} onLoadAts={onLoadAts} />
        <button type="button" className="ui-btn ui-btn-soft" onClick={() => setAtsOpen(true)}
          style={{ marginTop: '12px', width: '100%', justifyContent: 'space-between', minHeight: '52px', borderRadius: '14px', padding: '8px 14px', textAlign: 'left' }}>
          <span>
            <span style={{ display: 'block', fontWeight: 620 }}>{d.checkRead}</span>
            <span style={{ display: 'block', fontSize: 'var(--t-xs)', color: 'var(--ink-2)', fontWeight: 450, whiteSpace: 'normal' }}>{d.checkReadSub}</span>
          </span>
          <span aria-hidden>→</span>
        </button>
      </div>
      {withTips && (
        <div className="ui-section ui-panel-fill" style={{ padding: 0 }}>
          <h3 className="ui-label" style={{ padding: '12px 20px 0' }}>{d.checkTips}</h3>
          <KnowledgePanel />
        </div>
      )}
      {atsOpen && <AtsCheckModal data={data} coverLetter={coverLetter} exportConfig={exportConfig} onClose={() => setAtsOpen(false)} />}
    </div>
  );
}
