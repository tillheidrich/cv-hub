// Eigene Abschnitte in jeder Vorlage: vollständig, in Reihenfolge, ohne Überlauf.
//
// Testperson `abschnitte` (src/dev/personas.ts) hat alles befüllt: Projekte,
// Zertifikate, Ehrenamt, Publikationen und zwei freie Abschnitte. Für jede
// Vorlage und zwei Fälle — zwei Seiten mit normalem Inhalt, drei Seiten mit
// dreifachen Stichpunkten (die neuen Abschnitte rutschen dann über einen
// echten Seitenumbruch, Auto-Fit verdichtet) — wird geprüft:
//
//   1. Vorschau: kein Textknoten unter oder neben der Blattkante
//      (Muster overflowcheck.mjs), kein „ÜBERLAUF" im Prüfstand.
//   2. PDF aus genau dem HTML, das an den PDF-Dienst geht: Seitenzahl wie in
//      der Vorschau, und jede Angabe der neuen Abschnitte steht in der
//      Textebene — in der richtigen Reihenfolge (pdftotext -raw, also so, wie
//      ein Parser ohne Layoutanalyse liest).
//
//   node scripts/sectionscheck.mjs                 # alle Vorlagen
//   node scripts/sectionscheck.mjs hamburg,bordeaux
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pruefeReihenfolge, ABSCHNITT_TITEL } from './_abschnitte.mjs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
/* „three/long" statt „auto/long": Im Modus „auto" begrenzt die Vorschau auf
 * drei Seiten und meldet einen Rest nicht als Überlauf (DocumentPreview,
 * Zweig `want === null`) — das ist ein eigener Befund und hier nicht Thema.
 * Mit „three" greift der ehrliche Weg: reicht das Ziel nicht, kommt eine
 * Seite dazu, und der Prüfstand sagt es. */
const FAELLE = [
  { mode: 'two', len: 'normal' },
  { mode: 'three', len: 'long' },
];

const out = join(process.cwd(), 'tmp-preview');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
const printer = await browser.newPage();

await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });
const alle = await page.evaluate(async () => (await import('/src/templates/theme.ts')).PICKABLE_THEMES.map(t => t.id));
const ids = process.argv[2] ? process.argv[2].split(',') : alle;

let schlecht = 0;
for (const tpl of ids) {
  for (const { mode, len } of FAELLE) {
    const probleme = [];
    await page.goto(`${BASE}/dev-preview.html?tpl=${tpl}&mode=${mode}&len=${len}&p=abschnitte`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => /\dS ·/.test(document.querySelector('[data-hud]')?.textContent || ''), null, { timeout: 15000 });
    await page.waitForTimeout(600);
    const hud = await page.textContent('[data-hud]');
    /* „ÜBERLAUF" im Prüfstand heißt hier: Seitenziel verfehlt, eine Seite
     * mehr. Das ist erlaubt — abgeschnitten darf nichts sein, und das prüfen
     * die beiden Schritte unten. Gezählt wird es trotzdem. */
    const zielVerfehlt = /ÜBERLAUF/.test(hud);

    // 1. Überlauf in der Vorschau — unten und rechts.
    const ueber = await page.evaluate(() => {
      const r = [];
      document.querySelectorAll('.cv-scale-wrapper .cv-page').forEach((pg, pi) => {
        const pr = pg.getBoundingClientRect();
        const walk = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walk.nextNode())) {
          const t = n.textContent.trim();
          if (!t) continue;
          const rg = document.createRange();
          rg.selectNodeContents(n);
          const b = rg.getBoundingClientRect();
          if (!b.height) continue;
          const unten = b.bottom - pr.bottom;
          const rechts = b.right - pr.right;
          if (unten > 1 || rechts > 1) r.push(`Seite ${pi + 1}: „${t.slice(0, 30)}" ${unten > 1 ? `${Math.round(unten)} px unter` : `${Math.round(rechts)} px neben`} der Kante`);
        }
      });
      return r;
    });
    probleme.push(...ueber.slice(0, 3));
    const vorschauSeiten = await page.$$eval('.cv-scale-wrapper .cv-page', e => e.length);

    // 2. PDF aus dem Export-HTML.
    const html = await page.evaluate(() => window.__exportHtml());
    const htmlPath = join(out, `abschnitte-${tpl}-${mode}-${len}.html`);
    writeFileSync(htmlPath, html);
    await printer.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await printer.evaluate(() => document.fonts.ready);
    await printer.waitForTimeout(300);
    const pdfPath = htmlPath.replace(/\.html$/, '.pdf');
    await printer.pdf({ path: pdfPath, printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    const roh = execFileSync('pdftotext', ['-raw', pdfPath, '-'], { encoding: 'utf8' });
    const pdfSeiten = (roh.match(/\f/g) || []).length;
    if (pdfSeiten !== vorschauSeiten) probleme.push(`Seitenzahl: Vorschau ${vorschauSeiten}, PDF ${pdfSeiten}`);
    const { fehlt, falsch } = pruefeReihenfolge(roh);
    if (fehlt.length) probleme.push(`fehlt im PDF-Text: ${fehlt.slice(0, 4).map(m => `„${m}"`).join(', ')}${fehlt.length > 4 ? ` (+${fehlt.length - 4})` : ''}`);
    if (falsch.length) probleme.push(`falsche Reihenfolge: ${falsch.slice(0, 4).map(m => `„${m}"`).join(', ')}`);
    const titel = pruefeReihenfolge(roh, ABSCHNITT_TITEL);
    if (titel.fehlt.length || titel.falsch.length) probleme.push(`Überschriften: ${[...titel.fehlt, ...titel.falsch].join(', ')}`);

    const ok = !probleme.length;
    if (!ok) schlecht++;
    console.log(`${tpl.padEnd(12)} ${`${mode}/${len}`.padEnd(12)} ${vorschauSeiten} S.${zielVerfehlt ? ' (Seitenziel verfehlt)' : ''} ${ok ? '✓' : '✗'}`);
    for (const p of probleme) console.log(`   ! ${p}`);
  }
}
await browser.close();
console.log(`\n${ids.length * FAELLE.length - schlecht}/${ids.length * FAELLE.length} Fälle ohne Befund.`);
if (schlecht) process.exitCode = 1;
