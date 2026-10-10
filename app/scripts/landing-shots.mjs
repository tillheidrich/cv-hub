// Echte Bildschirmfotos der App für die Startseite und das Magazin.
//
//   cd app && npx vite --port 5261 &            (Entwicklungsserver, Demo-Modus)
//   LANDING_BASE=http://127.0.0.1:5261 node scripts/landing-shots.mjs
//
// Was entsteht (alles unter public/landing/, Namen ohne Hash, die Version
// hängt als ?v=<hash> an der Adresse, siehe src/landing/shots.gen.ts):
//   hero-a|b|c-<lang>   Editor am Schreibtisch (1440×900, 2x) mit drei
//                       Vorlagen, für die Hero-Animation „Vorlage wechseln"
//   editor-<lang>       Inhalt-Paneel      check-<lang>   Prüfen-Paneel
//   export-<lang>       Export-Menü offen  phone-<lang>   Telefon (390×844, 2x)
//   thumb-<lang>-<id>   Miniatur jeder wählbaren Vorlage (Demo-Lebenslauf),
//                       nur AVIF/WebP (Rückfall ist die kleine WebP-Datei)
//   ../og[-<lang>].png  Vorschaubild 1200×630 für geteilte Links
// Dazu src/landing/textlayer.gen.ts: die echte Textebene des Demo-PDFs
// (Vorlage mit Seitenspalte), gedruckt wie im PDF-Dienst und mit pdftotext
// ausgelesen, für den Abschnitt „So liest ein ATS".
//
// Formate: AVIF und WebP in zwei Breiten (srcset), PNG als Rückfall in der
// kleineren Breite, auf 256 Farben verdichtet (Miniaturen ohne PNG). Kodiert wird mit Python/Pillow
// (python3 -m pip install pillow; Pillow ab 11 kann AVIF), Textebene mit
// pdftotext (Poppler). Beides steht in der README des App-Ordners.
//
// Neu fotografieren, wenn sich Oberfläche, Demo-Person oder Vorlagen ändern:
// Vite starten, dieses Skript laufen lassen, Ergebnis ansehen
// (public/landing/), committen. Optionen:
//   LANDING_LANGS=de,en         nur diese Sprachen
//   LANDING_ONLY=thumbs|ui|text|og   nur ein Teil
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, unlinkSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.LANDING_BASE || 'http://127.0.0.1:5261').replace(/\/+$/, '');
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = join(APP, 'public', 'landing');
const RAW = join(tmpdir(), `landing-shots-${process.pid}`);
const LANGS = (process.env.LANDING_LANGS || 'de,en,fr,es').split(',').map(s => s.trim()).filter(Boolean);
const ONLY = process.env.LANDING_ONLY || '';
/** Miniaturen nur auf Deutsch und Englisch: FR und ES zeigen die englischen
 *  (die Demo-Inhalte gibt es nur in diesen beiden Sprachen). */
const THUMB_LANGS = LANGS.filter(l => l === 'de' || l === 'en');
const PERSONA = { de: 'demo', en: 'demo-en', fr: 'demo-fr', es: 'demo-es' };
/** Ausschnitte (in Bildpunkten des 2x-Fotos 2880×1800): Paneel und Seite
 *  links, Seite und Export-Menü rechts. So bleibt die Schrift lesbar. */
const CROP_LEFT = [0, 0, 2280, 1800];
const CROP_RIGHT = [1000, 0, 2880, 1800];
const DEMO_BTN = /Direkt ausprobieren|Try the demo|Essayer maintenant|Probar ahora/;

mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });
const log = (...a) => console.log('[landing:shots]', ...a);

/** goto mit Wiederholung: Der Entwicklungsserver lädt Seiten neu, wenn sich
 *  während des Laufs Dateien ändern (paralleles Arbeiten). */
async function gehe(page, url) {
  for (let i = 0; ; i++) {
    try { await page.goto(url, { waitUntil: 'networkidle' }); return; }
    catch (e) { if (i >= 3) throw e; await page.waitForTimeout(1500); }
  }
}

/** Bestehendes Manifest laden, damit ein Teil-Lauf den Rest behält. */
const MANIFEST = join(OUT, 'manifest.json');
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { images: {}, textlayer: {}, templates: [] };
manifest.images ||= {}; manifest.textlayer ||= {};

/** PNG → AVIF/WebP in Breiten + PNG-Rückfall, über Pillow. */
function encode(key, src, { widths, png = true, crop = null }) {
  const py = `
import sys, json
from PIL import Image
src, out, key, widths, png, crop = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4]), sys.argv[5] == '1', json.loads(sys.argv[6])
im = Image.open(src).convert('RGB')
if crop: im = im.crop(tuple(crop))
W, H = im.size
res = {'w': W, 'h': H, 'avif': [], 'webp': [], 'png': None}
for w in widths:
    w = min(w, W)
    h = round(H * w / W)
    r = im.resize((w, h), Image.LANCZOS) if w != W else im
    a = f'{key}-{w}.avif'; r.save(f'{out}/{a}', 'AVIF', quality=58, speed=4); res['avif'].append([a, w])
    b = f'{key}-{w}.webp'; r.save(f'{out}/{b}', 'WEBP', quality=80, method=6); res['webp'].append([b, w])
if png:
    w = min(widths[0], W); h = round(H * w / W)
    r = im.resize((w, h), Image.LANCZOS)
    p = f'{key}-{w}.png'; r.quantize(colors=256).save(f'{out}/{p}', 'PNG', optimize=True); res['png'] = [p, w]
print(json.dumps(res))
`;
  const r = spawnSync('python3', ['-I', '-c', py, src, OUT, key, JSON.stringify(widths), png ? '1' : '0', JSON.stringify(crop)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`Pillow: ${r.stderr}`);
  const res = JSON.parse(r.stdout);
  const h = createHash('sha256');
  for (const [f] of [...res.avif, ...res.webp, ...(res.png ? [res.png] : [])]) h.update(readFileSync(join(OUT, f)));
  res.v = h.digest('hex').slice(0, 10);
  manifest.images[key] = res;
  return res;
}

async function startDemo(page) {
  await gehe(page, `${BASE}/demo`);
  try { await page.waitForSelector('.ui-rail, .ui-bottom-bar', { timeout: 8000 }); }
  catch {
    // Älterer Stand ohne /demo: über die Startseite.
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: DEMO_BTN }).first().click();
    await page.waitForSelector('.ui-rail, .ui-bottom-bar', { timeout: 15000 });
  }
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.fonts.ready);
}

/** Die Erinnerung „Sicherung herunterladen" (Lokalmodus) mit „Später"
 *  wegklicken: echtes Verhalten, sie käme sonst ins Bild. */
async function snooze(page) {
  const b = page.getByRole('button', { name: /^(Später|Later|Plus tard|Más tarde)$/ });
  if (await b.count() && await b.first().isVisible().catch(() => false)) { await b.first().click(); await page.waitForTimeout(400); }
}

async function pickTemplate(page, name) {
  const card = page.locator('.ui-card').filter({ has: page.locator('.ui-card-name', { hasText: new RegExp(`^${name}$`) }) }).first();
  if (!(await card.count())) { log(`Vorlage „${name}" nicht im Paneel gefunden`); return false; }
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await page.waitForTimeout(1400);
  await snooze(page);
  await page.evaluate(() => document.querySelector('.ui-panel-body')?.scrollTo({ top: 0 }));
  await page.waitForTimeout(300);
  return true;
}

async function rail(page, i) {
  await page.locator('.ui-rail > button').nth(i).click();
  await page.waitForTimeout(1000);
  await snooze(page);
}

async function shotsUi(browser, lang, themes) {
  const nameOf = id => (themes.find(t => t.id === id) || {}).name || id;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: lang });
  await ctx.addInitScript(l => { try { localStorage.setItem('appstudio-ui-lang', l); } catch { /* */ } }, lang);
  const page = await ctx.newPage();
  await startDemo(page);
  if (!(await page.locator('.ui-card').count())) await rail(page, 1);
  // Die Hinweis-Pille „Text direkt auf der Seite anklicken" bleibt sichtbar:
  // Sie zeigt genau die Funktion, um die es auf der Startseite geht.
  const frames = [['hero-a', 'espoo'], ['hero-b', 'hamburg'], ['hero-c', 'berlin']];
  for (const [k, id] of frames) {
    await pickTemplate(page, nameOf(id));
    const f = join(RAW, `${k}-${lang}.png`);
    await page.screenshot({ path: f });
    encode(`${k}-${lang}`, f, { widths: [960, 1600], png: k === 'hero-a' });
    // Für den Abschnitt „Gestalten": dasselbe Foto, auf Paneel und Seite zugeschnitten.
    if (k === 'hero-b') encode(`design-${lang}`, f, { widths: [960, 1440], crop: CROP_LEFT });
  }
  // Inhalt-Paneel mit Espoo
  await pickTemplate(page, nameOf('espoo'));
  await rail(page, 0);
  let f = join(RAW, `editor-${lang}.png`);
  await page.screenshot({ path: f });
  encode(`editor-${lang}`, f, { widths: [960, 1440], crop: CROP_LEFT });
  // Prüfen und Export mit einer Seitenspalten-Vorlage
  await rail(page, 1);
  await pickTemplate(page, nameOf('hamburg'));
  await rail(page, 2);
  f = join(RAW, `check-${lang}.png`);
  await page.screenshot({ path: f });
  encode(`check-${lang}`, f, { widths: [960, 1440], crop: CROP_LEFT });
  await snooze(page);
  await page.locator('header button[aria-haspopup="menu"]').first().click();
  await page.waitForTimeout(700);
  f = join(RAW, `export-${lang}.png`);
  await page.screenshot({ path: f });
  encode(`export-${lang}`, f, { widths: [960, 1440], crop: CROP_RIGHT });
  await page.keyboard.press('Escape');
  await ctx.close();

  // Telefon
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: lang });
  await mctx.addInitScript(l => { try { localStorage.setItem('appstudio-ui-lang', l); } catch { /* */ } }, lang);
  const m = await mctx.newPage();
  await startDemo(m);
  f = join(RAW, `phone-${lang}.png`);
  await m.screenshot({ path: f });
  encode(`phone-${lang}`, f, { widths: [390, 780] });
  await mctx.close();
  log(`${lang}: Oberfläche fotografiert`);
}

async function shotsThumbs(browser, lang, themes) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1300 }, deviceScaleFactor: 1, locale: lang });
  const page = await ctx.newPage();
  for (const t of themes) {
    await gehe(page, `${BASE}/dev-preview.html?tpl=${t.id}&mode=auto&p=${PERSONA[lang]}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const el = page.locator('.cv-scale-wrapper .cv-page').first();
    const f = join(RAW, `thumb-${lang}-${t.id}.png`);
    await el.screenshot({ path: f });
    // Ohne PNG: Die Galerie fällt auf die kleine WebP-Datei zurück (die
    // Miniaturen sind 2 × 40 Bilder, ein PNG je Vorlage wären 2 MB mehr).
    encode(`thumb-${lang}-${t.id}`, f, { widths: [300, 440], png: false });
  }
  await ctx.close();
  log(`${lang}: ${themes.length} Miniaturen`);
}

/** Textebene: wie pdfcheck.mjs — Export-HTML drucken (Chromium, wie der
 *  PDF-Dienst) und die erste Seite zweimal auslesen:
 *    raw    pdftotext -raw: die Reihenfolge, in der der Text im PDF steht
 *           (so lesen Parser ohne eigene Layoutanalyse),
 *    layout pdftotext ohne Schalter: Poppler setzt die Lesereihenfolge aus
 *           der Lage auf der Seite zusammen (so arbeiten Parser mit
 *           Layoutanalyse). Bei zwei Spalten zeigt das, warum es die
 *           ATS-Fassung gibt.
 *  Zeilen aus der Seitenspalte werden markiert (Text der Spalte aus dem DOM). */
async function textLayer(browser, lang, themes) {
  const id = 'hamburg';
  const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
  await gehe(page, `${BASE}/dev-preview.html?tpl=${id}&mode=one&p=${PERSONA[lang]}`);
  await page.waitForTimeout(1200);
  const html = await page.evaluate(() => window.__exportHtml());
  const htmlPath = join(RAW, `tl-${lang}.html`);
  writeFileSync(htmlPath, html);
  const printer = await browser.newPage();
  await printer.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await printer.evaluate(() => document.fonts.ready);
  await printer.waitForTimeout(600);
  // Seitenspalte = letzte Zelle im Raster der ersten Seite (ResumeRenderer:
  // Hauptspalte vor der Spalte im DOM, damit der Textstrom stimmt).
  const side = await printer.evaluate(() => {
    const grid = document.querySelector('.cv-page')?.firstElementChild;
    const cell = grid && grid.children.length > 1 ? grid.lastElementChild : null;
    return cell ? cell.innerText : '';
  });
  const pdf = join(RAW, `tl-${lang}.pdf`);
  await printer.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.close(); await printer.close();
  const norm = t => t.replace(/\s+/g, ' ').trim().toLowerCase();
  const sideNorm = norm(side);
  const lies = args => execFileSync('pdftotext', [...args, '-f', '1', '-l', '1', pdf, '-'], { encoding: 'utf8' })
    .split('\n').map(z => z.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 16)
    .map(t => ({ t, side: t.length > 2 && sideNorm.includes(norm(t)) }));
  const version = (spawnSync('pdftotext', ['-v'], { encoding: 'utf8' }).stderr || '').split('\n')[0].trim();
  manifest.textlayer[lang] = { template: id, name: (themes.find(t => t.id === id) || {}).name || id, raw: lies(['-raw']), layout: lies([]), tool: version || 'pdftotext' };
  log(`${lang}: Textebene aus ${id} (Seitenspalte in der Lage-Lesart: ${manifest.textlayer[lang].layout.filter(l => l.side).length} von 16 Zeilen)`);
}

/** Vorschaubild 1200×630: Bildschirmfoto mit Titelzeile, als HTML gesetzt. */
async function ogImage(browser, lang) {
  const src = join(RAW, `hero-a-${lang}.png`);
  const fallback = manifest.images[`hero-a-${lang}`]?.webp?.at(-1)?.[0];
  const bild = existsSync(src) ? src : (fallback ? join(OUT, fallback) : null);
  if (!bild) { log(`${lang}: kein Hero-Foto für og – übersprungen`); return; }
  const titel = {
    de: ['Dein Lebenslauf,', 'maschinenlesbar gesetzt.'],
    en: ['Your CV,', 'typeset to be machine-readable.'],
    fr: ['Votre CV,', 'composé pour être lu par les machines.'],
    es: ['Tu CV,', 'maquetado para que lo lean las máquinas.'],
  }[lang];
  const zeile = { de: 'PDF mit echter Textebene · ATS-Fassung mit einem Klick', en: 'PDF with a real text layer · ATS version in one click', fr: 'PDF avec vraie couche de texte · version ATS en un clic', es: 'PDF con capa de texto real · versión ATS con un clic' }[lang];
  const brand = (await import('../src/landing/brand.js')).BRAND.name;
  // Schrift und Bild als data:-Adressen: Eine mit setContent geladene Seite
  // darf file://-Adressen nicht nachladen.
  const geist = `data:font/woff2;base64,${readFileSync(join(APP, 'node_modules', '@fontsource-variable', 'geist', 'files', 'geist-latin-wght-normal.woff2')).toString('base64')}`;
  const bildUrl = `data:image/${bild.endsWith('.webp') ? 'webp' : 'png'};base64,${readFileSync(bild).toString('base64')}`;
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: G; src: url('${geist}') format('woff2'); font-weight: 100 900; }
    html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
    body { font-family: G, sans-serif; background: linear-gradient(160deg, oklch(0.925 0.022 248), oklch(0.948 0.012 250) 40%, oklch(0.962 0.016 62)); color: oklch(0.21 0.021 264); position: relative; }
    .t { position: absolute; left: 64px; top: 70px; width: 470px; }
    .b { font-weight: 650; font-size: 22px; letter-spacing: -0.02em; margin-bottom: 40px; }
    .b span { color: oklch(0.48 0.014 264); font-weight: 480; }
    h1 { margin: 0; font-size: 52px; line-height: 1.04; letter-spacing: -0.035em; font-weight: 680; }
    h1 em { font-style: normal; color: oklch(0.48 0.224 264); display: block; }
    p { margin: 28px 0 0; font-size: 20px; line-height: 1.4; color: oklch(0.40 0.017 264); text-wrap: balance; max-width: 430px; }
    .s { position: absolute; left: 570px; top: 58px; width: 820px; border-radius: 18px; overflow: hidden; box-shadow: 0 0 0 1px oklch(0.3 0.02 250 / .08), 0 30px 70px -20px oklch(0.25 0.03 250 / .35); }
    .s img { display: block; width: 100%; }
  </style></head><body><div class="t"><div class="b">${brand.replace('/', '<span>/')}${brand.includes('/') ? '</span>' : ''}</div><h1>${titel[0]}<em>${titel[1]}</em></h1><p>${zeile}</p></div><div class="s"><img src="${bildUrl}"></div></body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const raw = join(RAW, `og-${lang}.png`);
  await page.screenshot({ path: raw });
  await page.close();
  const name = lang === 'de' ? 'og.png' : `og-${lang}.png`;
  const r = spawnSync('python3', ['-I', '-c', 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGB").quantize(colors=256).save(sys.argv[2], "PNG", optimize=True)', raw, join(APP, 'public', name)]);
  if (r.status !== 0) throw new Error(String(r.stderr));
  log(`${lang}: Vorschaubild public/${name}`);
}

function writeGenerated(themes) {
  manifest.generated = new Date().toISOString();
  manifest.templates = themes.map(t => t.id);
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  // Für die App als TypeScript (das Projekt importiert kein JSON).
  const ts = `// Erzeugt von scripts/landing-shots.mjs am ${manifest.generated.slice(0, 10)}. Nicht von Hand ändern.
// Neu erzeugen: siehe Kopf von scripts/landing-shots.mjs.
export interface ShotImage { w: number; h: number; v: string; avif: [string, number][]; webp: [string, number][]; png: [string, number] | null }
export interface TextLine { t: string; side: boolean }
export interface TextLayer { template: string; name: string; raw: TextLine[]; layout: TextLine[]; tool: string }
export const SHOTS: Record<string, ShotImage> = ${JSON.stringify(manifest.images, null, 1)};
export const TEXTLAYER: Record<string, TextLayer> = ${JSON.stringify(manifest.textlayer, null, 1)};
export const SHOT_TEMPLATES: string[] = ${JSON.stringify(manifest.templates)};
`;
  writeFileSync(join(APP, 'src', 'landing', 'shots.gen.ts'), ts);
  // Verwaiste Dateien (Vorlage entfernt, Breite geändert) löschen — nur
  // nach einem vollständigen Lauf, sonst fielen Fotos eines Teil-Laufs weg.
  if (ONLY || process.env.LANDING_LANGS) return;
  const used = new Set(['manifest.json']);
  for (const im of Object.values(manifest.images)) for (const [f] of [...im.avif, ...im.webp, ...(im.png ? [im.png] : [])]) used.add(f);
  for (const n of readdirSync(OUT)) if (!used.has(n)) { unlinkSync(join(OUT, n)); log(`entfernt: ${n}`); }
}

const browser = await chromium.launch({ executablePath: EXEC });
try {
  // Vorlagenliste aus dem Code (wählbare Vorlagen, Reihenfolge der App).
  const probe = await browser.newPage();
  await probe.goto(`${BASE}/dev-preview.html`, { waitUntil: 'domcontentloaded' });
  const themes = await probe.evaluate(async () => {
    const m = await import('/src/templates/theme.ts');
    return m.PICKABLE_THEMES.map(t => ({ id: t.id, name: t.name, layout: t.layout }));
  });
  await probe.close();
  log(`${themes.length} wählbare Vorlagen`);
  // Miniaturen nicht mehr vorhandener Vorlagen aus dem Manifest nehmen.
  for (const k of Object.keys(manifest.images)) {
    const m = /^thumb-(de|en)-(.+)$/.exec(k);
    if (m && !themes.some(t => t.id === m[2])) delete manifest.images[k];
  }
  for (const lang of LANGS) {
    if (!ONLY || ONLY === 'ui') await shotsUi(browser, lang, themes);
    if (!ONLY || ONLY === 'text') await textLayer(browser, lang, themes);
    if (!ONLY || ONLY === 'og' || ONLY === 'ui') await ogImage(browser, lang);
    writeGenerated(themes);
  }
  if (!ONLY || ONLY === 'thumbs') for (const lang of THUMB_LANGS) await shotsThumbs(browser, lang, themes);
  writeGenerated(themes);
} finally {
  await browser.close();
  rmSync(RAW, { recursive: true, force: true });
}
const bytes = readdirSync(OUT).reduce((s, n) => s + readFileSync(join(OUT, n)).length, 0);
log(`fertig: ${readdirSync(OUT).length} Dateien, ${(bytes / 1024 / 1024).toFixed(1)} MB in public/landing/`);
