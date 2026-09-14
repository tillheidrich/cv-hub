// Misst die x-Höhe jeder ausgelieferten Schrift im Verhältnis zur Schriftgröße.
//
// Hintergrund: eine Untergrenze in Punkt misst nicht das, was sie messen soll.
// DIN 1450 und leserlich.info (DBSV) definieren Leserlichkeit über die x-Höhe
// in mm, nicht über den Schriftgrad — 10 pt EB Garamond sind sichtbar kleiner
// als 10 pt Inter. Über 25 Vorlagen mit acht Schriftpaarungen ist eine reine
// pt-Grenze deshalb ein Scheinmaß.
//
// Ausgabe: eine Tabelle, die per Hand in templates/theme.ts übernommen wird
// (bewusst kein Codegenerator — die Werte ändern sich nur, wenn eine Schrift
// dazukommt).
//
//   node scripts/measure-xheight.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const FAMILIES = [
  ['Inter', 'inter'],
  ['Source Sans 3', 'source-sans-3'],
  ['Archivo', 'archivo'],
  ['IBM Plex Sans', 'ibm-plex-sans'],
  ['Playfair Display', 'playfair-display'],
  ['Lora', 'lora'],
  ['Merriweather', 'merriweather'],
  ['Space Grotesk', 'space-grotesk'],
  ['EB Garamond', 'eb-garamond'],
  ['IBM Plex Serif', 'ibm-plex-serif'],
  ['Libre Baskerville', 'libre-baskerville'],
];

const faces = FAMILIES.map(([family, pkg]) => {
  const file = join(process.cwd(), 'public', 'fonts', `${pkg}-latin-400-normal.woff2`);
  const b64 = readFileSync(file).toString('base64');
  return `@font-face{font-family:'${family}';font-weight:400;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}).join('\n');

const html = `<!doctype html><meta charset="utf-8"><style>${faces}</style><body></body>`;

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
const rows = await page.evaluate(async (families) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const out = [];
  for (const f of families) {
    // Ohne explizites load() bleibt eine deklarierte, aber ungenutzte
    // @font-face-Regel ungeladen — die Messung liefert dann still die
    // Fallback-Schrift und für alle Familien denselben Wert.
    await document.fonts.load(`400 100px '${f}'`);
    const ok = document.fonts.check(`400 100px '${f}'`);
    ctx.font = `400 100px '${f}'`;
    const m = ctx.measureText('x');
    const cap = ctx.measureText('H');
    out.push({
      family: f,
      loaded: ok,
      xRatio: +(m.actualBoundingBoxAscent / 100).toFixed(3),
      capRatio: +(cap.actualBoundingBoxAscent / 100).toFixed(3),
    });
  }
  return out;
}, FAMILIES.map(f => f[0]));

const ref = rows.find(r => r.family === 'Inter').xRatio;
console.log('Schrift                geladen  x-Höhe   Versal   Faktor gegen Inter');
for (const r of rows) {
  console.log(
    r.family.padEnd(22),
    String(r.loaded).padEnd(8),
    String(r.xRatio).padEnd(8),
    String(r.capRatio).padEnd(8),
    (ref / r.xRatio).toFixed(3),
  );
}
await browser.close();
