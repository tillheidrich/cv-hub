/**
 * Texte der Startseite in den vier Oberflächensprachen.
 *
 * Regeln (Runde 8, 10.10.2026): Stimmstufe Unternehmen,
 * Du-Form wie in der App, auf Französisch „vous". Keine Namen anderer
 * Anbieter, keine Siegel wie „ATS-sicher", keine Nutzerzahlen, keine
 * erfundenen Zahlen. Jede Zahl auf der Seite kommt aus dem Code
 * (Vorlagenzahl aus PICKABLE_THEMES, Preis aus dem Angebot des Servers) oder
 * aus einer Quelle, die daneben steht.
 *
 * Die FAQ-Antworten stehen auch im strukturierten Datenblock (FAQPage) der
 * vorgerenderten Seite; beides kommt aus faqItems() unten, damit sichtbarer
 * Text und JSON-LD nie auseinanderlaufen.
 */
import type { UiLang } from '../ui/i18n';

export interface Problem { title: string; body: string; src: string }
export interface Feature { id: 'editor' | 'design' | 'check' | 'export' | 'phone' | 'bridge' | 'open'; tag: string; title: string; body: string; alt: string }
export interface Qa { q: string; a: string }
/** Platzhalter in FAQ-Texten: {brand}, {n}, {price}, {days}. */
export interface FaqDef { id: string; q: string; a: string; aOpen?: string; aNoOffer?: string; /** Fassung bei aktiver Gratis-Grenze (Pass). */ aLimited?: string }

export interface LandingCopy {
  meta: { title: (n: number) => string; description: (n: number) => string; ogAlt: string };
  langName: string;
  langHint: string;
  langHintLink: string;
  skip: string;
  nav: { label: string; ats: string; templates: string; features: string; magazin: string; faq: string; signin: string; cta: string; source: string; home: string; lang: string; menu: string; close: string };
  hero: { eyebrow: string; h1a: string; h1b: string; lede: string; ctaPrimary: string; ctaSecondary: string; proof: string[]; shotAlt: string; chipText: string; chipAts: string };
  facts: { label: string; items: (n: number) => { value: string; label: string }[] };
  ats: {
    eyebrow: string; h: string; intro: string;
    oursTitle: string; oursSub: (template: string) => string; oursFoot: string; lineLabel: string;
    layoutTitle: string; layoutSub: string; layoutFoot: string; sideLabel: string;
    problemsTitle: string; problemsSub: string; problems: Problem[]; schemaNote: string;
    marksTitle: string; marks: { high: string; medium: string; low: string }; marksFoot: string;
    honestTitle: string; honest: string; scriptsLink: string;
    sourcesLabel: string; sources: { label: string; url: string }[];
  };
  gallery: { eyebrow: string; h: (n: number) => string; lede: string; showAll: (n: number) => string; legend: string };
  features: { eyebrow: string; h: string; items: Feature[]; bridgeCaption: string };
  magazin: { eyebrow: string; h: string; lede: string; all: string; minutes: (n: number) => string };
  faq: { eyebrow: string; h: string; items: FaqDef[] };
  closing: { h1: string; h2: string; lede: string; ctaSecondary: string };
  footer: { meta: string; imprint: string; privacy: string; product: string; legal: string };
  request: {
    title: string; lede: string; name: string; email: string; message: string; messagePlaceholder: string;
    submit: string; sending: string; successTitle: string; success: string; close: string;
    errName: string; errEmail: string; errGeneric: string;
  };
}

const SRC_PERSONIO = 'https://support.personio.de/hc/en-us/articles/360010193018';
const SRC_GREENHOUSE = 'https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse';
const SRC_TEXTKERNEL = 'https://www.textkernel.com/learn-support/blog/improving-extraction-from-column-resumes/';
const SRC_HBS = 'https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx';

const DE: LandingCopy = {
  meta: {
    title: () => 'Lebenslauf erstellen, maschinenlesbar gesetzt',
    description: n => `Lebenslauf im Browser schreiben: ${n} Vorlagen, PDF mit echter Textebene, ATS-Fassung als PDF oder Word mit einem Klick, vier Sprachen. Ohne Konto, kein Abo.`,
    ogAlt: 'Der Editor mit einem Lebenslauf in der Vorschau und dem Gestaltungs-Paneel',
  },
  langName: 'Deutsch',
  langHint: 'Diese Seite gibt es auch auf Deutsch.',
  langHintLink: 'Auf Deutsch lesen',
  skip: 'Zum Inhalt springen',
  nav: { label: 'Hauptnavigation', ats: 'So liest ein ATS', templates: 'Vorlagen', features: 'Funktionen', magazin: 'Magazin', faq: 'Fragen', signin: 'Anmelden', cta: 'Zugang anfragen', source: 'Quelltext', home: 'Startseite', lang: 'Sprache der Seite', menu: 'Menü', close: 'Menü schließen' },
  hero: {
    eyebrow: 'Lebenslauf und Anschreiben im Browser',
    h1a: 'Dein Lebenslauf,',
    h1b: 'maschinenlesbar gesetzt.',
    lede: 'Was du in der Vorschau siehst, ist das PDF, das du herunterlädst. Es hat eine echte Textebene, und darin steht dein Lebenslauf in der Reihenfolge, in der man ihn liest. Für Bewerbungsportale gibt es dieselbe Fassung einspaltig als PDF oder Word, mit einem Klick.',
    ctaPrimary: 'Direkt ausprobieren',
    ctaSecondary: 'So liest ein Portal deinen Lebenslauf',
    proof: ['Ohne Konto starten', 'Gespeichert in deinem Browser', 'Kein Abo', 'Quelloffene Fassung'],
    shotAlt: 'Der Editor in der Demo: links das Gestaltungs-Paneel mit Vorlagen, in der Mitte der Lebenslauf von Lena Brandt, unten das Karussell mit der Marke der Vorlage',
    chipText: 'PDF mit Textebene',
    chipAts: 'ATS-Fassung mit einem Klick',
  },
  facts: {
    label: 'Auf einen Blick',
    items: n => [
      { value: String(n), label: 'Vorlagen, einspaltig, mit Kopfband oder Seitenspalte' },
      { value: '4', label: 'Sprachen für Dokument und Oberfläche' },
      { value: '1 Klick', label: 'zur ATS-Fassung als PDF oder Word' },
      { value: '0', label: 'Werbe-Tracker, keine Cookies zum Zählen' },
    ],
  },
  ats: {
    eyebrow: 'Was ein Bewerbungsportal sieht',
    h: 'So liest ein Bewerbermanagement-System deinen Lebenslauf',
    intro: 'Ein Bewerbermanagement-System (englisch Applicant Tracking System, kurz ATS) liest dein PDF nicht wie ein Mensch. Es holt den Text aus der Datei, je nach Programm in der Reihenfolge, in der er dort gespeichert ist, oder nach seiner Lage auf der Seite, und verteilt ihn auf Felder wie Name, Stationen und Kenntnisse. Was nur als Bild in der Datei steckt, kommt dabei gar nicht an.',
    oursTitle: 'Gespeicherte Reihenfolge',
    oursSub: t => `Demo-Lebenslauf in der Vorlage ${t} mit Seitenspalte, ausgelesen mit pdftotext -raw: der Text in der Reihenfolge, in der er im PDF steht.`,
    oursFoot: 'Name, Profil, Stationen, danach die Seitenspalte. Ein Parser, der dieser Reihenfolge folgt, bekommt den Lebenslauf am Stück.',
    layoutTitle: 'Dieselbe Seite, nach Lage gelesen',
    layoutSub: 'Ausgelesen mit pdftotext ohne -raw: Das Programm setzt die Reihenfolge aus der Position auf der Seite zusammen, wie Parser mit eigener Layoutanalyse.',
    layoutFoot: 'Zeilen aus der Seitenspalte rutschen zwischen die Stationen. Welche Lesart ein Portal benutzt, siehst du von außen nicht. Deshalb gibt es zu jeder Vorlage die einspaltige ATS-Fassung.',
    sideLabel: 'aus der Seitenspalte',
    lineLabel: 'Zeile',
    problemsTitle: 'Typische Fehler gestalteter PDFs',
    problemsSub: 'Was Hersteller von Bewerbungssoftware in ihren Hilfeseiten als Ursache für Lesefehler nennen.',
    problems: [
      { title: 'Spalten werden vermischt', body: 'Liegen zwei Spalten in der Datei zeilenweise nebeneinander, landen Kontaktdaten und Berufserfahrung im selben Satz.', src: 'Personio, Greenhouse' },
      { title: 'Text als Bild', body: 'Überschriften als Grafik, Skill-Balken ohne Text oder ganze Seiten als Bild haben keine Textebene. Der Parser findet dort nichts.', src: 'Greenhouse' },
      { title: 'Gesperrte Versalien zerfallen', body: 'Ab etwa 0,10 em Sperrung wird aus OBSERVABILITY in der Textausgabe „O B S E R VA B I L I T Y“. An genau solchen Zeilen trennt ein Parser die Abschnitte.', src: 'Personio, eigene Messung' },
      { title: 'Kopfzeile, Tabelle, Textbox', body: 'Kontaktdaten in der Kopfzeile, in Tabellenzellen oder Textboxen lesen manche Systeme gar nicht oder in falscher Reihenfolge.', src: 'Personio, Greenhouse' },
    ],
    schemaNote: 'Schema nach Herstellerhilfen und eigener Messung, kein Mitschnitt eines bestimmten Programms.',
    marksTitle: 'Was die Marken an den Vorlagen bedeuten',
    marks: {
      high: 'Eine Spalte, lineare Lesereihenfolge. Die Form, die Portale zuverlässig in Felder überführen.',
      medium: 'Kopfband im normalen Textfluss, danach eine Spalte. Portale lesen das meist richtig.',
      low: 'Zwei Spalten für Menschen, die das PDF per Mail oder auf Papier lesen. Für Portale lädst du dieselbe Fassung einspaltig.',
    },
    marksFoot: 'Zu jeder Vorlage gibt es die ATS-Fassung: derselbe Inhalt einspaltig, als PDF oder Word, ohne dass sich an deinem Profil etwas ändert.',
    honestTitle: 'Was wir prüfen und was nicht',
    honest: 'Prüfskripte im Quelltext drucken jede Vorlage als PDF, lesen die Textebene wieder aus und vergleichen sie Seite für Seite mit der Vorschau: Text, Lesereihenfolge, Wortgrenzen, Trennstriche. Wie ein bestimmtes System liest, hängt auch von dessen Parser ab, und ob dich ein Unternehmen einlädt, entscheidet kein Layout.',
    scriptsLink: 'Prüfskripte ansehen',
    sourcesLabel: 'Quellen',
    sources: [
      { label: 'Personio: CV parsing for candidate profiles', url: SRC_PERSONIO },
      { label: 'Greenhouse: Unsuccessful resume parse', url: SRC_GREENHOUSE },
      { label: 'Textkernel: Extraktion aus Spalten-Lebensläufen (2023)', url: SRC_TEXTKERNEL },
      { label: 'Harvard Business School und Accenture: Hidden Workers (2021)', url: SRC_HBS },
    ],
  },
  gallery: {
    eyebrow: 'Vorlagen',
    h: n => `${n} Vorlagen. Dein Inhalt bleibt beim Wechsel.`,
    lede: 'Einspaltig, mit Kopfband oder mit Seitenspalte, jede mit eigener Schriftpaarung. Die Marke an jeder Vorlage sagt, ob sie für Bewerbungsportale gemacht ist oder für Mail und Druck.',
    showAll: n => `Alle ${n} Vorlagen zeigen`,
    legend: 'Gezeigt mit dem Demo-Lebenslauf, so wie die Vorlage im Werkzeug aussieht.',
  },
  features: {
    eyebrow: 'Funktionen',
    h: 'Gebaut für Bewerbungen, die auch eine Software lesen muss.',
    items: [
      { id: 'editor', tag: 'Schreiben', title: 'Du schreibst direkt auf der Seite.', body: 'Klick in den Text und tipp. Enter legt den nächsten Stichpunkt an, Ränder und Seitenumbrüche regelt der Satz, auf bis zu vier Seiten. Wer lieber im Formular arbeitet, findet alle Felder im Inhalt-Paneel. Frei platzierbare Textkästen gibt es bewusst nicht, weil genau die beim Auslesen durcheinandergeraten.', alt: 'Das Inhalt-Paneel mit den Feldern des Lebenslaufs neben der Vorschau' },
      { id: 'design', tag: 'Gestalten', title: 'Blättern mit deinem eigenen Inhalt.', body: 'Im Gestaltungs-Paneel und im Karussell unter der Seite siehst du jede Vorlage gleich mit deinem Text. Akzentfarbe, Papier und Schrift wählst du getrennt davon, und jede Farbkombination ist auf Kontrast geprüft.', alt: 'Das Gestaltungs-Paneel mit Vorlagenkarten und ihren Marken' },
      { id: 'check', tag: 'Prüfen', title: 'Lebenslauf und Anschreiben, so wie ein Parser sie liest.', body: 'Das Prüfen-Paneel zeigt den Text in der Reihenfolge, in der ein System ihn liest, und meldet Lücken wie eine fehlende E-Mail-Adresse oder eine Station ohne Startdatum. Beim Anschreiben kommen Betreff, Datum, Anrede und Länge dazu, und beide Unterlagen zusammen prüfst du auf denselben Namen, denselben Kontakt und dieselbe Sprache. Mit einer Stellenanzeige daneben siehst du, welche Begriffe vorkommen und welche fehlen.', alt: 'Das Prüfen-Paneel mit der Textansicht des Lebenslaufs' },
      { id: 'export', tag: 'Exportieren', title: 'PDF, Word und die Fassung für Portale.', body: 'Das PDF hat genau die Seiten der Vorschau. Word gibt es mit dem Design deiner Vorlage und einspaltig ohne Tabellen. Die ATS-Fassung setzt denselben Inhalt einspaltig, als PDF oder Word, ohne dass sich an deinem Profil etwas ändert. Dazu kommen LaTeX zum Weiterbearbeiten und RenderCV-YAML, das du auch wieder einlesen kannst.', alt: 'Das Export-Menü mit PDF, Word und der ATS-Fassung' },
      { id: 'phone', tag: 'Telefon', title: 'Auf dem Telefon genauso.', body: 'Auf dem Telefon startest du im Dokument. Inhalt, Gestaltung, Prüfen und Export liegen in der Leiste unten, und das PDF ist dasselbe wie am Schreibtisch.', alt: 'Der Editor auf dem Telefon mit der Leiste am unteren Rand' },
      { id: 'bridge', tag: 'KI-Brücke', title: 'Deine KI schreibt mit, das Werkzeug setzt.', body: 'Eine eingebaute KI gibt es nicht. Du gibst den Lebenslauf als Markdown an ChatGPT, Claude oder ein anderes Modell und importierst die überarbeitete Fassung. Vor dem Übernehmen zeigt das Werkzeug jede Änderung. Mit Konto verbindet sich ein KI-Assistent direkt über einen MCP-Server.', alt: '' },
      { id: 'open', tag: 'Offen', title: 'Ohne Konto, ohne Abo, quelloffen.', body: 'Ohne Konto bleibt alles in deinem Browser, eine Sicherungsdatei nimmst du mit. Den LinkedIn-Datenexport liest das Werkzeug ebenfalls im Browser ein. Der Quelltext steht unter AGPL-3.0 öffentlich, und wer will, betreibt das Werkzeug auf dem eigenen Server.', alt: '' },
    ],
    bridgeCaption: 'Ausschnitt aus dem Markdown-Export',
  },
  magazin: {
    eyebrow: 'Magazin',
    h: 'Bewerbung und Portale, mit Quellen erklärt',
    lede: 'Anleitungen zu Lebenslauf, Anschreiben und Bewerbungsportalen. Wo eine Zahl steht, steht die Quelle dabei.',
    all: 'Alle Artikel im Magazin',
    minutes: n => `${n} Min.`,
  },
  faq: {
    eyebrow: 'Fragen',
    h: 'Häufige Fragen',
    items: [
      { id: 'what', q: 'Was ist {brand}?', a: '{brand} ist ein Werkzeug für Lebenslauf und Anschreiben im Browser. Du schreibst direkt in der Vorschau, wählst aus {n} Vorlagen und lädst ein PDF mit echter Textebene herunter. Für Bewerbungsportale gibt es dieselbe Fassung einspaltig als PDF oder Word. Starten geht ohne Konto.' },
      { id: 'machine', q: 'Was heißt maschinenlesbar?', a: 'Ein Programm kann den Text aus deinem PDF vollständig und in der richtigen Reihenfolge herausholen: erst Name und Kontakt, dann Profil, Stationen und Kenntnisse. Dafür braucht das PDF eine echte Textebene statt eines Bildes, und die Reihenfolge darin muss stimmen. Beides prüfen hier Skripte bei jeder Vorlage.' },
      { id: 'ats', q: 'Was ist ein ATS?', a: 'Ein Applicant Tracking System, auf Deutsch Bewerbermanagement-System, nimmt Bewerbungen für Arbeitgeber entgegen. Es liest den Lebenslauf aus, legt Name, Stationen und Kenntnisse als Felder an und hilft beim Sortieren. Automatische Absagen beschreibt etwa Greenhouse in seiner Hilfe nur für Ausschlussfragen, die der Arbeitgeber im Formular anlegt, zum Beispiel nach der Arbeitserlaubnis. Den Lebenslauf lesen Menschen.' },
      { id: 'safe', q: 'Ist mein Lebenslauf damit ATS-tauglich?', a: 'Eine Garantie kann niemand geben, weil jedes System seinen eigenen Parser hat. Was sich prüfen lässt, prüfen wir: Textebene vorhanden, Reihenfolge wie in der Vorschau, keine zerfallenen Wörter, keine eingefügten Trennstriche. Für Portale nimmst du die einspaltige ATS-Fassung. Ob du eingeladen wirst, entscheidet der Inhalt.' },
      { id: 'access', q: 'Brauche ich ein Konto?', a: 'Nein. Ohne Konto hast du den Editor, alle Vorlagen und alle Exporte, und deine Daten bleiben dabei in deinem Browser. Ein Konto bringt Speichern über Geräte, Sharelinks, Versionen am Server und die KI-Anbindung per MCP. Konten gibt es vorerst mit Einladung: Du fragst an und bekommst einen Link per E-Mail.', aOpen: 'Nein. Ohne Konto hast du den Editor, alle Vorlagen und alle Exporte, und deine Daten bleiben dabei in deinem Browser. Ein Konto bringt Speichern über Geräte, Sharelinks, Versionen am Server und die KI-Anbindung per MCP. Es gehört zum Bewerbungs-Pass, den Preis siehst du vorher.' },
      { id: 'price', q: 'Was kostet das?', a: 'Im Browser ist das Werkzeug kostenlos, das PDF deines Lebenslaufs auch. Der Bewerbungs-Pass kostet {price} einmalig für {days} Tage. Er ist kein Abo und endet von selbst.', aNoOffer: 'Das Werkzeug ist quelloffen. Wer es selbst betreibt, zahlt dafür nichts und legt die Grenzen selbst fest.' },
      { id: 'formats', q: 'Welche Formate kann ich exportieren?', a: 'PDF mit echter Textebene, Word in zwei Fassungen (mit dem Design deiner Vorlage und einspaltig für Portale), dazu HTML, JSON, JSON Resume, Markdown, LaTeX (.tex) und RenderCV-YAML. Die ATS-Fassung gibt es als PDF und als Word. RenderCV-YAML liest das Werkzeug auch wieder ein, eine .tex-Datei dann, wenn sie von hier stammt.', aLimited: 'PDF mit echter Textebene, auch als einspaltige ATS-Fassung, dazu HTML, JSON, JSON Resume, Markdown und RenderCV-YAML. Word in zwei Fassungen (mit dem Design deiner Vorlage und einspaltig für Portale) und LaTeX (.tex) gehören zum Bewerbungs-Pass. RenderCV-YAML liest das Werkzeug auch wieder ein, eine .tex-Datei dann, wenn sie von hier stammt.' },
      { id: 'pages', q: 'Wie viele Seiten kann mein Lebenslauf haben?', a: 'Bis zu vier. Du stellst eine bis vier Seiten ein oder lässt den Satz selbst umbrechen. In Deutschland sind ein bis zwei Seiten üblich, in Wissenschaft und Technik mit Publikationen oder Projektliste auch mehr. Ab der dritten Seite steht unter „Prüfen“ ein Hinweis dazu.' },
      { id: 'check', q: 'Kann ich auch das Anschreiben prüfen?', a: 'Ja. Das Prüfen-Paneel liest Lebenslauf und Anschreiben so, wie sie im PDF stehen. Beim Anschreiben achtet es auf Betreff, Datum, Anrede, Länge und vergessene Platzhalter, mit einer Stellenanzeige auch darauf, ob Stellentitel und Firma vorkommen. Unter „Beides“ vergleicht es Name, Kontakt und Sprache der beiden Unterlagen und zeigt, welche Begriffe der Anzeige wo stehen. Eine Punktzahl gibt es absichtlich nicht.', aLimited: 'Ja, mit dem Bewerbungs-Pass, zu dem auch das Anschreiben gehört. Das Prüfen-Paneel liest Lebenslauf und Anschreiben so, wie sie im PDF stehen. Beim Anschreiben achtet es auf Betreff, Datum, Anrede, Länge und vergessene Platzhalter, mit einer Stellenanzeige auch darauf, ob Stellentitel und Firma vorkommen. Unter „Beides“ vergleicht es Name, Kontakt und Sprache der beiden Unterlagen. Den Lebenslauf prüfst du ohne Pass.' },
      { id: 'langs', q: 'In welchen Sprachen gibt es das Werkzeug?', a: 'Lebenslauf, Anschreiben und Oberfläche gibt es auf Deutsch, Englisch, Französisch und Spanisch. Überschriften, Datumsformate und Feldnamen stellen sich mit der Sprache um, und alle vier Fassungen leben im selben Profil.' },
      { id: 'ai', q: 'Kann ich eine KI verwenden?', a: 'Ja, aber keine eingebaute. Du exportierst den Lebenslauf als Markdown, lässt ihn von einem Sprachmodell deiner Wahl überarbeiten und importierst ihn wieder. Vor dem Übernehmen siehst du jede Änderung. Mit Konto verbindet sich ein KI-Assistent auch direkt über MCP.' },
      { id: 'import', q: 'Kann ich meinen bisherigen Lebenslauf übernehmen?', a: 'Ja. Den ZIP-Datenexport von LinkedIn liest das Werkzeug im Browser ein, ohne dass er an einen Server geht, ebenso JSON Resume und RenderCV-YAML. Aus einem bestehenden PDF holst du den Text über den Markdown-Weg: Text in die Vorlage, von einer KI strukturieren lassen, zurückimportieren.' },
      { id: 'data', q: 'Wo liegen meine Daten?', a: 'Ohne Konto speichert dein Browser sie, eine Sicherungsdatei kannst du jederzeit herunterladen. Mit Konto liegen sie auf dem Server dieser Instanz; wo er steht, sagt die Datenschutzerklärung. Das PDF entsteht in beiden Fällen dort: Für den Export geht das Dokument kurz an den Server und wird danach nicht gespeichert. Werbe-Tracker gibt es nicht.' },
      { id: 'host', q: 'Kann ich das Werkzeug selbst betreiben?', a: 'Ja. Der Quelltext steht unter der AGPL-3.0 auf GitHub, mit Docker-Dateien für den eigenen Server. Vorlagen, PDF-Dienst und MCP-Server sind dabei.' },
    ],
  },
  closing: { h1: 'Gestaltet für Menschen,', h2: 'lesbar für Software.', lede: 'Fang mit deinem Lebenslauf an, direkt im Browser und ohne Konto.', ctaSecondary: 'Vorlagen ansehen' },
  footer: { meta: 'Quelloffen unter AGPL-3.0 · Vektor-PDF mit Textebene', imprint: 'Impressum', privacy: 'Datenschutz', product: 'Produkt', legal: 'Rechtliches' },
  request: {
    title: 'Zugang anfragen',
    lede: 'Konten gibt es vorerst mit Einladung. Sag kurz, wer du bist. Nach der Freigabe kommt dein Einladungslink per E-Mail.',
    name: 'Name', email: 'E-Mail', message: 'Nachricht (optional)',
    messagePlaceholder: 'Worum geht es? Wofür möchtest du das Werkzeug nutzen?',
    submit: 'Anfrage senden', sending: 'Senden',
    successTitle: 'Anfrage ist raus.',
    success: 'Danke. Sobald sie freigegeben ist, bekommst du deinen Einladungslink per E-Mail.',
    close: 'Schließen',
    errName: 'Bitte gib deinen Namen an.',
    errEmail: 'Bitte gib eine gültige E-Mail-Adresse an.',
    errGeneric: 'Konnte nicht gesendet werden. Bitte später erneut versuchen.',
  },
};

const EN: LandingCopy = {
  meta: {
    title: () => 'Machine-readable CV builder',
    description: n => `Write your CV in the browser: ${n} templates, a PDF with a real text layer, an ATS version as PDF or Word in one click, four languages. No account, no subscription.`,
    ogAlt: 'The editor with a CV in the preview and the design panel',
  },
  langName: 'English',
  langHint: 'This page is also available in English.',
  langHintLink: 'Read in English',
  skip: 'Skip to content',
  nav: { label: 'Main navigation', ats: 'How an ATS reads', templates: 'Templates', features: 'Features', magazin: 'Magazine', faq: 'FAQ', signin: 'Sign in', cta: 'Request access', source: 'Source code', home: 'Home', lang: 'Page language', menu: 'Menu', close: 'Close menu' },
  hero: {
    eyebrow: 'CV and cover letter in your browser',
    h1a: 'Your CV,',
    // Geschützter Bindestrich (U+2011), damit „machine-readable“ nicht am Bindestrich bricht.
    h1b: 'typeset to be machine\u2011readable.',
    lede: 'What you see in the preview is the PDF you download. It has a real text layer, and your CV sits in it in the order in which it is meant to be read. For application portals there is the same version in one column, as PDF or Word, in one click.',
    ctaPrimary: 'Try the demo',
    ctaSecondary: 'How a portal reads your CV',
    proof: ['Start without an account', 'Saved in your browser', 'No subscription', 'Open-source edition'],
    shotAlt: 'The editor in the demo: the design panel with templates on the left, Lena Brandt’s CV in the middle, the carousel with the template’s label below',
    chipText: 'PDF with text layer',
    chipAts: 'ATS version in one click',
  },
  facts: {
    label: 'At a glance',
    items: n => [
      { value: String(n), label: 'templates: one column, header band or sidebar' },
      { value: '4', label: 'languages for document and interface' },
      { value: '1 click', label: 'to the ATS version as PDF or Word' },
      { value: '0', label: 'ad trackers, no tracking cookies' },
    ],
  },
  ats: {
    eyebrow: 'What an application portal sees',
    h: 'How an applicant tracking system reads your CV',
    intro: 'An applicant tracking system (ATS) does not read your PDF the way a person does. It pulls the text out of the file, depending on the program either in the order in which it is stored there or by where it sits on the page, and sorts it into fields such as name, positions and skills. Anything that exists only as an image in the file never arrives.',
    oursTitle: 'Stored order',
    oursSub: t => `Demo CV in the ${t} template with a sidebar, extracted with pdftotext -raw: the text in the order in which it is stored in the PDF.`,
    oursFoot: 'Name, profile, positions, then the sidebar. A parser that follows this order gets the CV in one piece.',
    layoutTitle: 'The same page, read by position',
    layoutSub: 'Extracted with pdftotext without -raw: the program rebuilds the order from where text sits on the page, like parsers with their own layout analysis.',
    layoutFoot: 'Lines from the sidebar slip in between the positions. From the outside you cannot tell which method a portal uses. That is why every template has a one-column ATS version.',
    sideLabel: 'from the sidebar',
    lineLabel: 'Line',
    problemsTitle: 'Typical faults of designed PDFs',
    problemsSub: 'What makers of recruiting software name in their help pages as causes of parsing errors.',
    problems: [
      { title: 'Columns get mixed', body: 'When two columns sit side by side line by line in the file, contact details and work experience end up in the same sentence.', src: 'Personio, Greenhouse' },
      { title: 'Text as an image', body: 'Headings as graphics, skill bars without text or whole pages as images have no text layer. The parser finds nothing there.', src: 'Greenhouse' },
      { title: 'Spaced capitals fall apart', body: 'From about 0.10 em letter spacing, OBSERVABILITY becomes “O B S E R VA B I L I T Y” in the text output. Those are exactly the lines where a parser splits sections.', src: 'Personio, own measurement' },
      { title: 'Header, table, text box', body: 'Some systems do not read contact details in the page header, in table cells or text boxes at all, or read them in the wrong order.', src: 'Personio, Greenhouse' },
    ],
    schemaNote: 'Schematic based on vendor help pages and our own measurement, not a recording of any particular program.',
    marksTitle: 'What the labels on the templates mean',
    marks: {
      high: 'One column, linear reading order. The shape portals turn into fields reliably.',
      medium: 'Header band in the normal text flow, then one column. Portals usually read it correctly.',
      low: 'Two columns for people who read the PDF by email or on paper. For portals you download the same version in one column.',
    },
    marksFoot: 'Every template has an ATS version: the same content in one column, as PDF or Word, without changing anything in your profile.',
    honestTitle: 'What we check and what we do not',
    honest: 'Check scripts in the source code print every template as a PDF, extract the text layer again and compare it page by page with the preview: text, reading order, word boundaries, hyphens. How a particular system reads also depends on its parser, and no layout decides whether a company invites you.',
    scriptsLink: 'See the check scripts',
    sourcesLabel: 'Sources',
    sources: [
      { label: 'Personio: CV parsing for candidate profiles', url: SRC_PERSONIO },
      { label: 'Greenhouse: Unsuccessful resume parse', url: SRC_GREENHOUSE },
      { label: 'Textkernel: Improving extraction from column resumes (2023)', url: SRC_TEXTKERNEL },
      { label: 'Harvard Business School and Accenture: Hidden Workers (2021)', url: SRC_HBS },
    ],
  },
  gallery: {
    eyebrow: 'Templates',
    h: n => `${n} templates. Your content stays when you switch.`,
    lede: 'One column, header band or sidebar, each with its own font pairing. The label on every template tells you whether it is made for application portals or for email and print.',
    showAll: n => `Show all ${n} templates`,
    legend: 'Shown with the demo CV, exactly as the template looks in the tool.',
  },
  features: {
    eyebrow: 'Features',
    h: 'Built for applications that software has to read, too.',
    items: [
      { id: 'editor', tag: 'Writing', title: 'You write right on the page.', body: 'Click into the text and type. Enter adds the next bullet, and the typesetting takes care of margins and page breaks, on up to four pages. If you prefer a form, every field is in the content panel. Free-floating text boxes are left out on purpose, because they are exactly what gets jumbled when a file is parsed.', alt: 'The content panel with the CV fields next to the preview' },
      { id: 'design', tag: 'Design', title: 'Browse with your own content.', body: 'In the design panel and the carousel below the page you see every template with your own text right away. Accent colour, paper and font are separate choices, and every colour combination is checked for contrast.', alt: 'The design panel with template cards and their labels' },
      { id: 'check', tag: 'Check', title: 'CV and cover letter the way a parser reads them.', body: 'The check panel shows the text in the order a system reads it and flags gaps such as a missing email address or a position without a start date. For the cover letter it adds subject line, date, salutation and length, and you can check both documents together for the same name, the same contact details and the same language. With a job ad next to it you see which terms appear and which are missing.', alt: 'The check panel with the plain-text view of the CV' },
      { id: 'export', tag: 'Export', title: 'PDF, Word and the portal version.', body: 'The PDF has exactly the pages of the preview. Word comes with your template’s design and in one column without tables. The ATS version sets the same content in one column, as PDF or Word, without changing anything in your profile. There is also LaTeX to keep editing, and RenderCV YAML, which you can import again.', alt: 'The export menu with PDF, Word and the ATS version' },
      { id: 'phone', tag: 'Phone', title: 'Just the same on your phone.', body: 'On the phone you start in the document. Content, design, check and export sit in the bar at the bottom, and the PDF is the same as on the desktop.', alt: 'The editor on a phone with the bar at the bottom' },
      { id: 'bridge', tag: 'AI bridge', title: 'Your AI helps write, the tool does the typesetting.', body: 'There is no built-in AI. You hand the CV as Markdown to ChatGPT, Claude or another model and import the revised version. Before anything is applied, the tool shows every change. With an account, an AI assistant connects directly through an MCP server.', alt: '' },
      { id: 'open', tag: 'Open', title: 'No account, no subscription, open source.', body: 'Without an account everything stays in your browser, and you can take a backup file with you. The LinkedIn data export is read in the browser as well. The source code is public under AGPL-3.0, and anyone can run the tool on their own server.', alt: '' },
    ],
    bridgeCaption: 'Excerpt from the Markdown export',
  },
  magazin: {
    eyebrow: 'Magazine',
    h: 'Applications and portals, explained with sources',
    lede: 'How-tos on CVs, cover letters and application portals. Wherever there is a number, the source is right next to it.',
    all: 'All articles in the magazine',
    minutes: n => `${n} min`,
  },
  faq: {
    eyebrow: 'FAQ',
    h: 'Frequently asked questions',
    items: [
      { id: 'what', q: 'What is {brand}?', a: '{brand} is a tool for CVs and cover letters in the browser. You write right in the preview, choose from {n} templates and download a PDF with a real text layer. For application portals there is the same version in one column, as PDF or Word. You can start without an account.' },
      { id: 'machine', q: 'What does machine-readable mean?', a: 'A program can pull the text out of your PDF completely and in the right order: name and contact first, then profile, positions and skills. That needs a real text layer instead of an image, and the order inside it has to be right. Scripts check both for every template.' },
      { id: 'ats', q: 'What is an ATS?', a: 'An applicant tracking system receives applications on behalf of employers. It parses the CV, creates fields for name, positions and skills, and helps with sorting. Greenhouse, for example, describes automatic rejection in its help pages only for screening questions the employer sets up in the form, such as work authorisation. The CV itself is read by people.' },
      { id: 'safe', q: 'Will my CV be ATS-friendly?', a: 'Nobody can guarantee that, because every system has its own parser. What can be checked, we check: a text layer is present, the order matches the preview, no words fall apart, no hyphens are inserted. For portals you use the one-column ATS version. Whether you get invited depends on the content.' },
      { id: 'access', q: 'Do I need an account?', a: 'No. Without an account you get the editor, all templates and all exports, and your data stays in your browser. An account adds saving across devices, share links, versions on the server and the AI connection via MCP. For now accounts are by invitation: you request access and get a link by email.', aOpen: 'No. Without an account you get the editor, all templates and all exports, and your data stays in your browser. An account adds saving across devices, share links, versions on the server and the AI connection via MCP. It comes with the Application Pass, and you see the price beforehand.' },
      { id: 'price', q: 'What does it cost?', a: 'The tool is free in the browser, and so is the PDF of your CV. The Application Pass costs {price} once for {days} days. It is not a subscription and ends by itself.', aNoOffer: 'The tool is open source. If you run it yourself, you pay nothing for it and set the limits yourself.' },
      { id: 'formats', q: 'Which formats can I export?', a: 'PDF with a real text layer, Word in two versions (with your template’s design and in one column for portals), plus HTML, JSON, JSON Resume, Markdown, LaTeX (.tex) and RenderCV YAML. The ATS version is available as PDF and as Word. The tool can also import RenderCV YAML, and a .tex file if it was exported here.', aLimited: 'PDF with a real text layer, also as a one-column ATS version, plus HTML, JSON, JSON Resume, Markdown and RenderCV YAML. Word in two versions (with your template’s design and in one column for portals) and LaTeX (.tex) are part of the Application Pass. The tool can also import RenderCV YAML, and a .tex file if it was exported here.' },
      { id: 'pages', q: 'How many pages can my CV have?', a: 'Up to four. You set one to four pages or let the typesetting break the pages itself. In Germany one or two pages are usual, in science and engineering more is common when there are publications or a project list. From the third page on, the check panel shows a note about it.' },
      { id: 'check', q: 'Can I check my cover letter too?', a: 'Yes. The check panel reads your CV and cover letter the way they are stored in the PDF. For the cover letter it looks at subject line, date, salutation, length and forgotten placeholders, and with a job ad also at whether the job title and company appear. Under “Both” it compares name, contact details and language of the two documents and shows which terms from the ad appear where. There is deliberately no score.', aLimited: 'Yes, with the Application Pass, which also includes the cover letter. The check panel reads your CV and cover letter the way they are stored in the PDF. For the cover letter it looks at subject line, date, salutation, length and forgotten placeholders, and with a job ad also at whether the job title and company appear. Under “Both” it compares name, contact details and language of the two documents. Checking your CV needs no pass.' },
      { id: 'langs', q: 'Which languages does the tool support?', a: 'CV, cover letter and interface are available in German, English, French and Spanish. Headings, date formats and field names switch with the language, and all four versions live in the same profile.' },
      { id: 'ai', q: 'Can I use an AI?', a: 'Yes, just not a built-in one. You export the CV as Markdown, let a language model of your choice revise it and import it again. Before anything is applied you see every change. With an account, an AI assistant can also connect directly via MCP.' },
      { id: 'import', q: 'Can I bring my existing CV?', a: 'Yes. The tool reads LinkedIn’s ZIP data export in the browser without sending it to a server, and the same goes for JSON Resume and RenderCV YAML. From an existing PDF you take the text via Markdown: paste it into the template, let an AI structure it, import it back.' },
      { id: 'data', q: 'Where is my data stored?', a: 'Without an account your browser stores it, and you can download a backup file at any time. With an account it is stored on the server that runs this site; the privacy policy says where it is located. Either way the PDF is made there: for the export the document goes to the server briefly and is not stored afterwards. There are no ad trackers.' },
      { id: 'host', q: 'Can I run the tool myself?', a: 'Yes. The source code is on GitHub under AGPL-3.0, with Docker files for your own server. Templates, the PDF service and the MCP server are included.' },
    ],
  },
  closing: { h1: 'Designed for people,', h2: 'readable for software.', lede: 'Start with your CV, right in the browser and without an account.', ctaSecondary: 'Browse templates' },
  footer: { meta: 'Open source under AGPL-3.0 · Vector PDF with text layer', imprint: 'Legal notice', privacy: 'Privacy', product: 'Product', legal: 'Legal' },
  request: {
    title: 'Request access',
    lede: 'For now, accounts are by invitation. Tell us briefly who you are. Once approved, your invite link arrives by email.',
    name: 'Name', email: 'Email', message: 'Message (optional)',
    messagePlaceholder: 'What is this about? What would you use the tool for?',
    submit: 'Send request', sending: 'Sending',
    successTitle: 'Request sent.',
    success: 'Thanks. Once it is approved, your invite link will arrive by email.',
    close: 'Close',
    errName: 'Please enter your name.',
    errEmail: 'Please enter a valid email address.',
    errGeneric: 'Could not send. Please try again later.',
  },
};

const FR: LandingCopy = {
  meta: {
    title: () => 'Créer un CV lisible par les logiciels',
    description: n => `Rédigez votre CV dans le navigateur : ${n} modèles, un PDF avec une vraie couche de texte, une version ATS en PDF ou Word en un clic, quatre langues. Sans compte.`,
    ogAlt: 'L’éditeur avec un CV dans l’aperçu et le panneau de mise en page',
  },
  langName: 'Français',
  langHint: 'Cette page existe aussi en français.',
  langHintLink: 'Lire en français',
  skip: 'Aller au contenu',
  nav: { label: 'Navigation principale', ats: 'Comment lit un ATS', templates: 'Modèles', features: 'Fonctions', magazin: 'Magazine', faq: 'Questions', signin: 'Se connecter', cta: 'Demander l’accès', source: 'Code source', home: 'Accueil', lang: 'Langue de la page', menu: 'Menu', close: 'Fermer le menu' },
  hero: {
    eyebrow: 'CV et lettre de motivation dans le navigateur',
    h1a: 'Votre CV,',
    h1b: 'composé pour être lu par les machines.',
    lede: 'Ce que vous voyez dans l’aperçu est le PDF que vous téléchargez. Il a une vraie couche de texte, où votre CV figure dans l’ordre où on le lit. Pour les portails de candidature, la même version existe sur une colonne, en PDF ou en Word, en un clic.',
    ctaPrimary: 'Essayer maintenant',
    ctaSecondary: 'Comment un portail lit votre CV',
    proof: ['Sans compte', 'Enregistré dans votre navigateur', 'Sans abonnement', 'Version open source'],
    shotAlt: 'L’éditeur en démo : à gauche le panneau de mise en page avec les modèles, au centre le CV de Lena Brandt, en bas le carrousel avec le libellé du modèle',
    chipText: 'PDF avec couche de texte',
    chipAts: 'Version ATS en un clic',
  },
  facts: {
    label: 'En bref',
    items: n => [
      { value: String(n), label: 'modèles : une colonne, bandeau ou colonne latérale' },
      { value: '4', label: 'langues pour le document et l’interface' },
      { value: '1 clic', label: 'jusqu’à la version ATS en PDF ou Word' },
      { value: '0', label: 'traceur publicitaire, aucun cookie de suivi' },
    ],
  },
  ats: {
    eyebrow: 'Ce que voit un portail de candidature',
    h: 'Comment un logiciel de recrutement lit votre CV',
    intro: 'Un logiciel de recrutement (en anglais applicant tracking system, ATS) ne lit pas votre PDF comme une personne. Il extrait le texte du fichier, selon le programme dans l’ordre où il y est enregistré ou d’après sa position sur la page, et le répartit dans des champs comme le nom, les postes et les compétences. Ce qui n’existe que sous forme d’image dans le fichier n’arrive jamais.',
    oursTitle: 'Ordre enregistré',
    oursSub: t => `CV de démonstration dans le modèle ${t} avec colonne latérale, extrait avec pdftotext -raw : le texte dans l’ordre où il est enregistré dans le PDF.`,
    oursFoot: 'Nom, profil, postes, puis la colonne latérale. Un analyseur qui suit cet ordre reçoit le CV d’un seul tenant.',
    layoutTitle: 'La même page, lue selon la position',
    layoutSub: 'Extrait avec pdftotext sans -raw : le programme reconstruit l’ordre à partir de la position du texte sur la page, comme les analyseurs dotés de leur propre analyse de mise en page.',
    layoutFoot: 'Des lignes de la colonne latérale se glissent entre les postes. De l’extérieur, vous ne savez pas quelle méthode utilise un portail. C’est pourquoi chaque modèle a une version ATS sur une colonne.',
    sideLabel: 'de la colonne latérale',
    lineLabel: 'Ligne',
    problemsTitle: 'Erreurs typiques des PDF mis en page',
    problemsSub: 'Ce que les éditeurs de logiciels de recrutement citent dans leurs pages d’aide comme causes d’erreurs de lecture.',
    problems: [
      { title: 'Les colonnes se mélangent', body: 'Quand deux colonnes sont côte à côte ligne par ligne dans le fichier, coordonnées et expérience se retrouvent dans la même phrase.', src: 'Personio, Greenhouse' },
      { title: 'Le texte en image', body: 'Des titres en graphique, des barres de compétences sans texte ou des pages entières en image n’ont pas de couche de texte. L’analyseur n’y trouve rien.', src: 'Greenhouse' },
      { title: 'Les capitales espacées se désagrègent', body: 'À partir d’environ 0,10 em d’espacement, OBSERVABILITY devient « O B S E R VA B I L I T Y » dans le texte extrait. C’est justement sur ces lignes qu’un analyseur sépare les sections.', src: 'Personio, mesure interne' },
      { title: 'En-tête, tableau, zone de texte', body: 'Certains systèmes ne lisent pas du tout les coordonnées placées dans l’en-tête, dans des cellules de tableau ou des zones de texte, ou les lisent dans le mauvais ordre.', src: 'Personio, Greenhouse' },
    ],
    schemaNote: 'Schéma établi d’après les pages d’aide des éditeurs et notre propre mesure, pas l’enregistrement d’un programme précis.',
    marksTitle: 'Ce que signifient les libellés des modèles',
    marks: {
      high: 'Une colonne, ordre de lecture linéaire. La forme que les portails convertissent en champs de façon fiable.',
      medium: 'Bandeau dans le flux normal du texte, puis une colonne. Les portails le lisent généralement bien.',
      low: 'Deux colonnes, pour les personnes qui lisent le PDF par e-mail ou sur papier. Pour les portails, vous téléchargez la même version sur une colonne.',
    },
    marksFoot: 'Chaque modèle a sa version ATS : le même contenu sur une colonne, en PDF ou en Word, sans rien changer à votre profil.',
    honestTitle: 'Ce que nous vérifions et ce que nous ne vérifions pas',
    honest: 'Des scripts de contrôle dans le code source impriment chaque modèle en PDF, en extraient de nouveau la couche de texte et la comparent page par page à l’aperçu : texte, ordre de lecture, limites de mots, traits d’union. La façon dont un système donné lit dépend aussi de son analyseur, et aucune mise en page ne décide si une entreprise vous invite.',
    scriptsLink: 'Voir les scripts de contrôle',
    sourcesLabel: 'Sources',
    sources: [
      { label: 'Personio : CV parsing for candidate profiles', url: SRC_PERSONIO },
      { label: 'Greenhouse : Unsuccessful resume parse', url: SRC_GREENHOUSE },
      { label: 'Textkernel : extraction des CV en colonnes (2023)', url: SRC_TEXTKERNEL },
      { label: 'Harvard Business School et Accenture : Hidden Workers (2021)', url: SRC_HBS },
    ],
  },
  gallery: {
    eyebrow: 'Modèles',
    h: n => `${n} modèles. Votre contenu reste quand vous changez.`,
    lede: 'Une colonne, bandeau ou colonne latérale, chacun avec sa propre combinaison de polices. Le libellé de chaque modèle indique s’il est fait pour les portails de candidature ou pour l’e-mail et l’impression.',
    showAll: n => `Afficher les ${n} modèles`,
    legend: 'Montrés avec le CV de démonstration, tels qu’ils apparaissent dans l’outil.',
  },
  features: {
    eyebrow: 'Fonctions',
    h: 'Conçu pour des candidatures que des logiciels doivent aussi lire.',
    items: [
      { id: 'editor', tag: 'Rédiger', title: 'Vous écrivez directement sur la page.', body: 'Cliquez dans le texte et tapez. Entrée ajoute le point suivant, la composition s’occupe des marges et des sauts de page, sur quatre pages au plus. Si vous préférez un formulaire, tous les champs sont dans le panneau Contenu. Les zones de texte libres sont absentes à dessein, car ce sont elles qui se mélangent à l’extraction.', alt: 'Le panneau Contenu avec les champs du CV à côté de l’aperçu' },
      { id: 'design', tag: 'Mettre en page', title: 'Parcourir avec votre propre contenu.', body: 'Dans le panneau de mise en page et le carrousel sous la page, vous voyez chaque modèle directement avec votre texte. Couleur d’accent, papier et police se choisissent à part, et chaque combinaison de couleurs est vérifiée pour le contraste.', alt: 'Le panneau de mise en page avec les cartes des modèles et leurs libellés' },
      { id: 'check', tag: 'Vérifier', title: 'CV et lettre de motivation, tels qu’un analyseur les lit.', body: 'Le panneau Vérifier montre le texte dans l’ordre où un système le lit et signale les lacunes, par exemple une adresse e-mail manquante ou un poste sans date de début. Pour la lettre s’ajoutent l’objet, la date, la formule d’appel et la longueur, et vous pouvez vérifier les deux documents ensemble : même nom, mêmes coordonnées, même langue. Avec une offre d’emploi à côté, vous voyez quels termes apparaissent et lesquels manquent.', alt: 'Le panneau Vérifier avec la vue texte du CV' },
      { id: 'export', tag: 'Exporter', title: 'PDF, Word et la version pour les portails.', body: 'Le PDF a exactement les pages de l’aperçu. Word existe avec le design de votre modèle et sur une colonne sans tableaux. La version ATS compose le même contenu sur une colonne, en PDF ou en Word, sans rien changer à votre profil. S’y ajoutent LaTeX, pour continuer à travailler le document, et le YAML RenderCV, que vous pouvez aussi réimporter.', alt: 'Le menu d’export avec PDF, Word et la version ATS' },
      { id: 'phone', tag: 'Téléphone', title: 'Pareil sur le téléphone.', body: 'Sur le téléphone, vous commencez dans le document. Contenu, mise en page, vérification et export se trouvent dans la barre du bas, et le PDF est le même que sur l’ordinateur.', alt: 'L’éditeur sur un téléphone avec la barre en bas' },
      { id: 'bridge', tag: 'Passerelle IA', title: 'Votre IA aide à écrire, l’outil compose.', body: 'Il n’y a pas d’IA intégrée. Vous donnez le CV en Markdown à ChatGPT, Claude ou un autre modèle et importez la version révisée. Avant de l’appliquer, l’outil montre chaque modification. Avec un compte, un assistant IA se connecte directement via un serveur MCP.', alt: '' },
      { id: 'open', tag: 'Ouvert', title: 'Sans compte, sans abonnement, open source.', body: 'Sans compte, tout reste dans votre navigateur, et vous emportez un fichier de sauvegarde. L’export de données LinkedIn est lu lui aussi dans le navigateur. Le code source est public sous AGPL-3.0, et chacun peut faire tourner l’outil sur son propre serveur.', alt: '' },
    ],
    bridgeCaption: 'Extrait de l’export Markdown',
  },
  magazin: {
    eyebrow: 'Magazine',
    h: 'Candidature et portails, expliqués avec des sources',
    lede: 'Des conseils sur le CV, la lettre de motivation et les portails de candidature. Là où il y a un chiffre, la source est juste à côté.',
    all: 'Tous les articles du magazine',
    minutes: n => `${n} min`,
  },
  faq: {
    eyebrow: 'Questions',
    h: 'Questions fréquentes',
    items: [
      { id: 'what', q: 'Qu’est-ce que {brand} ?', a: '{brand} est un outil pour le CV et la lettre de motivation dans le navigateur. Vous écrivez directement dans l’aperçu, choisissez parmi {n} modèles et téléchargez un PDF avec une vraie couche de texte. Pour les portails de candidature, la même version existe sur une colonne, en PDF ou en Word. On commence sans compte.' },
      { id: 'machine', q: 'Que veut dire lisible par les machines ?', a: 'Un programme peut extraire le texte de votre PDF en entier et dans le bon ordre : d’abord le nom et les coordonnées, puis le profil, les postes et les compétences. Il faut pour cela une vraie couche de texte plutôt qu’une image, et un ordre correct. Des scripts vérifient les deux pour chaque modèle.' },
      { id: 'ats', q: 'Qu’est-ce qu’un ATS ?', a: 'Un applicant tracking system, ou logiciel de recrutement, reçoit les candidatures pour les employeurs. Il lit le CV, crée des champs pour le nom, les postes et les compétences et aide au tri. Dans son aide, Greenhouse par exemple ne décrit de refus automatique que pour les questions éliminatoires que l’employeur ajoute au formulaire, comme l’autorisation de travail. Le CV, ce sont des personnes qui le lisent.' },
      { id: 'safe', q: 'Mon CV sera-t-il compatible ATS ?', a: 'Personne ne peut le garantir, car chaque système a son propre analyseur. Ce qui peut être vérifié, nous le vérifions : couche de texte présente, ordre identique à l’aperçu, pas de mots désagrégés, pas de traits d’union insérés. Pour les portails, vous prenez la version ATS sur une colonne. C’est le contenu qui décide si vous êtes invité.' },
      { id: 'access', q: 'Ai-je besoin d’un compte ?', a: 'Non. Sans compte, vous avez l’éditeur, tous les modèles et tous les exports, et vos données restent dans votre navigateur. Un compte ajoute l’enregistrement entre appareils, les liens de partage, les versions sur le serveur et la connexion IA via MCP. Pour l’instant, les comptes sont sur invitation : vous demandez l’accès et recevez un lien par e-mail.', aOpen: 'Non. Sans compte, vous avez l’éditeur, tous les modèles et tous les exports, et vos données restent dans votre navigateur. Un compte ajoute l’enregistrement entre appareils, les liens de partage, les versions sur le serveur et la connexion IA via MCP. Il fait partie du Pass candidature, dont vous voyez le prix à l’avance.' },
      { id: 'price', q: 'Combien ça coûte ?', a: 'L’outil est gratuit dans le navigateur, tout comme le PDF de votre CV. Le Pass candidature coûte {price} une seule fois pour {days} jours. Ce n’est pas un abonnement, il s’arrête tout seul.', aNoOffer: 'L’outil est open source. Si vous l’hébergez vous-même, vous ne payez rien et fixez vous-même les limites.' },
      { id: 'formats', q: 'Quels formats puis-je exporter ?', a: 'PDF avec une vraie couche de texte, Word en deux versions (avec le design de votre modèle et sur une colonne pour les portails), ainsi que HTML, JSON, JSON Resume, Markdown, LaTeX (.tex) et YAML RenderCV. La version ATS existe en PDF et en Word. L’outil sait aussi réimporter le YAML RenderCV, et un fichier .tex s’il a été exporté ici.', aLimited: 'PDF avec une vraie couche de texte, aussi en version ATS sur une colonne, ainsi que HTML, JSON, JSON Resume, Markdown et YAML RenderCV. Word en deux versions (avec le design de votre modèle et sur une colonne pour les portails) et LaTeX (.tex) font partie du Pass candidature. L’outil sait aussi réimporter le YAML RenderCV, et un fichier .tex s’il a été exporté ici.' },
      { id: 'pages', q: 'Combien de pages mon CV peut-il avoir ?', a: 'Jusqu’à quatre. Vous choisissez une à quatre pages ou laissez la composition couper les pages elle-même. En Allemagne, une ou deux pages sont l’usage ; en sciences et en ingénierie, davantage avec des publications ou une liste de projets. À partir de la troisième page, le panneau Vérifier affiche une remarque à ce sujet.' },
      { id: 'check', q: 'Puis-je aussi vérifier ma lettre de motivation ?', a: 'Oui. Le panneau Vérifier lit le CV et la lettre tels qu’ils figurent dans le PDF. Pour la lettre, il regarde l’objet, la date, la formule d’appel, la longueur et les espaces réservés oubliés, et avec une offre d’emploi aussi si l’intitulé du poste et l’entreprise apparaissent. Sous « Les deux », il compare le nom, les coordonnées et la langue des deux documents et montre quels termes de l’offre figurent où. Il n’y a volontairement pas de score.', aLimited: 'Oui, avec le Pass candidature, qui comprend aussi la lettre de motivation. Le panneau Vérifier lit le CV et la lettre tels qu’ils figurent dans le PDF. Pour la lettre, il regarde l’objet, la date, la formule d’appel, la longueur et les espaces réservés oubliés, et avec une offre d’emploi aussi si l’intitulé du poste et l’entreprise apparaissent. Sous « Les deux », il compare le nom, les coordonnées et la langue des deux documents. La vérification du CV ne demande pas de pass.' },
      { id: 'langs', q: 'Dans quelles langues l’outil existe-t-il ?', a: 'CV, lettre de motivation et interface existent en allemand, anglais, français et espagnol. Titres, formats de date et noms de champs changent avec la langue, et les quatre versions vivent dans le même profil.' },
      { id: 'ai', q: 'Puis-je utiliser une IA ?', a: 'Oui, mais pas une IA intégrée. Vous exportez le CV en Markdown, le faites réviser par le modèle de langage de votre choix et l’importez à nouveau. Avant de l’appliquer, vous voyez chaque modification. Avec un compte, un assistant IA peut aussi se connecter directement via MCP.' },
      { id: 'import', q: 'Puis-je reprendre mon CV actuel ?', a: 'Oui. L’outil lit l’export de données ZIP de LinkedIn dans le navigateur, sans l’envoyer à un serveur, de même que JSON Resume et le YAML RenderCV. Depuis un PDF existant, vous passez par le Markdown : le texte dans le modèle, une IA le structure, vous le réimportez.' },
      { id: 'data', q: 'Où sont stockées mes données ?', a: 'Sans compte, votre navigateur les enregistre, et vous pouvez télécharger un fichier de sauvegarde à tout moment. Avec un compte, elles sont sur le serveur qui fait tourner ce site ; la politique de confidentialité indique où il se trouve. Dans les deux cas, le PDF y est créé : pour l’export, le document passe brièvement par le serveur et n’y est pas conservé. Il n’y a pas de traceur publicitaire.' },
      { id: 'host', q: 'Puis-je héberger l’outil moi-même ?', a: 'Oui. Le code source est sur GitHub sous AGPL-3.0, avec des fichiers Docker pour votre propre serveur. Les modèles, le service PDF et le serveur MCP en font partie.' },
    ],
  },
  closing: { h1: 'Conçu pour les personnes,', h2: 'lisible par les logiciels.', lede: 'Commencez votre CV directement dans le navigateur, sans compte.', ctaSecondary: 'Voir les modèles' },
  footer: { meta: 'Open source sous AGPL-3.0 · PDF vectoriel avec couche de texte', imprint: 'Mentions légales', privacy: 'Confidentialité', product: 'Produit', legal: 'Mentions' },
  request: {
    title: 'Demander l’accès',
    lede: 'Pour l’instant, les comptes sont sur invitation. Dites brièvement qui vous êtes. Une fois validé, votre lien d’invitation arrive par e-mail.',
    name: 'Nom', email: 'E-mail', message: 'Message (facultatif)',
    messagePlaceholder: 'De quoi s’agit-il ? À quoi vous servirait l’outil ?',
    submit: 'Envoyer la demande', sending: 'Envoi',
    successTitle: 'Demande envoyée.',
    success: 'Merci. Une fois validée, votre lien d’invitation arrivera par e-mail.',
    close: 'Fermer',
    errName: 'Veuillez indiquer votre nom.',
    errEmail: 'Veuillez indiquer une adresse e-mail valide.',
    errGeneric: 'Envoi impossible. Veuillez réessayer plus tard.',
  },
};

const ES: LandingCopy = {
  meta: {
    title: () => 'Crear un CV legible por máquinas',
    description: n => `Escribe tu CV en el navegador: ${n} plantillas, un PDF con capa de texto real, versión ATS en PDF o Word con un clic, cuatro idiomas. Sin cuenta ni suscripción.`,
    ogAlt: 'El editor con un currículum en la vista previa y el panel de diseño',
  },
  langName: 'Español',
  langHint: 'Esta página también está en español.',
  langHintLink: 'Leer en español',
  skip: 'Saltar al contenido',
  nav: { label: 'Navegación principal', ats: 'Cómo lee un ATS', templates: 'Plantillas', features: 'Funciones', magazin: 'Revista', faq: 'Preguntas', signin: 'Iniciar sesión', cta: 'Solicitar acceso', source: 'Código fuente', home: 'Inicio', lang: 'Idioma de la página', menu: 'Menú', close: 'Cerrar menú' },
  hero: {
    eyebrow: 'Currículum y carta de presentación en el navegador',
    h1a: 'Tu CV,',
    h1b: 'maquetado para que lo lean las máquinas.',
    lede: 'Lo que ves en la vista previa es el PDF que descargas. Tiene una capa de texto real, y en ella tu currículum está en el orden en que se lee. Para portales de empleo tienes la misma versión a una columna, en PDF o Word, con un clic.',
    ctaPrimary: 'Probar ahora',
    ctaSecondary: 'Cómo lee un portal tu CV',
    proof: ['Empieza sin cuenta', 'Guardado en tu navegador', 'Sin suscripción', 'Versión de código abierto'],
    shotAlt: 'El editor en la demo: a la izquierda el panel de diseño con plantillas, en el centro el currículum de Lena Brandt, abajo el carrusel con la etiqueta de la plantilla',
    chipText: 'PDF con capa de texto',
    chipAts: 'Versión ATS con un clic',
  },
  facts: {
    label: 'De un vistazo',
    items: n => [
      { value: String(n), label: 'plantillas: una columna, banda superior o barra lateral' },
      { value: '4', label: 'idiomas para documento e interfaz' },
      { value: '1 clic', label: 'hasta la versión ATS en PDF o Word' },
      { value: '0', label: 'rastreadores publicitarios, sin cookies de seguimiento' },
    ],
  },
  ats: {
    eyebrow: 'Lo que ve un portal de empleo',
    h: 'Cómo lee tu CV un sistema de selección',
    intro: 'Un sistema de seguimiento de candidatos (en inglés applicant tracking system, ATS) no lee tu PDF como una persona. Saca el texto del archivo, según el programa en el orden en que está guardado o según su posición en la página, y lo reparte en campos como nombre, puestos y competencias. Lo que solo existe como imagen en el archivo nunca llega.',
    oursTitle: 'Orden guardado',
    oursSub: t => `CV de demostración en la plantilla ${t} con barra lateral, extraído con pdftotext -raw: el texto en el orden en que está guardado en el PDF.`,
    oursFoot: 'Nombre, perfil, puestos y después la barra lateral. Un analizador que sigue este orden recibe el currículum de una pieza.',
    layoutTitle: 'La misma página, leída por posición',
    layoutSub: 'Extraído con pdftotext sin -raw: el programa reconstruye el orden a partir de la posición del texto en la página, como los analizadores con análisis de diseño propio.',
    layoutFoot: 'Líneas de la barra lateral se cuelan entre los puestos. Desde fuera no puedes saber qué método usa un portal. Por eso cada plantilla tiene una versión ATS a una columna.',
    sideLabel: 'de la barra lateral',
    lineLabel: 'Línea',
    problemsTitle: 'Fallos típicos de los PDF diseñados',
    problemsSub: 'Lo que los fabricantes de software de selección citan en sus páginas de ayuda como causas de errores de lectura.',
    problems: [
      { title: 'Las columnas se mezclan', body: 'Cuando dos columnas van una al lado de la otra línea por línea en el archivo, los datos de contacto y la experiencia acaban en la misma frase.', src: 'Personio, Greenhouse' },
      { title: 'Texto como imagen', body: 'Títulos como gráficos, barras de competencias sin texto o páginas enteras como imagen no tienen capa de texto. El analizador no encuentra nada ahí.', src: 'Greenhouse' },
      { title: 'Las mayúsculas espaciadas se deshacen', body: 'A partir de unos 0,10 em de espaciado, OBSERVABILITY se convierte en «O B S E R VA B I L I T Y» en el texto extraído. Justo en esas líneas un analizador separa las secciones.', src: 'Personio, medición propia' },
      { title: 'Encabezado, tabla, cuadro de texto', body: 'Algunos sistemas no leen los datos de contacto que van en el encabezado, en celdas de tabla o en cuadros de texto, o los leen en el orden equivocado.', src: 'Personio, Greenhouse' },
    ],
    schemaNote: 'Esquema según las páginas de ayuda de los fabricantes y una medición propia, no la grabación de un programa concreto.',
    marksTitle: 'Qué significan las etiquetas de las plantillas',
    marks: {
      high: 'Una columna, orden de lectura lineal. La forma que los portales convierten en campos de manera fiable.',
      medium: 'Banda superior dentro del flujo normal del texto y luego una columna. Los portales suelen leerla bien.',
      low: 'Dos columnas, para quien lee el PDF por correo o en papel. Para portales descargas la misma versión a una columna.',
    },
    marksFoot: 'Cada plantilla tiene su versión ATS: el mismo contenido a una columna, en PDF o Word, sin cambiar nada de tu perfil.',
    honestTitle: 'Qué comprobamos y qué no',
    honest: 'Los scripts de comprobación del código fuente imprimen cada plantilla como PDF, vuelven a extraer la capa de texto y la comparan página por página con la vista previa: texto, orden de lectura, límites de palabra, guiones. Cómo lee un sistema concreto depende también de su analizador, y ningún diseño decide si una empresa te invita.',
    scriptsLink: 'Ver los scripts de comprobación',
    sourcesLabel: 'Fuentes',
    sources: [
      { label: 'Personio: CV parsing for candidate profiles', url: SRC_PERSONIO },
      { label: 'Greenhouse: Unsuccessful resume parse', url: SRC_GREENHOUSE },
      { label: 'Textkernel: extracción de currículums en columnas (2023)', url: SRC_TEXTKERNEL },
      { label: 'Harvard Business School y Accenture: Hidden Workers (2021)', url: SRC_HBS },
    ],
  },
  gallery: {
    eyebrow: 'Plantillas',
    h: n => `${n} plantillas. Tu contenido se queda al cambiar.`,
    lede: 'Una columna, banda superior o barra lateral, cada una con su propia combinación de fuentes. La etiqueta de cada plantilla dice si está pensada para portales de empleo o para correo e impresión.',
    showAll: n => `Mostrar las ${n} plantillas`,
    legend: 'Mostradas con el CV de demostración, tal como se ven en la herramienta.',
  },
  features: {
    eyebrow: 'Funciones',
    h: 'Hecho para candidaturas que también tiene que leer un software.',
    items: [
      { id: 'editor', tag: 'Escribir', title: 'Escribes directamente en la página.', body: 'Haz clic en el texto y escribe. Intro añade el siguiente punto, y la composición se ocupa de márgenes y saltos de página, hasta cuatro páginas. Si prefieres un formulario, todos los campos están en el panel Contenido. Los cuadros de texto libres no existen a propósito, porque son justo lo que se desordena al extraer el texto.', alt: 'El panel Contenido con los campos del currículum junto a la vista previa' },
      { id: 'design', tag: 'Diseñar', title: 'Hojear con tu propio contenido.', body: 'En el panel de diseño y en el carrusel bajo la página ves cada plantilla directamente con tu texto. Color de acento, papel y fuente se eligen aparte, y cada combinación de colores está comprobada en contraste.', alt: 'El panel de diseño con las tarjetas de plantillas y sus etiquetas' },
      { id: 'check', tag: 'Comprobar', title: 'CV y carta, tal como los lee un analizador.', body: 'El panel Comprobar muestra el texto en el orden en que lo lee un sistema y avisa de huecos como un correo que falta o un puesto sin fecha de inicio. En la carta se suman asunto, fecha, saludo y extensión, y puedes comprobar los dos documentos juntos: mismo nombre, mismo contacto, mismo idioma. Con una oferta al lado ves qué términos aparecen y cuáles faltan.', alt: 'El panel Comprobar con la vista de texto del currículum' },
      { id: 'export', tag: 'Exportar', title: 'PDF, Word y la versión para portales.', body: 'El PDF tiene exactamente las páginas de la vista previa. Word viene con el diseño de tu plantilla y a una columna sin tablas. La versión ATS compone el mismo contenido a una columna, en PDF o Word, sin cambiar nada de tu perfil. Además tienes LaTeX para seguir editando y YAML de RenderCV, que puedes volver a importar.', alt: 'El menú de exportación con PDF, Word y la versión ATS' },
      { id: 'phone', tag: 'Móvil', title: 'Igual en el móvil.', body: 'En el móvil empiezas en el documento. Contenido, diseño, comprobación y exportación están en la barra inferior, y el PDF es el mismo que en el ordenador.', alt: 'El editor en un móvil con la barra en la parte inferior' },
      { id: 'bridge', tag: 'Puente IA', title: 'Tu IA ayuda a escribir, la herramienta maqueta.', body: 'No hay IA integrada. Pasas el currículum en Markdown a ChatGPT, Claude u otro modelo e importas la versión revisada. Antes de aplicarla, la herramienta muestra cada cambio. Con cuenta, un asistente de IA se conecta directamente a través de un servidor MCP.', alt: '' },
      { id: 'open', tag: 'Abierto', title: 'Sin cuenta, sin suscripción, código abierto.', body: 'Sin cuenta todo se queda en tu navegador, y te llevas un archivo de copia de seguridad. La exportación de datos de LinkedIn también se lee en el navegador. El código fuente es público bajo AGPL-3.0, y quien quiera puede ejecutar la herramienta en su propio servidor.', alt: '' },
    ],
    bridgeCaption: 'Fragmento de la exportación Markdown',
  },
  magazin: {
    eyebrow: 'Revista',
    h: 'Candidaturas y portales, explicados con fuentes',
    lede: 'Guías sobre el currículum, la carta de presentación y los portales de empleo. Donde hay una cifra, la fuente está al lado.',
    all: 'Todos los artículos de la revista',
    minutes: n => `${n} min`,
  },
  faq: {
    eyebrow: 'Preguntas',
    h: 'Preguntas frecuentes',
    items: [
      { id: 'what', q: '¿Qué es {brand}?', a: '{brand} es una herramienta para currículum y carta de presentación en el navegador. Escribes directamente en la vista previa, eliges entre {n} plantillas y descargas un PDF con capa de texto real. Para portales de empleo tienes la misma versión a una columna, en PDF o Word. Se empieza sin cuenta.' },
      { id: 'machine', q: '¿Qué significa legible por máquinas?', a: 'Un programa puede sacar el texto de tu PDF completo y en el orden correcto: primero nombre y contacto, luego perfil, puestos y competencias. Para eso el PDF necesita una capa de texto real en lugar de una imagen, y el orden dentro tiene que ser el correcto. Unos scripts comprueban ambas cosas en cada plantilla.' },
      { id: 'ats', q: '¿Qué es un ATS?', a: 'Un applicant tracking system, o sistema de selección, recibe las candidaturas para las empresas. Lee el currículum, crea campos para nombre, puestos y competencias y ayuda a ordenar. Greenhouse, por ejemplo, solo describe en su ayuda rechazos automáticos para preguntas eliminatorias que la empresa añade al formulario, como el permiso de trabajo. El currículum lo leen personas.' },
      { id: 'safe', q: '¿Mi CV será apto para ATS?', a: 'Nadie puede garantizarlo, porque cada sistema tiene su propio analizador. Lo que se puede comprobar, lo comprobamos: hay capa de texto, el orden coincide con la vista previa, no se deshacen palabras, no se insertan guiones. Para portales usas la versión ATS a una columna. Que te inviten depende del contenido.' },
      { id: 'access', q: '¿Necesito una cuenta?', a: 'No. Sin cuenta tienes el editor, todas las plantillas y todas las exportaciones, y tus datos se quedan en tu navegador. Una cuenta añade guardado entre dispositivos, enlaces compartidos, versiones en el servidor y la conexión con IA por MCP. Por ahora las cuentas son por invitación: solicitas acceso y recibes un enlace por correo.', aOpen: 'No. Sin cuenta tienes el editor, todas las plantillas y todas las exportaciones, y tus datos se quedan en tu navegador. Una cuenta añade guardado entre dispositivos, enlaces compartidos, versiones en el servidor y la conexión con IA por MCP. Forma parte del Pase de candidatura, y ves el precio antes.' },
      { id: 'price', q: '¿Cuánto cuesta?', a: 'La herramienta es gratis en el navegador, y el PDF de tu currículum también. El Pase de candidatura cuesta {price} una sola vez por {days} días. No es una suscripción y termina solo.', aNoOffer: 'La herramienta es de código abierto. Si la ejecutas tú, no pagas nada y fijas tú los límites.' },
      { id: 'formats', q: '¿Qué formatos puedo exportar?', a: 'PDF con capa de texto real, Word en dos versiones (con el diseño de tu plantilla y a una columna para portales), además de HTML, JSON, JSON Resume, Markdown, LaTeX (.tex) y YAML de RenderCV. La versión ATS está disponible en PDF y en Word. La herramienta también vuelve a importar el YAML de RenderCV, y un archivo .tex si se exportó aquí.', aLimited: 'PDF con capa de texto real, también como versión ATS a una columna, además de HTML, JSON, JSON Resume, Markdown y YAML de RenderCV. Word en dos versiones (con el diseño de tu plantilla y a una columna para portales) y LaTeX (.tex) forman parte del Pase de candidatura. La herramienta también vuelve a importar el YAML de RenderCV, y un archivo .tex si se exportó aquí.' },
      { id: 'pages', q: '¿Cuántas páginas puede tener mi currículum?', a: 'Hasta cuatro. Eliges de una a cuatro páginas o dejas que la composición corte las páginas sola. En Alemania lo habitual son una o dos páginas; en ciencia e ingeniería, más si hay publicaciones o una lista de proyectos. A partir de la tercera página, el panel Comprobar muestra una nota al respecto.' },
      { id: 'check', q: '¿Puedo comprobar también la carta de presentación?', a: 'Sí. El panel Comprobar lee el currículum y la carta tal como están en el PDF. En la carta mira el asunto, la fecha, el saludo, la extensión y los marcadores olvidados, y con una oferta también si aparecen el puesto y la empresa. En «Ambos» compara nombre, contacto e idioma de los dos documentos y muestra qué términos de la oferta están en cada uno. A propósito, no hay puntuación.', aLimited: 'Sí, con el Pase de candidatura, que también incluye la carta. El panel Comprobar lee el currículum y la carta tal como están en el PDF. En la carta mira el asunto, la fecha, el saludo, la extensión y los marcadores olvidados, y con una oferta también si aparecen el puesto y la empresa. En «Ambos» compara nombre, contacto e idioma de los dos documentos. El currículum lo compruebas sin pase.' },
      { id: 'langs', q: '¿En qué idiomas está la herramienta?', a: 'Currículum, carta e interfaz están en alemán, inglés, francés y español. Títulos, formatos de fecha y nombres de campos cambian con el idioma, y las cuatro versiones viven en el mismo perfil.' },
      { id: 'ai', q: '¿Puedo usar una IA?', a: 'Sí, pero no una integrada. Exportas el currículum en Markdown, dejas que lo revise el modelo de lenguaje que prefieras y lo vuelves a importar. Antes de aplicarlo ves cada cambio. Con cuenta, un asistente de IA también puede conectarse directamente por MCP.' },
      { id: 'import', q: '¿Puedo traer mi currículum actual?', a: 'Sí. La herramienta lee la exportación de datos ZIP de LinkedIn en el navegador, sin enviarla a ningún servidor, y lo mismo vale para JSON Resume y el YAML de RenderCV. Desde un PDF existente pasas por Markdown: el texto a la plantilla, que una IA lo estructure, y lo reimportas.' },
      { id: 'data', q: '¿Dónde se guardan mis datos?', a: 'Sin cuenta los guarda tu navegador, y puedes descargar una copia de seguridad cuando quieras. Con cuenta están en el servidor que aloja este sitio; la política de privacidad indica dónde está. En ambos casos el PDF se crea allí: para exportar, el documento pasa un momento por el servidor y no se guarda después. No hay rastreadores publicitarios.' },
      { id: 'host', q: '¿Puedo alojar la herramienta yo mismo?', a: 'Sí. El código fuente está en GitHub bajo AGPL-3.0, con archivos Docker para tu propio servidor. Incluye las plantillas, el servicio de PDF y el servidor MCP.' },
    ],
  },
  closing: { h1: 'Diseñado para personas,', h2: 'legible para el software.', lede: 'Empieza tu currículum directamente en el navegador y sin cuenta.', ctaSecondary: 'Ver las plantillas' },
  footer: { meta: 'Código abierto bajo AGPL-3.0 · PDF vectorial con capa de texto', imprint: 'Aviso legal', privacy: 'Privacidad', product: 'Producto', legal: 'Legal' },
  request: {
    title: 'Solicitar acceso',
    lede: 'Por ahora, las cuentas son por invitación. Cuéntanos brevemente quién eres. Cuando se apruebe, tu enlace de invitación llegará por correo.',
    name: 'Nombre', email: 'Correo', message: 'Mensaje (opcional)',
    messagePlaceholder: '¿De qué se trata? ¿Para qué usarías la herramienta?',
    submit: 'Enviar solicitud', sending: 'Enviando',
    successTitle: 'Solicitud enviada.',
    success: 'Gracias. Cuando se apruebe, recibirás tu enlace de invitación por correo.',
    close: 'Cerrar',
    errName: 'Indica tu nombre, por favor.',
    errEmail: 'Indica una dirección de correo válida.',
    errGeneric: 'No se pudo enviar. Inténtalo de nuevo más tarde.',
  },
};

export const LANDING_COPY: Record<UiLang, LandingCopy> = { de: DE, en: EN, fr: FR, es: ES };
export const LANDING_LANGS: UiLang[] = ['de', 'en', 'fr', 'es'];

/** Pfad der Startseite je Sprache: Deutsch ist die Wurzel. */
export function landingPath(lang: UiLang): string {
  return lang === 'de' ? '/' : `/${lang}/`;
}

/** Sprache aus dem Pfad einer Startseiten-Fassung, sonst null. */
export function langFromPath(pathname: string): UiLang | null {
  const m = /^\/(en|fr|es)\/?$/.exec(pathname);
  if (m) return m[1] as UiLang;
  return pathname === '/' || pathname === '' ? 'de' : null;
}

export interface FaqContext {
  brand: string;
  n: number;
  /** Preis inklusive Währung oder leer, wenn kein Angebot. */
  price: string;
  days: number;
  hasOffer: boolean;
  registrationOpen: boolean;
  /** Ersatz für die Frage „access" bei Gratis-Grenze (FREETIER_I18N). */
  limitedAccess?: Qa | null;
  /** Gratis-Grenze aktiv: Antworten mit `aLimited` nehmen diese Fassung. */
  limited?: boolean;
}

/** Die FAQ mit eingesetzten Werten. Sichtbar auf der Seite UND im JSON-LD. */
export function faqItems(lang: UiLang, ctx: FaqContext): (Qa & { id: string })[] {
  const t = LANDING_COPY[lang] ?? DE;
  const fill = (s: string) => s
    .replace(/\{brand\}/g, ctx.brand)
    .replace(/\{n\}/g, String(ctx.n))
    .replace(/\{price\}/g, ctx.price)
    .replace(/\{days\}/g, String(ctx.days));
  return t.faq.items.map(f => {
    if (f.id === 'access' && ctx.limitedAccess) return { id: f.id, q: ctx.limitedAccess.q, a: ctx.limitedAccess.a };
    let a = f.a;
    if (f.id === 'access' && ctx.registrationOpen && f.aOpen) a = f.aOpen;
    if (f.id === 'price' && (!ctx.hasOffer || !ctx.price) && f.aNoOffer) a = f.aNoOffer;
    if (ctx.limited && f.aLimited) a = f.aLimited;
    return { id: f.id, q: fill(f.q), a: fill(a) };
  });
}
