import type { ResumeTheme } from './theme';

/**
 * ATS-Tauglichkeit je Vorlage — nach Layout-Architektur.
 *
 * Belegt ist Folgendes (Herstellerdokumentation, keine Ratgeberblogs):
 *  • Personio nennt „multi-column format", Tabellen, Kopf-/Fußzeilen,
 *    Schriftgrößen ≤ 8 pt, gesperrte Schrift/Kapitälchen und Grafiken statt
 *    Text für Skills ausdrücklich als Ursachen für fehlgeschlagenes Parsing.
 *  • Greenhouse nennt „columned layout", „graphics, photos, or word art"
 *    sowie Kontaktdaten in Header/Footer/Textbox.
 *  • Workday: „resumes that don't have images or image-based styles";
 *    Ergebnisse variieren „based on resume format and order of words" —
 *    also nach der linearisierten Lesereihenfolge.
 *  • Textkernel (Parser hinter u. a. softgarden) beziffert den Anteil
 *    mehrspaltiger Lebensläufe auf mindestens 15 % und die korrekte
 *    Spaltenerkennung nach eigener Verbesserung auf ~90 % — jeder zehnte
 *    zweispaltige Lebenslauf wird also weiterhin falsch gelesen.
 *
 * Was NICHT belegt ist und hier deshalb auch nicht behauptet wird: dass ein
 * bestimmter Prozentsatz der Bewerbungen „vom ATS aussortiert" wird. Die
 * kursierende 75-%-Zahl geht auf ein Verkaufsargument von 2012 zurück und hat
 * nie eine Methodik gehabt. Die HBS/Accenture-Studie „Hidden Workers" (2021)
 * führt Aussortierung auf inhaltliche, von Menschen gesetzte Filter zurück
 * (Lücken, Keywords) — Layout kommt dort als Ausschlussgrund nicht vor.
 *
 * Die Einstufung hier ist deshalb ein Hygienefaktor, kein Erfolgsversprechen:
 * sie sagt, wie gut ein Parser die Felder trifft — nicht, ob eingeladen wird.
 */
export type AtsLevel = 'high' | 'medium' | 'low';

export function atsLevelForLayout(layout: ResumeTheme['layout']): AtsLevel {
  switch (layout) {
    case 'single-column':
    case 'timeline':       // Timeline ist linear, ATS folgt der Reihenfolge
      return 'high';
    case 'header-band':    // Header oben, danach linear — meist OK
      return 'medium';
    case 'sidebar-left':
    case 'sidebar-right':  // Zwei Spalten — ATS-Parser stolpern hier am häufigsten
      return 'low';
    default:
      return 'medium';
  }
}

export function atsLabelDe(level: AtsLevel): string {
  if (level === 'high') return 'ATS-stark';
  if (level === 'medium') return 'ATS-okay';
  return 'ATS-riskant';
}

/** Farbschema passend zum jeweiligen Level. Greift in HomeScreen-Template-
 *  Picker und im SettingsPanel-Template-Picker. */
/** Ein Satz Klartext zum jeweiligen Level — für Tooltips. */
export function atsNoteDe(level: AtsLevel): string {
  if (level === 'high') return 'Eine Spalte, lineare Lesereihenfolge. Das ist die Form, die Parser zuverlässig in Felder überführen.';
  if (level === 'medium') return 'Kopfband bzw. Nebenspalte: liegt im normalen Textfluss der Seite (keine PDF-Kopfzeile), wird meist korrekt gelesen. Restrisiko bleibt.';
  return 'Zweispaltig. Personio und Greenhouse nennen mehrspaltige Layouts ausdrücklich als Parsing-Fehlerursache; selbst der Marktführer unter den Parsern liest rund jeden zehnten Spalten-Lebenslauf falsch. Sieht gut aus — kostet aber Verlässlichkeit.';
}

export function atsColors(level: AtsLevel): { bg: string; border: string; ink: string } {
  if (level === 'high')   return { bg: '#eaf3ea', border: '#a8c8a8', ink: '#2d5a2d' };
  if (level === 'medium') return { bg: '#fbf3e2', border: '#d8c490', ink: '#7a5d1a' };
  return { bg: '#f7eae6', border: '#d8aba0', ink: '#7a3a2a' };
}
