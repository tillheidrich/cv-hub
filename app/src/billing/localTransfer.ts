/**
 * Lokale Lebensläufe ins Konto: Fotos vorher hochladen (aus ImportLocal.tsx
 * herausgezogen, 20.10.2026, damit auch die Übernahme nach der Anmeldung in
 * App.tsx sie nutzt). Ohne diesen Schritt trüge das Profil am Server die
 * Fotos als megabyteweise Base64.
 */
import { api } from '../data/api';
import type { AppProfile, Lang } from '../data/types';

/** data:image/…;base64,… → { mime, base64 } */
function splitDataUrl(u: string): { mime: string; base64: string } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(u);
  return m ? { mime: m[1], base64: m[2] } : null;
}

/** Fotos eines Profils hochladen und die Adressen ersetzen. Gleiche Fotos
 *  (dieselbe data:-URL in mehreren Sprachfassungen) nur einmal. */
export async function uploadProfilePhotos(p: AppProfile, cache = new Map<string, string>()): Promise<AppProfile> {
  const copy: AppProfile = JSON.parse(JSON.stringify(p));
  for (const l of Object.keys(copy.data) as Lang[]) {
    const ps = copy.data[l]?.personal;
    if (!ps) continue;
    for (const key of ['photo', 'photoOriginal'] as const) {
      const v = ps[key];
      if (!v || !v.startsWith('data:')) continue;
      let url = cache.get(v);
      if (!url) {
        const parts = splitDataUrl(v);
        if (!parts) { delete ps[key]; continue; }
        url = (await api.uploadPhoto(parts.mime, parts.base64)).url;
        cache.set(v, url);
      }
      ps[key] = url;
    }
  }
  return copy;
}

