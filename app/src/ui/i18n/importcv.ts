/**
 * Texte für „Lebenslauf übernehmen" (ui/ImportCv.tsx, 19.10.2026).
 * Geschrieben für Leute, die nicht wissen, was Markdown ist: kein Fachwort,
 * jeder Schritt sagt, was man tun soll. Deutsch duzt, Französisch siezt,
 * Spanisch duzt, wie in der übrigen App.
 */
import type { UiLang } from '../i18n';

export interface ImportCvStrings {
  title: string;
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
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const DE: ImportCvStrings = {
  title: 'Lebenslauf übernehmen',
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
};

const EN: ImportCvStrings = {
  title: 'Bring in your CV',
  menuItem: 'Bring in a CV …',
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
  targetNew: 'Create a new CV',
  targetNewSub: 'The current one stays as it is.',
  targetReplace: 'Replace this CV',
  targetReplaceSub: 'The content in this language is overwritten. Earlier states are under “Versions”.',
  apply: 'Bring in',
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
};

const FR: ImportCvStrings = {
  title: 'Reprendre votre CV',
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
};

const ES: ImportCvStrings = {
  title: 'Traer tu currículum',
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
};

export const IMPORTCV_I18N: Record<UiLang, ImportCvStrings> = { de: DE, en: EN, fr: FR, es: ES };
