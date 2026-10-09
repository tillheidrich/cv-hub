/**
 * Onboarding nach dem Kauf: lokale Profile ins Konto übernehmen.
 *
 * Was ohne Konto entstanden ist, liegt in IndexedDB dieses Browsers. Hier
 * wählt man aus, was ins Konto soll; übernommen wird über dieselben Wege wie
 * sonst auch (POST /api/photos für Fotos, POST /api/resumes für das Profil).
 * Fotos stehen lokal als data:-URL im Profil und werden vorher hochgeladen,
 * damit das Profil am Server nicht megabyteweise Base64 trägt.
 *
 * Die lokalen Kopien bleiben stehen — gelöscht wird nichts ungefragt.
 */
import { useEffect, useState } from 'react';
import type { UiLang } from '../ui/i18n';
import { BILLING_I18N, fmtDate } from '../ui/i18n/billing';
import { api } from '../data/api';
import { loadProfilesAsync } from '../data/storage';
import type { AppProfile, Lang } from '../data/types';
import { track } from '../data/track';

function newId(): string {
  try {
    const b = new Uint32Array(3); crypto.getRandomValues(b);
    return [...b].map(x => x.toString(36)).join('');
  } catch { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
}

/** data:image/…;base64,… → { mime, base64 } */
function splitDataUrl(u: string): { mime: string; base64: string } | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(u);
  return m ? { mime: m[1], base64: m[2] } : null;
}

/** Fotos eines Profils hochladen und die Adressen ersetzen. Gleiche Fotos
 *  (dieselbe data:-URL in mehreren Sprachfassungen) nur einmal. */
async function uploadProfilePhotos(p: AppProfile, cache = new Map<string, string>()): Promise<AppProfile> {
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

export default function ImportLocal({ lang }: { lang: UiLang }) {
  const t = BILLING_I18N[lang];
  const [local, setLocal] = useState<AppProfile[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<{ i: number; n: number } | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    loadProfilesAsync().then(ps => {
      setLocal(ps);
      setPicked(new Set(ps.map(p => p.id)));
    }, () => setLocal([]));
  }, []);

  if (!local || local.length === 0) return null;

  async function run() {
    if (busy || !local) return;
    const chosen = local.filter(p => picked.has(p.id));
    if (!chosen.length) return;
    setFailed([]); setDone(null);
    let existing = new Set<string>();
    try { existing = new Set((await api.listResumes()).resumes.map(r => r.id)); } catch { /* weiter ohne Abgleich */ }
    const cache = new Map<string, string>();
    let ok = 0; const bad: string[] = [];
    for (let i = 0; i < chosen.length; i++) {
      setBusy({ i: i + 1, n: chosen.length });
      try {
        let p = await uploadProfilePhotos(chosen[i], cache);
        if (existing.has(p.id)) p = { ...p, id: newId() };
        await api.saveResume(p);
        existing.add(p.id);
        ok++;
      } catch { bad.push(chosen[i].displayName); }
    }
    setBusy(null); setDone(ok); setFailed(bad);
    track('import_local_done', { count: ok, failed: bad.length });
  }

  const toggle = (id: string) => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="bl-card" aria-labelledby="bl-im-h" style={{ marginTop: '14px' }} data-import-local>
      <h2 id="bl-im-h" className="bl-h3">{t.imTitle}</h2>
      <p className="bl-hint" style={{ fontSize: 'var(--t-sm)' }}>{t.imBody}</p>
      <ul className="bl-profiles">
        {local.map(p => (
          <li key={p.id}>
            <label className="bl-check">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} disabled={!!busy || done !== null} />
              <span>
                <strong style={{ fontWeight: 600 }}>{p.displayName}</strong>
                {p.createdAt && <span className="bl-hint" style={{ display: 'block', margin: 0 }}>{t.imUpdated(fmtDate(p.createdAt, lang))}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {busy && <p className="bl-hint" role="status">{t.imWorking(busy.i, busy.n)}</p>}
      {done !== null && <p className="bl-ok" role="status" style={{ marginTop: '10px' }}>{t.imDone(done)}</p>}
      {failed.map(f => <p key={f} className="bl-error" role="alert" style={{ marginTop: '8px' }}>{t.imFailed(f)}</p>)}
      {done === null && (
        <div className="bl-actions">
          <button type="button" className="ui-btn ui-btn-primary" onClick={run} disabled={!!busy || picked.size === 0}>{t.imButton(picked.size)}</button>
        </div>
      )}
    </section>
  );
}
