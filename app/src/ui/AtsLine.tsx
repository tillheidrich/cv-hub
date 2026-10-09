import { atsLabel, atsNote, type AtsLevel } from '../templates/atsScore';
import type { UiLang } from './i18n';
import { DESIGN_I18N } from './i18n/design';
import { FASSUNG_I18N } from './i18n/fassung';
import { FREETIER_I18N } from './i18n/freetier';
import { useFreeTier } from '../billing/freeTier';
import { LockGlyph } from '../billing/PassLock';

/**
 * Der ATS-Hinweis im Moment der Wahl — an der gewählten Vorlage, im Karussell
 * und im Prüfen-Paneel. Vorher stand die Einstufung nur als Marke in der
 * Vorlagenliste, im Moment des Exports nirgends (Gestaltungsbericht, Befund 2).
 *
 * Kein Punktwert, keine Prozentzahl: die Vorsicht aus `atsScore.ts` bleibt.
 * Bei „Für Mail und Druck" und „Für Portale geeignet" stehen die Knöpfe für
 * die einspaltige ATS-Fassung direkt daneben, als PDF und als Word (Runde 3)
 * — bei „Gut für Portale" nicht, dort ist die Vorlage selbst schon die
 * einspaltige Form. Seit 09.10.2026 ohne Warnton: die Marke sagt, wofür eine
 * Vorlage gemacht ist, die Zeile daneben, wie es für Portale weitergeht.
 */
export default function AtsLine({ level, uiLang, onLoadAts, onLoadAtsPdf, compact }: {
  level: AtsLevel; uiLang: UiLang; onLoadAts?: () => void; onLoadAtsPdf?: () => void; compact?: boolean;
}) {
  const d = DESIGN_I18N[uiLang];
  const F = FASSUNG_I18N[uiLang];
  /* Gratis-Grenze: der Word-Knopf trägt ohne Pass das Schloss (der Klick
   * öffnet in App.tsx `loadAts` das Freischalt-Paneel); PDF bleibt frei. */
  const ft = useFreeTier();
  const wordLocked = !ft.docx;
  const btn: React.CSSProperties = { minHeight: '32px', padding: '0 12px', fontSize: 'var(--t-xs)' };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', rowGap: '6px', fontSize: 'var(--t-sm)', color: 'var(--ink-2)', lineHeight: 1.4 }}>
      <span className="ui-badge" data-level={level} title={atsNote(level, uiLang)}>{atsLabel(level, uiLang)}</span>
      {!compact && <span style={{ flex: '1 1 180px', minWidth: 0 }}>{d.atsLine[level]}</span>}
      {onLoadAts && level !== 'high' && (
        onLoadAtsPdf ? (
          <span role="group" aria-label={d.loadAts} style={{ display: 'inline-flex', gap: '4px', flexShrink: 0 }}>
            <button type="button" className="ui-btn ui-btn-accent" onClick={onLoadAtsPdf} title={F.atsPdfAria} style={btn}>{F.atsPdfShort}</button>
            <button type="button" className="ui-btn ui-btn-accent" onClick={onLoadAts} data-locked={wordLocked || undefined}
              title={wordLocked ? `${F.atsWordAria} · ${ft.priceLine}` : F.atsWordAria} style={wordLocked ? { ...btn, gap: '4px' } : btn}>
              {wordLocked && <LockGlyph size={11} />}{F.atsWordShort}
              {wordLocked && <span className="cv-sr-only"> ({FREETIER_I18N[uiLang].inPass})</span>}
            </button>
          </span>
        ) : (
          <button type="button" className="ui-btn ui-btn-accent" onClick={onLoadAts} data-locked={wordLocked || undefined}
            title={wordLocked ? ft.priceLine : undefined} style={wordLocked ? { ...btn, gap: '4px' } : btn}>
            {wordLocked && <LockGlyph size={11} />}{d.loadAts}
            {wordLocked && <span className="cv-sr-only"> ({FREETIER_I18N[uiLang].inPass})</span>}
          </button>
        )
      )}
    </div>
  );
}
