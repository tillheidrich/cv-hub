import { useCallback, useEffect, useState } from 'react';
import { api } from '../data/api';
import type { AuthUser } from '../data/api';
import { loadOffer, type Offer } from './api';

/** Angebot vom Server (einmal je Seitenaufruf). `null` = kein Verkauf. */
export function useOffer(): { offer: Offer | null; loaded: boolean } {
  const [state, setState] = useState<{ offer: Offer | null; loaded: boolean }>({ offer: null, loaded: false });
  useEffect(() => {
    let alive = true;
    loadOffer().then(o => { if (alive) setState({ offer: o, loaded: true }); });
    return () => { alive = false; };
  }, []);
  return state;
}

/** Ist Kaufen gerade möglich? */
export function salesOpen(offer: Offer | null): boolean {
  return !!offer && offer.enabled === true;
}
/** Ist offene Registrierung möglich? Fehlt das Feld, folgt sie dem Verkauf. */
export function registrationOpen(offer: Offer | null): boolean {
  if (!offer) return false;
  return offer.openRegistration ?? offer.enabled === true;
}

/** Angemeldeter Nutzer (oder null) mit Plan, wie /api/auth/me ihn liefert. */
export function useMe(): { user: AuthUser | null; loaded: boolean; refresh: () => Promise<AuthUser | null>; setUser: (u: AuthUser | null) => void } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    try { const d = await api.me(); setUser(d.user); return d.user; }
    catch { setUser(null); return null; }
    finally { setLoaded(true); }
  }, []);
  useEffect(() => {
    let alive = true;
    api.me().then(d => { if (alive) setUser(d.user); }, () => { if (alive) setUser(null); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);
  return { user, loaded, refresh, setUser };
}

/** Seitentitel setzen und beim Verlassen zurückstellen. */
export function useTitle(title: string): void {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}
