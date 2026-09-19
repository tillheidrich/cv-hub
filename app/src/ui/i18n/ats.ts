/**
 * i18n für den ATS-Check (`src/screens/AtsCheckModal.tsx`).
 *
 * Folgt der UI-Sprache des Nutzers (uiLang), nicht der Sprache des
 * bearbeiteten Dokuments: Wer die Oberfläche auf Französisch bedient, will die
 * Befunde auf Französisch lesen — auch wenn der geprüfte Lebenslauf deutsch
 * ist. Das Panel holt sich die Sprache über `useUiLang()` selbst.
 *
 * Befunde, in die Daten einfließen (Firmenname, Zeichenzahl, Anzahl der
 * Lücken), stehen hier als Funktion. Sonst müsste der Aufruf Satzteile
 * zusammenkleben — und jede Sprache, deren Satzbau nicht der deutschen
 * Reihenfolge folgt, wäre nicht mehr übersetzbar.
 *
 * Fachbegriffe bleiben unübersetzt: ATS, Applicant Tracking System, Workday,
 * Taleo, iCIMS. Sie stehen so in den Systemen, die der Nutzer trifft.
 */
import type { UiLang } from '../i18n';

export interface AtsStrings {
  // ── Rahmen ───────────────────────────────────────────────────────────────
  /** Überschrift, zweigeteilt: der zweite Teil steht kursiv/golden. */
  titleLead: string; titleEm: string;
  tabNotepad: string; tabKeywords: string;
  close: string;

  // ── Tab 1: Notepad-Vorschau ──────────────────────────────────────────────
  notepadIntroExport: string;
  notepadIntroFallback: string;
  /** „3 kritische Lücken" — Singular/Plural pro Sprache. */
  issuesHeading: (n: number) => string;
  issueEmail: string;
  issuePhone: string;
  issueName: string;
  issueNoExperience: string;
  issueMissingStart: string;
  issueNameNotFirst: string;
  issueEmailNotInExport: string;
  issueCompanyMissing: (company: string) => string;
  issueCompanyDuplicate: (company: string) => string;
  /** Platzhalter im Textauszug, wenn kein Name gepflegt ist. */
  notepadNameMissing: string;

  // ── Tab 2: Keyword-Match ─────────────────────────────────────────────────
  keywordIntro: string;
  jdPlaceholder: string;
  charCount: (n: number) => string;
  counterHits: string;
  counterMisses: string;
  counterSkills: string;
  /** title= an den Treffer-Chips. */
  chipFound: string;
  chipMissing: string;
  contribOverline: string;
  /** Fließtext, dreigeteilt: der Mittelteil steht kursiv. */
  contribBody1: string; contribBodyEm: string; contribBody2: string;
  listWithMatches: (n: number) => string;
  listWithoutMatches: (n: number) => string;
}

export const ATS_I18N: Record<UiLang, AtsStrings> = {
  de: {
    titleLead: 'So sieht eine Maschine deinen ', titleEm: 'Lebenslauf.',
    tabNotepad: 'Notepad-Vorschau', tabKeywords: 'Keyword-Match',
    close: 'Schließen',

    notepadIntroExport: 'Das ist der Text deines tatsächlich exportierten Dokuments, in genau der Reihenfolge, in der er auch im PDF steht. Fehlt hier etwas oder steht es verdreht, liegt der Fehler im Export — nicht in deinen Eingaben. Was ein bestimmtes System am Ende daraus macht, hängt von dessen Parser ab; geprüft ist hier Reihenfolge und Vollständigkeit.',
    notepadIntroFallback: 'Deine Eingaben als Fließtext. Hinweis: das ist noch nicht das exportierte Dokument — öffne den Check aus dem Export-Bereich, dann wird die echte Datei gelesen.',
    issuesHeading: n => `${n} kritische ${n === 1 ? 'Lücke' : 'Lücken'}`,
    issueEmail: 'E-Mail fehlt — ATS-Parser brauchen sie für den Pflicht-Eintrag „Kontaktdaten".',
    issuePhone: 'Telefon fehlt — damit bleibt der Pflicht-Eintrag „Kontaktdaten" unvollständig.',
    issueName: 'Name fehlt — ohne Name kein Match auf den Pflicht-Eintrag „Vor- und Nachname".',
    issueNoExperience: 'Keine Berufserfahrung gepflegt.',
    issueMissingStart: 'Mindestens eine Berufserfahrung ohne Start-Datum — eine lückenhafte Chronologie fällt sowohl Menschen als auch Filtern auf.',
    issueNameNotFirst: 'Der Name steht nicht am Anfang des Dokuments — im Textstrom kommt zuerst etwas anderes. Parser, die ohne Layoutanalyse arbeiten, lesen dann den falschen Namen zuerst.',
    issueEmailNotInExport: 'Die E-Mail-Adresse taucht im exportierten Dokument nicht als Text auf.',
    issueCompanyMissing: c => `„${c}" fehlt im exportierten Dokument — die Station wird beim Auslesen nicht gefunden.`,
    issueCompanyDuplicate: c => `„${c}" steht mehrfach im Dokument — vermutlich rendert die Vorlage eine Sektion doppelt.`,
    notepadNameMissing: '[Name fehlt]',

    keywordIntro: 'Stellenanzeige reinpasten. Das Tool sucht Hard Skills, Tools und Akronyme aus der Anzeige im Lebenslauf — wortwörtlich, kein Synonym. ATS-Filter zählen wortwörtliche Matches.',
    jdPlaceholder: 'Stellenanzeige hier einfügen (Anforderungsprofil, Aufgaben, Über uns) …',
    charCount: n => `${n} Zeichen · empfohlen: mindestens 200`,
    counterHits: 'Wortwörtlich gefunden',
    counterMisses: 'Im CV fehlt',
    counterSkills: 'Erkannte Skills',
    chipFound: 'Im CV gefunden',
    chipMissing: 'Fehlt — verbatim ergänzen, falls du es beherrschst',
    contribOverline: 'Beitrag zu dieser Anzeige',
    contribBody1: 'Wer kürzen muss, kürzt zuerst dort, wo für diese Anzeige nichts anschlägt — nicht chronologisch von unten. Ein Punkt ohne Treffer kann trotzdem der beste im Lebenslauf sein; die Liste sagt nur, dass er für',
    contribBodyEm: ' diese', contribBody2: ' Stelle nichts beiträgt.',
    listWithMatches: n => `Mit Bezug zur Anzeige (${n})`,
    listWithoutMatches: n => `Ohne Treffer (${n})`,
  },

  en: {
    titleLead: 'This is how a machine reads your ', titleEm: 'résumé.',
    tabNotepad: 'Notepad preview', tabKeywords: 'Keyword match',
    close: 'Close',

    notepadIntroExport: 'This is the text of the document you actually export, in exactly the order it appears in the PDF. If something is missing here or comes out scrambled, the fault is in the export — not in what you typed. What a particular system makes of it in the end depends on that system’s parser; what is checked here is order and completeness.',
    notepadIntroFallback: 'Your entries as running text. Note: this is not the exported document yet — open the check from the export area and the real file will be read.',
    issuesHeading: n => `${n} critical ${n === 1 ? 'gap' : 'gaps'}`,
    issueEmail: 'Email address missing — ATS parsers need it for the mandatory “contact details” field.',
    issuePhone: 'Phone number missing — this leaves the mandatory “contact details” field incomplete.',
    issueName: 'Name missing — without a name there is no match for the mandatory “first and last name” field.',
    issueNoExperience: 'No work experience entered.',
    issueMissingStart: 'At least one position has no start date — a patchy chronology stands out to humans and filters alike.',
    issueNameNotFirst: 'The name is not at the start of the document — something else comes first in the text stream. Parsers that work without layout analysis will read the wrong name first.',
    issueEmailNotInExport: 'The email address does not appear as text in the exported document.',
    issueCompanyMissing: c => `“${c}” is missing from the exported document — this position will not be found when the file is read.`,
    issueCompanyDuplicate: c => `“${c}” appears more than once in the document — the template is probably rendering a section twice.`,
    notepadNameMissing: '[Name missing]',

    keywordIntro: 'Paste in the job posting. The tool looks for hard skills, tools and acronyms from the posting in your CV — verbatim, no synonyms. ATS filters count verbatim matches.',
    jdPlaceholder: 'Paste the job posting here (requirements, responsibilities, about us) …',
    charCount: n => `${n} characters · recommended: at least 200`,
    counterHits: 'Found verbatim',
    counterMisses: 'Missing from CV',
    counterSkills: 'Skills detected',
    chipFound: 'Found in CV',
    chipMissing: 'Missing — add it verbatim if you really have it',
    contribOverline: 'Contribution to this posting',
    contribBody1: 'If you have to cut, cut first where nothing matches this posting — not chronologically from the bottom. A bullet without a match can still be the best one in the CV; the list only says that it contributes nothing to',
    contribBodyEm: ' this', contribBody2: ' particular role.',
    listWithMatches: n => `Related to the posting (${n})`,
    listWithoutMatches: n => `No matches (${n})`,
  },

  fr: {
    titleLead: 'Voici comment une machine lit votre ', titleEm: 'CV.',
    tabNotepad: 'Aperçu Bloc-notes', tabKeywords: 'Correspondance mots-clés',
    close: 'Fermer',

    notepadIntroExport: "C'est le texte du document que vous exportez réellement, dans l'ordre exact où il figure dans le PDF. Si quelque chose manque ici ou apparaît dans le désordre, l'erreur vient de l'export — pas de vos saisies. Ce qu'un système donné en fera au bout du compte dépend de son analyseur ; ce qui est vérifié ici, c'est l'ordre et l'exhaustivité.",
    notepadIntroFallback: "Vos saisies sous forme de texte continu. Remarque : ce n'est pas encore le document exporté — ouvrez la vérification depuis la zone d'export et le fichier réel sera lu.",
    issuesHeading: n => `${n} lacune${n === 1 ? '' : 's'} critique${n === 1 ? '' : 's'}`,
    issueEmail: "Adresse e-mail manquante — les analyseurs ATS en ont besoin pour le champ obligatoire « coordonnées ».",
    issuePhone: "Téléphone manquant — le champ obligatoire « coordonnées » reste donc incomplet.",
    issueName: "Nom manquant — sans nom, aucune correspondance avec le champ obligatoire « prénom et nom ».",
    issueNoExperience: 'Aucune expérience professionnelle saisie.',
    issueMissingStart: "Au moins une expérience professionnelle sans date de début — une chronologie lacunaire saute aux yeux des humains comme des filtres.",
    issueNameNotFirst: "Le nom ne figure pas au début du document — autre chose vient en premier dans le flux de texte. Les analyseurs qui travaillent sans analyse de mise en page liront alors le mauvais nom en premier.",
    issueEmailNotInExport: "L'adresse e-mail n'apparaît pas sous forme de texte dans le document exporté.",
    issueCompanyMissing: c => `« ${c} » est absent du document exporté — ce poste ne sera pas trouvé à la lecture du fichier.`,
    issueCompanyDuplicate: c => `« ${c} » apparaît plusieurs fois dans le document — le modèle rend probablement une section en double.`,
    notepadNameMissing: '[Nom manquant]',

    keywordIntro: "Collez l'offre d'emploi. L'outil recherche dans le CV les compétences techniques, outils et acronymes de l'offre — au mot près, sans synonyme. Les filtres ATS comptent les correspondances littérales.",
    jdPlaceholder: "Collez l'offre d'emploi ici (profil recherché, missions, à propos) …",
    charCount: n => `${n} caractères · recommandé : au moins 200`,
    counterHits: 'Trouvés au mot près',
    counterMisses: 'Absents du CV',
    counterSkills: 'Compétences détectées',
    chipFound: 'Trouvé dans le CV',
    chipMissing: "Absent — à ajouter au mot près, si vous le maîtrisez",
    contribOverline: "Apport à cette offre",
    contribBody1: "Si vous devez raccourcir, commencez là où rien ne correspond à cette offre — et non par le bas, chronologiquement. Un point sans correspondance peut rester le meilleur du CV ; la liste dit seulement qu'il n'apporte rien à",
    contribBodyEm: ' cette', contribBody2: ' offre précise.',
    listWithMatches: n => `En lien avec l'offre (${n})`,
    listWithoutMatches: n => `Sans correspondance (${n})`,
  },

  es: {
    titleLead: 'Así lee una máquina tu ', titleEm: 'currículum.',
    tabNotepad: 'Vista Bloc de notas', tabKeywords: 'Coincidencia de palabras clave',
    close: 'Cerrar',

    notepadIntroExport: 'Este es el texto del documento que exportas realmente, en el mismo orden en que aparece en el PDF. Si aquí falta algo o está desordenado, el fallo está en la exportación, no en lo que has escrito. Lo que un sistema concreto acabe haciendo con ello depende de su analizador; aquí se comprueban el orden y la integridad.',
    notepadIntroFallback: 'Tus datos como texto corrido. Nota: esto todavía no es el documento exportado — abre la comprobación desde el área de exportación y se leerá el archivo real.',
    issuesHeading: n => `${n} ${n === 1 ? 'carencia crítica' : 'carencias críticas'}`,
    issueEmail: 'Falta el correo electrónico — los analizadores ATS lo necesitan para el campo obligatorio «datos de contacto».',
    issuePhone: 'Falta el teléfono — así el campo obligatorio «datos de contacto» queda incompleto.',
    issueName: 'Falta el nombre — sin nombre no hay coincidencia con el campo obligatorio «nombre y apellidos».',
    issueNoExperience: 'No hay experiencia profesional introducida.',
    issueMissingStart: 'Al menos una experiencia profesional sin fecha de inicio — una cronología con lagunas les llama la atención tanto a las personas como a los filtros.',
    issueNameNotFirst: 'El nombre no está al principio del documento — en el flujo de texto aparece antes otra cosa. Los analizadores que trabajan sin análisis de maquetación leerán entonces el nombre equivocado primero.',
    issueEmailNotInExport: 'La dirección de correo electrónico no aparece como texto en el documento exportado.',
    issueCompanyMissing: c => `«${c}» falta en el documento exportado — ese puesto no se encuentra al leer el archivo.`,
    issueCompanyDuplicate: c => `«${c}» aparece varias veces en el documento — probablemente la plantilla renderiza una sección por duplicado.`,
    notepadNameMissing: '[Falta el nombre]',

    keywordIntro: 'Pega aquí la oferta de empleo. La herramienta busca en el currículum las competencias técnicas, herramientas y siglas de la oferta — literalmente, sin sinónimos. Los filtros ATS cuentan coincidencias literales.',
    jdPlaceholder: 'Pega aquí la oferta de empleo (requisitos, funciones, sobre nosotros) …',
    charCount: n => `${n} caracteres · recomendado: al menos 200`,
    counterHits: 'Encontradas literalmente',
    counterMisses: 'Faltan en el CV',
    counterSkills: 'Competencias detectadas',
    chipFound: 'Encontrado en el CV',
    chipMissing: 'Falta — añádelo literalmente si de verdad lo dominas',
    contribOverline: 'Aportación a esta oferta',
    contribBody1: 'Quien tenga que recortar, que recorte primero donde nada coincide con esta oferta, y no cronológicamente desde abajo. Un punto sin coincidencias puede seguir siendo el mejor del currículum; la lista solo dice que no aporta nada a',
    contribBodyEm: ' esta', contribBody2: ' oferta concreta.',
    listWithMatches: n => `Relacionados con la oferta (${n})`,
    listWithoutMatches: n => `Sin coincidencias (${n})`,
  },
};
