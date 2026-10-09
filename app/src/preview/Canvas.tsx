import { useEffect, useRef, useState } from 'react';
import type { PageFormat } from '../data/types';
import { fitScale, LEGIBLE, pageSizePx, useBoxSize, useDocHeight } from './scale';

export type Zoom = 'fit' | 1 | 1.25;

/**
 * Leinwand am Schreibtisch: die Seite in „Ganze Seite", 100 % oder 125 %.
 *
 * Bis zum 08.10.2026 lief die Vorschau dort immer in 100 % — man sah nie eine
 * ganze Seite, sondern ein Formular und eine unten abgeschnittene Seite.
 *
 * Zum Schreiben wird gezoomt: Wer in „Ganze Seite" in ein Feld klickt, bekommt
 * die Seite in 100 %, das Feld wird mittig eingerollt (dieselbe Regel wie auf
 * dem Telefon, `LEGIBLE`). Escape oder „Ganze Seite" führt zurück; verlässt
 * der Fokus die Leinwand, ebenfalls.
 *
 * Der Maßstab ist reine Darstellung (`transform`). Gemessen und umbrochen wird
 * im ungeskalierten Exemplar in `DocumentPreview` — an Seitenaufteilung und
 * PDF ändert der Zoom nichts.
 */
export default function Canvas({ zoom, onZoomFit, pageFormat, children, neighbours, bottomInset = 0, topInset = 0, swapKey, swapDir, escHint, topHint }: {
  zoom: Zoom;
  /** „Ganze Seite" wurde über Escape angefordert. */
  onZoomFit: () => void;
  pageFormat: PageFormat;
  children: (scale: number) => React.ReactNode;
  /** Nachbarvorlagen links/rechts — nur in „Ganze Seite". */
  neighbours?: (scale: number) => React.ReactNode;
  bottomInset?: number;
  topInset?: number;
  /** Wechselt bei jedem Vorlagenwechsel — stößt den Übergang an. */
  swapKey?: string;
  swapDir?: -1 | 0 | 1;
  escHint: string;
  /** Hinweis oben über der Seite — nur in „Ganze Seite" ohne Schreibzoom;
   *  beim Schreibzoom steht dort der Escape-Hinweis. */
  topHint?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(scrollRef);
  const docH = useDocHeight(scrollRef);
  /* Schreibzoom gilt nur für die Zoomstufe, unter der er entstand — ein
   * expliziter Zoomwechsel beendet ihn damit ohne eigenen Effekt. */
  const [editZoomAt, setEditZoomAt] = useState<Zoom | null>(null);
  const editZoom = editZoomAt !== null && editZoomAt === zoom;
  const PAD_X = 48;
  const fit = fitScale(box.w - PAD_X * 2, box.h - topInset - bottomInset - 32, pageFormat);
  const userScale = zoom === 'fit' ? fit : zoom;
  const scale = zoom === 'fit' && editZoom ? 1 : userScale;
  const page = pageSizePx(pageFormat);

  /* Übergang beim Vorlagenwechsel: nur transform und opacity, über die
   * Web-Animations-Schnittstelle statt über einen neuen Schlüssel — ein neuer
   * Schlüssel hieße, die Vorschau samt Messlauf neu aufzubauen.
   *
   * Bewusst KEIN scale(): Das Messexemplar in DocumentPreview hängt unter
   * diesem Kasten, und eine Transformation macht ihn zum Bezugsrahmen seiner
   * `position: fixed`-Kinder. Eine Verschiebung ändert keine gemessene Höhe,
   * eine Skalierung täte es — mitten in der Umbruchsuche nach dem Wechsel. */
  const stageRef = useRef<HTMLDivElement>(null);
  const lastSwap = useRef(swapKey);
  useEffect(() => {
    if (lastSwap.current === swapKey) return;
    lastSwap.current = swapKey;
    const el = stageRef.current;
    if (!el || !el.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = (swapDir ?? 0) * 28;
    el.animate(
      [{ opacity: 0.35, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
      { duration: 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [swapKey, swapDir]);


  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let leave: number | undefined;
    const onIn = (e: FocusEvent) => {
      const el = (e.target as HTMLElement | null)?.closest('[data-cv-edit]') as HTMLElement | null;
      if (!el) return;
      window.clearTimeout(leave);
      if (zoom === 'fit' && fit < LEGIBLE) setEditZoomAt(zoom);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'center', inline: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }));
    };
    const onOut = () => {
      window.clearTimeout(leave);
      leave = window.setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || !root.contains(a)) setEditZoomAt(null);
      }, 220);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const a = document.activeElement as HTMLElement | null;
      if (a?.closest('[data-cv-edit]')) a.blur();
      setEditZoomAt(null);
      if (zoom !== 'fit') onZoomFit();
    };
    root.addEventListener('focusin', onIn);
    root.addEventListener('focusout', onOut);
    root.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(leave);
      root.removeEventListener('focusin', onIn);
      root.removeEventListener('focusout', onOut);
      root.removeEventListener('keydown', onKey);
    };
  }, [zoom, fit, onZoomFit]);

  const stageW = Math.round(page.w * scale);
  const stageH = docH ? Math.round(docH * scale) : Math.round(page.h * scale);
  const showNeighbours = !!neighbours && scale === userScale && zoom === 'fit';

  return (
    <div
      ref={scrollRef}
      className="ui-canvas-scroll cv-doc-context"
      data-noprint
      data-zoom={zoom === 'fit' ? (editZoom ? 'edit' : 'fit') : String(zoom)}
      style={{
        overflowX: showNeighbours ? 'hidden' : 'auto',
        padding: `${topInset + 16}px ${PAD_X}px ${bottomInset + 16}px`,
      }}
    >
      <div style={{ position: 'relative', width: `${stageW}px`, height: `${stageH}px`, margin: '0 auto', minWidth: stageW }}>
        {showNeighbours && neighbours(scale)}
        <div ref={stageRef}
          style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
          {children(scale)}
        </div>
      </div>
      {/* Hinweise sitzen über der Leinwand (ihr Bezugsrahmen ist .ui-canvas),
          nicht im Bildlauf — sie verdecken beim Schreiben keinen Text. */}
      {editZoom
        ? <div aria-hidden className="ui-write-hint ui-pill" style={{ padding: '6px 14px', fontFamily: 'var(--ui)' }}>{escHint}</div>
        : (zoom === 'fit' ? topHint : null)}
    </div>
  );
}
