/**
 * Kleinster Router für die öffentlichen Seiten rund um den Pass.
 *
 * Die App hat keinen Router; Startseite und Editor laufen über Zustand in
 * App.tsx. Die neuen Seiten brauchen aber eigene Adressen: Mollie schickt nach
 * der Zahlung auf /kauf/danke zurück, die Bestätigungsmail verlinkt den
 * Widerruf, und AGB und Widerrufsbelehrung müssen direkt aufrufbar sein.
 * Deshalb hier: Pfad lesen, mit pushState wechseln, auf popstate hören.
 */
import { useEffect, useState } from 'react';

export const ROUTE_EVENT = 'cv:route';

export type BillingRoute =
  | { page: 'pricing' }
  | { page: 'checkout' }
  | { page: 'thanks'; orderId: string | null }
  | { page: 'withdraw' }
  | { page: 'cancel' }
  | { page: 'terms' }
  | { page: 'withdrawalPolicy' }
  | { page: 'confirmEmail'; token: string | null }
  | { page: 'imprint' }
  | { page: 'privacy' };

/** Öffentliche Pfade. Gleichlautend in nginx (SPA-Rückfall) — nichts zu tun. */
export const PATHS = {
  pricing: '/preise',
  checkout: '/kauf',
  thanks: '/kauf/danke',
  withdraw: '/widerruf',
  /** Kündigungsschaltfläche nach § 312k BGB („Verträge hier kündigen"). */
  cancel: '/kuendigen',
  terms: '/agb',
  withdrawalPolicy: '/widerrufsbelehrung',
  confirmEmail: '/email-bestaetigen',
  imprint: '/impressum',
  privacy: '/datenschutz',
} as const;

export function matchBillingRoute(pathname: string, search: string): BillingRoute | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(search);
  switch (p) {
    case PATHS.pricing: return { page: 'pricing' };
    case PATHS.checkout: return { page: 'checkout' };
    case PATHS.thanks: return { page: 'thanks', orderId: q.get('order') };
    case PATHS.withdraw: return { page: 'withdraw' };
    case PATHS.cancel: return { page: 'cancel' };
    case PATHS.terms: return { page: 'terms' };
    case PATHS.withdrawalPolicy: return { page: 'withdrawalPolicy' };
    case PATHS.imprint: return { page: 'imprint' };
    case PATHS.privacy: return { page: 'privacy' };
    case PATHS.confirmEmail: return { page: 'confirmEmail', token: q.get('token') };
  }
  // Bestätigungslink auch als Pfad: /email-bestaetigen/<token>
  const m = /^\/email-bestaetigen\/([A-Za-z0-9_-]{8,200})$/.exec(p);
  if (m) return { page: 'confirmEmail', token: m[1] };
  return null;
}

/** Wechselt die Adresse ohne Neuladen. Externe Ziele (Mollie) gehen über
 *  `window.location.assign`, nicht hierüber. */
export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  try {
    if (opts.replace) window.history.replaceState({}, '', path);
    else window.history.pushState({}, '', path);
    window.dispatchEvent(new Event(ROUTE_EVENT));
    window.scrollTo({ top: 0 });
  } catch {
    window.location.assign(path);
  }
}

/** Aktueller Pfad samt Suchteil; ändert sich bei navigate() und Zurück. */
export function useLocation(): { pathname: string; search: string } {
  const read = () => ({ pathname: window.location.pathname, search: window.location.search });
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('popstate', on);
    window.addEventListener(ROUTE_EVENT, on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener(ROUTE_EVENT, on); };
  }, []);
  return loc;
}

/** Klick auf einen internen Link: ohne Neuladen wechseln, aber Strg-/Cmd-Klick
 *  und mittlere Maustaste wie gewohnt in einem neuen Tab öffnen lassen. */
export function linkClick(path: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(path);
  };
}
