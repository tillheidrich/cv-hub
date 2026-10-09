/**
 * Texte rund um Konto und Zugang (Runde 3, 09.10.2026):
 *
 *  - Rückfrage beim Abmelden, wenn in diesem Browser noch Lebensläufe aus dem
 *    Arbeiten ohne Konto liegen. Vorher löschte Abmelden sie ungefragt.
 *  - Laufzeit eines Pilot-Platzes: Hinweis 14 und 3 Tage vor Ablauf, danach
 *    Nur-Lese-Modus. Die Tage und das Datum rechnet der Server
 *    (pdf-service/access.js, `accessInfo`), hier wird nur angezeigt.
 *
 * Im Deutschen wird geduzt, wie überall in der App.
 */
import type { UiLang } from '../i18n';

export interface ZugangStrings {
  locale: string;
  // Abmelden
  logoutTitle: string;
  logoutBody: (n: number) => string;
  keepLocal: string;
  keepLocalSub: string;
  deleteLocal: string;
  deleteLocalSub: string;
  logoutConfirm: string;
  cancel: string;
  // Laufzeit
  soon: (date: string, days: number) => string;
  final: (date: string, days: number) => string;
  expired: (date: string) => string;
  exportNow: string;
  dismiss: string;
  readOnlyStatus: string;
  readOnlyContent: string;
  readOnlyDesign: string;
  readOnlyHome: string;
  // Bewerbungs-Pass (Runde 4): dieselben Stufen, aber mit Ausgang „verlängern"
  // statt „wende dich an die Person, von der du den Zugang hast".
  passSoon: (date: string, days: number) => string;
  passFinal: (date: string, days: number) => string;
  passExpired: (date: string) => string;
  planNone: string;
  getPass: string;
  extendPass: string;
  noneReadOnlyContent: string;
  noneReadOnlyDesign: string;
  noneReadOnlyHome: string;
  passReadOnlyContent: string;
  passReadOnlyHome: string;
}

const days = {
  de: (n: number) => (n === 1 ? 'einem Tag' : `${n} Tagen`),
  en: (n: number) => (n === 1 ? '1 day' : `${n} days`),
  fr: (n: number) => (n === 1 ? '1 jour' : `${n} jours`),
  es: (n: number) => (n === 1 ? '1 día' : `${n} días`),
};

export const ZUGANG_I18N: Record<UiLang, ZugangStrings> = {
  de: {
    locale: 'de-DE',
    logoutTitle: 'Abmelden',
    logoutBody: n => `In diesem Browser liegen noch ${n === 1 ? 'ein Lebenslauf' : `${n} Lebensläufe`} aus dem Arbeiten ohne Konto. Die Lebensläufe in deinem Konto betrifft das nicht.`,
    keepLocal: 'Lokale Profile in diesem Browser behalten',
    keepLocalSub: 'Beim nächsten Ausprobieren ohne Konto sind sie wieder da.',
    deleteLocal: 'Lokale Profile in diesem Browser löschen',
    deleteLocalSub: 'Sinnvoll an einem fremden oder geteilten Rechner. Lässt sich nicht rückgängig machen.',
    logoutConfirm: 'Abmelden',
    cancel: 'Abbrechen',
    soon: (d, n) => `Dein Zugang läuft am ${d} ab, in ${days.de(n)}. Exportiere vorher, was du behalten willst: PDF, Word oder die Datensicherung im Konto.`,
    final: (d, n) => `Dein Zugang läuft in ${days.de(n)} ab (am ${d}). Exportiere jetzt, was du behalten willst. Danach kannst du nur noch lesen und exportieren.`,
    expired: d => `Dein Zugang ist am ${d} abgelaufen. Deine Daten bleiben erhalten. Lesen und Exportieren gehen weiter, Ändern nicht mehr. Für eine Verlängerung wende dich an die Person, von der du den Zugang hast.`,
    exportNow: 'Jetzt exportieren',
    dismiss: 'Ausblenden',
    readOnlyStatus: 'Nur lesen',
    readOnlyContent: 'Bearbeiten ist gesperrt, weil dein Zugang abgelaufen ist. Exportieren geht weiter.',
    readOnlyDesign: 'Vorlage und Gestaltung kannst du für einen Export wechseln. Gespeichert wird das nicht mehr.',
    readOnlyHome: 'Neue Lebensläufe anlegen geht nicht mehr, weil dein Zugang abgelaufen ist.',
    passSoon: (d, n) => `Dein Bewerbungs-Pass läuft am ${d} ab, in ${days.de(n)}. Danach kannst du weiter lesen und exportieren. Wenn du länger brauchst, verlängere ihn: Die neuen Tage hängen sich an.`,
    passFinal: (d, n) => `Dein Bewerbungs-Pass läuft in ${days.de(n)} ab (am ${d}). Danach kannst du nur noch lesen und exportieren.`,
    passExpired: d => `Dein Bewerbungs-Pass ist am ${d} abgelaufen. Deine Daten bleiben erhalten, Lesen und Exportieren gehen weiter. Zum Ändern brauchst du einen neuen Pass.`,
    planNone: 'Dein Konto ist angelegt. Speichern im Konto, Sharelinks und die KI-Verbindung gibt es mit dem Bewerbungs-Pass. Ohne Konto bleibt alles im Browser kostenlos.',
    getPass: 'Pass holen',
    extendPass: 'Pass verlängern',
    noneReadOnlyContent: 'Speichern im Konto gibt es mit dem Bewerbungs-Pass. Lesen und Exportieren gehen schon jetzt.',
    noneReadOnlyDesign: 'Vorlage und Gestaltung kannst du für einen Export wechseln. Gespeichert wird das erst mit dem Pass.',
    noneReadOnlyHome: 'Neue Lebensläufe im Konto gibt es mit dem Bewerbungs-Pass.',
    passReadOnlyContent: 'Bearbeiten ist gesperrt, weil dein Pass abgelaufen ist. Exportieren geht weiter.',
    passReadOnlyHome: 'Neue Lebensläufe gehen erst wieder mit einem neuen Pass.',
  },
  en: {
    locale: 'en-GB',
    logoutTitle: 'Sign out',
    logoutBody: n => `This browser still holds ${n === 1 ? 'one résumé' : `${n} résumés`} from working without an account. The résumés in your account are not affected.`,
    keepLocal: 'Keep local profiles in this browser',
    keepLocalSub: 'They will be back the next time you try it without an account.',
    deleteLocal: 'Delete local profiles in this browser',
    deleteLocalSub: 'Sensible on a shared or borrowed computer. Cannot be undone.',
    logoutConfirm: 'Sign out',
    cancel: 'Cancel',
    soon: (d, n) => `Your access ends on ${d}, in ${days.en(n)}. Export what you want to keep before then: PDF, Word or the data backup in your account.`,
    final: (d, n) => `Your access ends in ${days.en(n)} (on ${d}). Export what you want to keep now. After that you can only read and export.`,
    expired: d => `Your access ended on ${d}. Your data is kept. Reading and exporting still work, changes do not. To extend it, contact the person who gave you access.`,
    exportNow: 'Export now',
    dismiss: 'Hide',
    readOnlyStatus: 'Read only',
    readOnlyContent: 'Editing is locked because your access has ended. Exporting still works.',
    readOnlyDesign: 'You can switch template and design for an export. It is no longer saved.',
    readOnlyHome: 'Creating new résumés is no longer possible because your access has ended.',
    passSoon: (d, n) => `Your Application Pass ends on ${d}, in ${days.en(n)}. After that you can still read and export. If you need longer, extend it: the new days are added on.`,
    passFinal: (d, n) => `Your Application Pass ends in ${days.en(n)} (on ${d}). After that you can only read and export.`,
    passExpired: d => `Your Application Pass ended on ${d}. Your data is kept, reading and exporting still work. To make changes you need a new pass.`,
    planNone: 'Your account is set up. Saving in the account, share links and the AI connection come with the Application Pass. Without an account everything in the browser stays free.',
    getPass: 'Get the pass',
    extendPass: 'Extend the pass',
    noneReadOnlyContent: 'Saving in the account comes with the Application Pass. Reading and exporting already work.',
    noneReadOnlyDesign: 'You can switch template and design for an export. It is only saved with the pass.',
    noneReadOnlyHome: 'New résumés in the account come with the Application Pass.',
    passReadOnlyContent: 'Editing is locked because your pass has ended. Exporting still works.',
    passReadOnlyHome: 'New résumés need a new pass.',
  },
  fr: {
    locale: 'fr-FR',
    logoutTitle: 'Se déconnecter',
    logoutBody: n => `Ce navigateur contient encore ${n === 1 ? 'un CV' : `${n} CV`} créé${n === 1 ? '' : 's'} sans compte. Les CV de votre compte ne sont pas concernés.`,
    keepLocal: 'Garder les profils locaux dans ce navigateur',
    keepLocalSub: 'Ils seront de retour la prochaine fois que vous essayez sans compte.',
    deleteLocal: 'Supprimer les profils locaux de ce navigateur',
    deleteLocalSub: 'Utile sur un ordinateur partagé ou prêté. Action irréversible.',
    logoutConfirm: 'Se déconnecter',
    cancel: 'Annuler',
    soon: (d, n) => `Votre accès prend fin le ${d}, dans ${days.fr(n)}. Exportez d’ici là ce que vous voulez garder : PDF, Word ou la sauvegarde des données du compte.`,
    final: (d, n) => `Votre accès prend fin dans ${days.fr(n)} (le ${d}). Exportez maintenant ce que vous voulez garder. Ensuite, seules la lecture et l’exportation resteront possibles.`,
    expired: d => `Votre accès a pris fin le ${d}. Vos données sont conservées. Lire et exporter restent possibles, modifier non. Pour une prolongation, adressez-vous à la personne qui vous a donné l’accès.`,
    exportNow: 'Exporter maintenant',
    dismiss: 'Masquer',
    readOnlyStatus: 'Lecture seule',
    readOnlyContent: 'La modification est bloquée car votre accès a pris fin. L’exportation reste possible.',
    readOnlyDesign: 'Vous pouvez changer de modèle et de mise en forme pour un export. Ce n’est plus enregistré.',
    readOnlyHome: 'Créer de nouveaux CV n’est plus possible car votre accès a pris fin.',
    passSoon: (d, n) => `Votre Pass candidature prend fin le ${d}, dans ${days.fr(n)}. Ensuite, vous pourrez toujours lire et exporter. S’il vous faut plus de temps, prolongez-le : les nouveaux jours s’ajoutent.`,
    passFinal: (d, n) => `Votre Pass candidature prend fin dans ${days.fr(n)} (le ${d}). Ensuite, seules la lecture et l’exportation resteront possibles.`,
    passExpired: d => `Votre Pass candidature a pris fin le ${d}. Vos données sont conservées, lire et exporter restent possibles. Pour modifier, il vous faut un nouveau pass.`,
    planNone: 'Votre compte est créé. L’enregistrement dans le compte, les liens de partage et la connexion IA viennent avec le Pass candidature. Sans compte, tout ce qui tourne dans le navigateur reste gratuit.',
    getPass: 'Obtenir le pass',
    extendPass: 'Prolonger le pass',
    noneReadOnlyContent: 'L’enregistrement dans le compte vient avec le Pass candidature. Lire et exporter fonctionnent déjà.',
    noneReadOnlyDesign: 'Vous pouvez changer de modèle et de mise en forme pour un export. Ce n’est enregistré qu’avec le pass.',
    noneReadOnlyHome: 'Les nouveaux CV dans le compte viennent avec le Pass candidature.',
    passReadOnlyContent: 'La modification est bloquée car votre pass a pris fin. L’exportation reste possible.',
    passReadOnlyHome: 'De nouveaux CV demandent un nouveau pass.',
  },
  es: {
    locale: 'es-ES',
    logoutTitle: 'Cerrar sesión',
    logoutBody: n => `En este navegador todavía hay ${n === 1 ? 'un currículum' : `${n} currículums`} creados sin cuenta. Los currículums de tu cuenta no se ven afectados.`,
    keepLocal: 'Conservar los perfiles locales en este navegador',
    keepLocalSub: 'Volverán a estar ahí la próxima vez que lo pruebes sin cuenta.',
    deleteLocal: 'Borrar los perfiles locales de este navegador',
    deleteLocalSub: 'Recomendable en un ordenador compartido o ajeno. No se puede deshacer.',
    logoutConfirm: 'Cerrar sesión',
    cancel: 'Cancelar',
    soon: (d, n) => `Tu acceso termina el ${d}, dentro de ${days.es(n)}. Exporta antes lo que quieras conservar: PDF, Word o la copia de datos de tu cuenta.`,
    final: (d, n) => `Tu acceso termina dentro de ${days.es(n)} (el ${d}). Exporta ahora lo que quieras conservar. Después solo podrás leer y exportar.`,
    expired: d => `Tu acceso terminó el ${d}. Tus datos se conservan. Puedes seguir leyendo y exportando, pero ya no modificar. Para prolongarlo, contacta con la persona que te dio el acceso.`,
    exportNow: 'Exportar ahora',
    dismiss: 'Ocultar',
    readOnlyStatus: 'Solo lectura',
    readOnlyContent: 'La edición está bloqueada porque tu acceso ha terminado. Exportar sigue funcionando.',
    readOnlyDesign: 'Puedes cambiar de plantilla y de diseño para una exportación. Ya no se guarda.',
    readOnlyHome: 'Ya no puedes crear currículums nuevos porque tu acceso ha terminado.',
    passSoon: (d, n) => `Tu Pase de candidatura termina el ${d}, dentro de ${days.es(n)}. Después podrás seguir leyendo y exportando. Si necesitas más tiempo, amplíalo: los días nuevos se suman.`,
    passFinal: (d, n) => `Tu Pase de candidatura termina dentro de ${days.es(n)} (el ${d}). Después solo podrás leer y exportar.`,
    passExpired: d => `Tu Pase de candidatura terminó el ${d}. Tus datos se conservan, leer y exportar siguen funcionando. Para hacer cambios necesitas un pase nuevo.`,
    planNone: 'Tu cuenta está creada. Guardar en la cuenta, los enlaces para compartir y la conexión con IA vienen con el Pase de candidatura. Sin cuenta, todo lo que funciona en el navegador sigue siendo gratis.',
    getPass: 'Conseguir el pase',
    extendPass: 'Ampliar el pase',
    noneReadOnlyContent: 'Guardar en la cuenta viene con el Pase de candidatura. Leer y exportar ya funcionan.',
    noneReadOnlyDesign: 'Puedes cambiar de plantilla y de diseño para una exportación. Solo se guarda con el pase.',
    noneReadOnlyHome: 'Los currículums nuevos en la cuenta vienen con el Pase de candidatura.',
    passReadOnlyContent: 'La edición está bloqueada porque tu pase ha terminado. Exportar sigue funcionando.',
    passReadOnlyHome: 'Para currículums nuevos necesitas un pase nuevo.',
  },
};

/** Datum aus der Server-Antwort in der Oberflächensprache. */
export function formatAccessDate(iso: string, lang: UiLang): string {
  try {
    return new Date(iso).toLocaleDateString(ZUGANG_I18N[lang].locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  } catch {
    return iso.slice(0, 10);
  }
}
