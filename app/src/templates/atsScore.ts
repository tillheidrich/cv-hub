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
    case 'sidebar-right':  // Zwei Spalten — für Mail und Druck; für Portale die ATS-Fassung
      return 'low';
    default:
      return 'medium';
  }
}

export type AtsLang = 'de' | 'en' | 'fr' | 'es';

/* Die Marken standen bis zum 16.09.2026 nur auf Deutsch in der Liste — auch
 * wenn die Oberfläche auf Englisch, Französisch oder Spanisch lief. Seitdem
 * übersetzt, Begründung und Quellenlage inklusive.
 *
 * Wortlaut seit 09.10.2026 (Rückmeldung: Das allgegenwärtige „ATS-riskant"
 * ließ das eigene Produkt schlecht aussehen).
 * 15 von 26 Vorlagen trugen eine rote Marke „ATS-riskant". Der Befund bleibt
 * richtig (Belege oben), die Darstellung war falsch herum: Für JEDE Vorlage
 * gibt es die einspaltige ATS-Fassung als PDF und Word auf einen Klick. Die
 * Marke sagt deshalb, wofür eine Vorlage gemacht ist, nicht, was an ihr
 * fehlt. Regeln: nie Rot, nie „riskant/risky/risqué/arriesgado", kein Siegel
 * mit Garantiecharakter („ATS-sicher", „ATS-safe" – § 5 UWG). „Gut für
 * Portale" ist eine Einordnung mit Herstellerbelegen, keine Zusage. */
const LABELS: Record<AtsLang, Record<AtsLevel, string>> = {
  de: { high: 'Gut für Portale', medium: 'Für Portale geeignet', low: 'Für Mail und Druck' },
  en: { high: 'Good for portals', medium: 'Suits portals', low: 'For email and print' },
  fr: { high: 'Bien lu par les portails', medium: 'Adapté aux portails', low: 'E-mail et impression' },
  es: { high: 'Buena para portales', medium: 'Apta para portales', low: 'Correo e impresión' },
};

const NOTES: Record<AtsLang, Record<AtsLevel, string>> = {
  de: {
    high: 'Eine Spalte, lineare Lesereihenfolge. Das ist die Form, die Bewerbungsportale zuverlässig in Felder überführen.',
    medium: 'Kopfband im normalen Textfluss der Seite (keine PDF-Kopfzeile), danach eine Spalte. Portale lesen das meist richtig. Die ATS-Fassung gibt es zusätzlich mit einem Klick.',
    low: 'Zwei Spalten, gestaltet für Menschen, die das PDF per Mail oder auf Papier lesen. Bewerbungsportale lesen Spalten nicht immer in der richtigen Reihenfolge: Personio und Greenhouse nennen mehrspaltige Layouts als Ursache für Lesefehler. Für Portale gibt es deshalb die ATS-Fassung, derselbe Inhalt einspaltig, als PDF oder Word.',
  },
  en: {
    high: 'One column, linear reading order. This is the shape applicant portals turn into fields reliably.',
    medium: 'Header band in the normal text flow of the page (not a PDF header), then one column. Portals usually read it correctly. The ATS version is one click away as well.',
    low: 'Two columns, designed for people who read the PDF by email or on paper. Applicant portals do not always read columns in the right order: Personio and Greenhouse name multi-column layouts as a cause of parsing errors. For portals there is the ATS version: the same content in one column, as PDF or Word.',
  },
  fr: {
    high: 'Une colonne, ordre de lecture linéaire. C\'est la forme que les portails de candidature convertissent en champs de façon fiable.',
    medium: 'Bandeau dans le flux normal de la page (pas un en-tête PDF), puis une colonne. Les portails le lisent généralement bien. La version ATS est aussi à un clic.',
    low: 'Deux colonnes, conçu pour les personnes qui lisent le PDF par e-mail ou sur papier. Les portails de candidature ne lisent pas toujours les colonnes dans le bon ordre : Personio et Greenhouse citent les mises en page multi-colonnes comme cause d\'erreurs de lecture. Pour les portails, il y a la version ATS : le même contenu sur une colonne, en PDF ou en Word.',
  },
  es: {
    high: 'Una columna, orden de lectura lineal. Es la forma que los portales de empleo convierten en campos de manera fiable.',
    medium: 'Banda superior dentro del flujo normal de la página (no un encabezado del PDF) y luego una columna. Los portales suelen leerla bien. La versión ATS también está a un clic.',
    low: 'Dos columnas, pensada para quien lee el PDF por correo o en papel. Los portales de empleo no siempre leen las columnas en el orden correcto: Personio y Greenhouse mencionan los diseños de varias columnas como causa de errores de lectura. Para portales está la versión ATS: el mismo contenido a una columna, en PDF o Word.',
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
    title: 'Was heißt „Gut für Portale"?',
    caveat: 'Gemeint ist, wie zuverlässig ein Bewerbungsportal die Felder trifft, nicht, ob eingeladen wird. Für Portale gibt es zu jeder Vorlage die einspaltige ATS-Fassung als PDF und Word.',
  },
  en: {
    title: 'What does "Good for portals" mean?',
    caveat: 'It says how reliably an applicant portal hits the fields, not whether you get invited. For portals every template comes with the single-column ATS version as PDF and Word.',
  },
  fr: {
    title: 'Que veut dire « Bien lu par les portails » ?',
    caveat: 'Cela indique avec quelle fiabilité un portail de candidature retrouve les champs, pas si vous serez convoqué. Pour les portails, chaque modèle a sa version ATS sur une colonne, en PDF et en Word.',
  },
  es: {
    title: '¿Qué significa «Buena para portales»?',
    caveat: 'Indica con qué fiabilidad un portal de empleo acierta los campos, no si te invitan. Para portales, cada plantilla tiene su versión ATS a una columna, en PDF y Word.',
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

/** Farben der Marke außerhalb von surface.css: nur „high" ist getönt (dezent
 *  grün), „medium" und „low" sind neutral. Kein Rot, kein Warnton. */
export function atsColors(level: AtsLevel): { bg: string; border: string; ink: string } {
  if (level === 'high') return { bg: '#eaf3ea', border: '#a8c8a8', ink: '#2d5a2d' };
  return { bg: '#f1f2f5', border: '#d5d8df', ink: '#3f4452' };
}
