/**
 * Texte zur Gratis-Grenze. Stand 10.10.2026, „Vorlagen-Staffel“
 * (optional, standardmäßig aus): Ohne Konto gratis sind das PDF in den kostenlosen
 * Vorlagen (templates/freeTemplates.ts, Zahl wird von dort gelesen) und die
 * ATS-Fassung als PDF in jeder Vorlage, dazu Schreiben, Gestalten und Prüfen
 * in allen Vorlagen und der Datenexport. Im Pass: gestaltetes PDF und HTML
 * der übrigen Vorlagen, Word, LaTeX, Anschreiben samt Prüfung, weitere
 * Fassungen und Sprachen, Sharelinks, Versionen am Server, MCP.
 * Die Texte gelten NUR, wenn der Server `freeTier.limited: true` meldet
 * (billing/freeTier.ts). Ohne Schalter bleiben die Texte aus billing.ts.
 * Keine „nie/immer/dauerhaft"-Zusagen; MCP heißt „Claude und andere
 * MCP-Programme", ChatGPT steht nur bei der Markdown-Brücke.
 *
 * Grundsatz wie in billing.ts: Der Preis steht da, bevor jemand anfängt, nicht
 * erst beim Herunterladen. Kein Countdown, keine Warnfarbe, keine erfundenen
 * Zahlen. Im Deutschen wird geduzt, im Französischen gesiezt, im Spanischen
 * geduzt.
 */
import type { UiLang } from '../i18n';
import { FREE_TEMPLATE_IDS } from '../../templates/freeTemplates';

/** Zahl der Vorlagen, deren gestaltetes PDF ohne Pass kostenlos ist. */
const FREE = FREE_TEMPLATE_IDS.length;

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
  /** Erster Punkt der Pass-Karte bei der Vorlagen-Staffel: alle Vorlagen als PDF.
   *  (PricingPage zeigt ihn, sobald der Patch dort übernommen ist.) */
  featureTemplates: (templates: number) => Item;
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
    coverLetter: { title: 'Das Anschreiben gehört zum Pass.', body: 'Du schreibst es passend zur Vorlage deines Lebenslaufs, prüfst es und lädst es als PDF herunter.' },
    profiles: { title: 'Weitere Fassungen gibt es mit dem Pass.', body: 'Eine Fassung je Stelle oder Branche, neu oder als Kopie. Ohne Pass bleibt es bei einer Fassung. Importieren kannst du weiterhin in diese eine.' },
    langs: { title: 'Weitere Sprachen gibt es mit dem Pass.', body: 'Derselbe Lebenslauf auf Deutsch, Englisch, Französisch und Spanisch, mit übersetzten Überschriften. Ohne Pass wählst du eine Sprache frei.' },
  },
  unlockFreeNote: 'Das PDF deines Lebenslaufs bleibt ohne Konto kostenlos, gestaltet in den kostenlosen Vorlagen und als ATS-Fassung in jeder Vorlage.',
  accountBody: 'Alle Vorlagen als PDF, Word, Anschreiben, weitere Fassungen und Sprachen, dazu Speichern über Geräte, Sharelinks, Versionen am Server und die direkte Verbindung zu Claude und anderen MCP-Programmen.',
  features: {
    docx: { title: 'Word und LaTeX', body: 'Word mit dem Design deiner Vorlage und einspaltig für Bewerbungsportale, dazu LaTeX zum Weiterbearbeiten.' },
    coverLetter: { title: 'Anschreiben', body: 'Passend zur Vorlage deines Lebenslaufs, mit Prüfung und PDF.' },
    profiles: { title: 'Mehrere Fassungen', body: 'Eine je Stelle oder Branche, auch als Kopie einer bestehenden.' },
    langs: { title: 'Vier Sprachen', body: 'Deutsch, Englisch, Französisch und Spanisch, mit übersetzten Überschriften.' },
  },
  featureTemplates: n => ({ title: `Alle ${n} Vorlagen als PDF`, body: `Gestaltet als PDF und HTML auch in den Vorlagen, die ohne Pass nur zum Ansehen da sind. Ohne Pass sind es ${FREE}.` }),
  pH1a: `Das PDF deines Lebenslaufs ist kostenlos, in ${FREE} Vorlagen und als ATS-Fassung.`,
  pLede: `Schreiben, alle Vorlagen ansehen und gestalten, prüfen: ohne Konto. Das PDF lädst du kostenlos in ${FREE} Vorlagen und als einspaltige ATS-Fassung in jeder Vorlage. Was zum Pass gehört, steht vor der Wahl an der Vorlage und am Knopf. Der Bewerbungs-Pass bringt die übrigen Vorlagen als PDF, Word, Anschreiben, weitere Fassungen und Sprachen und alles, was einen Server braucht.`,
  freeList: n => [
    `Alle ${n} Vorlagen ansehen und mit deinem Inhalt gestalten`,
    `PDF in ${FREE} Vorlagen, die ATS-Fassung als PDF in jeder Vorlage`,
    'Eine Fassung in einer Sprache deiner Wahl',
    'Daten bleiben in deinem Browser, mit Sicherungsdatei',
    'Import, ATS-Prüfung, Datenexport, Markdown-Brücke zu deiner KI',
  ],
  tableRows: (n, price, d) => [
    { label: `Alle ${n} Vorlagen ansehen und gestalten`, free: true, pass: true },
    { label: 'Gestaltetes PDF des Lebenslaufs', free: `In ${FREE} Vorlagen`, pass: `In allen ${n}` },
    { label: 'ATS-Fassung als PDF', free: 'In jeder Vorlage', pass: 'In jeder Vorlage' },
    { label: 'Word, gestaltet und als ATS-Fassung', free: false, pass: true },
    { label: 'LaTeX-Quelltext', free: false, pass: true },
    { label: 'Anschreiben samt Prüfung', free: false, pass: true },
    { label: 'Fassungen', free: 'Eine', pass: 'Mehrere' },
    { label: 'Sprachen des Lebenslaufs', free: 'Eine, frei wählbar', pass: 'Alle vier' },
    { label: 'Import und Datenexport (JSON, JSON Resume, Markdown, RenderCV)', free: true, pass: true },
    { label: 'Wo deine Daten liegen', free: 'In deinem Browser', pass: 'Auf dem Server' },
    { label: 'Versionen', free: 'Im Browser (20)', pass: 'Am Server (25)' },
    { label: 'Speichern über Geräte', free: 'Mit Sicherungsdatei', pass: true },
    { label: 'Sharelinks mit Ablauf, Widerruf und Aufrufzählung', free: false, pass: true },
    { label: 'KI verbinden', free: 'Markdown-Brücke', pass: 'Markdown-Brücke und MCP' },
    { label: 'API-Schlüssel', free: false, pass: true },
    { label: 'Preis', free: '0 €', pass: `${price} einmalig, ${d} Tage` },
  ],
  faqFree: { q: 'Was bleibt ohne Pass kostenlos?', a: `Der Editor mit allen Vorlagen, Farben und Schriften zum Ansehen und Gestalten, das PDF deines Lebenslaufs in ${FREE} Vorlagen, die ATS-Fassung als PDF in jeder Vorlage, eine Fassung in einer Sprache deiner Wahl, die Prüfung, die Markdown-Brücke zu deiner KI sowie Import und Datenexport als JSON, JSON Resume, Markdown und RenderCV-YAML. Das gestaltete PDF der übrigen Vorlagen, Word, LaTeX, Anschreiben, weitere Fassungen und Sprachen gehören zum Pass. Das steht an der Vorlage und am Knopf, bevor du anfängst, nicht erst beim Herunterladen. Läuft dein Pass ab, kannst du weiter alles exportieren, auch Word. Nach einem Widerruf gibt es deine Inhalte als Datenexport.` },
  faqWhy: { q: 'Warum kostet das überhaupt etwas?', a: `Speicher, Sharelinks und die MCP-Verbindung laufen auf einem Server, und an Vorlagen, Word-Export und Anschreiben steckt laufende Arbeit. Das PDF deines Lebenslaufs bleibt in ${FREE} Vorlagen und als ATS-Fassung kostenlos. Die quelloffene Fassung kannst du auch selbst betreiben, dort ist alles frei.` },
  selfHost: 'Lieber selbst hosten? Der Quellcode ist frei (AGPL), in deiner eigenen Instanz gibt es keine Grenze.',
  selfHostLink: 'Zum Quellcode',
  landingH: p => `PDF kostenlos in ${FREE} Vorlagen. ${p} einmalig für den Pass.`,
  landingLede: `Schreiben, alle Vorlagen ansehen und das PDF in ${FREE} Vorlagen sowie als ATS-Fassung in jeder Vorlage sind ohne Konto frei. Der Bewerbungs-Pass bringt die übrigen Vorlagen als PDF, Word, Anschreiben, weitere Fassungen und Sprachen, Speichern über Geräte, Sharelinks und die direkte Verbindung zu Claude und anderen MCP-Programmen.`,
  landingFaqAccess: { q: 'Wie komme ich rein?', a: `Ausprobieren geht ohne Konto: Editor, alle Vorlagen zum Ansehen und Gestalten, Foto, Import, die Markdown-Brücke zu deiner KI und das PDF deines Lebenslaufs in ${FREE} Vorlagen und als ATS-Fassung in jeder Vorlage. Deine Daten bleiben dabei in deinem Browser. Word, Anschreiben, weitere Fassungen und Sprachen gehören zum Bewerbungs-Pass, ebenso das gestaltete PDF der übrigen Vorlagen, Sharelinks, Versionen am Server und die KI-Anbindung per MCP. Den Preis siehst du vorher auf der Preisseite.` },
  clTitle: 'Das Anschreiben gehört zum Bewerbungs-Pass.',
  clBody: 'Mit dem Pass schreibst du es hier passend zur Vorlage deines Lebenslaufs, prüfst es und lädst es als PDF herunter. Das PDF deines Lebenslaufs bleibt in den kostenlosen Vorlagen und als ATS-Fassung frei.',
  clKeep: 'Zurück zum Lebenslauf',
  langsLabel: 'Weitere Sprachen',
  profilesLabel: 'Weitere Fassungen',
  planNone: 'Dein Konto ist angelegt. Alle Vorlagen als PDF, Word, Anschreiben, weitere Fassungen und Sprachen, Speichern im Konto, Sharelinks und die MCP-Verbindung gibt es mit dem Bewerbungs-Pass. Das PDF deines Lebenslaufs bleibt in den kostenlosen Vorlagen und als ATS-Fassung frei.',
};

const en: FreeTierStrings = {
  priceLine: (p, d) => `In the Application Pass · ${p} one-off · ${d} days · no subscription`,
  inPass: 'in the Application Pass',
  more: 'About the pass',
  unlock: {
    docx: { title: 'Word and LaTeX come with the pass.', body: 'Both Word versions, with your template’s design and single-column for application portals, plus the LaTeX source. The ATS version as PDF and RenderCV YAML stay free.' },
    coverLetter: { title: 'The cover letter is part of the pass.', body: 'You write it to match your résumé’s template, check it and download it as a PDF.' },
    profiles: { title: 'More versions come with the pass.', body: 'One version per job or industry, new or as a copy. Without the pass you have one version. You can still import into that one.' },
    langs: { title: 'More languages come with the pass.', body: 'The same résumé in German, English, French and Spanish, with translated headings. Without the pass you pick one language freely.' },
  },
  unlockFreeNote: 'The PDF of your résumé stays free without an account, designed in the free templates and as the ATS version in every template.',
  accountBody: 'All templates as PDF, Word, the cover letter, more versions and languages, plus saving across devices, share links, versions on the server and the direct connection to Claude and other MCP programs.',
  features: {
    docx: { title: 'Word and LaTeX', body: 'Word with your template’s design and single-column for application portals, plus LaTeX to keep editing.' },
    coverLetter: { title: 'Cover letter', body: 'Matching your résumé’s template, with check and PDF.' },
    profiles: { title: 'Several versions', body: 'One per job or industry, also as a copy of an existing one.' },
    langs: { title: 'Four languages', body: 'German, English, French and Spanish, with translated headings.' },
  },
  featureTemplates: n => ({ title: `All ${n} templates as PDF`, body: `Designed PDF and HTML also in the templates that are for viewing only without the pass. Without the pass there are ${FREE}.` }),
  pH1a: `The PDF of your résumé is free, in ${FREE} templates and as the ATS version.`,
  pLede: `Write, view and design with every template, check: without an account. You download the PDF for free in ${FREE} templates and as the one-column ATS version in every template. What belongs to the pass is marked on the template and the button before you choose. The Application Pass adds the other templates as PDF, Word, the cover letter, more versions and languages, and everything that needs a server.`,
  freeList: n => [
    `View all ${n} templates and design with your own content`,
    `PDF in ${FREE} templates, the ATS version as PDF in every template`,
    'One version in a language of your choice',
    'Data stays in your browser, with a backup file',
    'Import, ATS check, data export, Markdown bridge to your AI',
  ],
  tableRows: (n, price, d) => [
    { label: `View and design with all ${n} templates`, free: true, pass: true },
    { label: 'Designed PDF of your résumé', free: `In ${FREE} templates`, pass: `In all ${n}` },
    { label: 'ATS version as PDF', free: 'In every template', pass: 'In every template' },
    { label: 'Word, designed and as the ATS version', free: false, pass: true },
    { label: 'LaTeX source', free: false, pass: true },
    { label: 'Cover letter with check', free: false, pass: true },
    { label: 'Résumé versions', free: 'One', pass: 'Several' },
    { label: 'Résumé languages', free: 'One, your choice', pass: 'All four' },
    { label: 'Import and data export (JSON, JSON Resume, Markdown, RenderCV)', free: true, pass: true },
    { label: 'Where your data lives', free: 'In your browser', pass: 'On the server' },
    { label: 'Versions', free: 'In the browser (20)', pass: 'On the server (25)' },
    { label: 'Saving across devices', free: 'With a backup file', pass: true },
    { label: 'Share links with expiry, revocation and view count', free: false, pass: true },
    { label: 'Connect AI', free: 'Markdown bridge', pass: 'Markdown bridge and MCP' },
    { label: 'API keys', free: false, pass: true },
    { label: 'Price', free: '€0', pass: `${price} one-off, ${d} days` },
  ],
  faqFree: { q: 'What stays free without the pass?', a: `The editor with all templates, colours and fonts to view and design with, the PDF of your résumé in ${FREE} templates, the ATS version as PDF in every template, one version in a language of your choice, the check, the Markdown bridge to your AI, and import and data export as JSON, JSON Resume, Markdown and RenderCV YAML. The designed PDF of the other templates, Word, LaTeX, the cover letter, more versions and languages are part of the pass. The template and the button say so before you start, not only at download. When your pass ends, you can still export everything, Word included. After a withdrawal you get your content as a data export.` },
  faqWhy: { q: 'Why does it cost anything at all?', a: `Storage, share links and the MCP connection run on a server, and the templates, Word export and cover letter take ongoing work. The PDF of your résumé stays free in ${FREE} templates and as the ATS version. You can also run the open-source version yourself; everything is free there.` },
  selfHost: 'Prefer to self-host? The source code is free (AGPL), and your own instance has no limits.',
  selfHostLink: 'View the source',
  landingH: p => `PDF for free in ${FREE} templates. ${p} one-off for the pass.`,
  landingLede: `Writing, viewing every template and the PDF in ${FREE} templates and as the ATS version in every template are free without an account. The Application Pass adds the other templates as PDF, Word, the cover letter, more versions and languages, saving across devices, share links and the direct connection to Claude and other MCP programs.`,
  landingFaqAccess: { q: 'How do I get in?', a: `You can try it without an account: the editor, all templates to view and design with, photo, import, the Markdown bridge to your AI and the PDF of your résumé in ${FREE} templates and as the ATS version in every template. Your data stays in your browser. Word, the cover letter, more versions and languages are part of the Application Pass, as are the designed PDF of the other templates, share links, versions on the server and the AI connection via MCP. The price is on the pricing page before you start.` },
  clTitle: 'The cover letter is part of the Application Pass.',
  clBody: 'With the pass you write it here to match your résumé’s template, check it and download it as a PDF. The PDF of your résumé stays free in the free templates and as the ATS version.',
  clKeep: 'Back to the résumé',
  langsLabel: 'More languages',
  profilesLabel: 'More versions',
  planNone: 'Your account is set up. All templates as PDF, Word, the cover letter, more versions and languages, saving in the account, share links and the MCP connection come with the Application Pass. The PDF of your résumé stays free in the free templates and as the ATS version.',
};

const fr: FreeTierStrings = {
  priceLine: (p, d) => `Dans le Pass candidature · ${p} en une fois · ${d} jours · sans abonnement`,
  inPass: 'dans le Pass candidature',
  more: 'En savoir plus sur le pass',
  unlock: {
    docx: { title: 'Word et LaTeX sont inclus dans le pass.', body: 'Les deux versions Word, avec le design de votre modèle et sur une colonne pour les portails de candidature, plus la source LaTeX. La version ATS en PDF et le YAML RenderCV restent gratuits.' },
    coverLetter: { title: 'La lettre de motivation fait partie du pass.', body: 'Vous la rédigez assortie au modèle de votre CV, la vérifiez et la téléchargez en PDF.' },
    profiles: { title: 'D’autres versions sont incluses dans le pass.', body: 'Une version par poste ou par secteur, nouvelle ou en copie. Sans pass, vous avez une version. Vous pouvez toujours importer dans celle-ci.' },
    langs: { title: 'D’autres langues sont incluses dans le pass.', body: 'Le même CV en allemand, anglais, français et espagnol, avec les intitulés traduits. Sans pass, vous choisissez librement une langue.' },
  },
  unlockFreeNote: 'Le PDF de votre CV reste gratuit sans compte, mis en page dans les modèles gratuits et en version ATS dans chaque modèle.',
  accountBody: 'Tous les modèles en PDF, Word, la lettre de motivation, d’autres versions et langues, ainsi que l’enregistrement sur plusieurs appareils, les liens de partage, les versions sur le serveur et la connexion directe à Claude et à d’autres programmes MCP.',
  features: {
    docx: { title: 'Word et LaTeX', body: 'Word avec le design de votre modèle et sur une colonne pour les portails, plus LaTeX à retravailler.' },
    coverLetter: { title: 'Lettre de motivation', body: 'Assortie au modèle de votre CV, avec vérification et PDF.' },
    profiles: { title: 'Plusieurs versions', body: 'Une par poste ou par secteur, aussi en copie d’une version existante.' },
    langs: { title: 'Quatre langues', body: 'Allemand, anglais, français et espagnol, avec les intitulés traduits.' },
  },
  featureTemplates: n => ({ title: `Les ${n} modèles en PDF`, body: `PDF et HTML mis en page aussi dans les modèles qui, sans pass, ne servent qu’à la consultation. Sans pass, il y en a ${FREE}.` }),
  pH1a: `Le PDF de votre CV est gratuit, dans ${FREE} modèles et en version ATS.`,
  pLede: `Rédiger, consulter et mettre en forme avec chaque modèle, vérifier : sans compte. Vous téléchargez gratuitement le PDF dans ${FREE} modèles et en version ATS sur une colonne dans chaque modèle. Ce qui relève du pass est indiqué sur le modèle et sur le bouton avant votre choix. Le Pass candidature ajoute les autres modèles en PDF, Word, la lettre de motivation, d’autres versions et langues, et tout ce qui demande un serveur.`,
  freeList: n => [
    `Consulter les ${n} modèles et les mettre en forme avec votre contenu`,
    `PDF dans ${FREE} modèles, la version ATS en PDF dans chaque modèle`,
    'Une version dans la langue de votre choix',
    'Les données restent dans votre navigateur, avec un fichier de sauvegarde',
    'Import, contrôle ATS, export des données, passerelle Markdown vers votre IA',
  ],
  tableRows: (n, price, d) => [
    { label: `Consulter et mettre en forme les ${n} modèles`, free: true, pass: true },
    { label: 'PDF mis en page du CV', free: `Dans ${FREE} modèles`, pass: `Dans les ${n}` },
    { label: 'Version ATS en PDF', free: 'Dans chaque modèle', pass: 'Dans chaque modèle' },
    { label: 'Word, mis en forme et en version ATS', free: false, pass: true },
    { label: 'Source LaTeX', free: false, pass: true },
    { label: 'Lettre de motivation avec vérification', free: false, pass: true },
    { label: 'Versions du CV', free: 'Une', pass: 'Plusieurs' },
    { label: 'Langues du CV', free: 'Une, au choix', pass: 'Les quatre' },
    { label: 'Import et export des données (JSON, JSON Resume, Markdown, RenderCV)', free: true, pass: true },
    { label: 'Où sont vos données', free: 'Dans votre navigateur', pass: 'Sur le serveur' },
    { label: 'Versions', free: 'Dans le navigateur (20)', pass: 'Sur le serveur (25)' },
    { label: 'Enregistrement sur plusieurs appareils', free: 'Avec un fichier de sauvegarde', pass: true },
    { label: 'Liens de partage avec expiration, révocation et compteur', free: false, pass: true },
    { label: 'Connecter une IA', free: 'Passerelle Markdown', pass: 'Passerelle Markdown et MCP' },
    { label: 'Clés API', free: false, pass: true },
    { label: 'Prix', free: '0 €', pass: `${price} en une fois, ${d} jours` },
  ],
  faqFree: { q: 'Qu’est-ce qui reste gratuit sans pass ?', a: `L’éditeur avec tous les modèles, couleurs et polices pour consulter et mettre en forme, le PDF de votre CV dans ${FREE} modèles, la version ATS en PDF dans chaque modèle, une version dans la langue de votre choix, la vérification, la passerelle Markdown vers votre IA, ainsi que l’import et l’export des données en JSON, JSON Resume, Markdown et YAML RenderCV. Le PDF mis en page des autres modèles, Word, LaTeX, la lettre de motivation, d’autres versions et langues font partie du pass. Le modèle et le bouton l’indiquent avant que vous ne commenciez, pas seulement au téléchargement. Quand votre pass prend fin, vous pouvez toujours tout exporter, Word compris. Après une rétractation, vous recevez vos contenus sous forme d’export de données.` },
  faqWhy: { q: 'Pourquoi est-ce payant ?', a: `Le stockage, les liens de partage et la connexion MCP tournent sur un serveur, et les modèles, l’export Word et la lettre de motivation demandent un travail continu. Le PDF de votre CV reste gratuit dans ${FREE} modèles et en version ATS. Vous pouvez aussi héberger vous-même la version open source : tout y est gratuit.` },
  selfHost: 'Vous préférez l’auto-hébergement ? Le code source est libre (AGPL), et votre propre instance n’a pas de limite.',
  selfHostLink: 'Voir le code source',
  landingH: p => `PDF gratuit dans ${FREE} modèles. ${p} en une fois pour le pass.`,
  landingLede: `Rédiger, consulter chaque modèle et le PDF dans ${FREE} modèles ainsi qu’en version ATS dans chaque modèle sont gratuits sans compte. Le Pass candidature ajoute les autres modèles en PDF, Word, la lettre de motivation, d’autres versions et langues, l’enregistrement sur plusieurs appareils, les liens de partage et la connexion directe à Claude et à d’autres programmes MCP.`,
  landingFaqAccess: { q: 'Comment obtenir l\'accès ?', a: `Vous pouvez essayer sans compte : l’éditeur, tous les modèles à consulter et mettre en forme, la photo, l’import, la passerelle Markdown vers votre IA et le PDF de votre CV dans ${FREE} modèles et en version ATS dans chaque modèle. Vos données restent dans votre navigateur. Word, la lettre de motivation, d’autres versions et langues font partie du Pass candidature, tout comme le PDF mis en page des autres modèles, les liens de partage, les versions sur le serveur et la connexion IA via MCP. Le prix figure sur la page des tarifs avant que vous ne commenciez.` },
  clTitle: 'La lettre de motivation fait partie du Pass candidature.',
  clBody: 'Avec le pass, vous la rédigez ici assortie au modèle de votre CV, la vérifiez et la téléchargez en PDF. Le PDF de votre CV reste gratuit dans les modèles gratuits et en version ATS.',
  clKeep: 'Retour au CV',
  langsLabel: 'Autres langues',
  profilesLabel: 'Autres versions',
  planNone: 'Votre compte est créé. Tous les modèles en PDF, Word, la lettre de motivation, d’autres versions et langues, l’enregistrement dans le compte, les liens de partage et la connexion MCP viennent avec le Pass candidature. Le PDF de votre CV reste gratuit dans les modèles gratuits et en version ATS.',
};

const es: FreeTierStrings = {
  priceLine: (p, d) => `En el Pase de candidatura · ${p} pago único · ${d} días · sin suscripción`,
  inPass: 'en el Pase de candidatura',
  more: 'Más sobre el pase',
  unlock: {
    docx: { title: 'Word y LaTeX vienen con el pase.', body: 'Las dos versiones de Word, con el diseño de tu plantilla y a una columna para portales de empleo, y además el código LaTeX. La versión ATS en PDF y el YAML de RenderCV siguen siendo gratis.' },
    coverLetter: { title: 'La carta de presentación forma parte del pase.', body: 'La escribes a juego con la plantilla de tu CV, la compruebas y la descargas en PDF.' },
    profiles: { title: 'Más versiones vienen con el pase.', body: 'Una versión por puesto o sector, nueva o como copia. Sin pase tienes una versión. Puedes seguir importando en esa.' },
    langs: { title: 'Más idiomas vienen con el pase.', body: 'El mismo CV en alemán, inglés, francés y español, con los encabezados traducidos. Sin pase eliges un idioma libremente.' },
  },
  unlockFreeNote: 'El PDF de tu CV sigue siendo gratis sin cuenta, con diseño en las plantillas gratuitas y como versión ATS en cada plantilla.',
  accountBody: 'Todas las plantillas en PDF, Word, la carta de presentación, más versiones e idiomas, además de guardar en varios dispositivos, enlaces compartidos, versiones en el servidor y la conexión directa con Claude y otros programas MCP.',
  features: {
    docx: { title: 'Word y LaTeX', body: 'Word con el diseño de tu plantilla y a una columna para portales, y LaTeX para seguir editando.' },
    coverLetter: { title: 'Carta de presentación', body: 'A juego con la plantilla de tu CV, con comprobación y PDF.' },
    profiles: { title: 'Varias versiones', body: 'Una por puesto o sector, también como copia de una existente.' },
    langs: { title: 'Cuatro idiomas', body: 'Alemán, inglés, francés y español, con los encabezados traducidos.' },
  },
  featureTemplates: n => ({ title: `Las ${n} plantillas en PDF`, body: `PDF y HTML con diseño también en las plantillas que sin pase solo sirven para verlas. Sin pase son ${FREE}.` }),
  pH1a: `El PDF de tu CV es gratis, en ${FREE} plantillas y como versión ATS.`,
  pLede: `Escribir, ver y diseñar con cada plantilla, comprobar: sin cuenta. Descargas el PDF gratis en ${FREE} plantillas y como versión ATS a una columna en cada plantilla. Lo que forma parte del pase se indica en la plantilla y en el botón antes de elegir. El Pase de candidatura añade las demás plantillas en PDF, Word, la carta de presentación, más versiones e idiomas y todo lo que necesita un servidor.`,
  freeList: n => [
    `Ver las ${n} plantillas y diseñar con tu propio contenido`,
    `PDF en ${FREE} plantillas, la versión ATS en PDF en cada plantilla`,
    'Una versión en el idioma que elijas',
    'Los datos se quedan en tu navegador, con archivo de copia',
    'Importación, chequeo ATS, exportación de datos, puente Markdown a tu IA',
  ],
  tableRows: (n, price, d) => [
    { label: `Ver y diseñar con las ${n} plantillas`, free: true, pass: true },
    { label: 'PDF con diseño del CV', free: `En ${FREE} plantillas`, pass: `En las ${n}` },
    { label: 'Versión ATS en PDF', free: 'En cada plantilla', pass: 'En cada plantilla' },
    { label: 'Word, con diseño y en versión ATS', free: false, pass: true },
    { label: 'Código LaTeX', free: false, pass: true },
    { label: 'Carta de presentación con comprobación', free: false, pass: true },
    { label: 'Versiones del CV', free: 'Una', pass: 'Varias' },
    { label: 'Idiomas del CV', free: 'Uno, a elegir', pass: 'Los cuatro' },
    { label: 'Importación y exportación de datos (JSON, JSON Resume, Markdown, RenderCV)', free: true, pass: true },
    { label: 'Dónde están tus datos', free: 'En tu navegador', pass: 'En el servidor' },
    { label: 'Versiones', free: 'En el navegador (20)', pass: 'En el servidor (25)' },
    { label: 'Guardar en varios dispositivos', free: 'Con archivo de copia', pass: true },
    { label: 'Enlaces compartidos con caducidad, revocación y recuento', free: false, pass: true },
    { label: 'Conectar IA', free: 'Puente Markdown', pass: 'Puente Markdown y MCP' },
    { label: 'Claves API', free: false, pass: true },
    { label: 'Precio', free: '0 €', pass: `${price} pago único, ${d} días` },
  ],
  faqFree: { q: '¿Qué sigue siendo gratis sin pase?', a: `El editor con todas las plantillas, colores y fuentes para ver y diseñar, el PDF de tu CV en ${FREE} plantillas, la versión ATS en PDF en cada plantilla, una versión en el idioma que elijas, la comprobación, el puente Markdown a tu IA y la importación y exportación de datos en JSON, JSON Resume, Markdown y YAML de RenderCV. El PDF con diseño de las demás plantillas, Word, LaTeX, la carta de presentación, más versiones e idiomas forman parte del pase. La plantilla y el botón lo indican antes de que empieces, no solo al descargar. Cuando termina tu pase, puedes seguir exportándolo todo, Word incluido. Tras un desistimiento recibes tus contenidos como exportación de datos.` },
  faqWhy: { q: '¿Por qué cuesta algo?', a: `El almacenamiento, los enlaces compartidos y la conexión MCP funcionan en un servidor, y las plantillas, la exportación a Word y la carta de presentación llevan trabajo continuo. El PDF de tu CV sigue siendo gratis en ${FREE} plantillas y como versión ATS. También puedes alojar tú mismo la versión de código abierto: allí todo es gratis.` },
  selfHost: '¿Prefieres alojarlo tú? El código fuente es libre (AGPL), y tu propia instancia no tiene límites.',
  selfHostLink: 'Ver el código fuente',
  landingH: p => `PDF gratis en ${FREE} plantillas. ${p} pago único por el pase.`,
  landingLede: `Escribir, ver cada plantilla y el PDF en ${FREE} plantillas y como versión ATS en cada plantilla son gratis sin cuenta. El Pase de candidatura añade las demás plantillas en PDF, Word, la carta de presentación, más versiones e idiomas, guardar en varios dispositivos, enlaces compartidos y la conexión directa con Claude y otros programas MCP.`,
  landingFaqAccess: { q: '¿Cómo entro?', a: `Puedes probarlo sin cuenta: el editor, todas las plantillas para ver y diseñar, la foto, la importación, el puente Markdown a tu IA y el PDF de tu CV en ${FREE} plantillas y como versión ATS en cada plantilla. Tus datos se quedan en tu navegador. Word, la carta de presentación, más versiones e idiomas forman parte del Pase de candidatura, igual que el PDF con diseño de las demás plantillas, los enlaces compartidos, las versiones en el servidor y la conexión con IA por MCP. El precio está en la página de precios antes de empezar.` },
  clTitle: 'La carta de presentación forma parte del Pase de candidatura.',
  clBody: 'Con el pase la escribes aquí a juego con la plantilla de tu CV, la compruebas y la descargas en PDF. El PDF de tu CV sigue siendo gratis en las plantillas gratuitas y como versión ATS.',
  clKeep: 'Volver al CV',
  langsLabel: 'Más idiomas',
  profilesLabel: 'Más versiones',
  planNone: 'Tu cuenta está creada. Todas las plantillas en PDF, Word, la carta de presentación, más versiones e idiomas, guardar en la cuenta, los enlaces para compartir y la conexión MCP vienen con el Pase de candidatura. El PDF de tu CV sigue siendo gratis en las plantillas gratuitas y como versión ATS.',
};

export const FREETIER_I18N: Record<UiLang, FreeTierStrings> = { de, en, fr, es };
