/**
 * Texte rund um E-Mails (E-Mail-Workflows, 10.10.2026, pdf-service/MAILS.md):
 * Häkchen „Tipps per E-Mail" bei der Registrierung, Abschnitt „E-Mails" in den
 * Kontoeinstellungen, Abmeldeseite ohne Anmeldung (/mail/abmelden).
 *
 * Deutsch, Englisch und Spanisch duzen, Französisch siezt (wie die übrige
 * Oberfläche). Der Text des Häkchens ist der Einwilligungstext: Er ändert sich
 * nur zusammen mit TIPS_CONSENT_VERSION (gleiche Fassung in
 * pdf-service/mailflows.js, sonst nimmt der Server die Einwilligung nicht an).
 */
import type { UiLang } from '../i18n';

export const TIPS_CONSENT_VERSION = '2026-10-10';

export interface MailStrings {
  /** Einwilligungstext (Häkchen). */
  tipsConsent: string;
  /** Satz darunter: freiwillig, wann wirksam, Datenschutz-Link. */
  tipsConsentHint: [string, string, string];
  // Kontoeinstellungen
  sectionTitle: string;
  serviceNote: string;
  tipsTitle: string;
  stateOn: (date: string, version: string) => string;
  statePending: string;
  stateOff: string;
  pendingSent: string;
  pendingNotSent: string;
  turnedOff: string;
  noEmail: string;
  langLabel: string;
  langNames: Record<UiLang, string>;
  saved: string;
  error: string;
  versionChanged: string;
  // Abmeldeseite
  unsubTitle: string;
  unsubLead: string;
  unsubButton: string;
  unsubBusy: string;
  unsubDone: string;
  unsubAlready: string;
  unsubInvalid: string;
  unsubServiceNote: string;
  toEditor: string;
  dateLocale: string;
}

const de: MailStrings = {
  tipsConsent: 'Ja, ich möchte in den ersten zwei Wochen bis zu drei Tipps zur Nutzung per E-Mail bekommen. Abbestellen geht jederzeit mit einem Klick.',
  tipsConsentHint: ['Freiwillig, das Konto funktioniert auch ohne. Die Einwilligung gilt erst, wenn du deine Adresse bestätigt hast. Mehr dazu in der ', 'Datenschutzerklärung', '.'],
  sectionTitle: 'E-Mails',
  serviceNote: 'Mails zu Konto, Sicherheit, Bestellung und Laufzeit bekommst du, solange das Konto besteht. Sie gehören zum Vertrag und lassen sich deshalb nicht abbestellen.',
  tipsTitle: 'Tipps zur Nutzung',
  stateOn: (d, v) => `Eingewilligt am ${d} (Fassung ${v}).`,
  statePending: 'Wartet auf die Bestätigung deiner E-Mail-Adresse.',
  stateOff: 'Aus. Du bekommst keine Tipps.',
  pendingSent: 'Wir haben dir einen Bestätigungslink geschickt. Erst nach dem Klick kommen Tipps.',
  pendingNotSent: 'Der Bestätigungslink ließ sich gerade nicht verschicken. Die Einwilligung wartet, bis deine Adresse bestätigt ist.',
  turnedOff: 'Abbestellt. Es kommen keine Tipps mehr.',
  noEmail: 'Für Tipps braucht das Konto eine E-Mail-Adresse.',
  langLabel: 'Sprache der Mails',
  langNames: { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español' },
  saved: 'Gespeichert.',
  error: 'Das hat nicht geklappt. Bitte noch einmal versuchen.',
  versionChanged: 'Der Text hat sich geändert. Bitte lade die Seite neu.',
  unsubTitle: 'Tipps abbestellen',
  unsubLead: 'Mit einem Klick bekommst du keine Tipps mehr per E-Mail. Eine Anmeldung ist nicht nötig.',
  unsubButton: 'Tipps abbestellen',
  unsubBusy: 'Einen Moment …',
  unsubDone: 'Erledigt. Du bekommst keine Tipps mehr. Einschalten kannst du sie jederzeit wieder in den Kontoeinstellungen unter „E-Mails“.',
  unsubAlready: 'Für dieses Konto waren keine Tipps eingeschaltet. Es kommen keine.',
  unsubInvalid: 'Dieser Abmeldelink ist ungültig. Melde dich an und schalte die Tipps in den Kontoeinstellungen unter „E-Mails“ ab, oder antworte einfach auf eine der Mails.',
  unsubServiceNote: 'Mails zu Konto, Sicherheit und Bestellung kommen weiter, solange das Konto besteht.',
  toEditor: 'Zum Editor',
  dateLocale: 'de-DE',
};

const en: MailStrings = {
  tipsConsent: 'Yes, I would like up to three tips on using the tool by e-mail during the first two weeks. I can unsubscribe at any time with one click.',
  tipsConsentHint: ['Optional, the account works without it. The consent only takes effect once you have confirmed your address. More in the ', 'privacy policy', '.'],
  sectionTitle: 'E-mails',
  serviceNote: 'You receive e-mails about your account, security, orders and access period for as long as the account exists. They are part of the contract and cannot be unsubscribed.',
  tipsTitle: 'Tips on using the tool',
  stateOn: (d, v) => `Consent given on ${d} (version ${v}).`,
  statePending: 'Waiting for you to confirm your e-mail address.',
  stateOff: 'Off. You do not receive tips.',
  pendingSent: 'We have sent you a confirmation link. Tips only start after you click it.',
  pendingNotSent: 'The confirmation link could not be sent right now. The consent waits until your address is confirmed.',
  turnedOff: 'Unsubscribed. No more tips.',
  noEmail: 'Tips need an e-mail address in the account.',
  langLabel: 'Language of e-mails',
  langNames: { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español' },
  saved: 'Saved.',
  error: 'That did not work. Please try again.',
  versionChanged: 'The text has changed. Please reload the page.',
  unsubTitle: 'Unsubscribe from tips',
  unsubLead: 'One click and you will no longer receive tips by e-mail. No login needed.',
  unsubButton: 'Unsubscribe from tips',
  unsubBusy: 'One moment …',
  unsubDone: 'Done. You will not receive any more tips. You can switch them back on at any time in the account settings under “E-mails”.',
  unsubAlready: 'Tips were not switched on for this account. None will be sent.',
  unsubInvalid: 'This unsubscribe link is invalid. Log in and switch off tips in the account settings under “E-mails”, or simply reply to one of the e-mails.',
  unsubServiceNote: 'E-mails about your account, security and orders continue for as long as the account exists.',
  toEditor: 'Open the editor',
  dateLocale: 'en-GB',
};

const fr: MailStrings = {
  tipsConsent: 'Oui, je souhaite recevoir par e-mail jusqu’à trois conseils d’utilisation pendant les deux premières semaines. Je peux me désabonner à tout moment en un clic.',
  tipsConsentHint: ['Facultatif, le compte fonctionne aussi sans. Le consentement ne prend effet qu’après la confirmation de votre adresse. Plus d’informations dans la ', 'politique de confidentialité', '.'],
  sectionTitle: 'E-mails',
  serviceNote: 'Vous recevez les e-mails concernant le compte, la sécurité, les commandes et la durée d’accès tant que le compte existe. Ils font partie du contrat et ne peuvent donc pas être désactivés.',
  tipsTitle: 'Conseils d’utilisation',
  stateOn: (d, v) => `Consentement donné le ${d} (version ${v}).`,
  statePending: 'En attente de la confirmation de votre adresse e-mail.',
  stateOff: 'Désactivé. Vous ne recevez pas de conseils.',
  pendingSent: 'Nous vous avons envoyé un lien de confirmation. Les conseils ne commencent qu’après votre clic.',
  pendingNotSent: 'Le lien de confirmation n’a pas pu être envoyé pour le moment. Le consentement attend la confirmation de votre adresse.',
  turnedOff: 'Désabonné. Vous ne recevrez plus de conseils.',
  noEmail: 'Les conseils nécessitent une adresse e-mail dans le compte.',
  langLabel: 'Langue des e-mails',
  langNames: { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español' },
  saved: 'Enregistré.',
  error: 'Cela n’a pas fonctionné. Veuillez réessayer.',
  versionChanged: 'Le texte a changé. Veuillez recharger la page.',
  unsubTitle: 'Se désabonner des conseils',
  unsubLead: 'En un clic, vous ne recevez plus de conseils par e-mail. Aucune connexion n’est nécessaire.',
  unsubButton: 'Se désabonner des conseils',
  unsubBusy: 'Un instant …',
  unsubDone: 'C’est fait. Vous ne recevrez plus de conseils. Vous pouvez les réactiver à tout moment dans les paramètres du compte, rubrique « E-mails ».',
  unsubAlready: 'Les conseils n’étaient pas activés pour ce compte. Aucun ne sera envoyé.',
  unsubInvalid: 'Ce lien de désabonnement n’est pas valable. Connectez-vous et désactivez les conseils dans les paramètres du compte, rubrique « E-mails », ou répondez simplement à l’un des e-mails.',
  unsubServiceNote: 'Les e-mails concernant le compte, la sécurité et les commandes continuent tant que le compte existe.',
  toEditor: 'Ouvrir l’éditeur',
  dateLocale: 'fr-FR',
};

const es: MailStrings = {
  tipsConsent: 'Sí, quiero recibir por correo hasta tres consejos de uso durante las dos primeras semanas. Puedo darme de baja cuando quiera con un clic.',
  tipsConsentHint: ['Opcional, la cuenta funciona también sin ello. El consentimiento solo es válido cuando hayas confirmado tu dirección. Más información en la ', 'política de privacidad', '.'],
  sectionTitle: 'Correos',
  serviceNote: 'Los correos sobre la cuenta, la seguridad, los pedidos y la duración del acceso te llegan mientras exista la cuenta. Forman parte del contrato y por eso no se pueden desactivar.',
  tipsTitle: 'Consejos de uso',
  stateOn: (d, v) => `Consentimiento dado el ${d} (versión ${v}).`,
  statePending: 'Pendiente de que confirmes tu dirección de correo.',
  stateOff: 'Desactivado. No recibes consejos.',
  pendingSent: 'Te hemos enviado un enlace de confirmación. Los consejos empiezan después de tu clic.',
  pendingNotSent: 'Ahora mismo no se pudo enviar el enlace de confirmación. El consentimiento espera a que confirmes tu dirección.',
  turnedOff: 'Baja confirmada. No recibirás más consejos.',
  noEmail: 'Para recibir consejos, la cuenta necesita una dirección de correo.',
  langLabel: 'Idioma de los correos',
  langNames: { de: 'Deutsch', en: 'English', fr: 'Français', es: 'Español' },
  saved: 'Guardado.',
  error: 'No ha funcionado. Inténtalo de nuevo.',
  versionChanged: 'El texto ha cambiado. Vuelve a cargar la página.',
  unsubTitle: 'Darse de baja de los consejos',
  unsubLead: 'Con un clic dejas de recibir consejos por correo. No hace falta iniciar sesión.',
  unsubButton: 'Darse de baja de los consejos',
  unsubBusy: 'Un momento …',
  unsubDone: 'Hecho. No recibirás más consejos. Puedes volver a activarlos cuando quieras en los ajustes de la cuenta, en «Correos».',
  unsubAlready: 'Los consejos no estaban activados para esta cuenta. No se enviará ninguno.',
  unsubInvalid: 'Este enlace de baja no es válido. Inicia sesión y desactiva los consejos en los ajustes de la cuenta, en «Correos», o responde a uno de los correos.',
  unsubServiceNote: 'Los correos sobre la cuenta, la seguridad y los pedidos siguen llegando mientras exista la cuenta.',
  toEditor: 'Abrir el editor',
  dateLocale: 'es-ES',
};

export const MAILS_I18N: Record<UiLang, MailStrings> = { de, en, fr, es };
