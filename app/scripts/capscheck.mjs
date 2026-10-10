// Versalien in der PDF-Textebene: kommen Überschriften als ganze Wörter heraus?
//
// Befund vom 10.10.2026: pdftotext (Layoutmodus, ohne -raw) las aus dem PDF
// des Dienstes „SE NIOR PRODUCT DE SIGNE R", „BE RUFSPROFIL", „E CK DATE N".
// Ursache: Chromium ab m148 (Playwright 1.60, das Image des PDF-Dienstes)
// rundet im Druck den Vorschub jedes Zeichens auf ganze CSS-Pixel, schreibt in
// die Textebene aber die ungerundeten Breiten. Der Rest (bis 0,5 px) kommt zur
// Sperrung (0,08 em) dazu, und Poppler trennt ab 0,1 em Abstand ein Wort.
// Behoben mit `text-rendering: geometricPrecision` auf .cv-page im Export-HTML
// (nicht in der Vorschau, siehe export/exportHtml.ts) und Sperrung 0 in der
// ATS-Fassung (ResumeRenderer `flatCaps`).
//
// Geprüft wird über den echten Druckweg: das HTML, das die App an /api/pdf
// schickt (Prüfstand dev-preview.html → __exportHtml, dieselbe Funktion wie
// exportPdf), gedruckt mit dem Renderer des Dienstes (pdf-service/pdf.js,
// createRenderer: Kontext ohne JavaScript, print-Medien, tagged PDF). Für jede
// der 40 Vorlagen, dazu die ATS-Fassung (Schiefer und Zürich mit flat=1) und
// einmal die Demo aus der App selbst (Klick auf „PDF" und „PDF – ATS-Fassung").
//
// Erwartet wird: jedes Wort, das in der Vorschau in Versalien gesetzt ist
// (text-transform: uppercase), steht in pdftotext (Standard und -layout) als
// ganzes Wort. Gegenprobe: dieselbe Demo ohne die Regel. Mit Chromium ab m148
// muss sie die Bruchstücke zeigen, sonst prüft der Lauf nichts.
//
//   HARNESS_BASE=http://localhost:5342 CAPS_CHROMIUM=/pfad/zu/chrome-headless-shell node scripts/capscheck.mjs [vorlage …]
//
// CAPS_CHROMIUM: der Chromium des PDF-Dienstes (Playwright 1.60 → m148). Ohne
// ihn nimmt der Lauf PDF_CHROMIUM_PATH bzw. Playwrights eigenen; dann sagt er,
// welche Version er geprüft hat (pdfinfo „Producer").
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRenderer } from '../../pdf-service/pdf.js';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const VIEW = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PRINT = process.env.CAPS_CHROMIUM || process.env.PDF_CHROMIUM_PATH || undefined;
const only = process.argv.slice(2);
const out = join(tmpdir(), 'cv-capscheck');
mkdirSync(out, { recursive: true });

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };

const base = new URL(BASE);
const renderer = createRenderer({
  hosts: [base.hostname],
  executablePath: PRINT,
  isAllowed: u => u.startsWith('data:') || u.startsWith('about:') || u.startsWith(`${base.origin}/`),
});
const browser = await chromium.launch({ executablePath: VIEW });

/** Wörter aus Elementen mit text-transform: uppercase, so wie sie gesetzt sind. */
async function capsWords(page) {
  return page.evaluate(() => {
    const words = new Set();
    for (const pg of document.querySelectorAll('.cv-scale-wrapper .cv-page')) {
      for (const el of pg.querySelectorAll('*')) {
        if (getComputedStyle(el).textTransform !== 'uppercase') continue;
        // Nur der eigene Text, Kinder mit eigener Regel zählen für sich.
        const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ');
        for (const w of own.toLocaleUpperCase('de-DE').match(/\p{L}{3,}/gu) || []) words.add(w);
      }
    }
    return [...words];
  });
}

/** Größte Sperrung (em) an Elementen in Versalien, im HTML wie gedruckt. */
async function capsTracking(html) {
  const p = await browser.newPage();
  await p.setContent(html, { waitUntil: 'load' });
  const max = await p.evaluate(() => {
    let m = 0;
    for (const el of document.querySelectorAll('.cv-page *')) {
      const cs = getComputedStyle(el);
      if (cs.textTransform !== 'uppercase' || !el.textContent.trim()) continue;
      const ls = parseFloat(cs.letterSpacing) || 0;
      m = Math.max(m, ls / (parseFloat(cs.fontSize) || 1));
    }
    return m;
  });
  await p.close();
  return max;
}

async function pdfOf(html, tag) {
  const buf = await renderer.render(html, { format: 'A4' });
  const pdf = join(out, `${tag}.pdf`);
  writeFileSync(pdf, buf);
  return pdf;
}
const textOf = (pdf, layout) => execFileSync('pdftotext', [...(layout ? ['-layout'] : []), pdf, '-'], { encoding: 'utf8' });
/** Fehlende ganze Wörter (Wortgrenze = kein Buchstabe davor und danach). */
function missing(words, text) {
  return words.filter(w => !new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, 'u').test(text));
}
/** Zerlegte Wörter: das Wort steht nirgends am Stück. Für den Standardmodus,
 *  der bei zwei Spalten auf derselben Zeile ein Trennstrich-Ende der einen
 *  Spalte an das nächste Wort der anderen hängt („Mid-" + „GEBURTSDATUM").
 *  Das ist Spalten-Lesereihenfolge, kein Zerfall des Worts. */
function broken(words, text) {
  return words.filter(w => !text.includes(w));
}

async function checkHtml(tag, html, words) {
  const pdf = await pdfOf(html, tag);
  const miss = [...new Set([...broken(words, textOf(pdf, false)), ...missing(words, textOf(pdf, true))])];
  check(miss.length === 0, `${tag}: ${words.length} Versalwörter als ganze Wörter`, miss.slice(0, 6).join(', '));
  return pdf;
}

async function preview(query) {
  const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
  await page.goto(`${BASE}/dev-preview.html?${query}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const html = await page.evaluate(() => window.__exportHtml());
  const words = await capsWords(page);
  await page.close();
  return { html, words };
}

// Vorlagenliste aus der App (dieselbe wie in der Auswahl).
const lp = await browser.newPage();
await lp.goto(`${BASE}/dev-preview.html?tpl=espoo`, { waitUntil: 'networkidle' });
const ids = await lp.evaluate(async () => (await import('/src/templates/theme.ts')).PICKABLE_THEMES.map(t => t.id));
await lp.close();
check(ids.length === 40, 'Vorlagenliste gelesen', `${ids.length} Vorlagen`);

// Gegenprobe zuerst: die Demo ohne die Regel.
{
  const { html, words } = await preview('tpl=espoo&p=demo');
  const raw = html.replace(/\.cv-page \{ text-rendering: geometricPrecision; \}/g, '');
  check(raw !== html, 'Export-HTML enthält text-rendering: geometricPrecision');
  const pdf = await pdfOf(raw, 'gegenprobe-espoo');
  const producer = (execFileSync('pdfinfo', [pdf], { encoding: 'utf8' }).match(/Producer:\s*(.+)/) || [])[1] || '?';
  const m = Number((producer.match(/m(\d+)/) || [])[1] || 0);
  const miss = broken(words, textOf(pdf, false));
  console.log(`  Druck-Chromium: ${producer.trim()}`);
  if (m >= 148) check(miss.length > 0, 'Gegenprobe ohne Regel zeigt die Bruchstücke (Prüfung greift)', miss.slice(0, 4).join(', '));
  else console.log(`  Gegenprobe: Chromium m${m} rundet nicht, Bruchstücke ohne Regel: ${miss.length} (Befund erst ab m148; CAPS_CHROMIUM setzen)`);
}

for (const id of (only.length ? only : ids)) {
  const { html, words } = await preview(`tpl=${id}&p=demo`);
  await checkHtml(id, html, words);
}

// ATS-Fassung: Schiefer (mit Foto) und Zürich (ohne), Sperrung 0.
for (const id of ['schiefer', 'zuerich']) {
  const { html, words } = await preview(`tpl=${id}&p=demo&flat=1`);
  const tr = await capsTracking(html);
  check(tr === 0, `ATS ${id}: Versalzeilen ohne Sperrung`, `${tr.toFixed(3)} em`);
  await checkHtml(`ats-${id}`, html, words);
}

// Die Demo aus der App: „PDF" und „PDF – ATS-Fassung" (Anfrage abgefangen).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const reqs = [];
  await page.route('**/api/pdf', async r => { reqs.push(JSON.parse(r.request().postData() || '{}')); await r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }); });
  await page.route('**/api/billing/offer', r => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { localStorage.clear(); await new Promise(res => { const r = indexedDB.deleteDatabase('heidrich-cv-local'); r.onsuccess = r.onerror = r.onblocked = () => res(); }); });
  await page.goto(`${BASE}/?demo=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const words = await capsWords(page);
  await page.locator('.ui-split button').first().click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'Weitere Formate', exact: true }).first().click();
  await page.locator('.ui-menu-item', { hasText: 'PDF – ATS-Fassung' }).first().click();
  await page.waitForTimeout(5000);
  check(reqs.length === 2, 'App: PDF und ATS-PDF angefordert', String(reqs.length));
  if (reqs[0]) await checkHtml('app-demo', reqs[0].html, words);
  if (reqs[1]) {
    check(reqs[1].meta?.variant === 'ats', 'App: zweite Anfrage ist die ATS-Fassung');
    const tr = await capsTracking(reqs[1].html);
    check(tr === 0, 'App: ATS-Fassung, Versalzeilen ohne Sperrung', `${tr.toFixed(3)} em`);
    const tr0 = await capsTracking(reqs[0].html);
    check(Math.abs(tr0 - 0.08) < 0.005, 'App: gestaltete Fassung behält ihre Sperrung (0,08 em)', `${tr0.toFixed(3)} em`);
    // In der ATS-Fassung stehen dieselben Überschriften (Schiefer setzt sie in Versalien).
    await checkHtml('app-demo-ats', reqs[1].html, words.filter(w => reqs[1].html.toLocaleUpperCase('de-DE').includes(w)));
  }
  await ctx.close();
}

await browser.close();
await renderer.close();
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} Prüfungen bestanden (PDFs in ${out})`);
process.exit(ok === results.length ? 0 : 1);
