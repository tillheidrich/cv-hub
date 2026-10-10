import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { atsLabel, atsLevelExplain, type AtsLevel } from '../templates/atsScore';
import type { UiLang } from './i18n';
import { ATS_EXPLAIN_I18N, ATS_EXPLAIN_ARTICLE } from './i18n/ats';
import { Portal } from './Overlay';
import './AtsExplain.css';

/**
 * „Was heißt das?" an einer ATS-Marke.
 *
 * Eine kleine Erklärfläche (nicht modal) direkt an der Marke, auf dem Telefon
 * als Blatt von unten. Bedienung: Klick oder Enter/Leertaste öffnet, der
 * Fokus springt in die Fläche; Escape, „Schließen" oder ein Klick daneben
 * schließt und gibt den Fokus an den Auslöser zurück. Verlässt der Fokus die
 * Fläche mit Tab, schließt sie ebenfalls. Bildschirmleser hören den Auslöser
 * mit Marke („Was heißt „Gut für Portale"?") und die Fläche als Dialog mit
 * Überschrift.
 *
 * Inhalt: was ein ATS ist, warum Spalten manchmal falsch gelesen werden, dass
 * alle Vorlagen eine echte Textebene in Lesereihenfolge haben (belegt durch
 * die Prüfskripte), und welche Fassung man wann nimmt. Texte in
 * ui/i18n/ats.ts (ATS_EXPLAIN_I18N) und templates/atsScore.ts
 * (atsLevelExplain).
 */
export default function AtsExplain({ level, uiLang, compact }: { level: AtsLevel; uiLang: UiLang; compact?: boolean }) {
  const t = ATS_EXPLAIN_I18N[uiLang] ?? ATS_EXPLAIN_I18N.de;
  const label = atsLabel(level, uiLang);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean; sheet: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-t`;

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) window.requestAnimationFrame(() => btn.current?.focus());
  }, []);

  /* Lage berechnen: unter dem Auslöser, sonst darüber; nie aus dem Bild.
   * Unter 560 px Breite als Blatt am unteren Rand. */
  const place = useCallback(() => {
    const b = btn.current?.getBoundingClientRect();
    if (!b) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw < 560) { setPos({ left: 0, top: 0, above: false, sheet: true }); return; }
    const w = Math.min(380, vw - 24);
    const h = box.current?.offsetHeight ?? 360;
    const left = Math.max(12, Math.min(b.left + b.width / 2 - w / 2, vw - w - 12));
    const below = b.bottom + 8;
    const above = below + h > vh - 12 && b.top - 8 - h > 12;
    setPos({ left, top: above ? b.top - 8 - h : Math.min(below, Math.max(12, vh - h - 12)), above, sheet: false });
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);
  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => { place(); box.current?.focus(); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const tg = e.target as Node;
      if (box.current?.contains(tg) || btn.current?.contains(tg)) return;
      close(false);
    };
    const onMove = () => place();
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, place, close]);

  return (
    <>
      <button ref={btn} type="button" className={`ats-x-trigger${compact ? ' is-compact' : ''}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? `${id}-d` : undefined}
        aria-label={t.triggerAria(label)} title={t.triggerAria(label)}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>
        {compact ? <span aria-hidden>?</span> : t.trigger}
      </button>
      {open && (
        <Portal>
          {pos?.sheet && <div className="ats-x-scrim" aria-hidden onClick={() => close()} />}
          <div ref={box} id={`${id}-d`} role="dialog" aria-modal="false" aria-labelledby={titleId} tabIndex={-1}
            className={`ats-x ${pos?.sheet ? 'is-sheet' : 'is-pop'}${pos?.above ? ' is-above' : ''}`}
            style={pos && !pos.sheet ? { left: `${pos.left}px`, top: `${pos.top}px` } : pos ? undefined : { visibility: 'hidden' }}
            onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node) && e.relatedTarget !== btn.current && e.relatedTarget) close(false); }}>
            <div className="ats-x-head">
              <span className="ui-badge" data-level={level}>{label}</span>
              <button type="button" className="ats-x-close" onClick={() => close()} aria-label={t.close} title={t.close}>×</button>
            </div>
            <h2 id={titleId} className="ats-x-title">{t.title(label)}</h2>
            <p className="ats-x-level">{atsLevelExplain(level, uiLang)}</p>
            <h3>{t.whatTitle}</h3>
            <p>{t.what}</p>
            <h3>{t.whyTitle}</h3>
            <p>{t.why}</p>
            <h3>{t.oursTitle}</h3>
            <p>{t.ours}</p>
            <h3>{t.whenTitle}</h3>
            <p>{t.when}</p>
            <p className="ats-x-caveat">{t.caveat}</p>
            <a className="ats-x-more" href={ATS_EXPLAIN_ARTICLE} target="_blank" rel="noopener">{t.more} <span aria-hidden>→</span></a>
          </div>
        </Portal>
      )}
    </>
  );
}
