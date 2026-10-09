// Gratis-Grenze (09.10.2026, optional, standardmäßig aus), einmal durchgeklickt.
//
// „Ein PDF bleibt gratis, Word, Anschreiben, weitere Fassungen und Sprachen
// kommen in den Pass." Die Grenze greift nur, wenn GET /api/billing/offer
// `freeTier: { limited: true }` meldet. Geprüft wird in beide Richtungen:
//
//   A. limited:true, ohne Konto: PDF lädt, ATS-PDF lädt; Word (Menü, Export-
//      Paneel, ATS-Zeile), Anschreiben (Tab, Paneel, PDF), „Neue Fassung",
//      „Duplizieren" und eine zweite Sprache zeigen Schloss und Preis VORHER
//      und lösen nichts aus, sondern öffnen das Freischalt-Paneel. Die
//      unveränderte Demo zählt nicht als Fassung; Import in die eine Fassung
//      bleibt frei.
//   B. limited:false: alles frei wie bisher (Word lädt, Anschreiben bearbeitbar,
//      Sprachwechsel, neue Fassung) — dabei entsteht Bestand für D.
//   C. Angebot nicht erreichbar (offline/Fehler): nichts gesperrt.
//   D. Bestand: zwei lokale Profile und zwei Sprachen von vorher bleiben nach
//      dem Umschalten auf limited:true nutzbar (öffnen, bearbeiten, PDF,
//      zwischen den eigenen Sprachen wechseln); nur Neues ist gesperrt.
//   E. Konten (Mock): aktiver Pass, Gutschein-Zeitzugang, dauerhafter
//      Gratiszugang, Bestandskonto → alles frei; abgelaufener Pass → Word lädt;
//      Konto ohne je einen Zugang → Word gesperrt.
//   F. Seiten: /preise und Startseite mit und ohne Grenze (Tabelle, FAQ,
//      Selbst-hosten-Hinweis), Freischalt-Paneel in vier Sprachen, axe.
//   G. LIVE=1: gegen den echten cv-api mit FREE_TIER_LIMITS=1 (Vite mit Proxy):
//      Angebot meldet limited, echtes PDF ohne Konto, Word gesperrt; Admin
//      angemeldet → Word lädt.
//
//   HARNESS_BASE=http://localhost:5251 SHOTS=/ordner [LIVE=1] node scripts/freetiercheck.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { installBillingMock, createBillingState, passPlan } from './_billingmock.mjs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5251';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const LIVE = process.env.LIVE === '1';
const ADMIN_USER = process.env.ADMIN_USER || 'ftadmin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Ftadmin-Pass1';
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const PRICE = 'Im Bewerbungs-Pass · 9 € einmalig · 90 Tage · kein Abo';
/** Preise stehen mit geschütztem Leerzeichen da („9 €"). */
const norm = s => String(s || '').replace(/[\u00a0\u202f]/g, ' ');
const hasPrice = s => norm(s).includes(PRICE);

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);
const errors = [];
const browser = await chromium.launch({ executablePath: EXEC });

const OFFER = limited => ({
  enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90,
  vatNote: 'Endpreis. Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', productName: 'CV-Hub',
  features: ['sync', 'share', 'versions', 'mcp', 'apiKeys'], openRegistration: true,
  freeTier: { limited },
});

/** Kontext mit Mock (state) oder ohne (LIVE). Zählt Downloads je Endung. */
async function open({ state, viewport = { width: 1440, height: 900 }, lang = 'de', offline = false } = {}) {
  const ctx = await browser.newContext({ viewport, locale: lang === 'de' ? 'de-DE' : lang, acceptDownloads: true });
  await ctx.addInitScript(([l]) => {
    window.__ev = [];
    window.umami = { track: (e, d) => window.__ev.push([e, d || {}]) };
    try { localStorage.setItem('appstudio-ui-lang', l); } catch { /* */ }
  }, [lang]);
  await ctx.route(/\/u\/(script\.js|api\/send)(\?|$)/, r => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.__downloads = [];
  page.on('download', d => page.__downloads.push(d.suggestedFilename()));
  page.__pdf = 0;
  if (offline) {
    await page.route('**/pdfapi/**', r => (r.request().url().includes('/api/pdf')
      ? r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%mock\n' })
      : r.abort('internetdisconnected')));
  } else if (state) {
    await installBillingMock(page, state);
  }
  page.on('request', r => { if (/\/api\/pdf(\?|$)/.test(r.url())) page.__pdf++; });
  return { ctx, page };
}
const downloads = (page, ext) => page.__downloads.filter(n => n.toLowerCase().endsWith(ext)).length;
const unlockOpen = page => page.locator('[data-unlock]').getAttribute('data-unlock', { timeout: 1500 }).catch(() => null);
async function closeUnlock(page) {
  if (await page.locator('[data-unlock]').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
}
const shot = async (page, name) => { if (SHOTS) { await page.waitForTimeout(250); await page.screenshot({ path: `${SHOTS}/${name}.png` }); } };
/* `skip`: Regeln mit vorhandenem, nicht von der Gratis-Grenze verursachtem
 * Befund. Die Startseite der Profile meldet nested-interactive an der
 * Profilzeile (div role=button mit Knöpfen darin) — mit und ohne Grenze
 * gleich, siehe „Startseite ohne Grenze (Vergleich)". */
async function axe(page, name, skip = []) {
  await page.evaluate(AXE);
  const r = await page.evaluate(async sk => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations
    .filter(v => !sk.includes(v.id))
    .map(v => ({ ...v, nodes: v.id === 'target-size' ? v.nodes.filter(n => !n.target.join(' ').includes('cv-edit')) : v.nodes }))
    .filter(v => v.nodes.length)
    .map(v => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`), skip);
  check(r.length === 0, `axe ${name}${skip.length ? ` (ohne ${skip.join(', ')})` : ''}`, r.join(' ; '));
}

/** Profile direkt aus IndexedDB (das, was wirklich gespeichert ist). */
const localProfiles = async page => {
  await page.waitForTimeout(400);
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('cv-hub-local'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const recs = await new Promise((res, rej) => { const q = db.transaction('profiles').objectStore('profiles').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    db.close();
    return recs.map(r => JSON.parse(r.json));
  });
};

async function startLocal(page, lang = 'de') {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(async l => {
    localStorage.clear();
    localStorage.setItem('appstudio-ui-lang', l);
    await new Promise(res => { const r = indexedDB.deleteDatabase('cv-hub-local'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
  }, lang);
  // /?demo=1 startet den Lokalmodus direkt (App.tsx, initialFlags).
  await page.goto(`${BASE}/?demo=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}
const menuTrigger = page => page.getByRole('button', { name: 'Weitere Formate', exact: true }).first();
async function openMenu(page) { await menuTrigger(page).click(); await page.waitForTimeout(300); }
async function rail(page, name) {
  await page.locator('.ui-rail button', { hasText: name }).first().click();
  await page.waitForTimeout(400);
}
async function ensurePanel(page, name) {
  const expanded = await page.locator('.ui-rail button', { hasText: name }).first().getAttribute('aria-expanded');
  if (expanded !== 'true') await rail(page, name);
}
const menuItem = (page, text) => page.locator('.ui-menu-item', { hasText: text }).first();
async function goHome(page) {
  await page.getByRole('button', { name: /Zurück zur Profilübersicht/ }).first().click();
  await page.waitForTimeout(600);
}
async function openProfile(page, name) {
  await page.getByRole('button', { name: new RegExp(`${name}.*öffnen|öffnen.*${name}`, 'i') }).first().click().catch(async () => {
    await page.locator('[role=button]', { hasText: name }).first().click();
  });
  await page.waitForTimeout(1200);
}
/** Eigenen Inhalt in die aktive Sprache bringen — über den freien JSON-Import
 *  ins aktive Profil (Export-Paneel → „JSON hochladen"). */
async function importOwn(page, marker) {
  const ps = await localProfiles(page);
  const activeId = await page.evaluate(() => localStorage.getItem('appstudio-active-v2'));
  const p = ps.find(x => x.id === activeId) ?? ps[0];
  const cv = JSON.parse(JSON.stringify(p.data[p.settings.lang]));
  cv.profile = { text: `Eigener Profiltext ${marker}.` };
  cv.experience = [{ id: `x${marker}`, role: `Rolle ${marker}`, company: 'Firma', location: 'Hamburg', start: '2020', end: '', bullets: [`Ergebnis ${marker}`] }];
  await ensurePanel(page, 'Export');
  await page.locator('input[type=file][accept=".json,application/json"]').first().setInputFiles({ name: 'cv.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(cv)) });
  await page.waitForTimeout(1500);
}

/* ═══ A. Grenze an, ohne Konto ═══════════════════════════════════════════ */
step('A. limited:true, ohne Konto (Lokalmodus)');
const stA = createBillingState({ offer: OFFER(true) });
let { ctx, page } = await open({ state: stA });
await startLocal(page);

// Unveränderte Demo: „Neuer Lebenslauf" ist frei.
await goHome(page);
check(await page.locator('button[data-locked]', { hasText: 'Neuer Lebenslauf' }).count() === 0, 'Unveränderte Demo zählt nicht: „Neuer Lebenslauf" ohne Schloss');
await openProfile(page, 'Lena Brandt');

// Export-Menü: Schloss und Preis VOR dem Klick.
await openMenu(page);
const wAts = menuItem(page, 'Word – ATS-Fassung');
const wDes = menuItem(page, 'Word mit Design');
check(await wAts.locator('[data-lock]').count() > 0 && hasPrice(await wAts.innerText()), 'Menü: Word ATS mit Schloss und Preiszeile', (await wAts.innerText()).replace(/\n/g, ' · '));
check(await wDes.locator('[data-lock]').count() > 0 && hasPrice(await wDes.innerText()), 'Menü: Word mit Design mit Schloss und Preiszeile');
check(await menuItem(page, 'PDF herunterladen').locator('[data-lock]').count() === 0, 'Menü: PDF ohne Schloss');
for (const k of ['JSON', 'Markdown', 'HTML']) {
  check(await page.locator('.ui-menu-item', { hasText: k }).locator('[data-lock]').count() === 0, `Menü: ${k} frei`);
}
await shot(page, 'export-menue-gesperrt-1440');
await wAts.click();
check(await unlockOpen(page) === 'docx', 'Word ATS → Freischalt-Paneel „docx" statt Datei');
const unlockText = await page.locator('[data-unlock]').innerText().catch(() => '');
check(/Word gibt es mit dem Pass/.test(unlockText) && /9 €/.test(norm(unlockText)) && /PDF deines Lebenslaufs bleibt ohne Konto kostenlos/.test(unlockText), 'Paneel nennt Word, Preis und dass das PDF frei bleibt');
await shot(page, 'freischalt-docx-1440');
await closeUnlock(page);
await openMenu(page);
await wDes.click();
check(await unlockOpen(page) === 'docx', 'Word mit Design → Freischalt-Paneel');
await closeUnlock(page);
await page.waitForTimeout(600);
check(downloads(page, '.docx') === 0, 'keine .docx-Datei entstanden');
const ev = await page.evaluate(() => window.__ev.filter(e => e[0] === 'unlock_panel_view').map(e => e[1].feature));
check(ev.includes('docx'), 'Messung unlock_panel_view mit feature=docx', ev.join(','));

// PDF bleibt frei und prominent.
const pdfBefore = page.__pdf;
await page.locator('.ui-split button').first().click();
await page.waitForTimeout(1500);
check(page.__pdf > pdfBefore && downloads(page, '.pdf') >= 1, 'PDF-Knopf lädt das PDF', `${downloads(page, '.pdf')} PDF`);
check(await page.locator('[data-unlock]').count() === 0, 'PDF öffnet kein Paneel');
await openMenu(page);
await menuItem(page, 'PDF – ATS-Fassung').click().catch(() => {});
await page.waitForTimeout(3500);
check(downloads(page, '.pdf') >= 2, 'ATS-Fassung als PDF lädt', `${downloads(page, '.pdf')} PDF`);

// Datenportabilität bleibt frei: jeder Datenexport lädt, ohne Paneel.
for (const [label, ext] of [['Webseite', '.html'], ['Text für KI-Korrektur', '.md'], ['Datensicherung', '.json'], ['Für andere Lebenslauf-Werkzeuge', '.json'], ['Vorlage ohne Daten', '.zip']]) {
  const before = downloads(page, ext);
  await openMenu(page);
  await menuItem(page, label).click();
  await page.waitForTimeout(1800);
  check(downloads(page, ext) === before + 1 && await page.locator('[data-unlock]').count() === 0, `Menü: ${label} lädt (${ext}), kein Paneel`);
  await closeUnlock(page);
}

// Export-Paneel
await ensurePanel(page, 'Export');
const epWord = page.locator('#ui-panel button[data-locked]', { hasText: 'Word' });
check(await epWord.count() >= 1, 'Export-Paneel: Word-Knöpfe gesperrt markiert', String(await epWord.count()));
check(hasPrice(await page.locator('#ui-panel').innerText()), 'Export-Paneel: Preiszeile steht da');
await epWord.first().click();
check(await unlockOpen(page) === 'docx', 'Export-Paneel: Word → Paneel');
await closeUnlock(page);
check(downloads(page, '.docx') === 0, 'weiterhin keine .docx');

// ATS-Zeile im Karussell: zu einer Vorlage mit Seitenspalte blättern.
let atsWord = page.locator('.ui-canvas button[data-locked]', { hasText: 'Word' });
for (let i = 0; i < 12 && !(await atsWord.count()); i++) {
  await page.keyboard.press('Escape');
  await page.locator('.ui-canvas button[aria-label*="Nächste"], .ui-canvas button[aria-label*="nächste"], .ui-canvas button[title*="Nächste"]').first().click().catch(() => {});
  await page.waitForTimeout(500);
  atsWord = page.locator('.ui-canvas button[data-locked]', { hasText: 'Word' });
}
if (await atsWord.count()) {
  check(true, 'ATS-Zeile: Word-Knopf mit Schloss');
  await atsWord.first().click();
  check(await unlockOpen(page) === 'docx', 'ATS-Zeile: Word → Paneel');
  await closeUnlock(page);
  const atsPdfBtn = page.locator('.ui-canvas button', { hasText: /^PDF$/ });
  check(await atsPdfBtn.locator('[data-lock]').count() === 0, 'ATS-Zeile: PDF ohne Schloss');
} else {
  check(false, 'ATS-Zeile mit Word-Knopf gefunden (Vorlage mit Seitenspalte)');
}
check(downloads(page, '.docx') === 0, 'nach allen Wegen keine .docx');

// Anschreiben
const clTab = page.locator('.ui-top .ui-seg button', { hasText: 'Anschreiben' }).first();
check(await clTab.getAttribute('data-locked') === 'true' && await clTab.locator('[data-lock]').count() > 0, 'Anschreiben-Tab trägt das Schloss, bevor man draufklickt');
await clTab.click();
await page.waitForTimeout(800);
await ensurePanel(page, 'Inhalt');
check(await page.locator('[data-freetier-card="coverLetter"]').isVisible(), 'Inhalt-Paneel: Hinweiskarte statt Formular');
check(hasPrice(await page.locator('[data-freetier-card="coverLetter"]').innerText()), 'Hinweiskarte nennt den Preis');
check(await page.locator('#ui-panel textarea').count() === 0, 'kein Anschreiben-Formular');
check(await page.locator('.ft-pill [data-freetier-note="coverLetter"]').isVisible(), 'Hinweis über der Vorschau sichtbar');
check(await page.locator('.cv-scale-wrapper [contenteditable="true"]').count() === 0, 'Vorschau des Anschreibens nicht beschreibbar');
const noteColor = await page.locator('.ft-note').first().evaluate(el => getComputedStyle(el).color);
check(!/rgb\((1\d\d|2\d\d), ?([0-6]?\d), ?([0-6]?\d)\)/.test(noteColor), 'Hinweis ohne Rot', noteColor);
await shot(page, 'anschreiben-tab-1440');
const pdfBeforeCl = page.__pdf;
await page.locator('.ui-split button').first().click();
check(await unlockOpen(page) === 'coverLetter', 'Anschreiben-PDF → Paneel statt Datei');
await closeUnlock(page);
await page.waitForTimeout(400);
check(page.__pdf === pdfBeforeCl, 'kein PDF-Auftrag für das Anschreiben');
await openMenu(page);
check(await page.locator('.ui-menu-item[role=menuitem] [data-lock]').count() >= 3, 'Menü im Anschreiben: PDF, HTML, Markdown gesperrt');
await page.keyboard.press('Escape');
await ensurePanel(page, 'Export');
check(await page.locator('#ui-panel input[type=file][accept=".md,text/markdown,text/plain"]').count() === 0, 'kein Markdown-Import ins Anschreiben');
await page.locator('[data-freetier-card="coverLetter"] button', { hasText: 'Zurück zum Lebenslauf' }).click().catch(async () => {
  await page.locator('.ui-top .ui-seg button', { hasText: 'Lebenslauf' }).first().click();
});
await page.locator('.ui-top .ui-seg button', { hasText: 'Lebenslauf' }).first().click();
await page.waitForTimeout(500);

// Sprachen: Demo unverändert → frei wählbar.
await ensurePanel(page, 'Inhalt');
check(await page.locator('#ui-panel .ui-seg button[data-locked]').count() === 0, 'Unveränderte Demo: alle Sprachen wählbar');
// Eigener Inhalt in DE (Import in die eine Fassung ist frei).
await importOwn(page, 'A1');
let ps = await localProfiles(page);
check(ps.length === 1 && /Eigener Profiltext A1/.test(ps[0].data.de.profile.text), 'JSON-Import in die eine Fassung bleibt frei');
await ensurePanel(page, 'Inhalt');
const langLocked = (await page.locator('#ui-panel .ui-seg button[data-locked]').allTextContents()).map(s => s.trim().slice(0, 2));
check(langLocked.join(',') === 'EN,FR,ES', 'Nach eigenem Inhalt: EN, FR, ES mit Schloss', langLocked.join(','));
check(await page.locator('[data-freetier-note="langs"]').isVisible() && hasPrice(await page.locator('[data-freetier-note="langs"]').innerText()), 'Hinweis „Weitere Sprachen" mit Preis');
await page.locator('#ui-panel .ui-seg button', { hasText: 'EN' }).first().click();
check(await unlockOpen(page) === 'langs', 'EN → Freischalt-Paneel „langs"');
await closeUnlock(page);
ps = await localProfiles(page);
check(ps[0].settings.lang === 'de', 'Sprache bleibt DE');

// Fassungen
await page.getByRole('button', { name: 'Mehr', exact: true }).first().click().catch(() => {});
await page.waitForTimeout(300);
const dupItem = menuItem(page, 'Fassung duplizieren');
if (await dupItem.count()) {
  check(hasPrice(await dupItem.innerText()), '⋯ → „Fassung duplizieren" mit Preiszeile');
  await dupItem.click();
  check(await unlockOpen(page) === 'profiles', '⋯ → Duplizieren → Paneel „profiles"');
  await closeUnlock(page);
} else { await page.keyboard.press('Escape'); check(false, '⋯-Menü mit „Fassung duplizieren" gefunden'); }
await goHome(page);
const newBtn = page.locator('button', { hasText: 'Neuer Lebenslauf' }).first();
check(await newBtn.getAttribute('data-locked') === 'true', '„Neuer Lebenslauf" mit Schloss, sobald eine eigene Fassung da ist');
check(hasPrice(await page.locator('[data-freetier-note="profiles"]').innerText()), 'Preiszeile unter „Neuer Lebenslauf"');
await newBtn.click();
check(await unlockOpen(page) === 'profiles', '„Neuer Lebenslauf" → Paneel statt Formular');
check(await page.locator('#cv-create-title').count() === 0, 'kein Anlege-Formular');
await closeUnlock(page);
const dupBtn = page.locator('button[data-locked]', { hasText: 'Duplizieren' }).first();
check(await dupBtn.count() === 1, 'Duplizieren in der Liste mit Schloss');
await dupBtn.click();
check(await unlockOpen(page) === 'profiles', 'Duplizieren → Paneel');
await closeUnlock(page);
check((await localProfiles(page)).length === 1, 'weiterhin genau eine Fassung');
await axe(page, 'Startseite mit Grenze', ['nested-interactive']);
await ctx.close();

/* ═══ B. Grenze aus: alles frei, Bestand anlegen ═════════════════════════ */
step('B. limited:false — alles frei wie bisher');
const stB = createBillingState({ offer: OFFER(false) });
({ ctx, page } = await open({ state: stB }));
await startLocal(page);
await importOwn(page, 'B1');
await openMenu(page);
check(await page.locator('.ui-menu-item [data-lock]').count() === 0, 'Menü ohne Schloss');
await shot(page, 'export-menue-frei-1440');
await menuItem(page, 'Word – ATS-Fassung').click();
await page.waitForTimeout(1500);
check(downloads(page, '.docx') === 1 && await page.locator('[data-unlock]').count() === 0, 'Word ATS lädt .docx', page.__downloads.join(','));
await openMenu(page);
await menuItem(page, 'Word mit Design').click();
await page.waitForTimeout(1500);
check(downloads(page, '.docx') === 2, 'Word mit Design lädt .docx');
await page.locator('.ui-top .ui-seg button', { hasText: 'Anschreiben' }).first().click();
await ensurePanel(page, 'Inhalt');
check(await page.locator('[data-freetier-card]').count() === 0 && await page.locator('#ui-panel textarea').count() > 0, 'Anschreiben-Formular da');
await page.locator('.ui-top .ui-seg button', { hasText: 'Lebenslauf' }).first().click();
await ensurePanel(page, 'Inhalt');
check(await page.locator('[data-locked]').count() === 0, 'keine Schlösser im Editor');
// Zweite Sprache mit eigenem Inhalt (Bestand für D).
await page.locator('#ui-panel .ui-seg button', { hasText: 'EN' }).first().click();
await page.waitForTimeout(600);
await importOwn(page, 'B-EN');
ps = await localProfiles(page);
check(ps[0].settings.lang === 'en' && /B-EN/.test(ps[0].data.en.profile.text) && /B1/.test(ps[0].data.de.profile.text), 'Sprachwechsel frei, zwei Sprachen mit eigenem Inhalt');
// Zweite Fassung
await goHome(page);
check(await page.locator('[data-locked]').count() === 0, 'Startseite ohne Schloss');
// Vergleich: derselbe Befund ohne Grenze → vorhanden, nicht neu.
const homeCmp = await page.evaluate(AXE).then(() => page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'rule', values: ['nested-interactive'] } })).violations.length));
check(homeCmp === 1, 'nested-interactive auf der Profilübersicht schon ohne Grenze vorhanden (nicht neu)', String(homeCmp));
await axe(page, 'Startseite ohne Grenze', ['nested-interactive']);
await page.locator('button', { hasText: 'Neuer Lebenslauf' }).first().click();
await page.locator('input[placeholder="z. B. Bewerbung Stadtwerke"]').fill('Zweite Fassung');
await page.getByRole('button', { name: /Profil anlegen/ }).click();
await page.waitForTimeout(1500);
await importOwn(page, 'B2');
ps = await localProfiles(page);
check(ps.length === 2, 'zweite Fassung angelegt', String(ps.length));

/* ═══ D. Bestand nach dem Umschalten ═════════════════════════════════════ */
step('D. Bestand: Schalter an, vorhandene Fassungen und Sprachen bleiben nutzbar');
stB.offer = OFFER(true);
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await goHome(page).catch(() => {});
const rows = await page.locator('[role=button][aria-label]').allInnerTexts();
check(rows.some(r => r.includes('Zweite Fassung')) && rows.some(r => r.includes('Lena Brandt')), 'beide Fassungen sichtbar');
check(await page.locator('button[data-locked]', { hasText: 'Neuer Lebenslauf' }).count() === 1, 'nur „Neuer Lebenslauf" gesperrt');
await openProfile(page, 'Zweite Fassung');
await importOwn(page, 'D2');
ps = await localProfiles(page);
check(/D2/.test(ps.find(p => p.displayName === 'Zweite Fassung')?.data.de.profile.text || ''), 'zweite Fassung weiter bearbeitbar (Bestand)');
const pdfD = downloads(page, '.pdf');
await page.locator('.ui-split button').first().click();
await page.waitForTimeout(1500);
check(downloads(page, '.pdf') === pdfD + 1, 'PDF aus der zweiten Fassung');
await goHome(page);
await openProfile(page, 'Lena Brandt');
await ensurePanel(page, 'Inhalt');
const lockedD = (await page.locator('#ui-panel .ui-seg button[data-locked]').allTextContents()).map(s => s.trim().slice(0, 2));
check(!lockedD.includes('DE') && !lockedD.includes('EN') && lockedD.includes('FR') && lockedD.includes('ES'), 'Bestand-Sprachen DE und EN frei, FR/ES gesperrt', lockedD.join(','));
await page.locator('#ui-panel .ui-seg button', { hasText: 'DE' }).first().click();
await page.waitForTimeout(600);
check(await page.locator('[data-unlock]').count() === 0, 'Wechsel zwischen eigenen Sprachen ohne Paneel');
ps = await localProfiles(page);
check(ps.find(p => p.displayName.includes('Lena'))?.settings.lang === 'de', 'Sprache gewechselt (EN → DE)');
await ctx.close();

/* ═══ C. Angebot nicht erreichbar ════════════════════════════════════════ */
step('C. Offline/Fehler beim Angebot: nichts gesperrt');
({ ctx, page } = await open({ offline: true }));
await startLocal(page);
await importOwn(page, 'C1');
await openMenu(page);
check(await page.locator('.ui-menu-item [data-lock]').count() === 0, 'Menü ohne Schloss');
await menuItem(page, 'Word – ATS-Fassung').click();
await page.waitForTimeout(1500);
check(downloads(page, '.docx') === 1, 'Word lädt offline');
await ensurePanel(page, 'Inhalt');
check(await page.locator('[data-locked]').count() === 0, 'Sprachen und Anschreiben frei');
await ctx.close();

/* ═══ E. Konten ═════════════════════════════════════════════════════════ */
step('E. Konten mit und ohne Zugang (Mock)');
const until = d => new Date(Date.now() + d * 86_400_000).toISOString();
const cvPayload = id => ({
  id, displayName: `Konto ${id}`, createdAt: new Date().toISOString(),
  data: { de: { personal: { name: 'Konto Person', title: 'Titel', location: 'Hamburg', email: 'k@example.org', phone: '' }, profile: { text: `Kontotext ${id}` }, experience: [], education: [], skillGroups: [], languages: [] } },
  coverLetters: {}, settings: { template: 'espoo', fontScale: 1, fontPairing: 'auto', pageMode: 'one', lang: 'de' },
});
const PLANS = [
  ['aktiver Pass', { ...passPlan(60), hasPaid: true, grants: [{ source: 'order', kind: 'days', days: 90 }] }, 'free'],
  ['Gutschein-Zeitzugang', { ...passPlan(20), hasPaid: false, grants: [{ source: 'voucher', kind: 'days', days: 30 }] }, 'free'],
  ['dauerhafter Gratiszugang', { kind: 'lifetime', until: null, daysLeft: null, notice: null, grants: [{ source: 'voucher', kind: 'lifetime', days: null }] }, 'free'],
  ['Bestandskonto unbegrenzt', { kind: 'unlimited', until: null, daysLeft: null, notice: null }, 'free'],
  ['Pilot aktiv', { kind: 'pilot', until: until(10), daysLeft: 10, notice: 'soon' }, 'free'],
  ['abgelaufener Pass', { kind: 'none', until: until(-3), daysLeft: 0, notice: 'expired', hasPaid: true, grants: [{ source: 'order', kind: 'days', days: 90 }] }, 'export'],
  ['nie ein Zugang (none)', { kind: 'none', until: null, daysLeft: null, notice: null }, 'locked'],
];
for (const [label, plan, expect] of PLANS) {
  const st = createBillingState({
    offer: OFFER(true),
    user: { id: 9, username: 'konto@example.org', email: 'konto@example.org', role: 'user', plan, emailConfirmed: true },
    resumes: [{ id: 'r1', displayName: 'Konto r1', payload: cvPayload('r1') }],
  });
  ({ ctx, page } = await open({ state: st }));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await openMenu(page);
  const locks = await page.locator('.ui-menu-item [data-lock]').count();
  await menuItem(page, 'Word – ATS-Fassung').click();
  await page.waitForTimeout(1500);
  const got = downloads(page, '.docx');
  const panel = await unlockOpen(page);
  if (expect === 'locked') check(locks > 0 && got === 0 && panel === 'docx', `${label}: Word gesperrt, Paneel`, `locks=${locks} docx=${got} panel=${panel}`);
  else check(locks === 0 && got === 1 && !panel, `${label}: Word lädt`, `locks=${locks} docx=${got}`);
  await closeUnlock(page);
  const clTabLocked = await page.locator('.ui-top .ui-seg button[data-locked]', { hasText: 'Anschreiben' }).count();
  check(expect === 'locked' ? clTabLocked === 1 : clTabLocked === 0, `${label}: Anschreiben ${expect === 'locked' ? 'gesperrt' : 'frei (Export)'}`);
  await ctx.close();
}

/* ═══ F. Seiten ═════════════════════════════════════════════════════════ */
step('F. /preise, Startseite, Freischalt-Paneel in vier Sprachen');
for (const limited of [true, false]) {
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    ({ ctx, page } = await open({ state: createBillingState({ offer: OFFER(limited) }), viewport: vp }));
    await page.goto(`${BASE}/preise`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const txt = await page.locator('body').innerText();
    const tag = `${limited ? 'mit' : 'ohne'} Grenze ${vp.width}`;
    if (limited) {
      check(/Das PDF deines Lebenslaufs ist kostenlos/.test(txt), `/preise ${tag}: Überschrift`);
      check(/Word, gestaltet und als ATS-Fassung/.test(txt) && /Sprachen des Lebenslaufs/.test(txt) && /Eine, frei wählbar/.test(txt), `/preise ${tag}: Tabelle mit Word, Anschreiben, Fassungen, Sprachen`);
      check(/Was bleibt ohne Pass kostenlos\?/.test(txt) && !/Brauche ich den Pass für PDF oder Word\?/.test(txt), `/preise ${tag}: FAQ angepasst`);
      check(!/Alles im Browser ist kostenlos/.test(txt) && !/Export ist nie Teil des Passes/.test(txt), `/preise ${tag}: keine überholten Versprechen`);
      const sh = page.locator('[data-selfhost] a');
      check(await sh.count() === 1 && /github\.com\/tillheidrich\/cv-hub/.test(await sh.getAttribute('href') || ''), `/preise ${tag}: Selbst-hosten-Hinweis mit Repo`);
      check(await page.locator('[data-pass-features] [data-ft]').count() === 4, `/preise ${tag}: Pass-Karte nennt Word, Anschreiben, Fassungen, Sprachen`);
    } else {
      check(/Alles im Browser ist kostenlos/.test(txt) && /Brauche ich den Pass für PDF oder Word\?/.test(txt), `/preise ${tag}: bisherige Texte`);
      check(await page.locator('[data-selfhost]').count() === 0 && await page.locator('[data-ft]').count() === 0, `/preise ${tag}: kein Grenzen-Zusatz`);
    }
    check(!/\d+:\d\d:\d\d|nur noch|letzte Chance|Countdown/i.test(txt), `/preise ${tag}: kein Countdown, keine Knappheit`);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    check(scrollW <= vp.width, `/preise ${tag}: kein waagerechtes Scrollen`, String(scrollW));
    if (vp.width === 1440) await axe(page, `/preise ${tag}`);
    if (limited) {
      await page.locator('#bl-table-h').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      await shot(page, `preise-tabelle-${vp.width}`);
    }
    await ctx.close();
  }
}
// Startseite
for (const limited of [true, false]) {
  ({ ctx, page } = await open({ state: createBillingState({ offer: OFFER(limited) }) }));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.removeItem('appstudio-demo-mode'); });
  await page.reload({ waitUntil: 'networkidle' });
  const acc = await page.locator('[data-faq="access"]').textContent();
  const pre = await page.locator('#preise').textContent().catch(() => '');
  if (limited) check(/Word, Anschreiben, weitere Fassungen und Sprachen gehören zum Bewerbungs-Pass/.test(acc) && /PDF kostenlos/.test(pre), 'Startseite mit Grenze: FAQ und Preisabschnitt angepasst');
  else check(/alle Exporte/.test(acc) && /Kostenlos im Browser/.test(pre), 'Startseite ohne Grenze: bisherige Texte');
  await ctx.close();
}
// Freischalt-Paneel in vier Sprachen, Telefon
for (const lang of ['de', 'en', 'fr', 'es']) {
  ({ ctx, page } = await open({ state: createBillingState({ offer: OFFER(true) }), viewport: { width: 390, height: 844 }, lang }));
  // Auf dem Telefon: unten „Export" → Word im Export-Paneel.
  await startLocal(page, lang);
  await page.locator('.ui-bottom-bar button.ui-bottom-primary').click();
  await page.waitForTimeout(500);
  const w = page.locator('#ui-mpanel-export button[data-locked]').first();
  const has = await w.count();
  if (has) {
    if (lang === 'de') await shot(page, 'export-paneel-gesperrt-390');
    await w.click();
    const t = await page.locator('[data-unlock]').innerText().catch(() => '');
    const expect = { de: /Word gibt es mit dem Pass/, en: /Word comes with the pass/, fr: /Word est inclus dans le pass/, es: /Word viene con el pase/ }[lang];
    check(expect.test(t), `Paneel ${lang}: Text in der Oberflächensprache`, t.split('\n').slice(0, 2).join(' / '));
    if (lang === 'de') { await shot(page, 'freischalt-docx-390'); await axe(page, 'Freischalt-Paneel 390'); }
    await closeUnlock(page);
  } else check(false, `Telefon ${lang}: gesperrter Word-Knopf im Export-Paneel`);
  if (lang === 'de') {
    // Anschreiben auf dem Telefon: Hinweis über der Vorschau.
    await page.locator('.ui-bottom-bar button.ui-bottom-primary').click();
    await page.locator('.ui-top .ui-seg button', { hasText: 'Anschreiben' }).first().click();
    await page.waitForTimeout(800);
    check(await page.locator('.ft-mobile-bar [data-freetier-note="coverLetter"]').isVisible(), 'Telefon: Anschreiben-Hinweis über der Vorschau');
    await shot(page, 'anschreiben-tab-390');
    await page.locator('.ui-top .ui-seg button', { hasText: 'Lebenslauf' }).first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Menü|Weitere Optionen/ }).first().click().catch(() => {});
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    check(scrollW <= 390, 'Telefon: kein waagerechtes Scrollen im Editor', String(scrollW));
  }
  await ctx.close();
}
// Export-Menü frei/gesperrt auf 390 (Export-Paneel), frei
({ ctx, page } = await open({ state: createBillingState({ offer: OFFER(false) }), viewport: { width: 390, height: 844 } }));
await startLocal(page);
await page.locator('.ui-bottom-bar button.ui-bottom-primary').click();
await page.waitForTimeout(500);
check(await page.locator('#ui-mpanel-export [data-locked]').count() === 0, 'Telefon ohne Grenze: Export-Paneel ohne Schloss');
await shot(page, 'export-paneel-frei-390');
await ctx.close();

/* ═══ G. Live gegen cv-api ══════════════════════════════════════════════ */
if (LIVE) {
  step('G. Live: echter cv-api mit FREE_TIER_LIMITS=1');
  ({ ctx, page } = await open({}));
  const offer = await page.evaluate(async () => (await fetch('/pdfapi/api/billing/offer')).json()).catch(() => null);
  if (!offer) await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const o2 = offer ?? await page.evaluate(async () => (await fetch('/pdfapi/api/billing/offer')).json());
  check(o2?.freeTier?.limited === true && o2.enabled === true, 'Angebot meldet freeTier.limited: true', JSON.stringify(o2?.freeTier));
  await startLocal(page);
  let pdfStatus = 0;
  page.on('response', r => { if (/\/api\/pdf(\?|$)/.test(r.url())) pdfStatus = r.status(); });
  const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await page.locator('.ui-split button').first().click();
  const d = await dl;
  const file = d ? await d.path().catch(() => null) : null;
  const body = file ? readFileSync(file) : Buffer.alloc(0);
  check(pdfStatus === 200 && body.subarray(0, 5).toString() === '%PDF-' && body.length > 10_000, 'echtes PDF ohne Konto', `${pdfStatus} ${d?.suggestedFilename()} ${Math.round(body.length / 1024)} KB`);
  await openMenu(page);
  await menuItem(page, 'Word – ATS-Fassung').click();
  check(await unlockOpen(page) === 'docx' && downloads(page, '.docx') === 0, 'Word ohne Konto gesperrt');
  await closeUnlock(page);
  await ctx.close();
  // Admin angemeldet: alles frei.
  ({ ctx, page } = await open({}));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const login = await page.evaluate(async ([u, p]) => (await fetch('/pdfapi/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) })).status, [ADMIN_USER, ADMIN_PASS]);
  await page.evaluate(() => localStorage.removeItem('appstudio-demo-mode'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (await page.locator('button', { hasText: 'Neuer Lebenslauf' }).count()) {
    await page.locator('button', { hasText: 'Neuer Lebenslauf' }).first().click();
    await page.locator('input[placeholder="z. B. Bewerbung Stadtwerke"]').fill(`Admin ${Date.now() % 10000}`);
    await page.getByRole('button', { name: /Profil anlegen/ }).click();
    await page.waitForTimeout(1500);
  }
  await openMenu(page);
  const locks = await page.locator('.ui-menu-item [data-lock]').count();
  await menuItem(page, 'Word – ATS-Fassung').click();
  await page.waitForTimeout(2000);
  check(login === 200 && locks === 0 && downloads(page, '.docx') === 1, 'Admin: Word lädt (live)', `login=${login} locks=${locks}`);
  await ctx.close();
}

await browser.close();
check(errors.length === 0, 'keine Laufzeitfehler', errors.slice(0, 3).join(' | '));
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} Prüfungen bestanden`);
process.exit(ok === results.length ? 0 : 1);
