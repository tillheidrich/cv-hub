import type { AppProfile, CVData, CoverLetterData, Lang } from './types';
import { createDemoProfile, DEFAULT_COVER_LETTERS } from './storage';
import { DEMO_PHOTO, DEMO_PHOTO_ORIGINAL } from './demo-de';
import { demoENLegacy } from './demo-en-legacy';
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

/** Bis 17.11.2026 stand die laufende Stelle der englischen Demo als „today"
 *  im Bestand, seitdem als `present` wie überall sonst. */
function withPresentEnd<T extends { experience?: CVData['experience'] }>(cv: T): T {
  if (!cv.experience?.some(e => e.end === 'today')) return cv;
  return { ...cv, experience: cv.experience.map(e => e.end === 'today' ? { ...e, end: 'present' } : e) };
}

function sig(cv: CVData | undefined): string {
  if (!cv) return '';
  const { labels: _l, ...rest } = withPresentEnd(cv);
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
let legacyEnSig: string | null = null;
let demo: AppProfile | null = null;

/** Englische Demo bis 17.11.2026 (Lena Brandt) — unverändert? */
function isLegacyEn(cv: CVData | undefined): boolean {
  if (legacyEnSig === null) legacyEnSig = sig(demoENLegacy);
  return sig(cv) === legacyEnSig;
}

/** Gibt das Profil aufgefrischt zurück, wenn es eine unveränderte alte Demo
 *  ist — sonst `null` (nichts zu tun). Aufgefrischt wird:
 *   • das Demo-Foto, wo die aktuelle Demo eins trägt (seit 10.10.2026);
 *   • die Kontaktangaben (seit 10.10.2026);
 *   • die englische Fassung: Lena Brandt → Priya Raman (17.11.2026), samt
 *     dem englischen Demo-Anschreiben, wenn dort noch das Muster steht.
 *     Sonst zählte eine alte, nie angefasste Demo als eigene Fassung
 *     (billing/freeTier.ts, isPristineDemo). */
export function upgradeDemoPhoto(p: AppProfile): AppProfile | null {
  if (!p?.data) return null;
  if (!demoSigs || !demo) {
    demo = createDemoProfile('');
    const d = demo;
    demoSigs = { de: sig(d.data.de), en: sig(d.data.en), fr: sig(d.data.fr), es: sig(d.data.es) };
  }
  const sigs = demoSigs, current = demo;
  const legacyEn = isLegacyEn(p.data.en);
  if (!ALL.every(l => sig(p.data[l]) === sigs[l] || (l === 'en' && legacyEn))) return null;
  /* Foto nur dort, wo die aktuelle Demo eins hat: Die englische (Priya) hat bewusst keins. */
  const wantsPhoto = (l: Lang) => !lacksPhoto(current.data[l]);
  if (!legacyEn && !ALL.some(l => (wantsPhoto(l) && lacksPhoto(p.data[l])) || hasLegacyContacts(p.data[l]) || (!!p.data[l] && withPresentEnd(p.data[l]) !== p.data[l]))) return null;
  const data = { ...p.data };
  for (const l of ALL) {
    const cv = data[l] ? withPresentEnd(data[l]) : data[l];
    if (!cv) continue;
    if (l === 'en' && legacyEn) { data.en = { ...current.data.en, labels: cv.labels ?? current.data.en.labels }; continue; }
    const personal = withNewContacts(cv.personal as unknown as Record<string, unknown>) as unknown as CVData['personal'];
    const add = wantsPhoto(l) && lacksPhoto(cv);
    data[l] = { ...cv, personal: { ...personal, photo: add ? DEMO_PHOTO : cv.personal.photo, photoOriginal: add ? DEMO_PHOTO_ORIGINAL : cv.personal.photoOriginal } };
  }
  let coverLetters = p.coverLetters;
  if (legacyEn && coverLetters?.en) {
    const strip = (c: CoverLetterData) => { const { date: _d, ...rest } = c; void _d; return JSON.stringify(rest); };
    if (strip(coverLetters.en) === strip(DEFAULT_COVER_LETTERS.en)) coverLetters = { ...coverLetters, en: { ...current.coverLetters.en } };
  }
  return { ...p, data, coverLetters };
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
