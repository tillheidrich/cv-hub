/**
 * Texte des Lokalmodus: Sicherungshinweis, Sicherungsdatei, Speicherfehler,
 * lokaler Verlauf — dazu zwei kleine Tabellen für API-Fälle aus Runde 1
 * (PDF-Dienst ausgelastet, Sharelink-Stand), damit die Bereiche, die sie
 * anzeigen, nichts neu übersetzen müssen.
 *
 * Folgt der Oberflächensprache (`useUiLang` bzw. `detectInitialUiLang`).
 * Im Deutschen wird geduzt, wie überall in der App.
 *
 * Der Safari-Satz beruht auf dem WebKit-Blog „Full Third-Party Cookie
 * Blocking and More" (2020): Safari löscht allen per Skript beschreibbaren
 * Speicher einer Seite nach sieben Tagen Safari-Nutzung ohne Besuch —
 * IndexedDB eingeschlossen (Technik-Bericht 08.10.2026, Abschnitt 4).
 */
import type { UiLang } from '../i18n';
import type { LocalDbErrorKind } from '../../data/localDb';

export interface LocalStrings {
  locale: string;
  // Hinweis (Banner)
  reminderNever: string;
  reminderOld: (days: number) => string;
  reminderBody: string;
  safariNote: string;
  evictNote: string;
  backupNow: string;
  later: string;
  more: string;
  backupDone: string;
  backupFailed: string;
  // Speicherfehler
  errorTitle: Record<LocalDbErrorKind, string>;
  errorBody: string;
  quotaHint: string;
  memoryTitle: string;
  memoryBody: string;
  migrated: (n: number) => string;
  skipped: (n: number) => string;
  // Sicherungsfenster
  panelTitle: string;
  panelSubtitle: string;
  saveAll: string;
  saveAllHint: (profiles: number) => string;
  lastBackup: (when: string) => string;
  neverBackedUp: string;
  load: string;
  loadHint: string;
  previewTitle: string;
  previewFrom: (date: string) => string;
  previewAdded: string;
  previewReplaced: string;
  previewReplacedNote: string;
  previewSame: string;
  previewKept: string;
  previewNothing: string;
  apply: string;
  applying: string;
  cancel: string;
  close: string;
  restored: (n: number) => string;
  restoreFailed: string;
  parseError: Record<'not_json' | 'wrong_format' | 'newer_version' | 'empty' | 'read', string>;
  skippedInFile: (n: number) => string;
  clearAll: string;
  clearConfirm: string;
  cleared: string;
  persistedYes: string;
  today: string;
  yesterday: string;
  daysAgo: (n: number) => string;
}

export const LOCAL_I18N: Record<UiLang, LocalStrings> = {
  de: {
    locale: 'de-DE',
    reminderNever: 'Deine Lebensläufe liegen nur in diesem Browser.',
    reminderOld: d => `Letzte Sicherung vor ${d} Tagen.`,
    reminderBody: 'Lade eine Sicherungsdatei herunter. Damit holst du alles zurück, auch auf einem anderen Gerät.',
    safariNote: 'Safari löscht Daten von Seiten, die du 7 Tage nicht besuchst.',
    evictNote: 'Wird der Speicherplatz knapp, darf der Browser diese Daten löschen.',
    backupNow: 'Jetzt sichern',
    later: 'Später',
    more: 'Sicherung…',
    backupDone: 'Gesichert. Die Datei liegt in deinen Downloads.',
    backupFailed: 'Die Sicherungsdatei ließ sich nicht erzeugen.',
    errorTitle: {
      quota: 'Nicht gespeichert: Der Speicher des Browsers ist voll.',
      unavailable: 'Nicht gespeichert: Dieser Browser gibt der Seite keinen Speicher (privates Fenster oder gesperrte Website-Daten).',
      blocked: 'Nicht gespeichert: Die Seite ist in einem anderen Tab mit einer älteren Fassung offen. Schließ ihn und lade neu.',
      timeout: 'Nicht gespeichert: Der Speicher des Browsers antwortet nicht.',
      unknown: 'Nicht gespeichert: Der Browser hat das Speichern abgelehnt.',
    },
    errorBody: 'Deine letzten Änderungen stehen nur noch in diesem Fenster. Sichere sie jetzt als Datei, bevor du es schließt.',
    quotaHint: 'Platz schaffen: große Fotos entfernen oder alte Profile löschen.',
    memoryTitle: 'Dieser Browser speichert nichts dauerhaft.',
    memoryBody: 'Alles, was du hier schreibst, ist beim Schließen weg. Sichere deine Arbeit als Datei.',
    migrated: n => `${n} ${n === 1 ? 'Profil' : 'Profile'} in den neuen Speicher übernommen.`,
    skipped: n => `${n} ${n === 1 ? 'Eintrag war' : 'Einträge waren'} nicht lesbar und ${n === 1 ? 'wird' : 'werden'} nicht angezeigt.`,
    panelTitle: 'Sicherung',
    panelSubtitle: 'Alle Lebensläufe in diesem Browser als eine Datei.',
    saveAll: 'Alles sichern',
    saveAllHint: n => `${n} ${n === 1 ? 'Profil' : 'Profile'} mit Fotos und Einstellungen, als .cv.json-Datei.`,
    lastBackup: w => `Zuletzt gesichert: ${w}`,
    neverBackedUp: 'Noch nie gesichert.',
    load: 'Sicherung laden',
    loadHint: 'Wähle eine .cv.json-Datei. Bevor sich etwas ändert, siehst du, was passiert.',
    previewTitle: 'Das passiert beim Einspielen',
    previewFrom: d => `Sicherung vom ${d}`,
    previewAdded: 'Kommt neu dazu',
    previewReplaced: 'Wird überschrieben',
    previewReplacedNote: 'Der bisherige Stand bleibt im Verlauf des Profils.',
    previewSame: 'identisch',
    previewKept: 'Bleibt, wie es ist',
    previewNothing: 'Nichts.',
    apply: 'Einspielen',
    applying: 'Spiele ein…',
    cancel: 'Abbrechen',
    close: 'Schließen',
    restored: n => `${n} ${n === 1 ? 'Profil' : 'Profile'} eingespielt.`,
    restoreFailed: 'Einspielen fehlgeschlagen. Es wurde nichts verändert.',
    parseError: {
      not_json: 'Das ist keine lesbare Sicherungsdatei.',
      wrong_format: 'Diese Datei enthält keine Lebensläufe aus CV-Hub.',
      newer_version: 'Die Sicherung stammt aus einer neueren Fassung des Werkzeugs. Lade die Seite neu und versuch es noch einmal.',
      empty: 'Die Sicherung enthält keine Profile.',
      read: 'Die Datei ließ sich nicht lesen.',
    },
    skippedInFile: n => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'} in der Datei ${n === 1 ? 'war' : 'waren'} nicht lesbar und ${n === 1 ? 'wird' : 'werden'} ausgelassen.`,
    clearAll: 'Alle lokalen Daten löschen',
    clearConfirm: 'Alle Lebensläufe, Fotos und Versionen in diesem Browser löschen? Das lässt sich nicht rückgängig machen. Sichere vorher, wenn du sie behalten willst.',
    cleared: 'Lokale Daten gelöscht.',
    persistedYes: 'Der Browser hat zugesagt, diese Daten nicht von selbst zu löschen.',
    today: 'heute',
    yesterday: 'gestern',
    daysAgo: n => `vor ${n} Tagen`,
  },
  en: {
    locale: 'en-GB',
    reminderNever: 'Your CVs live only in this browser.',
    reminderOld: d => `Last backup ${d} days ago.`,
    reminderBody: 'Download a backup file. It brings everything back, on another device too.',
    safariNote: 'Safari deletes data of sites you have not visited for 7 days.',
    evictNote: 'If disk space runs low, the browser may delete this data.',
    backupNow: 'Back up now',
    later: 'Later',
    more: 'Backup…',
    backupDone: 'Backed up. The file is in your downloads.',
    backupFailed: 'The backup file could not be created.',
    errorTitle: {
      quota: 'Not saved: the browser storage is full.',
      unavailable: 'Not saved: this browser gives the page no storage (private window or blocked site data).',
      blocked: 'Not saved: the page is open in another tab with an older version. Close it and reload.',
      timeout: 'Not saved: the browser storage is not responding.',
      unknown: 'Not saved: the browser refused to store the data.',
    },
    errorBody: 'Your latest changes exist only in this window. Back them up as a file now, before you close it.',
    quotaHint: 'Make room: remove large photos or delete old profiles.',
    memoryTitle: 'This browser stores nothing permanently.',
    memoryBody: 'Everything you write here is gone when you close it. Back up your work as a file.',
    migrated: n => `${n} ${n === 1 ? 'profile' : 'profiles'} moved to the new storage.`,
    skipped: n => `${n} ${n === 1 ? 'entry was' : 'entries were'} unreadable and ${n === 1 ? 'is' : 'are'} not shown.`,
    panelTitle: 'Backup',
    panelSubtitle: 'All CVs in this browser as one file.',
    saveAll: 'Back up everything',
    saveAllHint: n => `${n} ${n === 1 ? 'profile' : 'profiles'} with photos and settings, as a .cv.json file.`,
    lastBackup: w => `Last backup: ${w}`,
    neverBackedUp: 'Never backed up.',
    load: 'Load backup',
    loadHint: 'Choose a .cv.json file. You will see what happens before anything changes.',
    previewTitle: 'What loading this backup does',
    previewFrom: d => `Backup from ${d}`,
    previewAdded: 'Added',
    previewReplaced: 'Overwritten',
    previewReplacedNote: 'The previous state stays in the profile history.',
    previewSame: 'identical',
    previewKept: 'Left as it is',
    previewNothing: 'Nothing.',
    apply: 'Load',
    applying: 'Loading…',
    cancel: 'Cancel',
    close: 'Close',
    restored: n => `${n} ${n === 1 ? 'profile' : 'profiles'} loaded.`,
    restoreFailed: 'Loading failed. Nothing was changed.',
    parseError: {
      not_json: 'This is not a readable backup file.',
      wrong_format: 'This file contains no CVs from CV-Hub.',
      newer_version: 'This backup comes from a newer version of the tool. Reload the page and try again.',
      empty: 'The backup contains no profiles.',
      read: 'The file could not be read.',
    },
    skippedInFile: n => `${n} ${n === 1 ? 'entry' : 'entries'} in the file ${n === 1 ? 'was' : 'were'} unreadable and ${n === 1 ? 'is' : 'are'} skipped.`,
    clearAll: 'Delete all local data',
    clearConfirm: 'Delete all CVs, photos and versions in this browser? This cannot be undone. Back them up first if you want to keep them.',
    cleared: 'Local data deleted.',
    persistedYes: 'The browser has promised not to delete this data on its own.',
    today: 'today',
    yesterday: 'yesterday',
    daysAgo: n => `${n} days ago`,
  },
  fr: {
    locale: 'fr-FR',
    reminderNever: 'Tes CV ne sont enregistrés que dans ce navigateur.',
    reminderOld: d => `Dernière sauvegarde il y a ${d} jours.`,
    reminderBody: 'Télécharge un fichier de sauvegarde. Il te permet de tout récupérer, aussi sur un autre appareil.',
    safariNote: 'Safari supprime les données des sites que tu n’as pas visités depuis 7 jours.',
    evictNote: 'Si l’espace disque manque, le navigateur peut supprimer ces données.',
    backupNow: 'Sauvegarder',
    later: 'Plus tard',
    more: 'Sauvegarde…',
    backupDone: 'Sauvegardé. Le fichier se trouve dans tes téléchargements.',
    backupFailed: 'Impossible de créer le fichier de sauvegarde.',
    errorTitle: {
      quota: 'Non enregistré : le stockage du navigateur est plein.',
      unavailable: 'Non enregistré : ce navigateur n’accorde aucun stockage à la page (fenêtre privée ou données de site bloquées).',
      blocked: 'Non enregistré : la page est ouverte dans un autre onglet avec une version plus ancienne. Ferme-le et recharge.',
      timeout: 'Non enregistré : le stockage du navigateur ne répond pas.',
      unknown: 'Non enregistré : le navigateur a refusé l’enregistrement.',
    },
    errorBody: 'Tes dernières modifications n’existent plus que dans cette fenêtre. Sauvegarde-les maintenant dans un fichier avant de la fermer.',
    quotaHint: 'Faire de la place : retirer les grandes photos ou supprimer d’anciens profils.',
    memoryTitle: 'Ce navigateur n’enregistre rien durablement.',
    memoryBody: 'Tout ce que tu écris ici disparaît à la fermeture. Sauvegarde ton travail dans un fichier.',
    migrated: n => `${n} profil${n === 1 ? '' : 's'} transféré${n === 1 ? '' : 's'} vers le nouveau stockage.`,
    skipped: n => `${n} entrée${n === 1 ? '' : 's'} illisible${n === 1 ? '' : 's'}, non affichée${n === 1 ? '' : 's'}.`,
    panelTitle: 'Sauvegarde',
    panelSubtitle: 'Tous les CV de ce navigateur dans un seul fichier.',
    saveAll: 'Tout sauvegarder',
    saveAllHint: n => `${n} profil${n === 1 ? '' : 's'} avec photos et réglages, en fichier .cv.json.`,
    lastBackup: w => `Dernière sauvegarde : ${w}`,
    neverBackedUp: 'Jamais sauvegardé.',
    load: 'Charger une sauvegarde',
    loadHint: 'Choisis un fichier .cv.json. Tu vois ce qui va changer avant que rien ne change.',
    previewTitle: 'Ce que fait le chargement',
    previewFrom: d => `Sauvegarde du ${d}`,
    previewAdded: 'Ajouté',
    previewReplaced: 'Remplacé',
    previewReplacedNote: 'L’état précédent reste dans l’historique du profil.',
    previewSame: 'identique',
    previewKept: 'Inchangé',
    previewNothing: 'Rien.',
    apply: 'Charger',
    applying: 'Chargement…',
    cancel: 'Annuler',
    close: 'Fermer',
    restored: n => `${n} profil${n === 1 ? '' : 's'} chargé${n === 1 ? '' : 's'}.`,
    restoreFailed: 'Échec du chargement. Rien n’a été modifié.',
    parseError: {
      not_json: 'Ce n’est pas un fichier de sauvegarde lisible.',
      wrong_format: 'Ce fichier ne contient aucun CV de CV-Hub.',
      newer_version: 'Cette sauvegarde provient d’une version plus récente de l’outil. Recharge la page et réessaie.',
      empty: 'La sauvegarde ne contient aucun profil.',
      read: 'Impossible de lire le fichier.',
    },
    skippedInFile: n => `${n} entrée${n === 1 ? '' : 's'} du fichier ${n === 1 ? 'est illisible et sera ignorée' : 'sont illisibles et seront ignorées'}.`,
    clearAll: 'Supprimer toutes les données locales',
    clearConfirm: 'Supprimer tous les CV, photos et versions de ce navigateur ? C’est irréversible. Sauvegarde d’abord si tu veux les garder.',
    cleared: 'Données locales supprimées.',
    persistedYes: 'Le navigateur s’est engagé à ne pas supprimer ces données de lui-même.',
    today: 'aujourd’hui',
    yesterday: 'hier',
    daysAgo: n => `il y a ${n} jours`,
  },
  es: {
    locale: 'es-ES',
    reminderNever: 'Tus currículums solo están guardados en este navegador.',
    reminderOld: d => `Última copia hace ${d} días.`,
    reminderBody: 'Descarga un archivo de copia de seguridad. Con él lo recuperas todo, también en otro dispositivo.',
    safariNote: 'Safari borra los datos de las páginas que no visitas en 7 días.',
    evictNote: 'Si falta espacio en disco, el navegador puede borrar estos datos.',
    backupNow: 'Guardar copia',
    later: 'Más tarde',
    more: 'Copia…',
    backupDone: 'Copia guardada. El archivo está en tus descargas.',
    backupFailed: 'No se pudo crear el archivo de copia.',
    errorTitle: {
      quota: 'No guardado: el almacenamiento del navegador está lleno.',
      unavailable: 'No guardado: este navegador no da almacenamiento a la página (ventana privada o datos de sitio bloqueados).',
      blocked: 'No guardado: la página está abierta en otra pestaña con una versión más antigua. Ciérrala y recarga.',
      timeout: 'No guardado: el almacenamiento del navegador no responde.',
      unknown: 'No guardado: el navegador rechazó el guardado.',
    },
    errorBody: 'Tus últimos cambios solo existen en esta ventana. Guárdalos ahora en un archivo antes de cerrarla.',
    quotaHint: 'Libera espacio: quita fotos grandes o borra perfiles antiguos.',
    memoryTitle: 'Este navegador no guarda nada de forma permanente.',
    memoryBody: 'Todo lo que escribas aquí desaparece al cerrar. Guarda tu trabajo en un archivo.',
    migrated: n => `${n} perfil${n === 1 ? '' : 'es'} pasado${n === 1 ? '' : 's'} al nuevo almacenamiento.`,
    skipped: n => `${n} entrada${n === 1 ? '' : 's'} ilegible${n === 1 ? '' : 's'}, no se muestra${n === 1 ? '' : 'n'}.`,
    panelTitle: 'Copia de seguridad',
    panelSubtitle: 'Todos los currículums de este navegador en un archivo.',
    saveAll: 'Guardar todo',
    saveAllHint: n => `${n} perfil${n === 1 ? '' : 'es'} con fotos y ajustes, como archivo .cv.json.`,
    lastBackup: w => `Última copia: ${w}`,
    neverBackedUp: 'Nunca se ha hecho una copia.',
    load: 'Cargar copia',
    loadHint: 'Elige un archivo .cv.json. Antes de que cambie nada, verás qué va a pasar.',
    previewTitle: 'Esto pasa al cargar la copia',
    previewFrom: d => `Copia del ${d}`,
    previewAdded: 'Se añade',
    previewReplaced: 'Se sobrescribe',
    previewReplacedNote: 'El estado anterior queda en el historial del perfil.',
    previewSame: 'idéntico',
    previewKept: 'Queda igual',
    previewNothing: 'Nada.',
    apply: 'Cargar',
    applying: 'Cargando…',
    cancel: 'Cancelar',
    close: 'Cerrar',
    restored: n => `${n} perfil${n === 1 ? '' : 'es'} cargado${n === 1 ? '' : 's'}.`,
    restoreFailed: 'La carga falló. No se ha cambiado nada.',
    parseError: {
      not_json: 'Esto no es un archivo de copia legible.',
      wrong_format: 'Este archivo no contiene currículums de CV-Hub.',
      newer_version: 'La copia viene de una versión más reciente de la herramienta. Recarga la página e inténtalo de nuevo.',
      empty: 'La copia no contiene perfiles.',
      read: 'No se pudo leer el archivo.',
    },
    skippedInFile: n => `${n} entrada${n === 1 ? '' : 's'} del archivo ${n === 1 ? 'es ilegible y se omite' : 'son ilegibles y se omiten'}.`,
    clearAll: 'Borrar todos los datos locales',
    clearConfirm: '¿Borrar todos los currículums, fotos y versiones de este navegador? No se puede deshacer. Haz antes una copia si quieres conservarlos.',
    cleared: 'Datos locales borrados.',
    persistedYes: 'El navegador se ha comprometido a no borrar estos datos por su cuenta.',
    today: 'hoy',
    yesterday: 'ayer',
    daysAgo: n => `hace ${n} días`,
  },
};

// ── Lokaler Verlauf (VersionsPanel im Lokalmodus) ────────────────────────────

export interface LocalVersionsStrings {
  subtitle: string;
  empty: string;
  confirmRestore: string;
  /** Anlässe lokaler Stände (ergänzt `VERSIONS_I18N.sources`). */
  sources: Record<string, string>;
}

export const LOCAL_VERSIONS_I18N: Record<UiLang, LocalVersionsStrings> = {
  de: {
    subtitle: 'Stände in diesem Browser: höchstens alle 10 Minuten einer, vor großen Änderungen sofort. Die letzten 20.',
    empty: 'Noch keine Stände. Sobald du etwas änderst, legt der Browser hier höchstens alle 10 Minuten einen an.',
    confirmRestore: 'Diesen Stand wiederherstellen? Der aktuelle wird vorher als Version gesichert.',
    sources: { auto: 'automatischer Stand', auto_large: 'vor einer großen Änderung', restore: 'vor einer Wiederherstellung', backup_restore: 'vor dem Einspielen einer Sicherung' },
  },
  en: {
    subtitle: 'Snapshots in this browser: at most one every 10 minutes, right away before large changes. The last 20.',
    empty: 'No snapshots yet. As soon as you change something, the browser keeps one here at most every 10 minutes.',
    confirmRestore: 'Restore this snapshot? The current state is saved as a version first.',
    sources: { auto: 'automatic snapshot', auto_large: 'before a large change', restore: 'before a restore', backup_restore: 'before loading a backup' },
  },
  fr: {
    subtitle: 'États enregistrés dans ce navigateur : au plus un toutes les 10 minutes, immédiatement avant un grand changement. Les 20 derniers.',
    empty: 'Pas encore d’état. Dès que tu modifies quelque chose, le navigateur en garde un ici au plus toutes les 10 minutes.',
    confirmRestore: 'Restaurer cet état ? L’état actuel est d’abord enregistré comme version.',
    sources: { auto: 'état automatique', auto_large: 'avant un grand changement', restore: 'avant une restauration', backup_restore: 'avant le chargement d’une sauvegarde' },
  },
  es: {
    subtitle: 'Estados guardados en este navegador: como mucho uno cada 10 minutos, al momento antes de cambios grandes. Los últimos 20.',
    empty: 'Aún no hay estados. En cuanto cambies algo, el navegador guarda uno aquí como mucho cada 10 minutos.',
    confirmRestore: '¿Restaurar este estado? El actual se guarda antes como versión.',
    sources: { auto: 'estado automático', auto_large: 'antes de un cambio grande', restore: 'antes de una restauración', backup_restore: 'antes de cargar una copia' },
  },
};

// ── PDF-Dienst (Antworten 429/503 aus Runde 1) ───────────────────────────────

export interface PdfServiceStrings {
  retryIn: (seconds: number) => string;
  tooMany: (seconds?: number) => string;
  /** 503 mit `Retry-After`: Warteschlange voll. */
  busy: (seconds: number) => string;
  /** 413: mehr als 3.000.000 Zeichen HTML. */
  tooLarge: string;
}

export const PDF_SERVICE_I18N: Record<UiLang, PdfServiceStrings> = {
  de: {
    retryIn: s => `Neuer Versuch frühestens in ${s} s.`,
    busy: s => `Der PDF-Dienst ist gerade ausgelastet. Bitte in ${s} Sekunden noch einmal versuchen.`,
    tooLarge: 'Das Dokument ist zu groß für den PDF-Export (höchstens 3 MB). Meist ist es ein sehr großes Foto: im Profil neu zuschneiden oder ein kleineres wählen.',
    tooMany: s => (s ? `Zu viele PDF-Exporte in kurzer Zeit. Bitte in ${Math.ceil(s / 60)} min erneut.` : 'Zu viele PDF-Exporte in kurzer Zeit. In ein paar Minuten nochmal.'),
  },
  en: {
    retryIn: s => `Try again in ${s} s at the earliest.`,
    busy: s => `The PDF service is busy right now. Please try again in ${s} seconds.`,
    tooLarge: 'The document is too large for the PDF export (3 MB at most). Usually it is a very large photo: re-crop it in the profile or pick a smaller one.',
    tooMany: s => (s ? `Too many PDF exports in a short time. Please try again in ${Math.ceil(s / 60)} min.` : 'Too many PDF exports in a short time. Try again in a few minutes.'),
  },
  fr: {
    retryIn: s => `Nouvel essai possible dans ${s} s au plus tôt.`,
    busy: s => `Le service PDF est très sollicité en ce moment. Réessaie dans ${s} secondes.`,
    tooLarge: 'Le document est trop volumineux pour l’export PDF (3 Mo au maximum). C’est souvent une très grande photo : recadre-la dans le profil ou choisis-en une plus petite.',
    tooMany: s => (s ? `Trop d’exports PDF en peu de temps. Réessaie dans ${Math.ceil(s / 60)} min.` : 'Trop d’exports PDF en peu de temps. Réessaie dans quelques minutes.'),
  },
  es: {
    retryIn: s => `Nuevo intento como pronto en ${s} s.`,
    busy: s => `El servicio PDF está saturado ahora mismo. Vuelve a intentarlo en ${s} segundos.`,
    tooLarge: 'El documento es demasiado grande para la exportación PDF (3 MB como máximo). Suele ser una foto muy grande: recórtala de nuevo en el perfil o elige una más pequeña.',
    tooMany: s => (s ? `Demasiadas exportaciones PDF en poco tiempo. Vuelve a intentarlo en ${Math.ceil(s / 60)} min.` : 'Demasiadas exportaciones PDF en poco tiempo. Inténtalo de nuevo en unos minutos.'),
  },
};

// ── Sharelinks: fester Stand (für den Teilen-Bereich im Export) ──────────────

export interface ShareSnapshotStrings {
  snapshotNote: string;
  refresh: string;
  refreshing: string;
  refreshed: string;
  refreshConfirm: string;
  refreshFailed: string;
}

export const SHARE_SNAPSHOT_I18N: Record<UiLang, ShareSnapshotStrings> = {
  de: {
    snapshotNote: 'Der Link zeigt den Stand beim Anlegen.',
    refresh: 'Stand aktualisieren',
    refreshing: 'Aktualisiere…',
    refreshed: 'Der Link zeigt jetzt den aktuellen Stand.',
    refreshConfirm: 'Wer den Link schon hat, sieht danach den aktuellen Stand. Aktualisieren?',
    refreshFailed: 'Aktualisieren fehlgeschlagen.',
  },
  en: {
    snapshotNote: 'The link shows the state at the time it was created.',
    refresh: 'Update snapshot',
    refreshing: 'Updating…',
    refreshed: 'The link now shows the current state.',
    refreshConfirm: 'Anyone who already has the link will then see the current state. Update?',
    refreshFailed: 'Update failed.',
  },
  fr: {
    snapshotNote: 'Le lien montre l’état au moment de sa création.',
    refresh: 'Mettre à jour',
    refreshing: 'Mise à jour…',
    refreshed: 'Le lien montre maintenant l’état actuel.',
    refreshConfirm: 'Les personnes qui ont déjà le lien verront ensuite l’état actuel. Mettre à jour ?',
    refreshFailed: 'Échec de la mise à jour.',
  },
  es: {
    snapshotNote: 'El enlace muestra el estado del momento en que se creó.',
    refresh: 'Actualizar estado',
    refreshing: 'Actualizando…',
    refreshed: 'El enlace muestra ahora el estado actual.',
    refreshConfirm: 'Quien ya tenga el enlace verá después el estado actual. ¿Actualizar?',
    refreshFailed: 'No se pudo actualizar.',
  },
};
