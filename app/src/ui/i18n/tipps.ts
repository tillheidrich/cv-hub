/**
 * Oberflächentexte der Tipps (knowledge/KnowledgePanel.tsx). Die Inhalte der
 * Tipps selbst stehen je Sprache in knowledge/content/<sprache>.ts.
 *
 * Bis zum 10.10.2026 waren die Tipps nur deutsch, auch in einer englischen
 * Oberfläche. Deutsch und Spanisch duzen, Französisch siezt.
 */
import type { UiLang } from '../i18n';
import type { TipTab } from '../../knowledge/types';
import type { ReasonId } from '../../knowledge/context';

export interface TippsStrings {
  tablist: string;
  tab: Record<TipTab, string>;
  loading: string;
  more: string; less: string;
  before: string; after: string;
  sources: string; checked: (d: string) => string;
  magazin: string; magazinLangNote: string;
  copy: string; copied: string;
  forYou: string;
  reason: Record<ReasonId, string>;
  inTool: string;
  done: (n: number, total: number) => string;
  reset: string;
  promptNote: string;
}

const de: TippsStrings = {
  tablist: 'Bereiche der Tipps',
  tab: { cv: 'Lebenslauf', letter: 'Anschreiben', countries: 'Länder', checklist: 'Checkliste', prompts: 'Prompts' },
  loading: 'Tipps werden geladen …',
  more: 'Weiterlesen', less: 'Weniger',
  before: 'Vorher', after: 'Nachher',
  sources: 'Belege', checked: d => `geprüft ${d}`,
  magazin: 'Im Magazin', magazinLangNote: '',
  copy: 'Kopieren', copied: 'Kopiert',
  forYou: 'Passt gerade zu deinen Unterlagen',
  reason: {
    'no-profile': 'Dein Lebenslauf hat noch kein Profil.',
    'no-numbers': 'Kein Punkt unter deinen Stationen enthält eine Zahl.',
    'gap': 'Zwischen zwei Stationen liegen mehr als sechs Monate.',
    'intl-photo': 'Englischer Lebenslauf mit Foto oder Geburtsdatum.',
    'no-skills': 'Noch keine Kenntnisse eingetragen.',
    'cover-open': 'Du arbeitest gerade am Anschreiben.',
    'cover-sample': 'Im Anschreiben steht noch Text aus dem Muster.',
    'cover-floskel': 'Dein Anschreiben beginnt mit einer Standardformel.',
  },
  inTool: 'Hier im Werkzeug',
  done: (k, t) => `${k} von ${t} erledigt`,
  reset: 'Zurücksetzen',
  promptNote: 'Hinweis',
};

const en: TippsStrings = {
  tablist: 'Tip sections',
  tab: { cv: 'CV', letter: 'Cover letter', countries: 'Countries', checklist: 'Checklist', prompts: 'Prompts' },
  loading: 'Loading tips …',
  more: 'Read more', less: 'Less',
  before: 'Before', after: 'After',
  sources: 'Sources', checked: d => `checked ${d}`,
  magazin: 'In the magazine', magazinLangNote: '(in German)',
  copy: 'Copy', copied: 'Copied',
  forYou: 'Relevant to your documents right now',
  reason: {
    'no-profile': 'Your CV does not have a profile yet.',
    'no-numbers': 'None of the points under your roles contains a number.',
    'gap': 'There are more than six months between two roles.',
    'intl-photo': 'English CV with a photo or date of birth.',
    'no-skills': 'No skills entered yet.',
    'cover-open': 'You are working on the cover letter.',
    'cover-sample': 'The cover letter still contains sample text.',
    'cover-floskel': 'Your cover letter opens with a stock phrase.',
  },
  inTool: 'In this tool',
  done: (k, t) => `${k} of ${t} done`,
  reset: 'Reset',
  promptNote: 'Note',
};

const fr: TippsStrings = {
  tablist: 'Rubriques des conseils',
  tab: { cv: 'CV', letter: 'Lettre', countries: 'Pays', checklist: 'Check-list', prompts: 'Prompts' },
  loading: 'Chargement des conseils …',
  more: 'Lire la suite', less: 'Moins',
  before: 'Avant', after: 'Après',
  sources: 'Sources', checked: d => `vérifié ${d}`,
  magazin: 'Dans le magazine', magazinLangNote: '(en allemand)',
  copy: 'Copier', copied: 'Copié',
  forYou: 'Utile pour vos documents en ce moment',
  reason: {
    'no-profile': 'Votre CV n’a pas encore de profil.',
    'no-numbers': 'Aucun point sous vos postes ne contient de chiffre.',
    'gap': 'Plus de six mois séparent deux postes.',
    'intl-photo': 'CV en anglais avec photo ou date de naissance.',
    'no-skills': 'Aucune compétence saisie pour l’instant.',
    'cover-open': 'Vous travaillez sur la lettre.',
    'cover-sample': 'La lettre contient encore du texte du modèle.',
    'cover-floskel': 'Votre lettre commence par une formule toute faite.',
  },
  inTool: 'Dans cet outil',
  done: (k, t) => `${k} sur ${t} faits`,
  reset: 'Réinitialiser',
  promptNote: 'Remarque',
};

const es: TippsStrings = {
  tablist: 'Secciones de consejos',
  tab: { cv: 'CV', letter: 'Carta', countries: 'Países', checklist: 'Lista', prompts: 'Prompts' },
  loading: 'Cargando consejos …',
  more: 'Seguir leyendo', less: 'Menos',
  before: 'Antes', after: 'Después',
  sources: 'Fuentes', checked: d => `revisado ${d}`,
  magazin: 'En la revista', magazinLangNote: '(en alemán)',
  copy: 'Copiar', copied: 'Copiado',
  forYou: 'Útil ahora para tus documentos',
  reason: {
    'no-profile': 'Tu CV aún no tiene perfil.',
    'no-numbers': 'Ningún punto de tus puestos contiene una cifra.',
    'gap': 'Hay más de seis meses entre dos puestos.',
    'intl-photo': 'CV en inglés con foto o fecha de nacimiento.',
    'no-skills': 'Aún no hay conocimientos.',
    'cover-open': 'Estás trabajando en la carta.',
    'cover-sample': 'La carta aún contiene texto del modelo.',
    'cover-floskel': 'Tu carta empieza con una fórmula hecha.',
  },
  inTool: 'En esta herramienta',
  done: (k, t) => `${k} de ${t} hechos`,
  reset: 'Restablecer',
  promptNote: 'Nota',
};

export const TIPPS_I18N: Record<UiLang, TippsStrings> = { de, en, fr, es };
