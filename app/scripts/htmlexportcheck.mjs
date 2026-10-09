// Steht die exportierte HTML-Datei für sich?
//
// Seit dem 08.10.2026 bettet der HTML-Export Schriften (base64-@font-face)
// und Foto (data:-URL) ein. Diese Prüfung holt aus dem Prüfstand genau die
// Datei, die der Knopf „HTML" herunterlädt, und prüft:
//
//   1. kein <link>, kein url() und kein src auf einen Server — weder fremd
//      noch der eigene,
//   2. die Schriften der Vorlage sind eingebettet und werden OHNE Netz
//      geladen (alle Anfragen werden im Test abgewiesen und gezählt),
//   3. der OFL-Hinweis liegt bei,
//   4. die Datei bleibt klein genug zum Verschicken (Grenze 900 KB).
//
//   node scripts/htmlexportcheck.mjs                → alle Vorlagen
//   node scripts/htmlexportcheck.mjs hamburg,espoo  → nur diese
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LIMIT = 900 * 1024;
const out = join(process.cwd(), 'tmp-preview', 'htmlexport');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });
const TPLS = process.argv[2]
  ? process.argv[2].split(',')
  : await page.evaluate(async () => (await import('/src/templates/theme.ts')).PICKABLE_THEMES.map(t => t.id));

const bad = [];
let maxBytes = 0;
for (const t of TPLS) {
  await page.goto(`${BASE}/dev-preview.html?tpl=${t}&mode=one&len=normal&p=marketing`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  const html = await page.evaluate(() => window.__standaloneHtml());
  const file = join(out, `${t}.html`);
  writeFileSync(file, html);
  const bytes = Buffer.byteLength(html);
  maxBytes = Math.max(maxBytes, bytes);
  const problems = [];

  // 1. Keine Verweise nach draußen (Hyperlinks im Dokument — mailto, https
  //    zur eigenen Website — sind Inhalt, keine Abrufe, und bleiben erlaubt).
  if (/<link\b/i.test(html)) problems.push('<link> im Kopf');
  const fetches = [...html.matchAll(/url\(\s*['"]?(?!data:)([^'")]+)/g)].map(m => m[1]);
  if (fetches.length) problems.push(`url() ohne data: (${fetches[0]})`);
  const srcs = [...html.matchAll(/\ssrc="(?!data:)([^"]+)"/g)].map(m => m[1]);
  if (srcs.length) problems.push(`src ohne data: (${srcs[0]})`);
  if (/fonts\.googleapis|fonts\.gstatic/.test(html)) problems.push('Google Fonts');
  // 3. Lizenz
  if (!/SIL Open Font License/.test(html)) problems.push('OFL-Hinweis fehlt');
  // 4. Größe
  if (bytes > LIMIT) problems.push(`${Math.round(bytes / 1024)} KB > ${LIMIT / 1024} KB`);

  // 2. Ohne Netz öffnen
  const ctx = await browser.newContext();
  const off = await ctx.newPage();
  let requests = 0;
  await off.route('**/*', route => {
    if (route.request().url().startsWith('file:')) return route.continue();
    requests++;
    return route.abort();
  });
  await off.goto(`file://${file}`, { waitUntil: 'load' });
  const fonts = await off.evaluate(async () => {
    await document.fonts.ready;
    const used = new Set();
    for (const el of document.querySelectorAll('.cv-page *')) {
      const f = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      if (el.textContent.trim()) used.add(f);
    }
    const loaded = new Set([...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/^["']|["']$/g, '')));
    return { used: [...used], missing: [...used].filter(f => !loaded.has(f)) };
  });
  await ctx.close();
  if (requests) problems.push(`${requests} Netzanfrage(n) beim Öffnen`);
  if (fonts.missing.length) problems.push(`Schrift nicht eingebettet: ${fonts.missing.join(', ')}`);

  const ok = problems.length === 0;
  if (!ok) bad.push(`${t}: ${problems.join('; ')}`);
  console.log(`  ${ok ? '✓' : '✗'} ${t.padEnd(11)} ${String(Math.round(bytes / 1024)).padStart(4)} KB · ${fonts.used.join(' + ')}${ok ? '' : '  ' + problems.join('; ')}`);
}
await browser.close();
console.log(`\n${TPLS.length - bad.length}/${TPLS.length} HTML-Dateien eigenständig · größte ${Math.round(maxBytes / 1024)} KB`);
if (bad.length) process.exitCode = 1;
