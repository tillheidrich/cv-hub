/**
 * Texte für „Lebenslauf übernehmen" (ui/ImportCv.tsx, 19.10.2026).
 * Geschrieben für Leute, die nicht wissen, was Markdown ist: kein Fachwort,
 * jeder Schritt sagt, was man tun soll. Deutsch duzt, Französisch siezt,
 * Spanisch duzt, wie in der übrigen App.
 */
import type { UiLang } from '../i18n';
import type { DroppedKind, ImportNote } from '../../import/textImport';

export interface ImportCvStrings {
  title: string;
  /** Eintrag in der linken Leiste und der Leiste unten am Telefon. */
  railItem: string;
  menuItem: string;
  menuSub: string;
  lede: string;
  tabPaste: string;
  tabFile: string;
  aiTitle: string;
  aiSteps: [string, string, string];
  aiCopy: string;
  aiCopied: string;
  aiOpen: string;
  pasteLabel: string;
  pastePlaceholder: string;
  fileLabel: string;
  fileKinds: string;
  filePick: string;
  pdfHint: string;
  errPdf: string;
  errDocx: string;
  errEmpty: string;
  errUnknown: string;
  foundTitle: string;
  found: (f: { name: boolean; experience: number; education: number; skills: number; languages: number }) => string;
  nothingFound: string;
  unsortedTitle: (n: number) => string;
  unsortedHint: string;
  unsortedSection: string;
  /** Bewusst nicht übernommen (17.11.2026, Lebensläufe aus Indien u. a.):
   *  Überschrift, Erklärung, je Art Bezeichnung und Grund. */
  droppedTitle: (n: number) => string;
  droppedHint: string;
  dropped: Record<DroppedKind, { label: string; why: string }>;
  notesTitle: string;
  note: Record<ImportNote, string>;
  targetNew: string;
  targetNewSub: string;
  targetReplace: string;
  targetReplaceSub: string;
  apply: string;
  applyNew: string;
  cancel: string;
  close: string;
  from: (what: string) => string;
  landingLink: string;
  takeoverTitle: string;
  takeoverBody: (names: string) => string;
  takeoverLimit: string;
  takeoverYes: string;
  takeoverNo: string;
  takeoverDone: (n: number) => string;
  takeoverFailed: string;
  accTitle: string;
  accBody: string;
  accInvite: string;
  accStay: string;
  /** Anschreiben passt nicht auf eine Seite (App.tsx, Inhalt-Paneel). */
  clTooLong: (lines: number) => string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const DE: ImportCvStrings = {
  title: 'Lebenslauf übernehmen',
  railItem: 'Übernehmen',
  menuItem: 'Lebenslauf übernehmen …',
  menuSub: 'Text von ChatGPT oder aus Word einfügen',
  lede: 'Du hast schon einen Lebenslauf, in Word, als PDF oder bei ChatGPT? Füg den Text hier ein. Das Werkzeug sortiert ihn in Name, Stationen, Ausbildung, Kenntnisse und Sprachen. Danach kannst du alles in Ruhe prüfen und ändern.',
  tabPaste: 'Text einfügen',
  tabFile: 'Datei hochladen',
  aiTitle: 'Mit ChatGPT oder einer anderen KI vorbereiten (geht auch ohne)',
  aiSteps: [
    'Kopier die Anleitung mit dem Knopf unten.',
    'Öffne ChatGPT, füg die Anleitung ein und darunter deinen alten Lebenslauf. Abschicken.',
    'Kopier die Antwort von ChatGPT und füg sie hier ins Feld ein.',
  ],
  aiCopy: 'Anleitung kopieren',
  aiCopied: 'Kopiert. Jetzt in ChatGPT einfügen.',
  aiOpen: 'ChatGPT öffnen',
  pasteLabel: 'Dein Lebenslauf als Text',
  pastePlaceholder: 'Hier einfügen: mit Strg+V (Windows) oder ⌘+V (Mac), auf dem Handy lange tippen und „Einfügen" wählen.',
  fileLabel: 'Datei',
  fileKinds: 'Word (.docx), Textdatei, LinkedIn-Export oder eine Sicherung aus diesem Werkzeug.',
  filePick: 'Datei auswählen',
  pdfHint: 'PDF? Öffne die Datei, markier den ganzen Text (Strg+A oder ⌘+A), kopier ihn und füg ihn unter „Text einfügen" ein.',
  errPdf: 'PDF-Dateien kann das Werkzeug nicht direkt lesen. Öffne die PDF, markier den ganzen Text, kopier ihn und füg ihn unter „Text einfügen" ein.',
  errDocx: 'Diese Word-Datei ließ sich nicht lesen. Alte .doc-Dateien gehen nicht. Speicher sie in Word als .docx oder kopier den Text und füg ihn ein.',
  errEmpty: 'Das Feld ist noch leer.',
  errUnknown: 'Diese Datei kennt das Werkzeug nicht. Kopier den Text und füg ihn unter „Text einfügen" ein.',
  foundTitle: 'Erkannt',
  found: f => [f.name ? 'Name' : '', plural(f.experience, 'Station', 'Stationen'), plural(f.education, 'Ausbildung', 'Ausbildungen'), plural(f.skills, 'Kenntnis', 'Kenntnisse'), plural(f.languages, 'Sprache', 'Sprachen')].filter(Boolean).join(' · '),
  nothingFound: 'Noch nichts erkannt. Steht dein Lebenslauf im Feld?',
  unsortedTitle: n => `${n} ${n === 1 ? 'Zeile' : 'Zeilen'} konnte das Werkzeug nicht sicher zuordnen`,
  unsortedHint: 'Die kommen in einen eigenen Abschnitt „Weitere Angaben". Dort kannst du sie verschieben oder löschen. Es geht nichts verloren.',
  unsortedSection: 'Weitere Angaben',
  droppedTitle: n => `Nicht übernommen (${n})`,
  droppedHint: 'Diese Teile kommen nicht in deinen Lebenslauf, weil sie in deutschen Lebensläufen nicht stehen. Verloren ist nichts: Hier siehst du sie, und du kannst alles von Hand wieder ergänzen.',
  dropped: {
    declaration: { label: 'Erklärung („I hereby declare …")', why: 'In deutschen Lebensläufen unüblich. Am Ende stehen höchstens Ort, Datum und Unterschrift, die setzt die Vorlage auf Wunsch.' },
    strengths: { label: 'Stärken', why: 'Soft Skills gehören ins Anschreiben, am besten mit einem Beispiel (Bundesagentur für Arbeit).' },
    references: { label: 'Referenzen', why: 'In deutschen Lebensläufen meist nicht üblich. Arbeitgeber fragen danach, wenn sie welche brauchen.' },
    parents: { label: 'Namen der Eltern', why: 'In deutschen Lebensläufen unüblich und ohne Bezug zur Arbeit.' },
    religion: { label: 'Religion', why: 'Für einen deutschen Lebenslauf nicht nötig (Bundesagentur für Arbeit).' },
    caste: { label: 'Kaste', why: 'In deutschen Lebensläufen unüblich.' },
    gender: { label: 'Geschlecht', why: 'Für einen deutschen Lebenslauf nicht nötig.' },
    idNumber: { label: 'Pass- oder Ausweisnummer', why: 'Gehört nicht in einen Lebenslauf, der weitergegeben und gespeichert wird.' },
    salary: { label: 'Gehalt', why: 'Steht nicht im Lebenslauf. Fragt die Anzeige danach, nenn es im Anschreiben als Jahresbrutto in Euro.' },
    biodata: { label: 'Größe, Gewicht, Blutgruppe', why: 'In deutschen Lebensläufen unüblich.' },
  },
  notesTitle: 'Bitte ansehen',
  note: {
    objective: 'Dein „Career Objective" steht jetzt im Profil. Üblich ist in Deutschland ein kurzes Profil: zwei, drei Sätze dazu, was du machst und was du suchst. Schreib es um, bevor du den Lebenslauf verschickst.',
    grades: 'Noten als CGPA oder Prozent: Lass das Original stehen und ergänze die deutsche Note (modifizierte bayerische Formel mit der Mindestnote deiner Hochschule). Wie das geht, steht im Tipp „Aus dem Ausland nach Deutschland bewerben".',
  },
  targetNew: 'Als neuen Lebenslauf anlegen',
  targetNewSub: 'Der jetzige bleibt, wie er ist.',
  targetReplace: 'Diesen Lebenslauf ersetzen',
  targetReplaceSub: 'Der bisherige Inhalt dieser Sprache wird überschrieben. Ältere Stände findest du unter „Versionen".',
  apply: 'Übernehmen',
  applyNew: 'Lebenslauf anlegen',
  cancel: 'Abbrechen',
  close: 'Schließen',
  from: w => `Gelesen aus: ${w}`,
  landingLink: 'Schon einen Lebenslauf? Text einfügen und weitermachen',
  takeoverTitle: 'Lebenslauf aus der Demo mitnehmen?',
  takeoverBody: names => `In diesem Browser liegt noch, was du ohne Konto angelegt hast: ${names}. Soll das in dein Konto? Dann kommst du auch von anderen Geräten dran.`,
  takeoverLimit: 'Ohne Pass hat ein Konto einen eigenen Lebenslauf. Übernommen wird der zuletzt bearbeitete, die übrigen bleiben im Browser.',
  takeoverYes: 'Ins Konto übernehmen',
  takeoverNo: 'Nein, im Browser lassen',
  takeoverDone: n => n === 1 ? 'Übernommen. Der Lebenslauf liegt jetzt in deinem Konto.' : `Übernommen. ${n} Lebensläufe liegen jetzt in deinem Konto.`,
  takeoverFailed: 'Das Übernehmen hat nicht geklappt. Die Lebensläufe liegen weiter im Browser. Versuch es später noch einmal.',
  accTitle: 'Mit Konto weitermachen',
  accBody: 'Mit einem Konto liegt dein Lebenslauf auf dem Server dieser Instanz, und du kommst von jedem Gerät dran. Was du bis jetzt gemacht hast, nimmst du mit: Nach dem Anmelden fragt das Werkzeug, ob es übernommen werden soll. Ohne Konto geht fast alles auch, dann bleibt alles in diesem Browser.',
  accInvite: 'Ein Konto gibt es gerade nur mit einem Einladungscode.',
  accStay: 'Ohne Konto weitermachen',
  clTooLong: n => `Dein Anschreiben ist länger als eine Seite, unten wird etwas abgeschnitten. Kürz es um etwa ${n} ${n === 1 ? 'Zeile' : 'Zeilen'}. Eine Seite ist für ein Anschreiben genau richtig.`,
};

const EN: ImportCvStrings = {
  title: 'Import your CV',
  railItem: 'Import',
  menuItem: 'Import a CV …',
  menuSub: 'Paste text from ChatGPT or Word',
  lede: 'Already have a CV in Word, as a PDF or in ChatGPT? Paste the text here. The tool sorts it into name, positions, education, skills and languages. Then you can check and change everything at your own pace.',
  tabPaste: 'Paste text',
  tabFile: 'Upload a file',
  aiTitle: 'Prepare it with ChatGPT or another AI (optional)',
  aiSteps: [
    'Copy the instructions with the button below.',
    'Open ChatGPT, paste the instructions and your old CV below them. Send.',
    'Copy ChatGPT’s answer and paste it into the box here.',
  ],
  aiCopy: 'Copy instructions',
  aiCopied: 'Copied. Now paste them into ChatGPT.',
  aiOpen: 'Open ChatGPT',
  pasteLabel: 'Your CV as text',
  pastePlaceholder: 'Paste here: Ctrl+V (Windows) or ⌘+V (Mac); on a phone, press and hold, then choose “Paste”.',
  fileLabel: 'File',
  fileKinds: 'Word (.docx), a text file, a LinkedIn export or a backup from this tool.',
  filePick: 'Choose file',
  pdfHint: 'PDF? Open it, select all the text (Ctrl+A or ⌘+A), copy it and paste it under “Paste text”.',
  errPdf: 'The tool can’t read PDF files directly. Open the PDF, select all the text, copy it and paste it under “Paste text”.',
  errDocx: 'This Word file couldn’t be read. Old .doc files don’t work. Save it as .docx in Word, or copy the text and paste it.',
  errEmpty: 'The box is still empty.',
  errUnknown: 'The tool doesn’t know this file. Copy the text and paste it under “Paste text”.',
  foundTitle: 'Recognised',
  found: f => [f.name ? 'Name' : '', plural(f.experience, 'position', 'positions'), plural(f.education, 'education entry', 'education entries'), plural(f.skills, 'skill', 'skills'), plural(f.languages, 'language', 'languages')].filter(Boolean).join(' · '),
  nothingFound: 'Nothing recognised yet. Is your CV in the box?',
  unsortedTitle: n => `${n} ${n === 1 ? 'line' : 'lines'} couldn’t be placed with certainty`,
  unsortedHint: 'They go into a section of their own, “Further information”. You can move or delete them there. Nothing gets lost.',
  unsortedSection: 'Further information',
  droppedTitle: n => `Not included (${n})`,
  droppedHint: 'These parts are not taken into your CV because German CVs leave them out. Nothing is lost: they are listed here, and you can add anything back by hand.',
  dropped: {
    declaration: { label: 'Declaration (“I hereby declare …”)', why: 'Not used on German CVs. At most, place, date and signature go at the end, and the template can add them.' },
    strengths: { label: 'Strengths', why: 'Soft skills belong in the cover letter, ideally with an example (German Federal Employment Agency).' },
    references: { label: 'References', why: 'Not usually part of a German CV. Employers ask for references when they need them.' },
    parents: { label: 'Parents’ names', why: 'Not used on German CVs, and nothing to do with your work.' },
    religion: { label: 'Religion', why: 'Not needed on a German CV (German Federal Employment Agency).' },
    caste: { label: 'Caste', why: 'Not used on German CVs.' },
    gender: { label: 'Gender', why: 'Not needed on a German CV.' },
    idNumber: { label: 'Passport or ID number', why: 'Does not belong on a CV, which is passed around and stored.' },
    salary: { label: 'Salary', why: 'Not on the CV. If the job ad asks for it, give it in the cover letter as annual gross salary in euros.' },
    biodata: { label: 'Height, weight, blood group', why: 'Not used on German CVs.' },
  },
  notesTitle: 'Worth a look',
  note: {
    objective: 'Your “Career Objective” is now the profile. German CVs use a short profile instead: two or three sentences on what you do and what you are looking for. Rewrite it before you send the CV.',
    grades: 'Grades as CGPA or percentages: keep the original and add the German equivalent (modified Bavarian formula with your university’s minimum pass mark). The tip “Applying to Germany from abroad” explains how.',
  },
  targetNew: 'Create a new CV',
  targetNewSub: 'The current one stays as it is.',
  targetReplace: 'Replace this CV',
  targetReplaceSub: 'The content in this language is overwritten. Earlier states are under “Versions”.',
  apply: 'Import',
  applyNew: 'Create CV',
  cancel: 'Cancel',
  close: 'Close',
  from: w => `Read from: ${w}`,
  landingLink: 'Already have a CV? Paste the text and carry on',
  takeoverTitle: 'Take your demo CV with you?',
  takeoverBody: names => `This browser still holds what you created without an account: ${names}. Move it into your account? Then you can reach it from other devices too.`,
  takeoverLimit: 'Without a pass, an account has one CV of its own. The one you edited last is moved; the others stay in the browser.',
  takeoverYes: 'Move into my account',
  takeoverNo: 'No, keep it in the browser',
  takeoverDone: n => n === 1 ? 'Done. The CV is now in your account.' : `Done. ${n} CVs are now in your account.`,
  takeoverFailed: 'Moving didn’t work. The CVs are still in the browser. Please try again later.',
  accTitle: 'Carry on with an account',
  accBody: 'With an account, your CV is stored on this instance’s server and you can reach it from any device. What you have done so far comes with you: after signing in, the tool asks whether to move it over. Almost everything works without an account too; then everything stays in this browser.',
  accInvite: 'Accounts are currently only available with an invitation code.',
  accStay: 'Carry on without an account',
  clTooLong: n => `Your cover letter is longer than one page; something is cut off at the bottom. Shorten it by about ${n} ${n === 1 ? 'line' : 'lines'}. One page is just right for a cover letter.`,
};

const FR: ImportCvStrings = {
  title: 'Reprendre votre CV',
  railItem: 'Reprendre',
  menuItem: 'Reprendre un CV …',
  menuSub: 'Coller un texte de ChatGPT ou de Word',
  lede: 'Vous avez déjà un CV dans Word, en PDF ou dans ChatGPT ? Collez le texte ici. L’outil le répartit en nom, expériences, formation, compétences et langues. Vous pourrez ensuite tout vérifier et modifier tranquillement.',
  tabPaste: 'Coller du texte',
  tabFile: 'Envoyer un fichier',
  aiTitle: 'Préparer avec ChatGPT ou une autre IA (facultatif)',
  aiSteps: [
    'Copiez les instructions avec le bouton ci-dessous.',
    'Ouvrez ChatGPT, collez les instructions puis votre ancien CV en dessous. Envoyez.',
    'Copiez la réponse de ChatGPT et collez-la dans le champ ici.',
  ],
  aiCopy: 'Copier les instructions',
  aiCopied: 'Copié. Collez-les maintenant dans ChatGPT.',
  aiOpen: 'Ouvrir ChatGPT',
  pasteLabel: 'Votre CV sous forme de texte',
  pastePlaceholder: 'Collez ici : Ctrl+V (Windows) ou ⌘+V (Mac) ; sur le téléphone, appui long puis « Coller ».',
  fileLabel: 'Fichier',
  fileKinds: 'Word (.docx), fichier texte, export LinkedIn ou sauvegarde de cet outil.',
  filePick: 'Choisir un fichier',
  pdfHint: 'Un PDF ? Ouvrez-le, sélectionnez tout le texte (Ctrl+A ou ⌘+A), copiez-le et collez-le sous « Coller du texte ».',
  errPdf: 'L’outil ne lit pas directement les PDF. Ouvrez le PDF, sélectionnez tout le texte, copiez-le et collez-le sous « Coller du texte ».',
  errDocx: 'Ce fichier Word n’a pas pu être lu. Les anciens fichiers .doc ne fonctionnent pas. Enregistrez-le en .docx dans Word, ou copiez et collez le texte.',
  errEmpty: 'Le champ est encore vide.',
  errUnknown: 'L’outil ne connaît pas ce fichier. Copiez le texte et collez-le sous « Coller du texte ».',
  foundTitle: 'Reconnu',
  found: f => [f.name ? 'Nom' : '', plural(f.experience, 'expérience', 'expériences'), plural(f.education, 'formation', 'formations'), plural(f.skills, 'compétence', 'compétences'), plural(f.languages, 'langue', 'langues')].filter(Boolean).join(' · '),
  nothingFound: 'Rien de reconnu pour l’instant. Votre CV est-il dans le champ ?',
  unsortedTitle: n => `${n} ${n === 1 ? 'ligne n’a' : 'lignes n’ont'} pas pu être classée${n === 1 ? '' : 's'} avec certitude`,
  unsortedHint: 'Elles vont dans une section à part, « Informations complémentaires ». Vous pouvez les déplacer ou les supprimer. Rien n’est perdu.',
  unsortedSection: 'Informations complémentaires',
  droppedTitle: n => `Non repris (${n})`,
  droppedHint: 'Ces éléments ne sont pas repris dans votre CV, car les CV allemands ne les contiennent pas. Rien n’est perdu : ils sont listés ici et vous pouvez les rajouter à la main.',
  dropped: {
    declaration: { label: 'Déclaration (« I hereby declare … »)', why: 'Inhabituel dans un CV allemand. Tout au plus le lieu, la date et la signature figurent à la fin ; le modèle peut les ajouter.' },
    strengths: { label: 'Points forts', why: 'Les qualités personnelles ont leur place dans la lettre, de préférence avec un exemple (Agence fédérale pour l’emploi).' },
    references: { label: 'Références', why: 'Rarement dans un CV allemand. Les employeurs les demandent s’ils en ont besoin.' },
    parents: { label: 'Noms des parents', why: 'Inhabituel dans un CV allemand et sans rapport avec votre travail.' },
    religion: { label: 'Religion', why: 'Inutile dans un CV allemand (Agence fédérale pour l’emploi).' },
    caste: { label: 'Caste', why: 'Inhabituel dans un CV allemand.' },
    gender: { label: 'Sexe', why: 'Inutile dans un CV allemand.' },
    idNumber: { label: 'Numéro de passeport ou d’identité', why: 'N’a pas sa place dans un CV, qui circule et est conservé.' },
    salary: { label: 'Salaire', why: 'Pas dans le CV. Si l’annonce le demande, indiquez-le dans la lettre en salaire annuel brut en euros.' },
    biodata: { label: 'Taille, poids, groupe sanguin', why: 'Inhabituel dans un CV allemand.' },
  },
  notesTitle: 'À vérifier',
  note: {
    objective: 'Votre « Career Objective » est maintenant le profil. En Allemagne, on écrit plutôt un court profil : deux ou trois phrases sur ce que vous faites et ce que vous cherchez. Reformulez-le avant d’envoyer le CV.',
    grades: 'Notes en CGPA ou en pourcentage : gardez l’original et ajoutez l’équivalent allemand (formule bavaroise modifiée avec la note minimale de votre université). Le conseil « Postuler en Allemagne depuis l’étranger » explique comment.',
  },
  targetNew: 'Créer un nouveau CV',
  targetNewSub: 'Le CV actuel reste tel quel.',
  targetReplace: 'Remplacer ce CV',
  targetReplaceSub: 'Le contenu dans cette langue est écrasé. Les états précédents se trouvent sous « Versions ».',
  apply: 'Reprendre',
  applyNew: 'Créer le CV',
  cancel: 'Annuler',
  close: 'Fermer',
  from: w => `Lu depuis : ${w}`,
  landingLink: 'Déjà un CV ? Collez le texte et continuez',
  takeoverTitle: 'Emporter votre CV de la démo ?',
  takeoverBody: names => `Ce navigateur contient encore ce que vous avez créé sans compte : ${names}. Le transférer dans votre compte ? Vous y aurez aussi accès depuis d’autres appareils.`,
  takeoverLimit: 'Sans pass, un compte a un seul CV à lui. Le dernier modifié est transféré, les autres restent dans le navigateur.',
  takeoverYes: 'Transférer dans mon compte',
  takeoverNo: 'Non, le laisser dans le navigateur',
  takeoverDone: n => n === 1 ? 'C’est fait. Le CV est maintenant dans votre compte.' : `C’est fait. ${n} CV sont maintenant dans votre compte.`,
  takeoverFailed: 'Le transfert n’a pas fonctionné. Les CV restent dans le navigateur. Réessayez plus tard.',
  accTitle: 'Continuer avec un compte',
  accBody: 'Avec un compte, votre CV est conservé sur le serveur de cette instance et vous y accédez depuis n’importe quel appareil. Ce que vous avez déjà fait vous suit : après la connexion, l’outil vous propose de le transférer. Presque tout fonctionne aussi sans compte ; tout reste alors dans ce navigateur.',
  accInvite: 'Pour l’instant, un compte n’est disponible qu’avec un code d’invitation.',
  accStay: 'Continuer sans compte',
  clTooLong: n => `Votre lettre dépasse une page ; le bas est coupé. Raccourcissez-la d’environ ${n} ${n === 1 ? 'ligne' : 'lignes'}. Une page, c’est la bonne longueur pour une lettre de motivation.`,
};

const ES: ImportCvStrings = {
  title: 'Traer tu currículum',
  railItem: 'Traer',
  menuItem: 'Traer un currículum …',
  menuSub: 'Pegar texto de ChatGPT o de Word',
  lede: '¿Ya tienes un currículum en Word, en PDF o en ChatGPT? Pega el texto aquí. La herramienta lo ordena en nombre, experiencia, formación, conocimientos e idiomas. Después puedes revisarlo y cambiarlo todo con calma.',
  tabPaste: 'Pegar texto',
  tabFile: 'Subir un archivo',
  aiTitle: 'Prepararlo con ChatGPT u otra IA (opcional)',
  aiSteps: [
    'Copia las instrucciones con el botón de abajo.',
    'Abre ChatGPT, pega las instrucciones y debajo tu currículum antiguo. Envía.',
    'Copia la respuesta de ChatGPT y pégala aquí en el campo.',
  ],
  aiCopy: 'Copiar instrucciones',
  aiCopied: 'Copiado. Ahora pégalo en ChatGPT.',
  aiOpen: 'Abrir ChatGPT',
  pasteLabel: 'Tu currículum como texto',
  pastePlaceholder: 'Pega aquí: Ctrl+V (Windows) o ⌘+V (Mac); en el móvil, mantén pulsado y elige «Pegar».',
  fileLabel: 'Archivo',
  fileKinds: 'Word (.docx), archivo de texto, exportación de LinkedIn o una copia de seguridad de esta herramienta.',
  filePick: 'Elegir archivo',
  pdfHint: '¿Un PDF? Ábrelo, selecciona todo el texto (Ctrl+A o ⌘+A), cópialo y pégalo en «Pegar texto».',
  errPdf: 'La herramienta no lee PDF directamente. Abre el PDF, selecciona todo el texto, cópialo y pégalo en «Pegar texto».',
  errDocx: 'No se pudo leer este archivo de Word. Los antiguos .doc no funcionan. Guárdalo como .docx en Word, o copia y pega el texto.',
  errEmpty: 'El campo todavía está vacío.',
  errUnknown: 'La herramienta no conoce este archivo. Copia el texto y pégalo en «Pegar texto».',
  foundTitle: 'Reconocido',
  found: f => [f.name ? 'Nombre' : '', plural(f.experience, 'puesto', 'puestos'), plural(f.education, 'formación', 'formaciones'), plural(f.skills, 'conocimiento', 'conocimientos'), plural(f.languages, 'idioma', 'idiomas')].filter(Boolean).join(' · '),
  nothingFound: 'Aún no se ha reconocido nada. ¿Está tu currículum en el campo?',
  unsortedTitle: n => `${n} ${n === 1 ? 'línea no se pudo' : 'líneas no se pudieron'} asignar con seguridad`,
  unsortedHint: 'Van a una sección propia, «Más información». Allí puedes moverlas o borrarlas. No se pierde nada.',
  unsortedSection: 'Más información',
  droppedTitle: n => `No incluido (${n})`,
  droppedHint: 'Estas partes no pasan a tu currículum porque en los currículums alemanes no aparecen. No se pierde nada: aquí las ves y puedes añadir lo que quieras a mano.',
  dropped: {
    declaration: { label: 'Declaración («I hereby declare …»)', why: 'No se usa en currículums alemanes. Al final van, como mucho, lugar, fecha y firma, y la plantilla puede ponerlos.' },
    strengths: { label: 'Puntos fuertes', why: 'Las competencias personales van en la carta, mejor con un ejemplo (Agencia Federal de Empleo).' },
    references: { label: 'Referencias', why: 'No suelen ir en un currículum alemán. Las empresas las piden cuando las necesitan.' },
    parents: { label: 'Nombres de los padres', why: 'No se usa en currículums alemanes y no tiene que ver con tu trabajo.' },
    religion: { label: 'Religión', why: 'No hace falta en un currículum alemán (Agencia Federal de Empleo).' },
    caste: { label: 'Casta', why: 'No se usa en currículums alemanes.' },
    gender: { label: 'Sexo', why: 'No hace falta en un currículum alemán.' },
    idNumber: { label: 'Número de pasaporte o documento', why: 'No va en un currículum, que se reenvía y se guarda.' },
    salary: { label: 'Salario', why: 'No va en el currículum. Si la oferta lo pide, indícalo en la carta como salario bruto anual en euros.' },
    biodata: { label: 'Altura, peso, grupo sanguíneo', why: 'No se usa en currículums alemanes.' },
  },
  notesTitle: 'Para revisar',
  note: {
    objective: 'Tu «Career Objective» es ahora el perfil. En Alemania se usa un perfil breve: dos o tres frases sobre lo que haces y lo que buscas. Reescríbelo antes de enviar el currículum.',
    grades: 'Notas en CGPA o en porcentaje: deja el original y añade la equivalencia alemana (fórmula bávara modificada con la nota mínima de tu universidad). El consejo «Solicitar empleo en Alemania desde el extranjero» explica cómo.',
  },
  targetNew: 'Crear un currículum nuevo',
  targetNewSub: 'El actual se queda como está.',
  targetReplace: 'Sustituir este currículum',
  targetReplaceSub: 'Se sobrescribe el contenido de este idioma. Los estados anteriores están en «Versiones».',
  apply: 'Traer',
  applyNew: 'Crear currículum',
  cancel: 'Cancelar',
  close: 'Cerrar',
  from: w => `Leído de: ${w}`,
  landingLink: '¿Ya tienes currículum? Pega el texto y sigue',
  takeoverTitle: '¿Llevarte el currículum de la demo?',
  takeoverBody: names => `En este navegador sigue lo que creaste sin cuenta: ${names}. ¿Lo pasamos a tu cuenta? Así también podrás abrirlo desde otros dispositivos.`,
  takeoverLimit: 'Sin pase, una cuenta tiene un currículum propio. Se pasa el último que editaste; los demás se quedan en el navegador.',
  takeoverYes: 'Pasar a mi cuenta',
  takeoverNo: 'No, dejarlo en el navegador',
  takeoverDone: n => n === 1 ? 'Hecho. El currículum ya está en tu cuenta.' : `Hecho. ${n} currículums ya están en tu cuenta.`,
  takeoverFailed: 'No se pudo pasar. Los currículums siguen en el navegador. Inténtalo más tarde.',
  accTitle: 'Seguir con una cuenta',
  accBody: 'Con una cuenta, tu currículum se guarda en el servidor de esta instancia y puedes abrirlo desde cualquier dispositivo. Lo que has hecho hasta ahora se viene contigo: al iniciar sesión, la herramienta te pregunta si quieres pasarlo. Casi todo funciona también sin cuenta; entonces todo se queda en este navegador.',
  accInvite: 'Por ahora, solo hay cuentas con un código de invitación.',
  accStay: 'Seguir sin cuenta',
  clTooLong: n => `Tu carta ocupa más de una página y se corta por abajo. Acórtala unas ${n} ${n === 1 ? 'línea' : 'líneas'}. Una página es la medida justa para una carta de presentación.`,
};

export const IMPORTCV_I18N: Record<UiLang, ImportCvStrings> = { de: DE, en: EN, fr: FR, es: ES };
