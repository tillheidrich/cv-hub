// ATS-Fassung als PDF auf einen Klick — einmal echt durchgeklickt.
//
// Was „PDF – ATS-Fassung" verspricht (Runde 3, 09.10.2026):
//   1. derselbe Inhalt wie in der gewählten Vorlage — alle Abschnitte, jede
//      Station, jeder Stichpunkt, jede Fähigkeit, jede Sprache,
//   2. gesetzt in einer EINSPALTIGEN Vorlage (keine Seitenspalte, ein
//      Hauptbereich je Seite, alle Blöcke auf einer gemeinsamen Achse),
//   3. ohne die Vorlage im Profil zu ändern,
//   4. über den normalen PDF-Weg (POST /api/pdf, Dateiname mit „-ATS").
//
// Geprüft wird mit einer zweispaltigen Ausgangsvorlage (Hamburg) — sonst
// bewiese der Lauf nichts. Die Anfrage an den PDF-Dienst wird abgefangen; ihr
// HTML wird hier mit Chromium zu PDF gedruckt (wie in pdfcheck.mjs) und mit
// pdftotext gelesen: geprüft wird die Textebene, die ein Parser bekommt.
//
//   node scripts/atspdfcheck.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = join(tmpdir(), 'cv-atspdfcheck');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: EXEC });
const ctx = await browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
const results = [];
const check = (ok, label, detail = '') => { results.push(ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };

const profiles = async () => {
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('cv-hub-local'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const recs = await new Promise((res, rej) => { const q = db.transaction('profiles').objectStore('profiles').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    db.close();
    return recs.map(r => JSON.parse(r.json));
  });
};

const requests = [];
await page.route('**/api/pdf', async route => {
  requests.push(JSON.parse(route.request().postData() || '{}'));
  await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n' + 'x'.repeat(2000) + '\n%%EOF' });
});

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise(res => { const r = indexedDB.deleteDatabase('cv-hub-local'); r.onsuccess = r.onerror = r.onblocked = () => res(); });
});
await page.reload({ waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Direkt ausprobieren' }).first().click();
await page.waitForTimeout(1500);

// Zweispaltige Vorlage wählen (Gestaltung → Karte „Hamburg").
const designOpen = await page.locator('#ui-panel').count();
if (!designOpen) await page.getByRole('button', { name: 'Gestaltung', exact: true }).first().click();
await page.getByRole('radio', { name: /^Hamburg,/ }).first().click();
await page.waitForTimeout(1500);
let ps = await profiles();
check(ps[0]?.settings.template === 'hamburg', 'Ausgangsvorlage ist zweispaltig (Hamburg)', ps[0]?.settings.template);

/** Ein Durchgang: Menü → „PDF – ATS-Fassung" → Anfrage prüfen → drucken → lesen. */
async function durchlauf(vorlage, mitFoto) {
  console.log(`\n— ATS-PDF ${mitFoto ? 'mit' : 'ohne'} Foto, erwartet: ${vorlage}`);
  const vorher = requests.length;
  let ps;
  // Ein Klick im Export-Menü: „PDF – ATS-Fassung".
  await page.locator('.ui-split button[aria-haspopup="menu"]').first().click();
  await page.waitForTimeout(300);
  const item = page.getByRole('menuitem', { name: /PDF – ATS-Fassung/ }).first();
  check(await item.count() > 0, 'Menüpunkt „PDF – ATS-Fassung" unter „Für Bewerbungsportale"');
  await item.click();
  for (let i = 0; i < 60 && requests.length === vorher; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(800);
  check(requests.length === vorher + 1, 'genau eine Anfrage an den PDF-Dienst', String(requests.length - vorher));
  const req = requests[requests.length - 1] || {};
  check(/-ATS\.pdf$/.test(req.filename || ''), 'Dateiname mit „-ATS"', req.filename);
  const fertig = page.getByRole('status').filter({ hasText: new RegExp(`ATS-PDF fertig \\(${vorlage}\\)`) });
  await fertig.first().waitFor({ timeout: 5000 }).catch(() => {});
  const status = await fertig.count();
  const statusTexte = status ? '' : (await page.getByRole('status').allInnerTexts()).filter(Boolean).join(' | ').slice(0, 160);
  check(status > 0, `Rückmeldung „ATS-PDF fertig (${vorlage})" sichtbar`, statusTexte);
  check(!mitFoto || /src="data:image\//.test(req.html || ''), 'Foto eingebettet', mitFoto ? '' : 'ohne Foto');

  ps = await profiles();
  check(ps[0]?.settings.template === 'hamburg', 'Vorlage im Profil unverändert', ps[0]?.settings.template);
  check(!(await page.locator('[data-ats-pdf-runner]').count()), 'unsichtbarer Messlauf wieder entfernt');

  // Gesetztes HTML ansehen: einspaltig?
  const html = req.html || '';
  const htmlPath = join(out, `ats-${vorlage}.html`);
  writeFileSync(htmlPath, html);
  const printer = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await printer.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await printer.evaluate(() => document.fonts.ready);
  await printer.waitForTimeout(500);
  const geo = await printer.evaluate(() => {
    const pages = [...document.querySelectorAll('.cv-page')];
    // Abschnitte im fertigen Dokument. (Die Flow-Blöcke tragen ihre Kennung nur
    // im Messlauf; im Export steht je Abschnitt `data-cv-section`.)
    const secs = [...document.querySelectorAll('[data-cv-section]')]
      .map(el => ({ s: el.getAttribute('data-cv-section'), r: el.getBoundingClientRect() }))
      .filter(x => x.r.width > 0 && x.r.height > 0);
    // Zwei VERSCHIEDENE Abschnitte nebeneinander (vertikal überlappend,
    // horizontal getrennt) gäbe es nur bei zwei Spalten.
    let sideBySide = 0, pair = '';
    for (let i = 0; i < secs.length; i++) for (let j = i + 1; j < secs.length; j++) {
      const a = secs[i], b = secs[j];
      if (a.s === b.s) continue;
      const vOverlap = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      const hApart = a.r.right <= b.r.left + 1 || b.r.right <= a.r.left + 1;
      if (vOverlap > 2 && hApart) { sideBySide++; pair = `${a.s} | ${b.s}`; }
    }
    /* Text, der neben dem Abschnittsfluss steht: alles, was zu keinem
     * Abschnitt gehört und nicht im Kopf über dem ersten Abschnitt der Seite
     * liegt. Bei zweispaltigen Vorlagen ist das die Seitenspalte (Kontakt,
     * Fähigkeiten, Sprachen) — die Gegenprobe mit „Hamburg" schlägt hier an. */
    let stray = 0, strayText = '';
    for (const pg of pages) {
      const tops = [...pg.querySelectorAll('[data-cv-section]')].map(el => el.getBoundingClientRect().top);
      if (!tops.length) continue;
      const first = Math.min(...tops);
      const walk = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (!t || n.parentElement.closest('[data-cv-section]')) continue;
        const rg = document.createRange(); rg.selectNodeContents(n);
        const r = rg.getBoundingClientRect();
        if (!r.height || r.bottom <= first + 1) continue;
        stray++; if (!strayText) strayText = t.slice(0, 40);
      }
    }
    const lefts = secs.map(x => Math.round(x.r.left));
    return {
      pages: pages.length,
      asides: document.querySelectorAll('[data-cv-aside], aside').length,
      sections: [...new Set(secs.map(x => x.s))],
      sideBySide, pair, stray, strayText,
      leftSpread: lefts.length ? Math.max(...lefts) - Math.min(...lefts) : 0,
    };
  });
  check(geo.sections.length >= 4, 'ATS-PDF enthält die Abschnitte', geo.sections.join(', '));
  check(geo.asides === 0, 'keine Seitenspalte im ATS-PDF', String(geo.asides));
  check(geo.sideBySide === 0, 'keine zwei Abschnitte nebeneinander (einspaltig)', geo.pair);
  check(geo.stray === 0, 'kein Text neben dem Abschnittsfluss (keine Seitenspalte)', geo.stray ? `${geo.stray}× z. B. „${geo.strayText}"` : '');
  check(geo.leftSpread <= 4, 'alle Abschnitte auf einer linken Kante', `${geo.leftSpread}px`);

  const pdfPath = join(out, `ats-${vorlage}.pdf`);
  await printer.pdf({ path: pdfPath, format: req.pageFormat === 'letter' ? 'Letter' : 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const text = execFileSync('pdftotext', ['-raw', pdfPath, '-'], { encoding: 'utf8' });
  /* Zeilenumbrüche im PDF trennen auch an Bindestrichen („E-↵Commerce") —
   * beidseitig gleich behandelt, damit die Suche nicht daran scheitert. */
  const norm = t => String(t).replace(/\s+/g, ' ').replace(/- /g, '-').trim().toLowerCase();
  const flat = norm(text);
  const has = s => flat.includes(norm(s));

  // Alles, was im Profil steht, muss in der Textebene stehen.
  const cv = ps[0].data[ps[0].settings.lang];
  const fehlend = [];
  const soll = [
    cv.personal.name, cv.personal.title, cv.personal.email,
    cv.labels.sections.profile, cv.labels.sections.experience, cv.labels.sections.education, cv.labels.sections.languages,
    cv.profile.text.slice(0, 40),
    ...cv.experience.flatMap(e => [e.role, e.company, ...e.bullets.map(b => b.slice(0, 35))]),
    ...cv.education.flatMap(e => [e.degree, e.institution]),
    ...cv.skillGroups.flatMap(g => [g.label, ...g.items]),
    ...cv.languages.map(l => l.language),
    ...(cv.additionalExperience || []),
  ].filter(Boolean);
  for (const s of soll) if (!has(s)) fehlend.push(s);
  check(fehlend.length === 0, `alle Abschnitte und Einträge in der Textebene (${soll.length} Stellen)`, fehlend.slice(0, 4).join(' | '));
  check(flat.startsWith(norm(cv.personal.name)), 'Textebene beginnt mit dem Namen');
  const order = [cv.labels.sections.experience, cv.labels.sections.education].map(s => flat.indexOf(norm(s)));
  check(order[0] >= 0 && order[0] < order[1], 'Berufserfahrung vor Ausbildung in der Lesereihenfolge');

  await printer.close();
}

await durchlauf('Zürich', false);

// Mit Foto: die ATS-Vorlage mit Fotofeld (Schiefer).
if (!(await page.locator('#ui-panel').count()) || !(await page.getByRole('button', { name: 'Persönlich' }).count())) {
  await page.getByRole('button', { name: 'Inhalt', exact: true }).first().click();
}
await page.getByRole('button', { name: 'Persönlich' }).first().click().catch(() => {});
const jpeg = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 600; c.height = 800;
  const g = c.getContext('2d'); g.fillStyle = '#7a9'; g.fillRect(0, 0, 600, 800);
  return c.toDataURL('image/jpeg', 0.9).split(',')[1];
});
await page.locator('input[type=file][accept="image/jpeg,image/png,image/webp"]').setInputFiles({ name: 'foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
await page.getByRole('button', { name: 'Übernehmen' }).click();
await page.waitForTimeout(1500);
await durchlauf('Schiefer', true);

check(errors.length === 0, 'keine Laufzeitfehler', errors.join(' | '));
await browser.close();
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed}/${results.length} Schritte bestanden`);
if (failed) process.exitCode = 1;
