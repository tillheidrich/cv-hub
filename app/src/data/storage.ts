import type { CVData, CoverLetterData, AppProfile, Lang } from './types';
import { demoDE as tillDE } from './demo-de';
import { demoEN as tillEN } from './demo-en';
import { LABELS, ALL_LANGS } from './labels';

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

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
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

// ── Profile CRUD ──────────────────────────────────────────────────────────────

export function loadProfiles(): AppProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return (JSON.parse(raw) as AppProfile[]).map(withAllLangs);
  } catch {
    // fall through to migration
  }

  // Migration: check if legacy v1 data exists
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
        // Only DE/EN come from legacy payloads; withAllLangs() below back-fills
        // FR/ES, so the incomplete literal is normalized before it leaves here.
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
      const profiles = [withAllLangs(profile)];
      saveProfiles(profiles);
      setActiveProfileId(profile.id);
      return profiles;
    }
  } catch {
    // migration failed, return empty
  }

  return [];
}

/** Speichert die Profile im Browser. `false`, wenn das nicht ging — voller
 *  Speicher (ein Foto im Lokalmodus braucht ein paar hundert KB), privates
 *  Fenster, gesperrter Speicher. Bisher wurde der Fehler verschluckt und die
 *  Oberfläche meldete trotzdem „Gespeichert". */
export function saveProfiles(profiles: AppProfile[]): boolean {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
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
