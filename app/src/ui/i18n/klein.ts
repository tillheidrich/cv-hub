/**
 * Texte der kleinen Bereiche, die keine eigene Tabelle verdienen: die
 * Versionshistorie und das Setzen eines neuen Passworts.
 *
 * Diese Bereiche lagen bisher fest auf Deutsch im Code, weil sie nie eine
 * Sprache als Prop bekommen haben — genau der Fall, für den `useUiLang`
 * gebaut ist. Aufbau und Ton folgen dem SHARE-Block in `editorI18n.ts`:
 * ein Interface je Bereich, eine Tabelle über alle vier Sprachen, im
 * Deutschen wird geduzt.
 *
 * Die Versionshistorie führt ihre Locale mit: Datum und Uhrzeit standen
 * sonst auch für eine spanische Oberfläche in deutscher Schreibweise da.
 */
import type { UiLang } from '../i18n';

export interface VersionsStrings {
  /** Locale für toLocaleDateString/toLocaleString. */
  locale: string;
  // Kopf des Fensters
  title: string;
  subtitle: string;
  close: string;
  // Liste
  loading: string;
  empty: string;
  show: string;
  restore: string;
  // Rückfragen und Fehler
  confirmRestore: string;
  loadFailed: string;
  previewFailed: string;
  restoreFailed: string;
  // Relative Zeitangabe
  justNow: string;
  minutesAgo: (n: number) => string;
  hoursAgo: (n: number) => string;
  daysAgo: (n: number) => string;
  /** Anlass, aus dem die Version entstanden ist (Schlüssel aus dem Backend). */
  sources: Record<string, string>;
  // Vorschau einer Version
  previewTitle: string;
  name: string;
  position: string;
  stations: string;
  bulletsTotal: string;
  education: string;
  skillGroups: string;
  profileLength: string;
  coverLetter: string;
  chars: string;
  coverLetterSubject: string;
}

export const VERSIONS_I18N: Record<UiLang, VersionsStrings> = {
  de: {
    locale: 'de-DE',
    title: 'Versionen',
    subtitle: 'Automatische Sicherungen vor MD-/JSON-Importen und KI-Bearbeitungen — letzte 25.',
    close: 'Schließen',
    loading: 'Lade…',
    empty: 'Noch keine Versionen. Beim nächsten MD- oder JSON-Import landet hier ein automatischer Snapshot.',
    show: 'Anzeigen',
    restore: 'Wiederherstellen',
    confirmRestore: 'Diese Version wiederherstellen? Die aktuelle Fassung wird vorher automatisch als Version gesichert.',
    loadFailed: 'Laden fehlgeschlagen.',
    previewFailed: 'Vorschau fehlgeschlagen.',
    restoreFailed: 'Wiederherstellung fehlgeschlagen.',
    justNow: 'gerade eben',
    minutesAgo: n => `vor ${n} min`,
    hoursAgo: n => `vor ${n} h`,
    daysAgo: n => `vor ${n} Tagen`,
    sources: {
      manual: 'manuelle Bearbeitung',
      md_import: 'Lebenslauf-MD-Import',
      cl_md_import: 'Anschreiben-MD-Import',
      ai_cover: 'KI-Anschreiben generiert',
      json_import: 'JSON-Import',
      restore: 'Wiederherstellung',
    },
    previewTitle: 'Vorschau dieser Version',
    name: 'Name',
    position: 'Position',
    stations: 'Stationen',
    bulletsTotal: 'Bullets gesamt',
    education: 'Ausbildung',
    skillGroups: 'Skill-Gruppen',
    profileLength: 'Profiltext-Länge',
    coverLetter: 'Anschreiben',
    chars: 'Zeichen',
    coverLetterSubject: 'Anschreiben-Betreff:',
  },
  en: {
    locale: 'en-US',
    title: 'Versions',
    subtitle: 'Automatic backups before MD/JSON imports and AI edits — the last 25.',
    close: 'Close',
    loading: 'Loading…',
    empty: 'No versions yet. The next MD or JSON import will leave an automatic snapshot here.',
    show: 'Show',
    restore: 'Restore',
    confirmRestore: 'Restore this version? The current one is saved as a version first, automatically.',
    loadFailed: 'Loading failed.',
    previewFailed: 'Preview failed.',
    restoreFailed: 'Restore failed.',
    justNow: 'just now',
    minutesAgo: n => `${n} min ago`,
    hoursAgo: n => `${n} h ago`,
    daysAgo: n => `${n} days ago`,
    sources: {
      manual: 'manual edit',
      md_import: 'résumé MD import',
      cl_md_import: 'cover letter MD import',
      ai_cover: 'AI cover letter generated',
      json_import: 'JSON import',
      restore: 'restore',
    },
    previewTitle: 'Preview of this version',
    name: 'Name',
    position: 'Position',
    stations: 'Experience',
    bulletsTotal: 'Bullets total',
    education: 'Education',
    skillGroups: 'Skill groups',
    profileLength: 'Profile text length',
    coverLetter: 'Cover letter',
    chars: 'characters',
    coverLetterSubject: 'Cover letter subject:',
  },
  fr: {
    locale: 'fr-FR',
    title: 'Versions',
    subtitle: 'Sauvegardes automatiques avant les imports MD/JSON et les modifications par IA — les 25 dernières.',
    close: 'Fermer',
    loading: 'Chargement…',
    empty: "Pas encore de versions. Le prochain import MD ou JSON déposera ici un instantané automatique.",
    show: 'Afficher',
    restore: 'Restaurer',
    confirmRestore: "Restaurer cette version ? La version actuelle est d'abord sauvegardée automatiquement.",
    loadFailed: 'Échec du chargement.',
    previewFailed: "Échec de l'aperçu.",
    restoreFailed: 'Échec de la restauration.',
    justNow: "à l'instant",
    minutesAgo: n => `il y a ${n} min`,
    hoursAgo: n => `il y a ${n} h`,
    daysAgo: n => `il y a ${n} jours`,
    sources: {
      manual: 'modification manuelle',
      md_import: 'import MD du CV',
      cl_md_import: 'import MD de la lettre',
      ai_cover: 'lettre générée par IA',
      json_import: 'import JSON',
      restore: 'restauration',
    },
    previewTitle: 'Aperçu de cette version',
    name: 'Nom',
    position: 'Poste',
    stations: 'Expérience',
    bulletsTotal: 'Puces au total',
    education: 'Formation',
    skillGroups: 'Groupes de compétences',
    profileLength: 'Longueur du profil',
    coverLetter: 'Lettre de motivation',
    chars: 'caractères',
    coverLetterSubject: 'Objet de la lettre :',
  },
  es: {
    locale: 'es-ES',
    title: 'Versiones',
    subtitle: 'Copias automáticas antes de importaciones MD/JSON y ediciones con IA — las últimas 25.',
    close: 'Cerrar',
    loading: 'Cargando…',
    empty: 'Todavía no hay versiones. La próxima importación MD o JSON dejará aquí una instantánea automática.',
    show: 'Ver',
    restore: 'Restaurar',
    confirmRestore: '¿Restaurar esta versión? La versión actual se guarda antes automáticamente como versión.',
    loadFailed: 'Error al cargar.',
    previewFailed: 'Error en la vista previa.',
    restoreFailed: 'Error al restaurar.',
    justNow: 'ahora mismo',
    minutesAgo: n => `hace ${n} min`,
    hoursAgo: n => `hace ${n} h`,
    daysAgo: n => `hace ${n} días`,
    sources: {
      manual: 'edición manual',
      md_import: 'importación MD del CV',
      cl_md_import: 'importación MD de la carta',
      ai_cover: 'carta generada por IA',
      json_import: 'importación JSON',
      restore: 'restauración',
    },
    previewTitle: 'Vista previa de esta versión',
    name: 'Nombre',
    position: 'Puesto',
    stations: 'Experiencia',
    bulletsTotal: 'Viñetas en total',
    education: 'Formación',
    skillGroups: 'Grupos de competencias',
    profileLength: 'Longitud del perfil',
    coverLetter: 'Carta de presentación',
    chars: 'caracteres',
    coverLetterSubject: 'Asunto de la carta:',
  },
};

export interface ResetStrings {
  // Formular
  title: string;
  intro: string;
  passwordLabel: string;
  repeatLabel: string;
  submit: string;
  busy: string;
  // Fehler
  tooShort: string;
  mismatch: string;
  failed: string;
  // Nach dem Setzen
  doneTitle: string;
  doneBody: string;
  toSignIn: string;
}

export const RESET_I18N: Record<UiLang, ResetStrings> = {
  de: {
    title: 'Neues Passwort',
    intro: 'Wähle ein neues Passwort für dein Konto. Mindestens 8 Zeichen.',
    passwordLabel: 'Neues Passwort',
    repeatLabel: 'Passwort wiederholen',
    submit: 'Passwort setzen',
    busy: 'Moment…',
    tooShort: 'Passwort muss mindestens 8 Zeichen haben.',
    mismatch: 'Die Passwörter stimmen nicht überein.',
    failed: 'Zurücksetzen fehlgeschlagen.',
    doneTitle: 'Passwort gesetzt.',
    doneBody: 'Dein neues Passwort ist aktiv. Du kannst dich jetzt anmelden.',
    toSignIn: 'Zur Anmeldung →',
  },
  en: {
    title: 'New password',
    intro: 'Pick a new password for your account. At least 8 characters.',
    passwordLabel: 'New password',
    repeatLabel: 'Repeat password',
    submit: 'Set password',
    busy: 'One moment…',
    tooShort: 'Password must be at least 8 characters.',
    mismatch: 'The passwords do not match.',
    failed: 'Reset failed.',
    doneTitle: 'Password set.',
    doneBody: 'Your new password is active. You can sign in now.',
    toSignIn: 'To sign in →',
  },
  fr: {
    title: 'Nouveau mot de passe',
    intro: 'Choisissez un nouveau mot de passe pour votre compte. Au moins 8 caractères.',
    passwordLabel: 'Nouveau mot de passe',
    repeatLabel: 'Répéter le mot de passe',
    submit: 'Définir le mot de passe',
    busy: 'Un instant…',
    tooShort: 'Le mot de passe doit comporter au moins 8 caractères.',
    mismatch: 'Les mots de passe ne correspondent pas.',
    failed: 'Échec de la réinitialisation.',
    doneTitle: 'Mot de passe défini.',
    doneBody: 'Votre nouveau mot de passe est actif. Vous pouvez vous connecter.',
    toSignIn: 'Se connecter →',
  },
  es: {
    title: 'Nueva contraseña',
    intro: 'Elige una nueva contraseña para tu cuenta. Mínimo 8 caracteres.',
    passwordLabel: 'Nueva contraseña',
    repeatLabel: 'Repetir contraseña',
    submit: 'Establecer contraseña',
    busy: 'Un momento…',
    tooShort: 'La contraseña debe tener al menos 8 caracteres.',
    mismatch: 'Las contraseñas no coinciden.',
    failed: 'Error al restablecer.',
    doneTitle: 'Contraseña establecida.',
    doneBody: 'Tu nueva contraseña está activa. Ya puedes iniciar sesión.',
    toSignIn: 'Iniciar sesión →',
  },
};
