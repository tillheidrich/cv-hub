/**
 * i18n für die Editor-Chrome (obere Toolbar, Mobile-Tab-Bar, Aktionen).
 * Folgt der UI-Sprache des Nutzers (uiLang) — unabhängig von der Sprache des
 * bearbeiteten Lebenslaufs (settings.lang). Ein deutscher Nutzer, der einen
 * französischen CV baut, will deutsche Bedienung + französischen Inhalt.
 *
 * Erste Scheibe: Navigations- und Aktions-Chrome. Feld-Labels/Placeholders
 * innerhalb der Editor-Panels folgen in weiteren Scheiben.
 */
import { createContext, useContext } from 'react';
import type { UiLang } from './i18n';

export interface EditorStrings {
  home: string;
  // Mode-Tabs
  edit: string; preview: string; export: string; tips: string;
  // Dokumenttypen
  resume: string; coverLetter: string;
  // Speicherstatus
  saved: string; saving: string; unsaved: string;
  // Aktionen
  font: string; versions: string; account: string; admin: string; demo: string;
  createAccount: string; signOut: string;
  // Tooltips (title=)
  ttHome: string; ttFont: string; ttVersions: string; ttAccount: string;
  ttAdmin: string; ttExitDemo: string; ttSignOut: string;
  // Soft-Wall (Demo-Sperre)
  swLimit: string; swTitle: string; swTitleAccent: string; swBody: string; swStay: string;
  // Direktes Schreiben in der Vorschau (Telefon/Tablet)
  zoomDone: string; tapToWrite: string;
  // Blätter und Menü auf dem Telefon
  close: string; menu: string; chooseTemplate: string; typeAndPage: string;
  docTypeLabel: string; langLabel: string;
  // Sprache der Oberfläche — bewusst getrennt von langLabel (Sprache des
  // Lebenslaufs). Beide Schalter zeigen DE EN FR ES; ohne eigene Benennung
  // hält man den einen für den anderen.
  uiLangLabel: string;
  // Einstellungen („Aa") — dieses Panel war bis zuletzt nur auf Deutsch
  // beschriftet. Aufgefallen ist das erst, als die Oberfläche im Editor
  // überhaupt umschaltbar wurde.
  spFontSize: string; spTypeface: string; spAccent: string; spPaper: string;
  spFormat: string; spPageCount: string; spSections: string;
  spPaperAuto: string; spPaperOverride: string;
  spTooLong: (zeichen: number, zeilen: number) => string;
  spEnough: string; spPartly: string;
  spShowAgain: string; spHide: string;
  spAccentTemplate: string; spPaperTemplate: string;
  spWhichPage: string;
}

export const ET: Record<UiLang, EditorStrings> = {
  de: {
    home: 'HOME',
    edit: 'Bearbeiten', preview: 'Vorschau', export: 'Export', tips: 'Tipps',
    resume: 'Lebenslauf', coverLetter: 'Anschreiben',
    saved: 'Gespeichert', saving: 'Speichert…', unsaved: 'Nicht gespeichert',
    font: 'Darstellung', versions: 'Versionen', account: 'Konto', admin: 'Admin', demo: 'DEMO',
    createAccount: 'Konto anlegen →', signOut: 'Abmelden',
    ttHome: 'Zurück zur Profilübersicht',
    ttFont: 'Darstellung: Schrift, Farbe, Papier, Seiten und Sektionen',
    ttVersions: 'Versionen — automatische Sicherungen vor Importen',
    ttAccount: 'Einstellungen — Passwort, Daten, Konto',
    ttAdmin: 'Admin-Bereich',
    ttExitDemo: 'Demo verlassen und ein Konto anlegen',
    ttSignOut: 'Abmelden',
    swLimit: 'Demo-Limit', swTitle: 'Diese Funktion braucht ein', swTitleAccent: 'Konto.', swBody: 'Du bist gerade im Demo-Modus. Speichern, Sharelinks, Versionen und KI-Funktionen brauchen ein Konto — registrieren dauert 30 Sekunden, du bekommst einen Einladungscode von der Person, die dir das Tool gezeigt hat.', swStay: 'Weiter im Demo',
    zoomDone: 'Fertig', tapToWrite: 'Text antippen und schreiben',
    close: 'Schließen', menu: 'Menü', chooseTemplate: 'Vorlage wählen', typeAndPage: 'Darstellung',
    docTypeLabel: 'Dokument', langLabel: 'Sprache des Lebenslaufs',
    uiLangLabel: 'Sprache der Oberfläche',
    spFontSize: 'Schriftgröße', spTypeface: 'Schriftart', spAccent: 'Akzentfarbe', spPaper: 'Papier',
    spFormat: 'Format', spPageCount: 'Seitenzahl', spSections: 'Sektionen',
    spPaperAuto: ' — das Papier, für das die Vorlage gebaut wurde.',
    spPaperOverride: ' — überschreibt das Papier der Vorlage.',
    spTooLong: (z, l) => `Rund ${z} Zeichen zu viel (${l} ${l === 1 ? 'Zeile' : 'Zeilen'}). Diese Stellen geben es her:`,
    spEnough: 'Zusammen reicht das.',
    spPartly: 'Das bringt schon einen Teil — danach neu schauen.',
    spShowAgain: 'Wieder einblenden', spHide: 'Ausblenden',
    spAccentTemplate: 'Vorlagenfarbe', spPaperTemplate: 'Vorlagenfarbe',
    spWhichPage: 'Auf welcher Seite soll diese Sektion erscheinen?',
  },
  en: {
    home: 'HOME',
    edit: 'Edit', preview: 'Preview', export: 'Export', tips: 'Tips',
    resume: 'Resume', coverLetter: 'Cover Letter',
    saved: 'Saved', saving: 'Saving…', unsaved: 'Not saved',
    font: 'Appearance', versions: 'Versions', account: 'Account', admin: 'Admin', demo: 'DEMO',
    createAccount: 'Create account →', signOut: 'Sign out',
    ttHome: 'Back to your profiles',
    ttFont: 'Appearance: type, colour, paper, pages and sections',
    ttVersions: 'Versions — automatic backups before imports',
    ttAccount: 'Settings — password, data, account',
    ttAdmin: 'Admin area',
    ttExitDemo: 'Leave the demo and create an account',
    ttSignOut: 'Sign out',
    swLimit: 'Demo limit', swTitle: 'This feature needs an', swTitleAccent: 'account.', swBody: "You're in demo mode right now. Saving, sharelinks, versions and AI features require an account — signing up takes 30 seconds, you'll get an invite code from whoever showed you the tool.", swStay: 'Stay in the demo',
    zoomDone: 'Done', tapToWrite: 'Tap any text to write',
    close: 'Close', menu: 'Menu', chooseTemplate: 'Choose a template', typeAndPage: 'Appearance',
    docTypeLabel: 'Document', langLabel: 'Language of the CV',
    uiLangLabel: 'Interface language',
    spFontSize: 'Font size', spTypeface: 'Typeface', spAccent: 'Accent colour', spPaper: 'Paper',
    spFormat: 'Format', spPageCount: 'Pages', spSections: 'Sections',
    spPaperAuto: ' — the paper this template was built for.',
    spPaperOverride: " — overrides the template's paper.",
    spTooLong: (z, l) => `About ${z} characters too many (${l} ${l === 1 ? 'line' : 'lines'}). These passages can give them up:`,
    spEnough: 'Together that is enough.',
    spPartly: 'That covers part of it — look again afterwards.',
    spShowAgain: 'Show again', spHide: 'Hide',
    spAccentTemplate: 'Template colour', spPaperTemplate: 'Template colour',
    spWhichPage: 'Which page should this section appear on?',
  },
  fr: {
    home: 'ACCUEIL',
    edit: 'Éditer', preview: 'Aperçu', export: 'Export', tips: 'Astuces',
    resume: 'CV', coverLetter: 'Lettre',
    saved: 'Enregistré', saving: 'Enregistrement…', unsaved: 'Non enregistré',
    font: 'Apparence', versions: 'Versions', account: 'Compte', admin: 'Admin', demo: 'DÉMO',
    createAccount: 'Créer un compte →', signOut: 'Déconnexion',
    ttHome: 'Retour à vos profils',
    ttFont: 'Apparence : police, couleur, papier, pages et sections',
    ttVersions: 'Versions — sauvegardes automatiques avant chaque import',
    ttAccount: 'Paramètres — mot de passe, données, compte',
    ttAdmin: 'Espace admin',
    ttExitDemo: 'Quitter la démo et créer un compte',
    ttSignOut: 'Déconnexion',
    swLimit: 'Limite démo', swTitle: 'Cette fonction nécessite un', swTitleAccent: 'compte.', swBody: "Vous êtes en mode démo. L'enregistrement, les liens de partage, les versions et les fonctions IA nécessitent un compte — l'inscription prend 30 secondes, avec un code d'invitation fourni par la personne qui vous a montré l'outil.", swStay: 'Rester en démo',
    zoomDone: 'Terminé', tapToWrite: 'Touchez un texte pour écrire',
    close: 'Fermer', menu: 'Menu', chooseTemplate: 'Choisir un modèle', typeAndPage: 'Apparence',
    docTypeLabel: 'Document', langLabel: 'Langue du CV',
    uiLangLabel: "Langue de l'interface",
    spFontSize: 'Taille de police', spTypeface: 'Police', spAccent: "Couleur d'accent", spPaper: 'Papier',
    spFormat: 'Format', spPageCount: 'Nombre de pages', spSections: 'Sections',
    spPaperAuto: ' — le papier pour lequel ce modèle a été conçu.',
    spPaperOverride: ' — remplace le papier du modèle.',
    spTooLong: (z, l) => `Environ ${z} caractères de trop (${l} ${l === 1 ? 'ligne' : 'lignes'}). Ces passages peuvent les céder :`,
    spEnough: 'Ensemble, cela suffit.',
    spPartly: "Cela en règle une partie — à revoir ensuite.",
    spShowAgain: 'Réafficher', spHide: 'Masquer',
    spAccentTemplate: 'Couleur du modèle', spPaperTemplate: 'Couleur du modèle',
    spWhichPage: 'Sur quelle page cette section doit-elle apparaître ?',
  },
  es: {
    home: 'INICIO',
    edit: 'Editar', preview: 'Vista previa', export: 'Exportar', tips: 'Consejos',
    resume: 'Currículum', coverLetter: 'Carta',
    saved: 'Guardado', saving: 'Guardando…', unsaved: 'Sin guardar',
    font: 'Apariencia', versions: 'Versiones', account: 'Cuenta', admin: 'Admin', demo: 'DEMO',
    createAccount: 'Crear cuenta →', signOut: 'Cerrar sesión',
    ttHome: 'Volver a tus perfiles',
    ttFont: 'Apariencia: tipografía, color, papel, páginas y secciones',
    ttVersions: 'Versiones — copias de seguridad automáticas antes de importar',
    ttAccount: 'Ajustes — contraseña, datos, cuenta',
    ttAdmin: 'Área de administración',
    ttExitDemo: 'Salir de la demo y crear una cuenta',
    ttSignOut: 'Cerrar sesión',
    swLimit: 'Límite de la demo', swTitle: 'Esta función requiere una', swTitleAccent: 'cuenta.', swBody: 'Estás en modo demo. Guardar, los enlaces para compartir, las versiones y las funciones de IA requieren una cuenta — registrarse lleva 30 segundos y recibes un código de invitación de quien te enseñó la herramienta.', swStay: 'Seguir en la demo',
    zoomDone: 'Listo', tapToWrite: 'Toca un texto para escribir',
    close: 'Cerrar', menu: 'Menú', chooseTemplate: 'Elegir plantilla', typeAndPage: 'Apariencia',
    docTypeLabel: 'Documento', langLabel: 'Idioma del CV',
    uiLangLabel: 'Idioma de la interfaz',
    spFontSize: 'Tamaño de fuente', spTypeface: 'Tipografía', spAccent: 'Color de acento', spPaper: 'Papel',
    spFormat: 'Formato', spPageCount: 'Número de páginas', spSections: 'Secciones',
    spPaperAuto: ' — el papel para el que se creó esta plantilla.',
    spPaperOverride: ' — sustituye el papel de la plantilla.',
    spTooLong: (z, l) => `Unos ${z} caracteres de más (${l} ${l === 1 ? 'línea' : 'líneas'}). Estos pasajes pueden cederlos:`,
    spEnough: 'Juntos bastan.',
    spPartly: 'Eso cubre una parte — después vuelve a mirar.',
    spShowAgain: 'Volver a mostrar', spHide: 'Ocultar',
    spAccentTemplate: 'Color de la plantilla', spPaperTemplate: 'Color de la plantilla',
    spWhichPage: '¿En qué página debe aparecer esta sección?',
  },
};

/**
 * i18n für die Editor-Panels selbst (Formularfelder, Labels, Placeholders,
 * Hinweise, Buttons, Tooltips, Alerts). Folgt ebenfalls der UI-Sprache.
 * Produktnamen (LinkedIn, GitHub, React …) und die SOCIAL_PLATFORMS-Map
 * bleiben unübersetzt.
 */
export interface PanelStrings {
  // Section tabs
  tabPersonal: string; tabProfil: string; tabErfahrung: string;
  tabBildung: string; tabSkills: string; tabSprachen: string; tabTexte: string;
  // Reiter „Beschriftungen"
  labelsIntro: string; labelsSections: string; labelsFields: string; labelsMisc: string;
  labelsFooter: string; labelsReset: string; labelsResetAll: string;

  // Common
  add: string;            // '+ Hinzufügen'
  remove: string;         // Tooltip 'Entfernen'

  // Socials
  socialsLabel: string;
  socialsEmpty: string;

  // Personal — photo
  photo: string;
  photoUpload: string;
  photoRemove: string;
  photoDisabledTitle: string;
  /** Titel des Vorschaubilds, wenn schon ein Foto liegt — es ist dann der
   *  Knopf zum Nachjustieren des Ausschnitts. */
  photoRecropTitle: string;
  photoChooseTitle: string;
  photoDemoHint: string;
  photoUrlHint: string;
  photoUrlPlaceholder: string;
  // Zuschneiden
  cropTitle: string;
  cropHint: string;
  cropZoom: string;
  cropPortrait: string;
  cropSquare: string;
  cropApply: string;
  cropCancel: string;
  alertTooLarge: string;
  alertUploadFailed: string;
  alertUnknown: string;
  readerError: string;

  // Personal — fields
  name: string; jobTitle: string; email: string; phone: string;
  locationAddress: string; website: string;
  personalNote: string;
  birthDate: string; birthDatePlaceholder: string;
  birthPlace: string; maritalStatus: string; nationality: string; driversLicense: string;
  // Unterschrift am Blattfuß (nur Vorlagen, die eine zeigen)
  signatureHead: string; signatureHint: string; signatureCity: string; signatureDate: string;

  // Profile
  profileHint: string; profileLabel: string; profilePlaceholder: string;

  // Experience
  entries: string;
  dragToReorder: string;
  newPosition: string;
  dragTitle: string;
  moveUp: string; moveDown: string;
  hideInResume: string;
  expRole: string; expCompany: string; expLocation: string;
  expFrom: string; expFromPlaceholder: string;
  expTo: string; expToPlaceholder: string;
  expBulletsLabel: string;
  bulletsPlaceholder: string;

  // Bullet hints
  hintResponsible: string;
  hintWorkedOn: string;
  hintHelped: string;
  hintTaskList: string;
  hintResponsibleEn: string;
  hintHelpedEn: string;
  hintNoNumber: string;

  // Education
  newEntry: string;
  eduDegree: string; eduInstitution: string;
  eduFrom: string; eduTo: string; eduYearPlaceholder: string;
  eduNotes: string; eduNotesPlaceholder: string;

  // Skills
  skillsHint: string;
  newGroupLabel: string;
  groupName: string;
  removeGroup: string;
  skillsItemsLabel: string;
  addGroup: string;
  skillsItemsPlaceholder: string;
  additionalExpLabel: string;
  additionalExpPlaceholder: string;

  // Languages
  langLanguage: string;
  langLevel: string;
  langLevelPlaceholder: string;
  addLanguage: string;
  scale: string;
  scaleAria: string;
  ofFive: string;
  scaleClearTitle: string;
  auto: string;

  // Cover letter
  clTitle: string; clSubtitle: string;
  clRecipient: string; clRecipientHint: string;
  clCompany: string; clCompanyPlaceholder: string;
  clContact: string; clContactPlaceholder: string;
  clAddress: string; clAddressPlaceholder: string;
  clHead: string; clHeadHint: string;
  clCity: string; clCityPlaceholder: string;
  clDate: string; clDatePlaceholder: string;
  clSubject: string; clSubjectPlaceholder: string;
  clSalutation: string; clSalutationPlaceholder: string;
  clBody: string; clBodyHint: string;
  clIntro: string; clIntroPlaceholder: string;
  clMain: string; clMainPlaceholder: string;
  clCompanyRef: string; clCompanyRefPlaceholder: string;
  clMotivation: string; clMotivationPlaceholder: string;
  clClosing: string; clClosingPlaceholder: string;
  clSignoffSection: string; clSignoffHint: string;
  clShowDateline: string; clShowDatelineHint: string;
  clShowSignature: string; clShowSignatureHint: string;
  clSignoff: string; clSignoffPlaceholder: string;
  clFooter: string;
}

export const EP: Record<UiLang, PanelStrings> = {
  de: {
    tabPersonal: 'Persönlich', tabProfil: 'Profil', tabErfahrung: 'Erfahrung',
    tabBildung: 'Bildung', tabSkills: 'Skills', tabSprachen: 'Sprachen',
    tabTexte: 'Texte',
    labelsIntro: 'Jede Überschrift und jede Feldbezeichnung im Dokument gehört dir. Änderungen gelten für diese Sprachfassung; die anderen bleiben, wie sie sind.',
    labelsSections: 'Überschriften', labelsFields: 'Feldbezeichnungen', labelsMisc: 'Sonstiges',
    labelsFooter: 'Fußzeile', labelsReset: 'Zurücksetzen', labelsResetAll: 'Alle Texte zurücksetzen',

    add: '+ Hinzufügen',
    remove: 'Entfernen',

    socialsLabel: 'Social-Profile',
    socialsEmpty: 'Noch keine Profile. Klick auf „Hinzufügen", um z. B. LinkedIn, GitHub oder Bluesky einzutragen.',

    photo: 'Foto',
    photoUpload: 'Foto hochladen',
    cropTitle: 'Bild zuschneiden',
    cropHint: 'Ziehen zum Verschieben, Regler zum Vergrößern. Der sichtbare Ausschnitt wird gespeichert.',
    cropZoom: 'Größe',
    cropPortrait: 'Hochformat',
    cropSquare: 'Quadrat',
    cropApply: 'Übernehmen',
    cropCancel: 'Abbrechen',
    photoRemove: '× Entfernen',
    photoRecropTitle: 'Zum Zuschneiden anklicken',
    photoDisabledTitle: 'Im Demo-Modus deaktiviert — Konto anlegen, um Fotos hochzuladen',
    photoChooseTitle: 'Foto-Datei wählen',
    photoDemoHint: 'Foto-Upload und URL-Eingabe sind im Demo-Modus deaktiviert. Lege ein Konto an, um eigene Fotos zu nutzen.',
    photoUrlHint: 'Oder gib eine URL ein:',
    photoUrlPlaceholder: 'https://... oder leer lassen',
    alertTooLarge: 'Datei zu groß (max. 4 MB).',
    alertUploadFailed: 'Foto-Upload fehlgeschlagen: ',
    alertUnknown: 'unbekannt',
    readerError: 'FileReader-Fehler',

    name: 'Name', jobTitle: 'Berufsbezeichnung', email: 'E-Mail', phone: 'Telefon',
    locationAddress: 'Ort / Adresse', website: 'Website',
    personalNote: 'Hinweis: Familienstand, Geburtsort und Staatsangehörigkeit sind im deutschen Lebenslauf 2026 nicht mehr Standard und können weggelassen werden. Leere Felder werden nicht angezeigt.',
    birthDate: 'Geburtsdatum', birthDatePlaceholder: 'z. B. 01.01.1990',
    birthPlace: 'Geburtsort', maritalStatus: 'Familienstand', nationality: 'Nationalität', driversLicense: 'Führerschein',
    signatureHead: 'Unterschrift', signatureCity: 'Ort', signatureDate: 'Datum',
    signatureHint: 'Vorlagen im Bewerbungsset-Stil setzen unten Ort, Datum und einen Schriftzug. Der Schriftzug ist gesetzt, kein Scan — genau wie bei den gekauften Vorlagen. Leer lassen: Ort kommt aus der Adresse, Datum ist immer heute.',

    profileHint: 'Das Kurzprofil erscheint direkt unter deinem Namen. 2–4 Sätze, spezifisch und wirkungsstark.',
    profileLabel: 'Profil-Text',
    profilePlaceholder: 'Kurze, wirkungsstarke Beschreibung deiner Kernkompetenzen...',

    entries: 'Einträge',
    dragToReorder: 'ziehen zum Sortieren',
    newPosition: 'Neue Stelle',
    dragTitle: 'Ziehen zum Sortieren',
    moveUp: 'Nach oben', moveDown: 'Nach unten',
    hideInResume: 'Im Lebenslauf ausblenden',
    expRole: 'Position / Rolle', expCompany: 'Unternehmen', expLocation: 'Ort',
    expFrom: 'Von', expFromPlaceholder: 'MM/JJJJ',
    expTo: 'Bis (leer = aktuell)', expToPlaceholder: 'MM/JJJJ oder leer',
    expBulletsLabel: 'Aufgaben & Erfolge (ein Punkt pro Zeile)',
    bulletsPlaceholder: 'Verantwortlichkeit oder Erfolg\nNächster Punkt...\nAktion + Kontext + Ergebnis',

    hintResponsible: 'Beginne mit einem aktiven Verb statt „Verantwortlich für…". Beispiel: „Führte…", „Skalierte…", „Reduzierte…".',
    hintWorkedOn: 'Verb stärken: „Arbeitete an X" → „Implementierte X" oder „Lieferte X aus".',
    hintHelped: '„Half/Unterstützte" macht dich kleiner als du bist. Was hast du konkret geliefert?',
    hintTaskList: 'Statt einer Aufgaben-Liste pro Punkt einen Erfolg formulieren — Aktion + Kontext + messbares Ergebnis.',
    hintResponsibleEn: 'Beginne mit einem aktiven Verb: „Führte…", „Lieferte…", „Reduzierte…", „Steigerte…".',
    hintHelpedEn: '„Helped/Assisted" minimiert deinen Beitrag — was hast du konkret geliefert?',
    hintNoNumber: 'Stärker mit Zahl/Wirkung: „… 30 % schneller", „… 2 → 14 Kunden", „… 4 Mio. €".',

    newEntry: 'Neuer Eintrag',
    eduDegree: 'Abschluss / Studiengang', eduInstitution: 'Hochschule / Institution',
    eduFrom: 'Von', eduTo: 'Bis', eduYearPlaceholder: 'JJJJ',
    eduNotes: 'Anmerkung (optional)', eduNotesPlaceholder: 'z. B. Schwerpunkte, Note, Auszeichnung...',

    skillsHint: 'Gib Skills kommagetrennt oder zeilenweise ein. Jede Gruppe erscheint als eigener Abschnitt in der Seitenleiste.',
    newGroupLabel: 'Neue Gruppe',
    groupName: 'Gruppenname',
    removeGroup: 'Gruppe entfernen',
    skillsItemsLabel: 'Skills (kommagetrennt oder ein Skill pro Zeile)',
    addGroup: '+ Gruppe hinzufügen',
    skillsItemsPlaceholder: 'React, TypeScript, Node.js, ...',
    additionalExpLabel: 'Zusätzliche Erfahrungen (ein Punkt pro Zeile)',
    additionalExpPlaceholder: 'Ehrenamt, Projekte, Interessen...',

    langLanguage: 'Sprache',
    langLevel: 'Niveau',
    langLevelPlaceholder: 'z. B. Muttersprache, C1, B2...',
    addLanguage: '+ Sprache hinzufügen',
    scale: 'Skala',
    scaleAria: 'Sprach-Skala',
    ofFive: 'von 5',
    scaleClearTitle: 'Skala löschen — Template leitet sie aus dem Text-Niveau ab',
    auto: 'Auto',

    clTitle: 'Anschreiben bearbeiten', clSubtitle: 'Abschnitte aufklappen und ausfüllen',
    clRecipient: 'Empfänger', clRecipientHint: 'Unternehmen, Kontaktperson, Adresse',
    clCompany: 'Unternehmen', clCompanyPlaceholder: 'Musterag GmbH',
    clContact: 'Kontaktperson', clContactPlaceholder: 'Frau Müller (optional)',
    clAddress: 'Adresse', clAddressPlaceholder: 'Musterstraße 1, 20000 Hamburg',
    clHead: 'Briefkopf', clHeadHint: 'Ort, Datum, Betreff, Anrede',
    clCity: 'Absenderort', clCityPlaceholder: 'Hamburg',
    clDate: 'Datum', clDatePlaceholder: '21. Mai 2026',
    clSubject: 'Betreff', clSubjectPlaceholder: 'Bewerbung als Senior Marketing Manager',
    clSalutation: 'Anrede', clSalutationPlaceholder: 'Sehr geehrte Damen und Herren,',
    clBody: 'Brieftext', clBodyHint: 'Einstieg, Qualifikation, Bezug, Motivation, Abschluss',
    clIntro: 'Einstieg', clIntroPlaceholder: 'Mit großem Interesse habe ich Ihre Stellenausschreibung gelesen…',
    clMain: 'Qualifikationen & Erfahrungen', clMainPlaceholder: 'In meiner bisherigen Laufbahn habe ich…',
    clCompanyRef: 'Unternehmensbezug', clCompanyRefPlaceholder: 'Ihr Unternehmen überzeugt mich durch…',
    clMotivation: 'Motivation', clMotivationPlaceholder: 'Die ausgeschriebene Position bietet mir die Möglichkeit…',
    clClosing: 'Abschluss', clClosingPlaceholder: 'Über die Möglichkeit, mich Ihnen persönlich vorzustellen…',
    clSignoffSection: 'Grußformel', clSignoffHint: 'Schlussformel',
    clShowDateline: 'Ort und Datum zeigen', clShowDatelineHint: 'Aus = zeitlose Fassung. Die Eingaben bleiben erhalten.',
    clShowSignature: 'Unterschriftszeile zeigen', clShowSignatureHint: 'Linie und Name unter der Grußformel.',
    clSignoff: 'Grußformel', clSignoffPlaceholder: 'Mit freundlichen Grüßen',
    clFooter: 'Absender (Name, Kontaktdaten) und Vorlage werden automatisch aus dem Lebenslauf übernommen.',
  },
  en: {
    tabPersonal: 'Personal', tabProfil: 'Profile', tabErfahrung: 'Experience',
    tabBildung: 'Education', tabSkills: 'Skills', tabSprachen: 'Languages',
    tabTexte: 'Wording',
    labelsIntro: 'Every heading and field label in the document is yours. Changes apply to this language version; the others stay as they are.',
    labelsSections: 'Headings', labelsFields: 'Field labels', labelsMisc: 'Other',
    labelsFooter: 'Footer', labelsReset: 'Reset', labelsResetAll: 'Reset all wording',

    add: '+ Add',
    remove: 'Remove',

    socialsLabel: 'Social profiles',
    socialsEmpty: 'No profiles yet. Click "Add" to enter e.g. LinkedIn, GitHub or Bluesky.',

    photo: 'Photo',
    photoUpload: 'Upload photo',
    cropTitle: 'Crop photo',
    cropHint: 'Drag to move, slider to zoom. What you see is what gets saved.',
    cropZoom: 'Size',
    cropPortrait: 'Portrait',
    cropSquare: 'Square',
    cropApply: 'Apply',
    cropCancel: 'Cancel',
    photoRemove: '× Remove',
    photoRecropTitle: 'Click to crop',
    photoDisabledTitle: 'Disabled in demo mode — create an account to upload photos',
    photoChooseTitle: 'Choose photo file',
    photoDemoHint: 'Photo upload and URL entry are disabled in demo mode. Create an account to use your own photos.',
    photoUrlHint: 'Or enter a URL:',
    photoUrlPlaceholder: 'https://... or leave empty',
    alertTooLarge: 'File too large (max. 4 MB).',
    alertUploadFailed: 'Photo upload failed: ',
    alertUnknown: 'unknown',
    readerError: 'FileReader error',

    name: 'Name', jobTitle: 'Job title', email: 'Email', phone: 'Phone',
    locationAddress: 'City / Address', website: 'Website',
    personalNote: 'Note: Marital status, place of birth and nationality are no longer standard on a German CV in 2026 and can be left out. Empty fields are not shown.',
    birthDate: 'Date of birth', birthDatePlaceholder: 'e.g. 01/01/1990',
    birthPlace: 'Place of birth', maritalStatus: 'Marital status', nationality: 'Nationality', driversLicense: 'Driving licence',
    signatureHead: 'Signature', signatureCity: 'Place', signatureDate: 'Date',
    signatureHint: 'Application-set templates put place, date and a signature at the foot. The signature is typeset, not a scan — exactly as in the bought templates. Leave empty: place comes from the address, date is always today.',

    profileHint: 'The short profile appears right under your name. 2–4 sentences, specific and impactful.',
    profileLabel: 'Profile text',
    profilePlaceholder: 'Short, impactful description of your core strengths...',

    entries: 'entries',
    dragToReorder: 'drag to reorder',
    newPosition: 'New position',
    dragTitle: 'Drag to reorder',
    moveUp: 'Move up', moveDown: 'Move down',
    hideInResume: 'Hide in resume',
    expRole: 'Position / Role', expCompany: 'Company', expLocation: 'Location',
    expFrom: 'From', expFromPlaceholder: 'MM/YYYY',
    expTo: 'To (empty = present)', expToPlaceholder: 'MM/YYYY or empty',
    expBulletsLabel: 'Responsibilities & achievements (one point per line)',
    bulletsPlaceholder: 'Responsibility or achievement\nNext point...\nAction + context + result',

    hintResponsible: 'Start with an active verb instead of "Responsible for…". Example: "Led…", "Scaled…", "Reduced…".',
    hintWorkedOn: 'Strengthen the verb: "Worked on X" → "Implemented X" or "Shipped X".',
    hintHelped: '"Helped/Supported" makes you smaller than you are. What did you concretely deliver?',
    hintTaskList: 'Instead of a task list, phrase each point as an achievement — action + context + measurable result.',
    hintResponsibleEn: 'Lead with an active verb: "Led…", "Shipped…", "Cut…", "Grew…".',
    hintHelpedEn: '"Helped/Assisted" minimizes your contribution — what did you concretely deliver?',
    hintNoNumber: 'Stronger with a number/impact: "… 30% faster", "… 2 → 14 customers", "… €4M".',

    newEntry: 'New entry',
    eduDegree: 'Degree / Programme', eduInstitution: 'University / Institution',
    eduFrom: 'From', eduTo: 'To', eduYearPlaceholder: 'YYYY',
    eduNotes: 'Note (optional)', eduNotesPlaceholder: 'e.g. focus areas, grade, honours...',

    skillsHint: 'Enter skills comma-separated or one per line. Each group appears as its own section in the sidebar.',
    newGroupLabel: 'New group',
    groupName: 'Group name',
    removeGroup: 'Remove group',
    skillsItemsLabel: 'Skills (comma-separated or one skill per line)',
    addGroup: '+ Add group',
    skillsItemsPlaceholder: 'React, TypeScript, Node.js, ...',
    additionalExpLabel: 'Additional experience (one point per line)',
    additionalExpPlaceholder: 'Volunteering, projects, interests...',

    langLanguage: 'Language',
    langLevel: 'Level',
    langLevelPlaceholder: 'e.g. native, C1, B2...',
    addLanguage: '+ Add language',
    scale: 'Scale',
    scaleAria: 'Language scale',
    ofFive: 'of 5',
    scaleClearTitle: 'Clear scale — template derives it from the text level',
    auto: 'Auto',

    clTitle: 'Edit cover letter', clSubtitle: 'Expand and fill in the sections',
    clRecipient: 'Recipient', clRecipientHint: 'Company, contact person, address',
    clCompany: 'Company', clCompanyPlaceholder: 'Example Ltd.',
    clContact: 'Contact person', clContactPlaceholder: 'Ms. Smith (optional)',
    clAddress: 'Address', clAddressPlaceholder: '123 Example St, London',
    clHead: 'Letterhead', clHeadHint: 'City, date, subject, salutation',
    clCity: 'Sender city', clCityPlaceholder: 'London',
    clDate: 'Date', clDatePlaceholder: 'May 21, 2026',
    clSubject: 'Subject', clSubjectPlaceholder: 'Application for Senior Marketing Manager',
    clSalutation: 'Salutation', clSalutationPlaceholder: 'Dear Sir or Madam,',
    clBody: 'Letter body', clBodyHint: 'Intro, qualifications, reference, motivation, closing',
    clIntro: 'Introduction', clIntroPlaceholder: 'I read your job posting with great interest…',
    clMain: 'Qualifications & experience', clMainPlaceholder: 'In my career so far I have…',
    clCompanyRef: 'Company reference', clCompanyRefPlaceholder: 'Your company convinces me through…',
    clMotivation: 'Motivation', clMotivationPlaceholder: 'The advertised position offers me the opportunity…',
    clClosing: 'Closing', clClosingPlaceholder: 'I would welcome the opportunity to introduce myself in person…',
    clSignoffSection: 'Sign-off', clSignoffHint: 'Closing phrase',
    clShowDateline: 'Show place and date', clShowDatelineHint: 'Off = undated version. Your entries are kept.',
    clShowSignature: 'Show signature line', clShowSignatureHint: 'Rule and name below the sign-off.',
    clSignoff: 'Sign-off', clSignoffPlaceholder: 'Kind regards',
    clFooter: 'Sender (name, contact details) and template are taken automatically from the resume.',
  },
  fr: {
    tabPersonal: 'Personnel', tabProfil: 'Profil', tabErfahrung: 'Expérience',
    tabBildung: 'Formation', tabSkills: 'Compétences', tabSprachen: 'Langues',
    tabTexte: 'Libellés',
    labelsIntro: 'Chaque titre et chaque libellé du document vous appartient. Les modifications valent pour cette version linguistique ; les autres restent inchangées.',
    labelsSections: 'Titres', labelsFields: 'Libellés de champ', labelsMisc: 'Divers',
    labelsFooter: 'Pied de page', labelsReset: 'Réinitialiser', labelsResetAll: 'Tout réinitialiser',

    add: '+ Ajouter',
    remove: 'Supprimer',

    socialsLabel: 'Profils sociaux',
    socialsEmpty: 'Aucun profil pour l\'instant. Cliquez sur « Ajouter » pour saisir par ex. LinkedIn, GitHub ou Bluesky.',

    photo: 'Photo',
    photoUpload: 'Téléverser une photo',
    cropTitle: 'Recadrer la photo',
    cropHint: 'Glissez pour déplacer, curseur pour agrandir. La zone visible est enregistrée.',
    cropZoom: 'Taille',
    cropPortrait: 'Portrait',
    cropSquare: 'Carré',
    cropApply: 'Appliquer',
    cropCancel: 'Annuler',
    photoRemove: '× Supprimer',
    photoRecropTitle: 'Cliquer pour recadrer',
    photoDisabledTitle: 'Désactivé en mode démo — créez un compte pour téléverser des photos',
    photoChooseTitle: 'Choisir un fichier photo',
    photoDemoHint: 'Le téléversement de photo et la saisie d\'URL sont désactivés en mode démo. Créez un compte pour utiliser vos propres photos.',
    photoUrlHint: 'Ou saisissez une URL :',
    photoUrlPlaceholder: 'https://... ou laisser vide',
    alertTooLarge: 'Fichier trop volumineux (max. 4 Mo).',
    alertUploadFailed: 'Échec du téléversement de la photo : ',
    alertUnknown: 'inconnu',
    readerError: 'Erreur FileReader',

    name: 'Nom', jobTitle: 'Intitulé du poste', email: 'E-mail', phone: 'Téléphone',
    locationAddress: 'Ville / Adresse', website: 'Site web',
    personalNote: 'Remarque : la situation familiale, le lieu de naissance et la nationalité ne sont plus standard sur un CV allemand en 2026 et peuvent être omis. Les champs vides ne sont pas affichés.',
    birthDate: 'Date de naissance', birthDatePlaceholder: 'p. ex. 01/01/1990',
    birthPlace: 'Lieu de naissance', maritalStatus: 'Situation familiale', nationality: 'Nationalité', driversLicense: 'Permis de conduire',
    signatureHead: 'Signature', signatureCity: 'Lieu', signatureDate: 'Date',
    signatureHint: 'Les modèles de type dossier de candidature placent lieu, date et une signature en bas. La signature est composée, ce n’est pas un scan — comme dans les modèles achetés. Laissez vide : le lieu vient de l’adresse, la date est toujours celle du jour.',

    profileHint: 'Le profil court apparaît juste sous votre nom. 2 à 4 phrases, précises et percutantes.',
    profileLabel: 'Texte du profil',
    profilePlaceholder: 'Description courte et percutante de vos compétences clés...',

    entries: 'entrées',
    dragToReorder: 'glisser pour réordonner',
    newPosition: 'Nouveau poste',
    dragTitle: 'Glisser pour réordonner',
    moveUp: 'Monter', moveDown: 'Descendre',
    hideInResume: 'Masquer dans le CV',
    expRole: 'Poste / Rôle', expCompany: 'Entreprise', expLocation: 'Lieu',
    expFrom: 'De', expFromPlaceholder: 'MM/YYYY',
    expTo: 'À (vide = actuel)', expToPlaceholder: 'MM/YYYY ou vide',
    expBulletsLabel: 'Missions et réussites (un point par ligne)',
    bulletsPlaceholder: 'Responsabilité ou réussite\nPoint suivant...\nAction + contexte + résultat',

    hintResponsible: 'Commencez par un verbe d\'action plutôt que « Responsable de… ». Exemple : « Dirigé… », « Développé… », « Réduit… ».',
    hintWorkedOn: 'Renforcez le verbe : « Travaillé sur X » → « Implémenté X » ou « Livré X ».',
    hintHelped: '« Aidé/Soutenu » vous diminue. Qu\'avez-vous concrètement livré ?',
    hintTaskList: 'Plutôt qu\'une liste de tâches, formulez chaque point comme une réussite — action + contexte + résultat mesurable.',
    hintResponsibleEn: 'Commencez par un verbe d\'action : « Dirigé… », « Livré… », « Réduit… », « Augmenté… ».',
    hintHelpedEn: '« Helped/Assisted » minimise votre contribution — qu\'avez-vous concrètement livré ?',
    hintNoNumber: 'Plus fort avec un chiffre/impact : « … 30 % plus vite », « … 2 → 14 clients », « … 4 M€ ».',

    newEntry: 'Nouvelle entrée',
    eduDegree: 'Diplôme / Filière', eduInstitution: 'Université / Établissement',
    eduFrom: 'De', eduTo: 'À', eduYearPlaceholder: 'YYYY',
    eduNotes: 'Remarque (facultatif)', eduNotesPlaceholder: 'p. ex. spécialisations, mention, distinction...',

    skillsHint: 'Saisissez les compétences séparées par des virgules ou une par ligne. Chaque groupe apparaît comme une section distincte dans la barre latérale.',
    newGroupLabel: 'Nouveau groupe',
    groupName: 'Nom du groupe',
    removeGroup: 'Supprimer le groupe',
    skillsItemsLabel: 'Compétences (séparées par des virgules ou une par ligne)',
    addGroup: '+ Ajouter un groupe',
    skillsItemsPlaceholder: 'React, TypeScript, Node.js, ...',
    additionalExpLabel: 'Expériences supplémentaires (un point par ligne)',
    additionalExpPlaceholder: 'Bénévolat, projets, centres d\'intérêt...',

    langLanguage: 'Langue',
    langLevel: 'Niveau',
    langLevelPlaceholder: 'p. ex. langue maternelle, C1, B2...',
    addLanguage: '+ Ajouter une langue',
    scale: 'Échelle',
    scaleAria: 'Échelle de langue',
    ofFive: 'sur 5',
    scaleClearTitle: 'Effacer l\'échelle — le modèle la déduit du niveau textuel',
    auto: 'Auto',

    clTitle: 'Modifier la lettre de motivation', clSubtitle: 'Dépliez et remplissez les sections',
    clRecipient: 'Destinataire', clRecipientHint: 'Entreprise, personne de contact, adresse',
    clCompany: 'Entreprise', clCompanyPlaceholder: 'Exemple SARL',
    clContact: 'Personne de contact', clContactPlaceholder: 'Mme Dupont (facultatif)',
    clAddress: 'Adresse', clAddressPlaceholder: '1 rue Exemple, 75000 Paris',
    clHead: 'En-tête', clHeadHint: 'Ville, date, objet, formule d\'appel',
    clCity: 'Ville de l\'expéditeur', clCityPlaceholder: 'Paris',
    clDate: 'Date', clDatePlaceholder: '21 mai 2026',
    clSubject: 'Objet', clSubjectPlaceholder: 'Candidature au poste de Senior Marketing Manager',
    clSalutation: 'Formule d\'appel', clSalutationPlaceholder: 'Madame, Monsieur,',
    clBody: 'Corps de la lettre', clBodyHint: 'Introduction, qualifications, lien, motivation, conclusion',
    clIntro: 'Introduction', clIntroPlaceholder: 'C\'est avec grand intérêt que j\'ai lu votre offre d\'emploi…',
    clMain: 'Qualifications et expériences', clMainPlaceholder: 'Au cours de ma carrière, j\'ai…',
    clCompanyRef: 'Lien avec l\'entreprise', clCompanyRefPlaceholder: 'Votre entreprise me convainc par…',
    clMotivation: 'Motivation', clMotivationPlaceholder: 'Le poste proposé m\'offre la possibilité…',
    clClosing: 'Conclusion', clClosingPlaceholder: 'Je serais ravi de me présenter à vous en personne…',
    clSignoffSection: 'Formule de politesse', clSignoffHint: 'Formule finale',
    clShowDateline: 'Afficher lieu et date', clShowDatelineHint: 'Désactivé = version sans date. Les saisies sont conservées.',
    clShowSignature: 'Afficher la ligne de signature', clShowSignatureHint: 'Trait et nom sous la formule.',
    clSignoff: 'Formule de politesse', clSignoffPlaceholder: 'Cordialement',
    clFooter: 'L\'expéditeur (nom, coordonnées) et le modèle sont repris automatiquement du CV.',
  },
  es: {
    tabPersonal: 'Personal', tabProfil: 'Perfil', tabErfahrung: 'Experiencia',
    tabBildung: 'Formación', tabSkills: 'Competencias', tabSprachen: 'Idiomas',
    tabTexte: 'Rótulos',
    labelsIntro: 'Cada título y cada rótulo del documento es tuyo. Los cambios valen para esta versión de idioma; las demás quedan igual.',
    labelsSections: 'Títulos', labelsFields: 'Rótulos de campo', labelsMisc: 'Otros',
    labelsFooter: 'Pie de página', labelsReset: 'Restablecer', labelsResetAll: 'Restablecer todos los rótulos',

    add: '+ Añadir',
    remove: 'Quitar',

    socialsLabel: 'Perfiles sociales',
    socialsEmpty: 'Aún no hay perfiles. Haz clic en «Añadir» para introducir p. ej. LinkedIn, GitHub o Bluesky.',

    photo: 'Foto',
    photoUpload: 'Subir foto',
    cropTitle: 'Recortar foto',
    cropHint: 'Arrastra para mover, control para ampliar. Se guarda lo que se ve.',
    cropZoom: 'Tamaño',
    cropPortrait: 'Vertical',
    cropSquare: 'Cuadrado',
    cropApply: 'Aplicar',
    cropCancel: 'Cancelar',
    photoRemove: '× Quitar',
    photoRecropTitle: 'Haz clic para recortar',
    photoDisabledTitle: 'Desactivado en el modo demo — crea una cuenta para subir fotos',
    photoChooseTitle: 'Elegir archivo de foto',
    photoDemoHint: 'La subida de fotos y la introducción de URL están desactivadas en el modo demo. Crea una cuenta para usar tus propias fotos.',
    photoUrlHint: 'O introduce una URL:',
    photoUrlPlaceholder: 'https://... o dejar vacío',
    alertTooLarge: 'Archivo demasiado grande (máx. 4 MB).',
    alertUploadFailed: 'Error al subir la foto: ',
    alertUnknown: 'desconocido',
    readerError: 'Error de FileReader',

    name: 'Nombre', jobTitle: 'Puesto / Cargo', email: 'Correo electrónico', phone: 'Teléfono',
    locationAddress: 'Ciudad / Dirección', website: 'Sitio web',
    personalNote: 'Nota: el estado civil, el lugar de nacimiento y la nacionalidad ya no son estándar en un currículum alemán en 2026 y pueden omitirse. Los campos vacíos no se muestran.',
    birthDate: 'Fecha de nacimiento', birthDatePlaceholder: 'p. ej. 01/01/1990',
    birthPlace: 'Lugar de nacimiento', maritalStatus: 'Estado civil', nationality: 'Nacionalidad', driversLicense: 'Carné de conducir',
    signatureHead: 'Firma', signatureCity: 'Lugar', signatureDate: 'Fecha',
    signatureHint: 'Las plantillas tipo dossier ponen lugar, fecha y una firma al pie. La firma es tipográfica, no un escaneo — igual que en las plantillas compradas. Déjalo vacío: el lugar sale de la dirección, la fecha es siempre hoy.',

    profileHint: 'El perfil breve aparece justo debajo de tu nombre. 2–4 frases, específicas y contundentes.',
    profileLabel: 'Texto del perfil',
    profilePlaceholder: 'Descripción breve y contundente de tus competencias clave...',

    entries: 'entradas',
    dragToReorder: 'arrastra para ordenar',
    newPosition: 'Nuevo puesto',
    dragTitle: 'Arrastra para ordenar',
    moveUp: 'Subir', moveDown: 'Bajar',
    hideInResume: 'Ocultar en el currículum',
    expRole: 'Puesto / Rol', expCompany: 'Empresa', expLocation: 'Ubicación',
    expFrom: 'Desde', expFromPlaceholder: 'MM/YYYY',
    expTo: 'Hasta (vacío = actual)', expToPlaceholder: 'MM/YYYY o vacío',
    expBulletsLabel: 'Funciones y logros (un punto por línea)',
    bulletsPlaceholder: 'Responsabilidad o logro\nSiguiente punto...\nAcción + contexto + resultado',

    hintResponsible: 'Empieza con un verbo activo en vez de «Responsable de…». Ejemplo: «Lideré…», «Escalé…», «Reduje…».',
    hintWorkedOn: 'Refuerza el verbo: «Trabajé en X» → «Implementé X» o «Entregué X».',
    hintHelped: '«Ayudé/Apoyé» te hace más pequeño de lo que eres. ¿Qué entregaste concretamente?',
    hintTaskList: 'En vez de una lista de tareas, formula cada punto como un logro — acción + contexto + resultado medible.',
    hintResponsibleEn: 'Empieza con un verbo activo: «Lideré…», «Entregué…», «Reduje…», «Aumenté…».',
    hintHelpedEn: '«Helped/Assisted» minimiza tu contribución — ¿qué entregaste concretamente?',
    hintNoNumber: 'Más fuerte con una cifra/impacto: «… 30 % más rápido», «… 2 → 14 clientes», «… 4 M€».',

    newEntry: 'Nueva entrada',
    eduDegree: 'Título / Carrera', eduInstitution: 'Universidad / Institución',
    eduFrom: 'Desde', eduTo: 'Hasta', eduYearPlaceholder: 'YYYY',
    eduNotes: 'Nota (opcional)', eduNotesPlaceholder: 'p. ej. especialidades, nota, distinción...',

    skillsHint: 'Introduce las competencias separadas por comas o una por línea. Cada grupo aparece como una sección propia en la barra lateral.',
    newGroupLabel: 'Nuevo grupo',
    groupName: 'Nombre del grupo',
    removeGroup: 'Quitar grupo',
    skillsItemsLabel: 'Competencias (separadas por comas o una por línea)',
    addGroup: '+ Añadir grupo',
    skillsItemsPlaceholder: 'React, TypeScript, Node.js, ...',
    additionalExpLabel: 'Experiencia adicional (un punto por línea)',
    additionalExpPlaceholder: 'Voluntariado, proyectos, intereses...',

    langLanguage: 'Idioma',
    langLevel: 'Nivel',
    langLevelPlaceholder: 'p. ej. nativo, C1, B2...',
    addLanguage: '+ Añadir idioma',
    scale: 'Escala',
    scaleAria: 'Escala de idioma',
    ofFive: 'de 5',
    scaleClearTitle: 'Borrar escala — la plantilla la deduce del nivel de texto',
    auto: 'Auto',

    clTitle: 'Editar carta de presentación', clSubtitle: 'Despliega y rellena las secciones',
    clRecipient: 'Destinatario', clRecipientHint: 'Empresa, persona de contacto, dirección',
    clCompany: 'Empresa', clCompanyPlaceholder: 'Empresa Ejemplo S.L.',
    clContact: 'Persona de contacto', clContactPlaceholder: 'Sra. García (opcional)',
    clAddress: 'Dirección', clAddressPlaceholder: 'Calle Ejemplo 1, 28000 Madrid',
    clHead: 'Encabezado', clHeadHint: 'Ciudad, fecha, asunto, saludo',
    clCity: 'Ciudad del remitente', clCityPlaceholder: 'Madrid',
    clDate: 'Fecha', clDatePlaceholder: '21 de mayo de 2026',
    clSubject: 'Asunto', clSubjectPlaceholder: 'Candidatura para Senior Marketing Manager',
    clSalutation: 'Saludo', clSalutationPlaceholder: 'Estimados señores:',
    clBody: 'Cuerpo de la carta', clBodyHint: 'Introducción, cualificaciones, vínculo, motivación, cierre',
    clIntro: 'Introducción', clIntroPlaceholder: 'He leído con gran interés su oferta de empleo…',
    clMain: 'Cualificaciones y experiencia', clMainPlaceholder: 'A lo largo de mi trayectoria he…',
    clCompanyRef: 'Vínculo con la empresa', clCompanyRefPlaceholder: 'Su empresa me convence por…',
    clMotivation: 'Motivación', clMotivationPlaceholder: 'El puesto ofertado me brinda la oportunidad…',
    clClosing: 'Cierre', clClosingPlaceholder: 'Agradecería la oportunidad de presentarme en persona…',
    clSignoffSection: 'Despedida', clSignoffHint: 'Fórmula de cierre',
    clShowDateline: 'Mostrar lugar y fecha', clShowDatelineHint: 'Desactivado = versión sin fecha. Se conservan los datos.',
    clShowSignature: 'Mostrar línea de firma', clShowSignatureHint: 'Línea y nombre bajo la despedida.',
    clSignoff: 'Despedida', clSignoffPlaceholder: 'Atentamente',
    clFooter: 'El remitente (nombre, datos de contacto) y la plantilla se toman automáticamente del currículum.',
  },
};

// React context so sub-components don't need prop-threading. createContext
// works fine in a .ts module (no JSX here).
export const PanelI18nCtx = createContext<PanelStrings>(EP.de);
export function usePanelT() { return useContext(PanelI18nCtx); }

/**
 * Texte der geteilten Ansicht (`/share/<token>`).
 *
 * Eigene Tabelle, weil diese Seite **niemandem aus dem Konto** gehört: Sie wird
 * an Fremde verschickt. Zwei verschiedene Sprachquellen, und beide sind es mit
 * Absicht:
 *
 *   • Der Rahmen um ein geladenes Dokument folgt der **Sprache des Dokuments**.
 *     Wer einen englischen Lebenslauf verschickt, will nicht, dass die
 *     Personalerin „geteilte Vorschau" liest.
 *   • Die Fehlerseite kann das nicht — es gibt kein Dokument, dessen Sprache
 *     man nehmen könnte. Sie folgt deshalb dem Browser des Empfängers.
 */
export interface ShareStrings {
  sharedPreview: string;
  resume: string;
  coverLetter: string;
  loading: string;
  fallbackName: string;
  revokedTitle: string; revokedBody: string;
  expiredTitle: string; expiredBody: string;
  missingTitle: string; missingBody: string;
  unavailableTitle: string; unavailableBody: string;
  buildYourOwn: string;
}

export const SHARE: Record<UiLang, ShareStrings> = {
  de: {
    sharedPreview: 'geteilte Vorschau',
    resume: 'Lebenslauf', coverLetter: 'Anschreiben',
    loading: 'Lade…', fallbackName: 'Lebenslauf',
    revokedTitle: 'Link wurde widerrufen',
    revokedBody: 'Wer den Link erstellt hat, hat ihn zurückgezogen. Frag nach einem neuen.',
    expiredTitle: 'Link ist abgelaufen',
    expiredBody: 'Dieser Link hatte ein Ablaufdatum, und das liegt zurück. Frag nach einem neuen.',
    missingTitle: 'Link existiert nicht',
    missingBody: 'Zu dieser Adresse gibt es nichts. Vielleicht ist beim Kopieren ein Zeichen verloren gegangen.',
    unavailableTitle: 'Nicht verfügbar',
    unavailableBody: 'Der Link lässt sich gerade nicht öffnen. Später noch einmal versuchen.',
    buildYourOwn: 'Selbst einen Lebenslauf bauen →',
  },
  en: {
    sharedPreview: 'shared preview',
    resume: 'Résumé', coverLetter: 'Cover letter',
    loading: 'Loading…', fallbackName: 'Résumé',
    revokedTitle: 'This link was revoked',
    revokedBody: 'Whoever created the link has withdrawn it. Ask them for a new one.',
    expiredTitle: 'This link has expired',
    expiredBody: 'The link had an expiry date and it has passed. Ask for a new one.',
    missingTitle: 'No such link',
    missingBody: 'There is nothing at this address. A character may have been lost when it was copied.',
    unavailableTitle: 'Not available',
    unavailableBody: 'The link cannot be opened right now. Please try again later.',
    buildYourOwn: 'Build your own résumé →',
  },
  fr: {
    sharedPreview: 'aperçu partagé',
    resume: 'CV', coverLetter: 'Lettre de motivation',
    loading: 'Chargement…', fallbackName: 'CV',
    revokedTitle: 'Ce lien a été révoqué',
    revokedBody: "La personne qui l'a créé l'a retiré. Demandez-lui-en un nouveau.",
    expiredTitle: 'Ce lien a expiré',
    expiredBody: "Le lien avait une date d'expiration, désormais passée. Demandez-en un nouveau.",
    missingTitle: "Ce lien n'existe pas",
    missingBody: "Il n'y a rien à cette adresse. Un caractère a peut-être été perdu lors de la copie.",
    unavailableTitle: 'Indisponible',
    unavailableBody: "Le lien ne peut pas être ouvert pour l'instant. Réessayez plus tard.",
    buildYourOwn: 'Créer votre propre CV →',
  },
  es: {
    sharedPreview: 'vista compartida',
    resume: 'CV', coverLetter: 'Carta de presentación',
    loading: 'Cargando…', fallbackName: 'CV',
    revokedTitle: 'El enlace fue revocado',
    revokedBody: 'Quien creó el enlace lo ha retirado. Pídele uno nuevo.',
    expiredTitle: 'El enlace ha caducado',
    expiredBody: 'El enlace tenía fecha de caducidad y ya pasó. Pide uno nuevo.',
    missingTitle: 'El enlace no existe',
    missingBody: 'No hay nada en esta dirección. Puede que se perdiera un carácter al copiarla.',
    unavailableTitle: 'No disponible',
    unavailableBody: 'El enlace no se puede abrir ahora mismo. Inténtalo más tarde.',
    buildYourOwn: 'Crea tu propio CV →',
  },
};
