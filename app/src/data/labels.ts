import type { Lang, UILabels } from './types';

export const labelsDE: UILabels = {
  lang: 'de',
  sections: {
    personal:   'Persönliches',
    details:    'Eckdaten',
    profile:    'Berufsprofil',
    experience: 'Berufserfahrung',
    education:  'Ausbildung',
    languages:  'Sprachen',
    additional: 'Weiteres',
  },
  fields: {
    email:          'E-Mail',
    phone:          'Telefon',
    address:        'Adresse',
    web:            'Web',
    linkedin:       'LinkedIn',
    birthDate:      'Geburtsdatum',
    birthPlace:     'Geburtsort',
    maritalStatus:  'Familienstand',
    nationality:    'Staatsangehörigkeit',
    driversLicense: 'Führerschein',
  },
  misc: {
    present: 'heute',
    cvLabel: 'Lebenslauf',
  },
};

export const labelsEN: UILabels = {
  lang: 'en',
  sections: {
    personal:   'Contact',
    details:    'Personal Details',
    profile:    'Profile',
    experience: 'Professional Experience',
    education:  'Education',
    languages:  'Languages',
    additional: 'Additional',
  },
  fields: {
    email:          'Email',
    phone:          'Phone',
    address:        'Location',
    web:            'Portfolio',
    linkedin:       'LinkedIn',
    birthDate:      'Date of birth',
    birthPlace:     'Place of birth',
    maritalStatus:  'Marital status',
    nationality:    'Nationality',
    driversLicense: "Driver's licence",
  },
  misc: {
    present: 'present',
    cvLabel: 'Curriculum Vitae',
  },
};

export const labelsFR: UILabels = {
  lang: 'fr',
  sections: {
    personal:   'Contact',
    details:    'Informations personnelles',
    profile:    'Profil',
    experience: 'Expérience professionnelle',
    education:  'Formation',
    languages:  'Langues',
    additional: 'Divers',
  },
  fields: {
    email:          'E-mail',
    phone:          'Téléphone',
    address:        'Adresse',
    web:            'Portfolio',
    linkedin:       'LinkedIn',
    birthDate:      'Date de naissance',
    birthPlace:     'Lieu de naissance',
    maritalStatus:  'Situation familiale',
    nationality:    'Nationalité',
    driversLicense: 'Permis de conduire',
  },
  misc: {
    present: 'à ce jour',
    cvLabel: 'Curriculum Vitae',
  },
};

export const labelsES: UILabels = {
  lang: 'es',
  sections: {
    personal:   'Contacto',
    details:    'Datos personales',
    profile:    'Perfil',
    experience: 'Experiencia profesional',
    education:  'Formación académica',
    languages:  'Idiomas',
    additional: 'Información adicional',
  },
  fields: {
    email:          'Correo electrónico',
    phone:          'Teléfono',
    address:        'Ubicación',
    web:            'Portafolio',
    linkedin:       'LinkedIn',
    birthDate:      'Fecha de nacimiento',
    birthPlace:     'Lugar de nacimiento',
    maritalStatus:  'Estado civil',
    nationality:    'Nacionalidad',
    driversLicense: 'Permiso de conducir',
  },
  misc: {
    present: 'actualidad',
    cvLabel: 'Currículum',
  },
};

/** Central lookup — one label pack per supported language. The renderer and
 *  storage layer read from here so no template ever hardcodes a language. */
export const LABELS: Record<Lang, UILabels> = {
  de: labelsDE,
  en: labelsEN,
  fr: labelsFR,
  es: labelsES,
};

/** Display names for the language switcher. */
export const LANG_NAMES: Record<Lang, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
};

/** All supported languages, in switcher order. */
export const ALL_LANGS: Lang[] = ['de', 'en', 'fr', 'es'];
