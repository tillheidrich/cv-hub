/**
 * Texte des Export-Panels (`src/export/ExportPanel.tsx`).
 *
 * Eigene Datei, weil das Panel groß ist und fast nur aus Text besteht: Neben
 * den Schaltflächen hängen hier Fehlermeldungen, zwei Bestätigungsdialoge, die
 * Beschriftungen der Gegenüberstellung und die KI-Prompts. In `editorI18n.ts`
 * dazwischengeschoben wäre das nicht mehr zu überblicken.
 *
 * Aufbau wie beim `SHARE`-Block in `editorI18n.ts`: ein Interface, eine
 * Tabelle über alle vier Oberflächensprachen. Zusammengesetzte Sätze stehen
 * als Funktion in der Tabelle — wer Zeichenketten im Code zusammenklebt,
 * schreibt die Wortstellung einer Sprache fest, und das geht spätestens beim
 * Französischen schief.
 *
 * Nicht hier drin, und mit Absicht: `coverWord`/`cvWord` im Panel. Die folgen
 * der Sprache des DOKUMENTS, nicht der der Oberfläche — auf einem englischen
 * Lebenslauf steht „Curriculum Vitae", auch wenn die Bedienung deutsch ist.
 */
import type { UiLang } from '../i18n';

export interface ExportStrings {
  /** Kopfzeile */
  exportTitle: (doc: string) => string;
  exportSubtitle: string;

  /** Statuskasten */
  statusLabel: string;
  statusDocument: string;
  statusName: string;
  statusLanguage: string;
  statusTemplate: string;

  /** PDF */
  pdfSection: string;
  pdfBuilding: string;
  pdfDownload: (doc: string) => string;
  pdfReady: (pages: number, kb: number) => string;
  pdfFailed: (reason: string) => string;
  pdfUnknownError: string;
  pdfServiceError: string;
  pdfHint: string;
  atsCheck: string;

  /** Weitere Formate */
  moreFormats: string;
  buttonBusy: string;
  clHtmlSub: string;
  clMdSub: string;
  docxSub: string;
  docxAtsLabel: string;
  docxAtsSub: string;
  htmlSub: string;
  mdSub: string;
  jsonSub: string;
  jsonResumeSub: string;
  kitLabel: string;
  kitSub: string;

  /** Lebenslauf mitbringen (LinkedIn) */
  bringCv: string;
  bringCvHint: string;
  liReading: string;
  liLabel: string;
  liSub: string;
  liRequest: string;
  liReadError: string;
  liModalTitle: string;
  liModalBody: string;
  liNoDiff: string;
  countStations: string;
  countEducation: string;
  countSkills: string;
  countLanguages: string;

  /** Importieren */
  importSection: string;
  importHintCl: string;
  importHintCv: string;
  uploadMd: string;
  uploadMdSubCl: string;
  uploadMdSubCv: string;
  emptyMdTemplate: string;
  emptyMdTemplateSub: string;
  uploadJson: string;
  uploadJsonSub: string;

  /** Demo-Modus */
  demoSection: string;
  demoBefore: string;
  demoStrong: string;
  demoAfter: string;
  demoCta: string;

  /** Link teilen */
  shareSection: string;
  shareHint: string;
  shareIncludeCl: string;
  shareCreate: string;
  shareNone: string;
  shareCopied: string;
  shareCopy: string;
  shareRevoke: string;
  shareViewsSuffix: string;
  shareLastAccess: (when: string) => string;
  shareExpires: (date: string) => string;
  shareUnknownUa: string;
  shareClVisible: string;
  shareRevokeConfirm: string;
  shareError: string;

  /** Zeitangaben */
  never: string;
  justNow: string;
  minutesAgo: (m: number) => string;
  hoursAgo: (h: number) => string;
  daysAgo: (d: number) => string;
  /** Gebietsschema für Datum und Uhrzeit. */
  locale: string;

  /** Mit KI bearbeiten */
  aiSection: string;
  aiHintCl: string;
  aiHintCv: string;
  aiNeedLink: string;
  aiPromptCopied: string;
  aiCopyPrompt: string;
  aiOpenChatgpt: string;
  aiOpenClaude: string;
  aiOpenGemini: string;
  aiGeminiTitle: string;
  aiImportBack: string;

  /** Prompts, die in den KI-Chat wandern */
  promptResumeInline: (md: string) => string;
  promptResumeUrl: (url: string) => string;
  promptCoverUrl: (url: string) => string;

  /** Import-Dialog */
  modalReviewTitle: string;
  modalImportClTitle: string;
  modalImportCvTitle: string;
  modalReviewBody: string;
  modalImportClBody: string;
  modalImportCvBody: string;
  mdPlaceholder: string;
  noChanges: string;
  valueBefore: string;
  valueAfter: string;
  valueEmpty: string;
  back: string;
  cancel: string;
  checking: string;
  showPreview: string;
  applying: string;
  applyChanges: string;
  apply: string;

  /** Fehlermeldungen aus diesem Panel */
  previewFailed: string;
  importFailed: string;
  serverAnswered: (status: number) => string;
  notMarkdown: string;
  serverUnreachable: string;
  mdFallbackNote: (reason: string) => string;
  clLoadFailed: (reason: string) => string;
  invalidJson: string;
  importUnavailable: string;
  noActiveProfile: string;
  unknownJsonFormat: string;
  jsonImportFailed: string;
  fileUnreadable: string;

  /** Beschriftungen der Gegenüberstellung — Lebenslauf */
  fName: string;
  fPosition: string;
  fLocation: string;
  fEmail: string;
  fPhone: string;
  fProfileText: string;
  fStations: string;
  fBulletsTotal: string;
  fEducation: string;
  fSkillGroups: string;
  fLanguages: string;

  /** Beschriftungen der Gegenüberstellung — Anschreiben */
  fClCompany: string;
  fClContact: string;
  fClSubject: string;
  fClSalutation: string;
  fClIntro: string;
  fClMain: string;
  fClCompanyRef: string;
  fClMotivation: string;
  fClClosing: string;
  fClSignoff: string;
}

export const EXP_I18N: Record<UiLang, ExportStrings> = {
  de: {
    exportTitle: (doc) => `${doc} exportieren`,
    exportSubtitle: 'Wähle Format und starte den Download',

    statusLabel: 'Wird exportiert',
    statusDocument: 'Dokument',
    statusName: 'Name',
    statusLanguage: 'Sprache',
    statusTemplate: 'Vorlage',

    pdfSection: 'Als PDF speichern',
    pdfBuilding: 'PDF wird gebaut …',
    pdfDownload: (doc) => `${doc} als PDF herunterladen`,
    pdfReady: (pages, kb) => `PDF fertig · ${pages === 1 ? 'eine Seite' : `${pages} Seiten`} · ${kb} KB. Liegt in deinem Download-Ordner.`,
    pdfFailed: (reason) => `PDF-Export fehlgeschlagen: ${reason}`,
    pdfUnknownError: 'unbekannter Fehler',
    pdfServiceError: 'PDF-Dienst-Fehler',
    pdfHint: 'Ein Klick, ein Download. Vektor-PDF, echte Textebene, kein Druckdialog — die Seiten sind exakt die aus der Vorschau.',
    atsCheck: 'ATS prüfen — so sieht eine Maschine deinen CV',

    moreFormats: 'Weitere Formate',
    buttonBusy: 'Wird gebaut…',
    clHtmlSub: 'Anschreiben als Webseite — zum Ansehen und Weitergeben. Gedruckt wird das PDF.',
    clMdSub: 'Anschreiben als .md (rund-um-bearbeitbar)',
    docxSub: 'Die gewählte Vorlage in Word — Farbfläche, Akzentfarben, Datumsspalte. Öffnet in Word und LibreOffice.',
    docxAtsLabel: 'Word — ATS-Fassung',
    docxAtsSub: 'Einspaltig, ohne Tabellen und Flächen. Für Portale, die die Datei maschinell auslesen.',
    htmlSub: 'Webseite zum Ansehen und Weitergeben. Gedruckt wird das PDF — der Browserdruck legt eigene Ränder und Kopfzeilen darüber.',
    mdSub: 'Server-Bridge-Format (rund-um-bearbeitbar)',
    jsonSub: 'Vollständige Daten, re-importierbar',
    jsonResumeSub: 'Standard-Schema (jsonresume.org) — portabel, re-importierbar',
    kitLabel: 'Vorlage ohne Daten',
    kitSub: 'ZIP mit HTML, Word, leerem JSON und Anleitung — das Design zum Selbstbefüllen, auch ohne dieses Werkzeug.',

    bringCv: 'Lebenslauf mitbringen',
    bringCvHint: 'Du musst nichts abtippen, was du schon hast. Das Archiv wird im Browser gelesen — es geht an keinen Server, auch nicht an unseren.',
    liReading: 'Lese Archiv…',
    liLabel: 'LinkedIn-Datenexport',
    liSub: 'ZIP aus „Eine Kopie deiner Daten erhalten" — Stationen, Ausbildung, Skills, Sprachen',
    liRequest: 'Archiv bei LinkedIn anfordern →',
    liReadError: 'Das Archiv ließ sich nicht lesen.',
    liModalTitle: 'Das steht im Archiv',
    liModalBody: 'Noch ist nichts ersetzt. Übernimmst du, werden Stationen, Ausbildung, Skills und Sprachen durch die aus dem Archiv ersetzt.',
    liNoDiff: 'Keine Unterschiede zum aktuellen Stand — der Import wäre folgenlos.',
    countStations: 'Stationen',
    countEducation: 'Ausbildung',
    countSkills: 'Skills',
    countLanguages: 'Sprachen',

    importSection: 'Importieren',
    importHintCl: 'Anschreiben aus Markdown wiederherstellen oder ein komplettes Profil-JSON zurückspielen.',
    importHintCv: 'Lebenslauf aus Markdown wiederherstellen oder ein komplettes Profil-JSON zurückspielen.',
    uploadMd: 'Markdown hochladen',
    uploadMdSubCl: 'Importiert ins Anschreiben',
    uploadMdSubCv: 'Importiert in den Lebenslauf',
    emptyMdTemplate: 'Leere Markdown-Vorlage',
    emptyMdTemplateSub: 'Zum Ausfüllen in deinem Editor (LM-Studio, VS Code, Obsidian …)',
    uploadJson: 'JSON hochladen',
    uploadJsonSub: 'Vollständiger Profil-Import (überschreibt aktiv)',

    demoSection: 'Demo-Modus',
    demoBefore: 'Du arbeitest gerade ohne Konto. HTML, Markdown und JSON-Export funktionieren lokal. ',
    demoStrong: 'Sharelinks und KI-Bearbeitung',
    demoAfter: ' brauchen eine Registrierung.',
    demoCta: 'Konto anlegen →',

    shareSection: 'Link teilen',
    shareHint: 'Read-only Link, kein Login nötig — auch für Anschreiben (das Anschreiben wird im Link mit angezeigt).',
    shareIncludeCl: 'Anschreiben im Link sichtbar machen',
    shareCreate: '+ Neuen Link erzeugen',
    shareNone: 'Noch keine Links.',
    shareCopied: '✓ kopiert',
    shareCopy: 'Link kopieren',
    shareRevoke: 'Widerrufen',
    shareViewsSuffix: 'Aufrufe',
    shareLastAccess: (when) => `Letzter Zugriff: ${when}`,
    shareExpires: (date) => `läuft ab ${date}`,
    shareUnknownUa: 'Unbekannt',
    shareClVisible: 'Anschreiben sichtbar',
    shareRevokeConfirm: 'Diesen Link widerrufen? Verbindungen damit funktionieren danach nicht mehr.',
    shareError: 'Fehler.',

    never: 'noch nie',
    justNow: 'gerade eben',
    minutesAgo: (m) => `vor ${m} min`,
    hoursAgo: (h) => `vor ${h} h`,
    daysAgo: (d) => `vor ${d} Tagen`,
    locale: 'de-DE',

    aiSection: 'Mit KI bearbeiten',
    aiHintCl: 'Lade dein Anschreiben oben als .md herunter und füge den Text in deinen KI-Chat ein. Die KI gibt dir eine überarbeitete Version zurück, die du hier importierst.',
    aiHintCv: 'Gib der KI deinen Lebenslauf als Markdown-Link. Sie kann ihn lesen und dir eine korrigierte Markdown-Version zurückgeben, die du hier importierst.',
    aiNeedLink: 'Erzeuge oben erst einen Link.',
    aiPromptCopied: 'Prompt kopiert',
    aiCopyPrompt: 'Prompt + Markdown-Link kopieren',
    aiOpenChatgpt: 'In ChatGPT öffnen ↗',
    aiOpenClaude: 'In Claude öffnen ↗',
    aiOpenGemini: 'In Gemini öffnen ↗',
    aiGeminiTitle: 'Prompt wird in die Zwischenablage kopiert, Gemini öffnet sich — drüben mit Cmd/Strg+V einfügen.',
    aiImportBack: '↑ Korrigierte Markdown-Version importieren',

    promptResumeInline: (md) =>
      `Hier ist mein Lebenslauf als Markdown:

${md}

Bitte:
1. Schlage Verbesserungen vor: Bullets nach Schema „Aktion + Kontext + Ergebnis/Wirkung" schärfen, Profil prägnanter machen, deutsche Bewerbungssprache. Erfinde KEINE Zahlen.
2. Gib mir am Ende eine VOLLSTÄNDIGE, aktualisierte Markdown-Version zurück — exakt im gleichen Format inkl. Frontmatter (---), damit ich sie 1:1 in mein Tool zurückimportieren kann.`,
    promptResumeUrl: (url) =>
      `Hier ist mein Lebenslauf als Markdown:
${url}

Bitte:
1. Lies meinen Lebenslauf (lade die URL oben, oder bitte mich, dir den Markdown-Text direkt einzufügen, falls du keine URLs lesen kannst).
2. Schlage Verbesserungen vor: Bullets nach Schema „Aktion + Kontext + Ergebnis/Wirkung" schärfen, Profil prägnanter machen, deutsche Bewerbungssprache. Erfinde KEINE Zahlen.
3. Gib mir am Ende eine VOLLSTÄNDIGE, aktualisierte Markdown-Version zurück — exakt im gleichen Format inkl. Frontmatter (---), damit ich sie 1:1 in mein Tool zurückimportieren kann.`,
    promptCoverUrl: (url) =>
      `Hier ist mein Anschreiben als Markdown:
${url}

Bitte:
1. Lies mein Anschreiben (lade die URL oben, oder bitte mich, den Text direkt einzufügen).
2. Verbessere Aufbau, Sprache und Tonalität für eine deutsche Bewerbung. Halte die Sektionen Einstieg / Hauptteil / Firmenbezug / Motivation / Abschluss. Erfinde KEINE Fakten.
3. Gib mir am Ende die VOLLSTÄNDIGE, überarbeitete Markdown-Version zurück — exakt im gleichen Format inkl. Frontmatter (---), damit ich sie 1:1 zurückimportieren kann.`,

    modalReviewTitle: 'Änderungen prüfen vor Übernahme',
    modalImportClTitle: 'Anschreiben aus Markdown importieren',
    modalImportCvTitle: 'Lebenslauf aus Markdown importieren',
    modalReviewBody: 'Folgende Felder ändern sich. Aktuelle Fassung wird vor der Übernahme automatisch als Version gesichert.',
    modalImportClBody: 'Füge das überarbeitete Anschreiben-Markdown ein (mit oder ohne Frontmatter). Vorhandenes Anschreiben wird überschrieben.',
    modalImportCvBody: 'Füge die von der KI zurückgegebene Markdown-Version ein. Inklusive des Frontmatter-Blocks (---). Foto bleibt erhalten. Du siehst vor der Übernahme eine Diff-Vorschau.',
    mdPlaceholder: '---\ntemplate: hamburg\nlang: de\n---\n\n# Dein Name\n**Berufsbezeichnung**\n\n## Kontakt\n…',
    noChanges: 'Keine Änderungen erkannt — Import wäre folgenlos.',
    valueBefore: 'vorher',
    valueAfter: 'nachher',
    valueEmpty: 'leer',
    back: '← Zurück',
    cancel: 'Abbrechen',
    checking: 'Prüfe…',
    showPreview: 'Vorschau anzeigen',
    applying: 'Übernehme…',
    applyChanges: 'Änderungen übernehmen',
    apply: 'Übernehmen',

    previewFailed: 'Vorschau fehlgeschlagen.',
    importFailed: 'Import fehlgeschlagen.',
    serverAnswered: (status) => `Der Server antwortete mit ${status}.`,
    notMarkdown: 'Die Antwort war kein Markdown.',
    serverUnreachable: 'Der Server war nicht erreichbar.',
    mdFallbackNote: (reason) => `${reason} Heruntergeladen wurde die lokale Fassung — sie enthält denselben Text, aber keine Server-Einstellungen.`,
    clLoadFailed: (reason) => `${reason} Das Anschreiben konnte nicht geladen werden.`,
    invalidJson: 'Ungültiges JSON',
    importUnavailable: 'Import hier nicht verfügbar.',
    noActiveProfile: 'Kein aktives Profil — bitte erst eines anlegen.',
    unknownJsonFormat: 'JSON-Format unbekannt. Erwartet: Profil-Export, JSON Resume oder CVData.',
    jsonImportFailed: 'JSON-Import fehlgeschlagen.',
    fileUnreadable: 'Datei konnte nicht gelesen werden.',

    fName: 'Name',
    fPosition: 'Position',
    fLocation: 'Ort',
    fEmail: 'E-Mail',
    fPhone: 'Telefon',
    fProfileText: 'Profiltext',
    fStations: 'Stationen',
    fBulletsTotal: 'Bullets gesamt',
    fEducation: 'Ausbildung',
    fSkillGroups: 'Skill-Gruppen',
    fLanguages: 'Sprachen',

    fClCompany: 'Empfänger-Firma',
    fClContact: 'Ansprechpartner',
    fClSubject: 'Betreff',
    fClSalutation: 'Anrede',
    fClIntro: 'Einstieg',
    fClMain: 'Hauptteil',
    fClCompanyRef: 'Firmenbezug',
    fClMotivation: 'Motivation',
    fClClosing: 'Abschluss',
    fClSignoff: 'Grußformel',
  },

  en: {
    exportTitle: (doc) => `Export ${doc}`,
    exportSubtitle: 'Pick a format and start the download',

    statusLabel: 'Being exported',
    statusDocument: 'Document',
    statusName: 'Name',
    statusLanguage: 'Language',
    statusTemplate: 'Template',

    pdfSection: 'Save as PDF',
    pdfBuilding: 'Building PDF …',
    pdfDownload: (doc) => `Download ${doc} as PDF`,
    pdfReady: (pages, kb) => `PDF ready · ${pages === 1 ? 'one page' : `${pages} pages`} · ${kb} KB. It is in your downloads folder.`,
    pdfFailed: (reason) => `PDF export failed: ${reason}`,
    pdfUnknownError: 'unknown error',
    pdfServiceError: 'PDF service error',
    pdfHint: 'One click, one download. Vector PDF, real text layer, no print dialog — the pages are exactly the ones from the preview.',
    atsCheck: 'Run the ATS check — this is how a machine sees your CV',

    moreFormats: 'More formats',
    buttonBusy: 'Building…',
    clHtmlSub: 'Cover letter as a web page — to view and pass on. For printing, use the PDF.',
    clMdSub: 'Cover letter as .md (editable everywhere)',
    docxSub: 'Your chosen template in Word — colour panel, accent colours, date column. Opens in Word and LibreOffice.',
    docxAtsLabel: 'Word — ATS version',
    docxAtsSub: 'Single column, no tables, no colour panels. For portals that read the file by machine.',
    htmlSub: 'Web page to view and pass on. For printing, use the PDF — browser printing lays its own margins and headers over it.',
    mdSub: 'Server bridge format (editable everywhere)',
    jsonSub: 'Complete data, re-importable',
    jsonResumeSub: 'Standard schema (jsonresume.org) — portable, re-importable',
    kitLabel: 'Template without data',
    kitSub: 'ZIP with HTML, Word, an empty JSON and instructions — the design to fill in yourself, even without this tool.',

    bringCv: 'Bring your own résumé',
    bringCvHint: 'You do not have to retype what you already have. The archive is read in your browser — it goes to no server, not even ours.',
    liReading: 'Reading archive…',
    liLabel: 'LinkedIn data export',
    liSub: 'ZIP from "Get a copy of your data" — positions, education, skills, languages',
    liRequest: 'Request your archive from LinkedIn →',
    liReadError: 'The archive could not be read.',
    liModalTitle: 'What is in the archive',
    liModalBody: 'Nothing has been replaced yet. If you apply this, positions, education, skills and languages will be replaced by the ones from the archive.',
    liNoDiff: 'No differences from the current state — the import would change nothing.',
    countStations: 'Positions',
    countEducation: 'Education',
    countSkills: 'Skills',
    countLanguages: 'Languages',

    importSection: 'Import',
    importHintCl: 'Restore the cover letter from Markdown, or load a complete profile JSON back in.',
    importHintCv: 'Restore the résumé from Markdown, or load a complete profile JSON back in.',
    uploadMd: 'Upload Markdown',
    uploadMdSubCl: 'Imports into the cover letter',
    uploadMdSubCv: 'Imports into the résumé',
    emptyMdTemplate: 'Empty Markdown template',
    emptyMdTemplateSub: 'To fill in with your editor (LM Studio, VS Code, Obsidian …)',
    uploadJson: 'Upload JSON',
    uploadJsonSub: 'Complete profile import (overwrites the active one)',

    demoSection: 'Demo mode',
    demoBefore: 'You are working without an account right now. HTML, Markdown and JSON export work locally. ',
    demoStrong: 'Share links and AI editing',
    demoAfter: ' need an account.',
    demoCta: 'Create an account →',

    shareSection: 'Share a link',
    shareHint: 'Read-only link, no login needed — cover letter included (it is shown inside the link).',
    shareIncludeCl: 'Show the cover letter in the link',
    shareCreate: '+ Create a new link',
    shareNone: 'No links yet.',
    shareCopied: '✓ copied',
    shareCopy: 'Copy link',
    shareRevoke: 'Revoke',
    shareViewsSuffix: 'views',
    shareLastAccess: (when) => `Last opened: ${when}`,
    shareExpires: (date) => `expires ${date}`,
    shareUnknownUa: 'Unknown',
    shareClVisible: 'Cover letter visible',
    shareRevokeConfirm: 'Revoke this link? Anyone holding it will no longer get through.',
    shareError: 'Something went wrong.',

    never: 'never',
    justNow: 'just now',
    minutesAgo: (m) => `${m} min ago`,
    hoursAgo: (h) => `${h} h ago`,
    daysAgo: (d) => `${d} days ago`,
    locale: 'en-GB',

    aiSection: 'Edit with AI',
    aiHintCl: 'Download your cover letter as .md above and paste the text into your AI chat. The AI hands you a revised version, which you import here.',
    aiHintCv: 'Give the AI your résumé as a Markdown link. It can read it and hand you a corrected Markdown version, which you import here.',
    aiNeedLink: 'Create a link above first.',
    aiPromptCopied: 'Prompt copied',
    aiCopyPrompt: 'Copy prompt + Markdown link',
    aiOpenChatgpt: 'Open in ChatGPT ↗',
    aiOpenClaude: 'Open in Claude ↗',
    aiOpenGemini: 'Open in Gemini ↗',
    aiGeminiTitle: 'The prompt is copied to your clipboard and Gemini opens — paste it there with Cmd/Ctrl+V.',
    aiImportBack: '↑ Import the corrected Markdown version',

    promptResumeInline: (md) =>
      `Here is my résumé as Markdown:

${md}

Please:
1. Suggest improvements: sharpen the bullets along "action + context + result/impact", make the profile more concise, use standard English application language. Do NOT invent any numbers.
2. At the end, give me a COMPLETE, updated Markdown version — in exactly the same format including the frontmatter (---), so I can import it straight back into my tool.`,
    promptResumeUrl: (url) =>
      `Here is my résumé as Markdown:
${url}

Please:
1. Read my résumé (load the URL above, or ask me to paste the Markdown text directly if you cannot read URLs).
2. Suggest improvements: sharpen the bullets along "action + context + result/impact", make the profile more concise, use standard English application language. Do NOT invent any numbers.
3. At the end, give me a COMPLETE, updated Markdown version — in exactly the same format including the frontmatter (---), so I can import it straight back into my tool.`,
    promptCoverUrl: (url) =>
      `Here is my cover letter as Markdown:
${url}

Please:
1. Read my cover letter (load the URL above, or ask me to paste the text directly).
2. Improve the structure, language and tone for an English-language application. Keep the sections intro / main part / company reference / motivation / closing. Do NOT invent any facts.
3. At the end, give me the COMPLETE, revised Markdown version — in exactly the same format including the frontmatter (---), so I can import it straight back.`,

    modalReviewTitle: 'Check the changes before applying',
    modalImportClTitle: 'Import cover letter from Markdown',
    modalImportCvTitle: 'Import résumé from Markdown',
    modalReviewBody: 'These fields change. The current version is saved automatically before the changes are applied.',
    modalImportClBody: 'Paste the revised cover-letter Markdown (with or without frontmatter). The existing cover letter is overwritten.',
    modalImportCvBody: 'Paste the Markdown version the AI gave back, including the frontmatter block (---). Your photo is kept. You get a diff preview before anything is applied.',
    mdPlaceholder: '---\ntemplate: hamburg\nlang: en\n---\n\n# Your name\n**Job title**\n\n## Contact\n…',
    noChanges: 'No changes detected — the import would change nothing.',
    valueBefore: 'before',
    valueAfter: 'after',
    valueEmpty: 'empty',
    back: '← Back',
    cancel: 'Cancel',
    checking: 'Checking…',
    showPreview: 'Show preview',
    applying: 'Applying…',
    applyChanges: 'Apply changes',
    apply: 'Apply',

    previewFailed: 'Preview failed.',
    importFailed: 'Import failed.',
    serverAnswered: (status) => `The server answered with ${status}.`,
    notMarkdown: 'The answer was not Markdown.',
    serverUnreachable: 'The server could not be reached.',
    mdFallbackNote: (reason) => `${reason} What was downloaded is the local version — same text, but without the server-side settings.`,
    clLoadFailed: (reason) => `${reason} The cover letter could not be loaded.`,
    invalidJson: 'Invalid JSON',
    importUnavailable: 'Import is not available here.',
    noActiveProfile: 'No active profile — create one first.',
    unknownJsonFormat: 'Unknown JSON format. Expected: profile export, JSON Resume or CVData.',
    jsonImportFailed: 'JSON import failed.',
    fileUnreadable: 'The file could not be read.',

    fName: 'Name',
    fPosition: 'Position',
    fLocation: 'Location',
    fEmail: 'Email',
    fPhone: 'Phone',
    fProfileText: 'Profile text',
    fStations: 'Positions',
    fBulletsTotal: 'Bullets in total',
    fEducation: 'Education',
    fSkillGroups: 'Skill groups',
    fLanguages: 'Languages',

    fClCompany: 'Recipient company',
    fClContact: 'Contact person',
    fClSubject: 'Subject',
    fClSalutation: 'Salutation',
    fClIntro: 'Intro',
    fClMain: 'Main part',
    fClCompanyRef: 'Company reference',
    fClMotivation: 'Motivation',
    fClClosing: 'Closing',
    fClSignoff: 'Sign-off',
  },

  fr: {
    exportTitle: (doc) => `Exporter le ${doc}`,
    exportSubtitle: 'Choisissez un format et lancez le téléchargement',

    statusLabel: 'Ce qui est exporté',
    statusDocument: 'Document',
    statusName: 'Nom',
    statusLanguage: 'Langue',
    statusTemplate: 'Modèle',

    pdfSection: 'Enregistrer en PDF',
    pdfBuilding: 'Création du PDF …',
    pdfDownload: (doc) => `Télécharger le ${doc} en PDF`,
    pdfReady: (pages, kb) => `PDF prêt · ${pages === 1 ? 'une page' : `${pages} pages`} · ${kb} Ko. Il est dans votre dossier de téléchargements.`,
    pdfFailed: (reason) => `Échec de l'export PDF : ${reason}`,
    pdfUnknownError: 'erreur inconnue',
    pdfServiceError: 'Erreur du service PDF',
    pdfHint: "Un clic, un téléchargement. PDF vectoriel, vrai calque de texte, aucune boîte de dialogue d'impression — les pages sont exactement celles de l'aperçu.",
    atsCheck: 'Lancer le contrôle ATS — voici comment une machine voit votre CV',

    moreFormats: 'Autres formats',
    buttonBusy: 'Création…',
    clHtmlSub: "Lettre de motivation en page web — à consulter et à transmettre. Pour imprimer, prenez le PDF.",
    clMdSub: 'Lettre de motivation en .md (modifiable partout)',
    docxSub: 'Le modèle choisi dans Word — aplat de couleur, couleurs d\'accent, colonne de dates. S\'ouvre dans Word et LibreOffice.',
    docxAtsLabel: 'Word — version ATS',
    docxAtsSub: 'Une seule colonne, sans tableaux ni aplats. Pour les portails qui lisent le fichier de façon automatique.',
    htmlSub: "Page web à consulter et à transmettre. Pour imprimer, prenez le PDF — l'impression du navigateur ajoute ses propres marges et en-têtes.",
    mdSub: 'Format passerelle du serveur (modifiable partout)',
    jsonSub: 'Données complètes, réimportables',
    jsonResumeSub: 'Schéma standard (jsonresume.org) — portable, réimportable',
    kitLabel: 'Modèle sans données',
    kitSub: 'ZIP avec HTML, Word, un JSON vide et un mode d\'emploi — le design à remplir soi-même, même sans cet outil.',

    bringCv: 'Apportez votre CV',
    bringCvHint: "Vous n'avez pas à retaper ce que vous avez déjà. L'archive est lue dans le navigateur — elle ne part vers aucun serveur, pas même le nôtre.",
    liReading: "Lecture de l'archive…",
    liLabel: 'Export de données LinkedIn',
    liSub: 'ZIP issu de « Obtenir une copie de vos données » — postes, formation, compétences, langues',
    liRequest: 'Demander votre archive à LinkedIn →',
    liReadError: "L'archive n'a pas pu être lue.",
    liModalTitle: "Ce que contient l'archive",
    liModalBody: "Rien n'est encore remplacé. Si vous appliquez, les postes, la formation, les compétences et les langues seront remplacés par ceux de l'archive.",
    liNoDiff: "Aucune différence avec l'état actuel — l'import ne changerait rien.",
    countStations: 'Postes',
    countEducation: 'Formation',
    countSkills: 'Compétences',
    countLanguages: 'Langues',

    importSection: 'Importer',
    importHintCl: 'Restaurer la lettre de motivation depuis un Markdown, ou recharger un profil JSON complet.',
    importHintCv: 'Restaurer le CV depuis un Markdown, ou recharger un profil JSON complet.',
    uploadMd: 'Téléverser un Markdown',
    uploadMdSubCl: 'Importe dans la lettre de motivation',
    uploadMdSubCv: 'Importe dans le CV',
    emptyMdTemplate: 'Modèle Markdown vierge',
    emptyMdTemplateSub: 'À remplir dans votre éditeur (LM Studio, VS Code, Obsidian …)',
    uploadJson: 'Téléverser un JSON',
    uploadJsonSub: 'Import complet du profil (écrase le profil actif)',

    demoSection: 'Mode démo',
    demoBefore: "Vous travaillez sans compte pour l'instant. L'export HTML, Markdown et JSON fonctionne en local. ",
    demoStrong: "Les liens de partage et l'édition par IA",
    demoAfter: ' demandent un compte.',
    demoCta: 'Créer un compte →',

    shareSection: 'Partager un lien',
    shareHint: 'Lien en lecture seule, sans connexion — lettre de motivation comprise (elle est affichée dans le lien).',
    shareIncludeCl: 'Afficher la lettre de motivation dans le lien',
    shareCreate: '+ Créer un nouveau lien',
    shareNone: 'Aucun lien pour le moment.',
    shareCopied: '✓ copié',
    shareCopy: 'Copier le lien',
    shareRevoke: 'Révoquer',
    shareViewsSuffix: 'consultations',
    shareLastAccess: (when) => `Dernier accès : ${when}`,
    shareExpires: (date) => `expire le ${date}`,
    shareUnknownUa: 'Inconnu',
    shareClVisible: 'Lettre de motivation visible',
    shareRevokeConfirm: 'Révoquer ce lien ? Ceux qui le détiennent ne passeront plus.',
    shareError: 'Une erreur est survenue.',

    never: 'jamais',
    justNow: "à l'instant",
    minutesAgo: (m) => `il y a ${m} min`,
    hoursAgo: (h) => `il y a ${h} h`,
    daysAgo: (d) => `il y a ${d} jours`,
    locale: 'fr-FR',

    aiSection: "Retravailler avec l'IA",
    aiHintCl: "Téléchargez votre lettre en .md ci-dessus et collez le texte dans votre chat IA. L'IA vous rend une version retravaillée, que vous importez ici.",
    aiHintCv: "Donnez votre CV à l'IA sous forme de lien Markdown. Elle peut le lire et vous rendre une version Markdown corrigée, que vous importez ici.",
    aiNeedLink: "Créez d'abord un lien ci-dessus.",
    aiPromptCopied: 'Prompt copié',
    aiCopyPrompt: 'Copier le prompt + le lien Markdown',
    aiOpenChatgpt: 'Ouvrir dans ChatGPT ↗',
    aiOpenClaude: 'Ouvrir dans Claude ↗',
    aiOpenGemini: 'Ouvrir dans Gemini ↗',
    aiGeminiTitle: "Le prompt est copié dans le presse-papiers et Gemini s'ouvre — collez-le là-bas avec Cmd/Ctrl+V.",
    aiImportBack: '↑ Importer la version Markdown corrigée',

    promptResumeInline: (md) =>
      `Voici mon CV en Markdown :

${md}

Merci de :
1. Proposer des améliorations : resserrer les puces selon le schéma « action + contexte + résultat/impact », rendre le profil plus percutant, employer la langue de candidature française. N'inventez AUCUN chiffre.
2. Me rendre à la fin une version Markdown COMPLÈTE et mise à jour — exactement au même format, frontmatter (---) compris, pour que je puisse la réimporter telle quelle dans mon outil.`,
    promptResumeUrl: (url) =>
      `Voici mon CV en Markdown :
${url}

Merci de :
1. Lire mon CV (chargez l'URL ci-dessus, ou demandez-moi de coller directement le texte Markdown si vous ne pouvez pas lire les URL).
2. Proposer des améliorations : resserrer les puces selon le schéma « action + contexte + résultat/impact », rendre le profil plus percutant, employer la langue de candidature française. N'inventez AUCUN chiffre.
3. Me rendre à la fin une version Markdown COMPLÈTE et mise à jour — exactement au même format, frontmatter (---) compris, pour que je puisse la réimporter telle quelle dans mon outil.`,
    promptCoverUrl: (url) =>
      `Voici ma lettre de motivation en Markdown :
${url}

Merci de :
1. Lire ma lettre (chargez l'URL ci-dessus, ou demandez-moi de coller directement le texte).
2. Améliorer la structure, la langue et le ton pour une candidature en français. Conservez les sections introduction / corps / lien avec l'entreprise / motivation / conclusion. N'inventez AUCUN fait.
3. Me rendre à la fin la version Markdown COMPLÈTE et retravaillée — exactement au même format, frontmatter (---) compris, pour que je puisse la réimporter telle quelle.`,

    modalReviewTitle: "Vérifier les changements avant d'appliquer",
    modalImportClTitle: 'Importer la lettre de motivation depuis un Markdown',
    modalImportCvTitle: 'Importer le CV depuis un Markdown',
    modalReviewBody: "Les champs suivants changent. La version actuelle est sauvegardée automatiquement avant l'application.",
    modalImportClBody: 'Collez le Markdown retravaillé de la lettre (avec ou sans frontmatter). La lettre existante sera écrasée.',
    modalImportCvBody: "Collez la version Markdown rendue par l'IA, bloc frontmatter (---) compris. La photo est conservée. Vous verrez un aperçu des différences avant toute application.",
    mdPlaceholder: '---\ntemplate: hamburg\nlang: fr\n---\n\n# Votre nom\n**Intitulé de poste**\n\n## Contact\n…',
    noChanges: "Aucun changement détecté — l'import ne changerait rien.",
    valueBefore: 'avant',
    valueAfter: 'après',
    valueEmpty: 'vide',
    back: '← Retour',
    cancel: 'Annuler',
    checking: 'Vérification…',
    showPreview: "Afficher l'aperçu",
    applying: 'Application…',
    applyChanges: 'Appliquer les changements',
    apply: 'Appliquer',

    previewFailed: "L'aperçu a échoué.",
    importFailed: "L'import a échoué.",
    serverAnswered: (status) => `Le serveur a répondu ${status}.`,
    notMarkdown: "La réponse n'était pas du Markdown.",
    serverUnreachable: "Le serveur était injoignable.",
    mdFallbackNote: (reason) => `${reason} Ce qui a été téléchargé est la version locale — même texte, mais sans les réglages côté serveur.`,
    clLoadFailed: (reason) => `${reason} La lettre de motivation n'a pas pu être chargée.`,
    invalidJson: 'JSON invalide',
    importUnavailable: "L'import n'est pas disponible ici.",
    noActiveProfile: "Aucun profil actif — créez-en un d'abord.",
    unknownJsonFormat: 'Format JSON inconnu. Attendu : export de profil, JSON Resume ou CVData.',
    jsonImportFailed: "L'import JSON a échoué.",
    fileUnreadable: "Le fichier n'a pas pu être lu.",

    fName: 'Nom',
    fPosition: 'Poste',
    fLocation: 'Lieu',
    fEmail: 'E-mail',
    fPhone: 'Téléphone',
    fProfileText: 'Texte du profil',
    fStations: 'Postes',
    fBulletsTotal: 'Puces au total',
    fEducation: 'Formation',
    fSkillGroups: 'Groupes de compétences',
    fLanguages: 'Langues',

    fClCompany: 'Entreprise destinataire',
    fClContact: 'Personne de contact',
    fClSubject: 'Objet',
    fClSalutation: 'Formule d\'appel',
    fClIntro: 'Introduction',
    fClMain: 'Corps de la lettre',
    fClCompanyRef: "Lien avec l'entreprise",
    fClMotivation: 'Motivation',
    fClClosing: 'Conclusion',
    fClSignoff: 'Formule de politesse',
  },

  es: {
    exportTitle: (doc) => `Exportar ${doc}`,
    exportSubtitle: 'Elige un formato y empieza la descarga',

    statusLabel: 'Lo que se exporta',
    statusDocument: 'Documento',
    statusName: 'Nombre',
    statusLanguage: 'Idioma',
    statusTemplate: 'Plantilla',

    pdfSection: 'Guardar como PDF',
    pdfBuilding: 'Generando el PDF …',
    pdfDownload: (doc) => `Descargar ${doc} en PDF`,
    pdfReady: (pages, kb) => `PDF listo · ${pages === 1 ? 'una página' : `${pages} páginas`} · ${kb} KB. Está en tu carpeta de descargas.`,
    pdfFailed: (reason) => `La exportación a PDF falló: ${reason}`,
    pdfUnknownError: 'error desconocido',
    pdfServiceError: 'Error del servicio de PDF',
    pdfHint: 'Un clic, una descarga. PDF vectorial, capa de texto real, sin diálogo de impresión: las páginas son exactamente las de la vista previa.',
    atsCheck: 'Comprobar el ATS: así ve una máquina tu CV',

    moreFormats: 'Más formatos',
    buttonBusy: 'Generando…',
    clHtmlSub: 'Carta de presentación como página web, para verla y compartirla. Para imprimir, usa el PDF.',
    clMdSub: 'Carta de presentación en .md (editable en cualquier parte)',
    docxSub: 'La plantilla elegida en Word: franja de color, colores de acento, columna de fechas. Se abre en Word y en LibreOffice.',
    docxAtsLabel: 'Word — versión ATS',
    docxAtsSub: 'A una columna, sin tablas ni franjas de color. Para portales que leen el archivo de forma automática.',
    htmlSub: 'Página web para verla y compartirla. Para imprimir, usa el PDF: la impresión del navegador añade sus propios márgenes y encabezados.',
    mdSub: 'Formato puente del servidor (editable en cualquier parte)',
    jsonSub: 'Datos completos, reimportables',
    jsonResumeSub: 'Esquema estándar (jsonresume.org): portátil, reimportable',
    kitLabel: 'Plantilla sin datos',
    kitSub: 'ZIP con HTML, Word, un JSON vacío e instrucciones: el diseño para rellenarlo tú mismo, incluso sin esta herramienta.',

    bringCv: 'Trae tu currículum',
    bringCvHint: 'No tienes que volver a teclear lo que ya tienes. El archivo se lee en el navegador: no va a ningún servidor, tampoco al nuestro.',
    liReading: 'Leyendo el archivo…',
    liLabel: 'Exportación de datos de LinkedIn',
    liSub: 'ZIP de «Obtener una copia de tus datos»: puestos, formación, competencias, idiomas',
    liRequest: 'Pedir tu archivo a LinkedIn →',
    liReadError: 'No se pudo leer el archivo.',
    liModalTitle: 'Esto es lo que hay en el archivo',
    liModalBody: 'Todavía no se ha sustituido nada. Si lo aplicas, los puestos, la formación, las competencias y los idiomas se sustituirán por los del archivo.',
    liNoDiff: 'Sin diferencias respecto al estado actual: la importación no cambiaría nada.',
    countStations: 'Puestos',
    countEducation: 'Formación',
    countSkills: 'Competencias',
    countLanguages: 'Idiomas',

    importSection: 'Importar',
    importHintCl: 'Recupera la carta de presentación desde Markdown o vuelve a cargar un JSON de perfil completo.',
    importHintCv: 'Recupera el currículum desde Markdown o vuelve a cargar un JSON de perfil completo.',
    uploadMd: 'Subir Markdown',
    uploadMdSubCl: 'Importa en la carta de presentación',
    uploadMdSubCv: 'Importa en el currículum',
    emptyMdTemplate: 'Plantilla Markdown vacía',
    emptyMdTemplateSub: 'Para rellenar en tu editor (LM Studio, VS Code, Obsidian …)',
    uploadJson: 'Subir JSON',
    uploadJsonSub: 'Importación completa del perfil (sobrescribe el activo)',

    demoSection: 'Modo demo',
    demoBefore: 'Ahora mismo trabajas sin cuenta. La exportación a HTML, Markdown y JSON funciona en local. ',
    demoStrong: 'Los enlaces compartidos y la edición con IA',
    demoAfter: ' necesitan una cuenta.',
    demoCta: 'Crear una cuenta →',

    shareSection: 'Compartir un enlace',
    shareHint: 'Enlace de solo lectura, sin necesidad de iniciar sesión, también con la carta de presentación (se muestra dentro del enlace).',
    shareIncludeCl: 'Mostrar la carta de presentación en el enlace',
    shareCreate: '+ Crear un enlace nuevo',
    shareNone: 'Todavía no hay enlaces.',
    shareCopied: '✓ copiado',
    shareCopy: 'Copiar el enlace',
    shareRevoke: 'Revocar',
    shareViewsSuffix: 'visitas',
    shareLastAccess: (when) => `Último acceso: ${when}`,
    shareExpires: (date) => `caduca el ${date}`,
    shareUnknownUa: 'Desconocido',
    shareClVisible: 'Carta de presentación visible',
    shareRevokeConfirm: '¿Revocar este enlace? Quien lo tenga dejará de entrar.',
    shareError: 'Algo salió mal.',

    never: 'nunca',
    justNow: 'ahora mismo',
    minutesAgo: (m) => `hace ${m} min`,
    hoursAgo: (h) => `hace ${h} h`,
    daysAgo: (d) => `hace ${d} días`,
    locale: 'es-ES',

    aiSection: 'Retocar con IA',
    aiHintCl: 'Descarga arriba tu carta en .md y pega el texto en tu chat de IA. La IA te devuelve una versión revisada que importas aquí.',
    aiHintCv: 'Dale a la IA tu currículum como enlace Markdown. Puede leerlo y devolverte una versión Markdown corregida que importas aquí.',
    aiNeedLink: 'Crea antes un enlace arriba.',
    aiPromptCopied: 'Prompt copiado',
    aiCopyPrompt: 'Copiar el prompt + el enlace Markdown',
    aiOpenChatgpt: 'Abrir en ChatGPT ↗',
    aiOpenClaude: 'Abrir en Claude ↗',
    aiOpenGemini: 'Abrir en Gemini ↗',
    aiGeminiTitle: 'El prompt se copia al portapapeles y se abre Gemini: pégalo allí con Cmd/Ctrl+V.',
    aiImportBack: '↑ Importar la versión Markdown corregida',

    promptResumeInline: (md) =>
      `Este es mi currículum en Markdown:

${md}

Por favor:
1. Propón mejoras: afila las viñetas según el esquema «acción + contexto + resultado/impacto», haz el perfil más conciso y usa el lenguaje de candidatura en español. NO inventes ninguna cifra.
2. Devuélveme al final una versión Markdown COMPLETA y actualizada, exactamente en el mismo formato e incluyendo el frontmatter (---), para poder reimportarla tal cual en mi herramienta.`,
    promptResumeUrl: (url) =>
      `Este es mi currículum en Markdown:
${url}

Por favor:
1. Lee mi currículum (carga el enlace de arriba o pídeme que te pegue el texto Markdown directamente si no puedes leer enlaces).
2. Propón mejoras: afila las viñetas según el esquema «acción + contexto + resultado/impacto», haz el perfil más conciso y usa el lenguaje de candidatura en español. NO inventes ninguna cifra.
3. Devuélveme al final una versión Markdown COMPLETA y actualizada, exactamente en el mismo formato e incluyendo el frontmatter (---), para poder reimportarla tal cual en mi herramienta.`,
    promptCoverUrl: (url) =>
      `Esta es mi carta de presentación en Markdown:
${url}

Por favor:
1. Lee mi carta (carga el enlace de arriba o pídeme que te pegue el texto directamente).
2. Mejora la estructura, el lenguaje y el tono para una candidatura en español. Mantén las secciones introducción / cuerpo / vínculo con la empresa / motivación / cierre. NO inventes ningún dato.
3. Devuélveme al final la versión Markdown COMPLETA y revisada, exactamente en el mismo formato e incluyendo el frontmatter (---), para poder reimportarla tal cual.`,

    modalReviewTitle: 'Revisar los cambios antes de aplicarlos',
    modalImportClTitle: 'Importar la carta de presentación desde Markdown',
    modalImportCvTitle: 'Importar el currículum desde Markdown',
    modalReviewBody: 'Cambian los siguientes campos. La versión actual se guarda automáticamente antes de aplicarlos.',
    modalImportClBody: 'Pega el Markdown revisado de la carta (con o sin frontmatter). La carta existente se sobrescribe.',
    modalImportCvBody: 'Pega la versión Markdown que te devolvió la IA, incluido el bloque de frontmatter (---). La foto se conserva. Verás una vista previa de las diferencias antes de aplicar nada.',
    mdPlaceholder: '---\ntemplate: hamburg\nlang: es\n---\n\n# Tu nombre\n**Puesto**\n\n## Contacto\n…',
    noChanges: 'No se detectaron cambios: la importación no cambiaría nada.',
    valueBefore: 'antes',
    valueAfter: 'después',
    valueEmpty: 'vacío',
    back: '← Atrás',
    cancel: 'Cancelar',
    checking: 'Comprobando…',
    showPreview: 'Ver la vista previa',
    applying: 'Aplicando…',
    applyChanges: 'Aplicar los cambios',
    apply: 'Aplicar',

    previewFailed: 'La vista previa falló.',
    importFailed: 'La importación falló.',
    serverAnswered: (status) => `El servidor respondió con ${status}.`,
    notMarkdown: 'La respuesta no era Markdown.',
    serverUnreachable: 'No se pudo contactar con el servidor.',
    mdFallbackNote: (reason) => `${reason} Lo que se descargó es la versión local: el mismo texto, pero sin los ajustes del servidor.`,
    clLoadFailed: (reason) => `${reason} No se pudo cargar la carta de presentación.`,
    invalidJson: 'JSON no válido',
    importUnavailable: 'La importación no está disponible aquí.',
    noActiveProfile: 'No hay perfil activo: crea uno primero.',
    unknownJsonFormat: 'Formato JSON desconocido. Se esperaba: exportación de perfil, JSON Resume o CVData.',
    jsonImportFailed: 'La importación de JSON falló.',
    fileUnreadable: 'No se pudo leer el archivo.',

    fName: 'Nombre',
    fPosition: 'Puesto',
    fLocation: 'Lugar',
    fEmail: 'Correo electrónico',
    fPhone: 'Teléfono',
    fProfileText: 'Texto del perfil',
    fStations: 'Puestos',
    fBulletsTotal: 'Viñetas en total',
    fEducation: 'Formación',
    fSkillGroups: 'Grupos de competencias',
    fLanguages: 'Idiomas',

    fClCompany: 'Empresa destinataria',
    fClContact: 'Persona de contacto',
    fClSubject: 'Asunto',
    fClSalutation: 'Saludo',
    fClIntro: 'Introducción',
    fClMain: 'Cuerpo de la carta',
    fClCompanyRef: 'Vínculo con la empresa',
    fClMotivation: 'Motivación',
    fClClosing: 'Cierre',
    fClSignoff: 'Despedida',
  },
};
