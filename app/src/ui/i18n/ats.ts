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
    titleLead: 'So liest ein Portal deinen ', titleEm: 'Lebenslauf.',
    tabNotepad: 'Textansicht', tabKeywords: 'Stellenanzeige',
    close: 'Schließen',

    notepadIntroExport: 'Das ist der Text deines exportierten Dokuments, in der Reihenfolge, in der er im PDF steht. Fehlt hier etwas oder steht es durcheinander, liegt der Fehler im Export und nicht in deinen Eingaben. Was ein bestimmtes System daraus macht, hängt von dessen Parser ab. Geprüft werden hier Reihenfolge und Vollständigkeit.',
    notepadIntroFallback: 'Deine Eingaben als Fließtext. Das ist noch nicht das exportierte Dokument. Öffnest du die Prüfung aus dem Export-Bereich, wird die echte Datei gelesen.',
    issuesHeading: n => `${n} ${n === 1 ? 'Punkt' : 'Punkte'} bitte ändern`,
    issueEmail: 'Die E-Mail-Adresse fehlt. Ohne sie bleibt das Feld für die Kontaktdaten leer.',
    issuePhone: 'Die Telefonnummer fehlt. Für Rückfragen ist sie oft der schnellste Weg.',
    issueName: 'Der Name fehlt. Ohne ihn lässt sich die Bewerbung keiner Person zuordnen.',
    issueNoExperience: 'Keine Berufserfahrung eingetragen.',
    issueMissingStart: 'Mindestens eine Station hat kein Startdatum und lässt sich deshalb zeitlich nicht einordnen.',
    issueNameNotFirst: 'Der Name steht nicht am Anfang des Dokuments, im Text kommt zuerst etwas anderes. Parser ohne Layoutanalyse halten dann womöglich eine andere Zeile für deinen Namen.',
    issueEmailNotInExport: 'Die E-Mail-Adresse taucht im exportierten Dokument nicht als Text auf.',
    issueCompanyMissing: c => `„${c}“ fehlt im exportierten Dokument. Beim Auslesen wird diese Station nicht gefunden.`,
    issueCompanyDuplicate: c => `„${c}“ steht mehrfach im Dokument. Vermutlich setzt die Vorlage einen Abschnitt doppelt.`,
    notepadNameMissing: '[Name fehlt]',

    keywordIntro: 'Füge die Stellenanzeige ein. Das Werkzeug sucht Fachbegriffe, Programme und Abkürzungen aus der Anzeige in deinem Lebenslauf. Gesucht wird wörtlich: Groß- und Kleinschreibung spielt keine Rolle, Synonyme werden nicht erkannt. Ob ein bestimmtes System Synonyme erkennt, sieht man von außen nicht. Einen wörtlichen Treffer findet auch eine einfache Stichwortsuche.',
    jdPlaceholder: 'Text der Stellenanzeige hier einfügen …',
    charCount: n => `${n} Zeichen · empfohlen: mindestens 200`,
    counterHits: 'Wörtlich gefunden',
    counterMisses: 'Fehlt im Lebenslauf',
    counterSkills: 'Begriffe aus der Anzeige',
    chipFound: 'Im Lebenslauf gefunden',
    chipMissing: 'Fehlt. Ergänze den Begriff wörtlich, wenn er auf dich zutrifft.',
    contribOverline: 'Was zu dieser Anzeige passt',
    contribBody1: 'Wer kürzen muss, fängt am besten bei den Punkten an, in denen kein Begriff aus der Anzeige vorkommt, statt unten die ältesten zu streichen. Ein Punkt ohne Treffer kann trotzdem der beste im Lebenslauf sein. Die Liste sagt nur, dass er für',
    contribBodyEm: ' diese', contribBody2: ' Stelle nichts beiträgt.',
    listWithMatches: n => `Mit Bezug zur Anzeige (${n})`,
    listWithoutMatches: n => `Ohne Treffer (${n})`,
  },

  en: {
    titleLead: 'How a portal reads your ', titleEm: 'CV.',
    tabNotepad: 'Text view', tabKeywords: 'Job ad',
    close: 'Close',

    notepadIntroExport: 'This is the text of the document you export, in the order it is stored in the PDF. If something is missing or out of order here, the problem is in the export, not in what you typed. What a particular system makes of it depends on its parser. This view checks order and completeness.',
    notepadIntroFallback: 'Your entries as running text. This is not the exported document yet. Open the check from the export area to read the real file.',
    issuesHeading: n => `${n} ${n === 1 ? 'item' : 'items'} to fix`,
    issueEmail: 'The email address is missing. Without it the contact field stays empty.',
    issuePhone: 'The phone number is missing. It is often the quickest way to reach you with a question.',
    issueName: 'The name is missing. Without it the application cannot be matched to a person.',
    issueNoExperience: 'No work experience entered.',
    issueMissingStart: 'At least one position has no start date, so it cannot be placed in time.',
    issueNameNotFirst: 'The name is not at the start of the document; something else comes first in the text. Parsers without layout analysis may then take another line for your name.',
    issueEmailNotInExport: 'The email address does not appear as text in the exported document.',
    issueCompanyMissing: c => `“${c}” is missing from the exported document. This position will not be found when the file is read.`,
    issueCompanyDuplicate: c => `“${c}” appears more than once in the document. The template is probably setting a section twice.`,
    notepadNameMissing: '[Name missing]',

    keywordIntro: 'Paste the job ad. The tool looks for technical terms, software and abbreviations from the ad in your CV. The search is literal: case does not matter, and synonyms are not recognised. Whether a particular system recognises synonyms cannot be seen from the outside. A literal match is found even by a simple keyword search.',
    jdPlaceholder: 'Paste the text of the job ad here …',
    charCount: n => `${n} characters · recommended: at least 200`,
    counterHits: 'Found as written',
    counterMisses: 'Missing from the CV',
    counterSkills: 'Terms from the ad',
    chipFound: 'Found in the CV',
    chipMissing: 'Missing. Add the term as written if it applies to you.',
    contribOverline: 'What fits this ad',
    contribBody1: 'If you have to cut, start with the bullets that contain no term from the ad instead of dropping the oldest ones at the bottom. A bullet without a match can still be the best one in your CV. The list only says that it adds nothing to',
    contribBodyEm: ' this', contribBody2: ' particular job.',
    listWithMatches: n => `Related to the ad (${n})`,
    listWithoutMatches: n => `No matches (${n})`,
  },

  fr: {
    titleLead: 'Comment un portail lit votre ', titleEm: 'CV.',
    tabNotepad: 'Vue texte', tabKeywords: 'Offre d’emploi',
    close: 'Fermer',

    notepadIntroExport: "Voici le texte du document que vous exportez, dans l'ordre où il est enregistré dans le PDF. S'il manque quelque chose ici ou si l'ordre est faux, le problème vient de l'export et non de vos saisies. Ce qu'un système donné en fait dépend de son analyseur. Cette vue vérifie l'ordre et l'exhaustivité.",
    notepadIntroFallback: "Vos saisies sous forme de texte continu. Ce n'est pas encore le document exporté. Ouvrez la vérification depuis la zone d'export pour lire le vrai fichier.",
    issuesHeading: n => `${n} point${n === 1 ? '' : 's'} à corriger`,
    issueEmail: "L'adresse e-mail manque. Sans elle, le champ des coordonnées reste vide.",
    issuePhone: "Le numéro de téléphone manque. C'est souvent le moyen le plus rapide de vous joindre pour une question.",
    issueName: "Le nom manque. Sans lui, la candidature ne peut être attribuée à personne.",
    issueNoExperience: 'Aucune expérience professionnelle saisie.',
    issueMissingStart: "Au moins un poste n'a pas de date de début et ne peut donc pas être situé dans le temps.",
    issueNameNotFirst: "Le nom ne figure pas au début du document : autre chose vient en premier dans le texte. Les analyseurs sans analyse de mise en page risquent alors de prendre une autre ligne pour votre nom.",
    issueEmailNotInExport: "L'adresse e-mail n'apparaît pas sous forme de texte dans le document exporté.",
    issueCompanyMissing: c => `« ${c} » est absent du document exporté. Ce poste ne sera pas trouvé à la lecture du fichier.`,
    issueCompanyDuplicate: c => `« ${c} » apparaît plusieurs fois dans le document. Le modèle compose probablement une section en double.`,
    notepadNameMissing: '[Nom manquant]',

    keywordIntro: "Collez l'offre d'emploi. L'outil cherche dans votre CV les termes techniques, logiciels et sigles de l'offre. La recherche est littérale : la casse ne compte pas, et les synonymes ne sont pas reconnus. De l'extérieur, on ne voit pas si un système donné reconnaît les synonymes. Une correspondance littérale, même une simple recherche par mot-clé la trouve.",
    jdPlaceholder: "Collez ici le texte de l'offre d'emploi …",
    charCount: n => `${n} caractères · recommandé : au moins 200`,
    counterHits: 'Trouvés tels quels',
    counterMisses: 'Absents du CV',
    counterSkills: "Termes de l'offre",
    chipFound: 'Trouvé dans le CV',
    chipMissing: "Absent. Ajoutez le terme tel quel s'il vous correspond.",
    contribOverline: 'Ce qui correspond à cette offre',
    contribBody1: "Si vous devez raccourcir, commencez par les points qui ne contiennent aucun terme de l'offre, plutôt que de supprimer les plus anciens en bas. Un point sans correspondance peut rester le meilleur du CV. La liste dit seulement qu'il n'apporte rien à",
    contribBodyEm: ' cette', contribBody2: ' offre précise.',
    listWithMatches: n => `En lien avec l'offre (${n})`,
    listWithoutMatches: n => `Sans correspondance (${n})`,
  },

  es: {
    titleLead: 'Así lee un portal tu ', titleEm: 'currículum.',
    tabNotepad: 'Vista de texto', tabKeywords: 'Oferta de empleo',
    close: 'Cerrar',

    notepadIntroExport: 'Este es el texto del documento que exportas, en el orden en que está guardado en el PDF. Si aquí falta algo o está desordenado, el fallo está en la exportación, no en lo que has escrito. Lo que un sistema concreto haga con ello depende de su analizador. Aquí se comprueban el orden y la integridad.',
    notepadIntroFallback: 'Tus datos como texto corrido. Esto todavía no es el documento exportado. Abre la comprobación desde el área de exportación para leer el archivo real.',
    issuesHeading: n => `${n} ${n === 1 ? 'punto por corregir' : 'puntos por corregir'}`,
    issueEmail: 'Falta el correo electrónico. Sin él, el campo de contacto queda vacío.',
    issuePhone: 'Falta el teléfono. Suele ser la vía más rápida para resolver una duda contigo.',
    issueName: 'Falta el nombre. Sin él, la candidatura no se puede asignar a nadie.',
    issueNoExperience: 'No hay experiencia profesional introducida.',
    issueMissingStart: 'Al menos un puesto no tiene fecha de inicio, así que no se puede situar en el tiempo.',
    issueNameNotFirst: 'El nombre no está al principio del documento: en el texto aparece antes otra cosa. Los analizadores sin análisis de maquetación pueden tomar entonces otra línea por tu nombre.',
    issueEmailNotInExport: 'La dirección de correo electrónico no aparece como texto en el documento exportado.',
    issueCompanyMissing: c => `«${c}» falta en el documento exportado. Ese puesto no se encontrará al leer el archivo.`,
    issueCompanyDuplicate: c => `«${c}» aparece varias veces en el documento. Probablemente la plantilla compone una sección dos veces.`,
    notepadNameMissing: '[Falta el nombre]',

    keywordIntro: 'Pega la oferta de empleo. La herramienta busca en tu currículum los términos técnicos, programas y siglas de la oferta. La búsqueda es literal: no distingue mayúsculas y no reconoce sinónimos. Desde fuera no se ve si un sistema concreto reconoce sinónimos. Una coincidencia literal la encuentra hasta una simple búsqueda por palabras clave.',
    jdPlaceholder: 'Pega aquí el texto de la oferta de empleo …',
    charCount: n => `${n} caracteres · recomendado: al menos 200`,
    counterHits: 'Encontrados tal cual',
    counterMisses: 'Faltan en el CV',
    counterSkills: 'Términos de la oferta',
    chipFound: 'Encontrado en el CV',
    chipMissing: 'Falta. Añade el término tal cual si se ajusta a ti.',
    contribOverline: 'Lo que encaja con esta oferta',
    contribBody1: 'Si tienes que recortar, empieza por los puntos que no contienen ningún término de la oferta, en vez de quitar los más antiguos de abajo. Un punto sin coincidencias puede seguir siendo el mejor del currículum. La lista solo dice que no aporta nada a',
    contribBodyEm: ' esta', contribBody2: ' oferta concreta.',
    listWithMatches: n => `Relacionados con la oferta (${n})`,
    listWithoutMatches: n => `Sin coincidencias (${n})`,
  },
};

// ── „Was heißt das?" an den ATS-Marken (ui/AtsExplain.tsx, Runde 8) ────────
//
// Steht an jeder Marke „Gut für Portale" / „Für Portale geeignet" / „Für Mail
// und Druck": im Gestaltungs-Paneel, in der Karussell-Leiste und im Prüfen-
// Paneel (alle über ui/AtsLine.tsx). Anlass, 10.10.2026: „wir müssen für
// Portale geeignet etc. auch gut erklären, sonst weiß der User nicht, was das
// soll".
//
// Was belegt ist und deshalb gesagt wird: Alle Vorlagen erzeugen ein Vektor-
// PDF mit echter, getaggter Textebene in Lesereihenfolge (scripts/pdfcheck.mjs,
// atspdfcheck.mjs prüfen Text je Seite, Reihenfolge und Wortzwischenräume).
// Text als Bild oder Kurve hat keine Textebene; viele lose Textfelder haben
// keine verlässliche Reihenfolge. Daraus folgt der Vergleich, ohne Marken-
// namen und ohne Zahlen. Nicht gesagt wird, dass irgendein System einen
// Lebenslauf „aussortiert" oder dass eine Vorlage „ATS-sicher" ist (atsScore.ts).

export interface AtsExplainStrings {
  /** Text des Auslösers neben der Marke. */
  trigger: string;
  /** Zugänglicher Name des Auslösers, mit der Marke. */
  triggerAria: (label: string) => string;
  title: (label: string) => string;
  close: string;
  whatTitle: string;
  what: string;
  whyTitle: string;
  why: string;
  oursTitle: string;
  ours: string;
  whenTitle: string;
  when: string;
  caveat: string;
  more: string;
}

export const ATS_EXPLAIN_I18N: Record<UiLang, AtsExplainStrings> = {
  de: {
    trigger: 'Was heißt das?',
    triggerAria: l => `Was heißt „${l}"?`,
    title: l => `Was „${l}" bedeutet`,
    close: 'Schließen',
    whatTitle: 'Was ein Bewerbungsportal liest',
    what: 'Viele Firmen nehmen Bewerbungen über ein Bewerbermanagement-System an, kurz ATS. Es liest dein PDF oder Word-Dokument aus und verteilt den Text auf Felder wie Name, Stationen und Kenntnisse.',
    whyTitle: 'Warum Spalten manchmal stören',
    why: 'Manche Systeme lesen den Text in der Reihenfolge, in der er in der Datei steht, andere nach seiner Lage auf der Seite. Bei zwei Spalten landen Angaben aus der Seitenspalte dann gelegentlich mitten in einer Station oder im falschen Feld.',
    oursTitle: 'Was für alle Vorlagen hier gilt',
    ours: 'Jede Vorlage erzeugt ein PDF mit echter Textebene in Lesereihenfolge. Das prüfen Skripte im Quelltext für jede Vorlage. Auch die gestalteten Vorlagen sind deshalb maschinell lesbar, anders als Lebensläufe, deren Text als Bild oder in Kurven vorliegt oder auf viele lose Textfelder verteilt ist, wie es beim Export aus Grafikprogrammen vorkommen kann.',
    whenTitle: 'Welche Fassung wann',
    when: 'Lädst du die Bewerbung in ein Portal hoch, nimm eine Vorlage „Gut für Portale" oder die ATS-Fassung mit einem Klick. Schickst du sie per Mail, druckst sie aus oder gibst sie persönlich ab, darf es die gestaltete Vorlage sein.',
    caveat: 'Die Marke sagt, wie zuverlässig ein Portal die Felder trifft. Ob du eingeladen wirst, entscheiden Menschen und dein Inhalt.',
    more: 'Mehr dazu im Magazin',
  },
  en: {
    trigger: 'What does this mean?',
    triggerAria: l => `What does "${l}" mean?`,
    title: l => `What "${l}" means`,
    close: 'Close',
    whatTitle: 'What an applicant portal reads',
    what: 'Many companies take applications through an applicant tracking system, ATS for short. It reads your PDF or Word file and sorts the text into fields such as name, positions and skills.',
    whyTitle: 'Why columns sometimes get in the way',
    why: 'Some systems read the text in the order it is stored in the file, others by where it sits on the page. With two columns, details from the side column can end up in the middle of a position or in the wrong field.',
    oursTitle: 'What applies to every template here',
    ours: 'Every template produces a PDF with a real text layer in reading order, and scripts in the source code check this for every template. So the designed templates can be read by machines too, unlike CVs whose text is an image, outlined as curves or scattered across many loose text boxes, which can happen when exporting from graphics tools.',
    whenTitle: 'Which version when',
    when: 'If you upload your application to a portal, use a "Good for portals" template or the one-click ATS version. If you send it by email, print it or hand it over in person, the designed template is fine.',
    caveat: 'The label says how reliably a portal hits the fields. Whether you get invited is decided by people and by your content.',
    more: 'Read more in the magazine',
  },
  fr: {
    trigger: 'Qu’est-ce que ça veut dire ?',
    triggerAria: l => `Que veut dire « ${l} » ?`,
    title: l => `Ce que signifie « ${l} »`,
    close: 'Fermer',
    whatTitle: 'Ce que lit un portail de candidature',
    what: 'Beaucoup d’entreprises reçoivent les candidatures via un logiciel de gestion des candidatures, appelé ATS. Il lit votre PDF ou votre fichier Word et répartit le texte dans des champs : nom, postes, compétences.',
    whyTitle: 'Pourquoi les colonnes gênent parfois',
    why: 'Certains logiciels lisent le texte dans l’ordre où il est enregistré dans le fichier, d’autres selon sa position sur la page. Avec deux colonnes, des informations de la colonne latérale peuvent se retrouver au milieu d’un poste ou dans le mauvais champ.',
    oursTitle: 'Ce qui vaut pour tous les modèles ici',
    ours: 'Chaque modèle produit un PDF avec une vraie couche de texte dans l’ordre de lecture, et des scripts du code source le vérifient pour chaque modèle. Les modèles graphiques restent donc lisibles par une machine, contrairement aux CV dont le texte est une image, vectorisé en courbes ou éparpillé dans de nombreuses zones de texte, ce qui peut arriver à l’export depuis un logiciel graphique.',
    whenTitle: 'Quelle version et quand',
    when: 'Si vous déposez votre candidature sur un portail, prenez un modèle « Bien lu par les portails » ou la version ATS en un clic. Si vous l’envoyez par e-mail, l’imprimez ou la remettez en main propre, le modèle graphique convient.',
    caveat: 'Le repère indique avec quelle fiabilité un portail remplit les champs. Ce sont des personnes et votre contenu qui décident d’un entretien.',
    more: 'En savoir plus dans le magazine',
  },
  es: {
    trigger: '¿Qué significa?',
    triggerAria: l => `¿Qué significa «${l}»?`,
    title: l => `Qué significa «${l}»`,
    close: 'Cerrar',
    whatTitle: 'Qué lee un portal de empleo',
    what: 'Muchas empresas reciben las candidaturas con un sistema de gestión de candidatos, llamado ATS. Lee tu PDF o tu archivo de Word y reparte el texto en campos como nombre, puestos y conocimientos.',
    whyTitle: 'Por qué las columnas a veces molestan',
    why: 'Algunos sistemas leen el texto en el orden en que está guardado en el archivo, otros según su posición en la página. Con dos columnas, datos de la columna lateral pueden acabar en medio de un puesto o en el campo equivocado.',
    oursTitle: 'Lo que vale para todas las plantillas',
    ours: 'Cada plantilla genera un PDF con una capa de texto real en orden de lectura, y unos scripts del código fuente lo comprueban en cada plantilla. Por eso también las plantillas con diseño se pueden leer a máquina, a diferencia de los CV cuyo texto es una imagen, está convertido en curvas o repartido en muchos cuadros de texto sueltos, algo que puede pasar al exportar desde un programa gráfico.',
    whenTitle: 'Qué versión y cuándo',
    when: 'Si subes la candidatura a un portal, usa una plantilla «Buena para portales» o la versión ATS con un clic. Si la envías por correo, la imprimes o la entregas en persona, puede ser la plantilla con diseño.',
    caveat: 'La etiqueta indica con qué fiabilidad un portal acierta los campos. Si te invitan lo deciden personas y tu contenido.',
    more: 'Más en la revista',
  },
};

/** Ziel von „Mehr dazu": Magazin-Artikel (entsteht in Runde 8 durch L1/R2). */
export const ATS_EXPLAIN_ARTICLE = '/magazin/wie-bewerbermanagement-systeme-lebenslaeufe-lesen/';
