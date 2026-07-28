// ── Template Theme System ───────────────────────────────────────────────────
// Every visible CV/cover-letter design is a config object rendered by
// ResumeRenderer / CoverLetterRenderer. This keeps 15+ templates consistent
// and maintainable instead of 15 hand-written components.

import type { FontPairingId } from './types';

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
}

// ── 15 Templates ────────────────────────────────────────────────────────────

export const THEMES: ResumeTheme[] = [
  {
    id: 'hamburg', name: 'Hamburg', description: 'Warm, editorial, klassisch', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'inter-playfair', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    colors: {
      pageBg: '#ffffff', ink: '#111111', inkMid: '#4a4a4a', inkSoft: '#8a8a8a',
      accent: '#8B7355', accentInk: '#ffffff', panelBg: '#faf8f4', panelInk: '#2a2a2a',
      panelInkSoft: '#777777', panelAccent: '#7a6248', rule: 'rgba(139,115,85,0.22)', chipBg: '#f0ebe1',
    },
  },
  {
    id: 'kopenhagen', name: 'Kopenhagen', description: 'Kühl, ruhig, skandinavisch', category: 'modern',
    layout: 'sidebar-left', defaultPairing: 'pure-inter', photo: 'rounded', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: '#1c2024', inkMid: '#4c545c', inkSoft: '#8a929a',
      accent: '#3d6b8c', accentInk: '#ffffff', panelBg: '#f3f5f7', panelInk: '#2a3138',
      panelInkSoft: '#7a838c', panelAccent: '#3d6b8c', rule: '#dde2e6', chipBg: '#e7ecf0',
    },
  },
  {
    id: 'oslo', name: 'Oslo', description: 'Salbei-Grün, minimal, frisch', category: 'modern',
    layout: 'sidebar-right', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: '#22271f', inkMid: '#4e554a', inkSoft: '#8b9085',
      accent: '#6b7f5e', accentInk: '#ffffff', panelBg: '#eef1ea', panelInk: '#2c322a',
      panelInkSoft: '#7e8579', panelAccent: '#5d7050', rule: '#dde1d7', chipBg: '#e3e8db',
    },
  },
  {
    id: 'berlin', name: 'Berlin', description: 'Bold, schwarz, kontrastreich', category: 'modern',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'none', bullet: 'square', heading: 'block',
    uppercaseName: true,
    colors: {
      pageBg: '#ffffff', ink: '#0d0d0d', inkMid: '#3a3a3a', inkSoft: '#888888',
      accent: '#1a1a1a', accentInk: '#ffffff', panelBg: '#111111', panelInk: '#ffffff',
      panelInkSoft: '#9a9a9a', panelAccent: '#ffffff', rule: '#e2e2e2', chipBg: '#f1f1f1',
    },
  },
  {
    id: 'wien', name: 'Wien', description: 'Navy, seriös, traditionell', category: 'klassisch',
    layout: 'top-centered', defaultPairing: 'merri-source', photo: 'circle', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: '#1a2233', inkMid: '#46506a', inkSoft: '#8a92a4',
      accent: '#1f3a5f', accentInk: '#ffffff', panelBg: '#f4f6f9', panelInk: '#1a2233',
      panelInkSoft: '#7c8498', panelAccent: '#1f3a5f', rule: '#dde2ea', chipBg: '#e8ecf2',
    },
  },
  {
    id: 'zuerich', name: 'Zürich', description: 'Monochrom, ATS-pur, minimal', category: 'minimal',
    layout: 'single-column', defaultPairing: 'pure-inter', photo: 'none', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: '#1a1a1a', inkMid: '#444444', inkSoft: '#8a8a8a',
      accent: '#2a2a2a', accentInk: '#ffffff', panelBg: '#f6f6f6', panelInk: '#1a1a1a',
      panelInkSoft: '#888888', panelAccent: '#444444', rule: '#e4e4e4', chipBg: '#f0f0f0',
    },
  },
  {
    id: 'terrakotta', name: 'Terrakotta', description: 'Warmes Terracotta, kreativ', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'lora-source', photo: 'rect', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: '#1c1410', inkMid: '#3d342a', inkSoft: '#8a7d70',
      accent: '#9b4f2e', accentInk: '#ffffff', panelBg: '#f5ede4', panelInk: '#2a201a',
      panelInkSoft: '#8a7d70', panelAccent: '#9b4f2e', rule: 'rgba(155,79,46,0.25)', chipBg: '#ece0d3',
    },
  },
  {
    id: 'muenchen', name: 'München', description: 'Dunkle Sidebar, korporat', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'rect', bullet: 'dash', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: '#16181d', inkMid: '#454952', inkSoft: '#8a8e96',
      accent: '#243044', accentInk: '#ffffff', panelBg: '#243044', panelInk: '#f3f4f6',
      panelInkSoft: '#9aa3b2', panelAccent: '#c7a06b', rule: '#e0e2e6', chipBg: '#eef0f3',
    },
  },
  {
    id: 'lissabon', name: 'Lissabon', description: 'Petrol, geometrisch, modern', category: 'modern',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'circle', bullet: 'chevron', heading: 'bar',
    colors: {
      pageBg: '#ffffff', ink: '#13282b', inkMid: '#3c5256', inkSoft: '#7e9094',
      accent: '#0f6e78', accentInk: '#ffffff', panelBg: '#0f6e78', panelInk: '#ffffff',
      panelInkSoft: '#a9d4d8', panelAccent: '#ffffff', rule: '#d8e3e4', chipBg: '#e3eeef',
    },
  },
  {
    id: 'mailand', name: 'Mailand', description: 'Burgunder, editorial, elegant', category: 'kreativ',
    layout: 'sidebar-right', defaultPairing: 'garamond-archivo', photo: 'rect', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: '#241418', inkMid: '#4e3a3e', inkSoft: '#8f7d80',
      accent: '#7a2230', accentInk: '#ffffff', panelBg: '#f6eeef', panelInk: '#2a1a1d',
      panelInkSoft: '#8f7d80', panelAccent: '#7a2230', rule: 'rgba(122,34,48,0.22)', chipBg: '#efe1e2',
    },
  },
  {
    id: 'stockholm', name: 'Stockholm', description: 'Zeitstrahl, leicht, klar', category: 'modern',
    layout: 'timeline', defaultPairing: 'pure-inter', photo: 'circle', bullet: 'dot', heading: 'caps-tracked',
    colors: {
      pageBg: '#ffffff', ink: '#1d2125', inkMid: '#4a5158', inkSoft: '#8b929a',
      accent: '#2f6db0', accentInk: '#ffffff', panelBg: '#f2f5f8', panelInk: '#1d2125',
      panelInkSoft: '#7e868f', panelAccent: '#2f6db0', rule: '#dde3e9', chipBg: '#e6ecf2',
    },
  },
  {
    id: 'bordeaux', name: 'Bordeaux', description: 'Tiefes Weinrot, charaktervoll', category: 'kreativ',
    layout: 'sidebar-left', defaultPairing: 'libre-inter', photo: 'rounded', bullet: 'square', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: '#1e1418', inkMid: '#473a3e', inkSoft: '#8c7f82',
      accent: '#5c1f2e', accentInk: '#ffffff', panelBg: '#5c1f2e', panelInk: '#f6eef0',
      panelInkSoft: '#c9a3ab', panelAccent: '#e3b9a0', rule: '#e6dadb', chipBg: '#f0e6e8',
    },
  },
  {
    id: 'tokio', name: 'Tokio', description: 'Stark Schwarz/Weiß, Display-Serif', category: 'minimal',
    layout: 'single-column', defaultPairing: 'inter-playfair', photo: 'none', bullet: 'dash', heading: 'serif',
    colors: {
      pageBg: '#ffffff', ink: '#0a0a0a', inkMid: '#3c3c3c', inkSoft: '#8c8c8c',
      accent: '#0a0a0a', accentInk: '#ffffff', panelBg: '#f4f4f4', panelInk: '#0a0a0a',
      panelInkSoft: '#8c8c8c', panelAccent: '#0a0a0a', rule: '#e2e2e2', chipBg: '#efefef',
    },
  },
  {
    id: 'amsterdam', name: 'Amsterdam', description: 'Orange-Akzent, frisch, jung', category: 'kreativ',
    layout: 'header-band', defaultPairing: 'space-inter', photo: 'circle', bullet: 'arrow', heading: 'block',
    accentName: true,
    colors: {
      pageBg: '#ffffff', ink: '#1c1a17', inkMid: '#494640', inkSoft: '#8d897f',
      accent: '#e0691f', accentInk: '#ffffff', panelBg: '#fdf2e8', panelInk: '#2a241d',
      panelInkSoft: '#8d897f', panelAccent: '#e0691f', rule: '#ece5da', chipBg: '#f8e8d8',
    },
  },
  {
    id: 'genf', name: 'Genf', description: 'Anthrazit, sachlich, business', category: 'klassisch',
    layout: 'sidebar-left', defaultPairing: 'plex-corporate', photo: 'rect', bullet: 'dash', heading: 'caps-rule',
    colors: {
      pageBg: '#ffffff', ink: '#1f2226', inkMid: '#4a4e54', inkSoft: '#8c9098',
      accent: '#3a3f47', accentInk: '#ffffff', panelBg: '#eef0f2', panelInk: '#22262b',
      panelInkSoft: '#80858d', panelAccent: '#3a3f47', rule: '#e0e2e5', chipBg: '#e7e9ec',
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
