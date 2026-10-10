import type { AppProfile, CVData, Lang } from './types';
import { createDemoProfile } from './storage';
import { DEMO_PHOTO, DEMO_PHOTO_ORIGINAL } from './demo-de';
import { isPlaceholderPhoto } from '../export/photoEmbed';

/**
 * Ältere Demo-Profile bekommen das Demo-Foto nachgereicht.
 *
 * Seit dem 10.10.2026 trägt die Demo „Lena Brandt" ein Foto (demo-de.ts).
 * Wer die Demo vorher geöffnet hat, hat sie im Browser liegen — ohne Foto
 * oder mit der alten Silhouette. Beim nächsten Laden der Demo wird das Foto
 * ergänzt, aber nur, wenn das Profil sonst unverändert die Demo ist. Ein
 * Profil, in dem jemand geschrieben hat, bleibt, wie es ist: Dort könnte das
 * fehlende Foto Absicht sein.
 *
 * Gleichzeitig hält das die Gratis-Grenze richtig (billing/freeTier.ts,
 * `isPristineDemo`): Die vergleicht mit der aktuellen Demo, Foto inklusive.
 * Eine alte Demo ohne Foto zählte sonst als eigene Fassung.
 */
const ALL: Lang[] = ['de', 'en', 'fr', 'es'];

/** Kontaktangaben der Demo bis 10.10.2026. Sie sahen echt aus (Mobilnummer,
 *  Domain, LinkedIn-Profil); seitdem stehen dort erkennbar erfundene Werte
 *  (Rufnummer aus dem Block für fiktive Nutzung, .example-Domain). Alte,
 *  unveränderte Demos bekommen die neuen Werte beim nächsten Laden. */
const LEGACY_CONTACT: Record<'phone' | 'website' | 'linkedin', [string, string]> = {
  phone: ['+49 151 23456789', '+49 30 23125 789'],
  website: ['lenabrandt.design', 'lena-brandt.example'],
  linkedin: ['linkedin.com/in/lena-brandt', 'linkedin.com/in/lena-brandt-beispiel'],
};

function withNewContacts<T extends Record<string, unknown>>(personal: T): T {
  const out: Record<string, unknown> = { ...personal };
  for (const [k, [alt, neu]] of Object.entries(LEGACY_CONTACT)) if (out[k] === alt) out[k] = neu;
  return out as T;
}

function hasLegacyContacts(cv: CVData | undefined): boolean {
  const p = (cv?.personal || {}) as unknown as Record<string, unknown>;
  return Object.entries(LEGACY_CONTACT).some(([k, [alt]]) => p[k] === alt);
}

function sig(cv: CVData | undefined): string {
  if (!cv) return '';
  const { labels: _l, ...rest } = cv;
  void _l;
  const personal = withNewContacts({ ...rest.personal } as unknown as Record<string, unknown>) as unknown as typeof rest.personal;
  delete personal.photo;
  delete personal.photoOriginal;
  return JSON.stringify({ ...rest, personal });
}

function lacksPhoto(cv: CVData | undefined): boolean {
  const ph = (cv?.personal?.photo || '').trim();
  return !ph || isPlaceholderPhoto(ph);
}

let demoSigs: Record<Lang, string> | null = null;

/** Gibt das Profil mit Demo-Foto zurück, wenn es eine unveränderte alte Demo
 *  ohne Foto ist — sonst `null` (nichts zu tun). */
export function upgradeDemoPhoto(p: AppProfile): AppProfile | null {
  if (!p?.data) return null;
  if (!demoSigs) {
    const d = createDemoProfile('');
    demoSigs = { de: sig(d.data.de), en: sig(d.data.en), fr: sig(d.data.fr), es: sig(d.data.es) };
  }
  const sigs = demoSigs;
  if (!ALL.every(l => sig(p.data[l]) === sigs[l])) return null;
  if (!ALL.some(l => lacksPhoto(p.data[l]) || hasLegacyContacts(p.data[l]))) return null;
  const data = { ...p.data };
  for (const l of ALL) {
    const cv = data[l];
    if (!cv) continue;
    const personal = withNewContacts(cv.personal as unknown as Record<string, unknown>) as unknown as CVData['personal'];
    data[l] = { ...cv, personal: { ...personal, photo: lacksPhoto(cv) ? DEMO_PHOTO : cv.personal.photo, photoOriginal: lacksPhoto(cv) ? DEMO_PHOTO_ORIGINAL : cv.personal.photoOriginal } };
  }
  return { ...p, data };
}

/** Für eine ganze Liste: `changed` sagt, ob gespeichert werden muss. */
export function upgradeDemoPhotos(list: AppProfile[]): { profiles: AppProfile[]; changed: boolean } {
  let changed = false;
  const profiles = list.map(p => {
    const u = upgradeDemoPhoto(p);
    if (u) { changed = true; return u; }
    return p;
  });
  return { profiles, changed };
}
