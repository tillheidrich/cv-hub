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

export type AtsLang = 'de' | 'en' | 'fr' | 'es';

/* Die Marken standen bis zum 16.09.2026 nur auf Deutsch in der Liste — auch
 * wenn die Oberfläche auf Englisch, Französisch oder Spanisch lief. Das fiel
 * nicht auf, solange es drei kurze Wörter waren; mit der erklärenden Legende
 * daneben wäre es ein halber deutscher Absatz in einer englischen Oberfläche
 * geworden. Also übersetzt — Begründung und Quellenlage inklusive. */
const LABELS: Record<AtsLang, Record<AtsLevel, string>> = {
  de: { high: 'ATS-stark', medium: 'ATS-okay', low: 'ATS-riskant' },
  en: { high: 'ATS-strong', medium: 'ATS-okay', low: 'ATS-risky' },
  fr: { high: 'ATS-solide', medium: 'ATS-correct', low: 'ATS-risqué' },
  es: { high: 'ATS-sólido', medium: 'ATS-correcto', low: 'ATS-arriesgado' },
};

const NOTES: Record<AtsLang, Record<AtsLevel, string>> = {
  de: {
    high: 'Eine Spalte, lineare Lesereihenfolge. Das ist die Form, die Parser zuverlässig in Felder überführen.',
    medium: 'Kopfband: liegt im normalen Textfluss der Seite (keine PDF-Kopfzeile), wird meist korrekt gelesen. Restrisiko bleibt.',
    low: 'Zweispaltig. Personio und Greenhouse nennen mehrspaltige Layouts ausdrücklich als Parsing-Fehlerursache; selbst der Marktführer unter den Parsern liest rund jeden zehnten Spalten-Lebenslauf falsch. Sieht gut aus — kostet aber Verlässlichkeit.',
  },
  en: {
    high: 'One column, linear reading order. This is the shape parsers turn into fields reliably.',
    medium: 'Header band: sits in the normal text flow of the page (not a PDF header), usually read correctly. Some risk remains.',
    low: 'Two columns. Personio and Greenhouse name multi-column layouts explicitly as a cause of parsing failure; even the leading parser misreads roughly one in ten column résumés. Looks good — costs reliability.',
  },
  fr: {
    high: 'Une colonne, ordre de lecture linéaire. C\'est la forme que les analyseurs convertissent en champs de façon fiable.',
    medium: 'Bandeau : dans le flux normal de la page (pas un en-tête PDF), généralement bien lu. Un risque subsiste.',
    low: 'Deux colonnes. Personio et Greenhouse citent explicitement les mises en page multi-colonnes comme cause d\'échec d\'analyse ; même le principal analyseur du marché se trompe sur environ un CV en colonnes sur dix. C\'est beau — au prix de la fiabilité.',
  },
  es: {
    high: 'Una columna, orden de lectura lineal. Es la forma que los analizadores convierten en campos de manera fiable.',
    medium: 'Banda superior: está en el flujo normal de la página (no en un encabezado del PDF) y suele leerse bien. Queda un riesgo residual.',
    low: 'Dos columnas. Personio y Greenhouse mencionan expresamente los diseños de varias columnas como causa de fallo al analizar; incluso el analizador líder lee mal alrededor de uno de cada diez currículums a columnas. Se ve bien — cuesta fiabilidad.',
  },
};

export function atsLabel(level: AtsLevel, lang: AtsLang = 'de'): string {
  return (LABELS[lang] || LABELS.de)[level];
}

export function atsNote(level: AtsLevel, lang: AtsLang = 'de'): string {
  return (NOTES[lang] || NOTES.de)[level];
}

/** Überschrift und Einordnung der Legende. */
export const ATS_LEGEND: Record<AtsLang, { title: string; caveat: string }> = {
  de: {
    title: 'Was heißt ATS-stark?',
    caveat: 'Gemeint ist, wie zuverlässig ein Bewerbungsparser die Felder trifft — nicht, ob eingeladen wird. Für Portale, die maschinell lesen, gibt es zusätzlich die einspaltige Word-ATS-Fassung im Export.',
  },
  en: {
    title: 'What does ATS-strong mean?',
    caveat: 'It says how reliably a résumé parser hits the fields — not whether you get invited. For portals that read by machine there is also the single-column Word ATS version in the export.',
  },
  fr: {
    title: 'Que veut dire ATS-solide ?',
    caveat: 'Cela indique avec quelle fiabilité un analyseur de CV retrouve les champs — pas si vous serez convoqué. Pour les portails qui lisent automatiquement, l\'export contient aussi la version Word ATS sur une colonne.',
  },
  es: {
    title: '¿Qué significa ATS-sólido?',
    caveat: 'Indica con qué fiabilidad un analizador de currículums acierta los campos — no si te invitan. Para portales que leen automáticamente, la exportación incluye además la versión Word ATS a una columna.',
  },
};

/** @deprecated — nutze `atsLabel(level, lang)`. */
export function atsLabelDe(level: AtsLevel): string {
  return atsLabel(level, 'de');
}

/** Farbschema passend zum jeweiligen Level. Greift in HomeScreen-Template-
 *  Picker und im SettingsPanel-Template-Picker. */
/** Ein Satz Klartext zum jeweiligen Level — für Tooltips. */
/** @deprecated — nutze `atsNote(level, lang)`. */
export function atsNoteDe(level: AtsLevel): string {
  return atsNote(level, 'de');
}

export function atsColors(level: AtsLevel): { bg: string; border: string; ink: string } {
  if (level === 'high')   return { bg: '#eaf3ea', border: '#a8c8a8', ink: '#2d5a2d' };
  if (level === 'medium') return { bg: '#fbf3e2', border: '#d8c490', ink: '#7a5d1a' };
  return { bg: '#f7eae6', border: '#d8aba0', ink: '#7a3a2a' };
}
