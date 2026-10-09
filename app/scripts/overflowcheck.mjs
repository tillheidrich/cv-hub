// Prüft, ob Inhalte über den Seitenrand hinauslaufen.
//
// Die Flow-Pagination kümmert sich nur um die Hauptspalte. Die Seitenspalte
// (Kontakt, Sprachen, Skills) steht außerhalb dieses Modells — läuft sie über,
// wird sie im PDF stillschweigend abgeschnitten. Genau das prüft dieses Skript:
// für jede gerenderte Seite wird geschaut, ob ein Textknoten unterhalb der
// Seitenunterkante (bzw. rechts daneben) liegt.
//
//   node scripts/overflowcheck.mjs seoul,berlin one normal tech
//   node scripts/overflowcheck.mjs seoul,berlin one normal tech letter
//
// Fünftes Argument: Papierformate, Standard „a4,letter" (seit 09.10.2026 —
// US Letter ist kürzer als A4, genau dort läuft eine Spalte zuerst über).
import { chromium } from 'playwright';

const [ids, mode = 'one', len = 'normal', persona = 'demo', fmts = 'a4,letter'] = process.argv.slice(2);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });

const list = ids ? ids.split(',') : (() => { throw new Error('Vorlagenliste angeben'); })();
let bad = 0;
for (const fmt of fmts.split(',').filter(Boolean)) {
for (const id of list) {
  await page.goto(`${BASE}/dev-preview.html?tpl=${id}&mode=${mode}&len=${len}&p=${persona}&fmt=${fmt}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  /* Warten, bis die Umbruchsuche fertig ist: der Prüfstand-Kopf zeigt dann
   * „…S · c=…" und ändert sich nicht mehr. Fest 900 ms reichten für A4; auf
   * US Letter braucht die Suche mehr Schritte, und gemessen wurde mitten im
   * Umbau — ein Block der Folgeseite stand noch auf Seite 1 (09.10.2026). */
  let hud = '', stable = 0;
  for (let i = 0; i < 40 && stable < 3; i++) {
    await page.waitForTimeout(150);
    const now = await page.$eval('[data-hud]', el => el.textContent || '').catch(() => '');
    stable = now === hud && /S · c=/.test(now) ? stable + 1 : 0;
    hud = now;
  }
  await page.waitForTimeout(300);
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
  // Gegenprobe: hat der Prüfstand das Format wirklich übernommen? Sonst
  // prüfte die Letter-Runde stillschweigend noch einmal A4.
  const breite = await page.$eval('.cv-scale-wrapper .cv-page', el => Math.round(el.getBoundingClientRect().width));
  const soll = Math.round((fmt === 'letter' || fmt === 'legal' ? 216 : fmt === 'a5' ? 148 : 210) * 96 / 25.4);
  const formatOk = Math.abs(breite - soll) <= 2;
  if (!ok || !formatOk) bad++;
  console.log(`${id.padEnd(12)} ${fmt.padEnd(6)} ${!formatOk ? `✗ Seitenbreite ${breite}px statt ${soll}px` : ok ? '✓' : `✗ ${worst.over}px über den Rand — „${worst.text}"`}`);
}
}
await browser.close();
if (bad) process.exitCode = 1;
