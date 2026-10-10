/**
 * Nur für das Vorrendern (vite.ssr.config.ts ersetzt damit billing/hooks.ts):
 * Im Bau gibt es keinen Server, den useOffer() fragen könnte. Das Angebot,
 * mit dem gerendert wird, setzt scripts/landing-prerender.mjs vorher auf
 * globalThis.__CV_SSR_OFFER__; useMe kennt niemanden, useTitle tut nichts
 * (der Titel steht im vorgerenderten Kopf).
 */
import type { Offer } from '../../billing/api';
import type { AuthUser } from '../../data/api';

const g = globalThis as unknown as { __CV_SSR_OFFER__?: Offer | null };

export function useOffer(): { offer: Offer | null; loaded: boolean } {
  return { offer: g.__CV_SSR_OFFER__ ?? null, loaded: true };
}
export function salesOpen(offer: Offer | null): boolean {
  return !!offer && offer.enabled === true;
}
export function registrationOpen(offer: Offer | null): boolean {
  if (!offer) return false;
  return offer.openRegistration ?? offer.enabled === true;
}
export function useMe(): { user: AuthUser | null; loaded: boolean; refresh: () => Promise<AuthUser | null>; setUser: (u: AuthUser | null) => void } {
  return { user: null, loaded: true, refresh: async () => null, setUser: () => {} };
}
export function useTitle(title: string): void {
  void title;
}
