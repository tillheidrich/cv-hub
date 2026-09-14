// ── Template Theme System ───────────────────────────────────────────────────
// Every visible CV/cover-letter design is a config object rendered by
// ResumeRenderer / CoverLetterRenderer. This keeps 15+ templates consistent
// and maintainable instead of 15 hand-written components.

import type { FontPairingId, AccentId, PaperId } from '../data/types';

// ── Layout archetypes ───────────────────────────────────────────────────────

export type LayoutArchetype =
  | 'sidebar-left'    // coloured/tinted sidebar on the left
  | 'sidebar-right'   // sidebar on the right
  | 'header-band'     // full-width coloured header, two-column body
  | 'top-centered'    // centered name block, single column (classic German DIN)
  | 'single-column'   // pure linear, ATS-friendly
  | 'timeline';       // vertical timeline for experience

export type PhotoShape = 'rect' | 'circle' | 'rounded' | 'none';
export type BulletStyle = 'dash' | 'dot' | 'square' | 'arrow' | 'chevron';
export type HeadingStyle =
  | 'caps-tracked'  // gesperrte Versalien mit kurzem Akzentbalken davor
  | 'caps-plain'    // nur gesperrte Versalien — kein Balken, keine Linie
  | 'caps-rule'     // gesperrte Versalien über einer Haarlinie
  | 'serif'
  | 'bar'
  | 'block'
  /** Überschrift als stärkstes Element der Seite: Displaygröße, fetter
   *  Strich darüber. Aus der Sammlung (Robin Masset) — dort sind „work",
   *  „education", „languages" so groß wie anderswo der Name. Für Parser eher
   *  günstig als riskant: große Sektionstitel sind leichter zu finden. */
  | 'display'
  /** Kräftiger Strich ÜBER der Versalzeile, volle Breite. Teilt die Seite in
   *  Register statt in Absätze (Romain Fournier). */
  | 'rule-over';

// ── Font pairings ───────────────────────────────────────────────────────────

export interface FontPairing {
  id: FontPairingId;
  name: string;
  note: string;
  heading: string;
  body: string;
  /** Optischer Ausgleich: Faktor, mit dem die gesamte Typo-Skala multipliziert
   *  wird, damit alle Paarungen dieselbe **x-Höhe** erreichen — nicht denselben
   *  Schriftgrad. Gemessen mit `scripts/measure-xheight.mjs` in Chromium
   *  (x-Höhe bei 100 px, Referenz Inter = 0.54).
   *
   *  Warum das nötig ist: DIN 1450 und der DBSV (leserlich.info) definieren
   *  Leserlichkeit über die x-Höhe in mm, ausdrücklich nicht über Punkt.
   *  EB Garamond hat 0.42 gegen Inters 0.54 — 10 pt Garamond sind rund ein
   *  Fünftel kleiner als 10 pt Inter. Eine Untergrenze in Punkt über acht
   *  Schriftpaarungen wäre also ein Scheinmaß gewesen.
   *
   *  Maßgeblich ist die Brotschrift der Paarung; weil der Faktor die ganze
   *  Skala multipliziert, bleibt das Größenverhältnis Überschrift zu Fließtext
   *  unverändert — genau das Merkmal, an dem Parser Sektionen erkennen. */
  xFactor: number;
}

const SANS = "'Inter', system-ui, sans-serif";

export const FONT_PAIRINGS: Record<Exclude<FontPairingId, 'auto'>, FontPairing> = {
  'inter-playfair': {
    id: 'inter-playfair', name: 'Modern Klassisch', note: 'Display-Serif + Sans',
    heading: "'Playfair Display', Georgia, serif", body: SANS,
    xFactor: 1.0,
  },
  'pure-inter': {
    id: 'pure-inter', name: 'Pur', note: 'Durchgehend Inter',
    heading: SANS, body: SANS,
    xFactor: 1.0,
  },
  'lora-source': {
    id: 'lora-source', name: 'Editorial', note: 'Lora + Source Sans',
    heading: "'Lora', Georgia, serif", body: "'Source Sans 3', sans-serif",
    xFactor: 1.102,
  },
  'merri-source': {
    id: 'merri-source', name: 'Seriös', note: 'Merriweather + Source Sans',
    heading: "'Merriweather', Georgia, serif", body: "'Source Sans 3', sans-serif",
    xFactor: 1.102,
  },
  'space-inter': {
    id: 'space-inter', name: 'Tech', note: 'Space Grotesk + Inter',
    heading: "'Space Grotesk', sans-serif", body: SANS,
    xFactor: 1.0,
  },
  'garamond-archivo': {
    id: 'garamond-archivo', name: 'Elegant', note: 'Garamond + Archivo',
    heading: "'EB Garamond', Georgia, serif", body: "'Archivo', sans-serif",
    xFactor: 1.019,
  },
  'plex-corporate': {
    id: 'plex-corporate', name: 'Korporat', note: 'IBM Plex Serif + Sans',
    heading: "'IBM Plex Serif', Georgia, serif", body: "'IBM Plex Sans', sans-serif",
    xFactor: 1.038,
  },
  'libre-inter': {
    id: 'libre-inter', name: 'Buch', note: 'Libre Baskerville + Inter',
    heading: "'Libre Baskerville', Georgia, serif", body: SANS,
    xFactor: 1.0,
  },
};

export const FONT_PAIRING_LIST: { id: FontPairingId; name: string; note: string }[] = [
  { id: 'auto', name: 'Automatisch', note: 'Schrift der Vorlage' },
  ...Object.values(FONT_PAIRINGS).map(p => ({ id: p.id, name: p.name, note: p.note })),
];

// ── Theme colour set ────────────────────────────────────────────────────────

export interface ThemeColors {
  pageBg: string;
  ink: string;
  inkMid: string;
  inkSoft: string;
  accent: string;
  accentInk: string;     // text colour on top of accent fills
  panelBg: string;       // sidebar / header band background
  panelInk: string;      // primary text on the panel
  panelInkSoft: string;
  panelAccent: string;   // label / accent colour on the panel
  rule: string;          // hairline colour
  chipBg: string;        // skill chip background
}

export interface ResumeTheme {
  id: string;
  name: string;
  description: string;
  category: 'klassisch' | 'modern' | 'kreativ' | 'minimal';
  layout: LayoutArchetype;
  colors: ThemeColors;
  defaultPairing: Exclude<FontPairingId, 'auto'>;
  photo: PhotoShape;
  bullet: BulletStyle;
  heading: HeadingStyle;
  accentName?: boolean;
  uppercaseName?: boolean;
  skillsAsChips?: boolean;
  /** Render the name block inside the sidebar instead of the main column (sidebar layouts only). */
  nameInSidebar?: boolean;
  /** Aus der Auswahl genommen, aber weiterhin renderbar: gespeicherte Profile
   *  behalten ihr Aussehen, neue Nutzer bekommen die Auswahl nicht zugemüllt.
   *  Betrifft Vorlagen, die faktisch Farbvarianten einer anderen sind. */
  deprecated?: boolean;
  /** Breite der Seitenspalte in mm. Default 62 (sidebar) bzw. 58 (header-band).
   *  Vorher war das eine Konstante im Renderer — mit der Folge, dass die
   *  Sidebar zu 94 % gefüllt war und die Hauptspalte zu 65 %. */
  sidebarMm?: number;

  /** Seitenspalte ohne Farbfläche — nur eine Haarlinie trennt die Spalten.
   *
   *  Der Stil, der in der Vorlagensammlung vom 14.09. durchgehend dominiert:
   *  weißes Blatt, 1-px-Linien, keine eingefärbten Panels. Was auf den
   *  Etsy-Bildern bunt aussieht, ist fast immer der Präsentationshintergrund,
   *  nicht der Lebenslauf. Default (undefined) = gefüllt wie bisher. */
  panelFill?: boolean;

  /** Name in gesperrten Versalien statt im Display-Schnitt.
   *  Gesperrt wird auf 0,08 em — gemessen, siehe `scripts/measure-tracking.mjs`:
   *  ab 0,11 em zerlegt die PDF-Textebene den Namen, und zwar unabhängig vom
   *  Schriftgrad. Die Vorlagen, die hier Pate standen, sperren weiter; das
   *  wäre schöner und kostet die Maschinenlesbarkeit des Namens. */
  trackedName?: boolean;

  /** Unterschriftsfeld am Blattfuß: Ort, Datum und Schriftzug.
   *  Deutsche Konvention und in der Sammlung durchgehend vorhanden. */
  signature?: boolean;

  /** Name auf zwei Zeilen, in Displaygröße über die volle Breite.
   *  Vorname oben, Nachname darunter — der Griff, mit dem die Modeblätter
   *  aus der Sammlung (ANNA / LEMAIRE) arbeiten. Getrennt wird am letzten
   *  Leerzeichen; einteilige Namen bleiben einzeilig. */
  stackedName?: boolean;

  /** Feldbezeichnungen in eckigen Klammern: [E-MAIL], [TEL].
   *  Kostet nichts an Lesbarkeit und ist sofort als Handschrift erkennbar. */
  bracketLabels?: boolean;

  /** Profiltext in die Seitenspalte, nicht in die Hauptspalte.
   *
   *  Das ist der Unterschied zwischen „Lebenslauf mit Seitenspalte" und dem
   *  editorialen Typ aus der Sammlung (Damian Watracz, Dwight Schrute): dort
   *  steht links Name und Selbstbeschreibung als zusammenhängender Block, und
   *  rechts läuft ausschließlich der Werdegang. Ohne diese Umstellung sähe
   *  eine solche Vorlage aus wie jede andere zweispaltige auch. */
  profileInSidebar?: boolean;
}

// Kontrast: alle Werte hier sind gemessen, nicht geschätzt — scripts/
// contrastcheck.mjs rechnet jede Vorlage gegen jede Akzentfarbe durch (162
// Kombinationen) und meldet alles unter 4,5:1. Bei der Einführung der freien
// Akzentfarbe am 12.09.2026 fielen dabei 15 Werte auf, die schon vorher zu
// blass waren — am deutlichsten Amsterdams Orange auf Creme mit 2,8:1.
// Gedämpfte Panel-Schrift und Panel-Akzente wurden entsprechend nachgezogen.

// ── 15 Templates ────────────────────────────────────────────────────────────

export const THEMES: ResumeTheme[] = [
  {
    id: 'hamburg', name: 'Hamburg', description: 'Warm, editorial, klassisch', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'inter-playfair', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    sidebarMm: 68,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 70)', inkMid: 'oklch(0.40 0.02 70)', inkSoft: 'oklch(0.54 0.018 70)',
      accent: '#7e684b', accentInk: '#ffffff', panelBg: '#eceae6', panelInk: '#2a2a2a',
      panelInkSoft: '#696969', panelAccent: '#7a6248', rule: 'rgba(139,115,85,0.55)', chipBg: '#f0ebe1',
    },
  },
  {
    id: 'kopenhagen', name: 'Kopenhagen', description: 'Kühl, ruhig, skandinavisch', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
    sidebarMm: 62,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 245)', inkMid: 'oklch(0.40 0.02 245)', inkSoft: 'oklch(0.54 0.018 245)',
      accent: '#3d6b8c', accentInk: '#ffffff', panelBg: '#e9ebed', panelInk: '#2a3138',
      panelInkSoft: '#636A71', panelAccent: '#3d6b8c', rule: '#bdc1c5', chipBg: '#e7ecf0',
    },
  },
  {
    id: 'oslo', name: 'Oslo', description: 'Salbei-Grün, minimal, frisch', category: 'modern',
    layout: 'sidebar-right', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    sidebarMm: 62,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 135)', inkMid: 'oklch(0.40 0.02 135)', inkSoft: 'oklch(0.54 0.018 135)',
      accent: '#5f7153', accentInk: '#ffffff', panelBg: '#e8ebe4', panelInk: '#2c322a',
      panelInkSoft: '#646A61', panelAccent: '#5B6E4F', rule: '#ccd1c5', chipBg: '#e3e8db',
    },
  },
  {
    id: 'berlin', name: 'Berlin', description: 'Bold, schwarz, kontrastreich', category: 'modern',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'none', bullet: 'square', heading: 'block',
    uppercaseName: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 265)', inkMid: 'oklch(0.40 0.008 265)', inkSoft: 'oklch(0.54 0.008 265)',
      accent: '#1a1a1a', accentInk: '#ffffff', panelBg: '#111111', panelInk: '#ffffff',
      panelInkSoft: '#9a9a9a', panelAccent: '#ffffff', rule: '#c1c1c1', chipBg: '#f1f1f1',
    },
  },
  {
    id: 'wien', name: 'Wien', description: 'Navy, seriös, traditionell', category: 'klassisch',
    layout: 'top-centered', defaultPairing: 'merri-source', photo: 'circle', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 255)', inkMid: 'oklch(0.40 0.02 255)', inkSoft: 'oklch(0.54 0.018 255)',
      accent: '#1f3a5f', accentInk: '#ffffff', panelBg: '#e8eaed', panelInk: '#1a2233',
      panelInkSoft: '#626878', panelAccent: '#1f3a5f', rule: '#bdc1c8', chipBg: '#e8ecf2',
    },
  },
  {
    id: 'zuerich', name: 'Zürich', description: 'Monochrom, ATS-pur, minimal', category: 'minimal',
    layout: 'single-column', defaultPairing: 'pure-inter', photo: 'none', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.40 0.008 260)', inkSoft: 'oklch(0.54 0.008 260)',
      accent: '#2a2a2a', accentInk: '#ffffff', panelBg: '#eaeaea', panelInk: '#1a1a1a',
      panelInkSoft: '#686868', panelAccent: '#444444', rule: '#c1c1c1', chipBg: '#f0f0f0',
    },
  },
  {
    id: 'terrakotta', name: 'Terrakotta', description: 'Warmes Terracotta, kreativ', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'lora-source', photo: 'rect', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 48)', inkMid: 'oklch(0.40 0.02 48)', inkSoft: 'oklch(0.54 0.018 48)',
      accent: '#9b4f2e', accentInk: '#ffffff', panelBg: '#f1e9e0', panelInk: '#2a201a',
      panelInkSoft: '#72675C', panelAccent: '#9b4f2e', rule: 'rgba(155,79,46,0.55)', chipBg: '#ece0d3',
    },
  },
  {
    id: 'muenchen', name: 'München', description: 'Dunkle Sidebar, korporat', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'rect', bullet: 'dash', heading: 'caps-tracked',
    sidebarMm: 68,
        /* Aus der Auswahl genommen (12.09.2026): Konstruktion und Schriftpaarung identisch mit Genf; unterschied sich nur in der Beschriftung der Überschriften.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 258)', inkMid: 'oklch(0.40 0.02 258)', inkSoft: 'oklch(0.54 0.018 258)',
      accent: '#243044', accentInk: '#ffffff', panelBg: '#243044', panelInk: '#f3f4f6',
      panelInkSoft: '#9aa3b2', panelAccent: '#c7a06b', rule: '#c6c9ce', chipBg: '#eef0f3',
    },
  },
  {
    id: 'lissabon', name: 'Lissabon', description: 'Petrol, geometrisch, modern', category: 'modern',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'circle', bullet: 'chevron', heading: 'bar',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 200)', inkMid: 'oklch(0.40 0.02 200)', inkSoft: 'oklch(0.54 0.018 200)',
      accent: '#0f6e78', accentInk: '#ffffff', panelBg: '#0f6e78', panelInk: '#ffffff',
      panelInkSoft: '#cfe7e9', panelAccent: '#ffffff', rule: '#bccbcc', chipBg: '#e3eeef',
    },
  },
  {
    id: 'mailand', name: 'Mailand', description: 'Burgunder, editorial, elegant', category: 'kreativ',
    layout: 'sidebar-right', defaultPairing: 'garamond-archivo', photo: 'rect', bullet: 'dash', heading: 'serif',
    sidebarMm: 68,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 18)', inkMid: 'oklch(0.40 0.02 18)', inkSoft: 'oklch(0.54 0.018 18)',
      accent: '#7a2230', accentInk: '#ffffff', panelBg: '#f0e8e9', panelInk: '#2a1a1d',
      panelInkSoft: '#736567', panelAccent: '#7a2230', rule: 'rgba(122,34,48,0.55)', chipBg: '#efe1e2',
    },
  },
  {
    id: 'stockholm', name: 'Stockholm', description: 'Zeitstrahl, leicht, klar', category: 'modern',
    layout: 'timeline', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
        /* Aus der Auswahl genommen (12.09.2026): Zeitstrahl-Layout wie Karlsruhe, nur mit Foto und blauem Akzent — nebeneinander nicht unterscheidbar.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 250)', inkMid: 'oklch(0.40 0.02 250)', inkSoft: 'oklch(0.54 0.018 250)',
      accent: '#2f6db0', accentInk: '#ffffff', panelBg: '#e8ebee', panelInk: '#1d2125',
      panelInkSoft: '#696f77', panelAccent: '#2f6db0', rule: '#bcc1c7', chipBg: '#e6ecf2',
    },
  },
  {
    id: 'bordeaux', name: 'Bordeaux', description: 'Tiefes Weinrot, charaktervoll', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'libre-inter', photo: 'rounded', bullet: 'square', heading: 'serif',
    sidebarMm: 62,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 15)', inkMid: 'oklch(0.40 0.02 15)', inkSoft: 'oklch(0.54 0.018 15)',
      accent: '#5c1f2e', accentInk: '#ffffff', panelBg: '#5c1f2e', panelInk: '#f6eef0',
      panelInkSoft: '#c9a3ab', panelAccent: '#e3b9a0', rule: '#c6babb', chipBg: '#f0e6e8',
    },
  },
  {
    id: 'tokio', name: 'Tokio', description: 'Stark Schwarz/Weiß, Display-Serif', category: 'minimal',
    layout: 'single-column', defaultPairing: 'inter-playfair', photo: 'none', bullet: 'dash', heading: 'serif',
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.40 0.008 260)', inkSoft: 'oklch(0.54 0.008 260)',
      accent: '#0a0a0a', accentInk: '#ffffff', panelBg: '#eaeaea', panelInk: '#0a0a0a',
      panelInkSoft: '#6d6d6d', panelAccent: '#0a0a0a', rule: '#c1c1c1', chipBg: '#efefef',
    },
  },
  {
    id: 'amsterdam', name: 'Amsterdam', description: 'Orange-Akzent, frisch, jung', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'circle', bullet: 'arrow', heading: 'block',
    accentName: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 52)', inkMid: 'oklch(0.40 0.02 52)', inkSoft: 'oklch(0.54 0.018 52)',
      accent: '#ad5117', accentInk: '#ffffff', panelBg: '#f3e9df', panelInk: '#2a241d',
      panelInkSoft: '#6C6961', panelAccent: '#A94F17', rule: '#cfc7bc', chipBg: '#f8e8d8',
    },
  },
  {
    id: 'genf', name: 'Genf', description: 'Anthrazit, sachlich, business', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    sidebarMm: 68,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 255)', inkMid: 'oklch(0.40 0.008 255)', inkSoft: 'oklch(0.54 0.008 255)',
      accent: '#3a3f47', accentInk: '#ffffff', panelBg: '#e9ebed', panelInk: '#22262b',
      panelInkSoft: '#65696F', panelAccent: '#3a3f47', rule: '#c2c4c7', chipBg: '#e7e9ec',
    },
  },

  // ── Portiert aus Reactive Resume (MIT, AmruthPillai/Reactive-Resume) ───────
  // Designs adaptiert in unsere Engine — Farben, Layouts, Akzentführung.

  {
    id: 'sonnenblume', name: 'Sonnenblume', description: 'Goldenes Header-Band, prägnant (nach Reactive Resume)', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'pure-inter', photo: 'rect', bullet: 'dot', heading: 'caps-tracked',
        /* Aus der Auswahl genommen (12.09.2026): Kopfbalken-Layout wie Amsterdam, nur in Braun.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 78)', inkMid: 'oklch(0.40 0.02 78)', inkSoft: 'oklch(0.54 0.018 78)',
      accent: '#9b6e23', accentInk: '#ffffff', panelBg: '#89611f', panelInk: '#ffffff',
      panelInkSoft: '#f5e8c8', panelAccent: '#ffffff', rule: '#c8b88a', chipBg: '#f5ecd1',
    },
  },
  {
    id: 'schiefer', name: 'Schiefer', description: 'Pur minimal, monochrom, einspaltig mit Foto (nach Reactive Resume)', category: 'minimal',
    layout: 'single-column', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.40 0.008 260)', inkSoft: 'oklch(0.54 0.008 260)',
      accent: '#1a1a1a', accentInk: '#ffffff', panelBg: '#eaeaea', panelInk: '#1a1a1a',
      panelInkSoft: '#6e6e6e', panelAccent: '#1a1a1a', rule: '#c1c1c1', chipBg: '#f0f0f0',
    },
  },
  {
    id: 'azur', name: 'Azur', description: 'Cyan-Akzent, leichte Sidebar, frisch (nach Reactive Resume)', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rect', bullet: 'dot', heading: 'caps-tracked',
    sidebarMm: 68,
        /* Aus der Auswahl genommen (12.09.2026): Seitenspalte links mit Inter wie Kopenhagen, nur in Türkis. Farbe ist jetzt ein eigener Regler.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 195)', inkMid: 'oklch(0.40 0.02 195)', inkSoft: 'oklch(0.54 0.018 195)',
      accent: '#008484', accentInk: '#ffffff', panelBg: '#e7ebec', panelInk: '#1a2226',
      panelInkSoft: '#687179', panelAccent: '#007a7a', rule: '#b9c6c8', chipBg: '#e0eff0',
    },
  },
  {
    id: 'amethyst', name: 'Amethyst', description: 'Volltflächen-Lila Sidebar, Name links (nach Reactive Resume)', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rect', bullet: 'dot', heading: 'caps-tracked',
    nameInSidebar: true,
    sidebarMm: 68,
        /* Aus der Auswahl genommen (12.09.2026): Name in der Farbfläche wie Seoul, nur in Violett.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 285)', inkMid: 'oklch(0.40 0.02 285)', inkSoft: 'oklch(0.54 0.018 285)',
      accent: '#4c2dc7', accentInk: '#ffffff', panelBg: '#4c2dc7', panelInk: '#ffffff',
      panelInkSoft: '#d4cdee', panelAccent: '#ffffff', rule: '#c0bcd0', chipBg: '#ece8f8',
    },
  },
  {
    id: 'farn', name: 'Farn', description: 'Mint-Header, frisch, organisch (nach Reactive Resume)', category: 'modern',
    layout: 'header-band', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
        /* Aus der Auswahl genommen (12.09.2026): Kopfbalken-Layout wie Amsterdam, nur in Grün.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 150)', inkMid: 'oklch(0.40 0.02 150)', inkSoft: 'oklch(0.54 0.018 150)',
      // panelAccent dunkler als accent: auf dem hellgrünen Kopfbalken kam das
      // Grün des Akzents nur auf 3,7:1 — die Positionszeile darunter ist klein
      // gesetzt und braucht 4,5:1. Auf Weiß bleibt der hellere Akzent.
      accent: '#3a8540', accentInk: '#ffffff', panelBg: '#d6edd6', panelInk: '#1f3a23',
      panelInkSoft: '#4a6450', panelAccent: '#2c6631', rule: '#b0c2b0', chipBg: '#e4f1e4',
    },
  },
  // ── Etsy-Inspo Welle 2026-06 ──────────────────────────────────────────────
  {
    /* Inspired by the "Chris Smithton" cobalt-on-cream maximalist resume —
     * royal blue on warm paper, big sans-serif type carrying the personality. */
    id: 'cobalt', name: 'Cobalt', description: 'Royal Blue auf Cream — laut, jung, design-affin', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'rect', bullet: 'square', heading: 'block',
    sidebarMm: 62,
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 265)', inkMid: 'oklch(0.40 0.02 265)', inkSoft: 'oklch(0.54 0.018 265)',
      accent: '#1A1AFF', accentInk: '#F4ECDA', panelBg: '#1A1AFF', panelInk: '#F4ECDA',
      panelInkSoft: '#cdc6e9', panelAccent: '#F4ECDA', rule: '#d6cfb8', chipBg: '#e7dfc6',
    },
  },
  {
    /* Inspired by the "Jonathan Patterson" marketing CV — confident navy sidebar
     * carrying the photo, contact, skills, languages while the body is a clean
     * 2-col main with subtle teal underlines on the section heads. */
    id: 'patterson', name: 'Patterson', description: 'Navy-Sidebar, business-modern mit warmem Hauptbereich', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'circle', bullet: 'dot', heading: 'caps-rule',
    nameInSidebar: false,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 255)', inkMid: 'oklch(0.40 0.02 255)', inkSoft: 'oklch(0.54 0.018 255)',
      accent: '#1d3557', accentInk: '#ffffff', panelBg: '#1d3557', panelInk: '#f3eedd',
      panelInkSoft: '#a8b3c2', panelAccent: '#e2cda8', rule: '#d8d2c2', chipBg: '#eee8d8',
    },
  },
  {
    /* Inspired by the "Katharina Mai" timeline minimalist — pure white, hairline
     * vertical rule down the middle column, tiny ALL-CAPS tracked section
     * headers, round photo top-right. Maximum air. */
    id: 'karlsruhe', name: 'Karlsruhe', description: 'Hairline-Timeline, viel Weißraum, sehr ruhig', category: 'minimal',
    layout: 'timeline', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.40 0.008 260)', inkSoft: 'oklch(0.54 0.008 260)',
      accent: '#2a2a2a', accentInk: '#ffffff', panelBg: '#ebeae7', panelInk: '#1a1a1a',
      panelInkSoft: '#686868', panelAccent: '#2a2a2a', rule: '#c3c1bd', chipBg: '#f0eee9',
    },
  },
  {
    /* Inspired by the "Emilia Hartmann" rose-blush sidebar — warm peach panel
     * carrying photo + Eckdaten + Sprachen, ivory main body with serif italic
     * touches. The corporate sister to Rosenheim's minimal cousin. */
    id: 'rosenheim', name: 'Rosenheim', description: 'Rosé-Sidebar, warm, elegant', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'garamond-archivo', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 40)', inkMid: 'oklch(0.40 0.02 40)', inkSoft: 'oklch(0.54 0.018 40)',
      accent: '#97574a', accentInk: '#ffffff', panelBg: '#f0dcd0', panelInk: '#3a1f1f',
      panelInkSoft: '#7f584f', panelAccent: '#8f4d3e', rule: '#e0c8bc', chipBg: '#e8d4c8',
    },
  },

  // ── Neue moderne Vorlagen 2026-07 ──────────────────────────────────────────
  {
    /* Swiss-Minimal: einspaltig, viel Weißraum, Space Grotesk, ein Indigo-Akzent.
     * ATS-stark und bewusst ruhig — der moderne Gegenentwurf zum Sidebar-CV. */
    id: 'helsinki', name: 'Helsinki', description: 'Swiss-Minimal, Indigo, viel Luft', category: 'minimal',
    layout: 'single-column', defaultPairing: 'space-inter', photo: 'none', bullet: 'dash', heading: 'caps-tracked',
        /* Aus der Auswahl genommen (12.09.2026): Einspaltig wie Espoo, nur ohne Fotoplatz. Wer kein Foto hochlädt, bekommt in Espoo dieselbe Seite.
       Bleibt renderbar — gespeicherte Profile behalten ihr Aussehen. */
    deprecated: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.02 265)', inkMid: 'oklch(0.40 0.02 265)', inkSoft: 'oklch(0.54 0.018 265)',
      accent: 'oklch(0.55 0.2 265)', accentInk: '#ffffff', panelBg: 'oklch(0.935 0.008 265)', panelInk: 'oklch(0.22 0.02 265)',
      panelInkSoft: 'oklch(0.54 0.02 265)', panelAccent: 'oklch(0.55 0.2 265)', rule: 'oklch(0.80 0.014 265)', chipBg: 'oklch(0.955 0.02 265)',
    },
  },
  {
    /* Helsinki mit Foto — gleicher Swiss-Minimal-Stil, rundes Portrait im Header. */
    id: 'espoo', name: 'Espoo', description: 'Helsinki-Stil mit Foto — Swiss-Minimal, Indigo', category: 'minimal',
    layout: 'single-column', defaultPairing: 'space-inter', photo: 'circle', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.02 265)', inkMid: 'oklch(0.40 0.02 265)', inkSoft: 'oklch(0.54 0.018 265)',
      accent: 'oklch(0.55 0.2 265)', accentInk: '#ffffff', panelBg: 'oklch(0.935 0.008 265)', panelInk: 'oklch(0.22 0.02 265)',
      panelInkSoft: '#636873', panelAccent: '#335FD7', rule: 'oklch(0.80 0.014 265)', chipBg: 'oklch(0.955 0.02 265)',
    },
  },
  {
    /* Tech-Bold: dunkle Sidebar trägt Name + Foto + Kontakt, elektrischer
     * Teal-Akzent, Space Grotesk. Selbstbewusst, für Design/Tech/Product. */
    id: 'seoul', name: 'Seoul', description: 'Dunkle Sidebar, elektrischer Akzent, tech-bold', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'space-inter', photo: 'rounded', bullet: 'square', heading: 'caps-tracked',
    nameInSidebar: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.015 235)', inkMid: 'oklch(0.40 0.018 235)', inkSoft: 'oklch(0.54 0.016 235)',
      accent: 'oklch(0.50 0.12 205)', accentInk: '#ffffff', panelBg: 'oklch(0.25 0.028 255)', panelInk: 'oklch(0.97 0.008 255)',
      panelInkSoft: 'oklch(0.74 0.03 255)', panelAccent: 'oklch(0.80 0.14 195)', rule: 'oklch(0.80 0.014 235)', chipBg: 'oklch(0.95 0.02 205)',
    },
  },
  {
    /* Klassik neu gedacht: zentrierter DIN-Aufbau, Tannengrün-Akzent,
     * Garamond-Display. Seriös, aber nicht altbacken. */
    id: 'lyon', name: 'Lyon', description: 'Klassik neu gedacht, Tannengrün, zentriert', category: 'klassisch',
    layout: 'top-centered', defaultPairing: 'garamond-archivo', photo: 'circle', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.24 0.02 150)', inkMid: 'oklch(0.40 0.022 150)', inkSoft: 'oklch(0.54 0.02 150)',
      accent: 'oklch(0.45 0.09 150)', accentInk: '#ffffff', panelBg: 'oklch(0.930 0.014 150)', panelInk: 'oklch(0.24 0.02 150)',
      panelInkSoft: '#606A62', panelAccent: 'oklch(0.45 0.09 150)', rule: 'oklch(0.80 0.016 150)', chipBg: 'oklch(0.95 0.02 150)',
    },
  },
  // ── Weißes Blatt, Haarlinien ──────────────────────────────────────────────
  //
  // Sechs Vorlagen aus der Sammlung vom 14.09.2026 (33 Entwürfe von Etsy,
  // Pinterest, Google). Der Befund war eindeutig und hatte eine Überraschung:
  // Was auf den Verkaufsbildern bunt aussieht — Orange, Grün, Pink —, ist fast
  // immer der Präsentationshintergrund, nicht der Lebenslauf. Nimmt man die
  // Blätter selbst, bleibt EIN Stil übrig: weißes Papier, 1-px-Linien statt
  // Farbflächen, der Name als stärkstes typografisches Element, kleines Foto,
  // Unterschrift am Fuß, alles auf einer Seite.
  //
  // Genau das fehlte im Bestand: die achtzehn vorhandenen Vorlagen arbeiten
  // fast durchweg mit eingefärbten Seitenspalten.
  {
    id: 'lueneburg', name: 'Lüneburg', description: 'Weißes Blatt, Haarlinie, gesperrter Name', category: 'minimal',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-plain',
    sidebarMm: 58, panelFill: false, trackedName: true, signature: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.24 0.004 250)', inkMid: 'oklch(0.42 0.005 250)', inkSoft: 'oklch(0.54 0.005 250)',
      accent: 'oklch(0.38 0.006 250)', accentInk: '#ffffff', panelBg: '#ffffff', panelInk: 'oklch(0.24 0.004 250)',
      panelInkSoft: 'oklch(0.45 0.005 250)', panelAccent: 'oklch(0.38 0.006 250)', rule: 'oklch(0.84 0.004 250)', chipBg: 'oklch(0.96 0.003 250)',
    },
  },
  {
    id: 'husum', name: 'Husum', description: 'Bewerbungsset-Klassik mit Foto und Unterschrift', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'garamond-archivo', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    sidebarMm: 60, panelFill: false, signature: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.008 60)', inkMid: 'oklch(0.41 0.010 60)', inkSoft: 'oklch(0.54 0.010 60)',
      accent: 'oklch(0.40 0.026 60)', accentInk: '#ffffff', panelBg: '#ffffff', panelInk: 'oklch(0.23 0.008 60)',
      panelInkSoft: 'oklch(0.44 0.010 60)', panelAccent: 'oklch(0.40 0.026 60)', rule: 'oklch(0.83 0.010 60)', chipBg: 'oklch(0.96 0.006 60)',
    },
  },
  {
    id: 'bregenz', name: 'Bregenz', description: 'Spalte rechts, ohne Fläche, ruhig', category: 'minimal',
    layout: 'sidebar-right', defaultPairing: 'plex-corporate', photo: 'circle', bullet: 'dot', heading: 'caps-plain',
    sidebarMm: 58, panelFill: false, signature: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.24 0.006 210)', inkMid: 'oklch(0.42 0.008 210)', inkSoft: 'oklch(0.54 0.008 210)',
      accent: 'oklch(0.40 0.030 210)', accentInk: '#ffffff', panelBg: '#ffffff', panelInk: 'oklch(0.24 0.006 210)',
      panelInkSoft: 'oklch(0.44 0.008 210)', panelAccent: 'oklch(0.40 0.030 210)', rule: 'oklch(0.84 0.008 210)', chipBg: 'oklch(0.96 0.005 210)',
    },
  },
  {
    id: 'uppsala', name: 'Uppsala', description: 'DIN-Einseiter, zentriert, ohne Foto', category: 'minimal',
    layout: 'top-centered', defaultPairing: 'pure-inter', photo: 'none', bullet: 'dash', heading: 'caps-rule',
    trackedName: true, signature: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.003 260)', inkMid: 'oklch(0.41 0.004 260)', inkSoft: 'oklch(0.54 0.004 260)',
      accent: 'oklch(0.35 0.004 260)', accentInk: '#ffffff', panelBg: 'oklch(0.965 0.002 260)', panelInk: 'oklch(0.22 0.003 260)',
      panelInkSoft: 'oklch(0.44 0.004 260)', panelAccent: 'oklch(0.35 0.004 260)', rule: 'oklch(0.82 0.003 260)', chipBg: 'oklch(0.96 0.002 260)',
    },
  },
  {
    id: 'aarhus', name: 'Aarhus', description: 'Editorial: Name und Profil links, Werdegang rechts', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'lora-source', photo: 'none', bullet: 'dash', heading: 'caps-plain',
    sidebarMm: 74, panelFill: false, nameInSidebar: true, profileInSidebar: true, signature: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.20 0.006 40)', inkMid: 'oklch(0.40 0.008 40)', inkSoft: 'oklch(0.54 0.008 40)',
      accent: 'oklch(0.38 0.030 40)', accentInk: '#ffffff', panelBg: '#ffffff', panelInk: 'oklch(0.20 0.006 40)',
      panelInkSoft: 'oklch(0.42 0.008 40)', panelAccent: 'oklch(0.38 0.030 40)', rule: 'oklch(0.81 0.008 40)', chipBg: 'oklch(0.96 0.005 40)',
    },
  },
  // ── Eigenwillig, und trotzdem maschinenlesbar ──────────────────────────────
  //
  // Nachtrag 14.09.2026. Die fünf Vorlagen oben nehmen die RUHIGE Hälfte der
  // Sammlung auf — weißes Blatt, Haarlinien. Die andere Hälfte ist laut, und
  // zwar typografisch, nicht farblich: Bei Robin Masset sind „work" und
  // „education" so groß wie anderswo der Name; bei Anna Lemaire steht der
  // Nachname über die volle Blattbreite; bei Romain Fournier zerlegen dicke
  // Striche die Seite in Register.
  //
  // Das Gute daran: Nichts davon kostet Maschinenlesbarkeit. Ein Parser sucht
  // Sektionstitel — große findet er leichter als kleine. Die Risiken liegen
  // woanders (Spalten, Reihenfolge im Textstrom, Schrift unter 8 pt), und die
  // sind hier alle geregelt.
  {
    id: 'lille', name: 'Lille', description: 'Überschriften so groß wie der Name', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'space-inter', photo: 'rect', bullet: 'dash', heading: 'display',
    sidebarMm: 54, panelFill: false, nameInSidebar: true, signature: true,
    colors: {
      pageBg: '#fbf9f1', ink: '#141414', inkMid: 'oklch(0.38 0.004 90)', inkSoft: 'oklch(0.52 0.004 90)',
      accent: '#141414', accentInk: '#fbf9f1', panelBg: '#fbf9f1', panelInk: '#141414',
      panelInkSoft: 'oklch(0.42 0.004 90)', panelAccent: '#141414', rule: 'oklch(0.78 0.006 90)', chipBg: 'oklch(0.94 0.008 90)',
    },
  },
  {
    id: 'antwerpen', name: 'Antwerpen', description: 'Nachname über die volle Breite, Creme, editorial', category: 'kreativ',
    layout: 'top-centered', defaultPairing: 'space-inter', photo: 'rect', bullet: 'dash', heading: 'rule-over',
    stackedName: true, bracketLabels: true, signature: true,
    colors: {
      pageBg: '#fbf8ee', ink: '#161616', inkMid: 'oklch(0.37 0.006 85)', inkSoft: 'oklch(0.52 0.006 85)',
      accent: '#161616', accentInk: '#fbf8ee', panelBg: 'oklch(0.945 0.012 85)', panelInk: '#161616',
      panelInkSoft: 'oklch(0.41 0.006 85)', panelAccent: '#161616', rule: 'oklch(0.76 0.008 85)', chipBg: 'oklch(0.94 0.012 85)',
    },
  },
  {
    id: 'rotterdam', name: 'Rotterdam', description: 'Register statt Absätze, gesperrter Name, Raster', category: 'kreativ',
    layout: 'sidebar-right', defaultPairing: 'space-inter', photo: 'rect', bullet: 'square', heading: 'rule-over',
    sidebarMm: 60, panelFill: false, trackedName: true, signature: true,
    colors: {
      pageBg: '#ffffff', ink: '#101010', inkMid: 'oklch(0.37 0 0)', inkSoft: 'oklch(0.51 0 0)',
      accent: '#101010', accentInk: '#ffffff', panelBg: '#ffffff', panelInk: '#101010',
      panelInkSoft: 'oklch(0.40 0 0)', panelAccent: '#101010', rule: 'oklch(0.74 0 0)', chipBg: 'oklch(0.945 0 0)',
    },
  },
];

/** Vorlagen für die Auswahl — ohne die stillgelegten Farbvarianten. */
export const PICKABLE_THEMES: ResumeTheme[] = THEMES.filter(t => !t.deprecated);


// ── Akzentfarbe ─────────────────────────────────────────────────────────────
//
// Vorher gab es 25 Vorlagen, von denen ein gutes Drittel dieselbe Konstruktion
// in einer anderen Farbe war: Kopenhagen/Azurill, Pikachu/Leafish,
// Helsinki/Espoo, München/Genf, Stockholm/Karlsruhe. Wer sie nebeneinander
// sieht, erkennt keinen Unterschied — die Auswahl wurde dadurch nicht reicher,
// sondern schwerer.
//
// Die Farbe gehört nicht in den Vorlagennamen, sie ist eine eigene
// Entscheidung. Deshalb: Farbvarianten aus der Liste genommen (die Vorlagen
// selbst bleiben renderbar, gespeicherte Profile ändern sich nicht) und die
// Farbe als eigener Regler daneben.
//
// Alle Werte liegen auf Weiß über 6,9:1 — damit gilt in beide Richtungen
// WCAG AA, auch für weiße Schrift auf der Akzentfläche.
export const ACCENTS: { id: AccentId; name: string; value: string | null }[] = [
  { id: 'auto', name: 'Vorlagenfarbe', value: null },
  { id: 'graphit', name: 'Graphit', value: '#3A4250' },
  { id: 'tinte', name: 'Tinte', value: '#1F4B8F' },
  { id: 'petrol', name: 'Petrol', value: '#0F5C68' },
  { id: 'tanne', name: 'Tanne', value: '#245C43' },
  { id: 'olive', name: 'Olive', value: '#5A5A1F' },
  { id: 'kupfer', name: 'Kupfer', value: '#8F4519' },
  { id: 'bordeaux', name: 'Bordeaux', value: '#8A2F3E' },
  { id: 'aubergine', name: 'Aubergine', value: '#5C3A78' },
];

export type { AccentId, PaperId };

/** Wählbare Papierfarben.
 *
 *  Till, 14.09.2026: „Wenn du schon den Hintergrund änderst bei einigen
 *  Designs, dann lass uns dafür sorgen, dass man das als Nutzer notfalls
 *  wieder rückgängig machen kann." Genau das ist `auto`: die Vorlage behält
 *  ihre eigene Farbe, jede andere Wahl überschreibt sie, und zurück geht es
 *  mit einem Klick.
 *
 *  Der erste Lauf der Kontrastprüfung über alle Kombinationen brachte einen
 *  Altbefund ans Licht, der mit dem Papier gar nichts zu tun hatte: die leise
 *  Textfarbe (`inkSoft`) stand in achtzehn Vorlagen auf oklch(0.56) — das
 *  sind 4,6:1 auf Weiß, also die WCAG-Grenze OHNE jeden Abstand. Auf
 *  getöntem Papier fiel sie darunter. Statt die Papiere aufzuhellen, bis der
 *  Fehler verschwindet, ist die Ursache behoben: 0.54 für alle, ≈ 5,1:1 auf
 *  Weiß und ≈ 4,8:1 auf dem dunkelsten Papier.
 *
 *  Alle Werte sind hell genug, dass die Textfarben der Vorlagen darauf
 *  WCAG AA erreichen — geprüft in scripts/contrastcheck.mjs über alle
 *  Kombinationen aus Vorlage, Akzent und Papier. Dunkles Papier steht
 *  bewusst nicht zur Wahl: es wäre in jedem Drucker ein anderes Blatt und
 *  auf dem Weg durch ein Bewerbermanagementsystem ein Risiko ohne Gewinn. */
export const PAPERS: { id: PaperId; name: string; value: string | null }[] = [
  { id: 'auto', name: 'Vorlagenfarbe', value: null },
  { id: 'weiss', name: 'Weiß', value: '#ffffff' },
  { id: 'creme', name: 'Creme', value: '#fbf8ee' },
  { id: 'sand', name: 'Sand', value: '#f7f3ea' },
  { id: 'leinen', name: 'Leinen', value: '#f6f4ef' },
  { id: 'nebel', name: 'Nebel', value: '#f4f5f7' },
];

/** Vorlage mit gewählter Papierfarbe. `auto` lässt die Vorlage, wie sie ist.
 *
 *  Der Haken steckt in der Seitenspalte: Vorlagen mit `panelFill: false`
 *  malen sie in der Papierfarbe, damit sie eben KEINE Fläche ist. Würde nur
 *  `pageBg` gewechselt, stünde plötzlich ein cremefarbener Balken auf weißem
 *  Papier — die Fläche, die die Vorlage gerade nicht haben will. Deshalb
 *  wandert `panelBg` mit, aber nur dort, wo er vorher gleich war. */
export function applyPaper(theme: ResumeTheme, paper?: PaperId): ResumeTheme {
  const pick = PAPERS.find(p => p.id === paper);
  if (!pick || !pick.value) return theme;
  const gleich = theme.colors.panelBg.trim().toLowerCase() === theme.colors.pageBg.trim().toLowerCase();
  const colors: ThemeColors = { ...theme.colors, pageBg: pick.value };
  if (gleich) colors.panelBg = pick.value;
  return { ...theme, colors };
}

/** Ist eine Farbe hell genug, dass dunkler Text darauf steht?
 *
 *  Die Themes notieren teils in Hex, teils in OKLCH. Bei OKLCH ist der erste
 *  Wert bereits die wahrgenommene Helligkeit — den kann man direkt lesen. Für
 *  Hex wird die relative Leuchtdichte nach WCAG gerechnet. Gebraucht wird das,
 *  um zu entscheiden, ob eine gewählte Akzentfarbe auch auf der Farbfläche der
 *  Seitenspalte lesbar wäre: auf einer dunklen Fläche wäre sie es nicht. */
function isLightSurface(color: string): boolean {
  const ok = /oklch\(\s*([0-9.]+)/i.exec(color);
  if (ok) return parseFloat(ok[1]) > 0.72;
  const hex = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return true;
  const v = hex[1];
  const ch = [0, 2, 4].map(i => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2] > 0.45;
}

/** Vorlage mit gewählter Akzentfarbe. `auto` lässt die Vorlage, wie sie ist. */
export function applyAccent(theme: ResumeTheme, accent?: AccentId): ResumeTheme {
  const pick = ACCENTS.find(a => a.id === accent);
  if (!pick || !pick.value) return theme;
  // Alle wählbaren Akzente sind dunkel (≥ 6,9:1 auf Weiß). Damit ist Weiß die
  // richtige Schrift auf einer Akzentfläche — die Vorlagenfarbe konnte dafür
  // auch Schwarz vorgesehen haben, und dunkel auf dunkel wäre unlesbar.
  const colors: ThemeColors = { ...theme.colors, accent: pick.value, accentInk: '#FFFFFF' };
  // Auf einer hellen Seitenspalte trägt dieselbe Farbe; auf einer dunklen
  // (Seoul, Bordeaux, Patterson) bleibt der helle Akzent der Vorlage stehen,
  // sonst verschwände die Beschriftung im Untergrund.
  if (isLightSurface(theme.colors.panelBg)) colors.panelAccent = pick.value;
  return { ...theme, colors };
}

/** Frühere Vorlagen-Kennungen.
 *
 *  Fünf Vorlagen hießen nach geschützten Figuren (Pikachu, Onyx, Azurill,
 *  Gengar, Leafish — aus Reactive Resume übernommen). In einem privaten
 *  Werkzeug ist das gleichgültig, in einem öffentlichen Projekt nicht. Die
 *  Kennungen stehen aber in gespeicherten Profilen; wer sie einfach umbenennt,
 *  wirft alle Nutzer auf die erste Vorlage zurück. Deshalb bleiben die alten
 *  Namen als Weiterleitung bestehen — für immer, sie kosten nichts. */
const THEME_ALIASES: Record<string, string> = {
  pikachu: 'sonnenblume',
  onyx: 'schiefer',
  azurill: 'azur',
  gengar: 'amethyst',
  leafish: 'farn',
};

export function resolveThemeId(id: string): string {
  return THEME_ALIASES[id] ?? id;
}

export function getTheme(id: string, accent?: AccentId, paper?: PaperId): ResumeTheme {
  const wanted = resolveThemeId(id);
  return applyPaper(applyAccent(THEMES.find(t => t.id === wanted) ?? THEMES[0], accent), paper);
}

export function resolvePairing(theme: ResumeTheme, pairing: FontPairingId): FontPairing {
  if (pairing === 'auto') return FONT_PAIRINGS[theme.defaultPairing];
  return FONT_PAIRINGS[pairing];
}
