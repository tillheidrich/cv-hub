import { useEffect, useState } from 'react';
import { PICKABLE_THEMES, resolveThemeId } from '../templates/theme';

/** Reihenfolge des Karussells: die der Vorlagenauswahl. */
export function useTemplateNav(current: string) {
  const list = PICKABLE_THEMES;
  const id = resolveThemeId(current);
  const found = list.findIndex(t => t.id === id);
  const idx = found < 0 ? 0 : found;
  const n = list.length;
  return {
    list, idx, n,
    prevId: list[(idx - 1 + n) % n].id,
    nextId: list[(idx + 1) % n].id,
    step: (d: -1 | 1) => list[(idx + d + n) % n].id,
  };
}

/** Wert, der erst nach `ms` Ruhe übernommen wird. */
export function useSettled<T>(value: T, ms = 500): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (v === value) return;
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, v, ms]);
  return v;
}

