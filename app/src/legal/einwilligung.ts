/**
 * Einwilligung in die Verarbeitung besonderer Angaben (Art. 9 Abs. 2 lit. a
 * DSGVO) und der AGB-Hinweis bei der Registrierung (§ 305 Abs. 2 BGB).
 *
 * Grundlage: Muster `strategy/pilot/05-einwilligung-art9.md` (08.10.2026) und
 * Rechtsprüfung des Prüfteams vom 10.10.2026 (Befund D1 „hoch“, Patch P9;
 * Befund V4, Patch P8 mit den Hinweistexten in vier Sprachen). Keine
 * Rechtsberatung; vor `OPEN_REGISTRATION=1` anwaltlich prüfen lassen
 * (Anwaltsfrage 2: Kopplung der Einwilligung an das Speichern im Konto).
 *
 * Sie-Form wie alle Rechtstexte. Maßgeblich ist die deutsche Fassung; die
 * anderen sind Übersetzungen zur Bedienung.
 *
 * ART9_CONSENT_VERSION muss mit `ART9_VERSION` in pdf-service/consent.js
 * übereinstimmen (Test „P8/P9“ in pdf-service/billing.test.mjs prüft das). Wer den Einwilligungstext
 * inhaltlich ändert, erhöht beide: Dann fragt der Dialog bei der nächsten
 * Anmeldung alle Konten erneut, und bis dahin speichert kein Konto.
 */
import type { UiLang } from '../ui/i18n';

export const ART9_CONSENT_VERSION = '2026-10-10';

export interface Art9Texts {
  title: string;
  paragraphs: string[];
  checkbox: string;
  /** Satz mit Link auf die Datenschutzerklärung: [davor, Linktext, danach]. */
  privacyLink: [string, string, string];
  accept: string;
  later: string;
  busy: string;
  errCheckbox: string;
  errSave: string;
  /** Band im Editor, solange die Einwilligung fehlt. */
  bannerText: string;
  bannerAction: string;
  /** Kontoeinstellungen. */
  settingsTitle: string;
  settingsGiven: (date: string, version: string) => string;
  settingsMissing: string;
  settingsGive: string;
  settingsWithdraw: string;
  withdrawConfirmTitle: string;
  withdrawConfirmText: string[];
  withdrawConfirm: string;
  withdrawCancel: string;
  withdrawn: string;
  /** Hinweis bei der Registrierung (P8): [davor, AGB, Mitte, Datenschutz, danach]. */
  registerNotice: [string, string, string, string, string];
  /** Kurzform der Einwilligung im Registrierungsformular. */
  registerLead: string;
  registerMore: string;
  errRegisterConsent: string;
}

const DE: Art9Texts = {
  title: 'Angaben, die besonders geschützt sind',
  paragraphs: [
    'In einen Lebenslauf schreiben manche Menschen Dinge, die das Datenschutzrecht besonders schützt: Religion oder Weltanschauung, eine Schwerbehinderung oder andere Angaben zur Gesundheit, die Mitgliedschaft in einer Gewerkschaft oder Partei, die ethnische Herkunft. Auch ein Foto kann so etwas erkennen lassen.',
    'In deutsche Bewerbungen gehören diese Angaben in der Regel nicht. Arbeitgeber dürfen meist nicht danach fragen; das Allgemeine Gleichbehandlungsgesetz schützt Sie davor, dass sie bei der Auswahl eine Rolle spielen. Wenn Sie sie selbst angeben, hilft Ihnen dieser Schutz weniger. Ausnahmen sind etwa kirchliche Arbeitgeber oder eine Schwerbehinderung, die Sie bewusst nennen möchten.',
    'Ihr Konto speichert Ihre Lebensläufe, Anschreiben und Fotos auf unserem Server. Stehen solche Angaben darin, speichern wir sie wie alles andere: nur, damit Sie Ihre Unterlagen bearbeiten, exportieren und teilen können. Niemand außer Ihnen sieht sie, es sei denn, Sie geben einen Sharelink weiter. Wir werten sie nicht aus und geben sie nicht weiter.',
    'Weil wir vorher nicht wissen, was Sie eintragen, speichert Ihr Konto nur mit Ihrer ausdrücklichen Einwilligung. Sie ist freiwillig. Ohne sie können Sie das Werkzeug ohne Konto nutzen (Lokalmodus): Dann bleibt alles in Ihrem Browser und nichts davon liegt auf unserem Server.',
    'Sie können die Einwilligung jederzeit in den Kontoeinstellungen widerrufen. Der Widerruf gilt für die Zukunft. Danach speichert Ihr Konto keine Änderungen mehr; Lesen, Exportieren und Löschen gehen weiter. Wir löschen nichts automatisch: Entfernen Sie dann die besonderen Angaben aus Ihren Unterlagen, löschen Sie das Konto oder arbeiten Sie im Lokalmodus weiter.',
  ],
  checkbox: 'Ich willige ein, dass Angaben zu Religion oder Weltanschauung, Gesundheit, Gewerkschafts- oder Parteizugehörigkeit, ethnischer Herkunft und andere besondere Kategorien personenbezogener Daten (Art. 9 DSGVO), soweit ich sie selbst in meine Unterlagen eintrage, zu dem oben genannten Zweck in meinem Konto gespeichert und verarbeitet werden.',
  privacyLink: ['Mehr dazu in der ', 'Datenschutzerklärung', '.'],
  accept: 'Einwilligen und weiter',
  later: 'Jetzt nicht',
  busy: 'Einen Moment …',
  errCheckbox: 'Bitte setzen Sie das Häkchen, wenn Sie einwilligen möchten.',
  errSave: 'Die Einwilligung ließ sich gerade nicht speichern. Bitte versuchen Sie es noch einmal.',
  bannerText: 'Ihr Konto speichert gerade keine Änderungen: Die Einwilligung für besonders geschützte Angaben fehlt. Lesen, Exportieren und Löschen gehen weiter.',
  bannerAction: 'Einwilligung ansehen',
  settingsTitle: 'Einwilligung für besonders geschützte Angaben',
  settingsGiven: (date, version) => `Erteilt am ${date} (Fassung ${version}). Ihr Konto speichert Ihre Unterlagen.`,
  settingsMissing: 'Nicht erteilt. Ihr Konto speichert keine Änderungen; Lesen, Exportieren und Löschen gehen weiter.',
  settingsGive: 'Einwilligung erteilen',
  settingsWithdraw: 'Einwilligung widerrufen',
  withdrawConfirmTitle: 'Einwilligung widerrufen?',
  withdrawConfirmText: [
    'Ab dem Widerruf speichert Ihr Konto keine Änderungen mehr. Was schon gespeichert ist, bleibt, bis Sie es löschen; Sie können es weiter lesen und exportieren.',
    'Wir löschen nichts automatisch. Stehen besonders geschützte Angaben in Ihren Unterlagen, entfernen Sie sie bitte selbst, löschen Sie das Konto oder exportieren Sie Ihre Daten und arbeiten im Lokalmodus weiter.',
  ],
  withdrawConfirm: 'Ja, widerrufen',
  withdrawCancel: 'Abbrechen',
  withdrawn: 'Widerrufen. Ihr Konto speichert keine Änderungen mehr.',
  registerNotice: ['Mit dem Konto gelten unsere ', 'AGB', ' und die ', 'Datenschutzerklärung', '.'],
  registerLead: 'Ihr Konto speichert Lebensläufe auf unserem Server. Stehen darin besonders geschützte Angaben (etwa Religion, Gesundheit, Gewerkschaft), brauchen wir dafür Ihre ausdrückliche Einwilligung.',
  registerMore: 'Was das heißt',
  errRegisterConsent: 'Ohne diese Einwilligung kann Ihr Konto nichts speichern. Ohne Konto können Sie das Werkzeug im Lokalmodus nutzen.',
};

const EN: Art9Texts = {
  title: 'Information that is specially protected',
  paragraphs: [
    'Some people put things in their CV that data protection law specially protects: religion or beliefs, a severe disability or other health information, membership of a trade union or a party, ethnic origin. A photo can reveal such things too.',
    'In German applications this information is usually not included. Employers mostly may not ask for it, and the General Equal Treatment Act (AGG) protects you from it playing a role in the selection. If you state it yourself, this protection helps you less. Exceptions are, for example, church employers or a severe disability that you deliberately want to mention.',
    'Your account stores your CVs, cover letters and photos on our server. If they contain such information, we store it like everything else: only so that you can edit, export and share your documents. Nobody but you sees it unless you pass on a share link. We do not analyse it and do not pass it on.',
    'Because we do not know in advance what you will enter, your account only stores with your explicit consent. It is voluntary. Without it you can use the tool without an account (local mode): everything then stays in your browser and none of it is on our server.',
    'You can withdraw your consent at any time in the account settings. The withdrawal applies to the future. Your account then no longer saves changes; reading, exporting and deleting still work. We do not delete anything automatically: remove the special information from your documents, delete the account or continue in local mode.',
  ],
  checkbox: 'I consent to information on religion or beliefs, health, trade union or party membership, ethnic origin and other special categories of personal data (Art. 9 GDPR), insofar as I enter it into my documents myself, being stored and processed in my account for the purpose described above.',
  privacyLink: ['More in the ', 'privacy policy', '.'],
  accept: 'Consent and continue',
  later: 'Not now',
  busy: 'One moment …',
  errCheckbox: 'Please tick the box if you want to give your consent.',
  errSave: 'Your consent could not be saved just now. Please try again.',
  bannerText: 'Your account is not saving changes right now: the consent for specially protected information is missing. Reading, exporting and deleting still work.',
  bannerAction: 'View consent',
  settingsTitle: 'Consent for specially protected information',
  settingsGiven: (date, version) => `Given on ${date} (version ${version}). Your account saves your documents.`,
  settingsMissing: 'Not given. Your account does not save changes; reading, exporting and deleting still work.',
  settingsGive: 'Give consent',
  settingsWithdraw: 'Withdraw consent',
  withdrawConfirmTitle: 'Withdraw consent?',
  withdrawConfirmText: [
    'From the withdrawal on, your account no longer saves changes. What is already stored stays until you delete it; you can still read and export it.',
    'We do not delete anything automatically. If your documents contain specially protected information, please remove it yourself, delete the account, or export your data and continue in local mode.',
  ],
  withdrawConfirm: 'Yes, withdraw',
  withdrawCancel: 'Cancel',
  withdrawn: 'Withdrawn. Your account no longer saves changes.',
  registerNotice: ['Our ', 'Terms', ' and ', 'privacy policy', ' apply to the account.'],
  registerLead: 'Your account stores CVs on our server. If they contain specially protected information (such as religion, health, trade union), we need your explicit consent for that.',
  registerMore: 'What this means',
  errRegisterConsent: 'Without this consent your account cannot save anything. Without an account you can use the tool in local mode.',
};

const FR: Art9Texts = {
  title: 'Informations particulièrement protégées',
  paragraphs: [
    'Certaines personnes indiquent dans leur CV des informations que le droit de la protection des données protège particulièrement : religion ou convictions, un handicap grave ou d’autres données de santé, l’appartenance à un syndicat ou à un parti, l’origine ethnique. Une photo peut aussi révéler ce genre d’informations.',
    'Dans les candidatures en Allemagne, ces informations n’ont en général pas leur place. Les employeurs n’ont le plus souvent pas le droit de les demander, et la loi générale sur l’égalité de traitement (AGG) vous protège contre leur prise en compte lors de la sélection. Si vous les indiquez vous-même, cette protection vous aide moins. Il existe des exceptions, par exemple les employeurs religieux ou un handicap grave que vous souhaitez mentionner délibérément.',
    'Votre compte enregistre vos CV, lettres de motivation et photos sur notre serveur. S’ils contiennent de telles informations, nous les enregistrons comme tout le reste : uniquement pour que vous puissiez modifier, exporter et partager vos documents. Personne d’autre que vous ne les voit, sauf si vous transmettez un lien de partage. Nous ne les analysons pas et ne les transmettons pas.',
    'Comme nous ne savons pas à l’avance ce que vous allez saisir, votre compte n’enregistre qu’avec votre consentement explicite. Il est facultatif. Sans lui, vous pouvez utiliser l’outil sans compte (mode local) : tout reste alors dans votre navigateur et rien n’est stocké sur notre serveur.',
    'Vous pouvez retirer votre consentement à tout moment dans les paramètres du compte. Le retrait vaut pour l’avenir. Votre compte n’enregistre alors plus de modifications ; la lecture, l’export et la suppression restent possibles. Nous ne supprimons rien automatiquement : retirez les informations particulières de vos documents, supprimez le compte ou continuez en mode local.',
  ],
  checkbox: 'J’accepte que les informations relatives à la religion ou aux convictions, à la santé, à l’appartenance syndicale ou politique, à l’origine ethnique et les autres catégories particulières de données (art. 9 RGPD), dans la mesure où je les saisis moi-même dans mes documents, soient enregistrées et traitées dans mon compte aux fins décrites ci-dessus.',
  privacyLink: ['Plus de détails dans la ', 'politique de confidentialité', '.'],
  accept: 'Accepter et continuer',
  later: 'Pas maintenant',
  busy: 'Un instant …',
  errCheckbox: 'Cochez la case si vous souhaitez donner votre consentement.',
  errSave: 'Le consentement n’a pas pu être enregistré. Veuillez réessayer.',
  bannerText: 'Votre compte n’enregistre actuellement aucune modification : le consentement pour les informations particulièrement protégées manque. La lecture, l’export et la suppression restent possibles.',
  bannerAction: 'Voir le consentement',
  settingsTitle: 'Consentement pour les informations particulièrement protégées',
  settingsGiven: (date, version) => `Donné le ${date} (version ${version}). Votre compte enregistre vos documents.`,
  settingsMissing: 'Non donné. Votre compte n’enregistre pas de modifications ; la lecture, l’export et la suppression restent possibles.',
  settingsGive: 'Donner mon consentement',
  settingsWithdraw: 'Retirer mon consentement',
  withdrawConfirmTitle: 'Retirer le consentement ?',
  withdrawConfirmText: [
    'À partir du retrait, votre compte n’enregistre plus de modifications. Ce qui est déjà enregistré reste jusqu’à ce que vous le supprimiez ; vous pouvez toujours le lire et l’exporter.',
    'Nous ne supprimons rien automatiquement. Si vos documents contiennent des informations particulièrement protégées, retirez-les vous-même, supprimez le compte, ou exportez vos données et continuez en mode local.',
  ],
  withdrawConfirm: 'Oui, retirer',
  withdrawCancel: 'Annuler',
  withdrawn: 'Retiré. Votre compte n’enregistre plus de modifications.',
  registerNotice: ['Nos ', 'CGV', ' et la ', 'politique de confidentialité', ' s’appliquent au compte.'],
  registerLead: 'Votre compte enregistre les CV sur notre serveur. S’ils contiennent des informations particulièrement protégées (religion, santé, syndicat par exemple), nous avons besoin de votre consentement explicite.',
  registerMore: 'Ce que cela signifie',
  errRegisterConsent: 'Sans ce consentement, votre compte ne peut rien enregistrer. Sans compte, vous pouvez utiliser l’outil en mode local.',
};

const ES: Art9Texts = {
  title: 'Datos especialmente protegidos',
  paragraphs: [
    'Algunas personas incluyen en su currículum datos que la normativa de protección de datos protege de forma especial: religión o convicciones, una discapacidad grave u otros datos de salud, la afiliación a un sindicato o a un partido, el origen étnico. También una foto puede revelar algo así.',
    'En las candidaturas en Alemania, estos datos no suelen incluirse. Por lo general, los empleadores no pueden preguntar por ellos, y la Ley general de igualdad de trato (AGG) le protege de que influyan en la selección. Si los indica usted mismo, esa protección le ayuda menos. Hay excepciones, por ejemplo empleadores religiosos o una discapacidad grave que quiera mencionar a propósito.',
    'Su cuenta guarda sus currículums, cartas de presentación y fotos en nuestro servidor. Si contienen datos de este tipo, los guardamos como todo lo demás: solo para que pueda editar, exportar y compartir sus documentos. Nadie más que usted los ve, salvo que comparta un enlace. No los analizamos ni los cedemos.',
    'Como no sabemos de antemano qué va a introducir, su cuenta solo guarda con su consentimiento explícito. Es voluntario. Sin él puede usar la herramienta sin cuenta (modo local): todo se queda en su navegador y nada se guarda en nuestro servidor.',
    'Puede retirar su consentimiento en cualquier momento en los ajustes de la cuenta. La retirada tiene efecto para el futuro. A partir de entonces su cuenta ya no guarda cambios; leer, exportar y eliminar sigue siendo posible. No eliminamos nada automáticamente: quite los datos especiales de sus documentos, elimine la cuenta o siga en modo local.',
  ],
  checkbox: 'Consiento que los datos sobre religión o convicciones, salud, afiliación sindical o a un partido, origen étnico y demás categorías especiales de datos personales (art. 9 RGPD), en la medida en que yo mismo los introduzca en mis documentos, se guarden y traten en mi cuenta para la finalidad descrita arriba.',
  privacyLink: ['Más información en la ', 'política de privacidad', '.'],
  accept: 'Consentir y continuar',
  later: 'Ahora no',
  busy: 'Un momento …',
  errCheckbox: 'Marque la casilla si quiere dar su consentimiento.',
  errSave: 'No se pudo guardar el consentimiento. Inténtelo de nuevo.',
  bannerText: 'Su cuenta no está guardando cambios: falta el consentimiento para los datos especialmente protegidos. Leer, exportar y eliminar sigue siendo posible.',
  bannerAction: 'Ver consentimiento',
  settingsTitle: 'Consentimiento para datos especialmente protegidos',
  settingsGiven: (date, version) => `Dado el ${date} (versión ${version}). Su cuenta guarda sus documentos.`,
  settingsMissing: 'No dado. Su cuenta no guarda cambios; leer, exportar y eliminar sigue siendo posible.',
  settingsGive: 'Dar consentimiento',
  settingsWithdraw: 'Retirar consentimiento',
  withdrawConfirmTitle: '¿Retirar el consentimiento?',
  withdrawConfirmText: [
    'Desde la retirada, su cuenta ya no guarda cambios. Lo que ya está guardado se mantiene hasta que lo elimine; puede seguir leyéndolo y exportándolo.',
    'No eliminamos nada automáticamente. Si sus documentos contienen datos especialmente protegidos, quítelos usted mismo, elimine la cuenta, o exporte sus datos y siga en modo local.',
  ],
  withdrawConfirm: 'Sí, retirar',
  withdrawCancel: 'Cancelar',
  withdrawn: 'Retirado. Su cuenta ya no guarda cambios.',
  registerNotice: ['A la cuenta se aplican nuestras ', 'condiciones', ' y la ', 'política de privacidad', '.'],
  registerLead: 'Su cuenta guarda currículums en nuestro servidor. Si contienen datos especialmente protegidos (por ejemplo religión, salud, sindicato), necesitamos su consentimiento explícito.',
  registerMore: 'Qué significa',
  errRegisterConsent: 'Sin este consentimiento su cuenta no puede guardar nada. Sin cuenta puede usar la herramienta en modo local.',
};

export const ART9_TEXTS: Record<UiLang, Art9Texts> = { de: DE, en: EN, fr: FR, es: ES };
export function art9Texts(lang: UiLang): Art9Texts { return ART9_TEXTS[lang] ?? DE; }
