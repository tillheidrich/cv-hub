/**
 * Schmaler Bildschirm — eine Quelle für alle Bereiche.
 *
 * Der Haken lag als lokale Funktion in `App.tsx` und wurde von dort als Prop
 * durchgereicht. Bereiche, die kein Prop bekamen, wussten deshalb nichts von
 * der Bildschirmbreite und behielten ihr Schreibtisch-Maß: Export und Tipps
 * sind als **340 px breite Seitenspalte neben der Vorschau** gebaut. Auf dem
 * Telefon gibt es keine Vorschau daneben — dort standen die 340 px in einem
 * 430 px breiten Fenster, mit Trennlinie und totem Streifen rechts.
 *
 * Die Schwelle (860 px) ist dieselbe wie in `App.tsx`, damit nicht zwei
 * Bauteile bei verschiedenen Breiten umschalten.
 */
import { useEffect, useState } from 'react';

export const MOBILE_MAX = 860;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < MOBILE_MAX);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_MAX);
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);
  return isMobile;
}
