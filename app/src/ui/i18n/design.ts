/**
 * Texte der neuen Oberfläche (Kopfleiste, Schiene, Paneele, Leinwand,
 * Karussell, Export-Menü, Start-Wahl) — Gestaltungsbericht vom 08.10.2026.
 *
 * Fachwörter nach der Tabelle im Personas-Bericht ersetzt: kein
 * „Server-Bridge-Format", kein nacktes „MCP"; wo der Fachbegriff hilft, steht
 * er klein dahinter (`…Tech`).
 */
import type { UiLang } from '../i18n';

export interface DesignStrings {
  // Kopfleiste
  toProfiles: string;
  demoPill: string;
  demoPillTitle: string;
  savedLocal: string;
  docGroup: string;
  zoomGroup: string;
  zoomFit: string;
  pdfDownload: string;
  pdfBusy: string;
  pdfMore: string;
  pdfDone: (pages: number, kb: number) => string;
  pdfFailed: (reason: string) => string;
  more: string;
  // Schiene und Paneele
  railLabel: string;
  content: string; design: string; check: string; tips: string; exportAll: string;
  closePanel: string;
  docLang: string;
  // Gestaltung
  templatesMeta: (n: number, colors: number) => string;
  template: string;
  keepContent: string;
  filterAll: string;
  cat: Record<'klassisch' | 'modern' | 'kreativ' | 'minimal', string>;
  accent: string; accentAuto: string; paper: string; paperAuto: string;
  rowType: string; rowPage: string; rowSections: string;
  typeFromTemplate: string;
  back: string;
  visible: (n: number) => string;
  pagesLabel: (n: number) => string;
  formats: Record<string, string>;
  // Schrift und Größe
  fontSize: string; typeface: string; under8pt: string;
  pairingAuto: string;
  // Seite
  format: string; pageCount: string;
  pageModes: { one: string; two: string; three: string; four: string; auto: string };
  pageModeHelp: { one: string; two: string; three: string; four: string; auto: string };
  fitOverflow: (wish: string, pages: number, floorPt: string, oneToTwo: boolean) => string;
  fitCondensed: (pagesText: string, pt: string) => string;
  fitOk: (pagesText: string, pt: string) => string;
  pagesText: (n: number) => string;
  lastPageThin: (page: number, pct: number) => string;
  cutChars: string;
  cutsHopeless: string;
  // Abschnitte
  sectionNames: Record<string, string>;
  useTemplateOrder: string;
  useTemplateOrderHint: string;
  orderHint: string;
  moveUp: (s: string) => string;
  moveDown: (s: string) => string;
  shown: string; hidden: string;
  showSection: (s: string) => string; hideSection: (s: string) => string;
  pageOf: (n: number) => string;
  // ATS
  atsLine: { high: string; medium: string; low: string };
  loadAts: string;
  recommended: string;
  // Export-Menü
  secPdf: string; secPortals: string; secMore: string; secDev: string;
  wordAts: string; wordAtsSub: string;
  wordDesign: string; wordDesignSub: string;
  html: string; htmlSub: string;
  shareLink: string; shareLinkSub: string;
  mdLabel: string; mdSub: string;
  jsonLabel: string; jsonSub: string;
  jsonResumeLabel: string; jsonResumeSub: string;
  kitLabel: string; kitSub: string;
  allWays: string; allWaysSub: string;
  clHtml: string; clMd: string;
  // Prüfen
  checkPage: string;
  checkPortals: string;
  checkRead: string; checkReadSub: string;
  checkTips: string;
  // Leinwand und Karussell
  writeHint: string;
  dismiss: string;
  escBack: string;
  carouselLabel: string;
  prevTemplate: string; nextTemplate: string;
  carouselLive: (name: string, i: number, n: number, ats: string) => string;
  carouselHint: string;
  switched: (name: string) => string;
  undo: string;
  neighbour: (name: string) => string;
  // Chips
  chipPlaceholder: string;
  chipRemove: (s: string) => string;
  chipAdded: (s: string) => string;
  chipRemoved: (s: string) => string;
  chipMarked: (s: string) => string;
  // Block-Werkzeug
  entryTools: string;
  entryUp: string; entryDown: string; entryDuplicate: string; entryDelete: string; entryAddBullet: string;
  // Start-Wahl
  startTitle: string;
  startBlank: string; startBlankDesc: string;
  startSample: string; startSampleDesc: string;
  startImport: string; startImportDesc: string;
  importPick: string;
  importKinds: string;
  importRead: (what: string) => string;
  importFailed: string;
  personName: string; personNameHint: string; personNamePlaceholder: string;
  titleLabel: string; titleHint: string;
  // Telefon
  menu: string;
}

const DE: DesignStrings = {
  toProfiles: 'Zurück zur Profilübersicht',
  demoPill: 'Demo · Konto anlegen',
  demoPillTitle: 'Demo verlassen und ein Konto anlegen',
  savedLocal: 'Im Browser gespeichert',
  docGroup: 'Dokument',
  zoomGroup: 'Zoom',
  zoomFit: 'Ganze Seite',
  pdfDownload: 'PDF herunterladen',
  pdfBusy: 'PDF wird gebaut …',
  pdfMore: 'Weitere Formate',
  pdfDone: (p, kb) => `PDF fertig · ${p === 1 ? 'eine Seite' : `${p} Seiten`} · ${kb} KB`,
  pdfFailed: r => `PDF-Export fehlgeschlagen: ${r}`,
  more: 'Mehr',
  railLabel: 'Werkzeuge',
  content: 'Inhalt', design: 'Gestaltung', check: 'Prüfen', tips: 'Tipps', exportAll: 'Export',
  closePanel: 'Paneel schließen',
  docLang: 'Sprache des Lebenslaufs',
  templatesMeta: (n, c) => `${n} Vorlagen · ${c} Farben`,
  template: 'Vorlage',
  keepContent: 'Dein Inhalt bleibt beim Wechsel',
  filterAll: 'Alle',
  cat: { klassisch: 'Klassisch', modern: 'Modern', kreativ: 'Kreativ', minimal: 'Minimal' },
  accent: 'Akzentfarbe', accentAuto: 'Vorlagenfarbe', paper: 'Papier', paperAuto: 'Papier der Vorlage',
  rowType: 'Schrift und Größe', rowPage: 'Seite', rowSections: 'Abschnitte ordnen',
  typeFromTemplate: 'Vorlage',
  back: 'Zurück',
  visible: n => `${n} sichtbar`,
  pagesLabel: n => (n === 1 ? '1 Seite' : `${n} Seiten`),
  formats: { a4: 'A4', letter: 'Letter' },
  fontSize: 'Schriftgröße', typeface: 'Schriftart',
  under8pt: 'Unter 8 pt. Personio nennt genau diese Grenze als Grund, warum ein Lebenslauf nicht ausgelesen wird. Für eine gedruckte Bewerbung an einen Menschen ist das deine Entscheidung, für ein Bewerberportal ein Risiko.',
  pairingAuto: 'Schrift der Vorlage',
  format: 'Format', pageCount: 'Seitenzahl',
  pageModes: { one: '1 Seite', two: '2 Seiten', three: '3', four: '4', auto: 'Auto' },
  pageModeHelp: {
    one: 'Alles auf eine Seite. Verdichtet wird gestaffelt: erst Weißraum, dann Ränder, dann Zeilenabstand, zuletzt die Schrift. Passt es dann nicht, sagt das Werkzeug es, statt weiter zu schrumpfen.',
    two: 'Bis zu zwei Seiten. Die Bundesagentur für Arbeit nennt „eine bis maximal zwei A4-Seiten" als Standard.',
    three: 'Bis zu drei Seiten. Außerhalb von Wissenschaft und Medizin unüblich; Textkernel nennt sehr lange Lebensläufe als Problemfall beim Auslesen.',
    four: 'Bis zu vier Seiten. Für Wissenschaft und Technik mit Publikationen oder Projektliste; sonst sind eine bis zwei Seiten üblich.',
    auto: 'So viele Seiten, wie der Inhalt braucht. Nichts wird verdichtet und nichts abgeschnitten. Ab der dritten Seite steht ein Hinweis dabei.',
  },
  fitOverflow: (wish, pages, floor, oneToTwo) => `Passt nicht auf ${wish}, es ${pages === 1 ? 'wird eine' : `werden ${pages}`}.${oneToTwo ? ' Das ist kein Mangel: Die Bundesagentur für Arbeit nennt eine bis maximal zwei Seiten als Standard.' : ''} Von allein wird nichts kleiner als ${floor} pt.`,
  fitCondensed: (p, pt) => `Passt auf ${p} (Schrift ${pt} pt, etwas verdichtet).`,
  fitOk: (p, pt) => `Passt auf ${p} (Schrift ${pt} pt).`,
  pagesText: n => (n === 1 ? 'eine Seite' : `${n} Seiten`),
  lastPageThin: (p, pct) => `Seite ${p} ist nur zu ${pct} % gefüllt. Eine halbe letzte Seite wirkt unfertig: entweder auf eine Seite verdichten oder die letzte Seite mit Substanz füllen.`,
  cutChars: 'Zeichen',
  cutsHopeless: 'Auch alles zusammen reicht nicht. Dann ist nicht der Text zu lang, sondern dieses Layout zu teuer: Bei einspaltigen Vorlagen stehen Kontakt, Eckdaten, Sprachen und Skills im Textfluss. Nimm zwei Seiten oder eine Vorlage mit Spalte.',
  sectionNames: { profile: 'Profil', details: 'Eckdaten', experience: 'Berufserfahrung', education: 'Ausbildung', skills: 'Skills', languages: 'Sprachen', additional: 'Weiteres' },
  useTemplateOrder: 'Reihenfolge der Vorlage verwenden',
  useTemplateOrderHint: 'Beim Wechsel der Vorlage gilt deren Reihenfolge. Aus: deine eigene Reihenfolge bleibt.',
  orderHint: 'Ziehen oder ↑ ↓ benutzen. Bei Vorlagen mit Seitenspalte stehen Skills, Sprachen und Eckdaten in der Spalte; die Reihenfolge gilt für die Hauptspalte.',
  moveUp: s => `${s} nach oben`,
  moveDown: s => `${s} nach unten`,
  shown: 'An', hidden: 'Aus',
  showSection: s => `${s} einblenden`, hideSection: s => `${s} ausblenden`,
  pageOf: n => `S. ${n}`,
  atsLine: {
    high: 'Eine Spalte. Portale lesen sie zuverlässig.',
    medium: 'Kopfband, danach eine Spalte. Portale lesen das meist richtig.',
    low: 'Für Portale: ATS-Fassung mit einem Klick.',
  },
  loadAts: 'ATS-Fassung laden',
  recommended: 'empfohlen',
  secPdf: 'PDF', secPortals: 'Für Bewerbungsportale', secMore: 'Weitere Formate', secDev: 'Für KI und Entwickler',
  wordAts: 'Word – ATS-Fassung', wordAtsSub: 'Einspaltig, ohne Tabellen und Flächen. Für Portale, die die Datei maschinell lesen.',
  wordDesign: 'Word mit Design', wordDesignSub: 'Die gewählte Vorlage in Word, zum Nachbearbeiten.',
  html: 'Webseite', htmlSub: 'Zum Ansehen und Weitergeben (HTML).',
  shareLink: 'Link zum Teilen', shareLinkSub: 'Nur lesen, ohne Anmeldung, jederzeit widerrufbar.',
  mdLabel: 'Text für KI-Korrektur', mdSub: 'Zum Einfügen in einen KI-Chat und zurück (Markdown).',
  jsonLabel: 'Datensicherung', jsonSub: 'Alle Daten, wieder einlesbar (JSON).',
  jsonResumeLabel: 'Für andere Lebenslauf-Werkzeuge', jsonResumeSub: 'Offenes Austauschformat (JSON Resume).',
  kitLabel: 'Vorlage ohne Daten', kitSub: 'Das Design zum Selbstbefüllen (ZIP).',
  allWays: 'Alle Wege: Importieren, Teilen, mit KI bearbeiten', allWaysSub: 'Öffnet das ganze Export-Paneel.',
  clHtml: 'Anschreiben als Webseite', clMd: 'Anschreiben als Text für KI-Korrektur',
  checkPage: 'Seite',
  checkPortals: 'Für Bewerbungsportale',
  checkRead: 'So liest ein Portal deinen Lebenslauf', checkReadSub: 'Lesereihenfolge und Abgleich mit einer Stellenanzeige',
  checkTips: 'Tipps mit Belegen',
  writeHint: 'Text direkt auf der Seite anklicken und schreiben',
  dismiss: 'Hinweis ausblenden',
  escBack: 'Esc: zurück zur ganzen Seite',
  carouselLabel: 'Vorlagen blättern',
  prevTemplate: 'Vorherige Vorlage', nextTemplate: 'Nächste Vorlage',
  carouselLive: (n, i, t, a) => `${n}, ${i} von ${t}, ${a}`,
  carouselHint: 'Pfeiltasten, solange die Leiste den Fokus hat',
  switched: n => `Vorlage gewechselt: ${n}`,
  undo: 'Rückgängig',
  neighbour: n => `Vorlage ${n} wählen`,
  chipPlaceholder: 'Eintrag, dann Enter oder Komma',
  chipRemove: s => `${s} entfernen`,
  chipAdded: s => `${s} hinzugefügt`,
  chipRemoved: s => `${s} entfernt`,
  chipMarked: s => `${s} markiert. Rücktaste noch einmal löscht.`,
  entryTools: 'Station bearbeiten',
  entryUp: 'Nach oben', entryDown: 'Nach unten', entryDuplicate: 'Duplizieren', entryDelete: 'Löschen', entryAddBullet: 'Punkt hinzufügen',
  startTitle: 'Wie willst du anfangen?',
  startBlank: 'Leer', startBlankDesc: 'Ein leeres Blatt in der gewählten Vorlage.',
  startSample: 'Mit Beispiel', startSampleDesc: 'Ein ausgefülltes Beispiel zum Überschreiben.',
  startImport: 'Importieren', startImportDesc: 'Vorhandenen Lebenslauf mitbringen.',
  importPick: 'Datei wählen',
  importKinds: 'LinkedIn-Datenexport (ZIP), Datensicherung (JSON), JSON Resume, Markdown, RenderCV (YAML) oder eine .tex-Datei von hier. Die Datei wird nur im Browser gelesen.',
  importRead: w => `Gelesen: ${w}`,
  importFailed: 'Diese Datei ließ sich nicht lesen. Erwartet: LinkedIn-ZIP, JSON, JSON Resume oder Markdown.',
  personName: 'Dein Name', personNameHint: 'Steht oben im Lebenslauf. Kannst du später ändern.', personNamePlaceholder: 'z. B. Alex Muster',
  titleLabel: 'Titel in deiner Übersicht', titleHint: 'Nur für dich, erscheint in keinem Dokument.',
  menu: 'Menü',
};

const EN: DesignStrings = {
  toProfiles: 'Back to your profiles',
  demoPill: 'Demo · Create account',
  demoPillTitle: 'Leave the demo and create an account',
  savedLocal: 'Saved in this browser',
  docGroup: 'Document',
  zoomGroup: 'Zoom',
  zoomFit: 'Whole page',
  pdfDownload: 'Download PDF',
  pdfBusy: 'Building PDF …',
  pdfMore: 'More formats',
  pdfDone: (p, kb) => `PDF ready · ${p === 1 ? 'one page' : `${p} pages`} · ${kb} KB`,
  pdfFailed: r => `PDF export failed: ${r}`,
  more: 'More',
  railLabel: 'Tools',
  content: 'Content', design: 'Design', check: 'Check', tips: 'Tips', exportAll: 'Export',
  closePanel: 'Close panel',
  docLang: 'Language of the CV',
  templatesMeta: (n, c) => `${n} templates · ${c} colours`,
  template: 'Template',
  keepContent: 'Your content stays when you switch',
  filterAll: 'All',
  cat: { klassisch: 'Classic', modern: 'Modern', kreativ: 'Creative', minimal: 'Minimal' },
  accent: 'Accent colour', accentAuto: 'Template colour', paper: 'Paper', paperAuto: 'Template paper',
  rowType: 'Type and size', rowPage: 'Page', rowSections: 'Order sections',
  typeFromTemplate: 'Template',
  back: 'Back',
  visible: n => `${n} visible`,
  pagesLabel: n => (n === 1 ? '1 page' : `${n} pages`),
  formats: { a4: 'A4', letter: 'Letter' },
  fontSize: 'Font size', typeface: 'Typeface',
  under8pt: 'Below 8 pt. Personio names exactly this limit as a reason a CV is not parsed. For a printed application to a person that is your call; for an applicant portal it is a risk.',
  pairingAuto: 'Template typeface',
  format: 'Format', pageCount: 'Pages',
  pageModes: { one: '1 page', two: '2 pages', three: '3', four: '4', auto: 'Auto' },
  pageModeHelp: {
    one: 'Everything on one page. Condensing is staged: white space first, then margins, then line spacing, type last. If it still does not fit, the tool says so instead of shrinking further.',
    two: 'Up to two pages. The German Federal Employment Agency names "one to at most two A4 pages" as the norm.',
    three: 'Up to three pages. Unusual outside academia and medicine; Textkernel names very long CVs as a parsing problem.',
    four: 'Up to four pages. For academia and engineering with publications or a project list; otherwise one to two pages are usual.',
    auto: 'As many pages as the content needs. Nothing is condensed and nothing is cut. From the third page on, a note appears.',
  },
  fitOverflow: (wish, pages, floor, oneToTwo) => `Does not fit on ${wish}; it becomes ${pages === 1 ? 'one' : pages}.${oneToTwo ? ' That is not a flaw: one to at most two pages is the norm.' : ''} Nothing gets smaller than ${floor} pt by itself.`,
  fitCondensed: (p, pt) => `Fits on ${p} (type ${pt} pt, slightly condensed).`,
  fitOk: (p, pt) => `Fits on ${p} (type ${pt} pt).`,
  pagesText: n => (n === 1 ? 'one page' : `${n} pages`),
  lastPageThin: (p, pct) => `Page ${p} is only ${pct} % full. A half-empty last page looks unfinished: condense to one page or give the last page substance.`,
  cutChars: 'characters',
  cutsHopeless: 'Even all of it together is not enough. Then the text is not too long, the layout is too expensive: single-column templates carry contact, details, languages and skills in the flow. Use two pages or a template with a column.',
  sectionNames: { profile: 'Profile', details: 'Details', experience: 'Experience', education: 'Education', skills: 'Skills', languages: 'Languages', additional: 'Additional' },
  useTemplateOrder: 'Use the template’s order',
  useTemplateOrderHint: 'Switching templates applies their order. Off: your own order stays.',
  orderHint: 'Drag or use ↑ ↓. In templates with a side column, skills, languages and details live in the column; the order applies to the main column.',
  moveUp: s => `Move ${s} up`,
  moveDown: s => `Move ${s} down`,
  shown: 'On', hidden: 'Off',
  showSection: s => `Show ${s}`, hideSection: s => `Hide ${s}`,
  pageOf: n => `p. ${n}`,
  atsLine: {
    high: 'One column. Portals read it reliably.',
    medium: 'Header band, then one column. Portals usually read it correctly.',
    low: 'For portals: the ATS version in one click.',
  },
  loadAts: 'Get ATS version',
  recommended: 'recommended',
  secPdf: 'PDF', secPortals: 'For applicant portals', secMore: 'More formats', secDev: 'For AI and developers',
  wordAts: 'Word – ATS version', wordAtsSub: 'Single column, no tables or fills. For portals that read the file by machine.',
  wordDesign: 'Word with design', wordDesignSub: 'The chosen template in Word, for editing.',
  html: 'Web page', htmlSub: 'To view and pass on (HTML).',
  shareLink: 'Share link', shareLinkSub: 'Read-only, no sign-in, revocable at any time.',
  mdLabel: 'Text for AI proofreading', mdSub: 'To paste into an AI chat and back (Markdown).',
  jsonLabel: 'Backup', jsonSub: 'All data, can be read back in (JSON).',
  jsonResumeLabel: 'For other résumé tools', jsonResumeSub: 'Open exchange format (JSON Resume).',
  kitLabel: 'Template without data', kitSub: 'The design to fill in yourself (ZIP).',
  allWays: 'All ways: import, share, edit with AI', allWaysSub: 'Opens the full export panel.',
  clHtml: 'Cover letter as web page', clMd: 'Cover letter as text for AI proofreading',
  checkPage: 'Page',
  checkPortals: 'For applicant portals',
  checkRead: 'How a portal reads your CV', checkReadSub: 'Reading order and match against a job ad',
  checkTips: 'Tips with sources',
  writeHint: 'Click any text on the page and write',
  dismiss: 'Hide hint',
  escBack: 'Esc: back to the whole page',
  carouselLabel: 'Browse templates',
  prevTemplate: 'Previous template', nextTemplate: 'Next template',
  carouselLive: (n, i, t, a) => `${n}, ${i} of ${t}, ${a}`,
  carouselHint: 'Arrow keys while the bar has focus',
  switched: n => `Template changed: ${n}`,
  undo: 'Undo',
  neighbour: n => `Choose template ${n}`,
  chipPlaceholder: 'Entry, then Enter or comma',
  chipRemove: s => `Remove ${s}`,
  chipAdded: s => `${s} added`,
  chipRemoved: s => `${s} removed`,
  chipMarked: s => `${s} selected. Backspace again deletes it.`,
  entryTools: 'Edit entry',
  entryUp: 'Move up', entryDown: 'Move down', entryDuplicate: 'Duplicate', entryDelete: 'Delete', entryAddBullet: 'Add bullet',
  startTitle: 'How do you want to start?',
  startBlank: 'Blank', startBlankDesc: 'An empty sheet in the chosen template.',
  startSample: 'With example', startSampleDesc: 'A filled-in example to overwrite.',
  startImport: 'Import', startImportDesc: 'Bring an existing CV.',
  importPick: 'Choose file',
  importKinds: 'LinkedIn data export (ZIP), backup (JSON), JSON Resume, Markdown, RenderCV (YAML) or a .tex file exported here. The file is only read in the browser.',
  importRead: w => `Read: ${w}`,
  importFailed: 'This file could not be read. Expected: LinkedIn ZIP, JSON, JSON Resume or Markdown.',
  personName: 'Your name', personNameHint: 'Appears at the top of the CV. You can change it later.', personNamePlaceholder: 'e.g. Alex Sample',
  titleLabel: 'Title in your overview', titleHint: 'Only for you, appears in no document.',
  menu: 'Menu',
};

const FR: DesignStrings = {
  toProfiles: 'Retour aux profils',
  demoPill: 'Démo · Créer un compte',
  demoPillTitle: 'Quitter la démo et créer un compte',
  savedLocal: 'Enregistré dans ce navigateur',
  docGroup: 'Document',
  zoomGroup: 'Zoom',
  zoomFit: 'Page entière',
  pdfDownload: 'Télécharger le PDF',
  pdfBusy: 'Création du PDF …',
  pdfMore: 'Autres formats',
  pdfDone: (p, kb) => `PDF prêt · ${p === 1 ? 'une page' : `${p} pages`} · ${kb} Ko`,
  pdfFailed: r => `Échec de l’export PDF : ${r}`,
  more: 'Plus',
  railLabel: 'Outils',
  content: 'Contenu', design: 'Mise en page', check: 'Vérifier', tips: 'Astuces', exportAll: 'Export',
  closePanel: 'Fermer le panneau',
  docLang: 'Langue du CV',
  templatesMeta: (n, c) => `${n} modèles · ${c} couleurs`,
  template: 'Modèle',
  keepContent: 'Votre contenu reste au changement',
  filterAll: 'Tous',
  cat: { klassisch: 'Classique', modern: 'Moderne', kreativ: 'Créatif', minimal: 'Minimal' },
  accent: 'Couleur d’accent', accentAuto: 'Couleur du modèle', paper: 'Papier', paperAuto: 'Papier du modèle',
  rowType: 'Police et taille', rowPage: 'Page', rowSections: 'Ordonner les sections',
  typeFromTemplate: 'Modèle',
  back: 'Retour',
  visible: n => `${n} visibles`,
  pagesLabel: n => (n === 1 ? '1 page' : `${n} pages`),
  formats: { a4: 'A4', letter: 'Letter' },
  fontSize: 'Taille du texte', typeface: 'Police',
  under8pt: 'Moins de 8 pt. Personio cite précisément cette limite comme raison pour laquelle un CV n’est pas lu. Pour une candidature imprimée, c’est votre choix ; pour un portail, c’est un risque.',
  pairingAuto: 'Police du modèle',
  format: 'Format', pageCount: 'Nombre de pages',
  pageModes: { one: '1 page', two: '2 pages', three: '3', four: '4', auto: 'Auto' },
  pageModeHelp: {
    one: 'Tout sur une page. La compression est progressive : d’abord les blancs, puis les marges, puis l’interligne, enfin la police. Si cela ne suffit pas, l’outil le dit au lieu de réduire encore.',
    two: 'Jusqu’à deux pages. L’agence fédérale allemande pour l’emploi cite « une à deux pages A4 au maximum » comme norme.',
    three: 'Jusqu’à trois pages. Inhabituel hors recherche et médecine ; Textkernel cite les CV très longs comme cas problématique.',
    four: 'Jusqu’à quatre pages. Pour la recherche et la technique, avec publications ou liste de projets ; sinon une à deux pages sont l’usage.',
    auto: 'Autant de pages que nécessaire. Rien n’est compressé ni coupé. À partir de la troisième page, une remarque s’affiche.',
  },
  fitOverflow: (wish, pages, floor, oneToTwo) => `Ne tient pas sur ${wish} : cela fait ${pages === 1 ? 'une page' : `${pages} pages`}.${oneToTwo ? ' Ce n’est pas un défaut : une à deux pages est la norme.' : ''} Rien ne descend seul sous ${floor} pt.`,
  fitCondensed: (p, pt) => `Tient sur ${p} (texte ${pt} pt, un peu compressé).`,
  fitOk: (p, pt) => `Tient sur ${p} (texte ${pt} pt).`,
  pagesText: n => (n === 1 ? 'une page' : `${n} pages`),
  lastPageThin: (p, pct) => `La page ${p} n’est remplie qu’à ${pct} %. Une dernière page à moitié vide paraît inachevée : compresser sur une page ou étoffer la dernière.`,
  cutChars: 'caractères',
  cutsHopeless: 'Même tout cela ne suffit pas. Ce n’est alors pas le texte qui est trop long, mais la mise en page trop coûteuse : les modèles à une colonne placent contact, informations, langues et compétences dans le flux. Prenez deux pages ou un modèle avec colonne.',
  sectionNames: { profile: 'Profil', details: 'Informations', experience: 'Expérience', education: 'Formation', skills: 'Compétences', languages: 'Langues', additional: 'Divers' },
  useTemplateOrder: 'Utiliser l’ordre du modèle',
  useTemplateOrderHint: 'En changeant de modèle, son ordre s’applique. Désactivé : votre ordre est conservé.',
  orderHint: 'Glisser ou utiliser ↑ ↓. Dans les modèles à colonne latérale, compétences, langues et informations sont dans la colonne ; l’ordre vaut pour la colonne principale.',
  moveUp: s => `Monter ${s}`,
  moveDown: s => `Descendre ${s}`,
  shown: 'Oui', hidden: 'Non',
  showSection: s => `Afficher ${s}`, hideSection: s => `Masquer ${s}`,
  pageOf: n => `p. ${n}`,
  atsLine: {
    high: 'Une colonne. Les portails la lisent de façon fiable.',
    medium: 'Bandeau, puis une colonne. Les portails le lisent généralement bien.',
    low: 'Pour les portails : la version ATS en un clic.',
  },
  loadAts: 'Version ATS',
  recommended: 'recommandé',
  secPdf: 'PDF', secPortals: 'Pour les portails de candidature', secMore: 'Autres formats', secDev: 'Pour l’IA et les développeurs',
  wordAts: 'Word – version ATS', wordAtsSub: 'Une colonne, sans tableaux ni aplats. Pour les portails qui lisent le fichier automatiquement.',
  wordDesign: 'Word avec mise en page', wordDesignSub: 'Le modèle choisi dans Word, pour retoucher.',
  html: 'Page web', htmlSub: 'Pour consulter et transmettre (HTML).',
  shareLink: 'Lien de partage', shareLinkSub: 'Lecture seule, sans connexion, révocable à tout moment.',
  mdLabel: 'Texte pour relecture par IA', mdSub: 'À coller dans un chat d’IA et retour (Markdown).',
  jsonLabel: 'Sauvegarde', jsonSub: 'Toutes les données, réimportables (JSON).',
  jsonResumeLabel: 'Pour d’autres outils de CV', jsonResumeSub: 'Format d’échange ouvert (JSON Resume).',
  kitLabel: 'Modèle sans données', kitSub: 'La mise en page à remplir soi-même (ZIP).',
  allWays: 'Tout : importer, partager, retravailler avec l’IA', allWaysSub: 'Ouvre le panneau d’export complet.',
  clHtml: 'Lettre en page web', clMd: 'Lettre en texte pour relecture par IA',
  checkPage: 'Page',
  checkPortals: 'Pour les portails de candidature',
  checkRead: 'Comment un portail lit votre CV', checkReadSub: 'Ordre de lecture et comparaison avec une offre',
  checkTips: 'Astuces sourcées',
  writeHint: 'Cliquez sur un texte de la page et écrivez',
  dismiss: 'Masquer l’astuce',
  escBack: 'Échap : retour à la page entière',
  carouselLabel: 'Parcourir les modèles',
  prevTemplate: 'Modèle précédent', nextTemplate: 'Modèle suivant',
  carouselLive: (n, i, t, a) => `${n}, ${i} sur ${t}, ${a}`,
  carouselHint: 'Flèches tant que la barre a le focus',
  switched: n => `Modèle changé : ${n}`,
  undo: 'Annuler',
  neighbour: n => `Choisir le modèle ${n}`,
  chipPlaceholder: 'Saisie, puis Entrée ou virgule',
  chipRemove: s => `Retirer ${s}`,
  chipAdded: s => `${s} ajouté`,
  chipRemoved: s => `${s} retiré`,
  chipMarked: s => `${s} sélectionné. Retour arrière à nouveau le supprime.`,
  entryTools: 'Modifier le poste',
  entryUp: 'Monter', entryDown: 'Descendre', entryDuplicate: 'Dupliquer', entryDelete: 'Supprimer', entryAddBullet: 'Ajouter un point',
  startTitle: 'Comment voulez-vous commencer ?',
  startBlank: 'Vide', startBlankDesc: 'Une page vierge dans le modèle choisi.',
  startSample: 'Avec exemple', startSampleDesc: 'Un exemple rempli à remplacer.',
  startImport: 'Importer', startImportDesc: 'Apporter un CV existant.',
  importPick: 'Choisir un fichier',
  importKinds: 'Export LinkedIn (ZIP), sauvegarde (JSON), JSON Resume, Markdown, RenderCV (YAML) ou un fichier .tex exporté ici. Le fichier est lu uniquement dans le navigateur.',
  importRead: w => `Lu : ${w}`,
  importFailed: 'Impossible de lire ce fichier. Attendu : ZIP LinkedIn, JSON, JSON Resume ou Markdown.',
  personName: 'Votre nom', personNameHint: 'Apparaît en haut du CV. Modifiable ensuite.', personNamePlaceholder: 'p. ex. Alex Martin',
  titleLabel: 'Titre dans votre liste', titleHint: 'Pour vous seulement, n’apparaît dans aucun document.',
  menu: 'Menu',
};

const ES: DesignStrings = {
  toProfiles: 'Volver a los perfiles',
  demoPill: 'Demo · Crear cuenta',
  demoPillTitle: 'Salir de la demo y crear una cuenta',
  savedLocal: 'Guardado en este navegador',
  docGroup: 'Documento',
  zoomGroup: 'Zoom',
  zoomFit: 'Página entera',
  pdfDownload: 'Descargar PDF',
  pdfBusy: 'Creando el PDF …',
  pdfMore: 'Más formatos',
  pdfDone: (p, kb) => `PDF listo · ${p === 1 ? 'una página' : `${p} páginas`} · ${kb} KB`,
  pdfFailed: r => `Falló la exportación PDF: ${r}`,
  more: 'Más',
  railLabel: 'Herramientas',
  content: 'Contenido', design: 'Diseño', check: 'Revisar', tips: 'Consejos', exportAll: 'Exportar',
  closePanel: 'Cerrar panel',
  docLang: 'Idioma del CV',
  templatesMeta: (n, c) => `${n} plantillas · ${c} colores`,
  template: 'Plantilla',
  keepContent: 'Tu contenido se mantiene al cambiar',
  filterAll: 'Todas',
  cat: { klassisch: 'Clásica', modern: 'Moderna', kreativ: 'Creativa', minimal: 'Mínima' },
  accent: 'Color de acento', accentAuto: 'Color de la plantilla', paper: 'Papel', paperAuto: 'Papel de la plantilla',
  rowType: 'Letra y tamaño', rowPage: 'Página', rowSections: 'Ordenar secciones',
  typeFromTemplate: 'Plantilla',
  back: 'Atrás',
  visible: n => `${n} visibles`,
  pagesLabel: n => (n === 1 ? '1 página' : `${n} páginas`),
  formats: { a4: 'A4', letter: 'Letter' },
  fontSize: 'Tamaño de letra', typeface: 'Tipografía',
  under8pt: 'Menos de 8 pt. Personio menciona justo este límite como motivo de que un CV no se lea. Para una candidatura impresa es tu decisión; para un portal, un riesgo.',
  pairingAuto: 'Tipografía de la plantilla',
  format: 'Formato', pageCount: 'Páginas',
  pageModes: { one: '1 página', two: '2 páginas', three: '3', four: '4', auto: 'Auto' },
  pageModeHelp: {
    one: 'Todo en una página. Se condensa por etapas: primero el espacio en blanco, luego los márgenes, luego el interlineado y por último la letra. Si aun así no cabe, la herramienta lo dice en vez de seguir reduciendo.',
    two: 'Hasta dos páginas. La Agencia Federal de Empleo alemana indica «de una a dos páginas A4 como máximo» como estándar.',
    three: 'Hasta tres páginas. Poco habitual fuera de la investigación y la medicina; Textkernel menciona los CV muy largos como caso problemático.',
    four: 'Hasta cuatro páginas. Para ciencia y tecnología con publicaciones o lista de proyectos; si no, lo habitual son una o dos páginas.',
    auto: 'Tantas páginas como necesite el contenido. No se condensa ni se corta nada. A partir de la tercera página aparece una nota.',
  },
  fitOverflow: (wish, pages, floor, oneToTwo) => `No cabe en ${wish}; quedan ${pages === 1 ? 'una página' : `${pages} páginas`}.${oneToTwo ? ' No es un defecto: de una a dos páginas es lo estándar.' : ''} Nada baja solo de ${floor} pt.`,
  fitCondensed: (p, pt) => `Cabe en ${p} (letra ${pt} pt, algo condensada).`,
  fitOk: (p, pt) => `Cabe en ${p} (letra ${pt} pt).`,
  pagesText: n => (n === 1 ? 'una página' : `${n} páginas`),
  lastPageThin: (p, pct) => `La página ${p} solo está llena al ${pct} %. Una última página a medias parece sin terminar: condensa a una página o dale contenido a la última.`,
  cutChars: 'caracteres',
  cutsHopeless: 'Ni todo junto alcanza. Entonces no es el texto lo que sobra, sino que el diseño es demasiado costoso: las plantillas de una columna llevan contacto, datos, idiomas y habilidades en el flujo. Usa dos páginas o una plantilla con columna.',
  sectionNames: { profile: 'Perfil', details: 'Datos', experience: 'Experiencia', education: 'Formación', skills: 'Habilidades', languages: 'Idiomas', additional: 'Otros' },
  useTemplateOrder: 'Usar el orden de la plantilla',
  useTemplateOrderHint: 'Al cambiar de plantilla se aplica su orden. Desactivado: se mantiene tu orden.',
  orderHint: 'Arrastra o usa ↑ ↓. En plantillas con columna lateral, habilidades, idiomas y datos van en la columna; el orden vale para la columna principal.',
  moveUp: s => `Subir ${s}`,
  moveDown: s => `Bajar ${s}`,
  shown: 'Sí', hidden: 'No',
  showSection: s => `Mostrar ${s}`, hideSection: s => `Ocultar ${s}`,
  pageOf: n => `p. ${n}`,
  atsLine: {
    high: 'Una columna. Los portales la leen de forma fiable.',
    medium: 'Banda superior y luego una columna. Los portales suelen leerla bien.',
    low: 'Para portales: la versión ATS con un clic.',
  },
  loadAts: 'Versión ATS',
  recommended: 'recomendado',
  secPdf: 'PDF', secPortals: 'Para portales de empleo', secMore: 'Más formatos', secDev: 'Para IA y desarrolladores',
  wordAts: 'Word – versión ATS', wordAtsSub: 'Una columna, sin tablas ni fondos. Para portales que leen el archivo automáticamente.',
  wordDesign: 'Word con diseño', wordDesignSub: 'La plantilla elegida en Word, para retocar.',
  html: 'Página web', htmlSub: 'Para ver y compartir (HTML).',
  shareLink: 'Enlace para compartir', shareLinkSub: 'Solo lectura, sin inicio de sesión, revocable en cualquier momento.',
  mdLabel: 'Texto para corrección con IA', mdSub: 'Para pegar en un chat de IA y volver (Markdown).',
  jsonLabel: 'Copia de seguridad', jsonSub: 'Todos los datos, se pueden volver a importar (JSON).',
  jsonResumeLabel: 'Para otras herramientas de CV', jsonResumeSub: 'Formato de intercambio abierto (JSON Resume).',
  kitLabel: 'Plantilla sin datos', kitSub: 'El diseño para rellenar tú (ZIP).',
  allWays: 'Todo: importar, compartir, editar con IA', allWaysSub: 'Abre el panel de exportación completo.',
  clHtml: 'Carta como página web', clMd: 'Carta como texto para corrección con IA',
  checkPage: 'Página',
  checkPortals: 'Para portales de empleo',
  checkRead: 'Cómo lee un portal tu CV', checkReadSub: 'Orden de lectura y comparación con una oferta',
  checkTips: 'Consejos con fuentes',
  writeHint: 'Haz clic en cualquier texto de la página y escribe',
  dismiss: 'Ocultar aviso',
  escBack: 'Esc: volver a la página entera',
  carouselLabel: 'Hojear plantillas',
  prevTemplate: 'Plantilla anterior', nextTemplate: 'Plantilla siguiente',
  carouselLive: (n, i, t, a) => `${n}, ${i} de ${t}, ${a}`,
  carouselHint: 'Flechas mientras la barra tenga el foco',
  switched: n => `Plantilla cambiada: ${n}`,
  undo: 'Deshacer',
  neighbour: n => `Elegir la plantilla ${n}`,
  chipPlaceholder: 'Entrada, luego Intro o coma',
  chipRemove: s => `Quitar ${s}`,
  chipAdded: s => `${s} añadido`,
  chipRemoved: s => `${s} quitado`,
  chipMarked: s => `${s} seleccionado. Retroceso otra vez lo borra.`,
  entryTools: 'Editar puesto',
  entryUp: 'Subir', entryDown: 'Bajar', entryDuplicate: 'Duplicar', entryDelete: 'Eliminar', entryAddBullet: 'Añadir punto',
  startTitle: '¿Cómo quieres empezar?',
  startBlank: 'Vacío', startBlankDesc: 'Una hoja en blanco con la plantilla elegida.',
  startSample: 'Con ejemplo', startSampleDesc: 'Un ejemplo relleno para sobrescribir.',
  startImport: 'Importar', startImportDesc: 'Trae un CV existente.',
  importPick: 'Elegir archivo',
  importKinds: 'Exportación de LinkedIn (ZIP), copia de seguridad (JSON), JSON Resume, Markdown, RenderCV (YAML) o un archivo .tex exportado aquí. El archivo solo se lee en el navegador.',
  importRead: w => `Leído: ${w}`,
  importFailed: 'No se pudo leer este archivo. Se espera: ZIP de LinkedIn, JSON, JSON Resume o Markdown.',
  personName: 'Tu nombre', personNameHint: 'Aparece arriba en el CV. Puedes cambiarlo después.', personNamePlaceholder: 'p. ej. Alex García',
  titleLabel: 'Título en tu lista', titleHint: 'Solo para ti, no aparece en ningún documento.',
  menu: 'Menú',
};

export const DESIGN_I18N: Record<UiLang, DesignStrings> = { de: DE, en: EN, fr: FR, es: ES };
