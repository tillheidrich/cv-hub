/**
 * Texte des Home-Screens (Profilübersicht, Hero, Vorlagen-Strip, Anlege-Dialog).
 *
 * Eigene Tabelle, weil der Home-Screen vor dem Editor liegt und dessen
 * Chrome-Tabelle (`editorI18n.ts`) nichts von ihm weiß. Die Sprache kommt
 * nicht als Prop herein, sondern über `useUiLang()` — der Screen und seine
 * drei Unterkomponenten lesen sie jeweils selbst.
 *
 * Sätze mit eingesetzten Werten (Anzahl, Datum, Profilname) stehen als
 * Funktionen in der Tabelle. Zusammengeklebte Teilstrings gehen spätestens
 * beim Plural und bei der Wortstellung schief.
 */
import type { UiLang } from '../i18n';

export interface HomeStrings {
  /** Datums-Locale für `toLocaleDateString` — nicht der UI-Sprachcode. */
  dateLocale: string;

  // Kopfzeile
  topBarTagline: string;
  admin: string; ttAdmin: string;
  signOut: string; ttSignOut: string;

  // Hero
  heroOverline: string;
  heroLine1: string; heroLine2: string; heroLine3: string; heroAccent: string;
  heroAnswer: string;
  heroBlurb: string;
  heroNote: string;

  // Vorlagen-Strip
  stripOverline: string;

  // Profil-Liste
  profilesOverline: string;
  profilesEmpty: string;
  profilesCount: (n: number) => string;
  newResume: string;
  profilesHint: string;
  emptyOverline: string;
  emptyHeadline: string;

  // Profil-Zeile
  openAria: (name: string) => string;
  lastOpened: string;
  metaLine: (template: string, lang: string, created: string) => string;
  confirmDelete: string;
  ttDelete: string;
  open: string;

  // Anlege-Dialog
  modalOverline: string;
  modalTitle: string; modalTitleAccent: string;
  nameLabel: string; namePlaceholder: string;
  startLabel: string;
  blankLabel: string; blankDesc: string;
  sampleLabel: string; sampleDesc: string;
  cancel: string; createProfile: string;
}

export const HOME_I18N: Record<UiLang, HomeStrings> = {
  de: {
    dateLocale: 'de-DE',

    topBarTagline: 'LEBENSLAUF & ANSCHREIBEN',
    admin: 'Admin', ttAdmin: 'Admin-Bereich',
    signOut: 'Abmelden', ttSignOut: 'Abmelden',

    heroOverline: 'Lebenslauf-Werkstatt',
    heroLine1: 'Lebensläufe', heroLine2: 'lesen sich heute', heroLine3: 'wie ', heroAccent: 'Formulare.',
    heroAnswer: 'Hier nicht.',
    heroBlurb: 'Zweiunddreißig Vorlagen, die wie editoriale Spreads gesetzt sind. Auto-Fit auf A4. Markdown-Bridge, falls eine KI Korrektur lesen soll. Druckfertig.',
    heroNote: 'Invite-only · keine Cookies, keine IP-Speicherung',

    stripOverline: 'Zweiunddreißig Vorlagen, sechs Archetypen',

    profilesOverline: 'Deine Lebensläufe',
    profilesEmpty: 'Noch nichts angelegt. Fang mit einem leeren Lebenslauf an — oder nimm den Beispiel-Inhalt und überschreib ihn Feld für Feld.',
    profilesCount: n => `${n} Lebenslauf${n === 1 ? '' : 'e'} in deinem Konto. Klick auf einen, um ihn zu öffnen.`,
    newResume: 'Neuer Lebenslauf',
    profilesHint: 'Danach: links eintragen, rechts sofort sehen. Gespeichert wird automatisch — du kannst jederzeit rausgehen und später weitermachen.',
    emptyOverline: 'NULL · PROFILE',
    emptyHeadline: "Hier wird's bald voll.",

    openAria: name => `Lebenslauf „${name}" öffnen`,
    lastOpened: 'ZULETZT GEÖFFNET',
    metaLine: (template, lang, created) => `${template} · ${lang} · angelegt ${created}`,
    confirmDelete: 'Wirklich löschen',
    ttDelete: 'Profil löschen',
    open: 'Öffnen →',

    modalOverline: 'NEU · LEBENSLAUF',
    modalTitle: 'Neuen Lebenslauf', modalTitleAccent: 'anlegen.',
    nameLabel: 'Titel in deiner Übersicht (steht nicht im Lebenslauf)', namePlaceholder: 'z. B. Bewerbung Stadtwerke',
    startLabel: 'Womit anfangen?',
    blankLabel: 'Leer anfangen', blankDesc: 'Alle Felder leer — du tippst deine eigenen Daten ein',
    sampleLabel: 'Mit Beispiel', sampleDesc: 'Ausgefüllter Muster-Lebenslauf zum Überschreiben',
    cancel: 'Abbrechen', createProfile: 'Profil anlegen →',
  },

  en: {
    dateLocale: 'en-GB',

    topBarTagline: 'RÉSUMÉ & COVER LETTER',
    admin: 'Admin', ttAdmin: 'Admin area',
    signOut: 'Sign out', ttSignOut: 'Sign out',

    heroOverline: 'Résumé workshop',
    heroLine1: 'Résumés today', heroLine2: 'read like', heroLine3: '', heroAccent: 'forms.',
    heroAnswer: 'Not here.',
    heroBlurb: 'Thirty-two templates typeset like editorial spreads. Auto-fit to A4. A Markdown bridge for when an AI should proofread. Print-ready.',
    heroNote: 'Invite-only · no cookies, no IP logging',

    stripOverline: 'Thirty-two templates, six archetypes',

    profilesOverline: 'Your résumés',
    profilesEmpty: 'Nothing here yet. Start with an empty résumé — or take the sample content and overwrite it field by field.',
    profilesCount: n => `${n} résumé${n === 1 ? '' : 's'} in your account. Click one to open it.`,
    newResume: 'New résumé',
    profilesHint: 'Then: type on the left, watch it appear on the right. Saving is automatic — you can leave any time and carry on later.',
    emptyOverline: 'ZERO · PROFILES',
    emptyHeadline: 'This will fill up soon.',

    openAria: name => `Open résumé “${name}”`,
    lastOpened: 'LAST OPENED',
    metaLine: (template, lang, created) => `${template} · ${lang} · created ${created}`,
    confirmDelete: 'Really delete',
    ttDelete: 'Delete profile',
    open: 'Open →',

    modalOverline: 'NEW · RÉSUMÉ',
    modalTitle: 'Create a new', modalTitleAccent: 'résumé.',
    nameLabel: 'Title in your overview (not printed on the résumé)', namePlaceholder: 'e.g. Application — City Utilities',
    startLabel: 'Where to start?',
    blankLabel: 'Start empty', blankDesc: 'Every field blank — you type in your own details',
    sampleLabel: 'With sample', sampleDesc: 'A filled-in sample résumé to overwrite',
    cancel: 'Cancel', createProfile: 'Create profile →',
  },

  fr: {
    dateLocale: 'fr-FR',

    topBarTagline: 'CV & LETTRE DE MOTIVATION',
    admin: 'Admin', ttAdmin: 'Espace admin',
    signOut: 'Se déconnecter', ttSignOut: 'Se déconnecter',

    heroOverline: 'Atelier de CV',
    heroLine1: 'Les CV se lisent', heroLine2: "aujourd'hui comme", heroLine3: 'des ', heroAccent: 'formulaires.',
    heroAnswer: 'Pas ici.',
    heroBlurb: "Trente-deux modèles composés comme des doubles pages de magazine. Ajustement automatique au format A4. Passerelle Markdown si une IA doit relire. Prêt à imprimer.",
    heroNote: 'Sur invitation · sans cookies, sans stockage d’IP',

    stripOverline: 'Trente-deux modèles, six archétypes',

    profilesOverline: 'Vos CV',
    profilesEmpty: "Rien pour l'instant. Commencez par un CV vide — ou reprenez le contenu d'exemple et remplacez-le champ par champ.",
    profilesCount: n => `${n} CV dans votre compte. Cliquez sur l'un d'eux pour l'ouvrir.`,
    newResume: 'Nouveau CV',
    profilesHint: "Ensuite : vous saisissez à gauche, le résultat apparaît à droite. L'enregistrement est automatique — vous pouvez partir à tout moment et reprendre plus tard.",
    emptyOverline: 'ZÉRO · PROFILS',
    emptyHeadline: 'Ça va vite se remplir.',

    openAria: name => `Ouvrir le CV « ${name} »`,
    lastOpened: 'OUVERT EN DERNIER',
    metaLine: (template, lang, created) => `${template} · ${lang} · créé le ${created}`,
    confirmDelete: 'Confirmer la suppression',
    ttDelete: 'Supprimer le profil',
    open: 'Ouvrir →',

    modalOverline: 'NOUVEAU · CV',
    modalTitle: 'Créer un nouveau', modalTitleAccent: 'CV.',
    nameLabel: 'Titre dans votre liste (n’apparaît pas sur le CV)', namePlaceholder: 'ex. Candidature Mairie',
    startLabel: 'Par où commencer ?',
    blankLabel: 'Partir de zéro', blankDesc: 'Tous les champs vides — vous saisissez vos propres données',
    sampleLabel: 'Avec exemple', sampleDesc: 'Un CV type déjà rempli, à écraser',
    cancel: 'Annuler', createProfile: 'Créer le profil →',
  },

  es: {
    dateLocale: 'es-ES',

    topBarTagline: 'CV & CARTA DE PRESENTACIÓN',
    admin: 'Admin', ttAdmin: 'Área de administración',
    signOut: 'Cerrar sesión', ttSignOut: 'Cerrar sesión',

    heroOverline: 'Taller de CV',
    heroLine1: 'Los CV de hoy', heroLine2: 'se leen como', heroLine3: '', heroAccent: 'formularios.',
    heroAnswer: 'Aquí no.',
    heroBlurb: 'Treinta y dos plantillas compuestas como páginas de revista. Ajuste automático a A4. Puente Markdown por si una IA tiene que corregir. Listo para imprimir.',
    heroNote: 'Solo por invitación · sin cookies, sin registro de IP',

    stripOverline: 'Treinta y dos plantillas, seis arquetipos',

    profilesOverline: 'Tus CV',
    profilesEmpty: 'Todavía no hay nada. Empieza con un CV vacío — o toma el contenido de ejemplo y sobrescríbelo campo por campo.',
    profilesCount: n => `${n} CV en tu cuenta. Haz clic en uno para abrirlo.`,
    newResume: 'Nuevo CV',
    profilesHint: 'Después: escribes a la izquierda y lo ves a la derecha. Se guarda automáticamente — puedes salir cuando quieras y seguir más tarde.',
    emptyOverline: 'CERO · PERFILES',
    emptyHeadline: 'Esto se llenará pronto.',

    openAria: name => `Abrir el CV «${name}»`,
    lastOpened: 'ABIERTO POR ÚLTIMA VEZ',
    metaLine: (template, lang, created) => `${template} · ${lang} · creado el ${created}`,
    confirmDelete: 'Confirmar eliminación',
    ttDelete: 'Eliminar perfil',
    open: 'Abrir →',

    modalOverline: 'NUEVO · CV',
    modalTitle: 'Crea un nuevo', modalTitleAccent: 'CV.',
    nameLabel: 'Título en tu lista (no aparece en el CV)', namePlaceholder: 'p. ej. Candidatura Ayuntamiento',
    startLabel: '¿Por dónde empezar?',
    blankLabel: 'Empezar en blanco', blankDesc: 'Todos los campos vacíos — escribes tus propios datos',
    sampleLabel: 'Con ejemplo', sampleDesc: 'Un CV de muestra relleno para sobrescribir',
    cancel: 'Cancelar', createProfile: 'Crear perfil →',
  },
};
