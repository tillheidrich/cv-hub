/**
 * Dezentes Einblenden beim Scrollen, ohne Layoutsprung.
 *
 * Grundsatz: Ohne JavaScript (vorgerenderte Seite, Suchmaschine) ist alles
 * sichtbar. Erst im Layout-Effekt, also vor dem ersten Zeichnen, bekommen
 * Elemente UNTERHALB des sichtbaren Bereichs die Klasse `rv-wait` (unsichtbar,
 * 18 px tiefer). Kommen sie ins Bild, wechseln sie zu `rv-in`. Was beim Laden
 * schon zu sehen ist, wird nie versteckt, es blinkt also nichts. Bewegt
 * werden nur opacity und transform (kein CLS). Bei prefers-reduced-motion
 * passiert gar nichts.
 */
import { useLayoutEffect, type RefObject } from 'react';
import { takeOverPrerender } from './boot';

export function useReveal(rootRef: RefObject<HTMLElement | null>, deps: unknown[] = []): void {
  useLayoutEffect(() => {
    // Zuerst das vorgerenderte HTML gegen die App tauschen: Erst danach haben
    // die Elemente echte Maße.
    takeOverPrerender();
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    if (reduce) return;
    const els = [...root.querySelectorAll<HTMLElement>('[data-rv]:not(.rv-in)')];
    const below = window.innerHeight * 0.94;
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('rv-in');
        el.classList.remove('rv-wait');
        io.unobserve(el);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    for (const el of els) {
      if (el.getBoundingClientRect().top > below) {
        el.classList.add('rv-wait');
        io.observe(el);
      }
    }
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
