import { useEffect, useState } from 'react';
import { getPageFormat } from '../data/pageFormats';
import type { PageFormat } from '../data/types';

/** Maßstab, ab dem der Text im Dokument ohne Zoom beschreibbar ist.
 *  Darunter ist eine Zeile Fließtext unter sieben Pixel hoch. */
export const LEGIBLE = 0.85;

const MM_TO_PX = 96 / 25.4;

/** Seitenmaße in CSS-Pixeln. */
export function pageSizePx(format: PageFormat | undefined): { w: number; h: number } {
  const f = getPageFormat(format ?? 'a4');
  return { w: f.widthMm * MM_TO_PX, h: f.heightMm * MM_TO_PX };
}

/**
 * Maßstab, mit dem eine Seite in einen Bereich passt — die eine Rechnung für
 * Schreibtisch („Ganze Seite") und Telefon (Breite eingepasst).
 *
 * Bis zum 08.10.2026 stand sie nur in `MobilePreview` und kannte nur die
 * Breite. Am Schreibtisch lief die Vorschau dadurch immer in 100 % — man sah
 * nie eine ganze Seite. Mit `availH` passt sie die Seite auch in die Höhe ein.
 * Nie größer als 1: eine Seite über Originalgröße ist kein „Einpassen".
 */
export function fitScale(availW: number, availH: number | null, format: PageFormat | undefined): number {
  const { w, h } = pageSizePx(format);
  if (availW <= 0) return 1;
  const byW = availW / w;
  const byH = availH && availH > 0 ? availH / h : Infinity;
  return Math.max(0.2, Math.min(1, byW, byH));
}

/** Natürliche (ungeskalierte) Höhe des Dokuments in `root`.
 *
 *  `transform: scale()` verkleinert die Darstellung, nicht die Layout-Maße:
 *  Eine auf 43 % skalierte A4-Seite belegt weiterhin 1123 px. Wer den Kasten
 *  darum nicht auf die skalierte Höhe setzt, lässt den Menschen durch
 *  hunderte Pixel Leerraum scrollen. */
export function useDocHeight(root: React.RefObject<HTMLElement | null>): number {
  const [docH, setDocH] = useState(0);
  useEffect(() => {
    const host = root.current;
    if (!host) return;
    let ro: ResizeObserver | null = null;
    let raf = 0;
    const attach = () => {
      const el = host.querySelector('.cv-scale-wrapper') as HTMLElement | null;
      if (!el) { raf = requestAnimationFrame(attach); return; }
      setDocH(el.offsetHeight);
      ro = new ResizeObserver(() => setDocH(el.offsetHeight));
      ro.observe(el);
    };
    attach();
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [root]);
  return docH;
}

/** Größe eines Elements (Inhaltsbox), laufend nachgeführt. */
export function useBoxSize(ref: React.RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}
