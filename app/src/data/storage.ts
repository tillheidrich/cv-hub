import type { CVData, CoverLetterData, AppProfile, Lang } from './types';
import { demoDE as tillDE } from './demo-de';
import { demoEN as tillEN } from './demo-en';
import { LABELS, ALL_LANGS } from './labels';
import {
  STORE, getAll, getOne, getMeta, setMeta, runTx, clearAll, requestPersistence,
  classifyError, LocalDbError, type LocalDbErrorKind,
} from './localDb';

// ── Legacy keys (v1) — kept for migration only ────────────────────────────────
const LEGACY_CV_KEY = 'appstudio-v1';
const LEGACY_CL_KEY = 'appstudio-cl-v1';

// ── Profile keys (v2) ─────────────────────────────────────────────────────────
const PROFILES_KEY = 'appstudio-profiles-v2';
const ACTIVE_ID_KEY = 'appstudio-active-v2';

// ── Default cover letter content ──────────────────────────────────────────────

export const DEFAULT_COVER_LETTER_DE: CoverLetterData = {
  company: '',
  contactPerson: '',
  companyAddress: '',
  city: 'Hamburg',
  date: new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }),
  subject: 'Bewerbung als ',
  salutation: 'Sehr geehrte Damen und Herren,',
  intro: 'mit großem Interesse habe ich Ihre Stellenausschreibung gelesen und bewerbe mich hiermit um die ausgeschriebene Position.',
  mainBody: 'In meiner bisherigen Laufbahn habe ich umfangreiche Erfahrungen in relevanten Bereichen gesammelt, die mich für diese Rolle qualifizieren. Dabei habe ich gelernt, komplexe Projekte strukturiert anzugehen und nachhaltige Ergebnisse zu erzielen.',
  companyReference: 'Ihr Unternehmen überzeugt mich durch seine klare strategische Ausrichtung und seine Kultur der kontinuierlichen Weiterentwicklung. Ich sehe hier die Möglichkeit, meine Expertise einzubringen und gemeinsam mit Ihrem Team etwas aufzubauen.',
  motivation: 'Die ausgeschriebene Position bietet mir die Gelegenheit, meine Stärken gezielt einzusetzen und weiterzuentwickeln. Ich freue mich darauf, neue Herausforderungen anzunehmen und einen konkreten Beitrag zu leisten.',
  closing: 'Über die Möglichkeit, mich Ihnen persönlich vorzustellen, würde ich mich sehr freuen. Meine vollständigen Bewerbungsunterlagen füge ich bei.',
  signoff: 'Mit freundlichen Grüßen',
};

export const DEFAULT_COVER_LETTER_EN: CoverLetterData = {
  company: '',
  contactPerson: '',
  companyAddress: '',
  city: 'Hamburg',
  date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  subject: 'Application for the position of ',
  salutation: 'Dear Hiring Manager,',
  intro: 'I am writing to express my strong interest in the position you have advertised and to submit my application.',
  mainBody: 'Throughout my career, I have developed extensive experience in relevant areas that make me a strong fit for this role. I have learned to approach complex challenges with structure and deliver lasting results.',
  companyReference: 'Your company stands out to me for its clear strategic vision and culture of continuous growth. I see a great opportunity here to contribute my expertise and build something meaningful alongside your team.',
  motivation: 'This position gives me the opportunity to apply and further develop my core strengths. I look forward to taking on new challenges and making a tangible contribution from day one.',
  closing: 'I would be delighted to present myself in person and discuss how I can contribute to your team. I have attached my full application documents for your review.',
  signoff: 'Kind regards',
};

export const DEFAULT_COVER_LETTER_FR: CoverLetterData = {
  company: '',
  contactPerson: '',
  companyAddress: '',
  city: 'Hamburg',
  date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
  subject: 'Candidature au poste de ',
  salutation: 'Madame, Monsieur,',
  intro: "Actuellement à la recherche de nouvelles opportunités, je me permets de vous soumettre ma candidature pour le poste que vous proposez.",
  mainBody: "Au cours de mon parcours professionnel, j'ai acquis une solide expérience dans des domaines directement liés à cette fonction. J'ai appris à mener des projets complexes avec méthode et à obtenir des résultats durables.",
  companyReference: "Votre entreprise se distingue par sa vision stratégique claire et sa culture du développement continu. J'y vois l'opportunité de mettre mon expertise au service de vos équipes et de bâtir des projets ambitieux à vos côtés.",
  motivation: "Ce poste me permettrait de valoriser et de développer mes compétences. Je serais ravi de relever de nouveaux défis et d'apporter une contribution concrète dès ma prise de fonction.",
  closing: "Je me tiens à votre disposition pour un entretien afin de vous exposer ma motivation plus en détail. Vous trouverez ci-joint mon dossier de candidature complet.",
  signoff: 'Veuillez agréer, Madame, Monsieur, mes salutations distinguées.',
};

export const DEFAULT_COVER_LETTER_ES: CoverLetterData = {
  company: '',
  contactPerson: '',
  companyAddress: '',
  city: 'Hamburg',
  date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
  subject: 'Candidatura para el puesto de ',
  salutation: 'Estimados señores:',
  intro: 'Me dirijo a ustedes con gran interés para presentar mi candidatura al puesto que han publicado.',
  mainBody: 'A lo largo de mi trayectoria profesional he adquirido una amplia experiencia en áreas directamente relacionadas con este puesto. He aprendido a abordar proyectos complejos de forma estructurada y a lograr resultados duraderos.',
  companyReference: 'Su empresa destaca por su clara visión estratégica y su cultura de mejora continua. Veo aquí la oportunidad de aportar mi experiencia y contribuir al crecimiento de su equipo.',
  motivation: 'Este puesto me ofrece la posibilidad de aplicar y seguir desarrollando mis fortalezas. Me entusiasma asumir nuevos retos y aportar valor desde el primer día.',
  closing: 'Quedo a su disposición para una entrevista personal en la que poder exponer mi motivación con mayor detalle. Adjunto mi documentación completa para su consideración.',
  signoff: 'Atentamente,',
};

/** One default cover letter per supported language. */
export const DEFAULT_COVER_LETTERS: Record<Lang, CoverLetterData> = {
  de: DEFAULT_COVER_LETTER_DE,
  en: DEFAULT_COVER_LETTER_EN,
  fr: DEFAULT_COVER_LETTER_FR,
  es: DEFAULT_COVER_LETTER_ES,
};

// ── Standardvorlage ───────────────────────────────────────────────────────────

/** Vorlage für neue Profile und die Demo.
 *
 *  Bis zum 08.10.2026 war das „Hamburg" — eine Seitenspalten-Vorlage, die das
 *  Werkzeug selbst als „ATS-riskant" kennzeichnet, während die Startseite
 *  Portaltauglichkeit verspricht. Espoo ist einspaltig (ATS-stark nach
 *  `templates/atsScore.ts`), hat einen Fotoplatz und eine tabellarische
 *  Datumsspalte. Zürich ist ebenso einspaltig, hat aber keinen Fotoplatz;
 *  Karlsruhe (Zeitstrahl) steht wegen seiner Herkunft unter Vorbehalt.
 *  Bestehende Profile behalten ihre Vorlage — dieser Wert gilt nur, wo keine
 *  gesetzt ist. */
export const DEFAULT_TEMPLATE = 'espoo';

// ── Profile helpers ───────────────────────────────────────────────────────────

/** Profil-ID. Vorher aus `Math.random` — schwach, und über den 409 von
 *  POST /api/resumes ein Existenz-Orakel (Technik-Bericht 08.10.2026). Jetzt
 *  64 Bit aus dem Zufallsgenerator des Browsers, gleiche Zeichenmenge. */
function uid(): string {
  try {
    const b = new Uint32Array(2);
    crypto.getRandomValues(b);
    return b[0].toString(36) + b[1].toString(36) + Date.now().toString(36);
  } catch {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}

/** Deep clone for plain JSON-shaped data (CVData holds only strings/arrays/objects). */
function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/** Clone a CV variant into another language: content is copied verbatim (the
 *  user translates it, or hands the Markdown to an AI), only the label pack is
 *  swapped so section headings render in the target language. */
export function cloneCVForLang(base: CVData, lang: Lang): CVData {
  const c = deepClone(base);
  c.labels = LABELS[lang];
  return c;
}

/** Guarantee a profile carries a CV + cover letter for every supported language.
 *  Older profiles (saved when only DE/EN existed) get FR/ES back-filled by
 *  cloning their primary-language content. Keeps the `Record<Lang, …>`
 *  invariant complete so no render/edit path can hit an undefined variant. */
export function withAllLangs(p: AppProfile): AppProfile {
  const data: Partial<Record<Lang, CVData>> = { ...p.data };
  const coverLetters: Partial<Record<Lang, CoverLetterData>> = { ...p.coverLetters };

  // Pick a source to clone missing variants from: the profile's own language
  // first, then DE, EN, then whatever exists.
  const present = ALL_LANGS.filter(l => data[l]);
  const src: Lang | undefined =
    (data[p.settings.lang] ? p.settings.lang : undefined) ??
    (data.de ? 'de' : undefined) ??
    (data.en ? 'en' : undefined) ??
    present[0];

  for (const l of ALL_LANGS) {
    if (!data[l]) {
      data[l] = cloneCVForLang(src ? data[src]! : tillDE, l);
    } else if (data[l]!.labels?.lang !== l) {
      // Heal a stale/missing label pack so a variant renders in its own language.
      data[l] = { ...data[l]!, labels: LABELS[l] };
    }
    if (!coverLetters[l]) coverLetters[l] = { ...DEFAULT_COVER_LETTERS[l] };
  }

  return {
    ...p,
    data: data as Record<Lang, CVData>,
    coverLetters: coverLetters as Record<Lang, CoverLetterData>,
  };
}

export function createDemoProfile(displayName = 'Lena Brandt (Demo)'): AppProfile {
  return {
    id: uid(),
    displayName,
    createdAt: new Date().toISOString(),
    data: { de: tillDE, en: tillEN, fr: cloneCVForLang(tillDE, 'fr'), es: cloneCVForLang(tillDE, 'es') },
    coverLetters: { ...DEFAULT_COVER_LETTERS },
    settings: { template: DEFAULT_TEMPLATE, fontScale: 1.0, fontPairing: 'auto', pageMode: 'one', lang: 'de' },
  };
}

/** Neues, leeres Profil.
 *
 *  `displayName` ist der Titel des Profils in der Übersicht („Bewerbung
 *  Stadtwerke"), NICHT der Name der Person. Bis zum 08.10.2026 landete er
 *  auch im Namensfeld des Lebenslaufs — wer das nicht bemerkte, verschickte
 *  ein PDF mit „Bewerbung Stadtwerke" als Überschrift. Das Namensfeld bleibt
 *  jetzt leer: Das Formular zeigt dort einen Beispielnamen als Platzhalter,
 *  die Vorschau ein anklickbares „…" (`.cv-edit:empty`) — beides landet in
 *  keinem Export. */
export function createBlankProfile(displayName: string): AppProfile {
  const blankCV = (base: CVData): CVData => ({
    ...base,
    personal: {
      name: '',
      title: '',
      location: '',
      email: '',
      phone: '',
    },
    profile: { text: '' },
    experience: [],
    education: [],
    skillGroups: [],
    languages: [],
    additionalExperience: [],
  });

  return {
    id: uid(),
    displayName,
    createdAt: new Date().toISOString(),
    data: {
      de: blankCV(tillDE),
      en: blankCV(tillEN),
      fr: { ...blankCV(tillDE), labels: LABELS.fr },
      es: { ...blankCV(tillDE), labels: LABELS.es },
    },
    coverLetters: { ...DEFAULT_COVER_LETTERS },
    settings: { template: DEFAULT_TEMPLATE, fontScale: 1.0, fontPairing: 'auto', pageMode: 'one', lang: 'de' },
  };
}

// ── Kontaktdaten in eine neue Sprachfassung übernehmen ───────────────────────

/** Was in jeder Sprache gleich ist: Name, Kontakt, Adressen, Foto. Texte
 *  (Profil, Stationen, Überschriften) werden nicht übernommen — die gehören
 *  übersetzt, nicht kopiert. */
const CONTACT_FIELDS = ['name', 'email', 'phone', 'location', 'website', 'linkedin', 'instagram', 'photo', 'photoOriginal'] as const;

function hasContact(cv: CVData | undefined): boolean {
  const p = cv?.personal;
  if (!p) return false;
  return CONTACT_FIELDS.some(k => !!(p[k] || '').trim()) || !!p.socials?.some(s => s.value.trim());
}

/**
 * Beim ersten Öffnen einer Sprachfassung die Kontaktdaten aus der bisherigen
 * übernehmen.
 *
 * Persona-Test vom 08.10.2026: Wer von Deutsch auf Englisch umschaltet, fand
 * ein leeres Dokument — auch E-Mail und Telefon mussten neu getippt werden.
 * „Erstes Öffnen" heißt hier: Die Zielfassung hat noch gar keine
 * Kontaktangabe. Hat der Mensch dort schon etwas eingetragen, bleibt alles,
 * wie es ist. Gibt `null` zurück, wenn nichts übernommen wurde.
 */
export function carryContactToLang(p: AppProfile, from: Lang, to: Lang): AppProfile | null {
  if (from === to) return null;
  const src = p.data[from];
  const dst = p.data[to];
  if (!src || !dst || !hasContact(src) || hasContact(dst)) return null;
  const personal = { ...dst.personal };
  for (const k of CONTACT_FIELDS) {
    const v = src.personal[k];
    if (v) personal[k] = v;
  }
  if (src.personal.socials?.length) personal.socials = deepClone(src.personal.socials);
  return { ...p, data: { ...p.data, [to]: { ...dst, personal } } };
}

// ── Lokaler Speicher (Lokalmodus) ─────────────────────────────────────────────
//
// Bis zum 08.10.2026 lagen die Profile des Lokalmodus als ein einziger
// JSON-Text in localStorage. Drei Befunde aus dem Technik-Bericht (Abschnitt 4):
//
//   1. localStorage fasst rund 5 MB je Ursprung. Ein Foto samt Original in
//      vier Sprachfassungen sprengt das schnell.
//   2. Ein einziges kaputtes Profil verwarf ALLE (ein `try` um das Ganze).
//   3. `saveProfiles` verschluckte jeden Fehler — die Oberfläche meldete
//      „Gespeichert", obwohl nichts gespeichert war.
//
// Jetzt: IndexedDB (data/localDb.ts), ein Datensatz je Profil, Fotos einmal
// je Inhalt als Binärdaten, ein kleiner Verlauf je Profil. Die alten
// localStorage-Daten werden beim ersten Start übernommen und erst gelöscht,
// wenn die Schreibprobe in IndexedDB gelungen ist.
//
// Die Schnittstelle bleibt für `App.tsx` synchron benutzbar (`loadProfiles`,
// `saveProfiles`): Ein Zwischenspeicher im Arbeitsspeicher wird beim Laden
// des Moduls aus IndexedDB gefüllt, geschrieben wird im Hintergrund. Wer
// wissen will, ob es WIRKLICH auf der Platte liegt, nimmt
// `saveProfilesAsync` oder hört mit `subscribeLocalStore` mit — dort kommt
// jeder Fehler an, sichtbar für `ui/BackupReminder.tsx`.

/** Alle Schlüssel, die der Lokalmodus je in localStorage hatte. */
export const LEGACY_LOCAL_KEYS = [PROFILES_KEY, LEGACY_CV_KEY, LEGACY_CL_KEY] as const;

const META_ORDER = 'order';
const META_LAST_BACKUP = 'lastBackupAt';
const META_SNOOZE = 'reminderSnoozedUntil';
const META_EDITED = 'editedAt';
const META_MIGRATED = 'migratedFromLocalStorageAt';

/** Höchstzahl lokaler Versionen je Profil. */
export const LOCAL_VERSION_LIMIT = 20;
/** Höchstens ein automatischer Stand je Profil in diesem Abstand … */
const VERSION_INTERVAL_MS = 10 * 60 * 1000;
/** … außer bei einer großen Änderung (Import, Ersetzen): dann sofort. */
const LARGE_CHANGE_RATIO = 0.3;

const PHOTO_PREFIX = 'idbphoto:';
/** Ab dieser Länge wird eine data:-URL als Foto ausgelagert. */
const PHOTO_MIN_LEN = 2000;

export type LocalBackend = 'pending' | 'indexeddb' | 'localstorage' | 'memory';

export interface LocalStoreStatus {
  /** Zwischenspeicher gefüllt, Migration erledigt. */
  ready: boolean;
  /** Wo gespeichert wird. `localstorage` nur, wenn IndexedDB nicht geht;
   *  `memory` heißt: Es wird gar nichts dauerhaft gespeichert. */
  backend: LocalBackend;
  profileCount: number;
  /** Letzter erfolgreich abgeschlossener Schreibvorgang. */
  lastSavedAt: string | null;
  /** Letzter Fehler; `null`, sobald wieder ein Schreiben gelingt. */
  lastError: { kind: LocalDbErrorKind; message: string; at: string } | null;
  /** Letzte heruntergeladene Sicherungsdatei. */
  lastBackupAt: string | null;
  /** Letzte inhaltliche Änderung an einem bestehenden Profil. */
  editedAt: string | null;
  /** „Später" beim Sicherungshinweis — bis dahin schweigt er. */
  snoozedUntil: string | null;
  /** Ergebnis von navigator.storage.persist(); `null` = nicht gefragt/unbekannt. */
  persisted: boolean | null;
  /** In dieser Sitzung aus localStorage übernommen. */
  migrated: number;
  /** Datensätze, die nicht lesbar waren und übersprungen wurden. Sie bleiben
   *  liegen, statt gelöscht zu werden. */
  skipped: number;
}

const status: LocalStoreStatus = {
  ready: false, backend: 'pending', profileCount: 0, lastSavedAt: null, lastError: null,
  lastBackupAt: null, editedAt: null, snoozedUntil: null, persisted: null, migrated: 0, skipped: 0,
};
const listeners = new Set<(s: LocalStoreStatus) => void>();
/** Unveränderliche Momentaufnahme — gleiche Identität, solange sich nichts
 *  geändert hat (Voraussetzung für `useSyncExternalStore`). */
let snapshot: LocalStoreStatus = { ...status };

function emit(): void {
  snapshot = { ...status, lastError: status.lastError ? { ...status.lastError } : null };
  for (const l of listeners) { try { l(snapshot); } catch { /* ein Hörer darf die anderen nicht stören */ } }
}

export function getLocalStoreStatus(): LocalStoreStatus {
  return snapshot;
}

/** Soll der Sicherungshinweis erscheinen? Lokale Profile vorhanden, seit der
 *  letzten Sicherung etwas bearbeitet, die Sicherung nie gemacht oder älter
 *  als `remindDays` Tage, und „Später" gilt nicht mehr. */
export function shouldRemindBackup(s: LocalStoreStatus, now = Date.now(), remindDays = 7): boolean {
  if (!s.ready || s.profileCount === 0) return false;
  if (s.snoozedUntil && new Date(s.snoozedUntil).getTime() > now) return false;
  if (!s.editedAt) return false;                                   // nichts bearbeitet, nichts zu verlieren
  if (!s.lastBackupAt) return true;
  const last = new Date(s.lastBackupAt).getTime();
  if (new Date(s.editedAt).getTime() <= last) return false;         // seit der Sicherung unverändert
  return now - last > remindDays * 86400_000;
}

/** Meldet jede Änderung am Speicherzustand (auch Fehler). Gibt die Abmeldung zurück. */
export function subscribeLocalStore(fn: (s: LocalStoreStatus) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function setError(err: unknown): void {
  const e = classifyError(err);
  status.lastError = { kind: e.kind, message: e.message, at: new Date().toISOString() };
  console.error('[lokaler Speicher]', e.kind, e.message);
}

// ── Fotos auslagern ──────────────────────────────────────────────────────────

interface PhotoRecord { key: string; mime?: string; bytes?: ArrayBuffer; text?: string; size: number }

/** Schnelle 53-Bit-Prüfsumme (cyrb53). Kryptografisch ist hier nichts nötig —
 *  sie unterscheidet nur die eigenen Fotos voneinander; die Länge steht mit
 *  im Schlüssel. */
function cyrb53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const photoKeyOf = new Map<string, string>();   // data:-URL → Schlüssel
const photoUrlOf = new Map<string, string>();   // Schlüssel → data:-URL

function isPhotoDataUrl(s: string): boolean {
  return s.length >= PHOTO_MIN_LEN && s.startsWith('data:image/') && s.slice(0, 80).includes(';base64,');
}

function keyForPhoto(s: string): string {
  let k = photoKeyOf.get(s);
  if (!k) {
    k = `${cyrb53(s)}-${s.length.toString(36)}`;
    photoKeyOf.set(s, k);
    photoUrlOf.set(k, s);
  }
  return k;
}

function bytesToBase64(u8: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  }
  return btoa(bin);
}

/** data:-URL → Binärdatensatz. Ist die URL nicht kanonisch codiert (sodass
 *  der Rückweg einen anderen Text ergäbe), bleibt sie als Text — eine
 *  Sicherung soll Zeichen für Zeichen dasselbe zurückgeben. */
function photoRecordFor(key: string, s: string): PhotoRecord {
  try {
    const comma = s.indexOf(',');
    const mime = s.slice(5, comma).split(';')[0] || 'image/jpeg';
    const b64 = s.slice(comma + 1);
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    if (bytesToBase64(u8) === b64) return { key, mime, bytes: u8.buffer, size: u8.length };
  } catch { /* fällt auf Text zurück */ }
  return { key, text: s, size: s.length };
}

function photoUrlFromRecord(r: PhotoRecord): string | null {
  if (typeof r.text === 'string') return r.text;
  if (r.bytes) return `data:${r.mime || 'image/jpeg'};base64,${bytesToBase64(new Uint8Array(r.bytes))}`;
  return null;
}

/** Ersetzt jede große Bild-data:-URL durch einen Verweis. Wirkt auf alle
 *  Felder, nicht nur `photo`/`photoOriginal` — kommt später eine Unterschrift
 *  als Bild dazu, gilt dasselbe. */
function externalize(v: unknown, found: Set<string>): unknown {
  if (typeof v === 'string') {
    if (!isPhotoDataUrl(v)) return v;
    const k = keyForPhoto(v);
    found.add(k);
    return PHOTO_PREFIX + k;
  }
  if (Array.isArray(v)) return v.map(x => externalize(x, found));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = externalize(x, found);
    return out;
  }
  return v;
}

/** Gegenstück: Verweise zurück in data:-URLs. Ein fehlendes Foto wird leer —
 *  lieber kein Bild als ein kaputtes. */
function internalize(v: unknown): unknown {
  if (typeof v === 'string') {
    if (!v.startsWith(PHOTO_PREFIX)) return v;
    return photoUrlOf.get(v.slice(PHOTO_PREFIX.length)) ?? '';
  }
  if (Array.isArray(v)) return v.map(internalize);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = internalize(x);
    return out;
  }
  return v;
}

function refsIn(json: string): string[] {
  const out: string[] = [];
  const re = /"idbphoto:([0-9a-z]+-[0-9a-z]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(json))) out.push(m[1]);
  return out;
}

/** Ist das ein brauchbares Profil? Lieber ein Profil auslassen als die App
 *  an einem halben Datensatz abstürzen lassen. */
function asProfile(raw: unknown): AppProfile | null {
  const p = raw as Partial<AppProfile> | null;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !p.id) return null;
  if (!p.data || typeof p.data !== 'object') return null;
  try {
    const settings = { ...{ template: DEFAULT_TEMPLATE, fontScale: 1.0, fontPairing: 'auto', pageMode: 'one', lang: 'de' }, ...(p.settings || {}) } as AppProfile['settings'];
    return withAllLangs({
      ...(p as AppProfile),
      displayName: typeof p.displayName === 'string' ? p.displayName : '',
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
      coverLetters: (p.coverLetters || {}) as AppProfile['coverLetters'],
      settings,
    });
  } catch {
    return null;
  }
}

// ── Zustand im Arbeitsspeicher ───────────────────────────────────────────────

interface VersionEntry { vid: number; createdAt: string; source: string; refs: string[] }
interface StoredProfile { id: string; json: string; savedAt: string }
interface StoredVersion { vid?: number; profileId: string; createdAt: string; source: string; json: string }

let cache: AppProfile[] = [];
/** Zuletzt geschriebener Stand je Profil (JSON mit Fotoverweisen). */
const lastWritten = new Map<string, string>();
const refsById = new Map<string, string[]>();
const versionIndex = new Map<string, VersionEntry[]>();
const knownPhotoKeys = new Set<string>();
let lastOrder: string[] = [];
/** Hat `loadProfiles` geantwortet, bevor IndexedDB gelesen war? Dann darf das
 *  erste Schreiben nichts löschen, was es nicht kannte. */
let answeredBeforeReady = false;
let persistAsked = false;

// ── localStorage (Altbestand, und Notweg ohne IndexedDB) ─────────────────────

/** Liest die Profile aus localStorage — jedes für sich. Ein kaputtes
 *  verwirft nicht mehr alle. `parsed: false`, wenn der Text gar kein JSON war. */
function readLegacyLocalStorage(): { profiles: AppProfile[]; skipped: number; parsed: boolean; present: boolean } {
  let raw: string | null;
  try { raw = localStorage.getItem(PROFILES_KEY); } catch { return { profiles: [], skipped: 0, parsed: false, present: false }; }
  if (raw) {
    let arr: unknown;
    try { arr = JSON.parse(raw); } catch { return { profiles: [], skipped: 1, parsed: false, present: true }; }
    if (!Array.isArray(arr)) return { profiles: [], skipped: 1, parsed: false, present: true };
    const profiles: AppProfile[] = [];
    let skipped = 0;
    for (const item of arr) {
      const p = asProfile(item);
      if (p) profiles.push(p); else skipped++;
    }
    return { profiles, skipped, parsed: true, present: true };
  }

  // Noch älter: v1 (ein Lebenslauf, DE/EN) in zwei Schlüsseln.
  try {
    const legacyCv = localStorage.getItem(LEGACY_CV_KEY);
    const legacyCl = localStorage.getItem(LEGACY_CL_KEY);
    if (legacyCv) {
      const parsedCv = JSON.parse(legacyCv) as Partial<Record<Lang, Partial<CVData>>>;
      const parsedCl = legacyCl
        ? (JSON.parse(legacyCl) as Partial<Record<Lang, Partial<CoverLetterData>>>)
        : {};
      const migratedName = parsedCv.de?.personal?.name ?? parsedCv.en?.personal?.name ?? 'Mein Profil';
      const profile: AppProfile = {
        id: uid(),
        displayName: migratedName,
        createdAt: new Date().toISOString(),
        // Nur DE/EN kommen aus v1; withAllLangs() ergänzt FR/ES.
        data: {
          de: parsedCv.de ? { ...tillDE, ...parsedCv.de, personal: { ...tillDE.personal, ...parsedCv.de.personal }, labels: tillDE.labels } : tillDE,
          en: parsedCv.en ? { ...tillEN, ...parsedCv.en, personal: { ...tillEN.personal, ...parsedCv.en.personal }, labels: tillEN.labels } : tillEN,
        } as Record<Lang, CVData>,
        coverLetters: {
          de: { ...DEFAULT_COVER_LETTER_DE, ...(parsedCl.de ?? {}) },
          en: { ...DEFAULT_COVER_LETTER_EN, ...(parsedCl.en ?? {}) },
        } as Record<Lang, CoverLetterData>,
        settings: { template: DEFAULT_TEMPLATE, fontScale: 1.0, fontPairing: 'auto', pageMode: 'one', lang: 'de' },
      };
      return { profiles: [withAllLangs(profile)], skipped: 0, parsed: true, present: true };
    }
  } catch {
    return { profiles: [], skipped: 1, parsed: false, present: true };
  }
  return { profiles: [], skipped: 0, parsed: true, present: false };
}

function removeLegacyKeys(): void {
  for (const k of LEGACY_LOCAL_KEYS) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}

// ── Start: IndexedDB öffnen, Altbestand übernehmen, Zwischenspeicher füllen ───

async function loadFromIdb(): Promise<void> {
  const [records, photos, versions, order, lastBackup, snooze, edited] = await Promise.all([
    getAll<StoredProfile>(STORE.profiles),
    getAll<PhotoRecord>(STORE.photos),
    getAll<StoredVersion>(STORE.versions),
    getMeta<string[]>(META_ORDER),
    getMeta<string>(META_LAST_BACKUP),
    getMeta<string>(META_SNOOZE),
    getMeta<string>(META_EDITED),
  ]);
  for (const r of photos) {
    knownPhotoKeys.add(r.key);
    const url = photoUrlFromRecord(r);
    if (url) { photoUrlOf.set(r.key, url); photoKeyOf.set(url, r.key); }
  }
  versionIndex.clear();
  for (const v of versions) {
    if (typeof v.vid !== 'number') continue;
    const list = versionIndex.get(v.profileId) ?? [];
    list.push({ vid: v.vid, createdAt: v.createdAt, source: v.source, refs: refsIn(v.json) });
    versionIndex.set(v.profileId, list);
  }
  for (const list of versionIndex.values()) list.sort((a, b) => a.vid - b.vid);

  const loaded: AppProfile[] = [];
  let skipped = 0;
  for (const r of records) {
    try {
      const p = asProfile(internalize(JSON.parse(r.json)));
      if (!p) { skipped++; continue; }
      loaded.push(p);
      lastWritten.set(r.id, r.json);
      refsById.set(r.id, refsIn(r.json));
    } catch {
      skipped++;   // bleibt in der Datenbank liegen, wird nur nicht angezeigt
    }
  }
  const pos = new Map((order ?? []).map((id, i) => [id, i]));
  loaded.sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || a.createdAt.localeCompare(b.createdAt));
  cache = loaded;
  lastOrder = loaded.map(p => p.id);
  status.skipped += skipped;
  status.lastBackupAt = lastBackup ?? null;
  status.snoozedUntil = snooze ?? null;
  status.editedAt = edited ?? null;
}

async function initLocalStore(): Promise<void> {
  if (typeof window === 'undefined') { status.ready = true; status.backend = 'memory'; return; }
  try {
    await loadFromIdb();
    status.backend = 'indexeddb';
  } catch (err) {
    // Kein IndexedDB (privates Fenster in älteren Browsern, gesperrte
    // Website-Daten): weiter wie bisher mit localStorage — besser als gar nicht.
    setError(err);
    const legacy = readLegacyLocalStorage();
    let lsOk = true;
    try { localStorage.setItem('appstudio-ls-probe', '1'); localStorage.removeItem('appstudio-ls-probe'); } catch { lsOk = false; }
    status.backend = lsOk ? 'localstorage' : 'memory';
    cache = legacy.profiles;
    status.skipped += legacy.skipped;
    status.profileCount = cache.length;
    status.ready = true;
    emit();
    return;
  }

  // Altbestand aus localStorage übernehmen.
  const legacy = readLegacyLocalStorage();
  status.skipped += legacy.skipped;
  if (legacy.present && legacy.profiles.length) {
    const known = new Set(cache.map(p => p.id));
    const neu = legacy.profiles.filter(p => !known.has(p.id));
    const merged = [...cache, ...neu];
    const ok = neu.length === 0 ? true : await persist(merged, { reason: 'migration' });
    // Schreibprobe: Steht jedes übernommene Profil wirklich so in der
    // Datenbank? Erst dann ist der Altbestand entbehrlich.
    let verified = ok;
    if (ok && neu.length) {
      try {
        const back = await getAll<StoredProfile>(STORE.profiles);
        const byId = new Map(back.map(r => [r.id, r.json]));
        verified = neu.every(p => byId.get(p.id) === JSON.stringify(externalize(p, new Set())));
      } catch { verified = false; }
    }
    if (verified) {
      status.migrated = neu.length;
      try { await setMeta(META_MIGRATED, new Date().toISOString()); } catch { /* nur eine Notiz */ }
      if (legacy.parsed) {
        // Nicht lesbare Einträge nicht stillschweigend wegwerfen: Der rohe
        // Altbestand bleibt unter einem eigenen Schlüssel liegen.
        let keep = true;
        if (legacy.skipped > 0) {
          try { localStorage.setItem(PROFILES_KEY + '.unlesbar', localStorage.getItem(PROFILES_KEY) ?? ''); keep = true; }
          catch { keep = false; }   // dann bleibt eben alles, wie es war
        }
        if (keep) removeLegacyKeys();
      }
    }
  } else if (legacy.present && legacy.parsed && !legacy.profiles.length) {
    // Leere Liste aus der alten Fassung: nichts zu übernehmen.
    removeLegacyKeys();
  }
  // Ein nicht lesbarer Altbestand bleibt liegen — vielleicht rettet ihn jemand
  // von Hand. Gelöscht wird nur, was sicher übernommen ist.

  status.profileCount = cache.length;
  status.ready = true;
  if (cache.length) void askPersistence();
  emit();
}

async function askPersistence(): Promise<void> {
  if (persistAsked) return;
  persistAsked = true;
  status.persisted = await requestPersistence();
  emit();
}

let readyPromise: Promise<void> | null = null;

/** Erfüllt sich, sobald der lokale Speicher gelesen ist (startet ihn, falls
 *  nötig). Mehrfach aufrufbar. */
export function whenLocalStoreReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = initLocalStore().catch(err => {
      setError(err);
      status.ready = true;
      status.backend = 'memory';
      emit();
    });
  }
  return readyPromise;
}

/* Gleich beim Laden des Moduls starten — bevor jemand auf „Direkt
 * ausprobieren" klicken kann, ist der Speicher gelesen. Nicht auf den Seiten
 * für Sharelink-Empfänger und Passwort-Reset: Wer einen fremden Lebenslauf
 * ansieht, braucht keinen lokalen Speicher, und sein Browser soll dafür
 * keine Datenbank anlegen. */
if (typeof window !== 'undefined' && !/^\/(share|reset)\//.test(window.location?.pathname || '')) {
  void whenLocalStoreReady();
}

// ── Schreiben ────────────────────────────────────────────────────────────────

interface PersistOpts {
  reason?: 'save' | 'migration' | 'restore' | 'backup';
  /** Für diese Profile vorher einen Stand mit diesem Anlass sichern. */
  forceSnapshot?: Map<string, string>;
}

function isLargeChange(prev: string, next: string): boolean {
  const a = prev.length, b = next.length;
  return Math.abs(a - b) > Math.max(2000, LARGE_CHANGE_RATIO * a);
}

async function persist(list: AppProfile[], opts: PersistOpts = {}): Promise<boolean> {
  if (status.backend === 'memory') {
    status.lastError = status.lastError ?? { kind: 'unavailable', message: 'Kein Speicher im Browser verfügbar', at: new Date().toISOString() };
    emit();
    return false;
  }
  if (status.backend === 'localstorage') {
    try {
      localStorage.setItem(PROFILES_KEY, JSON.stringify(list));
      cache = list;
      status.profileCount = list.length;
      status.lastError = null;
      status.lastSavedAt = new Date().toISOString();
      emit();
      return true;
    } catch (err) {
      setError(err);
      emit();
      return false;
    }
  }

  // ── IndexedDB ──
  const now = new Date();
  const nowIso = now.toISOString();
  const found = new Set<string>();
  const records = list.map(p => {
    const refs = new Set<string>();
    const json = JSON.stringify(externalize(p, refs));
    refs.forEach(r => found.add(r));
    return { id: p.id, json, refs: [...refs] };
  });
  const ids = new Set(list.map(p => p.id));
  const changed = records.filter(r => lastWritten.get(r.id) !== r.json);
  const removed = [...lastWritten.keys()].filter(id => !ids.has(id));
  const order = list.map(p => p.id);
  const orderChanged = order.join('\n') !== lastOrder.join('\n');
  const force = opts.forceSnapshot ?? new Map<string, string>();

  if (!changed.length && !removed.length && !orderChanged && !force.size) {
    cache = list;
    status.profileCount = list.length;
    if (status.lastError) { status.lastError = null; }
    status.lastSavedAt = status.lastSavedAt ?? nowIso;
    emit();
    return true;
  }

  // Verlauf: den bisherigen Stand sichern, wenn es Zeit ist oder sich viel ändert.
  const newVersions: StoredVersion[] = [];
  let edited = false;
  for (const r of changed) {
    const prev = lastWritten.get(r.id);
    if (!prev) continue;
    edited = true;
    const entries = versionIndex.get(r.id) ?? [];
    const last = entries[entries.length - 1];
    const due = !last || now.getTime() - new Date(last.createdAt).getTime() >= VERSION_INTERVAL_MS;
    const forced = force.get(r.id);
    if (forced || due || isLargeChange(prev, r.json)) {
      newVersions.push({ profileId: r.id, createdAt: nowIso, source: forced || (due ? 'auto' : 'auto_large'), json: prev });
    }
  }
  // Erzwungene Stände für Profile, deren Inhalt sich (noch) nicht ändert.
  for (const [id, source] of force) {
    if (newVersions.some(v => v.profileId === id)) continue;
    // Eine Sicherung, die genau den lokalen Stand enthält, braucht keinen Vorher-Stand.
    if (source === 'backup_restore') continue;
    const prev = lastWritten.get(id);
    if (prev) newVersions.push({ profileId: id, createdAt: nowIso, source, json: prev });
  }

  // Welche alten Stände fallen heraus (je Profil höchstens LOCAL_VERSION_LIMIT)?
  const dropVids: number[] = [];
  const keptVersions = new Map<string, VersionEntry[]>();
  for (const [pid, entries] of versionIndex) {
    if (!ids.has(pid)) { dropVids.push(...entries.map(e => e.vid)); continue; }   // Profil gelöscht
    const extra = newVersions.filter(v => v.profileId === pid).length;
    const over = Math.max(0, entries.length + extra - LOCAL_VERSION_LIMIT);
    dropVids.push(...entries.slice(0, over).map(e => e.vid));
    keptVersions.set(pid, entries.slice(over));
  }

  // Welche Fotos braucht noch jemand?
  const needed = new Set<string>(found);
  for (const entries of keptVersions.values()) for (const e of entries) e.refs.forEach(k => needed.add(k));
  for (const v of newVersions) refsIn(v.json).forEach(k => needed.add(k));
  const addPhotos = [...needed].filter(k => !knownPhotoKeys.has(k));
  const dropPhotos = [...knownPhotoKeys].filter(k => !needed.has(k));
  const photoRecs: PhotoRecord[] = [];
  for (const k of addPhotos) {
    const url = photoUrlOf.get(k);
    if (url) photoRecs.push(photoRecordFor(k, url));
  }

  const addedVersionReqs: { req: IDBRequest<IDBValidKey>; v: StoredVersion }[] = [];
  try {
    await runTx([STORE.profiles, STORE.photos, STORE.versions, STORE.meta], 'readwrite', tx => {
      const ps = tx.objectStore(STORE.photos);
      for (const r of photoRecs) ps.put(r);
      const vs = tx.objectStore(STORE.versions);
      for (const v of newVersions) addedVersionReqs.push({ req: vs.add(v), v });
      for (const vid of dropVids) vs.delete(vid);
      const prs = tx.objectStore(STORE.profiles);
      for (const r of changed) prs.put({ id: r.id, json: r.json, savedAt: nowIso } satisfies StoredProfile);
      for (const id of removed) prs.delete(id);
      const meta = tx.objectStore(STORE.meta);
      if (orderChanged) meta.put(order, META_ORDER);
      if (edited) meta.put(nowIso, META_EDITED);
      // Fotos zuletzt löschen: Bricht die Transaktion ab, bleibt alles, wie es war.
      for (const k of dropPhotos) ps.delete(k);
    });
  } catch (err) {
    setError(err);
    emit();
    return false;
  }

  // Erst nach dem Abschluss den Stand im Speicher nachziehen.
  for (const r of changed) { lastWritten.set(r.id, r.json); refsById.set(r.id, r.refs); }
  for (const id of removed) { lastWritten.delete(id); refsById.delete(id); }
  versionIndex.clear();
  for (const [pid, entries] of keptVersions) versionIndex.set(pid, [...entries]);
  for (const { req, v } of addedVersionReqs) {
    const list2 = versionIndex.get(v.profileId) ?? [];
    list2.push({ vid: Number(req.result), createdAt: v.createdAt, source: v.source, refs: refsIn(v.json) });
    versionIndex.set(v.profileId, list2);
  }
  photoRecs.forEach(r => knownPhotoKeys.add(r.key));
  dropPhotos.forEach(k => {
    knownPhotoKeys.delete(k);
    const url = photoUrlOf.get(k);
    photoUrlOf.delete(k);
    if (url) photoKeyOf.delete(url);
  });
  lastOrder = order;
  cache = list;
  status.profileCount = list.length;
  status.lastError = null;
  status.lastSavedAt = nowIso;
  if (edited) status.editedAt = nowIso;
  if (list.length) void askPersistence();
  emit();
  return true;
}

// Schreibvorgänge nacheinander, und von mehreren wartenden nur der letzte:
// Beim Tippen kommt alle 900 ms eine neue Liste, geschrieben werden muss nur
// die jüngste.
let queued: { list: AppProfile[]; opts: PersistOpts; waiters: ((ok: boolean) => void)[] } | null = null;
let draining = false;

function enqueue(list: AppProfile[], opts: PersistOpts = {}): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    if (queued && !opts.forceSnapshot?.size && !queued.opts.forceSnapshot?.size) {
      queued.list = list;
      queued.waiters.push(resolve);
    } else if (queued) {
      // Ein erzwungener Stand darf nicht in einem späteren Schreiben aufgehen.
      const prev = queued;
      queued = { list, opts: { ...opts, forceSnapshot: new Map([...(prev.opts.forceSnapshot ?? []), ...(opts.forceSnapshot ?? [])]) }, waiters: [...prev.waiters, resolve] };
    } else {
      queued = { list, opts, waiters: [resolve] };
    }
    if (!draining) void drain();
  });
}

async function drain(): Promise<void> {
  draining = true;
  try {
    await whenLocalStoreReady();
    while (queued) {
      const job = queued;
      queued = null;
      let list = job.list;
      if (answeredBeforeReady) {
        // Die App hat ihre Liste bekommen, bevor IndexedDB gelesen war. Was
        // sie nicht kannte, bleibt erhalten, statt überschrieben zu werden.
        answeredBeforeReady = false;
        const ids = new Set(list.map(p => p.id));
        list = [...cache.filter(p => !ids.has(p.id)), ...list];
      }
      let ok = false;
      try { ok = await persist(list, job.opts); } catch (err) { setError(err); emit(); }
      job.waiters.forEach(w => w(ok));
    }
  } finally {
    draining = false;
  }
}

// ── Profile CRUD (Schnittstelle für App.tsx) ─────────────────────────────────

/** Profile des Lokalmodus. Synchron aus dem Zwischenspeicher; vor dem Ende
 *  des Starts (kommt praktisch nicht vor) aus dem localStorage-Altbestand. */
export function loadProfiles(): AppProfile[] {
  if (status.ready) return [...cache];
  void whenLocalStoreReady();
  answeredBeforeReady = true;
  return readLegacyLocalStorage().profiles;
}

/** Wie `loadProfiles`, wartet aber, bis der lokale Speicher gelesen ist. */
export async function loadProfilesAsync(): Promise<AppProfile[]> {
  await whenLocalStoreReady();
  return [...cache];
}

/**
 * Speichert die Profile im Browser.
 *
 * Gibt sofort zurück, ob der LETZTE Schreibvorgang gelungen ist — das
 * eigentliche Schreiben läuft im Hintergrund. Scheitert es (Speicher voll,
 * gesperrt), erfahren das alle über `subscribeLocalStore`, und der nächste
 * Aufruf gibt `false` zurück. Wer auf genau dieses Schreiben warten will,
 * nimmt `saveProfilesAsync`.
 */
export function saveProfiles(profiles: AppProfile[]): boolean {
  if (status.ready) { cache = profiles; status.profileCount = profiles.length; }
  void enqueue(profiles);
  return status.backend !== 'memory' && status.lastError === null;
}

/** Speichert und erfüllt sich erst, wenn es wirklich auf der Platte liegt
 *  (`true`) oder gescheitert ist (`false`). */
export function saveProfilesAsync(profiles: AppProfile[]): Promise<boolean> {
  if (status.ready) { cache = profiles; status.profileCount = profiles.length; }
  return enqueue(profiles);
}

/** Wartet, bis alle angestoßenen Schreibvorgänge durch sind. */
export async function flushLocalStore(): Promise<boolean> {
  await whenLocalStoreReady();
  if (!queued && !draining) return status.lastError === null;
  return enqueue(cache);
}

/** Liegt dieses Profil im lokalen Speicher (Lokalmodus)? */
export function isLocalProfile(id: string): boolean {
  return cache.some(p => p.id === id);
}

export function getActiveProfileId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ID_KEY);
  } catch {
    return null;
  }
}

export function setActiveProfileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_ID_KEY, id);
  } catch {
    // ignore
  }
}

export function updateProfileInList(
  profiles: AppProfile[],
  id: string,
  updater: (p: AppProfile) => AppProfile,
): AppProfile[] {
  return profiles.map(p => (p.id === id ? updater(p) : p));
}

export function deleteProfileFromList(profiles: AppProfile[], id: string): AppProfile[] {
  return profiles.filter(p => p.id !== id);
}

/**
 * Alle lokalen Daten löschen: Profile, Fotos, Verlauf, Sicherungsvermerk —
 * in IndexedDB und im localStorage-Altbestand. Für „Abmelden" und
 * „Konto gelöscht" (bisher nur die localStorage-Schlüssel) und für den
 * Knopf „Alle lokalen Daten löschen".
 */
export async function clearLocalStore(): Promise<boolean> {
  await whenLocalStoreReady();
  // Wartende Schreibvorgänge verwerfen, laufende abwarten.
  if (queued) { const q = queued; queued = null; q.waiters.forEach(w => w(false)); }
  while (draining) await new Promise(r => setTimeout(r, 20));
  removeLegacyKeys();
  try { localStorage.removeItem(ACTIVE_ID_KEY); localStorage.removeItem(PROFILES_KEY + '.unlesbar'); } catch { /* ignore */ }
  let ok = true;
  if (status.backend === 'indexeddb') {
    try { await clearAll(); } catch (err) { setError(err); ok = false; }
  }
  cache = [];
  lastWritten.clear(); refsById.clear(); versionIndex.clear(); knownPhotoKeys.clear();
  photoKeyOf.clear(); photoUrlOf.clear();
  lastOrder = [];
  Object.assign(status, { profileCount: 0, lastBackupAt: null, editedAt: null, snoozedUntil: null, lastSavedAt: null });
  if (ok) status.lastError = null;
  emit();
  return ok;
}

// ── Lokaler Verlauf ──────────────────────────────────────────────────────────

/** Form wie die Server-Antwort von /api/resumes/:id/versions, damit
 *  `VersionsPanel` beide Wege gleich anzeigen kann. */
export interface LocalVersionInfo { id: number; source: string; created_at: string }

export async function listLocalVersions(profileId: string): Promise<LocalVersionInfo[]> {
  await whenLocalStoreReady();
  await flushLocalStore();
  return [...(versionIndex.get(profileId) ?? [])]
    .reverse()
    .map(e => ({ id: e.vid, source: e.source, created_at: e.createdAt }));
}

export async function getLocalVersion(profileId: string, vid: number): Promise<{ payload: AppProfile; source: string; created_at: string }> {
  await whenLocalStoreReady();
  const v = await getOne<StoredVersion>(STORE.versions, vid);
  if (!v || v.profileId !== profileId) throw new LocalDbError('unknown', 'Version nicht gefunden');
  const p = asProfile(internalize(JSON.parse(v.json)));
  if (!p) throw new LocalDbError('unknown', 'Version nicht lesbar');
  return { payload: p, source: v.source, created_at: v.createdAt };
}

/** Stellt einen Stand wieder her und speichert ihn. Der aktuelle Stand wird
 *  vorher als Version „restore" gesichert — ein Fehlgriff ist umkehrbar. */
export async function restoreLocalVersion(profileId: string, vid: number): Promise<AppProfile> {
  const { payload } = await getLocalVersion(profileId, vid);
  const restored = withAllLangs({ ...payload, id: profileId });
  const next = cache.some(p => p.id === profileId)
    ? cache.map(p => (p.id === profileId ? restored : p))
    : [...cache, restored];
  const ok = await enqueue(next, { reason: 'restore', forceSnapshot: new Map([[profileId, 'restore']]) });
  if (!ok) throw new LocalDbError(status.lastError?.kind ?? 'unknown', status.lastError?.message ?? 'Speichern fehlgeschlagen');
  return restored;
}

// ── Sicherungsdatei ──────────────────────────────────────────────────────────
//
// Pflicht, nicht Beiwerk: Safari löscht allen per Skript beschreibbaren
// Speicher einer Seite, die sieben Tage lang (Safari-Nutzungstage) nicht
// besucht wurde — IndexedDB eingeschlossen (WebKit-Blog, „Full Third-Party
// Cookie Blocking and More", 2020; Technik-Bericht 08.10.2026). Wer nach
// Wochen für die nächste Bewerbung zurückkommt, findet sonst nichts mehr vor.

export const BACKUP_FORMAT = 'cv-hub-backup';
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  /** Profile mit Fotoverweisen `photo:<schlüssel>`. */
  profiles: unknown[];
  /** Fotos je Schlüssel als data:-URL — jedes nur einmal. */
  photos: Record<string, string>;
  settings: { uiLang?: string; activeId?: string | null; order?: string[] };
}

export interface ParsedBackup {
  createdAt: string;
  profiles: AppProfile[];
  /** Nicht lesbare Profile in der Datei. */
  skipped: number;
  settings: BackupFile['settings'];
}

const BACKUP_PHOTO = 'photo:';

/** Baut die Sicherung aus dem Arbeitsspeicher — sie gelingt also auch dann,
 *  wenn IndexedDB gerade voll oder gesperrt ist. */
export function buildBackup(profiles: AppProfile[] = cache, extra: { uiLang?: string } = {}): BackupFile {
  const photos: Record<string, string> = {};
  const out = profiles.map(p => {
    const refs = new Set<string>();
    const ext = JSON.parse(JSON.stringify(externalize(p, refs))) as unknown;
    refs.forEach(k => { const u = photoUrlOf.get(k); if (u) photos[k] = u; });
    const swap = (v: unknown): unknown => {
      if (typeof v === 'string') return v.startsWith(PHOTO_PREFIX) ? BACKUP_PHOTO + v.slice(PHOTO_PREFIX.length) : v;
      if (Array.isArray(v)) return v.map(swap);
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, swap(x)]));
      return v;
    };
    return swap(ext);
  });
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    profiles: out,
    photos,
    settings: { uiLang: extra.uiLang, activeId: getActiveProfileId(), order: profiles.map(p => p.id) },
  };
}

export function backupFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `lebenslauf-sicherung-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.cv.json`;
}

/** Sicherung als Datei herunterladen und vermerken. */
export async function downloadBackup(extra: { uiLang?: string } = {}): Promise<boolean> {
  try {
    const file = buildBackup(cache, extra);
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (err) {
    console.error('Sicherung fehlgeschlagen:', err);
    return false;
  }
  await markBackupDone();
  return true;
}

export async function markBackupDone(at = new Date()): Promise<void> {
  status.lastBackupAt = at.toISOString();
  status.snoozedUntil = null;
  emit();
  if (status.backend !== 'indexeddb') return;
  try {
    await setMeta(META_LAST_BACKUP, status.lastBackupAt);
    await setMeta(META_SNOOZE, null);
  } catch { /* der Vermerk ist nur eine Erinnerungshilfe */ }
}

/** „Später" beim Sicherungshinweis. */
export async function snoozeBackupReminder(days = 3): Promise<void> {
  status.snoozedUntil = new Date(Date.now() + days * 86400_000).toISOString();
  emit();
  if (status.backend !== 'indexeddb') return;
  try { await setMeta(META_SNOOZE, status.snoozedUntil); } catch { /* ignore */ }
}

export type ParseBackupResult =
  | { ok: true; backup: ParsedBackup }
  | { ok: false; error: 'not_json' | 'wrong_format' | 'newer_version' | 'empty' };

/** Liest eine Sicherungsdatei. Nimmt auch eine nackte Profilliste oder ein
 *  einzelnes Profil (JSON-Export aus dem Export-Bereich). */
export function parseBackup(text: string): ParseBackupResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'not_json' }; }
  let list: unknown[];
  let photos: Record<string, string> = {};
  let createdAt = '';
  let settings: BackupFile['settings'] = {};
  const r = raw as Partial<BackupFile> | null;
  if (r && typeof r === 'object' && !Array.isArray(r) && r.format === BACKUP_FORMAT) {
    if (typeof r.version === 'number' && r.version > BACKUP_VERSION) return { ok: false, error: 'newer_version' };
    list = Array.isArray(r.profiles) ? r.profiles : [];
    photos = r.photos && typeof r.photos === 'object' ? r.photos : {};
    createdAt = typeof r.createdAt === 'string' ? r.createdAt : '';
    settings = r.settings && typeof r.settings === 'object' ? r.settings : {};
  } else if (Array.isArray(raw)) {
    list = raw;
  } else if (r && typeof r === 'object' && 'data' in (r as object) && 'id' in (r as object)) {
    list = [raw];
  } else {
    return { ok: false, error: 'wrong_format' };
  }
  const resolve = (v: unknown): unknown => {
    if (typeof v === 'string') return v.startsWith(BACKUP_PHOTO) ? (photos[v.slice(BACKUP_PHOTO.length)] ?? '') : v;
    if (Array.isArray(v)) return v.map(resolve);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, resolve(x)]));
    return v;
  };
  const profiles: AppProfile[] = [];
  let skipped = 0;
  for (const item of list) {
    const p = asProfile(resolve(item));
    if (p) profiles.push(p); else skipped++;
  }
  if (!profiles.length) return { ok: false, error: skipped ? 'wrong_format' : 'empty' };
  return { ok: true, backup: { createdAt, profiles, skipped, settings } };
}

export interface RestorePreview {
  /** Neu hinzu. */
  added: { id: string; name: string }[];
  /** Gibt es lokal schon — wird überschrieben (vorher als Version gesichert). */
  replaced: { id: string; name: string; same: boolean }[];
  /** Lokal vorhanden, nicht in der Sicherung — bleibt unverändert. */
  kept: { id: string; name: string }[];
}

function nameOf(p: AppProfile): string {
  return p.displayName || p.data?.[p.settings?.lang]?.personal?.name || p.id;
}

export function previewRestore(b: ParsedBackup, current: AppProfile[] = cache): RestorePreview {
  const local = new Map(current.map(p => [p.id, p]));
  const inBackup = new Set(b.profiles.map(p => p.id));
  const canon = (p: AppProfile) => JSON.stringify(externalize(p, new Set()));
  return {
    added: b.profiles.filter(p => !local.has(p.id)).map(p => ({ id: p.id, name: nameOf(p) })),
    replaced: b.profiles.filter(p => local.has(p.id)).map(p => ({ id: p.id, name: nameOf(p), same: canon(p) === canon(local.get(p.id)!) })),
    kept: current.filter(p => !inBackup.has(p.id)).map(p => ({ id: p.id, name: nameOf(p) })),
  };
}

/**
 * Sicherung einspielen: gleiche IDs werden ersetzt (der lokale Stand vorher
 * als Version „backup_restore" gesichert), neue kommen dazu, alle übrigen
 * lokalen Profile bleiben. Gibt die neue Liste zurück.
 */
export async function restoreBackup(b: ParsedBackup): Promise<{ ok: boolean; profiles: AppProfile[] }> {
  await whenLocalStoreReady();
  await flushLocalStore();
  const byId = new Map(b.profiles.map(p => [p.id, p]));
  const force = new Map<string, string>();
  for (const p of cache) if (byId.has(p.id)) force.set(p.id, 'backup_restore');
  const replacedList = cache.map(p => byId.get(p.id) ?? p);
  const known = new Set(cache.map(p => p.id));
  const next = [...replacedList, ...b.profiles.filter(p => !known.has(p.id))];
  // In der Reihenfolge der Sicherung, wo sie eine vorgibt.
  const order = b.settings.order ?? [];
  if (order.length) {
    const pos = new Map(order.map((id, i) => [id, i]));
    next.sort((x, y) => (pos.get(x.id) ?? 1e9) - (pos.get(y.id) ?? 1e9));
  }
  const ok = await enqueue(next, { reason: 'backup', forceSnapshot: force });
  if (ok && b.settings.activeId && next.some(p => p.id === b.settings.activeId)) setActiveProfileId(b.settings.activeId);
  return { ok, profiles: ok ? [...cache] : next };
}

// ── Legacy helpers (kept for import compatibility) ────────────────────────────

export function loadData(): Record<Lang, CVData> {
  const fallback = (): Record<Lang, CVData> => ({
    de: tillDE, en: tillEN, fr: cloneCVForLang(tillDE, 'fr'), es: cloneCVForLang(tillDE, 'es'),
  });
  try {
    const raw = localStorage.getItem(LEGACY_CV_KEY);
    if (!raw) return fallback();
    const parsed = JSON.parse(raw) as Partial<Record<Lang, Partial<CVData>>>;
    const base = fallback();
    return {
      ...base,
      de: parsed.de ? { ...tillDE, ...parsed.de, personal: { ...tillDE.personal, ...parsed.de.personal }, labels: tillDE.labels } : tillDE,
      en: parsed.en ? { ...tillEN, ...parsed.en, personal: { ...tillEN.personal, ...parsed.en.personal }, labels: tillEN.labels } : tillEN,
    };
  } catch {
    return fallback();
  }
}

export function saveData(data: Record<Lang, CVData>): void {
  try {
    localStorage.setItem(LEGACY_CV_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function resetData(): Record<Lang, CVData> {
  try {
    localStorage.removeItem(LEGACY_CV_KEY);
  } catch {
    // ignore
  }
  return { de: tillDE, en: tillEN, fr: cloneCVForLang(tillDE, 'fr'), es: cloneCVForLang(tillDE, 'es') };
}

export function loadCoverLetters(): Record<Lang, CoverLetterData> {
  try {
    const raw = localStorage.getItem(LEGACY_CL_KEY);
    if (!raw) return { ...DEFAULT_COVER_LETTERS };
    const parsed = JSON.parse(raw) as Partial<Record<Lang, Partial<CoverLetterData>>>;
    const out = { ...DEFAULT_COVER_LETTERS };
    for (const l of ALL_LANGS) {
      if (parsed[l]) out[l] = { ...DEFAULT_COVER_LETTERS[l], ...parsed[l] };
    }
    return out;
  } catch {
    return { ...DEFAULT_COVER_LETTERS };
  }
}

export function saveCoverLetters(data: Record<Lang, CoverLetterData>): void {
  try {
    localStorage.setItem(LEGACY_CL_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
