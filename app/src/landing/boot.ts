/**
 * Übernahme der vorgerenderten Seite durch die App.
 *
 * Startseite (/, /en/, /fr/, /es/) und /preise kommen als fertiges HTML aus
 * dem Bau (scripts/landing-prerender.mjs): Text, Überschriften, Links und
 * strukturierte Daten stehen im ausgelieferten HTML, auch ohne JavaScript.
 * Das HTML steht in <div id="prerender">, die App rendert daneben in
 * <div id="root" hidden>. Getauscht wird erst, wenn die App etwas Echtes
 * zeigt; der Ladezustand der App („CV-Hub …") bleibt unsichtbar.
 *
 *  - Startseite: LandingScreen tauscht selbst (takeOverPrerender in einem
 *    Layout-Effekt, also vor dem ersten Zeichnen). Sein erster Stand
 *    entspricht dem vorgerenderten HTML, deshalb sieht man den Tausch nicht.
 *  - /preise: getauscht wird, sobald die Seite steht und das Angebot geladen
 *    ist (sonst zeigte sie kurz den Stand ohne Preis).
 *  - alles andere (angemeldet, Demo, Fehler): sobald die App mehr zeigt als
 *    ihren Ladetext.
 *  - spätestens nach 6 Sekunden, damit nie eine tote Seite stehen bleibt.
 *
 * Kein Hydrate: App.tsx zeichnet zuerst einen Ladezustand (Anmeldung wird
 * geprüft), das passt nie zum vorgerenderten HTML.
 */
import { loadOffer } from '../billing/api';

let done = false;

/** Vorgerendertes HTML entfernen und die App zeigen. Mehrfach aufrufbar. */
export function takeOverPrerender(): void {
  if (done || typeof document === 'undefined') return;
  const pre = document.getElementById('prerender');
  const root = document.getElementById('root');
  if (!pre) { done = true; if (root) root.hidden = false; return; }
  done = true;
  pre.remove();
  if (root) root.hidden = false;
}

/** Läuft vor createRoot (main.tsx). */
export function bootPrerender(root: HTMLElement): void {
  const pre = document.getElementById('prerender');
  if (!pre) { root.hidden = false; return; }
  let demo = false;
  try { demo = localStorage.getItem('appstudio-demo-mode') === '1'; } catch { /* ignore */ }
  // Wer in der Demo war, landet im Editor: das vorgerenderte HTML gleich weg.
  if (demo || /[?&]demo=1\b/.test(location.search) || /^\/demo\/?$/.test(location.pathname)) { takeOverPrerender(); return; }

  const kind = pre.getAttribute('data-kind');
  let offerReady = false;
  const offerSettled = loadOffer().then(() => { offerReady = true; }, () => { offerReady = true; });

  /** Zeigt die App mehr als ihren Ladetext bzw. den leeren Suspense-Rahmen? */
  const real = (): boolean => {
    const first = root.firstElementChild as HTMLElement | null;
    if (!first) return false;
    const txt = (root.textContent || '').trim();
    if (!first.firstElementChild && (!txt || /^\S+\s*…$/.test(txt))) return false;
    return true;
  };

  let scheduled = false;
  const check = () => {
    if (done || scheduled) return;
    if (root.querySelector('.lp-root')) return; // LandingScreen tauscht selbst
    if (!real()) return;
    if (kind === 'pricing' && root.querySelector('.bl-hero') && !offerReady) return;
    scheduled = true;
    // Zwei Bilder Zeit, damit React den Stand mit Angebot schreibt.
    requestAnimationFrame(() => requestAnimationFrame(() => { obs.disconnect(); takeOverPrerender(); }));
  };
  const obs = new MutationObserver(check);
  obs.observe(root, { childList: true, subtree: true, characterData: true });
  void offerSettled.then(check);
  window.setTimeout(() => { obs.disconnect(); takeOverPrerender(); }, 6000);
}
