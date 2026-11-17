/**
 * Überschriften und Feldschlüssel der Markdown-Brücke, je Sprache.
 *
 * Wortgleich mit `MD_HEADS` / `CL_HEADS` in pdf-service/markdown.js — Browser
 * und Server schreiben für dieselben Daten denselben Text
 * (scripts/sectionsroundtrip.mjs prüft das). Bis zum 17.11.2026 standen dort
 * feste deutsche Schlüssel, auch in einem englischen CV.
 *
 * Gelesen werden alle vier Sprachen (import/markdownBridge.ts,
 * pdf-service/markdown.js): Wer hier ein Wort ändert, prüft, dass die Parser
 * es noch erkennen.
 */
import type { Lang } from '../data/types';

export interface MdHeads {
  contact: string; profile: string; experience: string; education: string;
  skills: string; languages: string; additional: string; projects: string;
  certificates: string; volunteering: string; publications: string; custom: string;
  email: string; phone: string; location: string; website: string; birthDate: string;
  driversLicense: string; nationality: string; maritalStatus: string;
  role: string; period: string; link: string; issuer: string; date: string;
  credentialId: string; publisher: string; subtitle: string;
  /** Ende einer laufenden Stelle, wenn das Profil keine Beschriftung trägt. */
  present: string;
}

export const MD_HEADS: Record<Lang, MdHeads> = {
  de: {
    contact: 'Kontakt', profile: 'Profil', experience: 'Berufserfahrung', education: 'Ausbildung',
    skills: 'Skills', languages: 'Sprachen', additional: 'Weiteres', projects: 'Projekte',
    certificates: 'Zertifikate', volunteering: 'Ehrenamt', publications: 'Publikationen', custom: 'Abschnitt',
    email: 'E-Mail', phone: 'Telefon', location: 'Ort', website: 'Website', birthDate: 'Geburtsdatum',
    driversLicense: 'Führerschein', nationality: 'Staatsangehörigkeit', maritalStatus: 'Familienstand',
    role: 'Rolle', period: 'Zeitraum', link: 'Link', issuer: 'Aussteller', date: 'Datum',
    credentialId: 'Kennung', publisher: 'Verlag', subtitle: 'Untertitel', present: 'heute',
  },
  en: {
    contact: 'Contact', profile: 'Profile', experience: 'Experience', education: 'Education',
    skills: 'Skills', languages: 'Languages', additional: 'Additional information', projects: 'Projects',
    certificates: 'Certifications', volunteering: 'Volunteering', publications: 'Publications', custom: 'Section',
    email: 'Email', phone: 'Phone', location: 'Location', website: 'Website', birthDate: 'Date of birth',
    driversLicense: 'Driving licence', nationality: 'Nationality', maritalStatus: 'Marital status',
    role: 'Role', period: 'Period', link: 'Link', issuer: 'Issuer', date: 'Date',
    credentialId: 'ID', publisher: 'Publisher', subtitle: 'Subtitle', present: 'Present',
  },
  fr: {
    contact: 'Contact', profile: 'Profil', experience: 'Expérience professionnelle', education: 'Formation',
    skills: 'Compétences', languages: 'Langues', additional: 'Informations complémentaires', projects: 'Projets',
    certificates: 'Certifications', volunteering: 'Bénévolat', publications: 'Publications', custom: 'Section',
    email: 'E-mail', phone: 'Téléphone', location: 'Adresse', website: 'Site web', birthDate: 'Date de naissance',
    driversLicense: 'Permis de conduire', nationality: 'Nationalité', maritalStatus: 'Situation familiale',
    role: 'Rôle', period: 'Période', link: 'Lien', issuer: 'Émetteur', date: 'Date',
    credentialId: 'Identifiant', publisher: 'Éditeur', subtitle: 'Sous-titre', present: 'à ce jour',
  },
  es: {
    contact: 'Contacto', profile: 'Perfil', experience: 'Experiencia profesional', education: 'Formación',
    skills: 'Competencias', languages: 'Idiomas', additional: 'Información adicional', projects: 'Proyectos',
    certificates: 'Certificaciones', volunteering: 'Voluntariado', publications: 'Publicaciones', custom: 'Sección',
    email: 'Correo electrónico', phone: 'Teléfono', location: 'Ubicación', website: 'Sitio web', birthDate: 'Fecha de nacimiento',
    driversLicense: 'Permiso de conducir', nationality: 'Nacionalidad', maritalStatus: 'Estado civil',
    role: 'Rol', period: 'Periodo', link: 'Enlace', issuer: 'Emisor', date: 'Fecha',
    credentialId: 'ID', publisher: 'Editorial', subtitle: 'Subtítulo', present: 'actualidad',
  },
};

export interface ClHeads {
  recipient: string; company: string; contactPerson: string; companyAddress: string;
  header: string; city: string; date: string; subject: string; salutation: string; intro: string;
  mainBody: string; companyReference: string; motivation: string; closing: string; signoff: string;
}

export const CL_HEADS: Record<Lang, ClHeads> = {
  de: {
    recipient: 'Empfänger', company: 'Firma', contactPerson: 'Ansprechpartner', companyAddress: 'Adresse',
    header: 'Kopf', city: 'Ort', date: 'Datum', subject: 'Betreff', salutation: 'Anrede', intro: 'Einstieg',
    mainBody: 'Hauptteil', companyReference: 'Firmenbezug', motivation: 'Motivation', closing: 'Abschluss', signoff: 'Grußformel',
  },
  en: {
    recipient: 'Recipient', company: 'Company', contactPerson: 'Contact person', companyAddress: 'Address',
    header: 'Header', city: 'City', date: 'Date', subject: 'Subject', salutation: 'Salutation', intro: 'Introduction',
    mainBody: 'Main body', companyReference: 'Why this company', motivation: 'Motivation', closing: 'Closing', signoff: 'Sign-off',
  },
  fr: {
    recipient: 'Destinataire', company: 'Entreprise', contactPerson: 'Interlocuteur', companyAddress: 'Adresse',
    header: 'En-tête', city: 'Lieu', date: 'Date', subject: 'Objet', salutation: 'Formule d’appel', intro: 'Introduction',
    mainBody: 'Corps', companyReference: 'Pourquoi cette entreprise', motivation: 'Motivation', closing: 'Conclusion', signoff: 'Formule de politesse',
  },
  es: {
    recipient: 'Destinatario', company: 'Empresa', contactPerson: 'Persona de contacto', companyAddress: 'Dirección',
    header: 'Encabezado', city: 'Lugar', date: 'Fecha', subject: 'Asunto', salutation: 'Saludo', intro: 'Introducción',
    mainBody: 'Cuerpo', companyReference: 'Por qué esta empresa', motivation: 'Motivación', closing: 'Cierre', signoff: 'Despedida',
  },
};

export const mdHeadsOf = (lang: unknown): MdHeads => MD_HEADS[lang as Lang] ?? MD_HEADS.de;
export const clHeadsOf = (lang: unknown): ClHeads => CL_HEADS[lang as Lang] ?? CL_HEADS.de;
