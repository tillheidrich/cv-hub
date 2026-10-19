// Tipps (knowledge/*): vier Sprachen, Belege, Kontext, Checkliste, Barrierefreiheit.
//
// Befund vor dem 10.10.2026: Die Tipps waren nur deutsch, auch in einer
// englischen, französischen oder spanischen Oberfläche, und einige Prompts
// versprachen Unbelegtes („schneller eingestellt als 95 % der Bewerber").
// Geprüft wird:
//
//   A. Inhalte (Module über den Vite-Server): vier Fassungen mit denselben
//      Tipps, Ländern, Checklistenpunkten und Prompts in derselben Reihenfolge;
//      jede Fassung wirklich übersetzt (Titel unterscheiden sich vom
//      Deutschen); jede Quelle vorhanden und https; jeder Magazin-Verweis
//      zeigt auf einen vorhandenen Artikel; keine Gedankenstriche; keine
//      Prozentzahl ohne Quelle an der Karte; Kontext-Regeln in beide
//      Richtungen.
//   B. Oberfläche je Sprache: Reiter beschriftet, erste Karte aus der
//      richtigen Fassung, „Weiterlesen" zeigt Belege und Vorher/Nachher,
//      Länder (5), Checkliste merkt sich Häkchen über einen Neuladen, Prompt
//      lässt sich kopieren, keine deutschen Oberflächenwörter in anderen
//      Sprachen.
//   C. axe (WCAG 2.2 AA) auf jedem Reiter und auf den neuen Zuständen der
//      Prüfung (Anschreiben, Stellenanzeige, Stil, Beides, Pass-Hinweis).
//   D. Telefon (390 px): Tipps unter „Prüfen", ohne waagerechtes Scrollen.
//
//   HARNESS_BASE=http://localhost:5263 [SHOTS=/ordner] node scripts/tippscheck.mjs
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5263';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.env.SHOTS || '';
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

const results = [];
const check = (ok, label, detail = '') => { results.push(!!ok); console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`); };
const step = t => console.log(`\n— ${t}`);
const errors = [];
const browser = await chromium.launch({ executablePath: EXEC });
const LANGS = ['de', 'en', 'fr', 'es'];
const DEMO = /Demo ausprobieren|Demo starten|Direkt ausprobieren|Try the demo|Essayer maintenant|Probar ahora|Essayer la démo|Probar la demo/i;

async function open({ lang = 'de', viewport = { width: 1440, height: 900 }, mobile = false, offer = null } = {}) {
  const ctx = await browser.newContext({ viewport, locale: lang === 'de' ? 'de-DE' : lang, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`Seitenfehler (${lang}): ${String(e).slice(0, 200)}`));
  await page.addInitScript(l => { try { if (!sessionStorage.getItem('tc-init')) { localStorage.setItem('appstudio-ui-lang', l); localStorage.removeItem('cv-tipps-tab'); localStorage.removeItem('cv-check-doc'); sessionStorage.setItem('tc-init', '1'); } } catch { /* */ } }, lang);
  await page.route('**/pdfapi/**', route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/pdfapi/, '');
    if (path === '/api/billing/offer' && offer) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(offer) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  return { ctx, page };
}
async function startDemo(page) {
  await page.locator('button, a').filter({ hasText: DEMO }).first().click();
  await page.waitForTimeout(1500);
}

async function axe(page, name) {
  await page.evaluate(AXE);
  const res = await page.evaluate(async () => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }));
  // Wie axecheck.mjs: Textstellen im Dokument sind Inline-Ziele (WCAG 2.5.8, Ausnahme „Inline").
  const v = res.violations.map(x => x.id === 'target-size' ? { ...x, nodes: x.nodes.filter(n => !n.target.join(' ').includes('cv-edit')) } : x).filter(x => x.nodes.length);
  check(v.length === 0, `axe: ${name}`, v.map(x => `${x.id} (${x.nodes.length}) ${x.nodes[0]?.target?.join(' ')}`).join(' | '));
}

// ── A. Inhalte ─────────────────────────────────────────────────────────────
step('A. Inhalte');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async langs => {
    const src = await import('/src/knowledge/sources.ts');
    const mag = await import('/src/knowledge/magazin.ts');
    const ctxm = await import('/src/knowledge/context.ts');
    const st = await import('/src/data/storage.ts');
    const c = {};
    for (const l of langs) c[l] = (await import(`/src/knowledge/content/${l}.ts`)).default;
    const shape = x => JSON.stringify({
      cv: x.cv.map(t => [t.id, !!t.before, (t.sources || []).join(), (t.magazin || []).join()]),
      letter: x.letter.map(t => [t.id, !!t.before, (t.sources || []).join(), (t.magazin || []).join()]),
      countries: x.countries.map(k => [k.code, k.rows.length, k.sources.join()]),
      checklist: x.checklist.map(i => i.id), prompts: x.prompts.map(p => [p.id, !!p.note]),
    });
    const all = x => JSON.stringify(x);
    const sourceIds = new Set(Object.keys(src.SOURCES));
    const used = new Set();
    const slugs = new Set();
    for (const l of langs) {
      for (const t of [...c[l].cv, ...c[l].letter]) { (t.sources || []).forEach(s => used.add(s)); (t.magazin || []).forEach(s => slugs.add(s)); }
      for (const k of c[l].countries) k.sources.forEach(s => used.add(s));
    }
    const titlesSame = l => [...c[l].cv, ...c[l].letter].filter((t, i) => t.title === [...c.de.cv, ...c.de.letter][i].title).map(t => t.id);
    const dashes = Object.fromEntries(langs.map(l => [l, (all(c[l]).match(/[—–]/g) || []).length]));
    // Prozentzahlen nur an Karten mit Quelle
    const pctNoSource = langs.flatMap(l => [...c[l].cv, ...c[l].letter].filter(t => /\d\s?%/.test(t.body) && !(t.sources || []).length).map(t => `${l}:${t.id}`));
    // Kontextregeln
    const demo = st.createDemoProfile('Demo');
    const cv = demo.data.de;
    const h = (d, cl, dt) => ctxm.contextHints(d, cl, dt).map(x => `${x.tip}:${x.reason}`);
    const none = h(cv, undefined, 'resume');
    const noProfile = h({ ...cv, profile: { text: '' } }, undefined, 'resume');
    const noNums = h({ ...cv, experience: cv.experience.map(e => ({ ...e, bullets: (e.bullets || []).map(b => b.replace(/\d+/g, 'viele')) })) }, undefined, 'resume');
    const gap = h({ ...cv, experience: [{ ...cv.experience[0], start: '01/2024', end: 'heute' }, { ...cv.experience[1], start: '01/2020', end: '03/2022' }] }, undefined, 'resume');
    const intl = h({ ...demo.data.en, personal: { ...demo.data.en.personal, photo: 'data:image/png;base64,AAAA' } }, undefined, 'resume');
    const cover = h(cv, st.DEFAULT_COVER_LETTERS.de, 'cover');
    const coverOwn = h(cv, { ...st.DEFAULT_COVER_LETTERS.de, intro: 'Sie suchen jemanden für die Wartungsplanung.', mainBody: 'Eigener Text.', companyReference: 'Eigener Text zur Firma.', motivation: 'Eigene Motivation.', closing: 'Ich freue mich auf das Gespräch.' }, 'cover');
    return {
      shapes: langs.map(l => shape(c[l])), titlesSame: Object.fromEntries(langs.slice(1).map(l => [l, titlesSame(l)])),
      missingSources: [...used].filter(s => !sourceIds.has(s)), badUrls: Object.values(src.SOURCES).filter(s => !/^https:\/\//.test(s.url)).map(s => s.url),
      slugs: [...slugs], magTitles: mag.MAGAZIN, magBase: mag.MAGAZIN_BASE, magUrl: mag.magazinUrl([...slugs][0]), dashes, pctNoSource,
      counts: Object.fromEntries(langs.map(l => [l, [c[l].cv.length, c[l].letter.length, c[l].countries.length, c[l].checklist.length, c[l].prompts.length]])),
      none, noProfile, noNums, gap, intl, cover, coverOwn,
    };
  }, LANGS);

  check(r.shapes.every(s => s === r.shapes[0]), 'Vier Fassungen gleich aufgebaut (Tipps, Belege, Länder, Checkliste, Prompts)', JSON.stringify(r.counts.de));
  for (const l of ['en', 'fr', 'es']) check(r.titlesSame[l].length === 0, `${l}: alle Titel übersetzt`, r.titlesSame[l].join(','));
  check(r.missingSources.length === 0, 'Jede verwendete Quelle ist hinterlegt', r.missingSources.join(','));
  check(r.badUrls.length === 0, 'Alle Quellen über https', r.badUrls.join(' '));
  const missingArticles = r.slugs.filter(s => !existsSync(`content/ratgeber/${s}.md`) && !existsSync(`content/magazin/${s}.md`));
  check(r.slugs.length > 0 && missingArticles.length === 0, `Magazin-Verweise zeigen auf vorhandene Artikel (${r.slugs.length})`, missingArticles.join(','));
  const titleOf = slug => { for (const dir of ['content/magazin', 'content/ratgeber']) { const f = `${dir}/${slug}.md`; if (existsSync(f)) return (readFileSync(f, 'utf8').match(/^title:\s*"(.*)"\s*$/m) || [])[1] || null; } return null; };
  const drift = Object.entries(r.magTitles).filter(([slug, t]) => titleOf(slug) !== t).map(([slug]) => slug);
  check(drift.length === 0, `Magazin-Titel in den Tipps = Titel der Artikel (${Object.keys(r.magTitles).length})`, drift.join(','));
  check(r.magBase === '/magazin/' && r.magUrl.startsWith('/magazin/') && r.magUrl.endsWith('/'), 'Magazin-Pfad relativ unter /magazin/<slug>/', r.magUrl);
  check(Object.values(r.dashes).every(n => n === 0), 'Keine Gedankenstriche in den Tipps', JSON.stringify(r.dashes));
  check(r.pctNoSource.length === 0, 'Prozentzahlen nur an Karten mit Quelle', r.pctNoSource.join(','));
  check(r.none.length === 0, 'Kontext: Demo ohne Lücken → keine Hinweise', r.none.join(','));
  check(r.noProfile.includes('profile:no-profile'), 'Kontext: ohne Profil → Profil-Tipp');
  check(r.noNums.includes('impact:no-numbers'), 'Kontext: keine Zahl in den Punkten → Ergebnis-Tipp', r.noNums.join(','));
  check(r.gap.includes('gaps:gap'), 'Kontext: Lücke über sechs Monate → Lücken-Tipp', r.gap.join(','));
  check(r.intl.includes('photo:intl-photo'), 'Kontext: englischer Lebenslauf mit Foto → Foto-Tipp', r.intl.join(','));
  check(r.cover.includes('letter-opening:cover-sample') && r.cover.includes('letter-structure:cover-open'), 'Kontext: Anschreiben mit Mustertext → Einstieg + Aufbau', r.cover.join(','));
  check(!r.coverOwn.some(x => x.startsWith('letter-opening')), 'Kontext: eigenes Anschreiben ohne Formel → kein Einstiegs-Hinweis', r.coverOwn.join(','));
  await ctx.close();
}

// ── B. Oberfläche je Sprache ───────────────────────────────────────────────
const TAB_LABELS = {
  de: ['Lebenslauf', 'Anschreiben', 'Länder', 'Checkliste', 'Prompts'],
  en: ['CV', 'Cover letter', 'Countries', 'Checklist', 'Prompts'],
  fr: ['CV', 'Lettre', 'Pays', 'Check-list', 'Prompts'],
  es: ['CV', 'Carta', 'Países', 'Lista', 'Prompts'],
};
const GERMAN_UI = /\b(Weiterlesen|Belege|Vorher|Nachher|Kopieren|geprüft|Zurücksetzen|erledigt)\b/;
for (const lang of LANGS) {
  step(`B. Oberfläche ${lang}`);
  const { ctx, page } = await open({ lang });
  await startDemo(page);
  await page.locator('nav.ui-rail > button:not([data-rail-import])').nth(3).click();
  await page.waitForSelector('[data-tipps] [data-tip]');
  const tabs = await page.locator('[data-tipps] [role="tab"]').allInnerTexts();
  check(JSON.stringify(tabs) === JSON.stringify(TAB_LABELS[lang]), `${lang}: Reiter`, tabs.join(' · '));
  const expected = await page.evaluate(async l => (await import(`/src/knowledge/content/${l}.ts`)).default.cv[0].title, lang);
  const first = await page.locator('[data-tip] h3').first().innerText();
  check(first === expected, `${lang}: erste Karte aus der eigenen Fassung`, first);
  await page.locator('[data-tip="impact"] .tp-more').click();
  const card = page.locator('[data-tip="impact"]');
  check(await card.locator('.tp-meta a[href^="https://"]').count() >= 2 && await card.locator('.tp-ba-after').count() === 1, `${lang}: Weiterlesen zeigt Belege und Vorher/Nachher`);
  if (lang !== 'de') {
    const txt = await page.locator('[data-tipps]').innerText();
    const m = txt.match(GERMAN_UI);
    check(!m, `${lang}: keine deutschen Bedienwörter`, m ? m[0] : '');
  }
  if (SHOTS && (lang === 'de' || lang === 'en')) await page.screenshot({ path: `${SHOTS}/tipps-${lang}-1440.png` });
  await axe(page, `Tipps · Lebenslauf (${lang})`);
  await page.click('[data-tip-tab="letter"]');
  await page.locator('[data-tip="letter-opening"] .tp-more').click();
  check(await page.locator('[data-tip="letter-opening"] .tp-ba-before').count() === 1, `${lang}: Anschreiben-Tipps mit Vorher/Nachher`);
  await page.click('[data-tip-tab="countries"]');
  const countries = await page.locator('[data-country]').count();
  check(countries === 5, `${lang}: fünf Länder`, String(countries));
  if (SHOTS && lang === 'de') await page.screenshot({ path: `${SHOTS}/tipps-laender-1440.png` });
  await axe(page, `Tipps · Länder (${lang})`);
  await page.click('[data-tip-tab="checklist"]');
  const checks = page.locator('[data-check] input');
  await checks.nth(0).check(); await checks.nth(3).check();
  const prog = await page.locator('[data-checklist-progress]').innerText();
  check(/2\D+12/.test(prog), `${lang}: Checkliste zählt mit`, prog);
  await axe(page, `Tipps · Checkliste (${lang})`);
  if (lang === 'de') {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const railBtn = page.locator('nav.ui-rail > button:not([data-rail-import])').nth(3);
    if ((await railBtn.getAttribute('aria-expanded')) !== 'true') await railBtn.click();
    await page.waitForSelector('[data-checklist-progress]', { timeout: 8000 }).catch(() => {});
    const after = await page.locator('[data-checklist-progress]').innerText().catch(() => '');
    check(/2\D+12/.test(after), 'Checkliste und Reiter überstehen das Neuladen (nur dieser Browser)', after);
  }
  await page.click('[data-tip-tab="prompts"]');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  await page.locator('[data-prompt] .tp-copy').first().click();
  await page.waitForTimeout(200);
  check((await page.locator('[data-prompt] .tp-copy').first().getAttribute('data-copied')) === 'true', `${lang}: Prompt kopiert`);
  const promptsTxt = await page.locator('[data-tipps]').innerText();
  check(!/95\s?%/.test(promptsTxt), `${lang}: kein unbelegtes „95 %" mehr`);
  await axe(page, `Tipps · Prompts (${lang})`);
  await ctx.close();
}

// ── C. axe auf den neuen Zuständen der Prüfung ─────────────────────────────
step('C. axe: Prüfen');
{
  const { ctx, page } = await open();
  await startDemo(page);
  await page.locator('nav.ui-rail > button:not([data-rail-import])').nth(2).click();
  await page.click('[data-check-docs] [data-doc="cover"]');
  await page.waitForSelector('[data-cover-summary] .ck-open');
  await page.waitForTimeout(600);
  await axe(page, 'Prüfen · Anschreiben (Kurzfassung)');
  await page.click('[data-cover-summary] .ck-open');
  await page.waitForSelector('[data-check-dialog]');
  await page.locator('.ck-passed > summary').first().click();
  await axe(page, 'Dialog · Anschreiben · Textansicht');
  await page.click('[data-tab="job"]');
  await page.fill('#ck-jd-cover', 'Senior Product Designer (m/w/d)\n\nDie Nordlicht Software GmbH sucht Verstärkung mit Figma, Design Systems und Accessibility. Ansprechpartnerin: Frau Jana Albers.');
  await page.waitForTimeout(300);
  await axe(page, 'Dialog · Anschreiben · Stellenanzeige');
  await page.click('[data-tab="style"]');
  await axe(page, 'Dialog · Anschreiben · Stil');
  await page.click('[data-check-dialog] [data-doc="both"]');
  await page.waitForSelector('[data-both-terms]');
  await axe(page, 'Dialog · Beides');
  await page.click('[data-check-dialog] [data-doc="resume"]');
  await page.click('[data-tab="job"]');
  await page.waitForTimeout(300);
  await axe(page, 'Dialog · Lebenslauf · Stellenanzeige');
  await page.keyboard.press('Escape');
  await page.click('[data-check-docs] [data-doc="both"]');
  await page.waitForSelector('[data-both-summary]');
  await axe(page, 'Prüfen · Beides (Kurzfassung)');
  await ctx.close();
  const l = await open({ offer: { enabled: true, sku: 'pass90', priceCents: 900, currency: 'EUR', days: 90, vatNote: '', productName: '', features: [], openRegistration: true, freeTier: { limited: true } } });
  await startDemo(l.page);
  await l.page.locator('nav.ui-rail > button:not([data-rail-import])').nth(2).click();
  await l.page.click('[data-check-docs] [data-doc="cover"]');
  await l.page.waitForSelector('[data-cover-locked]');
  await axe(l.page, 'Prüfen · Anschreiben ohne Pass');
  await l.ctx.close();
}

// ── D. Telefon ─────────────────────────────────────────────────────────────
step('D. Telefon 390 px');
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, mobile: true });
  await startDemo(page);
  const bar = page.locator('nav.ui-bottom-bar > button');
  const n = await bar.count();
  let opened = false;
  for (let i = 0; i < n && !opened; i++) {
    const label = await bar.nth(i).innerText();
    if (/Prüfen/.test(label)) { await bar.nth(i).click(); opened = true; }
  }
  check(opened, 'Telefon: „Prüfen" in der unteren Leiste');
  await page.waitForTimeout(800);
  check(await page.locator('[data-tipps]').count() === 1, 'Telefon: Tipps stehen unter „Prüfen"');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 0, 'Telefon: kein waagerechtes Scrollen (Prüfen + Tipps)', `${wide} px`);
  await page.click('[data-check-docs] [data-doc="cover"]');
  await page.waitForSelector('[data-cover-summary] .ck-open');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/pruefen-anschreiben-390.png` });
  await page.click('[data-cover-summary] .ck-open');
  await page.waitForSelector('[data-check-dialog]');
  await page.waitForTimeout(450); // Einblendung (scale 0,985 → 1) abwarten
  const dlg = await page.locator('[data-check-dialog]').boundingBox();
  check(dlg && Math.round(dlg.width) === 390, 'Telefon: Dialog füllt die Breite', dlg ? `${Math.round(dlg.width)} px` : '');
  const wide2 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide2 <= 0, 'Telefon: Dialog ohne waagerechtes Scrollen', `${wide2} px`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dialog-anschreiben-390.png` });
  await page.click('[data-tab="style"]');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dialog-stil-390.png` });
  await page.locator('.ck-close').click();
  await page.locator('[data-tipps] [data-tip-tab="countries"]').click();
  await page.locator('[data-country="UK"]').scrollIntoViewIfNeeded();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/tipps-laender-390.png` });
  const wide3 = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide3 <= 0, 'Telefon: Länder ohne waagerechtes Scrollen', `${wide3} px`);
  await ctx.close();
}

await browser.close();
if (errors.length) { console.log('\nSeitenfehler:'); errors.forEach(e => console.log(' · ' + e)); }
const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} bestanden${errors.length ? `, ${errors.length} Seitenfehler` : ''}`);
process.exit(ok === results.length && !errors.length ? 0 : 1);
