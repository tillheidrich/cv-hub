/**
 * Sichtbare Seite der Gratis-Grenze (billing/freeTier.ts): ein kleines Schloss
 * an gesperrten Knöpfen und eine ruhige Zeile „Im Bewerbungs-Pass · 9 €
 * einmalig · 90 Tage · kein Abo · Mehr zum Pass". Kein Rot, kein Countdown,
 * kein Sperrbildschirm nach getaner Arbeit — der Hinweis steht da, bevor
 * jemand anfängt.
 */
import { useUiLang } from '../ui/useUiLang';
import { FREETIER_I18N, type FreeTierKey } from '../ui/i18n/freetier';
import { useFreeTier } from './freeTier';

/** Schloss im Strichstil von ui/Icon (1,6 px). */
export function LockGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden data-lock style={{ flexShrink: 0 }}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Hinweiszeile mit Preis und Link auf das Freischalt-Paneel. */
export function PassNote({ feature, label, style }: { feature: FreeTierKey; label?: string; style?: React.CSSProperties }) {
  const ft = useFreeTier();
  const t = FREETIER_I18N[useUiLang()];
  return (
    <p className="ft-note" data-freetier-note={feature} style={style}>
      <LockGlyph />
      <span className="ft-note-text">
        {label && <><strong>{label}</strong>{' · '}</>}
        {ft.priceLine || t.inPass}
      </span>
      <button type="button" className="ft-more" onClick={() => ft.open(feature)}>{t.more}</button>
    </p>
  );
}

/** Ruhige Karte statt des Anschreiben-Formulars, solange es gesperrt ist. */
export function CoverLetterPassCard({ onBack }: { onBack?: () => void }) {
  const ft = useFreeTier();
  const t = FREETIER_I18N[useUiLang()];
  // Äußere Hülle: Kinder von .ui-panel-fill werden auf volle Breite und Höhe
  // gezogen — die Karte selbst soll ihre Ränder behalten.
  return (
    <div>
    <div className="ft-card" data-freetier-card="coverLetter" role="note">
      <p className="ft-card-title"><LockGlyph size={15} />{t.clTitle}</p>
      <p className="ft-card-body">{t.clBody}</p>
      {ft.priceLine && <p className="ft-card-price">{ft.priceLine}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        <button type="button" className="ui-btn ui-btn-accent" onClick={() => ft.open('coverLetter')} style={{ minHeight: '40px' }}>{t.more}</button>
        {onBack && <button type="button" className="ui-btn ui-btn-soft" onClick={onBack} style={{ minHeight: '40px' }}>{t.clKeep}</button>}
      </div>
    </div>
    </div>
  );
}
