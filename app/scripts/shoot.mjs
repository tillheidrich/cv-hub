import { chromium } from 'playwright-core';
import { join } from 'path';

const outDir = join(process.cwd(), 'tmp-preview');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`file://${join(outDir, 'cv-vorlagen-vorschau.html')}`);
await page.waitForTimeout(3500); // let webfonts settle
const cards = page.locator('.cv-page');
const n = await cards.count();
for (let i = 0; i < n; i++) {
  await cards.nth(i).screenshot({ path: join(outDir, `tpl-${i}.png`) });
}
console.log('shot', n, 'templates');
await browser.close();
