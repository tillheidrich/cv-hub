import { useEffect, useRef, useState } from 'react';
import type { PageFormat } from '../data/types';
import { fitScale, LEGIBLE, useDocHeight } from './scale';

/**
 * Vorschau auf Telefon und Tablet (aus App.tsx herausgelöst, 08.10.2026).
 *
 * Die Seite steht in der Breite eingepasst („Ganze Seite"). Wer in ein Feld
 * tippt, bekommt das Dokument in voller Größe — sonst schriebe er in sechs
 * Pixel hohe Zeilen. Verlassen wird der Zustand automatisch, sobald kein
 * beschreibbares Feld mehr den Fokus hat, oder über die Schaltfläche.
 *
 * Wischen wechselt die Vorlage — nur in „Ganze Seite", nur bei klar
 * waagerechter Bewegung (Verhältnis über 2:1, mindestens 48 px). Die App
 * zeigt danach „Vorlage gewechselt · Rückgängig".
 */
export default function MobilePreview({ children, doneLabel, hintLabel, pageFormat, onSwipe, bottomInset = 80 }: {
  children: (scale: number) => React.ReactNode;
  doneLabel: string; hintLabel: string;
  pageFormat: PageFormat;
  onSwipe?: (dir: -1 | 1) => void;
  /** Platz unter dem Dokument für schwebende Leisten. */
  bottomInset?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0.45);
  const [zoomed, setZoomed] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    let sichtbar = false;
    let t: number | undefined;
    function update() {
      const el = wrapRef.current;
      if (!el) return;
      const avail = el.clientWidth - 24;
      if (avail > 0) setFit(fitScale(avail, null, pageFormat));
      const jetzt = el.clientWidth > 0 && el.clientHeight > 0;
      if (jetzt && !sichtbar) {
        setHint(true);
        window.clearTimeout(t);
        t = window.setTimeout(() => setHint(false), 4500);
      }
      sichtbar = jetzt;
    }
    update();
    const ro = new ResizeObserver(update);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { window.clearTimeout(t); ro.disconnect(); };
  }, [pageFormat]);

  const scale = zoomed ? 1 : fit;
  const docH = useDocHeight(wrapRef);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    let leaveTimer: number | undefined;
    const onFocusIn = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-cv-edit]') as HTMLElement | null;
      if (!el) return;
      window.clearTimeout(leaveTimer);
      if (fit < LEGIBLE) setZoomed(true);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        /* Waagerecht an die linke Kante des Feldes, nicht in die Mitte: Ein
         * Stichpunkt ist breiter als das Telefon, mittig eingerollt standen
         * links und rechts die Zeilenanfänge abgeschnitten da
         * (Personas-Bericht, „na Brandt"). */
        el.scrollIntoView({ block: 'center', inline: 'start', behavior: 'smooth' });
      }));
    };
    const onFocusOut = () => {
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !a.closest('[data-cv-edit]')) setZoomed(false);
      }, 220);
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    return () => {
      window.clearTimeout(leaveTimer);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
    };
  }, [fit]);

  // Wischen: nur lesen, nie preventDefault — der senkrechte Bildlauf bleibt frei.
  const start = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (zoomed || !onSwipe || e.touches.length !== 1) { start.current = null; return; }
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || zoomed || !onSwipe) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) >= 48 && Math.abs(dx) > 2 * Math.abs(dy)) onSwipe(dx < 0 ? 1 : -1);
  };

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      <div
        ref={wrapRef}
        className="cv-doc-context"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: zoomed ? 'auto' : 'hidden',
          minWidth: 0,
          padding: `12px 12px calc(${bottomInset}px + env(safe-area-inset-bottom, 0px))`,
          WebkitOverflowScrolling: 'touch',
          touchAction: zoomed ? 'pan-x pan-y pinch-zoom' : 'pan-y pinch-zoom',
        }}
      >
        <div style={{
          /* flex-start: sonst streckt der Kasten die Vorschau auf seine eigene
             (skalierte) Höhe, die Messung sieht die gestreckte Höhe, und die
             Rechnung schaukelt sich auf null herunter. */
          display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
          width: zoomed ? 'max-content' : undefined, minWidth: '100%',
          height: scale < 1 && docH ? `${Math.round(docH * scale)}px` : undefined,
          overflow: scale < 1 ? 'hidden' : undefined,
        }}>
          {children(scale)}
        </div>
      </div>

      {zoomed ? (
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            (document.activeElement as HTMLElement | null)?.blur();
            setZoomed(false);
          }}
          style={{
            position: 'absolute', right: '12px',
            bottom: `calc(${bottomInset - 64}px + env(safe-area-inset-bottom, 0px))`,
            zIndex: 320, minHeight: '44px', padding: '0 20px',
          }}
        >{doneLabel}</button>
      ) : (
        <div aria-hidden className="ui" style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '12px', zIndex: 60,
          padding: '6px 14px', borderRadius: '999px', pointerEvents: 'none',
          background: 'oklch(0.21 0.021 264 / 0.78)', color: '#fff',
          fontSize: '12px', fontWeight: 560, whiteSpace: 'nowrap',
          opacity: hint ? 1 : 0, transition: 'opacity 400ms ease',
        }}>{hintLabel}</div>
      )}
    </div>
  );
}
