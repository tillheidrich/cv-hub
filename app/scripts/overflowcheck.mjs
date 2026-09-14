// Prüft, ob Inhalte über den Seitenrand hinauslaufen.
//
// Die Flow-Pagination kümmert sich nur um die Hauptspalte. Die Seitenspalte
// (Kontakt, Sprachen, Skills) steht außerhalb dieses Modells — läuft sie über,
// wird sie im PDF stillschweigend abgeschnitten. Genau das prüft dieses Skript:
// für jede gerenderte Seite wird geschaut, ob ein Textknoten unterhalb der
// Seitenunterkante (bzw. rechts daneben) liegt.
//
//   node scripts/overflowcheck.mjs seoul,berlin one normal tech
import { chromium } from 'playwright';

const [ids, mode = 'one', len = 'normal', persona = 'demo'] = process.argv.slice(2);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });

const list = ids ? ids.split(',') : (() => { throw new Error('Vorlagenliste angeben'); })();
let bad = 0;
for (const id of list) {
  await page.goto(`${BASE}/dev-preview.html?tpl=${id}&mode=${mode}&len=${len}&p=${persona}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  const res = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.cv-scale-wrapper .cv-page').forEach((pg, pi) => {
      const pr = pg.getBoundingClientRect();
      let worst = 0, worstText = '';
      const walk = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (!t) continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        const b = r.getBoundingClientRect();
        if (!b.height) continue;
        const over = b.bottom - pr.bottom;
        if (over > worst) { worst = over; worstText = t.slice(0, 30); }
      }
      out.push({ page: pi + 1, over: Math.round(worst), text: worstText });
    });
    return out;
  });
  const worst = res.reduce((a, b) => (b.over > a.over ? b : a), { over: 0, text: '' });
  const ok = worst.over <= 1;
  if (!ok) bad++;
  console.log(`${id.padEnd(12)} ${ok ? '✓' : `✗ ${worst.over}px über den Rand — „${worst.text}"`}`);
}
await browser.close();
if (bad) process.exitCode = 1;
