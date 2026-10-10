/**
 * Gratis-Grenze (09.10.2026, optional, standardmäßig aus).
 *
 * „Ein PDF bleibt gratis, Word, Anschreiben, weitere Fassungen und Sprachen
 * kommen in den Pass." Die Grenze greift NUR, wenn der Server sie meldet
 * (`GET /api/billing/offer` → `freeTier.limited`, Env `FREE_TIER_LIMITS=1`
 * bei verkaufsbereitem Dienst). Fehlt das Angebot (offline, Fehler, selbst
 * gehostet ohne Bezahlwege), ist nichts gesperrt.
 *
 * Wer hat alles frei: jeder mit aktivem Zugang (Pass, Gutschein-Zeitzugang,
 * dauerhafter Gratiszugang, Pilot, Bestandskonto „unlimited", Admin).
 * Abgelaufener Zugang: Bearbeiten ist ohnehin gesperrt (Nur-Lesen), Export
 * bleibt vollständig, auch Word — so steht es in AGB und Ablauf-Mail. Konto
 * ohne je einen Zugang (`none` ohne Datum): Grenzen wie ohne Konto.
 *
 * Bestand: Was schon da ist, bleibt nutzbar — bestehende Fassungen und
 * Sprachen mit eigenem Inhalt lassen sich weiter öffnen, bearbeiten und als
 * PDF exportieren, ein schon geschriebenes Anschreiben ebenso. Gesperrt ist
 * nur das Anlegen von Neuem. Beispielinhalte (Demo „Lena Brandt", das
 * vorbelegte Musteranschreiben, leere Fassungen) zählen nicht als Bestand.
 *
 * Durchsetzen lässt sich das im Browser nicht (Word entsteht dort, der Code
 * ist offen). Das ist bewusst so: eine Angebotsgrenze, keine Sicherheitsgrenze.
 * Die Oberfläche sperrt aber an allen Wegen gleich.
 *
 * Vorlagen-Staffel (10.10.2026, optional): Ohne Zugang
 * gibt es das gestaltete PDF und HTML nur in den 10 Gratis-Vorlagen
 * (templates/freeTemplates.ts). Ansehen, Auswählen, Gestalten und die
 * ATS-Fassung als PDF bleiben in jeder Vorlage frei. Gleiche Bedingungen wie
 * oben: nur mit `freeTier.limited`, abgelaufener Pass exportiert weiter alles
 * (AGB § 7 Abs. 5), selbst gehostet ist nichts gesperrt.
 *
 * Bestandsregel (`templateGrandfather`): Eine Fassung, die es schon gab, bevor
 * die Grenze in diesem Browser bzw. für dieses Konto zum ersten Mal galt,
 * behält ihre damals gewählte Vorlage frei.
 *  - Lokal: Beim ersten Laden mit Grenze bekommt jede vorhandene Fassung mit
 *    einer Pass-Vorlage `settings.grandfatheredTemplate` (App.tsx, einmal je
 *    Browser, Merker `cv-tpl-tier-v1` im localStorage). Die Markierung reist mit
 *    Sicherungsdatei und Import. Die unveränderte Demo bekommt keine: Sie zählt
 *    wie bisher nicht als Bestand.
 *  - Konto (nur Stufe `none`, alle anderen exportieren ohnehin frei): Fassungen,
 *    deren `created_at` am Server vor `freeTier.templatesSince` liegt (dem
 *    Zeitpunkt, an dem der Dienst die Grenze zum ersten Mal gemeldet hat,
 *    pdf-service/billing.js), behalten die Vorlage, mit der sie am Server
 *    gespeichert sind. Ohne diesen Zeitpunkt gilt jede Fassung als Bestand.
 */
import { createContext, useContext } from 'react';
import type { AuthUser } from '../data/api';
import type { AppProfile, CVData, CoverLetterData, Lang } from '../data/types';
import { ALL_LANGS } from '../data/labels';
import { createBlankProfile, createDemoProfile, DEFAULT_COVER_LETTERS } from '../data/storage';
import type { FreeTierKey } from '../ui/i18n/freetier';
import type { Offer } from './api';
import { isFreeTemplate } from '../templates/freeTemplates';
import { resolveThemeId } from '../templates/theme';

export type { FreeTierKey } from '../ui/i18n/freetier';
/** Gründe für das Freischalt-Paneel aus der Gratis-Grenze, dazu die
 *  Vorlagen-Staffel (`template`). */
export type LockKey = FreeTierKey | 'template';

/** Meldet der Server die Grenze? Nur bei offenem Verkauf. */
export function freeTierLimited(offer: Offer | null | undefined): boolean {
  return !!offer && offer.enabled === true && offer.freeTier?.limited === true;
}

/** Zugangsstufe eines Nutzers: `full` = alles, `export` = abgelaufen (lesen
 *  und alles exportieren), `none` = ohne Konto oder nie einen Zugang gehabt. */
export type AccessLevel = 'full' | 'export' | 'none';

export function accessLevel(user: AuthUser | null | undefined, localMode: boolean): AccessLevel {
  if (localMode || !user) return 'none';
  if (user.role === 'admin') return 'full';
  const p = user.plan;
  /* Nach einem Widerruf (10.10.2026): Stammen die Zugänge nur aus
   * widerrufenen Bestellungen, bleibt der Datenexport (lesen, JSON, Markdown,
   * löschen), aber nicht Word, LaTeX und die Pass-Vorlagen auf Dauer. Der
   * Server meldet das als kind 'none' ohne Datum und `withdrawn: true`
   * (pdf-service/grants.js); hier steht es zur Sicherheit noch einmal. */
  if (p?.withdrawn && p.kind === 'none') return 'none';
  // Dienst ohne Plan-Modell: der alte Pilot-Weg entscheidet.
  if (!p) return user.access?.expired || user.access?.readOnly ? 'export' : 'full';
  if (p.kind === 'unlimited' || p.kind === 'lifetime') return 'full';
  if ((p.kind === 'pass' || p.kind === 'pilot') && p.notice !== 'expired') return 'full';
  // Abgelaufen (Pass, Gutschein-Zeit, Pilot): kind 'none' MIT Datum oder notice 'expired'.
  if (p.until) return 'export';
  return 'none';
}

/* ── Bestand erkennen ────────────────────────────────────────────────────── */

/** Der Teil eines Lebenslaufs, den man schreibt. Kontakt und Name gehören
 *  nicht dazu: sie werden beim Anlegen und beim Sprachwechsel bewusst in alle
 *  Sprachen übernommen (storage.ts, `carryContactToLang`). */
function bodySig(cv: CVData | undefined): string {
  if (!cv) return '';
  return JSON.stringify([
    cv.profile?.text ?? '', cv.experience ?? [], cv.education ?? [], cv.skillGroups ?? [], cv.languages ?? [],
    cv.additionalExperience ?? [], cv.projects ?? [], cv.certificates ?? [], cv.volunteering ?? [],
    cv.publications ?? [], cv.customSections ?? [],
  ]);
}
const EMPTY_BODY = bodySig({ profile: { text: '' }, experience: [], education: [], skillGroups: [], languages: [] } as unknown as CVData);

let samples: { body: Set<string>; demo: Record<Lang, string> } | null = null;
/** Inhalte, die nicht als eigener Bestand zählen: leere Fassung und Demo. */
function sampleSigs() {
  if (samples) return samples;
  const blank = createBlankProfile('');
  const demo = createDemoProfile('');
  const body = new Set<string>([EMPTY_BODY]);
  const demoFull = {} as Record<Lang, string>;
  for (const l of ALL_LANGS) {
    body.add(bodySig(blank.data[l]));
    body.add(bodySig(demo.data[l]));
    demoFull[l] = fullSig(demo.data[l]);
  }
  samples = { body, demo: demoFull };
  return samples;
}
function fullSig(cv: CVData | undefined): string {
  if (!cv) return '';
  const { labels: _l, ...rest } = cv;
  void _l;
  return JSON.stringify(rest);
}

/** Sprachen eines Profils mit eigenem, geschriebenem Inhalt. */
export function ownLangs(p: AppProfile | null | undefined): Lang[] {
  if (!p) return [];
  const s = sampleSigs();
  return ALL_LANGS.filter(l => {
    const sig = bodySig(p.data?.[l]);
    return !!sig && !s.body.has(sig);
  });
}

/**
 * Darf die Dokumentsprache auf `target` wechseln (Grenze aktiv, kein Zugang)?
 *
 * - Noch nichts Eigenes geschrieben: jede Sprache, die Wahl ist frei.
 * - Eigener Inhalt in genau einer Sprache (auch wenn er in andere Sprachen
 *   kopiert wurde): diese Sprache; ein Wechsel woanders hin legt eine zweite
 *   Sprache an und ist Teil des Passes.
 * - Eigener, verschiedener Inhalt in mehreren Sprachen (Bestand): zwischen
 *   diesen frei hin und her.
 */
export function langAllowedFor(p: AppProfile | null | undefined, target: Lang): boolean {
  if (!p) return true;
  const cur = p.settings.lang;
  if (target === cur) return true;
  const own = ownLangs(p);
  if (!own.length) return true;
  if (!own.includes(target)) return false;
  const distinct = new Set(own.map(l => bodySig(p.data[l])));
  if (distinct.size >= 2) return true;
  // Eine eigene Sprache: zurück dorthin geht immer, ein Wechsel auf eine Kopie nicht.
  return !own.includes(cur);
}

/** Ist das Profil unverändert die Demo (zählt nicht als eigene Fassung)? */
export function isPristineDemo(p: AppProfile): boolean {
  const s = sampleSigs();
  return ALL_LANGS.every(l => fullSig(p.data?.[l]) === s.demo[l]);
}

/** Eigene Fassungen: alles außer der unveränderten Demo. */
export function ownProfileCount(profiles: AppProfile[]): number {
  return profiles.filter(p => !isPristineDemo(p)).length;
}

/** Ein schon geschriebenes Anschreiben in dieser Sprache (nicht das
 *  vorbelegte Muster, nicht leer)? Das Datum zählt nicht mit — es steht beim
 *  Anlegen auf dem Tag des Anlegens. */
export function hasOwnCoverLetter(p: AppProfile | null | undefined, lang: Lang): boolean {
  const cl = p?.coverLetters?.[lang];
  if (!cl) return false;
  const strip = (c: CoverLetterData) => { const { date: _d, ...rest } = c; void _d; return rest; };
  const mine = strip(cl);
  if (!Object.values(mine).some(v => typeof v === 'string' && v.trim())) return false;
  const def = DEFAULT_COVER_LETTERS[lang];
  return JSON.stringify(mine) !== JSON.stringify(strip(def));
}

/* ── Zustand für die Oberfläche ──────────────────────────────────────────── */

export interface FreeTier {
  /** Server meldet die Grenze. */
  limited: boolean;
  /** Alles frei (keine Grenze oder aktiver Zugang). */
  full: boolean;
  /** Word-Export erlaubt. */
  docx: boolean;
  /** LaTeX-Export erlaubt (seit 10.10.2026; im Pass wie Word — ein gesetztes
   *  Dokument zum Weiterbearbeiten). RenderCV-YAML bleibt frei: das sind die
   *  eigenen Daten in einem offenen Format, wie JSON und Markdown. Gesperrt
   *  wird über dasselbe Freischalt-Paneel wie Word (`open('docx')`). */
  latex: boolean;
  /** Anschreiben für die aktive Fassung und Sprache (bearbeiten und exportieren). */
  coverLetter: boolean;
  /** Neue Fassung anlegen, duplizieren, als neues Profil importieren. */
  addProfile: boolean;
  /** Dokumentsprache wechseln. */
  langAllowed: (l: Lang) => boolean;
  /** Gestaltetes PDF und HTML in dieser Vorlage (aktive Fassung). Ansehen und
   *  Auswählen sind immer erlaubt, die ATS-Fassung als PDF auch. */
  templateAllowed: (id: string) => boolean;
  /** Preiszeile für die Hinweise; leer ohne Angebot. */
  priceLine: string;
  /** Freischalt-Paneel für eine Funktion öffnen. */
  open: (k: LockKey) => void;
}

export const FREE_TIER_OPEN: FreeTier = {
  limited: false, full: true, docx: true, latex: true, coverLetter: true, addProfile: true,
  langAllowed: () => true, templateAllowed: () => true, priceLine: '', open: () => {},
};

/** Vorlage, die eine Fassung nach der Bestandsregel frei behält (lokal: die
 *  Markierung im Profil; Konto: `accountGrandfather` aus App.tsx). */
export function templateGrandfather(p: AppProfile | null | undefined, accountGrandfather?: string | null): string | null {
  const own = p?.settings?.grandfatheredTemplate;
  if (own) return resolveThemeId(own);
  return accountGrandfather ? resolveThemeId(accountGrandfather) : null;
}

/** Darf die Fassung als gestaltetes PDF/HTML in `id` heraus (Grenze aktiv,
 *  kein Zugang)? Frei sind die Gratis-Vorlagen und die Bestandsvorlage. */
export function templateAllowedFor(id: string, grandfathered: string | null): boolean {
  if (isFreeTemplate(id)) return true;
  return !!grandfathered && resolveThemeId(id) === grandfathered;
}

/** Profile, die beim ersten Laden mit Grenze die Bestandsmarkierung brauchen
 *  (lokal): eigene Fassungen mit einer Pass-Vorlage, noch ohne Markierung. */
export function profilesToGrandfather(profiles: AppProfile[]): AppProfile[] {
  return profiles.filter(p => !p.settings.grandfatheredTemplate && !isFreeTemplate(p.settings.template) && !isPristineDemo(p));
}

export function computeFreeTier(o: {
  offer: Offer | null; user: AuthUser | null; localMode: boolean;
  profiles: AppProfile[]; active: AppProfile | null; lang: Lang;
  priceLine: string; open: (k: LockKey) => void;
  /** Konto: Vorlage der aktiven Fassung nach der Bestandsregel (App.tsx). */
  accountGrandfather?: string | null;
}): FreeTier {
  const limited = freeTierLimited(o.offer);
  if (!limited) return { ...FREE_TIER_OPEN, open: o.open };
  const level = accessLevel(o.user, o.localMode);
  if (level === 'full') return { ...FREE_TIER_OPEN, limited, open: o.open };
  const exportAll = level === 'export';
  return {
    limited,
    full: false,
    docx: exportAll,
    latex: exportAll,
    coverLetter: exportAll || hasOwnCoverLetter(o.active, o.lang),
    addProfile: ownProfileCount(o.profiles) === 0,
    langAllowed: l => exportAll || langAllowedFor(o.active, l),
    templateAllowed: id => exportAll || templateAllowedFor(id, templateGrandfather(o.active, o.localMode ? null : o.accountGrandfather)),
    priceLine: o.priceLine,
    open: o.open,
  };
}

export const FreeTierContext = createContext<FreeTier>(FREE_TIER_OPEN);
export function useFreeTier(): FreeTier { return useContext(FreeTierContext); }
