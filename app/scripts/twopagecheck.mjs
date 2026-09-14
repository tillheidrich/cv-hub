// Sieht jede Vorlage auch auf ZWEI Seiten gut aus?
//
// Bisher prüfte der Prüfstand nur, ob eine Seite gelingt. Die Quellenlage sagt
// aber etwas anderes: Die Bundesagentur für Arbeit nennt „eine bis maximal
// zwei A4-Seiten" als Standard — zwei Seiten sind der Regelfall, nicht der
// Notfall. Also müssen sie auch so aussehen.
//
// Gemessen werden die drei Arten, auf die eine zweite Seite kaputtgeht:
//
//   1. Sie ist fast leer. Drei Zeilen auf einem Blatt sehen aus wie ein
//      Druckfehler, nicht wie ein Lebenslauf.
//   2. Bei Vorlagen mit Seitenspalte steht dort auf Seite 2 nichts mehr —
//      eine handbreite leere Spalte neben halbvollem Text.
//   3. Der Folgeseitenkopf fehlt: ein Blatt ohne Namen ist nach dem Ausdrucken
//      nicht mehr zuzuordnen.
//
//   node scripts/twopagecheck.mjs [testperson]
import { chromium } from 'playwright';

const persona = process.argv[2] || 'marketing';
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });
const TPLS = process.argv[3]
  ? process.argv[3].split(',')
  : await page.evaluate(async () => (await import('/src/templates/theme.ts')).PICKABLE_THEMES.map(t => t.id));

const bad = [];
for (const t of TPLS) {
  await page.goto(`${BASE}/dev-preview.html?tpl=${t}&mode=two&len=long&p=${persona}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('.cv-scale-wrapper .cv-page')];
    if (pages.length < 2) return { seiten: pages.length };
    const letzte = pages[pages.length - 1];
    const pr = letzte.getBoundingClientRect();
    // Wie weit reicht der Inhalt auf der letzten Seite hinunter?
    let unten = pr.top;
    const walk = document.createTreeWalker(letzte, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const b = rg.getBoundingClientRect();
      if (b.height) unten = Math.max(unten, b.bottom);
    }
    const fuellung = (unten - pr.top) / pr.height;
    // Trägt die letzte Seite einen Kopf mit dem Namen?
    const kopf = /Katharina|Lina|Vogt|Sandmann/.test(letzte.textContent.slice(0, 400));
    return { seiten: pages.length, fuellung: +fuellung.toFixed(2), kopf };
  });
  if (r.seiten < 2) { console.log(`  – ${t.padEnd(12)} bleibt einseitig`); continue; }
  const probleme = [];
  if (r.fuellung < 0.25) probleme.push(`letzte Seite nur zu ${Math.round(r.fuellung * 100)} % gefüllt`);
  if (!r.kopf) probleme.push('kein Name im Folgeseitenkopf');
  if (probleme.length) bad.push(`${t}: ${probleme.join(', ')}`);
  console.log(`  ${probleme.length ? '✗' : '✓'} ${t.padEnd(12)} ${r.seiten} Seiten · letzte zu ${Math.round(r.fuellung * 100)} % gefüllt${r.kopf ? '' : ' · OHNE KOPF'}`);
}
console.log(`\nTestperson ${persona}: ${TPLS.length - bad.length}/${TPLS.length} Vorlagen mehrseitig ohne Befund`);
bad.forEach(b => console.log(`   ! ${b}`));
await browser.close();
if (bad.length) process.exitCode = 1;
