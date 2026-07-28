// ── Template Theme System ───────────────────────────────────────────────────
// Every visible CV/cover-letter design is a config object rendered by
// ResumeRenderer / CoverLetterRenderer. This keeps 15+ templates consistent
// and maintainable instead of 15 hand-written components.

import type { FontPairingId } from '../data/types';

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
export type HeadingStyle = 'caps-tracked' | 'caps-rule' | 'serif' | 'bar' | 'block';

// ── Font pairings ───────────────────────────────────────────────────────────

export interface FontPairing {
  id: FontPairingId;
  name: string;
  note: string;
  heading: string;
  body: string;
}

const SANS = "'Inter', system-ui, sans-serif";

export const FONT_PAIRINGS: Record<Exclude<FontPairingId, 'auto'>, FontPairing> = {
  'inter-playfair': {
    id: 'inter-playfair', name: 'Modern Klassisch', note: 'Display-Serif + Sans',
    heading: "'Playfair Display', Georgia, serif", body: SANS,
  },
  'pure-inter': {
    id: 'pure-inter', name: 'Pur', note: 'Durchgehend Inter',
    heading: SANS, body: SANS,
  },
  'lora-source': {
    id: 'lora-source', name: 'Editorial', note: 'Lora + Source Sans',
    heading: "'Lora', Georgia, serif", body: "'Source Sans 3', sans-serif",
  },
  'merri-source': {
    id: 'merri-source', name: 'Seriös', note: 'Merriweather + Source Sans',
    heading: "'Merriweather', Georgia, serif", body: "'Source Sans 3', sans-serif",
  },
  'space-inter': {
    id: 'space-inter', name: 'Tech', note: 'Space Grotesk + Inter',
    heading: "'Space Grotesk', sans-serif", body: SANS,
  },
  'garamond-archivo': {
    id: 'garamond-archivo', name: 'Elegant', note: 'Garamond + Archivo',
    heading: "'EB Garamond', Georgia, serif", body: "'Archivo', sans-serif",
  },
  'plex-corporate': {
    id: 'plex-corporate', name: 'Korporat', note: 'IBM Plex Serif + Sans',
    heading: "'IBM Plex Serif', Georgia, serif", body: "'IBM Plex Sans', sans-serif",
  },
  'libre-inter': {
    id: 'libre-inter', name: 'Buch', note: 'Libre Baskerville + Inter',
    heading: "'Libre Baskerville', Georgia, serif", body: SANS,
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
}

// ── 15 Templates ────────────────────────────────────────────────────────────

export const THEMES: ResumeTheme[] = [
  {
    id: 'hamburg', name: 'Hamburg', description: 'Warm, editorial, klassisch', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'inter-playfair', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 70)', inkMid: 'oklch(0.45 0.02 70)', inkSoft: 'oklch(0.61 0.018 70)',
      accent: '#8B7355', accentInk: '#ffffff', panelBg: '#faf8f4', panelInk: '#2a2a2a',
      panelInkSoft: '#777777', panelAccent: '#7a6248', rule: 'rgba(139,115,85,0.22)', chipBg: '#f0ebe1',
    },
  },
  {
    id: 'kopenhagen', name: 'Kopenhagen', description: 'Kühl, ruhig, skandinavisch', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 245)', inkMid: 'oklch(0.45 0.02 245)', inkSoft: 'oklch(0.61 0.018 245)',
      accent: '#3d6b8c', accentInk: '#ffffff', panelBg: '#f3f5f7', panelInk: '#2a3138',
      panelInkSoft: '#7a838c', panelAccent: '#3d6b8c', rule: '#dde2e6', chipBg: '#e7ecf0',
    },
  },
  {
    id: 'oslo', name: 'Oslo', description: 'Salbei-Grün, minimal, frisch', category: 'modern',
    layout: 'sidebar-right', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 135)', inkMid: 'oklch(0.45 0.02 135)', inkSoft: 'oklch(0.61 0.018 135)',
      accent: '#6b7f5e', accentInk: '#ffffff', panelBg: '#eef1ea', panelInk: '#2c322a',
      panelInkSoft: '#7e8579', panelAccent: '#5d7050', rule: '#dde1d7', chipBg: '#e3e8db',
    },
  },
  {
    id: 'berlin', name: 'Berlin', description: 'Bold, schwarz, kontrastreich', category: 'modern',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'none', bullet: 'square', heading: 'block',
    uppercaseName: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 265)', inkMid: 'oklch(0.44 0.008 265)', inkSoft: 'oklch(0.6 0.008 265)',
      accent: '#1a1a1a', accentInk: '#ffffff', panelBg: '#111111', panelInk: '#ffffff',
      panelInkSoft: '#9a9a9a', panelAccent: '#ffffff', rule: '#e2e2e2', chipBg: '#f1f1f1',
    },
  },
  {
    id: 'wien', name: 'Wien', description: 'Navy, seriös, traditionell', category: 'klassisch',
    layout: 'top-centered', defaultPairing: 'merri-source', photo: 'circle', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 255)', inkMid: 'oklch(0.45 0.02 255)', inkSoft: 'oklch(0.61 0.018 255)',
      accent: '#1f3a5f', accentInk: '#ffffff', panelBg: '#f4f6f9', panelInk: '#1a2233',
      panelInkSoft: '#7c8498', panelAccent: '#1f3a5f', rule: '#dde2ea', chipBg: '#e8ecf2',
    },
  },
  {
    id: 'zuerich', name: 'Zürich', description: 'Monochrom, ATS-pur, minimal', category: 'minimal',
    layout: 'single-column', defaultPairing: 'pure-inter', photo: 'none', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.44 0.008 260)', inkSoft: 'oklch(0.6 0.008 260)',
      accent: '#2a2a2a', accentInk: '#ffffff', panelBg: '#f6f6f6', panelInk: '#1a1a1a',
      panelInkSoft: '#888888', panelAccent: '#444444', rule: '#e4e4e4', chipBg: '#f0f0f0',
    },
  },
  {
    id: 'terrakotta', name: 'Terrakotta', description: 'Warmes Terracotta, kreativ', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'lora-source', photo: 'rect', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 48)', inkMid: 'oklch(0.45 0.02 48)', inkSoft: 'oklch(0.61 0.018 48)',
      accent: '#9b4f2e', accentInk: '#ffffff', panelBg: '#f5ede4', panelInk: '#2a201a',
      panelInkSoft: '#8a7d70', panelAccent: '#9b4f2e', rule: 'rgba(155,79,46,0.25)', chipBg: '#ece0d3',
    },
  },
  {
    id: 'muenchen', name: 'München', description: 'Dunkle Sidebar, korporat', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'rect', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 258)', inkMid: 'oklch(0.45 0.02 258)', inkSoft: 'oklch(0.61 0.018 258)',
      accent: '#243044', accentInk: '#ffffff', panelBg: '#243044', panelInk: '#f3f4f6',
      panelInkSoft: '#9aa3b2', panelAccent: '#c7a06b', rule: '#e0e2e6', chipBg: '#eef0f3',
    },
  },
  {
    id: 'lissabon', name: 'Lissabon', description: 'Petrol, geometrisch, modern', category: 'modern',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'circle', bullet: 'chevron', heading: 'bar',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 200)', inkMid: 'oklch(0.45 0.02 200)', inkSoft: 'oklch(0.61 0.018 200)',
      accent: '#0f6e78', accentInk: '#ffffff', panelBg: '#0f6e78', panelInk: '#ffffff',
      panelInkSoft: '#a9d4d8', panelAccent: '#ffffff', rule: '#d8e3e4', chipBg: '#e3eeef',
    },
  },
  {
    id: 'mailand', name: 'Mailand', description: 'Burgunder, editorial, elegant', category: 'kreativ',
    layout: 'sidebar-right', defaultPairing: 'garamond-archivo', photo: 'rect', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 18)', inkMid: 'oklch(0.45 0.02 18)', inkSoft: 'oklch(0.61 0.018 18)',
      accent: '#7a2230', accentInk: '#ffffff', panelBg: '#f6eeef', panelInk: '#2a1a1d',
      panelInkSoft: '#8f7d80', panelAccent: '#7a2230', rule: 'rgba(122,34,48,0.22)', chipBg: '#efe1e2',
    },
  },
  {
    id: 'stockholm', name: 'Stockholm', description: 'Zeitstrahl, leicht, klar', category: 'modern',
    layout: 'timeline', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 250)', inkMid: 'oklch(0.45 0.02 250)', inkSoft: 'oklch(0.61 0.018 250)',
      accent: '#2f6db0', accentInk: '#ffffff', panelBg: '#f2f5f8', panelInk: '#1d2125',
      panelInkSoft: '#7e868f', panelAccent: '#2f6db0', rule: '#dde3e9', chipBg: '#e6ecf2',
    },
  },
  {
    id: 'bordeaux', name: 'Bordeaux', description: 'Tiefes Weinrot, charaktervoll', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'libre-inter', photo: 'rounded', bullet: 'square', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 15)', inkMid: 'oklch(0.45 0.02 15)', inkSoft: 'oklch(0.61 0.018 15)',
      accent: '#5c1f2e', accentInk: '#ffffff', panelBg: '#5c1f2e', panelInk: '#f6eef0',
      panelInkSoft: '#c9a3ab', panelAccent: '#e3b9a0', rule: '#e6dadb', chipBg: '#f0e6e8',
    },
  },
  {
    id: 'tokio', name: 'Tokio', description: 'Stark Schwarz/Weiß, Display-Serif', category: 'minimal',
    layout: 'single-column', defaultPairing: 'inter-playfair', photo: 'none', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.44 0.008 260)', inkSoft: 'oklch(0.6 0.008 260)',
      accent: '#0a0a0a', accentInk: '#ffffff', panelBg: '#f4f4f4', panelInk: '#0a0a0a',
      panelInkSoft: '#8c8c8c', panelAccent: '#0a0a0a', rule: '#e2e2e2', chipBg: '#efefef',
    },
  },
  {
    id: 'amsterdam', name: 'Amsterdam', description: 'Orange-Akzent, frisch, jung', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'circle', bullet: 'arrow', heading: 'block',
    accentName: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 52)', inkMid: 'oklch(0.45 0.02 52)', inkSoft: 'oklch(0.61 0.018 52)',
      accent: '#e0691f', accentInk: '#ffffff', panelBg: '#fdf2e8', panelInk: '#2a241d',
      panelInkSoft: '#8d897f', panelAccent: '#e0691f', rule: '#ece5da', chipBg: '#f8e8d8',
    },
  },
  {
    id: 'genf', name: 'Genf', description: 'Anthrazit, sachlich, business', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 255)', inkMid: 'oklch(0.44 0.008 255)', inkSoft: 'oklch(0.6 0.008 255)',
      accent: '#3a3f47', accentInk: '#ffffff', panelBg: '#eef0f2', panelInk: '#22262b',
      panelInkSoft: '#80858d', panelAccent: '#3a3f47', rule: '#e0e2e5', chipBg: '#e7e9ec',
    },
  },

  // ── Portiert aus Reactive Resume (MIT, AmruthPillai/Reactive-Resume) ───────
  // Designs adaptiert in unsere Engine — Farben, Layouts, Akzentführung.

  {
    id: 'pikachu', name: 'Pikachu', description: 'Goldenes Header-Band, prägnant (Reactive Resume)', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'pure-inter', photo: 'rect', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 78)', inkMid: 'oklch(0.45 0.02 78)', inkSoft: 'oklch(0.61 0.018 78)',
      accent: '#b07d28', accentInk: '#ffffff', panelBg: '#b07d28', panelInk: '#ffffff',
      panelInkSoft: '#f5e8c8', panelAccent: '#ffffff', rule: '#e8d8a8', chipBg: '#f5ecd1',
    },
  },
  {
    id: 'onyx', name: 'Onyx', description: 'Pur minimal, monochrom, einspaltig mit Foto (Reactive Resume)', category: 'minimal',
    layout: 'single-column', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.44 0.008 260)', inkSoft: 'oklch(0.6 0.008 260)',
      accent: '#1a1a1a', accentInk: '#ffffff', panelBg: '#f6f6f6', panelInk: '#1a1a1a',
      panelInkSoft: '#888', panelAccent: '#1a1a1a', rule: '#e2e2e2', chipBg: '#f0f0f0',
    },
  },
  {
    id: 'azurill', name: 'Azurill', description: 'Cyan-Akzent, leichte Sidebar, frisch (Reactive Resume)', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rect', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 195)', inkMid: 'oklch(0.45 0.02 195)', inkSoft: 'oklch(0.61 0.018 195)',
      accent: '#00a3a3', accentInk: '#ffffff', panelBg: '#f4f8f9', panelInk: '#1a2226',
      panelInkSoft: '#76808a', panelAccent: '#00a3a3', rule: '#d8e6e8', chipBg: '#e0eff0',
    },
  },
  {
    id: 'gengar', name: 'Gengar', description: 'Volltflächen-Lila Sidebar, Name links (Reactive Resume)', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rect', bullet: 'dot', heading: 'caps-tracked',
    nameInSidebar: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 285)', inkMid: 'oklch(0.45 0.02 285)', inkSoft: 'oklch(0.61 0.018 285)',
      accent: '#4c2dc7', accentInk: '#ffffff', panelBg: '#4c2dc7', panelInk: '#ffffff',
      panelInkSoft: '#d4cdee', panelAccent: '#ffffff', rule: '#e0dcf0', chipBg: '#ece8f8',
    },
  },
  {
    id: 'leafish', name: 'Leafish', description: 'Mint-Header, frisch, organisch (Reactive Resume)', category: 'modern',
    layout: 'header-band', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.018 150)', inkMid: 'oklch(0.45 0.02 150)', inkSoft: 'oklch(0.61 0.018 150)',
      accent: '#3a8540', accentInk: '#ffffff', panelBg: '#d6edd6', panelInk: '#1f3a23',
      panelInkSoft: '#5a755e', panelAccent: '#3a8540', rule: '#cde0cd', chipBg: '#e4f1e4',
    },
  },
  // ── Etsy-Inspo Welle 2026-06 ──────────────────────────────────────────────
  {
    /* Inspired by the "Chris Smithton" cobalt-on-cream maximalist resume —
     * royal blue on warm paper, big sans-serif type carrying the personality. */
    id: 'cobalt', name: 'Cobalt', description: 'Royal Blue auf Cream — laut, jung, design-affin', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'rect', bullet: 'square', heading: 'block',
    colors: {
      pageBg: '#F4ECDA', ink: 'oklch(0.23 0.018 265)', inkMid: 'oklch(0.45 0.02 265)', inkSoft: 'oklch(0.61 0.018 265)',
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
      pageBg: '#fcfaf6', ink: 'oklch(0.23 0.018 255)', inkMid: 'oklch(0.45 0.02 255)', inkSoft: 'oklch(0.61 0.018 255)',
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
      pageBg: '#ffffff', ink: 'oklch(0.22 0.006 260)', inkMid: 'oklch(0.44 0.008 260)', inkSoft: 'oklch(0.6 0.008 260)',
      accent: '#2a2a2a', accentInk: '#ffffff', panelBg: '#f8f7f4', panelInk: '#1a1a1a',
      panelInkSoft: '#7c7c7c', panelAccent: '#2a2a2a', rule: '#e8e6e1', chipBg: '#f0eee9',
    },
  },
  {
    /* Inspired by the "Emilia Hartmann" rose-blush sidebar — warm peach panel
     * carrying photo + Eckdaten + Sprachen, ivory main body with serif italic
     * touches. The corporate sister to Rosenheim's minimal cousin. */
    id: 'rosenheim', name: 'Rosenheim', description: 'Rosé-Sidebar, warm, elegant', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'garamond-archivo', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#fbf7f4', ink: 'oklch(0.23 0.018 40)', inkMid: 'oklch(0.45 0.02 40)', inkSoft: 'oklch(0.61 0.018 40)',
      accent: '#b46a5a', accentInk: '#ffffff', panelBg: '#f0dcd0', panelInk: '#3a1f1f',
      panelInkSoft: '#8a6056', panelAccent: '#b46a5a', rule: '#e0c8bc', chipBg: '#e8d4c8',
    },
  },

  // ── Neue moderne Vorlagen 2026-07 ──────────────────────────────────────────
  {
    /* Swiss-Minimal: einspaltig, viel Weißraum, Space Grotesk, ein Indigo-Akzent.
     * ATS-stark und bewusst ruhig — der moderne Gegenentwurf zum Sidebar-CV. */
    id: 'helsinki', name: 'Helsinki', description: 'Swiss-Minimal, Indigo, viel Luft', category: 'minimal',
    layout: 'single-column', defaultPairing: 'space-inter', photo: 'none', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.02 265)', inkMid: 'oklch(0.45 0.02 265)', inkSoft: 'oklch(0.62 0.018 265)',
      accent: 'oklch(0.55 0.2 265)', accentInk: '#ffffff', panelBg: 'oklch(0.975 0.006 265)', panelInk: 'oklch(0.22 0.02 265)',
      panelInkSoft: 'oklch(0.6 0.02 265)', panelAccent: 'oklch(0.55 0.2 265)', rule: 'oklch(0.9 0.012 265)', chipBg: 'oklch(0.955 0.02 265)',
    },
  },
  {
    /* Helsinki mit Foto — gleicher Swiss-Minimal-Stil, rundes Portrait im Header. */
    id: 'espoo', name: 'Espoo', description: 'Helsinki-Stil mit Foto — Swiss-Minimal, Indigo', category: 'minimal',
    layout: 'single-column', defaultPairing: 'space-inter', photo: 'circle', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.22 0.02 265)', inkMid: 'oklch(0.45 0.02 265)', inkSoft: 'oklch(0.62 0.018 265)',
      accent: 'oklch(0.55 0.2 265)', accentInk: '#ffffff', panelBg: 'oklch(0.975 0.006 265)', panelInk: 'oklch(0.22 0.02 265)',
      panelInkSoft: 'oklch(0.6 0.02 265)', panelAccent: 'oklch(0.55 0.2 265)', rule: 'oklch(0.9 0.012 265)', chipBg: 'oklch(0.955 0.02 265)',
    },
  },
  {
    /* Tech-Bold: dunkle Sidebar trägt Name + Foto + Kontakt, elektrischer
     * Teal-Akzent, Space Grotesk. Selbstbewusst, für Design/Tech/Product. */
    id: 'seoul', name: 'Seoul', description: 'Dunkle Sidebar, elektrischer Akzent, tech-bold', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'space-inter', photo: 'rounded', bullet: 'square', heading: 'caps-tracked',
    nameInSidebar: true,
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.23 0.015 235)', inkMid: 'oklch(0.45 0.018 235)', inkSoft: 'oklch(0.62 0.016 235)',
      accent: 'oklch(0.60 0.13 205)', accentInk: '#06141a', panelBg: 'oklch(0.25 0.028 255)', panelInk: 'oklch(0.97 0.008 255)',
      panelInkSoft: 'oklch(0.74 0.03 255)', panelAccent: 'oklch(0.80 0.14 195)', rule: 'oklch(0.9 0.012 235)', chipBg: 'oklch(0.95 0.02 205)',
    },
  },
  {
    /* Klassik neu gedacht: zentrierter DIN-Aufbau, Tannengrün-Akzent,
     * Garamond-Display. Seriös, aber nicht altbacken. */
    id: 'lyon', name: 'Lyon', description: 'Klassik neu gedacht, Tannengrün, zentriert', category: 'klassisch',
    layout: 'top-centered', defaultPairing: 'garamond-archivo', photo: 'circle', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: 'oklch(0.24 0.02 150)', inkMid: 'oklch(0.45 0.022 150)', inkSoft: 'oklch(0.61 0.02 150)',
      accent: 'oklch(0.45 0.09 150)', accentInk: '#ffffff', panelBg: 'oklch(0.965 0.012 150)', panelInk: 'oklch(0.24 0.02 150)',
      panelInkSoft: 'oklch(0.6 0.02 150)', panelAccent: 'oklch(0.45 0.09 150)', rule: 'oklch(0.9 0.014 150)', chipBg: 'oklch(0.95 0.02 150)',
    },
  },
];

export function getTheme(id: string): ResumeTheme {
  return THEMES.find(t => t.id === id) ?? THEMES[0];
}

export function resolvePairing(theme: ResumeTheme, pairing: FontPairingId): FontPairing {
  if (pairing === 'auto') return FONT_PAIRINGS[theme.defaultPairing];
  return FONT_PAIRINGS[pairing];
}
