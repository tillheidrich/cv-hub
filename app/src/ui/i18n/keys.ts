/**
 * Texte des Konto-Panels (`screens/KeysPanel.tsx`): Passwort, E-Mail,
 * Zwei-Faktor, verbundene KI-Clients, Datenexport, Kontolöschung.
 *
 * Folgt der Oberflächensprache (`useUiLang`), nicht der Sprache des
 * bearbeiteten Lebenslaufs — das Konto gehört dem Nutzer, nicht dem Dokument.
 *
 * Zwei Dinge stehen hier bewusst NICHT drin:
 *
 *   • Alles Technische — die MCP-Adresse, `~/.codex/config.toml`, der
 *     TOML-Abschnitt, `codex mcp login cv-hub`, der Ordner `mcp/` —
 *     bleibt in jeder Sprache identisch. Ein übersetzter Befehl ist ein
 *     falscher Befehl. Übersetzt wird nur der Fließtext drumherum.
 *   • Fehlertexte des Servers. Die kommen fertig aus der API und werden
 *     durchgereicht; hier steht nur der Notnagel, wenn gar keine Meldung
 *     ankommt.
 *
 * `deleteConfirmWord` ist zugleich Anzeige UND Prüfwort: Wer die Oberfläche
 * auf Französisch bedient, soll SUPPRIMER tippen dürfen und nicht LÖSCHEN.
 */
import type { UiLang } from '../i18n';

export interface KeysStrings {
  /** Datumsformat der jeweiligen Sprache — ein englischer Nutzer soll nicht
   *  18.9.2026 lesen müssen. */
  dateLocale: string;
  // Kopf
  title: string; subtitle: string; close: string;
  // Passwort
  sectionPassword: string;
  currentPassword: string;
  newPassword: string; newPasswordHint: string; newPasswordRepeat: string;
  changePassword: string; changingPassword: string;
  pwTooShort: string; pwMismatch: string; pwChanged: string;
  // Sicherheit
  sectionSecurity: string;
  emailLabel: string; emailHint: string;
  save: string; emailSaved: string; emailRemoved: string;
  tfaTitle: string; tfaHint: string; tfaNoMailer: string; tfaNeedsEmail: string;
  // Verbundene Apps
  sectionApps: string; appsIntro: string;
  mcpLabel: string; mcpHint: string;
  copy: string; copied: string; copySection: string;
  clientClaude: string; clientCodex: string; clientCursor: string;
  claudeHelp: string;
  codexHelpIn: string; codexHelpThen: string; codexHelpOpens: string;
  cursorHelpTitle: string; cursorHelpWhere: string; cursorHelpOr: string;
  cursorHelpBelongs: string; cursorHelpReadme: string;
  loading: string; noConnections: string; unnamedClient: string;
  connected: string; lastActive: string; neverUsed: string; revoke: string;
  // Daten
  sectionData: string; dataIntro: string; downloadData: string;
  // Konto löschen
  sectionDelete: string; deleteIntro: string; deleteOpen: string;
  deleteConfirmBefore: string; deleteConfirmWord: string; deleteConfirmAfter: string;
  deleteTypeConfirm: string; deletePasswordMissing: string;
  cancel: string; deleting: string; deleteFinal: string;
  // Fuß
  tipLabel: string; tipBody: string;
  // Notnagel, wenn der Server keine Meldung mitschickt
  genericError: string;
}

export const KEYS_I18N: Record<UiLang, KeysStrings> = {
  de: {
    dateLocale: 'de-DE',
    title: 'Einstellungen', subtitle: 'Passwort, E-Mail & Sicherheit', close: 'Schließen',

    sectionPassword: 'Passwort ändern',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort', newPasswordHint: 'mindestens 8 Zeichen',
    newPasswordRepeat: 'Neues Passwort (wiederholen)',
    changePassword: 'Passwort ändern', changingPassword: 'Moment…',
    pwTooShort: 'Neues Passwort: mind. 8 Zeichen.',
    pwMismatch: 'Die neuen Passwörter stimmen nicht überein.',
    pwChanged: 'Passwort geändert.',

    sectionSecurity: 'Sicherheit',
    emailLabel: 'E-Mail-Adresse',
    emailHint: 'Für Passwort-Reset, Benachrichtigungen und den Zwei-Faktor-Login. Leer lassen entfernt die Adresse (und schaltet 2FA ab).',
    save: 'Speichern', emailSaved: 'E-Mail gespeichert.', emailRemoved: 'E-Mail entfernt.',
    tfaTitle: 'Zwei-Faktor-Login (E-Mail-Code)',
    tfaHint: 'Bei jeder Anmeldung schicken wir dir einen 6-stelligen Code per E-Mail.',
    tfaNoMailer: 'E-Mail-Versand ist derzeit nicht konfiguriert.',
    tfaNeedsEmail: 'Hinterlege zuerst eine E-Mail-Adresse.',

    sectionApps: 'Verbundene Apps',
    appsIntro: 'KI-Clients, denen du über den MCP-Endpunkt Zugriff auf deine Lebensläufe erlaubt hast. „Beenden" entzieht den Zugriff sofort — der Client muss dann neu fragen.',
    mcpLabel: 'Adresse für deinen KI-Client',
    mcpHint: 'Kein Schlüssel nötig: Der Client meldet sich selbst an, du bestätigst im Browser. Danach steht er in der Liste unten und kann dort jederzeit beendet werden.',
    copy: 'Kopieren', copied: 'Kopiert', copySection: 'Abschnitt kopieren',
    clientClaude: 'Claude Desktop', clientCodex: 'Codex', clientCursor: 'Cursor & andere',
    claudeHelp: 'Einstellungen → Connectors → „Custom connector hinzufügen", Adresse oben einsetzen. Es öffnet sich ein Browserfenster zum Bestätigen.',
    codexHelpIn: 'in', codexHelpThen: 'Danach einmal',
    codexHelpOpens: '— das öffnet die Bestätigung im Browser.',
    cursorHelpTitle: 'Cursor, Zed, VS Code und andere',
    cursorHelpWhere: 'überall dort, wo ein „MCP-Server" mit',
    cursorHelpOr: 'oder',
    cursorHelpBelongs: 'eingetragen wird, gehört die Adresse oben hinein. Clients, die nur lokale Programme starten können, brauchen stattdessen den Server aus dem Ordner',
    cursorHelpReadme: '— siehe dortige README.',
    loading: 'Lädt…', noConnections: 'Noch keine Verbindung erlaubt.',
    unnamedClient: 'Unbenannter Client',
    connected: 'verbunden', lastActive: 'zuletzt aktiv', neverUsed: 'noch nicht benutzt',
    revoke: 'Beenden',

    sectionData: 'Daten',
    dataIntro: 'Vollständige Kopie aller deiner Daten als JSON. Enthält Profile, alle Versionen, Sharelinks, Fotos (als Data-URLs), API-Schlüssel und Aktivitäts-Events.',
    downloadData: 'Daten herunterladen',

    sectionDelete: 'Konto löschen',
    deleteIntro: 'Permanent. Alle Profile, Versionen, Sharelinks, Fotos und Schlüssel werden sofort gelöscht. Lade vorher deine Daten herunter, falls du sie behalten willst.',
    deleteOpen: 'Konto endgültig löschen',
    deleteConfirmBefore: 'Tippe', deleteConfirmWord: 'LÖSCHEN', deleteConfirmAfter: 'zur Bestätigung',
    deleteTypeConfirm: 'Tippe LÖSCHEN in das Feld zur Bestätigung.',
    deletePasswordMissing: 'Passwort fehlt.',
    cancel: 'Abbrechen', deleting: 'Lösche…', deleteFinal: 'Endgültig löschen',

    tipLabel: 'Tipp:',
    tipBody: 'Um deinen Lebenslauf von einer KI bearbeiten zu lassen, nutze die Markdown-Funktion im Export-Panel — kein lokales Setup nötig.',

    genericError: 'Fehler.',
  },

  en: {
    dateLocale: 'en-GB',
    title: 'Settings', subtitle: 'Password, email & security', close: 'Close',

    sectionPassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password', newPasswordHint: 'at least 8 characters',
    newPasswordRepeat: 'New password (repeat)',
    changePassword: 'Change password', changingPassword: 'One moment…',
    pwTooShort: 'New password: at least 8 characters.',
    pwMismatch: 'The new passwords do not match.',
    pwChanged: 'Password changed.',

    sectionSecurity: 'Security',
    emailLabel: 'Email address',
    emailHint: 'For password reset, notifications and two-factor login. Leaving it empty removes the address (and turns 2FA off).',
    save: 'Save', emailSaved: 'Email saved.', emailRemoved: 'Email removed.',
    tfaTitle: 'Two-factor login (email code)',
    tfaHint: 'We send you a 6-digit code by email every time you sign in.',
    tfaNoMailer: 'Sending email is not configured at the moment.',
    tfaNeedsEmail: 'Add an email address first.',

    sectionApps: 'Connected apps',
    appsIntro: 'AI clients you have granted access to your résumés through the MCP endpoint. “Revoke” withdraws access immediately — the client then has to ask again.',
    mcpLabel: 'Address for your AI client',
    mcpHint: 'No key needed: the client registers itself, you confirm in the browser. After that it appears in the list below and can be revoked there at any time.',
    copy: 'Copy', copied: 'Copied', copySection: 'Copy section',
    clientClaude: 'Claude Desktop', clientCodex: 'Codex', clientCursor: 'Cursor & others',
    claudeHelp: 'Settings → Connectors → “Add custom connector”, paste the address above. A browser window opens for you to confirm.',
    codexHelpIn: 'in', codexHelpThen: 'Then run',
    codexHelpOpens: 'once — that opens the confirmation in the browser.',
    cursorHelpTitle: 'Cursor, Zed, VS Code and others',
    cursorHelpWhere: 'wherever an “MCP server” is entered with a',
    cursorHelpOr: 'or',
    cursorHelpBelongs: 'field — the address above goes in there. Clients that can only launch local programs need the server from the folder',
    cursorHelpReadme: 'instead — see the README there.',
    loading: 'Loading…', noConnections: 'No connection allowed yet.',
    unnamedClient: 'Unnamed client',
    connected: 'connected', lastActive: 'last active', neverUsed: 'not used yet',
    revoke: 'Revoke',

    sectionData: 'Data',
    dataIntro: 'A complete copy of all your data as JSON. Contains profiles, all versions, share links, photos (as data URLs), API keys and activity events.',
    downloadData: 'Download data',

    sectionDelete: 'Delete account',
    deleteIntro: 'Permanent. All profiles, versions, share links, photos and keys are deleted immediately. Download your data first if you want to keep it.',
    deleteOpen: 'Delete account permanently',
    deleteConfirmBefore: 'Type', deleteConfirmWord: 'DELETE', deleteConfirmAfter: 'to confirm',
    deleteTypeConfirm: 'Type DELETE into the field to confirm.',
    deletePasswordMissing: 'Password missing.',
    cancel: 'Cancel', deleting: 'Deleting…', deleteFinal: 'Delete permanently',

    tipLabel: 'Tip:',
    tipBody: 'To have an AI edit your résumé, use the Markdown feature in the export panel — no local setup needed.',

    genericError: 'Error.',
  },

  fr: {
    dateLocale: 'fr-FR',
    title: 'Paramètres', subtitle: 'Mot de passe, e-mail et sécurité', close: 'Fermer',

    sectionPassword: 'Changer le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe', newPasswordHint: 'au moins 8 caractères',
    newPasswordRepeat: 'Nouveau mot de passe (répéter)',
    changePassword: 'Changer le mot de passe', changingPassword: 'Un instant…',
    pwTooShort: 'Nouveau mot de passe : 8 caractères minimum.',
    pwMismatch: 'Les nouveaux mots de passe ne correspondent pas.',
    pwChanged: 'Mot de passe modifié.',

    sectionSecurity: 'Sécurité',
    emailLabel: 'Adresse e-mail',
    emailHint: "Pour la réinitialisation du mot de passe, les notifications et la connexion à deux facteurs. Laisser vide supprime l'adresse (et désactive la 2FA).",
    save: 'Enregistrer', emailSaved: 'E-mail enregistré.', emailRemoved: 'E-mail supprimé.',
    tfaTitle: 'Connexion à deux facteurs (code par e-mail)',
    tfaHint: 'À chaque connexion, nous vous envoyons un code à 6 chiffres par e-mail.',
    tfaNoMailer: "L'envoi d'e-mails n'est pas configuré pour le moment.",
    tfaNeedsEmail: "Enregistrez d'abord une adresse e-mail.",

    sectionApps: 'Applications connectées',
    appsIntro: "Clients IA auxquels vous avez donné accès à vos CV via le point de terminaison MCP. « Révoquer » retire l'accès immédiatement — le client doit alors redemander.",
    mcpLabel: 'Adresse pour votre client IA',
    mcpHint: "Aucune clé n'est nécessaire : le client s'enregistre lui-même, vous confirmez dans le navigateur. Il apparaît ensuite dans la liste ci-dessous et peut y être révoqué à tout moment.",
    copy: 'Copier', copied: 'Copié', copySection: 'Copier la section',
    clientClaude: 'Claude Desktop', clientCodex: 'Codex', clientCursor: 'Cursor et autres',
    claudeHelp: "Paramètres → Connecteurs → « Ajouter un connecteur personnalisé », collez l'adresse ci-dessus. Une fenêtre du navigateur s'ouvre pour confirmer.",
    codexHelpIn: 'dans', codexHelpThen: 'Lancez ensuite une fois',
    codexHelpOpens: "— cela ouvre la confirmation dans le navigateur.",
    cursorHelpTitle: 'Cursor, Zed, VS Code et autres',
    cursorHelpWhere: "partout où l'on saisit un « serveur MCP » avec une",
    cursorHelpOr: 'ou',
    cursorHelpBelongs: "— c'est l'adresse ci-dessus qu'il faut indiquer. Les clients qui ne peuvent lancer que des programmes locaux ont besoin à la place du serveur du dossier",
    cursorHelpReadme: '— voir le README qui s\'y trouve.',
    loading: 'Chargement…', noConnections: 'Aucune connexion autorisée pour le moment.',
    unnamedClient: 'Client sans nom',
    connected: 'connecté le', lastActive: 'dernière activité', neverUsed: 'pas encore utilisé',
    revoke: 'Révoquer',

    sectionData: 'Données',
    dataIntro: "Copie complète de toutes vos données au format JSON. Contient les profils, toutes les versions, les liens de partage, les photos (en data URL), les clés API et les événements d'activité.",
    downloadData: 'Télécharger les données',

    sectionDelete: 'Supprimer le compte',
    deleteIntro: 'Définitif. Tous les profils, versions, liens de partage, photos et clés sont supprimés immédiatement. Téléchargez vos données avant, si vous voulez les conserver.',
    deleteOpen: 'Supprimer définitivement le compte',
    deleteConfirmBefore: 'Tapez', deleteConfirmWord: 'SUPPRIMER', deleteConfirmAfter: 'pour confirmer',
    deleteTypeConfirm: 'Tapez SUPPRIMER dans le champ pour confirmer.',
    deletePasswordMissing: 'Mot de passe manquant.',
    cancel: 'Annuler', deleting: 'Suppression…', deleteFinal: 'Supprimer définitivement',

    tipLabel: 'Astuce :',
    tipBody: "Pour faire modifier votre CV par une IA, utilisez la fonction Markdown du panneau d'export — aucune installation locale n'est nécessaire.",

    genericError: 'Erreur.',
  },

  es: {
    dateLocale: 'es-ES',
    title: 'Ajustes', subtitle: 'Contraseña, correo y seguridad', close: 'Cerrar',

    sectionPassword: 'Cambiar contraseña',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña', newPasswordHint: 'al menos 8 caracteres',
    newPasswordRepeat: 'Nueva contraseña (repetir)',
    changePassword: 'Cambiar contraseña', changingPassword: 'Un momento…',
    pwTooShort: 'Nueva contraseña: mín. 8 caracteres.',
    pwMismatch: 'Las nuevas contraseñas no coinciden.',
    pwChanged: 'Contraseña cambiada.',

    sectionSecurity: 'Seguridad',
    emailLabel: 'Dirección de correo',
    emailHint: 'Para restablecer la contraseña, las notificaciones y el inicio de sesión en dos pasos. Dejarlo vacío elimina la dirección (y desactiva la 2FA).',
    save: 'Guardar', emailSaved: 'Correo guardado.', emailRemoved: 'Correo eliminado.',
    tfaTitle: 'Inicio de sesión en dos pasos (código por correo)',
    tfaHint: 'En cada inicio de sesión te enviamos un código de 6 dígitos por correo.',
    tfaNoMailer: 'El envío de correo no está configurado en este momento.',
    tfaNeedsEmail: 'Añade primero una dirección de correo.',

    sectionApps: 'Aplicaciones conectadas',
    appsIntro: 'Clientes de IA a los que has dado acceso a tus CV a través del punto final MCP. «Revocar» retira el acceso de inmediato: el cliente tendrá que pedirlo de nuevo.',
    mcpLabel: 'Dirección para tu cliente de IA',
    mcpHint: 'No hace falta ninguna clave: el cliente se registra por sí mismo y tú confirmas en el navegador. Después aparece en la lista de abajo y puede revocarse allí en cualquier momento.',
    copy: 'Copiar', copied: 'Copiado', copySection: 'Copiar sección',
    clientClaude: 'Claude Desktop', clientCodex: 'Codex', clientCursor: 'Cursor y otros',
    claudeHelp: 'Ajustes → Conectores → «Añadir conector personalizado», pega la dirección de arriba. Se abre una ventana del navegador para confirmar.',
    codexHelpIn: 'en', codexHelpThen: 'Ejecuta después una vez',
    codexHelpOpens: '— eso abre la confirmación en el navegador.',
    cursorHelpTitle: 'Cursor, Zed, VS Code y otros',
    cursorHelpWhere: 'dondequiera que se introduzca un «servidor MCP» con',
    cursorHelpOr: 'o',
    cursorHelpBelongs: 'es donde va la dirección de arriba. Los clientes que solo pueden lanzar programas locales necesitan en su lugar el servidor de la carpeta',
    cursorHelpReadme: '— consulta el README que hay allí.',
    loading: 'Cargando…', noConnections: 'Todavía no has permitido ninguna conexión.',
    unnamedClient: 'Cliente sin nombre',
    connected: 'conectado el', lastActive: 'última actividad', neverUsed: 'aún sin usar',
    revoke: 'Revocar',

    sectionData: 'Datos',
    dataIntro: 'Copia completa de todos tus datos en JSON. Incluye perfiles, todas las versiones, enlaces compartidos, fotos (como data URL), claves API y eventos de actividad.',
    downloadData: 'Descargar datos',

    sectionDelete: 'Eliminar cuenta',
    deleteIntro: 'Permanente. Todos los perfiles, versiones, enlaces compartidos, fotos y claves se eliminan de inmediato. Descarga antes tus datos si quieres conservarlos.',
    deleteOpen: 'Eliminar la cuenta definitivamente',
    deleteConfirmBefore: 'Escribe', deleteConfirmWord: 'BORRAR', deleteConfirmAfter: 'para confirmar',
    deleteTypeConfirm: 'Escribe BORRAR en el campo para confirmar.',
    deletePasswordMissing: 'Falta la contraseña.',
    cancel: 'Cancelar', deleting: 'Eliminando…', deleteFinal: 'Eliminar definitivamente',

    tipLabel: 'Consejo:',
    tipBody: 'Para que una IA edite tu CV, usa la función Markdown del panel de exportación: no hace falta ninguna instalación local.',

    genericError: 'Error.',
  },
};
