import type { CVData } from '../data/types';
import { isPlaceholderPhoto } from './photoEmbed';

/**
 * ATS-Fassung als PDF auf einen Klick (Wettbewerbsbericht, Lücke 6).
 *
 * Derselbe Inhalt wie in der gewählten Vorlage, gesetzt in einer
 * einspaltigen, ATS-starken Vorlage — ohne die Vorlage im Profil zu ändern.
 * Der Weg ist der normale PDF-Weg: Dieser Baustein rendert die Vorschau
 * unsichtbar außerhalb des Bildschirms, `DocumentPreview` rechnet Umbruch
 * und Verdichtung genau wie im Editor, und das Ergebnis (Metriken,
 * Seitenaufteilung) geht an `exportPdf`. Kein zweiter Umbruchalgorithmus.
 *
 * Welche Vorlage: einspaltig ist Pflicht (Personio und Greenhouse nennen
 * mehrspaltige Layouts als Parser-Fehlerursache, siehe templates/atsScore.ts).
 * Mit Foto „Schiefer" (einspaltig, monochrom, Foto oben), ohne Foto „Zürich"
 * (einspaltig, monochrom, ohne Fotofeld). Beide setzen Überschriften ohne
 * Sperrung und Kapitälchen-Tricks, beide sind „ATS-stark". Das Foto bleibt
 * drin, wenn es eins gibt — „derselbe Inhalt" heißt auch das; wer es für ein
 * Portal weglassen will, nimmt es im Profil heraus.
 */
export const ATS_PDF_TEMPLATE_WITH_PHOTO = 'schiefer';
export const ATS_PDF_TEMPLATE_NO_PHOTO = 'zuerich';

export function atsPdfTemplateFor(data: CVData): string {
  const ph = (data.personal?.photo || '').trim();
  return ph && !isPlaceholderPhoto(ph) ? ATS_PDF_TEMPLATE_WITH_PHOTO : ATS_PDF_TEMPLATE_NO_PHOTO;
}

