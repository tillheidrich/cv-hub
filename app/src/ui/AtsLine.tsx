import { atsLabel, atsNote, type AtsLevel } from '../templates/atsScore';
import type { UiLang } from './i18n';
import { DESIGN_I18N } from './i18n/design';
import { FASSUNG_I18N } from './i18n/fassung';

/**
 * Der ATS-Hinweis im Moment der Wahl — an der gewählten Vorlage, im Karussell
 * und im Prüfen-Paneel. Vorher stand die Einstufung nur als Marke in der
 * Vorlagenliste, im Moment des Exports nirgends (Gestaltungsbericht, Befund 2).
 *
 * Kein Punktwert, keine Prozentzahl: die Vorsicht aus `atsScore.ts` bleibt.
 * Bei „riskant" und „okay" gibt es die einspaltige ATS-Fassung auf einen
 * Klick, als Word und als PDF (Runde 3) — bei „stark" nicht, dort ist die
 * Vorlage selbst schon die sichere Form.
 */
export default function AtsLine({ level, uiLang, onLoadAts, onLoadAtsPdf, compact }: {
  level: AtsLevel; uiLang: UiLang; onLoadAts?: () => void; onLoadAtsPdf?: () => void; compact?: boolean;
}) {
  const d = DESIGN_I18N[uiLang];
  const F = FASSUNG_I18N[uiLang];
  const btn: React.CSSProperties = { minHeight: '32px', padding: '0 12px', fontSize: 'var(--t-xs)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', rowGap: '6px', fontSize: 'var(--t-sm)', color: 'var(--ink-2)', lineHeight: 1.4 }}>
      <span className="ui-badge" data-level={level} title={atsNote(level, uiLang)}>{atsLabel(level, uiLang)}</span>
      {!compact && <span style={{ flex: '1 1 180px', minWidth: 0 }}>{d.atsLine[level]}</span>}
      {onLoadAts && level !== 'high' && (
        onLoadAtsPdf ? (
          <span role="group" aria-label={d.loadAts} style={{ display: 'inline-flex', gap: '4px', flexShrink: 0 }}>
            <button type="button" className="ui-btn ui-btn-accent" onClick={onLoadAts} title={F.atsWordAria} style={btn}>{F.atsWordShort}</button>
            <button type="button" className="ui-btn ui-btn-accent" onClick={onLoadAtsPdf} title={F.atsPdfAria} style={btn}>{F.atsPdfShort}</button>
          </span>
        ) : (
          <button type="button" className="ui-btn ui-btn-accent" onClick={onLoadAts} style={btn}>
            {d.loadAts}
          </button>
        )
      )}
    </div>
  );
}
