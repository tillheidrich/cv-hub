/** Social/web channels supported in the editor + renderer. Keys are stable IDs;
 * labels and prefixes live in SOCIAL_PLATFORMS in editor/EditorPanel.tsx. */
export type SocialPlatform =
  | 'linkedin' | 'github' | 'xing' | 'twitter' | 'bluesky'
  | 'mastodon' | 'instagram' | 'youtube' | 'tiktok'
  | 'behance' | 'dribbble' | 'medium' | 'substack';

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  value: string;   // handle or full URL — we render whichever the user typed
}

export interface PersonalInfo {
  name: string;
  title: string;
  subtitle?: string;
  location: string;
  email: string;
  phone: string;
  website?: string;
  /** @deprecated use `socials` instead — kept for backward compatibility with old payloads */
  linkedin?: string;
  /** @deprecated use `socials` instead */
  instagram?: string;
  /** Extensible list of social channels — replaces the dedicated linkedin/instagram fields */
  socials?: SocialLink[];
  birthDate?: string;
  birthPlace?: string;
  maritalStatus?: string;
  nationality?: string;
  driversLicense?: string;
  photo?: string;
  /** Ort für die Unterschriftszeile am Blattfuß. Leer = `location` wird
   *  genommen, denn in neun von zehn Fällen ist es derselbe Ort. */
  signatureCity?: string;
  /** Datum der Unterschrift. Leer = heute, beim Rendern gebildet — ein
   *  Lebenslauf mit einem drei Monate alten Datum ist ein Eigentor. */
  signatureDate?: string;
}

export interface ProfileSummary {
  text: string;
}

export interface ExperienceEntry {
  id: string;
  role: string;
  company: string;
  location: string;
  start: string;
  end: string;
  bullets: string[];
  hidden?: boolean;
}

export interface EducationEntry {
  id: string;
  degree: string;
  institution: string;
  location?: string;
  start: string;
  end: string;
  notes?: string;
}

export interface SkillGroup {
  label: string;
  items: string[];
}

export interface LanguageEntry {
  language: string;
  /** Free-form level label — kept as the canonical written form (e.g. "C1",
   *  "Verhandlungssicher", "Native"). Renderers print this verbatim. */
  level: string;
  /** Optional visual rating, 1–5. When set, templates render a dot scale
   *  (●●●○○) next to the language. Maps loosely:
   *  1=A1, 2=A2, 3=B1/B2, 4=C1, 5=C2/Muttersprache. */
  dots?: number;
}

// ── UI Labels – one set per language ──────────────────────────────────────
// The template never has hardcoded German/English strings.
// Everything it displays comes from here.
export interface UILabels {
  lang: Lang;
  sections: {
    personal: string;        // "Persönliches" / "Contact"
    details: string;         // "Eckdaten" / "Details"
    profile: string;         // "Berufsprofil" / "Profile"
    experience: string;      // "Berufserfahrung" / "Professional Experience"
    education: string;       // "Ausbildung" / "Education"
    languages: string;       // "Sprachen" / "Languages"
    additional: string;      // "Weiteres" / "Additional"
  };
  fields: {
    email: string;
    phone: string;
    address: string;
    web: string;
    linkedin: string;
    birthDate: string;       // "Geburtsdatum" / "Date of birth"
    birthPlace: string;      // "Geburtsort" / "Place of birth"
    maritalStatus: string;   // "Familienstand" / "Marital status"
    nationality: string;     // "Staatsangehörigkeit" / "Nationality"
    driversLicense: string;  // "Führerschein" / "Driver's licence"
  };
  misc: {
    present: string;         // "heute" / "present"
    cvLabel: string;         // "Lebenslauf" / "Curriculum Vitae"
  };
}

// ── Cover Letter ──────────────────────────────────────────────────────────

export interface CoverLetterData {
  // Recipient block
  company: string;
  contactPerson: string;
  companyAddress: string;

  // Letter head
  city: string;            // "Hamburg" — city of sender
  date: string;            // "21. Mai 2026"
  subject: string;         // Betreff

  // Salutation
  salutation: string;      // "Sehr geehrte Damen und Herren,"

  // Body — separate paragraphs for structured editing
  intro: string;
  mainBody: string;
  companyReference: string;
  motivation: string;
  closing: string;

  // Sign-off
  signoff: string;         // "Mit freundlichen Grüßen"

  /* Zeitlose Fassung.
   *
   * Ort/Datum und der Unterschriftsblock machen aus einem Anschreiben ein
   * datiertes Dokument. Wer eine Fassung ohne Bezug auf einen Tag will —
   * für eine Initiativbewerbung, als Vorlage, für ein Portal —, schaltet
   * sie hier ab, ohne die eingegebenen Werte zu verlieren.
   *
   * undefined = an. Bestandsprofile verhalten sich damit unverändert. */
  showDateline?: boolean;
  showSignature?: boolean;
}

export interface CVData {
  personal: PersonalInfo;
  profile: ProfileSummary;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skillGroups: SkillGroup[];
  languages: LanguageEntry[];
  additionalExperience?: string[];
  labels: UILabels;
}

// ── Profile System ────────────────────────────────────────────────────────

/** Continuous user font-size multiplier (slider). */
export type FontScale = number;

/** Theme id from the template registry (see templates/theme.ts). */
export type TemplateName = string;

export type Lang = 'de' | 'en' | 'fr' | 'es';

/** How many A4 pages the document should be fitted to. */
export type PageMode = 'one' | 'two' | 'three' | 'auto';

/** Curated font-pairing id, or 'auto' to use the template's default. */
export type FontPairingId =
  | 'auto'
  | 'inter-playfair'
  | 'pure-inter'
  | 'lora-source'
  | 'merri-source'
  | 'space-inter'
  | 'garamond-archivo'
  | 'plex-corporate'
  | 'libre-inter';

/** Stable keys for the main sections — used by sectionOrder + hiddenSections.
 *  'details' = Eckdaten (Geburtsdatum, Ort, Nationalität, Führerschein etc.) */
export type SectionKey = 'profile' | 'details' | 'experience' | 'education' | 'skills' | 'languages' | 'additional';

export const DEFAULT_SECTION_ORDER: SectionKey[] = ['profile', 'details', 'experience', 'education', 'skills', 'languages', 'additional'];

/** Page format key — full specs live in data/pageFormats.ts */
export type PageFormat = 'a4' | 'letter' | 'legal' | 'a5';

/** Wählbare Akzentfarben — die Werte stehen in templates/theme.ts (ACCENTS).
 *  Hier, weil die Einstellungen eines Profils nichts über den Renderer wissen
 *  sollen und `types.ts` bewusst importfrei bleibt. */
export type AccentId =
  | 'auto' | 'graphit' | 'tinte' | 'petrol' | 'tanne'
  | 'olive' | 'kupfer' | 'bordeaux' | 'aubergine';

/** Wählbare Papierfarben — die Werte stehen in templates/theme.ts (PAPERS).
 *  Einige Vorlagen bringen cremefarbenes Papier mit (Lille, Antwerpen,
 *  Husum). Das ist eine Gestaltungsentscheidung der Vorlage und darf deshalb
 *  auch wieder zurückgenommen werden — `auto` heißt „so wie die Vorlage es
 *  vorsieht". */
export type PaperId = 'auto' | 'weiss' | 'creme' | 'sand' | 'leinen' | 'nebel';

export interface ProfileSettings {
  template: TemplateName;
  /** Akzentfarbe der Vorlage. Fehlt sie oder steht sie auf 'auto', gilt die
   *  Farbe der Vorlage selbst. Ersetzt die früheren Farbvarianten-Vorlagen. */
  accent?: AccentId;
  /** Papierfarbe. Fehlt sie oder steht sie auf 'auto', gilt die Farbe der
   *  Vorlage — bei den Creme-Vorlagen also Creme. */
  paper?: PaperId;
  fontScale: FontScale;
  fontPairing: FontPairingId;
  pageMode: PageMode;
  /** A4 (default), US Letter, US Legal, or A5. */
  pageFormat?: PageFormat;
  lang: Lang;
  /** Ordered list of section keys — drag-drop reorderable. Older profiles
   *  without this fall back to DEFAULT_SECTION_ORDER. */
  sectionOrder?: SectionKey[];
  /** Sections the user has explicitly hidden from rendering. */
  hiddenSections?: SectionKey[];
  /** Manual page assignment per section — used in pageMode='two' / 'three' so
   *  the user can pin a section to page 2 instead of relying on the auto-flow
   *  algorithm. Missing keys default to page 1. Page numbers above the chosen
   *  pageMode count are clamped to 1. */
  sectionPages?: Partial<Record<SectionKey, number>>;
  /** When true (default), switching to another template clears the saved
   *  sectionOrder + sectionPages so the user sees the design's intended
   *  default flow. Set to false to keep your custom reordering when hopping
   *  through templates to find the look you like. */
  respectTemplateStructure?: boolean;
}

export interface AppProfile {
  id: string;
  displayName: string;          // e.g. "Mein Lebenslauf" or "Bewerbung Acme"
  createdAt: string;            // ISO date string
  data: Record<Lang, CVData>;
  coverLetters: Record<Lang, CoverLetterData>;
  settings: ProfileSettings;
}
