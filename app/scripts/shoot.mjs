// Screenshot-Harness für den Umbruch-Prüfstand.
//
//   node scripts/shoot.mjs                     → alle Vorlagen, ein Seitenmodus
//   node scripts/shoot.mjs hamburg,berlin two long
//
// Erwartet einen laufenden Dev-Server (npm run dev) auf Port 5199.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';

const [ids, mode = 'one', len = 'normal', persona = 'demo'] = process.argv.slice(2);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const out = join(process.cwd(), 'tmp-preview');
mkdirSync(out, { recursive: true });

// Der im Image vorinstallierte Chromium hat eine andere Revision als die
// npm-Playwright-Version — deshalb explizit den Pfad setzen statt
// `playwright install` (das im Sandkasten ohnehin scheitert).
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 }, deviceScaleFactor: 2 });

const list = ids
  ? ids.split(',')
  : await (async () => {
      await page.goto(`${BASE}/src/templates/theme.ts`);
      const src = await page.textContent('body');
      return [...src.matchAll(/id: '([a-z]+)', name:/g)].map(m => m[1]);
    })();

for (const id of list) {
  await page.goto(`${BASE}/dev-preview.html?tpl=${id}&mode=${mode}&len=${len}&p=${persona}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const hud = (await page.textContent('[data-hud]')) || '';
  const pages = page.locator('.cv-scale-wrapper .cv-page');
  const n = await pages.count();
  for (let i = 0; i < n; i++) {
    await pages.nth(i).screenshot({ path: join(out, `${persona}-${id}-${mode}-s${i + 1}.png`) });
  }
  console.log(`${id.padEnd(12)} ${String(n).padStart(2)} Seite(n)  ${hud.trim()}`);
}

await browser.close();
