/**
 * Texte für Zugangscodes (Gutscheine, 09.10.2026): Seite /code, das Codefeld
 * in „Mein Pass", der Link auf /preise, die Herkunft einer Berechtigung und
 * die Bänder nach Ablauf eines Gratiszugangs. Vier Sprachen; im Deutschen wird
 * geduzt, im Französischen gesiezt, im Spanischen geduzt — wie in billing.ts.
 *
 * Vorgaben: „30 Tage kostenlos", nicht „ein Monat". Kein
 * Abo, keine Zahlungsdaten, nichts wird abgebucht. Der dauerhafte
 * Gratiszugang verspricht kein ewiges Bestehen des Dienstes, und wer ihn hat,
 * bekommt nie eine Kaufaufforderung. Keine Countdowns, keine Restplätze.
 * Fehlertexte verraten nichts über fremde Konten.
 */
import type { UiLang } from '../i18n';
import type { VoucherReason } from '../../billing/api';

export interface GutscheinStrings {
  // Einstieg
  haveCode: string;
  codeLabel: string;
  codeHint: string;
  check: string;
  checking: string;
  redeem: string;
  redeeming: string;
  empty: string;
  // Seite /code
  pageTitle: string;
  eyebrow: string;
  h1: string;
  lede: string;
  termsTitle: string;
  termDays: (days: number) => string;
  termLifetime: string;
  termRedeemUntil: (date: string) => string;
  termLimited: (n: number) => string;
  termOnce: string;
  termNoPayment: string;
  termLifetimeNote: string;
  termIncludes: string;
  previewNote: string;
  needAccount: string;
  createAccount: string;
  signIn: string;
  regClosed: string;
  inviteHint: string;
  unconfirmed: (email: string | null) => string;
  confirmTitle: string;
  signedInAs: (who: string) => string;
  signOut: string;
  otherCode: string;
  remembered: string;
  // Ergebnis
  okTitle: string;
  okDays: (date: string) => string;
  okDaysAppended: (days: number, date: string) => string;
  okLifetime: string;
  toTool: string;
  toMyPass: string;
  // Fehler
  err: Record<VoucherReason, string>;
  // „Mein Pass"
  originTitle: string;
  origin: Record<'order' | 'voucher' | 'pilot' | 'admin', string>;
  grantDays: (days: number) => string;
  grantLifetime: string;
  grantSince: (date: string) => string;
  mpLifetime: string;
  mpFreeActive: (date: string) => string;
  mpFreeExpired: (date: string) => string;
  lifetimeNoCode: string;
  unlock: (days: number, price: string) => string;
  exportHint: string;
  // Bänder im Werkzeug
  freeSoon: (date: string) => string;
  freeExpired: (date: string) => string;
  // Kauf bei dauerhaftem Gratiszugang
  coLifetimeTitle: string;
  coLifetimeBody: string;
}

const de: GutscheinStrings = {
  haveCode: 'Du hast einen Zugangscode?',
  codeLabel: 'Zugangscode',
  codeHint: 'Groß- und Kleinschreibung, Leerzeichen und Bindestriche spielen keine Rolle.',
  check: 'Code prüfen',
  checking: 'Wird geprüft …',
  redeem: 'Code einlösen',
  redeeming: 'Wird eingelöst …',
  empty: 'Bitte gib einen Code ein.',
  pageTitle: 'Zugangscode einlösen',
  eyebrow: 'Bewerbungs-Pass',
  h1: 'Zugangscode einlösen',
  lede: 'Mit einem Zugangscode bekommst du den Bewerbungs-Pass kostenlos. Ohne Zahlungsdaten, ohne Abo.',
  termsTitle: 'Das bekommst du mit diesem Code',
  termDays: n => `${n} Tage Bewerbungs-Pass kostenlos, gerechnet ab der Einlösung`,
  termLifetime: 'Dauerhafter Gratiszugang zum Bewerbungs-Pass, ohne Ablaufdatum',
  termRedeemUntil: d => `Einlösbar bis ${d}`,
  termLimited: n => `Für die ersten ${n} erfolgreichen Einlösungen`,
  termOnce: 'Jedes Konto kann diesen Code einmal einlösen.',
  termNoPayment: 'Keine Zahlungsdaten, kein Abo. Danach endet der Zugang automatisch, es wird nichts abgebucht.',
  termLifetimeNote: 'Keine Zahlungsdaten, kein Abo. Es gelten die üblichen Nutzungsregeln.',
  termIncludes: 'Enthalten ist alles aus dem Bewerbungs-Pass: Speichern im Konto, Sharelinks, Versionen, KI-Verbindung und API-Schlüssel.',
  previewNote: 'Die Prüfung reserviert nichts. Erst die Einlösung zählt.',
  needAccount: 'Zum Einlösen brauchst du ein Konto mit bestätigter E-Mail-Adresse. Dein Code bleibt bis zu 24 Stunden in diesem Browser gemerkt, du musst ihn nicht noch einmal eintippen.',
  createAccount: 'Konto erstellen',
  signIn: 'Anmelden',
  regClosed: 'Die öffentliche Aktion ist noch nicht gestartet. Mit einem bestehenden Konto kannst du dich anmelden.',
  inviteHint: 'Du hast eine Einladung? Registriere dich über deinen Einladungslink. Danach geht es hier mit deinem Code weiter.',
  unconfirmed: e => `Bestätige zuerst deine E-Mail-Adresse${e ? ` (${e})` : ''}: Öffne den Link in der Mail, die wir dir geschickt haben. Danach geht es hier mit deinem Code weiter.`,
  confirmTitle: 'Bitte bestätige die Einlösung',
  signedInAs: w => `Angemeldet als ${w}`,
  signOut: 'Abmelden',
  otherCode: 'Anderen Code eingeben',
  remembered: 'Dein Code ist gemerkt.',
  okTitle: 'Eingelöst',
  okDays: d => `Dein Gratiszugang ist bis ${d} aktiv. Danach endet er automatisch. Es wird nichts abgebucht.`,
  okDaysAppended: (n, d) => `Die ${n} Gratistage hängen sich an deine bisherige Laufzeit an. Dein Zugang ist jetzt bis ${d} aktiv. Danach endet er automatisch. Es wird nichts abgebucht.`,
  okLifetime: 'Dein dauerhafter Gratiszugang ist aktiv. Du musst keinen Bewerbungs-Pass kaufen.',
  toTool: 'Zum Werkzeug',
  toMyPass: 'Mein Pass ansehen',
  err: {
    invalid: 'Diesen Code kennen wir nicht. Prüf bitte die Schreibweise.',
    expired: 'Dieser Code ist nicht mehr einlösbar, die Einlösefrist ist vorbei.',
    exhausted: 'Dieser Code ist ausgeschöpft, alle Einlösungen sind vergeben.',
    inactive: 'Dieser Code ist nicht mehr aktiv.',
    already_redeemed: 'Du hast diesen Code schon eingelöst.',
    campaign_redeemed: 'Du hast schon einen Code aus derselben Aktion eingelöst. Je Aktion geht das einmal.',
    already_lifetime: 'Du hast bereits einen dauerhaften Gratiszugang. Der Code wurde nicht verbraucht.',
    email_unconfirmed: 'Bitte bestätige zuerst deine E-Mail-Adresse. Danach kannst du den Code einlösen.',
    auth_required: 'Bitte melde dich an, um den Code einzulösen.',
  },
  originTitle: 'Herkunft',
  origin: { order: 'Bewerbungs-Pass, bezahlt', voucher: 'Gutschein', pilot: 'Pilot-Zugang', admin: 'Freigabe' },
  grantDays: n => (n === 1 ? '1 Tag' : `${n} Tage`),
  grantLifetime: 'dauerhaft',
  grantSince: d => `seit ${d}`,
  mpLifetime: 'Dauerhafter Gratiszugang aktiv. Du musst keinen Bewerbungs-Pass kaufen.',
  mpFreeActive: d => `Gratiszugang aktiv bis ${d}. Danach endet er automatisch, es wird nichts abgebucht.`,
  mpFreeExpired: d => `Dein Gratiszugang ist am ${d} abgelaufen. Deine Daten bleiben, Lesen und Exportieren gehen weiter.`,
  lifetimeNoCode: 'Du hast schon einen dauerhaften Gratiszugang. Weitere Codes brauchst du nicht.',
  unlock: (n, p) => `${n} Tage für ${p} freischalten`,
  exportHint: 'Exportieren geht immer, auch ohne Pass: PDF, Word, Markdown und JSON.',
  freeSoon: d => `Dein Gratiszugang endet am ${d}. Danach endet er automatisch, es wird nichts abgebucht. Lesen und Exportieren gehen weiter.`,
  freeExpired: d => `Dein Gratiszugang ist am ${d} abgelaufen. Deine Daten bleiben erhalten, Lesen und Exportieren gehen weiter. Zum Ändern brauchst du einen Bewerbungs-Pass.`,
  coLifetimeTitle: 'Du hast einen dauerhaften Gratiszugang – kein Kauf nötig',
  coLifetimeBody: 'Alles aus dem Bewerbungs-Pass steht dir schon zur Verfügung. Hier gibt es nichts zu bezahlen.',
};

const en: GutscheinStrings = {
  haveCode: 'Do you have an access code?',
  codeLabel: 'Access code',
  codeHint: 'Upper or lower case, spaces and hyphens do not matter.',
  check: 'Check code',
  checking: 'Checking …',
  redeem: 'Redeem code',
  redeeming: 'Redeeming …',
  empty: 'Please enter a code.',
  pageTitle: 'Redeem access code',
  eyebrow: 'Application Pass',
  h1: 'Redeem an access code',
  lede: 'An access code gives you the Application Pass for free. No payment details, no subscription.',
  termsTitle: 'What this code gives you',
  termDays: n => `${n} days of Application Pass for free, counted from redemption`,
  termLifetime: 'Permanent free access to the Application Pass, no end date',
  termRedeemUntil: d => `Redeemable until ${d}`,
  termLimited: n => `For the first ${n} successful redemptions`,
  termOnce: 'Each account can redeem this code once.',
  termNoPayment: 'No payment details, no subscription. Access ends on its own afterwards, nothing is charged.',
  termLifetimeNote: 'No payment details, no subscription. The usual terms of use apply.',
  termIncludes: 'Includes everything in the Application Pass: saving in the account, share links, versions, AI connection and API keys.',
  previewNote: 'Checking reserves nothing. Only redeeming counts.',
  needAccount: 'To redeem, you need an account with a confirmed e-mail address. Your code is remembered in this browser for up to 24 hours, so you will not have to type it again.',
  createAccount: 'Create account',
  signIn: 'Sign in',
  regClosed: 'The public campaign has not started yet. You can sign in with an existing account.',
  inviteHint: 'Have an invitation? Register via your invitation link. You will then continue here with your code.',
  unconfirmed: e => `First confirm your e-mail address${e ? ` (${e})` : ''}: open the link in the e-mail we sent you. You will then continue here with your code.`,
  confirmTitle: 'Please confirm the redemption',
  signedInAs: w => `Signed in as ${w}`,
  signOut: 'Sign out',
  otherCode: 'Enter a different code',
  remembered: 'Your code is remembered.',
  okTitle: 'Redeemed',
  okDays: d => `Your free access is active until ${d}. It ends on its own afterwards. Nothing is charged.`,
  okDaysAppended: (n, d) => `The ${n} free days are added after your current access. Your access now runs until ${d}. It ends on its own afterwards. Nothing is charged.`,
  okLifetime: 'Your permanent free access is active. You do not need to buy an Application Pass.',
  toTool: 'Go to the tool',
  toMyPass: 'View my pass',
  err: {
    invalid: 'We do not know this code. Please check the spelling.',
    expired: 'This code can no longer be redeemed, the redemption period is over.',
    exhausted: 'This code is used up, all redemptions are taken.',
    inactive: 'This code is no longer active.',
    already_redeemed: 'You have already redeemed this code.',
    campaign_redeemed: 'You have already redeemed a code from the same campaign. That works once per campaign.',
    already_lifetime: 'You already have permanent free access. The code was not used.',
    email_unconfirmed: 'Please confirm your e-mail address first. You can then redeem the code.',
    auth_required: 'Please sign in to redeem the code.',
  },
  originTitle: 'Source',
  origin: { order: 'Application Pass, paid', voucher: 'Voucher', pilot: 'Pilot access', admin: 'Granted' },
  grantDays: n => (n === 1 ? '1 day' : `${n} days`),
  grantLifetime: 'permanent',
  grantSince: d => `since ${d}`,
  mpLifetime: 'Permanent free access active. You do not need to buy an Application Pass.',
  mpFreeActive: d => `Free access active until ${d}. It ends on its own afterwards, nothing is charged.`,
  mpFreeExpired: d => `Your free access ended on ${d}. Your data stays, reading and exporting still work.`,
  lifetimeNoCode: 'You already have permanent free access. You do not need any more codes.',
  unlock: (n, p) => `Unlock ${n} days for ${p}`,
  exportHint: 'Exporting always works, even without a pass: PDF, Word, Markdown and JSON.',
  freeSoon: d => `Your free access ends on ${d}. It ends on its own, nothing is charged. Reading and exporting keep working.`,
  freeExpired: d => `Your free access ended on ${d}. Your data is kept, reading and exporting still work. To make changes you need an Application Pass.`,
  coLifetimeTitle: 'You have permanent free access, so there is nothing to buy',
  coLifetimeBody: 'Everything in the Application Pass is already available to you. There is nothing to pay here.',
};

const fr: GutscheinStrings = {
  haveCode: 'Vous avez un code d’accès ?',
  codeLabel: 'Code d’accès',
  codeHint: 'Majuscules, minuscules, espaces et tirets n’ont pas d’importance.',
  check: 'Vérifier le code',
  checking: 'Vérification …',
  redeem: 'Utiliser le code',
  redeeming: 'Activation …',
  empty: 'Veuillez saisir un code.',
  pageTitle: 'Utiliser un code d’accès',
  eyebrow: 'Pass candidature',
  h1: 'Utiliser un code d’accès',
  lede: 'Avec un code d’accès, vous obtenez le Pass candidature gratuitement. Sans données de paiement, sans abonnement.',
  termsTitle: 'Ce que vous obtenez avec ce code',
  termDays: n => `${n} jours de Pass candidature gratuits, à compter de l’activation`,
  termLifetime: 'Accès gratuit permanent au Pass candidature, sans date de fin',
  termRedeemUntil: d => `À utiliser jusqu’au ${d}`,
  termLimited: n => `Pour les ${n} premières activations réussies`,
  termOnce: 'Chaque compte peut utiliser ce code une fois.',
  termNoPayment: 'Sans données de paiement, sans abonnement. L’accès prend fin automatiquement ensuite, rien n’est prélevé.',
  termLifetimeNote: 'Sans données de paiement, sans abonnement. Les règles d’utilisation habituelles s’appliquent.',
  termIncludes: 'Tout le Pass candidature est inclus : enregistrement dans le compte, liens de partage, versions, connexion IA et clés API.',
  previewNote: 'La vérification ne réserve rien. Seule l’activation compte.',
  needAccount: 'Pour l’utiliser, il vous faut un compte avec une adresse e-mail confirmée. Votre code reste mémorisé dans ce navigateur jusqu’à 24 heures, vous n’aurez pas à le ressaisir.',
  createAccount: 'Créer un compte',
  signIn: 'Se connecter',
  regClosed: 'L’opération publique n’a pas encore commencé. Vous pouvez vous connecter avec un compte existant.',
  inviteHint: 'Vous avez une invitation ? Inscrivez-vous via votre lien d’invitation. Vous reviendrez ensuite ici avec votre code.',
  unconfirmed: e => `Confirmez d’abord votre adresse e-mail${e ? ` (${e})` : ''} : ouvrez le lien de l’e-mail que nous vous avons envoyé. Vous reviendrez ensuite ici avec votre code.`,
  confirmTitle: 'Veuillez confirmer l’activation',
  signedInAs: w => `Connecté en tant que ${w}`,
  signOut: 'Se déconnecter',
  otherCode: 'Saisir un autre code',
  remembered: 'Votre code est mémorisé.',
  okTitle: 'Activé',
  okDays: d => `Votre accès gratuit est actif jusqu’au ${d}. Il prend fin automatiquement ensuite. Rien n’est prélevé.`,
  okDaysAppended: (n, d) => `Les ${n} jours gratuits s’ajoutent à votre durée actuelle. Votre accès est maintenant actif jusqu’au ${d}. Il prend fin automatiquement ensuite. Rien n’est prélevé.`,
  okLifetime: 'Votre accès gratuit permanent est actif. Vous n’avez pas besoin d’acheter de Pass candidature.',
  toTool: 'Aller à l’outil',
  toMyPass: 'Voir mon pass',
  err: {
    invalid: 'Nous ne connaissons pas ce code. Vérifiez l’orthographe.',
    expired: 'Ce code ne peut plus être utilisé, le délai est passé.',
    exhausted: 'Ce code est épuisé, toutes les activations sont prises.',
    inactive: 'Ce code n’est plus actif.',
    already_redeemed: 'Vous avez déjà utilisé ce code.',
    campaign_redeemed: 'Vous avez déjà utilisé un code de la même opération. C’est possible une fois par opération.',
    already_lifetime: 'Vous avez déjà un accès gratuit permanent. Le code n’a pas été consommé.',
    email_unconfirmed: 'Veuillez d’abord confirmer votre adresse e-mail. Vous pourrez ensuite utiliser le code.',
    auth_required: 'Veuillez vous connecter pour utiliser le code.',
  },
  originTitle: 'Origine',
  origin: { order: 'Pass candidature, payé', voucher: 'Bon', pilot: 'Accès pilote', admin: 'Accordé' },
  grantDays: n => (n === 1 ? '1 jour' : `${n} jours`),
  grantLifetime: 'permanent',
  grantSince: d => `depuis le ${d}`,
  mpLifetime: 'Accès gratuit permanent actif. Vous n’avez pas besoin d’acheter de Pass candidature.',
  mpFreeActive: d => `Accès gratuit actif jusqu’au ${d}. Il prend fin automatiquement ensuite, rien n’est prélevé.`,
  mpFreeExpired: d => `Votre accès gratuit a pris fin le ${d}. Vos données restent, lire et exporter restent possibles.`,
  lifetimeNoCode: 'Vous avez déjà un accès gratuit permanent. Vous n’avez pas besoin d’autres codes.',
  unlock: (n, p) => `Débloquer ${n} jours pour ${p}`,
  exportHint: 'L’export fonctionne toujours, même sans pass : PDF, Word, Markdown et JSON.',
  freeSoon: d => `Votre accès gratuit se termine le ${d}. Il prend fin automatiquement, rien n’est prélevé. Lire et exporter restent possibles.`,
  freeExpired: d => `Votre accès gratuit a pris fin le ${d}. Vos données sont conservées, lire et exporter restent possibles. Pour modifier, il vous faut un Pass candidature.`,
  coLifetimeTitle: 'Vous avez un accès gratuit permanent, aucun achat n’est nécessaire',
  coLifetimeBody: 'Tout le Pass candidature est déjà à votre disposition. Il n’y a rien à payer ici.',
};

const es: GutscheinStrings = {
  haveCode: '¿Tienes un código de acceso?',
  codeLabel: 'Código de acceso',
  codeHint: 'Mayúsculas, minúsculas, espacios y guiones no importan.',
  check: 'Comprobar código',
  checking: 'Comprobando …',
  redeem: 'Canjear código',
  redeeming: 'Canjeando …',
  empty: 'Introduce un código.',
  pageTitle: 'Canjear código de acceso',
  eyebrow: 'Pase de candidatura',
  h1: 'Canjear un código de acceso',
  lede: 'Con un código de acceso obtienes el Pase de candidatura gratis. Sin datos de pago, sin suscripción.',
  termsTitle: 'Lo que obtienes con este código',
  termDays: n => `${n} días de Pase de candidatura gratis, contados desde el canje`,
  termLifetime: 'Acceso gratuito permanente al Pase de candidatura, sin fecha de fin',
  termRedeemUntil: d => `Canjeable hasta el ${d}`,
  termLimited: n => `Para los primeros ${n} canjes realizados`,
  termOnce: 'Cada cuenta puede canjear este código una vez.',
  termNoPayment: 'Sin datos de pago, sin suscripción. Después el acceso termina solo, no se cobra nada.',
  termLifetimeNote: 'Sin datos de pago, sin suscripción. Se aplican las normas de uso habituales.',
  termIncludes: 'Incluye todo el Pase de candidatura: guardar en la cuenta, enlaces para compartir, versiones, conexión con IA y claves API.',
  previewNote: 'La comprobación no reserva nada. Solo cuenta el canje.',
  needAccount: 'Para canjearlo necesitas una cuenta con el correo confirmado. Tu código queda guardado en este navegador hasta 24 horas, no tendrás que escribirlo otra vez.',
  createAccount: 'Crear cuenta',
  signIn: 'Iniciar sesión',
  regClosed: 'La campaña pública aún no ha empezado. Puedes iniciar sesión con una cuenta existente.',
  inviteHint: '¿Tienes una invitación? Regístrate con tu enlace de invitación. Después sigues aquí con tu código.',
  unconfirmed: e => `Primero confirma tu correo${e ? ` (${e})` : ''}: abre el enlace del correo que te enviamos. Después sigues aquí con tu código.`,
  confirmTitle: 'Confirma el canje',
  signedInAs: w => `Sesión iniciada como ${w}`,
  signOut: 'Cerrar sesión',
  otherCode: 'Introducir otro código',
  remembered: 'Tu código está guardado.',
  okTitle: 'Canjeado',
  okDays: d => `Tu acceso gratuito está activo hasta el ${d}. Después termina solo. No se cobra nada.`,
  okDaysAppended: (n, d) => `Los ${n} días gratis se suman a tu duración actual. Tu acceso está activo ahora hasta el ${d}. Después termina solo. No se cobra nada.`,
  okLifetime: 'Tu acceso gratuito permanente está activo. No necesitas comprar un Pase de candidatura.',
  toTool: 'Ir a la herramienta',
  toMyPass: 'Ver mi pase',
  err: {
    invalid: 'No conocemos este código. Revisa cómo está escrito.',
    expired: 'Este código ya no se puede canjear, el plazo ha terminado.',
    exhausted: 'Este código está agotado, todos los canjes están ocupados.',
    inactive: 'Este código ya no está activo.',
    already_redeemed: 'Ya has canjeado este código.',
    campaign_redeemed: 'Ya has canjeado un código de la misma campaña. Se puede una vez por campaña.',
    already_lifetime: 'Ya tienes acceso gratuito permanente. El código no se ha usado.',
    email_unconfirmed: 'Primero confirma tu correo. Después podrás canjear el código.',
    auth_required: 'Inicia sesión para canjear el código.',
  },
  originTitle: 'Origen',
  origin: { order: 'Pase de candidatura, pagado', voucher: 'Cupón', pilot: 'Acceso piloto', admin: 'Concedido' },
  grantDays: n => (n === 1 ? '1 día' : `${n} días`),
  grantLifetime: 'permanente',
  grantSince: d => `desde el ${d}`,
  mpLifetime: 'Acceso gratuito permanente activo. No necesitas comprar un Pase de candidatura.',
  mpFreeActive: d => `Acceso gratuito activo hasta el ${d}. Después termina solo, no se cobra nada.`,
  mpFreeExpired: d => `Tu acceso gratuito terminó el ${d}. Tus datos se quedan, leer y exportar siguen funcionando.`,
  lifetimeNoCode: 'Ya tienes acceso gratuito permanente. No necesitas más códigos.',
  unlock: (n, p) => `Desbloquear ${n} días por ${p}`,
  exportHint: 'Exportar funciona siempre, también sin pase: PDF, Word, Markdown y JSON.',
  freeSoon: d => `Tu acceso gratuito termina el ${d}. Termina solo, no se cobra nada. Leer y exportar siguen funcionando.`,
  freeExpired: d => `Tu acceso gratuito terminó el ${d}. Tus datos se conservan, leer y exportar siguen funcionando. Para hacer cambios necesitas un Pase de candidatura.`,
  coLifetimeTitle: 'Tienes acceso gratuito permanente, no hace falta comprar',
  coLifetimeBody: 'Todo el Pase de candidatura ya está a tu disposición. Aquí no hay nada que pagar.',
};

export const GUTSCHEIN_I18N: Record<UiLang, GutscheinStrings> = { de, en, fr, es };
