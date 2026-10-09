// Texte für editor/ExtraSectionsEditor.tsx — in den vier Oberflächensprachen.
// Eigene Datei, damit die Komponente nur Komponenten exportiert (Fast Refresh)
// und „Abschnitte ordnen" (ui/DesignPanel.tsx) die Namen mitbenutzen kann.

import type { UiLang } from '../ui/i18n';
import type { ExtraSectionKey } from '../data/extraSections';

// ── Texte der Oberfläche ────────────────────────────────────────────────────

export interface ExtraStrings {
  bar: string; barHint: string; barOpen: string; barAdd: string;
  title: string; intro: string; close: string;
  kinds: Record<ExtraSectionKey, string>;
  kindHints: Record<ExtraSectionKey, string>;
  addSection: string; addChoose: string;
  heading: string; headingHint: string; customTitle: string; customTitlePlaceholder: string;
  addEntry: string; newEntry: string; entries: (n: number) => string;
  moveUp: (x: string) => string; moveDown: (x: string) => string;
  removeEntry: (x: string) => string; removeSection: string; confirmRemove: string; cancel: string;
  f: {
    title: string; role: string; from: string; to: string; link: string; description: string;
    bullets: string; name: string; issuer: string; date: string; credentialId: string;
    organization: string; location: string; publisher: string; subtitle: string; text: string;
    items: string;
  };
  datePh: string; toPh: string; linkPh: string;
}

const DE: ExtraStrings = {
  bar: 'Weitere Abschnitte', barHint: 'Projekte, Zertifikate, Ehrenamt, Publikationen, eigene',
  barOpen: 'Bearbeiten', barAdd: '+ Abschnitt hinzufügen',
  title: 'Weitere Abschnitte',
  intro: 'Ein Abschnitt erscheint im Dokument erst, wenn etwas darin steht. Wo er steht, legst du unter Gestaltung → Abschnitte ordnen fest.',
  close: 'Schließen',
  kinds: { projects: 'Projekte', certificates: 'Zertifikate', volunteering: 'Ehrenamt', publications: 'Publikationen', custom: 'Freier Abschnitt' },
  kindHints: {
    projects: 'Titel, Rolle, Zeitraum, Link, Beschreibung',
    certificates: 'Name, Aussteller, Datum, Kennung',
    volunteering: 'Aufgebaut wie eine Station im Berufsweg',
    publications: 'Titel, Ort oder Verlag, Datum, Link',
    custom: 'Eigene Überschrift, Stichpunkte oder Einträge',
  },
  addSection: '+ Abschnitt hinzufügen', addChoose: 'Welcher Abschnitt?',
  heading: 'Überschrift im Dokument', headingHint: 'Leer lassen für die übliche Überschrift',
  customTitle: 'Überschrift', customTitlePlaceholder: 'z. B. Auszeichnungen, Interessen, Kurse',
  addEntry: '+ Eintrag', newEntry: 'Neuer Eintrag', entries: n => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`,
  moveUp: x => `${x} nach oben`, moveDown: x => `${x} nach unten`,
  removeEntry: x => `${x} löschen`, removeSection: 'Abschnitt entfernen', confirmRemove: 'Wirklich entfernen', cancel: 'Abbrechen',
  f: {
    title: 'Titel', role: 'Rolle', from: 'Von', to: 'Bis', link: 'Link', description: 'Beschreibung',
    bullets: 'Stichpunkte (einer pro Zeile)', name: 'Name', issuer: 'Aussteller', date: 'Datum',
    credentialId: 'Kennung (z. B. Zertifikatsnummer)', organization: 'Organisation oder Verein', location: 'Ort',
    publisher: 'Ort oder Verlag', subtitle: 'Untertitel', text: 'Text', items: 'Stichpunkte (einer pro Zeile)',
  },
  datePh: 'MM/JJJJ', toPh: 'MM/JJJJ oder heute', linkPh: 'beispiel.de/projekt',
};

const EN: ExtraStrings = {
  bar: 'More sections', barHint: 'Projects, certifications, volunteering, publications, your own',
  barOpen: 'Edit', barAdd: '+ Add section',
  title: 'More sections',
  intro: 'A section only appears in the document once it has content. Its position is set under Design → Order sections.',
  close: 'Close',
  kinds: { projects: 'Projects', certificates: 'Certifications', volunteering: 'Volunteering', publications: 'Publications', custom: 'Custom section' },
  kindHints: {
    projects: 'Title, role, period, link, description',
    certificates: 'Name, issuer, date, credential ID',
    volunteering: 'Built like a job in your experience',
    publications: 'Title, place or publisher, date, link',
    custom: 'Your own heading, bullets or entries',
  },
  addSection: '+ Add section', addChoose: 'Which section?',
  heading: 'Heading in the document', headingHint: 'Leave empty for the usual heading',
  customTitle: 'Heading', customTitlePlaceholder: 'e.g. Awards, Interests, Courses',
  addEntry: '+ Entry', newEntry: 'New entry', entries: n => `${n} ${n === 1 ? 'entry' : 'entries'}`,
  moveUp: x => `Move ${x} up`, moveDown: x => `Move ${x} down`,
  removeEntry: x => `Delete ${x}`, removeSection: 'Remove section', confirmRemove: 'Really remove', cancel: 'Cancel',
  f: {
    title: 'Title', role: 'Role', from: 'From', to: 'To', link: 'Link', description: 'Description',
    bullets: 'Bullet points (one per line)', name: 'Name', issuer: 'Issuer', date: 'Date',
    credentialId: 'Credential ID', organization: 'Organisation', location: 'Location',
    publisher: 'Place or publisher', subtitle: 'Subtitle', text: 'Text', items: 'Bullet points (one per line)',
  },
  datePh: 'MM/YYYY', toPh: 'MM/YYYY or present', linkPh: 'example.com/project',
};

const FR: ExtraStrings = {
  bar: 'Autres rubriques', barHint: 'Projets, certifications, bénévolat, publications, personnalisées',
  barOpen: 'Modifier', barAdd: '+ Ajouter une rubrique',
  title: 'Autres rubriques',
  intro: "Une rubrique n'apparaît dans le document que lorsqu'elle a du contenu. Sa place se règle sous Mise en page → Ordre des rubriques.",
  close: 'Fermer',
  kinds: { projects: 'Projets', certificates: 'Certifications', volunteering: 'Bénévolat', publications: 'Publications', custom: 'Rubrique libre' },
  kindHints: {
    projects: 'Titre, rôle, période, lien, description',
    certificates: 'Nom, organisme, date, identifiant',
    volunteering: 'Construit comme un poste du parcours',
    publications: 'Titre, lieu ou éditeur, date, lien',
    custom: 'Titre libre, puces ou entrées',
  },
  addSection: '+ Ajouter une rubrique', addChoose: 'Quelle rubrique ?',
  heading: 'Titre dans le document', headingHint: 'Laisser vide pour le titre habituel',
  customTitle: 'Titre', customTitlePlaceholder: 'p. ex. Distinctions, Centres d’intérêt, Formations',
  addEntry: '+ Entrée', newEntry: 'Nouvelle entrée', entries: n => `${n} ${n === 1 ? 'entrée' : 'entrées'}`,
  moveUp: x => `Monter ${x}`, moveDown: x => `Descendre ${x}`,
  removeEntry: x => `Supprimer ${x}`, removeSection: 'Retirer la rubrique', confirmRemove: 'Vraiment retirer', cancel: 'Annuler',
  f: {
    title: 'Titre', role: 'Rôle', from: 'De', to: 'À', link: 'Lien', description: 'Description',
    bullets: 'Puces (une par ligne)', name: 'Nom', issuer: 'Organisme', date: 'Date',
    credentialId: 'Identifiant (n° de certificat)', organization: 'Organisation ou association', location: 'Lieu',
    publisher: 'Lieu ou éditeur', subtitle: 'Sous-titre', text: 'Texte', items: 'Puces (une par ligne)',
  },
  datePh: 'MM/AAAA', toPh: 'MM/AAAA ou à ce jour', linkPh: 'exemple.fr/projet',
};

const ES: ExtraStrings = {
  bar: 'Más secciones', barHint: 'Proyectos, certificaciones, voluntariado, publicaciones, propias',
  barOpen: 'Editar', barAdd: '+ Añadir sección',
  title: 'Más secciones',
  intro: 'Una sección solo aparece en el documento cuando tiene contenido. Su posición se fija en Diseño → Ordenar secciones.',
  close: 'Cerrar',
  kinds: { projects: 'Proyectos', certificates: 'Certificaciones', volunteering: 'Voluntariado', publications: 'Publicaciones', custom: 'Sección libre' },
  kindHints: {
    projects: 'Título, rol, periodo, enlace, descripción',
    certificates: 'Nombre, emisor, fecha, identificador',
    volunteering: 'Igual que un puesto de la experiencia',
    publications: 'Título, lugar o editorial, fecha, enlace',
    custom: 'Título propio, viñetas o entradas',
  },
  addSection: '+ Añadir sección', addChoose: '¿Qué sección?',
  heading: 'Título en el documento', headingHint: 'Vacío para el título habitual',
  customTitle: 'Título', customTitlePlaceholder: 'p. ej. Premios, Intereses, Cursos',
  addEntry: '+ Entrada', newEntry: 'Nueva entrada', entries: n => `${n} ${n === 1 ? 'entrada' : 'entradas'}`,
  moveUp: x => `Subir ${x}`, moveDown: x => `Bajar ${x}`,
  removeEntry: x => `Eliminar ${x}`, removeSection: 'Quitar sección', confirmRemove: 'Quitar de verdad', cancel: 'Cancelar',
  f: {
    title: 'Título', role: 'Rol', from: 'Desde', to: 'Hasta', link: 'Enlace', description: 'Descripción',
    bullets: 'Viñetas (una por línea)', name: 'Nombre', issuer: 'Emisor', date: 'Fecha',
    credentialId: 'Identificador (n.º de certificado)', organization: 'Organización o asociación', location: 'Lugar',
    publisher: 'Lugar o editorial', subtitle: 'Subtítulo', text: 'Texto', items: 'Viñetas (una por línea)',
  },
  datePh: 'MM/AAAA', toPh: 'MM/AAAA o actualidad', linkPh: 'ejemplo.es/proyecto',
};

export const EXTRA_UI: Record<UiLang, ExtraStrings> = { de: DE, en: EN, fr: FR, es: ES };

/** Namen der neuen Abschnitte in der Oberflächensprache — für „Abschnitte
 *  ordnen" in ui/DesignPanel.tsx. */
export function extraSectionUiName(key: string, uiLang: UiLang): string | undefined {
  return (EXTRA_UI[uiLang] ?? DE).kinds[key as ExtraSectionKey];
}

