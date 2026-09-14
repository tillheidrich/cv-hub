// Kontrast aller Vorlagen × aller Akzentfarben × aller Papierfarben.
//
// Die Akzentfarbe ist frei wählbar — damit ist jede Kombination aus Vorlage
// und Farbe ein eigenes Gestaltungsergebnis, und jedes davon muss lesbar sein.
// Seit dem 14.09. ist auch das Papier wählbar — damit multipliziert sich die
// Zahl der Fälle noch einmal. Von Hand ist das nicht zu überblicken, deshalb rechnet
// es dieses Skript: Akzent auf Papier, Akzent auf der Farbfläche, und weiße
// Schrift auf der Akzentfläche.
//
// Gemessen wird im Browser, weil die Themes teils in OKLCH notiert sind — die
// Leinwand rechnet jede Farbe, die der Browser versteht, in sRGB um.
//
//   node scripts/contrastcheck.mjs
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });

const rows = await page.evaluate(async () => {
  const m = await import('/src/templates/theme.ts');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgb = (c) => { ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const lum = (c) => { const [r, g, b] = rgb(c).map(v => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); const hi = Math.max(la, lb), lo = Math.min(la, lb); return (hi + 0.05) / (lo + 0.05); };
  const out = [];
  for (const t of m.PICKABLE_THEMES) {
    for (const a of m.ACCENTS) {
    for (const pp of m.PAPERS) {
      const th = m.applyPaper(m.applyAccent(t, a.id), pp.id);
      const c = th.colors;
      out.push({
        theme: t.id, accent: a.id, papier: pp.id,
        aufPapier: +ratio(c.accent, c.pageBg).toFixed(2),
        aufFlaeche: +ratio(c.panelAccent, c.panelBg).toFixed(2),
        weissDarauf: +ratio(c.accentInk, c.accent).toFixed(2),
        textAufFlaeche: +ratio(c.panelInk, c.panelBg).toFixed(2),
        weichAufFlaeche: +ratio(c.panelInkSoft, c.panelBg).toFixed(2),
        fliesstext: +ratio(c.inkMid, c.pageBg).toFixed(2),
        leise: +ratio(c.inkSoft, c.pageBg).toFixed(2),
      });
    }
    }
  }
  return out;
});
await browser.close();

// 4.5:1 für normalen Text, 3:1 für große/fette Beschriftung. Die Akzentfarbe
// trägt hier Fließtextgrößen (Firmenname, Label), deshalb 4.5.
const LIMIT = { aufPapier: 4.5, aufFlaeche: 4.5, weissDarauf: 4.5, textAufFlaeche: 4.5, weichAufFlaeche: 4.5, fliesstext: 4.5, leise: 4.5 };
const bad = [];
for (const r of rows) {
  for (const [k, min] of Object.entries(LIMIT)) {
    if (r[k] < min) bad.push(`${r.theme}/${r.accent}/${r.papier}: ${k} ${r[k]}:1 (< ${min})`);
  }
}
console.log(`${rows.length} Kombinationen geprüft — ${bad.length ? bad.length + ' unter der Grenze' : 'alle über 4,5:1 ✓'}`);
bad.slice(0, 25).forEach(b => console.log('   ! ' + b));
if (bad.length > 25) console.log(`   … und ${bad.length - 25} weitere`);
bad.slice(0, 40).forEach(b => console.log('   ! ' + b));
if (bad.length) process.exitCode = 1;
