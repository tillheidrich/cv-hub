export interface PersonalInfo {
  name: string;
  title: string;
  subtitle?: string;
  location: string;
  email: string;
  phone: string;
  website?: string;
  linkedin?: string;
  instagram?: string;
  birthDate?: string;
  birthPlace?: string;
  maritalStatus?: string;
  nationality?: string;
  driversLicense?: string;
  photo?: string;
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
  level: string;
}

// ── UI Labels – one set per language ──────────────────────────────────────
// The template never has hardcoded German/English strings.
// Everything it displays comes from here.
export interface UILabels {
  lang: 'de' | 'en';
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

export type Lang = 'de' | 'en';

/** How many A4 pages the document should be fitted to. */
export type PageMode = 'one' | 'two' | 'auto';

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

export interface ProfileSettings {
  template: TemplateName;
  fontScale: FontScale;
  fontPairing: FontPairingId;
  pageMode: PageMode;
  lang: Lang;
}

export interface AppProfile {
  id: string;
  displayName: string;          // e.g. "Jane Doe – Marketing"
  createdAt: string;            // ISO date string
  data: Record<Lang, CVData>;
  coverLetters: Record<Lang, CoverLetterData>;
  settings: ProfileSettings;
}
