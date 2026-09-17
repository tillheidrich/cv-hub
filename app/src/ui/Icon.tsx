/**
 * Strichsymbole statt Emoji.
 *
 * Emoji sahen auf dem Telefon aus wie Fremdkörper: sie werden vom
 * Betriebssystem gezeichnet, nicht von uns. Auf iOS bunt und rund, auf Android
 * flach, auf Windows wieder anders — in einer Oberfläche, die sonst aus einer
 * Schrift und zwei Farben besteht, ist das jedes Mal ein Bruch. Und Größe wie
 * Grundlinie sind nicht steuerbar: ein 📄 sitzt in einem 32-px-Feld anders als
 * ein 📦, obwohl beide dieselbe Schriftgröße haben.
 *
 * Diese Symbole sind Inline-SVG: sie erben `currentColor`, skalieren mit der
 * Schriftgröße und sitzen überall gleich. Absichtlich schmucklos — 1,6 px
 * Strichstärke, runde Enden, keine Flächen.
 */
import type { CSSProperties, ReactElement } from 'react';

export type IconName =
  | 'globe' | 'file-text' | 'markdown' | 'braces' | 'puzzle' | 'package'
  | 'upload' | 'download' | 'compass' | 'mail' | 'search' | 'user' | 'image'
  | 'pencil' | 'eye' | 'share' | 'bulb' | 'copy' | 'clipboard' | 'check' | 'crop';

/** Pfade je Symbol, gezeichnet in einem 24er-Raster. */
const PATHS: Record<IconName, ReactElement> = {
  /* Zuschnitt: die beiden Winkel eines Beschnittrahmens, wie sie auf jedem
     Passepartout liegen. Kein Rechteck — das wäre in 11 px ein Kasten und
     nicht mehr zu unterscheiden von „Bild". */
  crop: (
    <>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18Z" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </>
  ),
  markdown: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 15V9l2.5 3L12 9v6M16 9v6M16 15l2-2M16 15l-2-2" />
    </>
  ),
  braces: (
    <path d="M9 4H8a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1M15 4h1a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-1" />
  ),
  puzzle: (
    <path d="M10 4a2 2 0 1 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 1 1 0 4h-1v3a1 1 0 0 1-1 1h-3v-1a2 2 0 1 0-4 0v1H6a1 1 0 0 1-1-1v-3H4a2 2 0 1 1 0-4h1V6a1 1 0 0 1 1-1h4V4Z" />
  ),
  package: (
    <>
      <path d="M21 8.5v7a1 1 0 0 1-.55.9l-8 4a1 1 0 0 1-.9 0l-8-4a1 1 0 0 1-.55-.9v-7" />
      <path d="M3.4 7.6 12 3l8.6 4.6L12 12 3.4 7.6ZM12 12v9.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M8 12l4 4 4-4" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  share: (
    <>
      <path d="M8 13 20 4M20 4h-6M20 4v6" />
      <path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.5 18h5M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3Z" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9V4.5Z" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m4 17 5-4 4 3 3-2 4 3" />
    </>
  ),
};

export function Icon({ name, size = 16, style, title }: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  /** Nur setzen, wenn das Symbol allein steht. Neben einer Beschriftung wäre
   *  es eine zweite Stimme für dieselbe Sache. */
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
