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
