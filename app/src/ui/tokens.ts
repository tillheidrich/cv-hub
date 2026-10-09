/**
 * Editorial design tokens — derived from the Superdesign 'editorial-pricing-page'
 * archetype: warm paper, hairline rules, serif Display + sans UI, no shadows.
 *
 * Use these tokens instead of hard-coding colors / fonts so the visual language
 * stays consistent as we extend the UI. Keep it small on purpose.
 */

/**
 * Color tokens in OKLCH — mathematically related to a single ink hue
 * (45°, warm-brown) so neutrals stay perceptually consistent and the
 * accent (gold) sits in the same family as the page.
 * Hex fallbacks kept for browsers that don't yet resolve OKLCH at runtime
 * (Vite/React inline-styles need both).
 */
/** Literale Werte — für Stellen, an denen CSS-Variablen nicht greifen
 *  (SVG-Präsentationsattribute wie `fill=`, Farbrechnungen in JS). */
export const RAW = {
  paper:     'oklch(0.985 0.003 264)',
  paperDeep: 'oklch(0.968 0.004 264)',
  white:     'oklch(1 0 0)',
  ink:    'oklch(0.21 0.021 264)',
  pencil: 'oklch(0.40 0.017 264)',
  fade:   'oklch(0.48 0.014 264)',
  rule:       'oklch(0.85 0.008 264)',
  ruleSoft:   'oklch(0.91 0.005 264)',
  ruleStrong: 'oklch(0.21 0.021 264)',
  gold:    'oklch(0.55 0.216 264)',
  goldInk: 'oklch(0.48 0.224 264)',
  error:   'oklch(0.470 0.150 28)',
  success: 'oklch(0.510 0.110 145)',
  inkPanel:    'oklch(0.21 0.021 264)',
  inkPanelInk: 'oklch(0.985 0.003 264)',
} as const;

/**
 * Farbwerte der Oberfläche — seit dem 08.10.2026 als CSS-Variablen aus
 * `ui/surface.css`. Damit sprechen Startseite, Anmeldung, ATS-Prüfung und
 * Editor dieselbe Sprache, und eine Änderung an einer Stelle gilt überall.
 *
 * `pencil` und `fade` liegen jetzt auf `--ink-2` (0,40) und `--ink-3` (0,48)
 * statt 0,42 und 0,52: beide etwas dunkler, also mehr Kontrast — gerechnet auf
 * der getönten Leinwand, nicht auf reinem Weiß (Gestaltungsbericht, Befund 5).
 *
 * Nie im gesetzten Dokument verwenden: `.cv-page` und das Export-HTML kennen
 * diese Variablen nicht. Wo ein literaler Wert gebraucht wird, `RAW` nehmen.
 */
export const COLORS = {
  paper:     'var(--paper)',
  paperDeep: 'var(--paper-deep)',
  white:     'var(--white)',
  ink:    'var(--ink)',
  pencil: 'var(--ink-2)',
  fade:   'var(--ink-3)',
  rule:       'var(--rule)',
  ruleSoft:   'var(--rule-soft)',
  ruleStrong: 'var(--ink)',
  gold:    'var(--accent)',
  goldInk: 'var(--accent-ink)',
  error:   'var(--danger)',
  success: 'var(--success)',
  inkPanel:    'var(--ink)',
  inkPanelInk: 'var(--paper)',
} as const;

export const FONTS = {
  /** Oberflächenschrift des Editors (Geist, selbst ausgeliefert). */
  surface: "'Geist Variable', system-ui, sans-serif",
  surfaceMono: "'Geist Mono Variable', ui-monospace, monospace",
  /** Modern display sans — matches the landing (Space Grotesk) */
  display: "'Space Grotesk', 'Inter', system-ui, sans-serif",
  /** Functional sans for all UI chrome, labels, body, buttons */
  ui:      "'Inter', 'Söhne', system-ui, sans-serif",
  /** Mono for metadata / IDs / version chips */
  mono:    "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",
} as const;

export const TYPE = {
  /** 9.5px caps with strong tracking — section overlines & metadata labels */
  overline:  { fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, fontFamily: FONTS.ui },
  /** small caps in mono for IDs / counters */
  micromono: { fontSize: '10px',  fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontFamily: FONTS.mono },
  /** UI body */
  body:      { fontSize: '13.5px', fontWeight: 400, lineHeight: 1.55, fontFamily: FONTS.ui },
  /** Inline meta */
  meta:      { fontSize: '11.5px', fontWeight: 400, color: COLORS.pencil, fontFamily: FONTS.ui },
} as const;

/** Hairline border shorthand — never use box-shadow as a depth cue. */
export const BORDER = {
  hairline:    `1px solid ${COLORS.rule}`,
  hairlineSoft:`1px solid ${COLORS.ruleSoft}`,
  inkStrong:   `1px solid ${COLORS.ink}`,
};

/** Sharp radii. Use 0 for blocks, 999 for chips. Avoid in-between. */
export const RADIUS = {
  none: 0,
  chip: 999,
  /** Reserved escape hatch for inputs that look weird at 0 */
  soft: 4,
};
