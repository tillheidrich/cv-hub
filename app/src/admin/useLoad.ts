// Laden mit Neuladen für die Seiten des Admin-Bereichs.
import { useCallback, useEffect, useRef, useState } from 'react';

/** `key` bestimmt, wann neu geladen wird (z. B. Zeitraum, Suchbegriff). */
export function useLoad<T>(fn: () => Promise<T>, key = '') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const reload = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await fnRef.current();
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.');
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, [reload, key]);
  return { data, error, loading, reload };
}
