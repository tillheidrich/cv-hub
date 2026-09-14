// Baut `public/fonts.css` + `public/fonts/` aus den @fontsource-Paketen.
//
// Warum: das exportierte HTML (und damit jeder PDF-Render) hat die Schriften
// bisher von fonts.googleapis.com geholt. Das kostet bei JEDEM PDF-Aufbau zwei
// Netzrunden zu Google, macht den Export langsam und widerspricht der Zusage,
// dass keine IP-Adressen an Google gehen. Ab jetzt liegen die Schriften auf
// derselben Domain wie das Tool.
//
// Läuft automatisch vor `vite build` (npm-Skript "prebuild").

import { mkdirSync, copyFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const nm = join(root, 'node_modules', '@fontsource');
const outDir = join(root, 'public', 'fonts');
mkdirSync(outDir, { recursive: true });

/** Familie → CSS-Name + benötigte Schnitte. Muss zu FONT_PAIRINGS passen. */
const FAMILIES = [
  ['inter', 'Inter', [300, 400, 500, 600, 700]],
  ['playfair-display', 'Playfair Display', [400, 500, 600, 700]],
  ['lora', 'Lora', [400, 500, 600, 700]],
  ['source-sans-3', 'Source Sans 3', [400, 500, 600, 700]],
  ['merriweather', 'Merriweather', [400, 700]],
  ['source-serif-4', 'Source Serif 4', [400, 600, 700]],
  ['space-grotesk', 'Space Grotesk', [400, 500, 600, 700]],
  ['eb-garamond', 'EB Garamond', [400, 500, 600]],
  ['archivo', 'Archivo', [400, 500, 600, 700]],
  ['ibm-plex-sans', 'IBM Plex Sans', [400, 500, 600, 700]],
  ['ibm-plex-serif', 'IBM Plex Serif', [400, 500, 600, 700]],
  ['libre-baskerville', 'Libre Baskerville', [400, 700]],
  ['jetbrains-mono', 'JetBrains Mono', [400, 500]],
  ['caveat', 'Caveat', [500]],
];

// Ohne unicode-range würde die zuletzt geladene Subset-Datei die frühere
// verdrängen — latin-ext enthält NICHT den Grundbereich, das Ergebnis wären
// fehlende Standardzeichen. Die Bereiche entsprechen denen von Google Fonts.
const RANGE = {
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
};

const css = [];
let copied = 0;
let missing = [];

for (const [pkg, family, weights] of FAMILIES) {
  const filesDir = join(nm, pkg, 'files');
  if (!existsSync(filesDir)) { missing.push(pkg); continue; }
  const available = readdirSync(filesDir);
  for (const w of weights) {
    // latin reicht für DE/EN/FR/ES; latin-ext fangen wir als Fallback mit.
    for (const subset of ['latin', 'latin-ext']) {
      const name = `${pkg}-${subset}-${w}-normal.woff2`;
      if (!available.includes(name)) continue;
      copyFileSync(join(filesDir, name), join(outDir, name));
      copied++;
      css.push(
        `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};` +
        `font-display:swap;src:url('/fonts/${name}') format('woff2');` +
        `unicode-range:${RANGE[subset]};}`,
      );
    }
  }
}

/* Die SIL Open Font License verlangt, dass ihr Text die Schriftdateien
 * BEGLEITET. Bisher wurden nur die .woff2 kopiert und die LICENSE-Datei blieb
 * in node_modules zurück — im ausgelieferten Build fehlte sie damit. Sie liegt
 * in jedem @fontsource-Paket; sie mitzunehmen kostet nichts. */
let lizenzen = 0;
for (const [pkg] of FAMILIES) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt']) {
    const src = join(nm, pkg, name);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(outDir, `${pkg}.LICENSE.txt`));
    lizenzen++;
    break;
  }
}

writeFileSync(join(root, 'public', 'fonts.css'), css.join('\n') + '\n');
console.log(`fonts: ${copied} Dateien kopiert, ${lizenzen} Lizenztexte, ${css.length} @font-face-Regeln`);
if (missing.length) console.warn(`fonts: Paket(e) nicht gefunden: ${missing.join(', ')}`);
