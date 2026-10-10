/**
 * Texte zur Gratis-Grenze (09.10.2026, optional, standardmäßig aus): „Ein PDF bleibt
 * gratis, Word, Anschreiben, weitere Fassungen und Sprachen kommen in den
 * Pass." Sie gelten NUR, wenn der Server `freeTier.limited: true` meldet
 * (billing/freeTier.ts). Ohne Schalter bleiben die Texte aus billing.ts.
 *
 * Grundsatz wie in billing.ts: Der Preis steht da, bevor jemand anfängt, nicht
 * erst beim Herunterladen. Kein Countdown, keine Warnfarbe, keine erfundenen
 * Zahlen. Im Deutschen wird geduzt, im Französischen gesiezt, im Spanischen
 * geduzt.
 */
import type { UiLang } from '../i18n';

export type FreeTierKey = 'docx' | 'coverLetter' | 'profiles' | 'langs';

interface Item { title: string; body: string }
interface Qa { q: string; a: string }
type Cell = boolean | string;

export interface FreeTierStrings {
  /** „Im Bewerbungs-Pass · 9 € einmalig · 90 Tage · kein Abo" */
  priceLine: (price: string, days: number) => string;
  /** Kurzform für Vorleseprogramme an gesperrten Knöpfen. */
  inPass: string;
  /** Link auf das Freischalt-Paneel neben einem Hinweis. */
  more: string;
  /** Freischalt-Paneel je gesperrter Funktion. */
  unlock: Record<FreeTierKey, Item>;
  unlockFreeNote: string;
  /** Freischalt-Paneel „Konto": Leistungsumfang mit Grenze. */
  accountBody: string;
  /** Liste in der Pass-Karte, vor den Server-Funktionen. */
  features: Record<FreeTierKey, Item>;
  // Angebotsseite
  pH1a: string;
  pLede: string;
  freeList: (templates: number) => string[];
  tableRows: (templates: number, price: string, days: number) => { label: string; free: Cell; pass: Cell }[];
  /** Ersetzt in billing.ts die Frage „Brauche ich den Pass für PDF oder Word?". */
  faqFree: Qa;
  /** Ersetzt „Warum kostet das überhaupt etwas?". */
  faqWhy: Qa;
  selfHost: string;
  selfHostLink: string;
  // Startseite
  landingH: (price: string) => string;
  landingLede: string;
  /** Ersetzt die Frage „Wie komme ich rein?". */
  landingFaqAccess: Qa;
  // Editor
  clTitle: string;
  clBody: string;
  clKeep: string;
  langsLabel: string;
  profilesLabel: string;
  /** Band „Konto ohne Pass" (ersetzt zugang.ts planNone bei Grenze). */
  planNone: string;
}

const de: FreeTierStrings = {
  priceLine: (p, d) => `Im Bewerbungs-Pass · ${p} einmalig · ${d} Tage · kein Abo`,
  inPass: 'im Bewerbungs-Pass',
  more: 'Mehr zum Pass',
  unlock: {
    docx: { title: 'Word und LaTeX gibt es mit dem Pass.', body: 'Beide Word-Fassungen, mit dem Design deiner Vorlage und einspaltig für Bewerbungsportale, dazu der LaTeX-Quelltext. Die ATS-Fassung als PDF und RenderCV-YAML bleiben kostenlos.' },
    coverLetter: { title: 'Das Anschreiben gehört zum Pass.', body: 'Du schreibst es passend zur Vorlage deines Lebenslaufs und lädst es als PDF herunter.' },
    profiles: { title: 'Weitere Fassungen gibt es mit dem Pass.', body: 'Eine Fassung je Stelle oder Branche, neu oder als Kopie. Ohne Pass bleibt es bei einer Fassung. Importieren kannst du weiterhin in diese eine.' },
    langs: { title: 'Weitere Sprachen gibt es mit dem Pass.', body: 'Derselbe Lebenslauf auf Deutsch, Englisch, Französisch und Spanisch, mit übersetzten Überschriften. Ohne Pass wählst du eine Sprache frei.' },
  },
  unlockFreeNote: 'Das PDF deines Lebenslaufs bleibt ohne Konto kostenlos.',
  accountBody: 'Word, Anschreiben, weitere Fassungen und Sprachen, dazu Speichern über Geräte, Sharelinks, Versionen am Server und die KI-Verbindung.',
  features: {
    docx: { title: 'Word und LaTeX', body: 'Word mit dem Design deiner Vorlage und einspaltig für Bewerbungsportale, dazu LaTeX zum Weiterbearbeiten.' },
    coverLetter: { title: 'Anschreiben', body: 'Passend zur Vorlage deines Lebenslaufs, mit PDF.' },
    profiles: { title: 'Mehrere Fassungen', body: 'Eine je Stelle oder Branche, auch als Kopie einer bestehenden.' },
    langs: { title: 'Vier Sprachen', body: 'Deutsch, Englisch, Französisch und Spanisch, mit übersetzten Überschriften.' },
  },
  pH1a: 'Das PDF deines Lebenslaufs ist kostenlos.',
  pLede: 'Schreiben, gestalten, PDF herunterladen: ohne Konto und ohne Schranke beim Download. Der Bewerbungs-Pass bringt Word, Anschreiben, weitere Fassungen und Sprachen und alles, was einen Server braucht.',
  freeList: n => [
    `Alle ${n} Vorlagen, Farben und Schriften`,
    'PDF des Lebenslaufs, auch als ATS-Fassung',
    'Eine Fassung in einer Sprache deiner Wahl',
    'Daten bleiben in deinem Browser, mit Sicherungsdatei',
    'Import, ATS-Prüfung, Datenexport als JSON, Markdown und HTML',
  ],
  tableRows: (n, price, d) => [
    { label: `Alle ${n} Vorlagen, Farben, Schriften`, free: true, pass: true },
    { label: 'PDF des Lebenslaufs, auch als ATS-Fassung', free: true, pass: true },
    { label: 'Word, gestaltet und als ATS-Fassung', free: false, pass: true },
    { label: 'Anschreiben', free: false, pass: true },
    { label: 'Fassungen', free: 'Eine', pass: 'Mehrere' },
    { label: 'Sprachen des Lebenslaufs', free: 'Eine, frei wählbar', pass: 'Alle vier' },
    { label: 'Import und Datenexport (JSON, Markdown, HTML)', free: true, pass: true },
    { label: 'Wo deine Daten liegen', free: 'In deinem Browser', pass: 'Auf dem Server' },
    { label: 'Versionen', free: 'Im Browser (20)', pass: 'Am Server (25)' },
    { label: 'Speichern über Geräte', free: 'Mit Sicherungsdatei', pass: true },
    { label: 'Sharelinks mit Ablauf, Widerruf und Aufrufzählung', free: false, pass: true },
    { label: 'KI verbinden per MCP', free: 'Markdown-Brücke', pass: true },
    { label: 'API-Schlüssel', free: false, pass: true },
    { label: 'Preis', free: '0 €', pass: `${price} einmalig, ${d} Tage` },
  ],
  faqFree: { q: 'Was bleibt ohne Pass kostenlos?', a: 'Der Editor mit allen Vorlagen, Farben und Schriften, das PDF deines Lebenslaufs (auch die ATS-Fassung als PDF), eine Fassung in einer Sprache deiner Wahl, Import und Datenexport als JSON, Markdown und HTML. Word, Anschreiben, weitere Fassungen und Sprachen gehören zum Pass, und das steht an den Knöpfen, bevor du anfängst. Läuft dein Pass ab, kannst du weiter alles exportieren, auch Word.' },
  faqWhy: { q: 'Warum kostet das überhaupt etwas?', a: 'Speicher, Sharelinks und die KI-Verbindung laufen auf einem Server, und an Vorlagen, Word-Export und Anschreiben steckt laufende Arbeit. Das PDF deines Lebenslaufs bleibt kostenlos. Wer gar nichts zahlen will, betreibt die quelloffene Fassung selbst, dort ist alles frei.' },
  selfHost: 'Lieber selbst hosten? Der Quellcode ist frei (AGPL), in deiner eigenen Instanz gibt es keine Grenze.',
  selfHostLink: 'Zum Quellcode',
  landingH: p => `PDF kostenlos. ${p} einmalig für den Pass.`,
  landingLede: 'Lebenslauf, alle Vorlagen und das PDF sind ohne Konto frei. Der Bewerbungs-Pass bringt Word, Anschreiben, weitere Fassungen und Sprachen, Speichern über Geräte, Sharelinks und die KI-Verbindung.',
  landingFaqAccess: { q: 'Wie komme ich rein?', a: 'Ausprobieren geht ohne Konto: Editor, alle Vorlagen, Foto, Import und das PDF deines Lebenslaufs, und deine Daten bleiben dabei in deinem Browser. Word, Anschreiben, weitere Fassungen und Sprachen gehören zum Bewerbungs-Pass, ebenso Sharelinks, Versionen am Server und die KI-Anbindung per MCP. Den Preis siehst du vorher auf der Preisseite.' },
  clTitle: 'Das Anschreiben gehört zum Bewerbungs-Pass.',
  clBody: 'Mit dem Pass schreibst du es hier passend zur Vorlage deines Lebenslaufs und lädst es als PDF herunter. Dein Lebenslauf und sein PDF bleiben kostenlos.',
  clKeep: 'Zurück zum Lebenslauf',
  langsLabel: 'Weitere Sprachen',
  profilesLabel: 'Weitere Fassungen',
  planNone: 'Dein Konto ist angelegt. Word, Anschreiben, weitere Fassungen und Sprachen, Speichern im Konto, Sharelinks und die KI-Verbindung gibt es mit dem Bewerbungs-Pass. Das PDF deines Lebenslaufs bleibt kostenlos.',
};

const en: FreeTierStrings = {
  priceLine: (p, d) => `In the Application Pass · ${p} one-off · ${d} days · no subscription`,
  inPass: 'in the Application Pass',
  more: 'About the pass',
  unlock: {
    docx: { title: 'Word and LaTeX come with the pass.', body: 'Both Word versions, with your template’s design and single-column for application portals, plus the LaTeX source. The ATS version as PDF and RenderCV YAML stay free.' },
    coverLetter: { title: 'The cover letter is part of the pass.', body: 'You write it to match your résumé’s template and download it as a PDF.' },
    profiles: { title: 'More versions come with the pass.', body: 'One version per job or industry, new or as a copy. Without the pass you have one version. You can still import into that one.' },
    langs: { title: 'More languages come with the pass.', body: 'The same résumé in German, English, French and Spanish, with translated headings. Without the pass you pick one language freely.' },
  },
  unlockFreeNote: 'The PDF of your résumé stays free without an account.',
  accountBody: 'Word, the cover letter, more versions and languages, plus saving across devices, share links, versions on the server and the AI connection.',
  features: {
    docx: { title: 'Word and LaTeX', body: 'Word with your template’s design and single-column for application portals, plus LaTeX to keep editing.' },
    coverLetter: { title: 'Cover letter', body: 'Matching your résumé’s template, with PDF.' },
    profiles: { title: 'Several versions', body: 'One per job or industry, also as a copy of an existing one.' },
    langs: { title: 'Four languages', body: 'German, English, French and Spanish, with translated headings.' },
  },
  pH1a: 'The PDF of your résumé is free.',
  pLede: 'Write, design, download the PDF: without an account and without a paywall at download. The Application Pass adds Word, the cover letter, more versions and languages, and everything that needs a server.',
  freeList: n => [
    `All ${n} templates, colours and fonts`,
    'PDF of your résumé, also as the ATS version',
    'One version in a language of your choice',
    'Data stays in your browser, with a backup file',
    'Import, ATS check, data export as JSON, Markdown and HTML',
  ],
  tableRows: (n, price, d) => [
    { label: `All ${n} templates, colours, fonts`, free: true, pass: true },
    { label: 'PDF of your résumé, also as the ATS version', free: true, pass: true },
    { label: 'Word, designed and as the ATS version', free: false, pass: true },
    { label: 'Cover letter', free: false, pass: true },
    { label: 'Résumé versions', free: 'One', pass: 'Several' },
    { label: 'Résumé languages', free: 'One, your choice', pass: 'All four' },
    { label: 'Import and data export (JSON, Markdown, HTML)', free: true, pass: true },
    { label: 'Where your data lives', free: 'In your browser', pass: 'On the server' },
    { label: 'Versions', free: 'In the browser (20)', pass: 'On the server (25)' },
    { label: 'Saving across devices', free: 'With a backup file', pass: true },
    { label: 'Share links with expiry, revocation and view count', free: false, pass: true },
    { label: 'Connect AI via MCP', free: 'Markdown bridge', pass: true },
    { label: 'API keys', free: false, pass: true },
    { label: 'Price', free: '€0', pass: `${price} one-off, ${d} days` },
  ],
  faqFree: { q: 'What stays free without the pass?', a: 'The editor with all templates, colours and fonts, the PDF of your résumé (including the ATS version as PDF), one version in a language of your choice, import and data export as JSON, Markdown and HTML. Word, the cover letter, more versions and languages are part of the pass, and the buttons say so before you start. When your pass ends, you can still export everything, Word included.' },
  faqWhy: { q: 'Why does it cost anything at all?', a: 'Storage, share links and the AI connection run on a server, and the templates, Word export and cover letter take ongoing work. The PDF of your résumé stays free. If you do not want to pay anything, run the open-source version yourself; everything is free there.' },
  selfHost: 'Prefer to self-host? The source code is free (AGPL), and your own instance has no limits.',
  selfHostLink: 'View the source',
  landingH: p => `PDF for free. ${p} one-off for the pass.`,
  landingLede: 'The résumé, all templates and the PDF are free without an account. The Application Pass adds Word, the cover letter, more versions and languages, saving across devices, share links and the AI connection.',
  landingFaqAccess: { q: 'How do I get in?', a: 'You can try it without an account: the editor, all templates, photo, import and the PDF of your résumé, and your data stays in your browser. Word, the cover letter, more versions and languages are part of the Application Pass, as are share links, versions on the server and the AI connection via MCP. The price is on the pricing page before you start.' },
  clTitle: 'The cover letter is part of the Application Pass.',
  clBody: 'With the pass you write it here to match your résumé’s template and download it as a PDF. Your résumé and its PDF stay free.',
  clKeep: 'Back to the résumé',
  langsLabel: 'More languages',
  profilesLabel: 'More versions',
  planNone: 'Your account is set up. Word, the cover letter, more versions and languages, saving in the account, share links and the AI connection come with the Application Pass. The PDF of your résumé stays free.',
};

const fr: FreeTierStrings = {
  priceLine: (p, d) => `Dans le Pass candidature · ${p} en une fois · ${d} jours · sans abonnement`,
  inPass: 'dans le Pass candidature',
  more: 'En savoir plus sur le pass',
  unlock: {
    docx: { title: 'Word et LaTeX sont inclus dans le pass.', body: 'Les deux versions Word, avec le design de votre modèle et sur une colonne pour les portails de candidature, plus la source LaTeX. La version ATS en PDF et le YAML RenderCV restent gratuits.' },
    coverLetter: { title: 'La lettre de motivation fait partie du pass.', body: 'Vous la rédigez assortie au modèle de votre CV et la téléchargez en PDF.' },
    profiles: { title: 'D’autres versions sont incluses dans le pass.', body: 'Une version par poste ou par secteur, nouvelle ou en copie. Sans pass, vous avez une version. Vous pouvez toujours importer dans celle-ci.' },
    langs: { title: 'D’autres langues sont incluses dans le pass.', body: 'Le même CV en allemand, anglais, français et espagnol, avec les intitulés traduits. Sans pass, vous choisissez librement une langue.' },
  },
  unlockFreeNote: 'Le PDF de votre CV reste gratuit sans compte.',
  accountBody: 'Word, la lettre de motivation, d’autres versions et langues, ainsi que l’enregistrement sur plusieurs appareils, les liens de partage, les versions sur le serveur et la connexion IA.',
  features: {
    docx: { title: 'Word et LaTeX', body: 'Word avec le design de votre modèle et sur une colonne pour les portails, plus LaTeX à retravailler.' },
    coverLetter: { title: 'Lettre de motivation', body: 'Assortie au modèle de votre CV, avec PDF.' },
    profiles: { title: 'Plusieurs versions', body: 'Une par poste ou par secteur, aussi en copie d’une version existante.' },
    langs: { title: 'Quatre langues', body: 'Allemand, anglais, français et espagnol, avec les intitulés traduits.' },
  },
  pH1a: 'Le PDF de votre CV est gratuit.',
  pLede: 'Rédiger, mettre en forme, télécharger le PDF : sans compte et sans barrière au téléchargement. Le Pass candidature ajoute Word, la lettre de motivation, d’autres versions et langues, et tout ce qui demande un serveur.',
  freeList: n => [
    `Les ${n} modèles, couleurs et polices`,
    'PDF du CV, aussi en version ATS',
    'Une version dans la langue de votre choix',
    'Les données restent dans votre navigateur, avec un fichier de sauvegarde',
    'Import, contrôle ATS, export des données en JSON, Markdown et HTML',
  ],
  tableRows: (n, price, d) => [
    { label: `Les ${n} modèles, couleurs, polices`, free: true, pass: true },
    { label: 'PDF du CV, aussi en version ATS', free: true, pass: true },
    { label: 'Word, mis en forme et en version ATS', free: false, pass: true },
    { label: 'Lettre de motivation', free: false, pass: true },
    { label: 'Versions du CV', free: 'Une', pass: 'Plusieurs' },
    { label: 'Langues du CV', free: 'Une, au choix', pass: 'Les quatre' },
    { label: 'Import et export des données (JSON, Markdown, HTML)', free: true, pass: true },
    { label: 'Où sont vos données', free: 'Dans votre navigateur', pass: 'Sur le serveur' },
    { label: 'Versions', free: 'Dans le navigateur (20)', pass: 'Sur le serveur (25)' },
    { label: 'Enregistrement sur plusieurs appareils', free: 'Avec un fichier de sauvegarde', pass: true },
    { label: 'Liens de partage avec expiration, révocation et compteur', free: false, pass: true },
    { label: 'Connecter une IA via MCP', free: 'Passerelle Markdown', pass: true },
    { label: 'Clés API', free: false, pass: true },
    { label: 'Prix', free: '0 €', pass: `${price} en une fois, ${d} jours` },
  ],
  faqFree: { q: 'Qu’est-ce qui reste gratuit sans pass ?', a: 'L’éditeur avec tous les modèles, couleurs et polices, le PDF de votre CV (y compris la version ATS en PDF), une version dans la langue de votre choix, l’import et l’export des données en JSON, Markdown et HTML. Word, la lettre de motivation, d’autres versions et langues font partie du pass, et les boutons l’indiquent avant que vous ne commenciez. Quand votre pass prend fin, vous pouvez toujours tout exporter, Word compris.' },
  faqWhy: { q: 'Pourquoi est-ce payant ?', a: 'Le stockage, les liens de partage et la connexion IA tournent sur un serveur, et les modèles, l’export Word et la lettre de motivation demandent un travail continu. Le PDF de votre CV reste gratuit. Si vous ne voulez rien payer, hébergez vous-même la version open source : tout y est gratuit.' },
  selfHost: 'Vous préférez l’auto-hébergement ? Le code source est libre (AGPL), et votre propre instance n’a pas de limite.',
  selfHostLink: 'Voir le code source',
  landingH: p => `PDF gratuit. ${p} en une fois pour le pass.`,
  landingLede: 'Le CV, tous les modèles et le PDF sont gratuits sans compte. Le Pass candidature ajoute Word, la lettre de motivation, d’autres versions et langues, l’enregistrement sur plusieurs appareils, les liens de partage et la connexion IA.',
  landingFaqAccess: { q: 'Comment obtenir l\'accès ?', a: 'Vous pouvez essayer sans compte : l’éditeur, tous les modèles, la photo, l’import et le PDF de votre CV, et vos données restent dans votre navigateur. Word, la lettre de motivation, d’autres versions et langues font partie du Pass candidature, tout comme les liens de partage, les versions sur le serveur et la connexion IA via MCP. Le prix figure sur la page des tarifs avant que vous ne commenciez.' },
  clTitle: 'La lettre de motivation fait partie du Pass candidature.',
  clBody: 'Avec le pass, vous la rédigez ici assortie au modèle de votre CV et la téléchargez en PDF. Votre CV et son PDF restent gratuits.',
  clKeep: 'Retour au CV',
  langsLabel: 'Autres langues',
  profilesLabel: 'Autres versions',
  planNone: 'Votre compte est créé. Word, la lettre de motivation, d’autres versions et langues, l’enregistrement dans le compte, les liens de partage et la connexion IA viennent avec le Pass candidature. Le PDF de votre CV reste gratuit.',
};

const es: FreeTierStrings = {
  priceLine: (p, d) => `En el Pase de candidatura · ${p} pago único · ${d} días · sin suscripción`,
  inPass: 'en el Pase de candidatura',
  more: 'Más sobre el pase',
  unlock: {
    docx: { title: 'Word y LaTeX vienen con el pase.', body: 'Las dos versiones de Word, con el diseño de tu plantilla y a una columna para portales de empleo, y además el código LaTeX. La versión ATS en PDF y el YAML de RenderCV siguen siendo gratis.' },
    coverLetter: { title: 'La carta de presentación forma parte del pase.', body: 'La escribes a juego con la plantilla de tu CV y la descargas en PDF.' },
    profiles: { title: 'Más versiones vienen con el pase.', body: 'Una versión por puesto o sector, nueva o como copia. Sin pase tienes una versión. Puedes seguir importando en esa.' },
    langs: { title: 'Más idiomas vienen con el pase.', body: 'El mismo CV en alemán, inglés, francés y español, con los encabezados traducidos. Sin pase eliges un idioma libremente.' },
  },
  unlockFreeNote: 'El PDF de tu CV sigue siendo gratis sin cuenta.',
  accountBody: 'Word, la carta de presentación, más versiones e idiomas, además de guardar en varios dispositivos, enlaces compartidos, versiones en el servidor y la conexión con IA.',
  features: {
    docx: { title: 'Word y LaTeX', body: 'Word con el diseño de tu plantilla y a una columna para portales, y LaTeX para seguir editando.' },
    coverLetter: { title: 'Carta de presentación', body: 'A juego con la plantilla de tu CV, con PDF.' },
    profiles: { title: 'Varias versiones', body: 'Una por puesto o sector, también como copia de una existente.' },
    langs: { title: 'Cuatro idiomas', body: 'Alemán, inglés, francés y español, con los encabezados traducidos.' },
  },
  pH1a: 'El PDF de tu CV es gratis.',
  pLede: 'Escribir, diseñar, descargar el PDF: sin cuenta y sin barrera al descargar. El Pase de candidatura añade Word, la carta de presentación, más versiones e idiomas y todo lo que necesita un servidor.',
  freeList: n => [
    `Las ${n} plantillas, colores y fuentes`,
    'PDF del CV, también en versión ATS',
    'Una versión en el idioma que elijas',
    'Los datos se quedan en tu navegador, con archivo de copia',
    'Importación, chequeo ATS, exportación de datos en JSON, Markdown y HTML',
  ],
  tableRows: (n, price, d) => [
    { label: `Las ${n} plantillas, colores, fuentes`, free: true, pass: true },
    { label: 'PDF del CV, también en versión ATS', free: true, pass: true },
    { label: 'Word, con diseño y en versión ATS', free: false, pass: true },
    { label: 'Carta de presentación', free: false, pass: true },
    { label: 'Versiones del CV', free: 'Una', pass: 'Varias' },
    { label: 'Idiomas del CV', free: 'Uno, a elegir', pass: 'Los cuatro' },
    { label: 'Importación y exportación de datos (JSON, Markdown, HTML)', free: true, pass: true },
    { label: 'Dónde están tus datos', free: 'En tu navegador', pass: 'En el servidor' },
    { label: 'Versiones', free: 'En el navegador (20)', pass: 'En el servidor (25)' },
    { label: 'Guardar en varios dispositivos', free: 'Con archivo de copia', pass: true },
    { label: 'Enlaces compartidos con caducidad, revocación y recuento', free: false, pass: true },
    { label: 'Conectar IA por MCP', free: 'Puente Markdown', pass: true },
    { label: 'Claves API', free: false, pass: true },
    { label: 'Precio', free: '0 €', pass: `${price} pago único, ${d} días` },
  ],
  faqFree: { q: '¿Qué sigue siendo gratis sin pase?', a: 'El editor con todas las plantillas, colores y fuentes, el PDF de tu CV (también la versión ATS en PDF), una versión en el idioma que elijas, la importación y la exportación de datos en JSON, Markdown y HTML. Word, la carta de presentación, más versiones e idiomas forman parte del pase, y los botones lo dicen antes de que empieces. Cuando termina tu pase, puedes seguir exportándolo todo, Word incluido.' },
  faqWhy: { q: '¿Por qué cuesta algo?', a: 'El almacenamiento, los enlaces compartidos y la conexión con IA funcionan en un servidor, y las plantillas, la exportación a Word y la carta de presentación llevan trabajo continuo. El PDF de tu CV sigue siendo gratis. Si no quieres pagar nada, aloja tú mismo la versión de código abierto: allí todo es gratis.' },
  selfHost: '¿Prefieres alojarlo tú? El código fuente es libre (AGPL), y tu propia instancia no tiene límites.',
  selfHostLink: 'Ver el código fuente',
  landingH: p => `PDF gratis. ${p} pago único por el pase.`,
  landingLede: 'El CV, todas las plantillas y el PDF son gratis sin cuenta. El Pase de candidatura añade Word, la carta de presentación, más versiones e idiomas, guardar en varios dispositivos, enlaces compartidos y la conexión con IA.',
  landingFaqAccess: { q: '¿Cómo entro?', a: 'Puedes probarlo sin cuenta: el editor, todas las plantillas, la foto, la importación y el PDF de tu CV, y tus datos se quedan en tu navegador. Word, la carta de presentación, más versiones e idiomas forman parte del Pase de candidatura, igual que los enlaces compartidos, las versiones en el servidor y la conexión con IA por MCP. El precio está en la página de precios antes de empezar.' },
  clTitle: 'La carta de presentación forma parte del Pase de candidatura.',
  clBody: 'Con el pase la escribes aquí a juego con la plantilla de tu CV y la descargas en PDF. Tu CV y su PDF siguen siendo gratis.',
  clKeep: 'Volver al CV',
  langsLabel: 'Más idiomas',
  profilesLabel: 'Más versiones',
  planNone: 'Tu cuenta está creada. Word, la carta de presentación, más versiones e idiomas, guardar en la cuenta, los enlaces para compartir y la conexión con IA vienen con el Pase de candidatura. El PDF de tu CV sigue siendo gratis.',
};

export const FREETIER_I18N: Record<UiLang, FreeTierStrings> = { de, en, fr, es };
