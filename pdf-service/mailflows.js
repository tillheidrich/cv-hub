// E-Mail-Workflows: welche Mails es gibt, wann sie gehen, ihre Texte in
// vier Sprachen und wie sie gerendert werden (10.10.2026, MAILS.md).
//
// Zwei Arten:
//   service  Servicemails zu Konto und Vertrag (Art. 6 Abs. 1 lit. b DSGVO).
//            Kein Abmeldelink, keine Werbung im Text: kein Kaufknopf, keine
//            Preise (Ausnahme: der bestehende Hinweis vor Pass-Ende).
//   tips     Tipps zur Nutzung. Werbung im Sinne von § 7 Abs. 2 Nr. 2 UWG,
//            deshalb NUR mit ausdrücklicher Einwilligung (Art. 6 Abs. 1 lit. a
//            DSGVO, Double-Opt-in über die Bestätigung der Adresse). Jede Mail
//            mit Abmeldelink und List-Unsubscribe/List-Unsubscribe-Post
//            (RFC 8058). Die Bestandskundenausnahme nach § 7 Abs. 3 UWG nutzen
//            wir nicht (MAILS.md, Abschnitt Recht).
//
// Texte: Deutsch, Englisch und Spanisch duzen, Französisch siezt (wie die
// Oberfläche). Die bestehenden Hinweise vor Laufzeitende (tplPassEnding,
// tplAccessEnding) bleiben zweisprachig wie bisher und lassen sich hier nur
// schalten und zeitlich einstellen, nicht umschreiben.
//
// Anpassungen aus dem Admin-Bereich: Betreff, Überschrift und Text je
// Sprache. Der Text ist reiner Text (Absätze durch Leerzeilen, Zeilen mit
// „- " werden eine Liste). Er wird vollständig escaped, danach werden nur die
// Platzhalter dieser Liste ersetzt — ebenfalls escaped. Es gibt keine
// Ausdrücke, keine Schleifen, kein HTML: keine Template-Injection.

import { layout, btn, h, p, escapeHtml, MAIL_COLORS, withTag } from './mail.js';
import { tplAccessEnding } from './mail.js';
import { tplPassEnding } from './mailtexts/index.js';

const { LINE, SOFT } = MAIL_COLORS;
/** Produktname in Überschriften (wie die Fußzeile in mail.js). */
const APP_NAME = (process.env.APP_NAME || process.env.PRODUCT_NAME || 'CV-Hub').trim();
export const LANGS = ['de', 'en', 'fr', 'es'];
export function mailLang(v) {
  const s = String(v || '').slice(0, 2).toLowerCase();
  return LANGS.includes(s) ? s : 'de';
}
/** Fassung des Einwilligungstexts für Tipps (Häkchen und Einstellungen). */
export const TIPS_CONSENT_VERSION = '2026-10-10';

const LOCALE = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };
export function dateIn(lang, d) {
  try {
    const opts = lang === 'de'
      ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' };
    return new Date(d).toLocaleDateString(LOCALE[lang] || 'de-DE', opts);
  } catch { return new Date(d).toISOString().slice(0, 10); }
}

/* ── Texte ─────────────────────────────────────────────────────────────── */

const T = {
  welcome: {
    de: {
      subject: 'Deine Adresse ist bestätigt, so fängst du an',
      heading: `Willkommen bei ${APP_NAME}`,
      body: [
        'Hallo, deine E-Mail-Adresse ist bestätigt und dein Konto ist eingerichtet. {{konto}}',
        'Mit diesen drei Schritten kommst du am schnellsten zu einer fertigen Bewerbung:',
        '- Vorlage wählen und deine Angaben eintragen. Hast du schon einen Lebenslauf, lade ihn als LinkedIn-Datenexport, JSON oder Markdown hoch, dann musst du nichts abtippen.\n- Den Bereich „Prüfen“ öffnen. Er zeigt, was fehlt oder zu lang ist, und wie ein Bewerbermanagementsystem deinen Lebenslauf als Text liest.\n- Das PDF exportieren und vor dem Versenden einmal ganz durchlesen, am besten auf dem Handy und am Rechner.',
        'Fragen zum Werkzeug kannst du direkt mit einer Antwort auf diese Mail stellen.',
      ],
      button: 'Zum Editor',
    },
    en: {
      subject: 'Your address is confirmed, here is how to start',
      heading: `Welcome to ${APP_NAME}`,
      body: [
        'Hi, your e-mail address is confirmed and your account is set up. {{konto}}',
        'These three steps get you to a finished application fastest:',
        '- Pick a template and fill in your details. If you already have a CV, upload it as a LinkedIn data export, JSON or Markdown so you do not have to retype it.\n- Open the “Check” panel. It shows what is missing or too long, and how an applicant tracking system reads your CV as plain text.\n- Export the PDF and read it through once before you send it, ideally on your phone and on a computer.',
        'If you have questions about the tool, just reply to this e-mail.',
      ],
      button: 'Open the editor',
    },
    fr: {
      subject: 'Votre adresse est confirmée, voici comment commencer',
      heading: `Bienvenue sur ${APP_NAME}`,
      body: [
        'Bonjour, votre adresse e-mail est confirmée et votre compte est prêt. {{konto}}',
        'Ces trois étapes vous mènent le plus vite à une candidature terminée :',
        '- Choisissez un modèle et saisissez vos informations. Si vous avez déjà un CV, importez-le sous forme d’export de données LinkedIn, de JSON ou de Markdown, vous n’aurez rien à retaper.\n- Ouvrez le panneau « Vérifier ». Il indique ce qui manque ou ce qui est trop long, et comment un logiciel de recrutement lit votre CV en texte brut.\n- Exportez le PDF et relisez-le entièrement avant de l’envoyer, de préférence sur téléphone et sur ordinateur.',
        'Pour toute question sur l’outil, répondez simplement à cet e-mail.',
      ],
      button: 'Ouvrir l’éditeur',
    },
    es: {
      subject: 'Tu dirección está confirmada, así empiezas',
      heading: `Bienvenido a ${APP_NAME}`,
      body: [
        'Hola, tu dirección de correo está confirmada y tu cuenta está lista. {{konto}}',
        'Con estos tres pasos llegas más rápido a una candidatura terminada:',
        '- Elige una plantilla y rellena tus datos. Si ya tienes un currículum, súbelo como exportación de datos de LinkedIn, JSON o Markdown y no tendrás que volver a escribirlo.\n- Abre el panel «Revisar». Muestra lo que falta o sobra y cómo un sistema de gestión de candidaturas lee tu currículum como texto.\n- Exporta el PDF y léelo entero antes de enviarlo, mejor en el móvil y en el ordenador.',
        'Si tienes preguntas sobre la herramienta, responde a este correo.',
      ],
      button: 'Abrir el editor',
    },
  },
  pass_expired: {
    de: {
      subject: 'Dein Bewerbungs-Pass ist abgelaufen, das bleibt',
      heading: 'Dein Pass ist abgelaufen',
      body: [
        'Hallo, dein Bewerbungs-Pass ist am {{datum}} abgelaufen. Es war ein einmaliger Kauf, es wird nichts verlängert und nichts abgebucht.',
        'Deine Lebensläufe und Anschreiben bleiben im Konto. Du kannst sie weiter öffnen, als PDF exportieren und löschen. Ändern und speichern geht erst wieder mit einem neuen Pass.',
        'Alle Inhalte auf einmal bekommst du in den Kontoeinstellungen über „Daten herunterladen“ (JSON, wieder importierbar). Dort kannst du das Konto auch löschen, wenn du es nicht mehr brauchst.',
      ],
      button: 'Zum Konto',
    },
    en: {
      subject: 'Your application pass has expired, here is what stays',
      heading: 'Your pass has expired',
      body: [
        'Hi, your application pass expired on {{datum}}. It was a one-time purchase, nothing renews and nothing is charged.',
        'Your CVs and cover letters stay in your account. You can still open them, export them as PDF and delete them. Editing and saving work again with a new pass.',
        'You can download all your content at once in the account settings under “Download data” (JSON, re-importable). You can also delete the account there if you no longer need it.',
      ],
      button: 'Go to your account',
    },
    fr: {
      subject: 'Votre pass candidature a expiré, voici ce qui reste',
      heading: 'Votre pass a expiré',
      body: [
        'Bonjour, votre pass candidature a expiré le {{datum}}. C’était un achat unique, rien n’est renouvelé ni prélevé.',
        'Vos CV et lettres de motivation restent dans votre compte. Vous pouvez toujours les ouvrir, les exporter en PDF et les supprimer. Modifier et enregistrer redevient possible avec un nouveau pass.',
        'Vous pouvez télécharger tout votre contenu dans les paramètres du compte, sous « Télécharger les données » (JSON, réimportable). Vous pouvez aussi y supprimer le compte si vous n’en avez plus besoin.',
      ],
      button: 'Aller au compte',
    },
    es: {
      subject: 'Tu pase de candidatura ha caducado, esto se queda',
      heading: 'Tu pase ha caducado',
      body: [
        'Hola, tu pase de candidatura caducó el {{datum}}. Fue una compra única, no se renueva nada ni se cobra nada.',
        'Tus currículums y cartas siguen en tu cuenta. Puedes abrirlos, exportarlos en PDF y borrarlos. Editar y guardar vuelve a funcionar con un pase nuevo.',
        'Todo tu contenido de una vez lo descargas en los ajustes de la cuenta, en «Descargar datos» (JSON, se puede volver a importar). Allí también puedes borrar la cuenta si ya no la necesitas.',
      ],
      button: 'Ir a la cuenta',
    },
  },
  voucher_redeemed: {
    de: {
      subject: 'Dein Gutschein ist eingelöst',
      heading: 'Gutschein eingelöst',
      body: [
        'Hallo, dein Gutschein ist eingelöst. Dein Zugang gilt {{zugang}}. {{ende}}',
        'Speichern im Konto, Anschreiben und die übrigen Funktionen des Bewerbungs-Passes sind damit freigeschaltet.',
      ],
      button: 'Zum Editor',
    },
    en: {
      subject: 'Your voucher has been redeemed',
      heading: 'Voucher redeemed',
      body: [
        'Hi, your voucher has been redeemed. Your access is valid {{zugang}}. {{ende}}',
        'Saving in your account, cover letters and the other features of the application pass are now unlocked.',
      ],
      button: 'Open the editor',
    },
    fr: {
      subject: 'Votre bon a été utilisé',
      heading: 'Bon utilisé',
      body: [
        'Bonjour, votre bon a été utilisé. Votre accès est valable {{zugang}}. {{ende}}',
        'L’enregistrement dans le compte, les lettres de motivation et les autres fonctions du pass candidature sont débloqués.',
      ],
      button: 'Ouvrir l’éditeur',
    },
    es: {
      subject: 'Tu cupón está canjeado',
      heading: 'Cupón canjeado',
      body: [
        'Hola, tu cupón está canjeado. Tu acceso es válido {{zugang}}. {{ende}}',
        'Guardar en la cuenta, las cartas de presentación y las demás funciones del pase de candidatura están desbloqueadas.',
      ],
      button: 'Abrir el editor',
    },
  },
  tips_1: {
    de: {
      subject: 'Tipp 1 von 3: So liest ein Bewerbermanagementsystem deinen Lebenslauf',
      heading: 'Erst prüfen, dann abschicken',
      body: [
        'Hallo, wenn ein Unternehmen ein Bewerbermanagementsystem (ATS) nutzt, liest es deinen Lebenslauf zuerst als reinen Text ein. Spalten, Grafiken und Text in Bildern gehen dabei leicht verloren.',
        'Im Editor zeigt der Bereich „Prüfen“, wie dein Lebenslauf als Text aussieht und wo etwas fehlt. Für Bewerbungsportale gibt es außerdem die ATS-Fassung, dieselben Inhalte in einer schlichten, einspaltigen Form, als PDF in jeder Vorlage.',
        'Die gestaltete Fassung eignet sich für Mails und direkte Kontakte, die ATS-Fassung für Online-Formulare.',
      ],
      button: 'Lebenslauf prüfen',
    },
    en: {
      subject: 'Tip 1 of 3: How an applicant tracking system reads your CV',
      heading: 'Check first, then send',
      body: [
        'Hi, if a company uses an applicant tracking system (ATS), it reads your CV as plain text first. Columns, graphics and text inside images can easily get lost on the way.',
        'In the editor, the “Check” panel shows what your CV looks like as text and where something is missing. For job portals there is also the ATS version, the same content in a plain single-column layout, as a PDF in every template.',
        'The designed version works well for e-mails and direct contacts, the ATS version for online forms.',
      ],
      button: 'Check your CV',
    },
    fr: {
      subject: 'Conseil 1 sur 3 : comment un logiciel de recrutement lit votre CV',
      heading: 'Vérifier d’abord, envoyer ensuite',
      body: [
        'Bonjour, lorsqu’une entreprise utilise un logiciel de recrutement (ATS), il lit d’abord votre CV en texte brut. Les colonnes, les graphiques et le texte dans les images se perdent facilement.',
        'Dans l’éditeur, le panneau « Vérifier » montre à quoi ressemble votre CV en texte et ce qui manque. Pour les portails d’emploi, il existe aussi la version ATS, le même contenu dans une mise en page simple sur une colonne, en PDF dans chaque modèle.',
        'La version mise en page convient aux e-mails et aux contacts directs, la version ATS aux formulaires en ligne.',
      ],
      button: 'Vérifier mon CV',
    },
    es: {
      subject: 'Consejo 1 de 3: así lee tu currículum un sistema de candidaturas',
      heading: 'Primero revisar, luego enviar',
      body: [
        'Hola, si una empresa usa un sistema de gestión de candidaturas (ATS), primero lee tu currículum como texto. Las columnas, los gráficos y el texto dentro de imágenes se pierden con facilidad.',
        'En el editor, el panel «Revisar» muestra cómo se ve tu currículum como texto y dónde falta algo. Para los portales de empleo también existe la versión ATS, el mismo contenido en un diseño sencillo de una columna, en PDF en todas las plantillas.',
        'La versión con diseño va bien para correos y contactos directos, la versión ATS para formularios en línea.',
      ],
      button: 'Revisar mi currículum',
    },
  },
  tips_3: {
    de: {
      subject: 'Tipp 2 von 3: Ein Anschreiben je Stelle, ohne jedes Mal neu anzufangen',
      heading: 'Ein Anschreiben je Stelle',
      body: [
        'Hallo, ein Anschreiben wirkt, wenn man merkt, dass es für genau diese Stelle geschrieben ist. Am einfachsten gelingt das, wenn du zwei oder drei Anforderungen aus der Anzeige aufgreifst und zu jeder ein eigenes Beispiel nennst.',
        'Im Editor hängt das Anschreiben am Lebenslauf. Für eine neue Stelle legst du eine weitere Fassung an, passt den Text an und behältst die bisherigen. Der Bereich „Prüfen“ markiert dabei Floskeln und sehr lange Sätze.',
        'Braucht eine Funktion den Bewerbungs-Pass, sagt der Editor es dir an genau der Stelle, mit Preis.',
      ],
      button: 'Anschreiben öffnen',
    },
    en: {
      subject: 'Tip 2 of 3: One cover letter per job without starting from scratch',
      heading: 'One cover letter per job',
      body: [
        'Hi, a cover letter works when the reader can tell it was written for this exact job. The easiest way is to pick two or three requirements from the ad and give your own example for each.',
        'In the editor, the cover letter belongs to the CV. For a new job you add another version, adapt the text and keep the earlier ones. The “Check” panel flags stock phrases and very long sentences along the way.',
        'If a feature needs the application pass, the editor tells you right there, with the price.',
      ],
      button: 'Open cover letter',
    },
    fr: {
      subject: 'Conseil 2 sur 3 : une lettre par poste, sans repartir de zéro',
      heading: 'Une lettre par poste',
      body: [
        'Bonjour, une lettre de motivation fonctionne quand on voit qu’elle a été écrite pour ce poste précis. Le plus simple est de reprendre deux ou trois exigences de l’annonce et de donner un exemple personnel pour chacune.',
        'Dans l’éditeur, la lettre est liée au CV. Pour un nouveau poste, vous créez une autre version, adaptez le texte et conservez les précédentes. Le panneau « Vérifier » signale au passage les formules toutes faites et les phrases très longues.',
        'Si une fonction nécessite le pass candidature, l’éditeur vous le dit à cet endroit, avec le prix.',
      ],
      button: 'Ouvrir la lettre',
    },
    es: {
      subject: 'Consejo 2 de 3: una carta por puesto sin empezar de cero',
      heading: 'Una carta por puesto',
      body: [
        'Hola, una carta de presentación funciona cuando se nota que está escrita para ese puesto concreto. Lo más fácil es tomar dos o tres requisitos del anuncio y dar un ejemplo propio para cada uno.',
        'En el editor, la carta va unida al currículum. Para un puesto nuevo creas otra versión, adaptas el texto y conservas las anteriores. El panel «Revisar» marca de paso las frases hechas y las frases muy largas.',
        'Si una función necesita el pase de candidatura, el editor te lo dice justo ahí, con el precio.',
      ],
      button: 'Abrir la carta',
    },
  },
  tips_7: {
    de: {
      subject: 'Tipp 3 von 3: Mit einer KI überarbeiten, ohne dass das Layout leidet',
      heading: 'KI nutzen, Layout behalten',
      body: [
        'Hallo, wer ChatGPT, Claude oder ein anderes Modell beim Formulieren helfen lässt, kopiert sonst Text hin und her, und die Gestaltung geht verloren.',
        'Die Markdown-Brücke im Editor gibt deinen Lebenslauf als Markdown aus. Du gibst ihn der KI, lässt ihn überarbeiten und fügst das Ergebnis wieder ein. Die Inhalte landen in den richtigen Feldern, die Vorlage bleibt, wie sie ist.',
        'Mit dem Bewerbungs-Pass geht es auch direkt. Claude und andere MCP-Programme lesen und ändern deinen Lebenslauf dann über eine Verbindung, die du in den Kontoeinstellungen jederzeit trennen kannst.',
        'Lies das Ergebnis trotzdem selbst gegen, eine KI kennt deine Stationen nur aus dem, was du ihr gibst. Das war der letzte Tipp dieser Reihe.',
      ],
      button: 'Zum Editor',
    },
    en: {
      subject: 'Tip 3 of 3: Edit with an AI without breaking the layout',
      heading: 'Use AI, keep the layout',
      body: [
        'Hi, if you let ChatGPT, Claude or another model help with the wording, you usually end up copying text back and forth and the design gets lost.',
        'The Markdown bridge in the editor gives you your CV as Markdown. You hand it to the AI, let it revise the text and paste the result back in. The content lands in the right fields and the template stays as it is.',
        'With the application pass it also works directly. Claude and other MCP apps then read and edit your CV through a connection you can disconnect in the account settings at any time.',
        'Still read the result yourself, an AI only knows your career from what you give it. That was the last tip in this series.',
      ],
      button: 'Open the editor',
    },
    fr: {
      subject: 'Conseil 3 sur 3 : retravailler avec une IA sans casser la mise en page',
      heading: 'Utiliser l’IA, garder la mise en page',
      body: [
        'Bonjour, si vous faites aider ChatGPT, Claude ou un autre modèle pour la rédaction, vous copiez souvent du texte dans tous les sens et la mise en page se perd.',
        'Le pont Markdown de l’éditeur vous donne votre CV en Markdown. Vous le confiez à l’IA, la laissez retravailler le texte et collez le résultat. Le contenu arrive dans les bons champs et le modèle reste tel quel.',
        'Avec le pass candidature, cela fonctionne aussi directement. Claude et d’autres programmes MCP lisent et modifient alors votre CV via une connexion que vous pouvez couper à tout moment dans les paramètres du compte.',
        'Relisez quand même le résultat vous-même, une IA ne connaît votre parcours que par ce que vous lui donnez. C’était le dernier conseil de cette série.',
      ],
      button: 'Ouvrir l’éditeur',
    },
    es: {
      subject: 'Consejo 3 de 3: revisar con una IA sin romper el diseño',
      heading: 'Usar IA, mantener el diseño',
      body: [
        'Hola, si dejas que ChatGPT, Claude u otro modelo te ayude a redactar, lo normal es copiar texto de un lado a otro y el diseño se pierde.',
        'El puente Markdown del editor te da tu currículum en Markdown. Se lo pasas a la IA, dejas que revise el texto y pegas el resultado. El contenido va a los campos correctos y la plantilla se queda como está.',
        'Con el pase de candidatura también funciona directamente. Claude y otros programas MCP leen y editan tu currículum a través de una conexión que puedes cortar cuando quieras en los ajustes de la cuenta.',
        'Aun así, lee tú el resultado, una IA solo conoce tu trayectoria por lo que le das. Este era el último consejo de la serie.',
      ],
      button: 'Abrir el editor',
    },
  },
};

/** Sätze für Platzhalter, die je Sprache anders heißen. */
const WORDS = {
  kontoPass: { de: d => `Dein Bewerbungs-Pass gilt bis ${d}.`, en: d => `Your application pass is valid until ${d}.`, fr: d => `Votre pass candidature est valable jusqu’au ${d}.`, es: d => `Tu pase de candidatura es válido hasta el ${d}.` },
  kontoPilot: { de: d => `Dein Zugang gilt bis ${d}.`, en: d => `Your access is valid until ${d}.`, fr: d => `Votre accès est valable jusqu’au ${d}.`, es: d => `Tu acceso es válido hasta el ${d}.` },
  kontoNone: {
    de: 'Einen Pass hast du noch nicht. Im Editor arbeitest du dann wie ohne Konto, kostenlos und mit deinen Daten im Browser.',
    en: 'You do not have a pass yet. In the editor you then work as without an account, free of charge and with your data in the browser.',
    fr: 'Vous n’avez pas encore de pass. Dans l’éditeur, vous travaillez alors comme sans compte, gratuitement et avec vos données dans le navigateur.',
    es: 'Todavía no tienes un pase. En el editor trabajas entonces como sin cuenta, gratis y con tus datos en el navegador.',
  },
  kontoOpen: { de: 'Dein Konto ist ohne Enddatum freigeschaltet.', en: 'Your account is unlocked without an end date.', fr: 'Votre compte est débloqué sans date de fin.', es: 'Tu cuenta está desbloqueada sin fecha de fin.' },
  zugangBis: { de: d => `bis zum ${d}`, en: d => `until ${d}`, fr: d => `jusqu’au ${d}`, es: d => `hasta el ${d}` },
  zugangOpen: { de: 'ohne Enddatum', en: 'without an end date', fr: 'sans date de fin', es: 'sin fecha de fin' },
  endeDays: {
    de: 'Er endet von selbst, ohne Abo und ohne Kosten.', en: 'It ends by itself, with no subscription and no charge.',
    fr: 'Il prend fin automatiquement, sans abonnement ni frais.', es: 'Termina solo, sin suscripción y sin coste.',
  },
  tipsFooter: {
    de: (date, url) => `Du bekommst diese Mail, weil du am ${date} Tipps per E-Mail zugestimmt hast. Abbestellen geht mit einem Klick und ohne Anmeldung: ${url}, oder in den Kontoeinstellungen unter „E-Mails“.`,
    en: (date, url) => `You are receiving this e-mail because you agreed to tips by e-mail on ${date}. Unsubscribe with one click, no login needed: ${url}, or in the account settings under “E-mails”.`,
    fr: (date, url) => `Vous recevez cet e-mail car vous avez accepté de recevoir des conseils par e-mail le ${date}. Désabonnement en un clic, sans connexion : ${url}, ou dans les paramètres du compte, rubrique « E-mails ».`,
    es: (date, url) => `Recibes este correo porque el ${date} aceptaste recibir consejos por correo. Puedes darte de baja con un clic y sin iniciar sesión: ${url}, o en los ajustes de la cuenta, en «Correos».`,
  },
  unsubLabel: { de: 'Tipps abbestellen', en: 'Unsubscribe from tips', fr: 'Se désabonner des conseils', es: 'Darse de baja de los consejos' },
  sender: { de: 'Absender', en: 'Sender', fr: 'Expéditeur', es: 'Remitente' },
};

/* ── Register ──────────────────────────────────────────────────────────── */

const P_LINK = { key: 'link', label: 'Adresse des Editors' };
const P_NAME = { key: 'name', label: 'Nutzername' };

/**
 * kind: service | tips. legal: Rechtsgrundlage (Anzeige im Admin-Bereich).
 * timing: Standard; timingFields: was der Admin einstellen darf.
 * maxAgeDays: wie lange eine wartende Mail automatisch noch rausgeht.
 */
export const WORKFLOWS = {
  welcome: {
    kind: 'service', label: 'Willkommen nach Bestätigung',
    trigger: 'Klick auf den Bestätigungslink (offene Registrierung) bzw. Registrierung mit Einladung',
    legal: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag Konto)',
    defaultEnabled: true, timing: {}, timingFields: [], maxAgeDays: 3, overridable: true,
    placeholders: [{ key: 'konto', label: 'Satz zum Stand des Kontos (Pass bis …, ohne Pass, …)' }, P_LINK, P_NAME],
  },
  pass_ending: {
    kind: 'service', label: 'Pass endet bald',
    trigger: 'Bewerbungs-Pass oder Zeitgutschein endet in X Tagen (zwei Hinweise)',
    legal: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag, Hinweis auf Laufzeitende ohne Verlängerung)',
    defaultEnabled: true, timing: { soonDays: 14, finalDays: 3 }, timingFields: ['soonDays', 'finalDays'], maxAgeDays: 30, overridable: false,
    placeholders: [],
  },
  access_ending: {
    kind: 'service', label: 'Zugang endet bald (Einladung mit Laufzeit)',
    trigger: 'Laufzeit aus einem Einladungscode endet in X Tagen (zwei Hinweise)',
    legal: 'Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag Konto)',
    defaultEnabled: true, timing: { soonDays: 14, finalDays: 3 }, timingFields: ['soonDays', 'finalDays'], maxAgeDays: 30, overridable: false,
    placeholders: [],
  },
  pass_expired: {
    kind: 'service', label: 'Pass abgelaufen',
    trigger: 'Bewerbungs-Pass ist abgelaufen (nicht nach Widerruf); X Tage danach',
    legal: 'Art. 6 Abs. 1 lit. b DSGVO (Vertrag, was nach dem Ende bleibt)',
    defaultEnabled: true, timing: { afterDays: 0 }, timingFields: ['afterDays'], maxAgeDays: 10, overridable: true,
    placeholders: [{ key: 'datum', label: 'Ablaufdatum' }, P_LINK, P_NAME],
  },
  voucher_redeemed: {
    kind: 'service', label: 'Gutschein eingelöst',
    trigger: 'Gutschein im Konto oder auf /code eingelöst',
    legal: 'Art. 6 Abs. 1 lit. b DSGVO (Bestätigung der Freischaltung)',
    defaultEnabled: true, timing: {}, timingFields: [], maxAgeDays: 3, overridable: true,
    placeholders: [{ key: 'zugang', label: '„bis zum …“ bzw. „ohne Enddatum“' }, { key: 'ende', label: 'Satz „endet von selbst“ (leer bei Dauerzugang)' }, P_LINK, P_NAME],
  },
  tips_1: {
    kind: 'tips', label: 'Tipp 1: Prüfen und ATS-Fassung',
    trigger: 'X Tage nach wirksamer Einwilligung in Tipps',
    legal: 'Einwilligung, Art. 6 Abs. 1 lit. a DSGVO; § 7 Abs. 2 Nr. 2 UWG',
    defaultEnabled: true, timing: { delayDays: 1 }, timingFields: ['delayDays'], maxAgeDays: 5, overridable: true,
    placeholders: [P_LINK, P_NAME],
  },
  tips_3: {
    kind: 'tips', label: 'Tipp 2: Anschreiben je Stelle',
    trigger: 'X Tage nach wirksamer Einwilligung in Tipps',
    legal: 'Einwilligung, Art. 6 Abs. 1 lit. a DSGVO; § 7 Abs. 2 Nr. 2 UWG',
    defaultEnabled: true, timing: { delayDays: 3 }, timingFields: ['delayDays'], maxAgeDays: 5, overridable: true,
    placeholders: [P_LINK, P_NAME],
  },
  tips_7: {
    kind: 'tips', label: 'Tipp 3: KI-Brücke',
    trigger: 'X Tage nach wirksamer Einwilligung in Tipps',
    legal: 'Einwilligung, Art. 6 Abs. 1 lit. a DSGVO; § 7 Abs. 2 Nr. 2 UWG',
    defaultEnabled: true, timing: { delayDays: 7 }, timingFields: ['delayDays'], maxAgeDays: 5, overridable: true,
    placeholders: [P_LINK, P_NAME],
  },
};
export const TIPS_WORKFLOWS = Object.keys(WORKFLOWS).filter(k => WORKFLOWS[k].kind === 'tips');

/** Erlaubte Bereiche für die Zeitpunkte. */
const TIMING_LIMITS = { soonDays: [1, 60], finalDays: [0, 30], afterDays: [0, 30], delayDays: [0, 14] };

/** Prüft eine Zeitangabe aus dem Admin-Bereich. { ok, value, error } */
export function validateTiming(id, input) {
  const wf = WORKFLOWS[id];
  const out = {};
  for (const f of wf.timingFields) {
    if (input?.[f] === undefined) continue;
    const n = Number.parseInt(String(input[f]), 10);
    const [lo, hi] = TIMING_LIMITS[f];
    if (!Number.isInteger(n) || n < lo || n > hi) return { ok: false, error: `${f}: ${lo} bis ${hi} Tage.` };
    out[f] = n;
  }
  const merged = { ...wf.timing, ...out };
  if ('soonDays' in merged && merged.finalDays >= merged.soonDays) return { ok: false, error: 'Der erste Hinweis muss vor dem letzten liegen.' };
  return { ok: true, value: out };
}

/* ── Anpassungen ───────────────────────────────────────────────────────── */

const LIMITS = { subject: 160, heading: 120, body: 4000 };
const strip = s => [...String(s ?? '').replace(/\r\n?/g, '\n')].filter(ch => { const c = ch.charCodeAt(0); return c === 9 || c === 10 || (c >= 32 && c !== 127); }).join('');

/** Prüft eine Anpassung { subject?, heading?, body? } für eine Sprache.
 *  Leere Felder heißen „Standard". Nur bekannte Platzhalter. */
export function validateOverride(id, input) {
  const wf = WORKFLOWS[id];
  if (!wf?.overridable) return { ok: false, error: 'Dieser Text lässt sich nicht anpassen.' };
  const allowed = new Set(wf.placeholders.map(p => p.key));
  const out = {};
  for (const f of ['subject', 'heading', 'body']) {
    const v = strip(input?.[f]).trim();
    if (!v) continue;
    if (v.length > LIMITS[f]) return { ok: false, error: `${f}: höchstens ${LIMITS[f]} Zeichen.` };
    if (f !== 'body' && /\n/.test(v)) return { ok: false, error: `${f}: nur eine Zeile.` };
    const unknown = [...v.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map(m => m[1]).filter(k => !allowed.has(k));
    if (unknown.length) return { ok: false, error: `Unbekannte Platzhalter: ${[...new Set(unknown)].map(k => `{{${k}}}`).join(', ')}` };
    out[f] = v;
  }
  return { ok: true, value: out };
}

/* ── Rendern ───────────────────────────────────────────────────────────── */

const linkify = escaped => escaped.replace(/https?:\/\/(?:[^\s<&]|&amp;)+/g, m => {
  const u = m.replace(/[.,;:!?)»”]+$/, '');
  return `<a href="${u}" style="color:${SOFT};">${u}</a>${m.slice(u.length)}`;
});
const fillText = (t, vars) => String(t).replace(/\{\{\s*([a-z]+)\s*\}\}/g, (all, k) => (Object.hasOwn(vars, k) ? String(vars[k] ?? '') : all));
const fillHtml = (escaped, vars) => escaped.replace(/\{\{\s*([a-z]+)\s*\}\}/g, (all, k) => (Object.hasOwn(vars, k) ? escapeHtml(vars[k] ?? '') : all));

/** Absatz → HTML. Zeilen mit „- " werden eine Liste. */
function paragraphHtml(par, vars) {
  const lines = par.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  if (lines.every(l => l.startsWith('- '))) {
    return `<ul style="font-size:14px;line-height:1.6;color:${SOFT};margin:0 0 16px;padding-left:20px;">`
      + lines.map(l => `<li style="margin:0 0 6px;">${linkify(fillHtml(escapeHtml(l.slice(2)), vars))}</li>`).join('') + '</ul>';
  }
  const html = lines.map(l => linkify(fillHtml(escapeHtml(l), vars))).join('<br/>');
  return html.trim() ? p(html) : '';
}

/** Standardtext oder Anpassung je Sprache (Fallback Deutsch). */
export function textFor(id, lang, overrides = null) {
  const L = mailLang(lang);
  const base = T[id]?.[L] || T[id]?.de;
  if (!base) return null;
  const o = overrides?.[L] || {};
  return {
    subject: o.subject || base.subject,
    heading: o.heading || base.heading,
    body: o.body ? o.body.split(/\n\s*\n/) : base.body,
    button: base.button,
    customized: !!(o.subject || o.heading || o.body),
  };
}
/** Standardtext als bearbeitbarer Klartext (für den Admin-Bereich). */
export function defaultTextPlain(id, lang) {
  const t = T[id]?.[mailLang(lang)];
  return t ? { subject: t.subject, heading: t.heading, body: t.body.join('\n\n') } : null;
}

/** Werte der Platzhalter je Sprache. ctx: { user, base, plan, until, grantUntil, lifetime } */
export function varsFor(id, lang, ctx) {
  const L = mailLang(lang);
  const link = ctx.base || '';
  const v = { link, name: ctx.user?.username || '' };
  if (id === 'welcome') {
    const k = ctx.plan?.kind;
    v.konto = k === 'pass' && ctx.plan.until ? WORDS.kontoPass[L](dateIn(L, ctx.plan.until))
      : k === 'pilot' && ctx.plan.until ? WORDS.kontoPilot[L](dateIn(L, ctx.plan.until))
        : k === 'none' ? WORDS.kontoNone[L] : WORDS.kontoOpen[L];
  }
  if (id === 'pass_expired') v.datum = ctx.until ? dateIn(L, ctx.until) : '';
  if (id === 'voucher_redeemed') {
    v.zugang = ctx.lifetime || !ctx.grantUntil ? WORDS.zugangOpen[L] : WORDS.zugangBis[L](dateIn(L, ctx.grantUntil));
    v.ende = ctx.lifetime || !ctx.grantUntil ? '' : WORDS.endeDays[L];
  }
  return v;
}

/**
 * Fertige Mail { subject, html, text, headers, tag }.
 * opts: { overrides, unsubscribeUrl, oneClickUrl, consentAt, seller }
 */
export function renderWorkflow(id, lang, ctx, opts = {}) {
  const L = mailLang(lang);
  const wf = WORKFLOWS[id];
  if (id === 'pass_ending' || id === 'access_ending') {
    // Bestehende Vorlagen, zweisprachig, unverändert.
    const tpl = id === 'pass_ending' ? tplPassEnding : tplAccessEnding;
    const m = tpl({ username: ctx.user?.username || '', until: ctx.until, daysLeft: ctx.daysLeft, base: ctx.base });
    return { ...m, headers: {}, tag: id };
  }
  const t = textFor(id, L, opts.overrides);
  const vars = varsFor(id, L, ctx);
  const bodyHtml = t.body.map(par => paragraphHtml(strip(par), vars)).join('');
  const button = ctx.base ? `<div style="margin:4px 0 16px;">${btn(escapeHtml(ctx.base), escapeHtml(t.button))}</div>` : '';
  let footer = '';
  const textFooter = [];
  const headers = {};
  if (wf.kind === 'tips') {
    const date = opts.consentAt ? dateIn(L, opts.consentAt) : '';
    const url = opts.unsubscribeUrl || '';
    const sellerLine = [opts.seller?.name, String(opts.seller?.address || '').split('\n').map(s => s.trim()).filter(Boolean).join(', ')].filter(Boolean).join(', ');
    footer = `<div style="border-top:1px solid ${LINE};margin:20px 0 12px;"></div>`
      + `<p style="font-size:11px;line-height:1.5;color:#8b8d9b;margin:0 0 8px;">${linkify(escapeHtml(WORDS.tipsFooter[L](date, url)))}</p>`
      + (url ? `<p style="font-size:11px;margin:0 0 8px;"><a href="${escapeHtml(url)}" style="color:${SOFT};">${escapeHtml(WORDS.unsubLabel[L])}</a></p>` : '')
      + (sellerLine ? `<p style="font-size:11px;line-height:1.5;color:#8b8d9b;margin:0;">${escapeHtml(WORDS.sender[L])}: ${escapeHtml(sellerLine)}</p>` : '');
    textFooter.push('', '--', WORDS.tipsFooter[L](date, url), ...(sellerLine ? [`${WORDS.sender[L]}: ${sellerLine}`] : []));
    if (opts.oneClickUrl) {
      headers['List-Unsubscribe'] = `<${opts.oneClickUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
  }
  const subject = fillText(t.subject, vars).replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const text = [
    fillText(t.heading, vars), '',
    ...t.body.map(par => fillText(strip(par), vars)).filter(s => s.trim()).flatMap(s => [s, '']),
    ...(ctx.base ? [`${t.button}: ${ctx.base}`] : []),
    ...textFooter,
  ].join('\n');
  return withTag(id, { subject, html: layout(h(escapeHtml(fillText(t.heading, vars))) + bodyHtml + button + footer), text, headers });
}

/** Beispielwerte für die Vorschau im Admin-Bereich. */
export function sampleCtx(id, base) {
  const in90 = new Date(Date.now() + 90 * 86_400_000);
  return {
    user: { username: 'beispiel' }, base,
    plan: { kind: 'none', until: null },
    until: id === 'pass_expired' ? new Date(Date.now() - 86_400_000) : new Date(Date.now() + 3 * 86_400_000),
    daysLeft: 3, grantUntil: in90, lifetime: false,
  };
}
