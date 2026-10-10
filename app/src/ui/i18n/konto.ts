/**
 * Texte der Anmeldung (screens/AuthScreen.tsx) und der Übersicht der eigenen
 * Lebensläufe (screens/HomeScreen.tsx), Stand Runde 8 (10.10.2026).
 *
 * Ältere Texte, auf die Prüfskripte zielen, bleiben in ihren Tabellen und
 * werden von dort gelesen: `T.auth` (ui/i18n.ts, z. B. „Direkt ausprobieren"),
 * `HOME_I18N` (z. B. „Neuer Lebenslauf", „Lebenslauf „…" öffnen",
 * „Profil anlegen"), `DESIGN_I18N` (Start-Wahl „Mit Beispiel" …),
 * `FASSUNG_I18N` („Duplizieren"). Hier steht nur, was neu ist.
 *
 * Ton: Du-Form wie überall in der App, sachlich, ohne Werbesprech. Jede
 * Vertrauensaussage ist belegt: selbst betrieben (Standort steht in der
 * Datenschutzerklärung der Instanz), kein Abo (der Pass ist einmalig, nichts verlängert
 * sich), quelloffen (öffentlicher AGPL-Zwilling). Keine Siegel, keine Zahlen.
 */
import type { UiLang } from '../i18n';

export interface KontoStrings {
  locale: string;
  // ── Anmeldung ────────────────────────────────────────────────────────────
  backHome: string;
  eyebrow: string;
  tabLogin: string;
  tabRegister: string;
  loginTitle: string;
  loginLead: string;
  registerTitle: string;
  registerLeadOpen: string;
  registerLeadInvite: string;
  registerCta: string;
  registerCtaSub: string;
  inviteToggle: string;
  usernameHint: string;
  passwordHintNew: string;
  showPassword: string;
  hidePassword: string;
  emailOpt: string;
  emailHint: string;
  busy: string;
  forgotLink: string;
  forgotTitle: string;
  forgotLead: string;
  forgotField: string;
  forgotSend: string;
  forgotSent: string;
  backToLogin: string;
  twofaTitle: string;
  twofaLead: string;
  twofaField: string;
  twofaSubmit: string;
  twofaBack: string;
  codeTitle: string;
  codeLead: string;
  codeLink: string;
  guestTitle: string;
  guestLead: string;
  trustTitle: string;
  trust: { title: string; body: string }[];
  previewCaption: (template: string) => string;
  errRequired: string;
  errWrong: string;
  errLocked: (minutes: number) => string;
  errDisabled: string;
  errNetwork: string;
  errGeneric: string;
  errCode: string;
  errServerSays: (msg: string) => string;

  // ── Übersicht ────────────────────────────────────────────────────────────
  homeTitle: string;
  homeCount: (n: number) => string;
  whereLocal: string;
  whereAccount: string;
  startTitle: string;
  startLead: string;
  emptyTitle: string;
  emptyLead: string;
  emptyHint: string;
  changed: (rel: string) => string;
  justNow: string;
  created: (date: string) => string;
  storeLocal: string;
  storeAccount: string;
  storeLocalTitle: string;
  storeAccountTitle: string;
  open: string;
  pdf: string;
  pdfAria: (name: string) => string;
  more: (name: string) => string;
  rename: string;
  renameLabel: string;
  renameSave: string;
  renameCancel: string;
  remove: string;
  removeAria: (name: string) => string;
  removed: (name: string) => string;
  undo: string;
  thumbAlt: (name: string, template: string) => string;
  passTitle: string;
  passLocal: string;
  passNone: string;
  passNoneFree: string;
  passActive: (until: string, days: number) => string;
  passExpired: (until: string) => string;
  passLifetime: string;
  passUnlimited: string;
  passManage: string;
  codeShort: string;
  backupTitle: string;
  backupNever: string;
  backupLast: (rel: string) => string;
  backupOpen: string;
  account: string;
}

const DE: KontoStrings = {
  locale: 'de-DE',
  backHome: 'Zur Startseite',
  eyebrow: 'Lebenslauf und Anschreiben',
  tabLogin: 'Anmelden',
  tabRegister: 'Konto anlegen',
  loginTitle: 'Willkommen zurück',
  loginLead: 'Melde dich an, dann sind deine Lebensläufe auf jedem Gerät da.',
  registerTitle: 'Konto anlegen',
  registerLeadOpen: 'Mit Konto liegen deine Lebensläufe auf dem Server dieser Instanz und sind auf jedem Gerät da. Zum Bearbeiten im Konto brauchst du den Bewerbungs-Pass oder einen Zugangscode.',
  registerLeadInvite: 'Für die Registrierung brauchst du einen Einladungscode. Wer dir den Link geschickt hat, hat ihn für dich.',
  registerCta: 'Mit E-Mail-Adresse registrieren',
  registerCtaSub: 'Erst E-Mail-Adresse und Passwort, danach entscheidest du über den Pass. Es gibt kein Abo.',
  inviteToggle: 'Ich habe einen Einladungscode',
  usernameHint: '3 bis 32 Zeichen: Buchstaben, Zahlen, Punkt, Unterstrich oder Bindestrich.',
  passwordHintNew: 'Mindestens 8 Zeichen.',
  showPassword: 'Passwort zeigen',
  hidePassword: 'Passwort verbergen',
  emailOpt: 'E-Mail-Adresse (freiwillig)',
  emailHint: 'Damit kannst du dein Passwort selbst zurücksetzen. Ohne Adresse geht das nicht.',
  busy: 'Einen Moment …',
  forgotLink: 'Passwort vergessen?',
  forgotTitle: 'Passwort zurücksetzen',
  forgotLead: 'Gib deine E-Mail-Adresse oder deinen Nutzernamen ein. Ist bei deinem Konto eine Adresse hinterlegt, schicken wir dir einen Link.',
  forgotField: 'E-Mail-Adresse oder Nutzername',
  forgotSend: 'Link schicken',
  forgotSent: 'Wenn zu diesen Angaben ein Konto mit E-Mail-Adresse gehört, ist der Link unterwegs. Schau auch im Spam-Ordner nach.',
  backToLogin: 'Zurück zur Anmeldung',
  twofaTitle: 'Bestätigungscode',
  twofaLead: 'Wir haben dir einen sechsstelligen Code per E-Mail geschickt. Er gilt 10 Minuten.',
  twofaField: 'Code aus der E-Mail',
  twofaSubmit: 'Bestätigen und anmelden',
  twofaBack: 'Anders anmelden',
  codeTitle: 'Zugangscode bekommen?',
  codeLead: 'Gutschein- und Zugangscodes löst du auf einer eigenen Seite ein. Hast du noch kein Konto, legst du es dort gleich mit an.',
  codeLink: 'Code einlösen',
  guestTitle: 'Ohne Konto weiter',
  guestLead: 'Alles bleibt in diesem Browser. Das PDF lädst du auch ohne Konto herunter.',
  trustTitle: 'Gut zu wissen',
  trust: [
    { title: 'Selbst betrieben', body: 'Konten und Lebensläufe liegen auf dem Server, der diese Seite betreibt. Wo er steht, sagt die Datenschutzerklärung.' },
    { title: 'Kein Abo', body: 'Nichts verlängert sich von selbst. Der Pass endet nach seiner Laufzeit.' },
    { title: 'Quelloffen', body: 'Der Quelltext ist öffentlich (AGPL-3.0). Du kannst nachsehen, was mit deinen Daten passiert.' },
  ],
  previewCaption: tpl => `Beispiel: Lena Brandt (erfunden), Vorlage ${tpl}`,
  errRequired: 'Bitte füll beide Felder aus.',
  errWrong: 'Das hat nicht gepasst. Prüf Nutzername oder E-Mail-Adresse und Passwort. Wenn du unsicher bist, setz das Passwort zurück.',
  errLocked: m => `Zu viele Versuche hintereinander. Versuch es in ${m} ${m === 1 ? 'Minute' : 'Minuten'} wieder oder setz dein Passwort zurück.`,
  errDisabled: 'Dieses Konto ist gesperrt. Wenn das ein Irrtum ist, melde dich über die Adresse im Impressum.',
  errNetwork: 'Der Server ist gerade nicht erreichbar. Prüf deine Verbindung und versuch es gleich noch einmal.',
  errGeneric: 'Das hat nicht geklappt. Versuch es bitte noch einmal.',
  errCode: 'Der Code stimmt nicht oder ist abgelaufen. Prüf die letzte E-Mail oder melde dich neu an.',
  errServerSays: msg => msg,

  homeTitle: 'Deine Lebensläufe',
  homeCount: n => n === 1 ? 'Ein Lebenslauf' : `${n} Lebensläufe`,
  whereLocal: 'gespeichert in diesem Browser',
  whereAccount: 'gespeichert in deinem Konto',
  startTitle: 'Neuen Lebenslauf beginnen',
  startLead: 'Wähle, womit du anfängst. Den Titel und deinen Namen trägst du im nächsten Schritt ein.',
  emptyTitle: 'Hier ist noch nichts',
  emptyLead: 'Fang leer an, überschreib das ausgefüllte Beispiel oder hol deinen bisherigen Lebenslauf herein: LinkedIn-Export, JSON, RenderCV-YAML oder Markdown.',
  emptyHint: 'Du kannst die Vorlage jederzeit wechseln, der Inhalt bleibt.',
  changed: rel => `Geändert ${rel}`,
  justNow: 'gerade eben',
  created: date => `Angelegt am ${date}`,
  storeLocal: 'Browser',
  storeAccount: 'Konto',
  storeLocalTitle: 'Liegt nur in diesem Browser',
  storeAccountTitle: 'Liegt in deinem Konto',
  open: 'Öffnen',
  pdf: 'PDF',
  pdfAria: name => `PDF von „${name}" herunterladen`,
  more: name => `Weitere Aktionen für „${name}"`,
  rename: 'Umbenennen',
  renameLabel: 'Titel in der Übersicht',
  renameSave: 'Speichern',
  renameCancel: 'Abbrechen',
  remove: 'Löschen',
  removeAria: name => `„${name}" löschen`,
  removed: name => `„${name}" gelöscht.`,
  undo: 'Rückgängig',
  thumbAlt: (name, tpl) => `Vorschau von „${name}", Vorlage ${tpl}`,
  passTitle: 'Zugang',
  passLocal: 'Ohne Konto. Das PDF ist frei.',
  passNone: 'Noch kein Pass.',
  passNoneFree: 'Noch kein Pass. Das PDF ist frei.',
  passActive: (until, d) => `Pass aktiv bis ${until}, noch ${d} ${d === 1 ? 'Tag' : 'Tage'}.`,
  passExpired: until => `Pass am ${until} abgelaufen. Lesen und Exportieren geht weiter.`,
  passLifetime: 'Dauerhafter Zugang.',
  passUnlimited: 'Unbegrenzter Zugang.',
  passManage: 'Mein Pass',
  codeShort: 'Code einlösen',
  backupTitle: 'Sicherung',
  backupNever: 'Noch keine Sicherungsdatei. Lade eine herunter, dann kannst du alles zurückholen, auch auf einem anderen Gerät.',
  backupLast: rel => `Letzte Sicherungsdatei: ${rel}.`,
  backupOpen: 'Sicherung …',
  account: 'Konto',
};

const EN: KontoStrings = {
  locale: 'en-GB',
  backHome: 'Back to home',
  eyebrow: 'CV and cover letter',
  tabLogin: 'Sign in',
  tabRegister: 'Create account',
  loginTitle: 'Welcome back',
  loginLead: 'Sign in and your CVs are there on every device.',
  registerTitle: 'Create an account',
  registerLeadOpen: 'With an account your CVs are stored on the server that runs this site and available on every device. To edit them in your account you need the Application Pass or an access code.',
  registerLeadInvite: 'You need an invite code to register. Whoever sent you the link has one for you.',
  registerCta: 'Register with your email address',
  registerCtaSub: 'Email address and password first, then you decide on the pass. There is no subscription.',
  inviteToggle: 'I have an invite code',
  usernameHint: '3 to 32 characters: letters, digits, dot, underscore or hyphen.',
  passwordHintNew: 'At least 8 characters.',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  emailOpt: 'Email address (optional)',
  emailHint: 'Lets you reset your password yourself. Without an address that is not possible.',
  busy: 'One moment …',
  forgotLink: 'Forgot your password?',
  forgotTitle: 'Reset password',
  forgotLead: 'Enter your email address or username. If your account has an address, we send you a link.',
  forgotField: 'Email address or username',
  forgotSend: 'Send link',
  forgotSent: 'If an account with an email address matches, the link is on its way. Check your spam folder too.',
  backToLogin: 'Back to sign in',
  twofaTitle: 'Verification code',
  twofaLead: 'We emailed you a six-digit code. It is valid for 10 minutes.',
  twofaField: 'Code from the email',
  twofaSubmit: 'Confirm and sign in',
  twofaBack: 'Sign in differently',
  codeTitle: 'Got an access code?',
  codeLead: 'Voucher and access codes are redeemed on their own page. If you have no account yet, you create one there along the way.',
  codeLink: 'Redeem code',
  guestTitle: 'Continue without an account',
  guestLead: 'Everything stays in this browser. You can download the PDF without an account too.',
  trustTitle: 'Good to know',
  trust: [
    { title: 'Self-hosted', body: 'Accounts and CVs are kept on the server that runs this site. The privacy policy says where it is located.' },
    { title: 'No subscription', body: 'Nothing renews by itself. The pass ends when its term is over.' },
    { title: 'Open source', body: 'The source code is public (AGPL-3.0). You can check what happens with your data.' },
  ],
  previewCaption: tpl => `Example: Lena Brandt (fictional), template ${tpl}`,
  errRequired: 'Please fill in both fields.',
  errWrong: 'That did not match. Check your username or email address and password. If you are unsure, reset the password.',
  errLocked: m => `Too many attempts in a row. Try again in ${m} ${m === 1 ? 'minute' : 'minutes'} or reset your password.`,
  errDisabled: 'This account is disabled. If that is a mistake, get in touch via the address in the imprint.',
  errNetwork: 'The server cannot be reached right now. Check your connection and try again in a moment.',
  errGeneric: 'That did not work. Please try again.',
  errCode: 'The code is wrong or has expired. Check the latest email or sign in again.',
  errServerSays: msg => `The server says: ${msg}`,

  homeTitle: 'Your CVs',
  homeCount: n => n === 1 ? 'One CV' : `${n} CVs`,
  whereLocal: 'stored in this browser',
  whereAccount: 'stored in your account',
  startTitle: 'Start a new CV',
  startLead: 'Choose how to begin. You add the title and your name in the next step.',
  emptyTitle: 'Nothing here yet',
  emptyLead: 'Start blank, overwrite the filled-in example or bring in your existing CV: LinkedIn export, JSON, RenderCV YAML or Markdown.',
  emptyHint: 'You can switch templates at any time, your content stays.',
  changed: rel => `Changed ${rel}`,
  justNow: 'just now',
  created: date => `Created on ${date}`,
  storeLocal: 'Browser',
  storeAccount: 'Account',
  storeLocalTitle: 'Only in this browser',
  storeAccountTitle: 'In your account',
  open: 'Open',
  pdf: 'PDF',
  pdfAria: name => `Download PDF of "${name}"`,
  more: name => `More actions for "${name}"`,
  rename: 'Rename',
  renameLabel: 'Title in the overview',
  renameSave: 'Save',
  renameCancel: 'Cancel',
  remove: 'Delete',
  removeAria: name => `Delete "${name}"`,
  removed: name => `"${name}" deleted.`,
  undo: 'Undo',
  thumbAlt: (name, tpl) => `Preview of "${name}", template ${tpl}`,
  passTitle: 'Access',
  passLocal: 'No account. The PDF is free.',
  passNone: 'No pass yet.',
  passNoneFree: 'No pass yet. The PDF is free.',
  passActive: (until, d) => `Pass active until ${until}, ${d} ${d === 1 ? 'day' : 'days'} left.`,
  passExpired: until => `Pass expired on ${until}. Reading and exporting still work.`,
  passLifetime: 'Permanent access.',
  passUnlimited: 'Unlimited access.',
  passManage: 'My pass',
  codeShort: 'Redeem code',
  backupTitle: 'Backup',
  backupNever: 'No backup file yet. Download one and you can restore everything, on another device too.',
  backupLast: rel => `Last backup file: ${rel}.`,
  backupOpen: 'Backup …',
  account: 'Account',
};

const FR: KontoStrings = {
  locale: 'fr-FR',
  backHome: 'Retour à l’accueil',
  eyebrow: 'CV et lettre de motivation',
  tabLogin: 'Se connecter',
  tabRegister: 'Créer un compte',
  loginTitle: 'Bon retour',
  loginLead: 'Connectez-vous et vos CV sont disponibles sur tous vos appareils.',
  registerTitle: 'Créer un compte',
  registerLeadOpen: 'Avec un compte, vos CV sont enregistrés sur le serveur qui fait tourner ce site et disponibles sur tous vos appareils. Pour les modifier dans le compte, il vous faut le Pass candidature ou un code d’accès.',
  registerLeadInvite: 'L’inscription demande un code d’invitation. La personne qui vous a envoyé le lien en a un pour vous.',
  registerCta: 'S’inscrire avec une adresse e-mail',
  registerCtaSub: 'D’abord l’adresse e-mail et le mot de passe, ensuite vous décidez pour le pass. Sans abonnement.',
  inviteToggle: 'J’ai un code d’invitation',
  usernameHint: '3 à 32 caractères : lettres, chiffres, point, tiret bas ou trait d’union.',
  passwordHintNew: 'Au moins 8 caractères.',
  showPassword: 'Afficher le mot de passe',
  hidePassword: 'Masquer le mot de passe',
  emailOpt: 'Adresse e-mail (facultatif)',
  emailHint: 'Elle vous permet de réinitialiser votre mot de passe vous-même. Sans adresse, ce n’est pas possible.',
  busy: 'Un instant …',
  forgotLink: 'Mot de passe oublié ?',
  forgotTitle: 'Réinitialiser le mot de passe',
  forgotLead: 'Saisissez votre adresse e-mail ou votre nom d’utilisateur. Si votre compte a une adresse, nous vous envoyons un lien.',
  forgotField: 'Adresse e-mail ou nom d’utilisateur',
  forgotSend: 'Envoyer le lien',
  forgotSent: 'Si un compte avec adresse e-mail correspond, le lien est en route. Regardez aussi dans les indésirables.',
  backToLogin: 'Retour à la connexion',
  twofaTitle: 'Code de vérification',
  twofaLead: 'Nous vous avons envoyé un code à six chiffres par e-mail. Il est valable 10 minutes.',
  twofaField: 'Code reçu par e-mail',
  twofaSubmit: 'Confirmer et se connecter',
  twofaBack: 'Se connecter autrement',
  codeTitle: 'Vous avez un code d’accès ?',
  codeLead: 'Les codes d’accès et bons s’utilisent sur une page à part. Si vous n’avez pas encore de compte, vous le créez au passage.',
  codeLink: 'Utiliser un code',
  guestTitle: 'Continuer sans compte',
  guestLead: 'Tout reste dans ce navigateur. Le PDF se télécharge aussi sans compte.',
  trustTitle: 'Bon à savoir',
  trust: [
    { title: 'Auto-hébergé', body: 'Comptes et CV sont conservés sur le serveur qui fait tourner ce site. La politique de confidentialité indique où il se trouve.' },
    { title: 'Sans abonnement', body: 'Rien ne se renouvelle tout seul. Le pass s’arrête à la fin de sa durée.' },
    { title: 'Open source', body: 'Le code source est public (AGPL-3.0). Vous pouvez vérifier ce qu’il advient de vos données.' },
  ],
  previewCaption: tpl => `Exemple : Lena Brandt (fictive), modèle ${tpl}`,
  errRequired: 'Merci de remplir les deux champs.',
  errWrong: 'Cela ne correspond pas. Vérifiez le nom d’utilisateur ou l’adresse e-mail et le mot de passe. En cas de doute, réinitialisez le mot de passe.',
  errLocked: m => `Trop de tentatives d’affilée. Réessayez dans ${m} minute${m === 1 ? '' : 's'} ou réinitialisez votre mot de passe.`,
  errDisabled: 'Ce compte est désactivé. S’il s’agit d’une erreur, écrivez à l’adresse indiquée dans les mentions légales.',
  errNetwork: 'Le serveur est injoignable pour le moment. Vérifiez votre connexion et réessayez dans un instant.',
  errGeneric: 'Cela n’a pas fonctionné. Merci de réessayer.',
  errCode: 'Le code est faux ou a expiré. Vérifiez le dernier e-mail ou reconnectez-vous.',
  errServerSays: msg => `Réponse du serveur : ${msg}`,

  homeTitle: 'Vos CV',
  homeCount: n => n === 1 ? 'Un CV' : `${n} CV`,
  whereLocal: 'enregistrés dans ce navigateur',
  whereAccount: 'enregistrés dans votre compte',
  startTitle: 'Commencer un nouveau CV',
  startLead: 'Choisissez votre point de départ. Le titre et votre nom viennent à l’étape suivante.',
  emptyTitle: 'Rien ici pour l’instant',
  emptyLead: 'Partez d’une page vide, remplacez l’exemple rempli ou importez votre CV actuel : export LinkedIn, JSON, YAML RenderCV ou Markdown.',
  emptyHint: 'Vous pouvez changer de modèle à tout moment, le contenu reste.',
  changed: rel => `Modifié ${rel}`,
  justNow: 'à l’instant',
  created: date => `Créé le ${date}`,
  storeLocal: 'Navigateur',
  storeAccount: 'Compte',
  storeLocalTitle: 'Seulement dans ce navigateur',
  storeAccountTitle: 'Dans votre compte',
  open: 'Ouvrir',
  pdf: 'PDF',
  pdfAria: name => `Télécharger le PDF de « ${name} »`,
  more: name => `Autres actions pour « ${name} »`,
  rename: 'Renommer',
  renameLabel: 'Titre dans l’aperçu',
  renameSave: 'Enregistrer',
  renameCancel: 'Annuler',
  remove: 'Supprimer',
  removeAria: name => `Supprimer « ${name} »`,
  removed: name => `« ${name} » supprimé.`,
  undo: 'Annuler',
  thumbAlt: (name, tpl) => `Aperçu de « ${name} », modèle ${tpl}`,
  passTitle: 'Accès',
  passLocal: 'Sans compte. Le PDF est gratuit.',
  passNone: 'Pas encore de pass.',
  passNoneFree: 'Pas encore de pass. Le PDF est gratuit.',
  passActive: (until, d) => `Pass actif jusqu’au ${until}, encore ${d} jour${d === 1 ? '' : 's'}.`,
  passExpired: until => `Pass expiré le ${until}. Lire et exporter reste possible.`,
  passLifetime: 'Accès permanent.',
  passUnlimited: 'Accès illimité.',
  passManage: 'Mon pass',
  codeShort: 'Utiliser un code',
  backupTitle: 'Sauvegarde',
  backupNever: 'Pas encore de fichier de sauvegarde. Téléchargez-en un pour tout récupérer, aussi sur un autre appareil.',
  backupLast: rel => `Dernière sauvegarde : ${rel}.`,
  backupOpen: 'Sauvegarde …',
  account: 'Compte',
};

const ES: KontoStrings = {
  locale: 'es-ES',
  backHome: 'Volver al inicio',
  eyebrow: 'CV y carta de presentación',
  tabLogin: 'Iniciar sesión',
  tabRegister: 'Crear cuenta',
  loginTitle: 'Hola de nuevo',
  loginLead: 'Inicia sesión y tus CV estarán en todos tus dispositivos.',
  registerTitle: 'Crear una cuenta',
  registerLeadOpen: 'Con una cuenta, tus CV se guardan en el servidor que aloja este sitio y los tienes en todos tus dispositivos. Para editarlos en la cuenta necesitas el Pase de candidatura o un código de acceso.',
  registerLeadInvite: 'Para registrarte necesitas un código de invitación. Quien te envió el enlace tiene uno para ti.',
  registerCta: 'Registrarse con correo electrónico',
  registerCtaSub: 'Primero correo y contraseña, después decides sobre el pase. Sin suscripción.',
  inviteToggle: 'Tengo un código de invitación',
  usernameHint: 'De 3 a 32 caracteres: letras, números, punto, guion bajo o guion.',
  passwordHintNew: 'Al menos 8 caracteres.',
  showPassword: 'Mostrar contraseña',
  hidePassword: 'Ocultar contraseña',
  emailOpt: 'Correo electrónico (opcional)',
  emailHint: 'Te permite restablecer la contraseña tú mismo. Sin correo no es posible.',
  busy: 'Un momento …',
  forgotLink: '¿Olvidaste la contraseña?',
  forgotTitle: 'Restablecer contraseña',
  forgotLead: 'Escribe tu correo o tu nombre de usuario. Si tu cuenta tiene un correo, te enviamos un enlace.',
  forgotField: 'Correo o nombre de usuario',
  forgotSend: 'Enviar enlace',
  forgotSent: 'Si existe una cuenta con correo para esos datos, el enlace va de camino. Revisa también la carpeta de spam.',
  backToLogin: 'Volver a iniciar sesión',
  twofaTitle: 'Código de verificación',
  twofaLead: 'Te enviamos un código de seis cifras por correo. Vale 10 minutos.',
  twofaField: 'Código del correo',
  twofaSubmit: 'Confirmar e iniciar sesión',
  twofaBack: 'Iniciar sesión de otra forma',
  codeTitle: '¿Tienes un código de acceso?',
  codeLead: 'Los códigos de acceso y vales se canjean en una página propia. Si aún no tienes cuenta, la creas allí mismo.',
  codeLink: 'Canjear código',
  guestTitle: 'Seguir sin cuenta',
  guestLead: 'Todo se queda en este navegador. El PDF también se descarga sin cuenta.',
  trustTitle: 'Conviene saber',
  trust: [
    { title: 'Autoalojado', body: 'Las cuentas y los CV se guardan en el servidor que aloja este sitio. La política de privacidad indica dónde está.' },
    { title: 'Sin suscripción', body: 'Nada se renueva solo. El pase termina al acabar su plazo.' },
    { title: 'Código abierto', body: 'El código fuente es público (AGPL-3.0). Puedes comprobar qué pasa con tus datos.' },
  ],
  previewCaption: tpl => `Ejemplo: Lena Brandt (ficticia), plantilla ${tpl}`,
  errRequired: 'Rellena los dos campos, por favor.',
  errWrong: 'No coincide. Revisa el usuario o el correo y la contraseña. Si tienes dudas, restablece la contraseña.',
  errLocked: m => `Demasiados intentos seguidos. Vuelve a probar en ${m} minuto${m === 1 ? '' : 's'} o restablece la contraseña.`,
  errDisabled: 'Esta cuenta está bloqueada. Si es un error, escribe a la dirección del aviso legal.',
  errNetwork: 'El servidor no responde ahora mismo. Revisa tu conexión y vuelve a intentarlo en un momento.',
  errGeneric: 'No ha funcionado. Inténtalo de nuevo, por favor.',
  errCode: 'El código no es correcto o ha caducado. Revisa el último correo o vuelve a iniciar sesión.',
  errServerSays: msg => `Respuesta del servidor: ${msg}`,

  homeTitle: 'Tus CV',
  homeCount: n => n === 1 ? 'Un CV' : `${n} CV`,
  whereLocal: 'guardados en este navegador',
  whereAccount: 'guardados en tu cuenta',
  startTitle: 'Empezar un CV nuevo',
  startLead: 'Elige cómo empezar. El título y tu nombre van en el paso siguiente.',
  emptyTitle: 'Aquí todavía no hay nada',
  emptyLead: 'Empieza en blanco, sobrescribe el ejemplo relleno o trae tu CV actual: exportación de LinkedIn, JSON, YAML de RenderCV o Markdown.',
  emptyHint: 'Puedes cambiar de plantilla cuando quieras, el contenido se queda.',
  changed: rel => `Modificado ${rel}`,
  justNow: 'hace un momento',
  created: date => `Creado el ${date}`,
  storeLocal: 'Navegador',
  storeAccount: 'Cuenta',
  storeLocalTitle: 'Solo en este navegador',
  storeAccountTitle: 'En tu cuenta',
  open: 'Abrir',
  pdf: 'PDF',
  pdfAria: name => `Descargar el PDF de «${name}»`,
  more: name => `Más acciones para «${name}»`,
  rename: 'Cambiar nombre',
  renameLabel: 'Título en la vista general',
  renameSave: 'Guardar',
  renameCancel: 'Cancelar',
  remove: 'Eliminar',
  removeAria: name => `Eliminar «${name}»`,
  removed: name => `«${name}» eliminado.`,
  undo: 'Deshacer',
  thumbAlt: (name, tpl) => `Vista previa de «${name}», plantilla ${tpl}`,
  passTitle: 'Acceso',
  passLocal: 'Sin cuenta. El PDF es gratis.',
  passNone: 'Todavía sin pase.',
  passNoneFree: 'Todavía sin pase. El PDF es gratis.',
  passActive: (until, d) => `Pase activo hasta el ${until}, quedan ${d} día${d === 1 ? '' : 's'}.`,
  passExpired: until => `El pase caducó el ${until}. Leer y exportar sigue funcionando.`,
  passLifetime: 'Acceso permanente.',
  passUnlimited: 'Acceso ilimitado.',
  passManage: 'Mi pase',
  codeShort: 'Canjear código',
  backupTitle: 'Copia de seguridad',
  backupNever: 'Todavía no hay archivo de copia. Descarga uno y podrás recuperarlo todo, también en otro dispositivo.',
  backupLast: rel => `Última copia: ${rel}.`,
  backupOpen: 'Copia …',
  account: 'Cuenta',
};

export const KONTO_I18N: Record<UiLang, KontoStrings> = { de: DE, en: EN, fr: FR, es: ES };

/** „vor 3 Tagen", „gestern", „heute" in der Oberflächensprache. */
export function relativeDay(iso: string, locale: string, justNow?: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const min = Math.round(diff / 60000);
  if (min < 1) return justNow ?? rtf.format(0, 'second');
  if (min < 60) return rtf.format(-min, 'minute');
  const h = Math.round(min / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  const d = Math.round(h / 24);
  if (d < 30) return rtf.format(-d, 'day');
  return new Date(t).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}
