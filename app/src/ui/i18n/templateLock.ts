/**
 * Texte zur Vorlagen-Staffel (10.10.2026,
 * templates/freeTemplates.ts, billing/freeTier.ts) und zu den Bausteinen, die
 * in derselben Runde dazukamen: KI-Knopf ohne Konto, Hinweis nach einem
 * Widerruf. Sie erscheinen nur, wenn der Server die Grenze meldet
 * (`freeTier.limited`), selbst gehostet nie.
 *
 * Grundsatz wie in freetier.ts: Was zum Pass gehört, steht da, bevor jemand
 * wählt, und das Freischalt-Fenster bietet den kostenlosen Weg gleichwertig an.
 * Kein Countdown, keine Warnfarbe. Deutsch und Spanisch duzen, Französisch
 * siezt (wie in der übrigen Oberfläche).
 */
import type { UiLang } from '../i18n';

export interface TemplateLockStrings {
  /** Kennzeichen an Vorlagen, deren gestaltetes PDF zum Pass gehört. */
  badge: string;
  /** Tooltip und Vorlesetext zum Kennzeichen. */
  badgeTitle: string;
  /** Kennzeichen „kostenlos" für Vorlesetexte der freien Vorlagen. */
  freeAria: string;
  /** Freischalt-Fenster (Grund `template`). */
  unlockTitle: string;
  unlockBody: (template: string) => string;
  /** Gleichwertiger Knopf neben „Pass holen". */
  useFree: (template: string) => string;
  useFreeSub: string;
  atsFree: string;
  atsPdf: string;
  /** Nach dem Wechsel auf die Gratis-Vorlage. */
  switched: (template: string) => string;
  /** Druckweg (Strg+P) bei einer Pass-Vorlage. */
  printBlocked: string;
  /** Einmaliger Hinweis beim ersten Öffnen des Editors. */
  intro: (price: string, days: number, free: number) => string;
  introClose: string;
  /** Kurzer Satz im Gestaltungs-Paneel über den Karten. */
  panelNote: (free: number) => string;
  /** KI ohne Konto (Export-Paneel). */
  aiLocalHint: string;
  aiTooLong: string;
  aiCopiedMd: string;
  /** Band nach einem Widerruf. */
  withdrawn: string;
  withdrawnContent: string;
}

const de: TemplateLockStrings = {
  badge: 'Pass',
  badgeTitle: 'Das gestaltete PDF dieser Vorlage gehört zum Bewerbungs-Pass. Ansehen, gestalten und die ATS-Fassung als PDF sind kostenlos.',
  freeAria: 'PDF kostenlos',
  unlockTitle: 'Diese Vorlage gehört zum Pass.',
  unlockBody: tpl => `Das gestaltete PDF und die HTML-Datei von ${tpl} gibt es mit dem Bewerbungs-Pass. Ansehen und gestalten kannst du die Vorlage weiter, dein Inhalt bleibt, wie er ist.`,
  useFree: tpl => `Gratis als PDF in Vorlage ${tpl}`,
  useFreeSub: 'Wechselt die Vorlage. Du siehst das Ergebnis in der Vorschau, bevor du lädst.',
  atsFree: 'Die ATS-Fassung als PDF bleibt in jeder Vorlage kostenlos.',
  atsPdf: 'ATS-Fassung als PDF laden',
  switched: tpl => `Vorlage ${tpl} ist gewählt. Sieh dir die Vorschau an, das PDF lädst du dann kostenlos.`,
  printBlocked: 'Drucken als PDF gehört bei dieser Vorlage zum Pass.',
  intro: (price, days, free) => `Schreiben, Vorschau und alle Vorlagen ansehen sind kostenlos. Als PDF kostenlos: ${free} Vorlagen und die ATS-Fassung jeder Vorlage. Alle Vorlagen, Word und Anschreiben mit dem Bewerbungs-Pass: ${price} einmalig, ${days} Tage, kein Abo.`,
  introClose: 'Hinweis schließen',
  panelNote: free => `${free} Vorlagen sind als PDF kostenlos. Vorlagen mit „Pass" kannst du ansehen und gestalten, ihr gestaltetes PDF gehört zum Bewerbungs-Pass.`,
  aiLocalHint: 'Dein Lebenslauf geht als Markdown im Auftrag mit. Er landet beim Anbieter, den du hier wählst, nicht bei uns.',
  aiTooLong: 'Dein Lebenslauf ist zu lang für einen Link. Der Auftrag mit deinem Markdown liegt in der Zwischenablage, füge ihn im Chat ein.',
  aiCopiedMd: 'Auftrag mit Markdown kopiert.',
  withdrawn: 'Dein Pass ist widerrufen, den Kaufpreis bekommst du zurück. Deine Inhalte bleiben: lesen, als JSON oder Markdown exportieren und löschen geht weiter. Word, LaTeX und die Pass-Vorlagen gibt es wieder mit einem neuen Pass.',
  withdrawnContent: 'Nach dem Widerruf kannst du deine Inhalte lesen, als JSON oder Markdown exportieren und löschen, aber nicht mehr ändern.',
};

const en: TemplateLockStrings = {
  badge: 'Pass',
  badgeTitle: 'The designed PDF of this template comes with the Application Pass. Viewing, styling and the ATS version as PDF are free.',
  freeAria: 'PDF free',
  unlockTitle: 'This template comes with the pass.',
  unlockBody: tpl => `The designed PDF and the HTML file of ${tpl} come with the Application Pass. You can keep viewing and styling the template, and your content stays as it is.`,
  useFree: tpl => `Free as PDF in ${tpl}`,
  useFreeSub: 'Switches the template. You see the result in the preview before you download.',
  atsFree: 'The ATS version as PDF stays free in every template.',
  atsPdf: 'Download ATS version as PDF',
  switched: tpl => `${tpl} is selected. Check the preview, then download the PDF for free.`,
  printBlocked: 'Printing to PDF is part of the pass for this template.',
  intro: (price, days, free) => `Writing, previewing and browsing all templates are free. Free as PDF: ${free} templates and the ATS version of every template. All templates, Word and cover letters with the Application Pass: ${price} one-off, ${days} days, no subscription.`,
  introClose: 'Close note',
  panelNote: free => `${free} templates are free as PDF. Templates marked “Pass” can be viewed and styled, their designed PDF comes with the Application Pass.`,
  aiLocalHint: 'Your CV goes along as Markdown in the prompt. It goes to the provider you pick here, not to us.',
  aiTooLong: 'Your CV is too long for a link. The prompt with your Markdown is on the clipboard, paste it into the chat.',
  aiCopiedMd: 'Prompt with Markdown copied.',
  withdrawn: 'Your pass has been withdrawn and you get the price back. Your content stays: you can still read it, export it as JSON or Markdown and delete it. Word, LaTeX and the pass templates come back with a new pass.',
  withdrawnContent: 'After the withdrawal you can read your content, export it as JSON or Markdown and delete it, but no longer change it.',
};

const fr: TemplateLockStrings = {
  badge: 'Pass',
  badgeTitle: 'Le PDF mis en page de ce modèle fait partie du pass candidature. Consulter, mettre en forme et la version ATS en PDF sont gratuits.',
  freeAria: 'PDF gratuit',
  unlockTitle: 'Ce modèle fait partie du pass.',
  unlockBody: tpl => `Le PDF mis en page et le fichier HTML de ${tpl} sont inclus dans le pass candidature. Vous pouvez continuer à consulter et à mettre en forme le modèle, votre contenu reste tel quel.`,
  useFree: tpl => `Gratuit en PDF avec ${tpl}`,
  useFreeSub: 'Change de modèle. Vous voyez le résultat dans l’aperçu avant de télécharger.',
  atsFree: 'La version ATS en PDF reste gratuite dans chaque modèle.',
  atsPdf: 'Télécharger la version ATS en PDF',
  switched: tpl => `Le modèle ${tpl} est sélectionné. Vérifiez l’aperçu, puis téléchargez le PDF gratuitement.`,
  printBlocked: 'Avec ce modèle, l’impression en PDF fait partie du pass.',
  intro: (price, days, free) => `Rédiger, prévisualiser et consulter tous les modèles est gratuit. Gratuit en PDF : ${free} modèles et la version ATS de chaque modèle. Tous les modèles, Word et la lettre de motivation avec le pass candidature : ${price} en une fois, ${days} jours, sans abonnement.`,
  introClose: 'Fermer la remarque',
  panelNote: free => `${free} modèles sont gratuits en PDF. Les modèles marqués « Pass » se consultent et se mettent en forme, leur PDF mis en page fait partie du pass candidature.`,
  aiLocalHint: 'Votre CV part en Markdown dans la consigne. Il va au fournisseur que vous choisissez ici, pas chez nous.',
  aiTooLong: 'Votre CV est trop long pour un lien. La consigne avec votre Markdown est dans le presse-papiers, collez-la dans le chat.',
  aiCopiedMd: 'Consigne avec Markdown copiée.',
  withdrawn: 'Votre pass est rétracté, le prix vous est remboursé. Vos contenus restent : vous pouvez les lire, les exporter en JSON ou Markdown et les supprimer. Word, LaTeX et les modèles du pass reviennent avec un nouveau pass.',
  withdrawnContent: 'Après la rétractation, vous pouvez lire vos contenus, les exporter en JSON ou Markdown et les supprimer, mais plus les modifier.',
};

const es: TemplateLockStrings = {
  badge: 'Pase',
  badgeTitle: 'El PDF diseñado de esta plantilla forma parte del pase de candidatura. Ver, diseñar y la versión ATS en PDF son gratis.',
  freeAria: 'PDF gratis',
  unlockTitle: 'Esta plantilla forma parte del pase.',
  unlockBody: tpl => `El PDF diseñado y el archivo HTML de ${tpl} vienen con el pase de candidatura. Puedes seguir viendo y diseñando la plantilla, tu contenido queda como está.`,
  useFree: tpl => `Gratis en PDF con ${tpl}`,
  useFreeSub: 'Cambia la plantilla. Ves el resultado en la vista previa antes de descargar.',
  atsFree: 'La versión ATS en PDF sigue gratis en cada plantilla.',
  atsPdf: 'Descargar versión ATS en PDF',
  switched: tpl => `Plantilla ${tpl} elegida. Mira la vista previa y descarga el PDF gratis.`,
  printBlocked: 'Con esta plantilla, imprimir en PDF forma parte del pase.',
  intro: (price, days, free) => `Escribir, la vista previa y ver todas las plantillas son gratis. Gratis en PDF: ${free} plantillas y la versión ATS de cada plantilla. Todas las plantillas, Word y la carta de presentación con el pase de candidatura: ${price} un solo pago, ${days} días, sin suscripción.`,
  introClose: 'Cerrar aviso',
  panelNote: free => `${free} plantillas son gratis en PDF. Las plantillas con «Pase» se pueden ver y diseñar, su PDF diseñado forma parte del pase de candidatura.`,
  aiLocalHint: 'Tu currículum va como Markdown en la instrucción. Llega al proveedor que eliges aquí, no a nosotros.',
  aiTooLong: 'Tu currículum es demasiado largo para un enlace. La instrucción con tu Markdown está en el portapapeles, pégala en el chat.',
  aiCopiedMd: 'Instrucción con Markdown copiada.',
  withdrawn: 'Tu pase está desistido y te devolvemos el precio. Tus contenidos se quedan: puedes leerlos, exportarlos en JSON o Markdown y borrarlos. Word, LaTeX y las plantillas del pase vuelven con un pase nuevo.',
  withdrawnContent: 'Tras el desistimiento puedes leer tus contenidos, exportarlos en JSON o Markdown y borrarlos, pero ya no modificarlos.',
};

export const TEMPLATE_LOCK_I18N: Record<UiLang, TemplateLockStrings> = { de, en, fr, es };
