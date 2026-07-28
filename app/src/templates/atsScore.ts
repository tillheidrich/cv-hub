import type { ResumeTheme } from './theme';

/**
 * ATS-Tauglichkeits-Bewertung pro Vorlage. Basis ist die Layout-Architektur:
 * Applicant Tracking Systems (Workday, Taleo, iCIMS, SAP SuccessFactors, …)
 * parsen am zuverlässigsten linear gelesene Single-Column-CVs. Alles was
 * Spalten, Kästen, dekorative Bänder oder Fußzeilen-Sidebars hat, wird
 * gelegentlich falsch interpretiert — Bullet-Punkte aus der Sidebar landen
 * dann in der Hauptspalte zwischen Job A und Job B, oder die Sektion-Header
 * werden gar nicht erkannt.
 *
 * Quelle für die Layout-Gewichtung: HR-Recruiterin hrswatigupta_official auf
 * Threads (siehe Screenshot-Quellen im Repo) + eigene Tests mit Lebenslauf-
 * Parsing via plain-text-Extraktion. Werte sind Daumenregeln, kein Anspruch
 * auf empirische Exaktheit.
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
export function atsColors(level: AtsLevel): { bg: string; border: string; ink: string } {
  if (level === 'high')   return { bg: '#eaf3ea', border: '#a8c8a8', ink: '#2d5a2d' };
  if (level === 'medium') return { bg: '#fbf3e2', border: '#d8c490', ink: '#7a5d1a' };
  return { bg: '#f7eae6', border: '#d8aba0', ink: '#7a3a2a' };
}
