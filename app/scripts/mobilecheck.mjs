// Prüft die App auf Telefonbreite — im Demo-Modus, also ohne Anmeldung.
//
// Geprüft wird das, was auf einem kleinen Bildschirm tatsächlich schiefgeht:
// waagerechter Überlauf, zu kleine Tippziele, ein Dokument, das nicht auf die
// Breite skaliert wird, und Ausnahmen in den drei Bereichen Bearbeiten,
// Vorschau und Export. Der Umbruch-Prüfstand kann das nicht sehen: dort gibt
// es keine Bereichsumschaltung und keine Kopfleiste.
//
//   node scripts/mobilecheck.mjs            → 390 px (iPhone-Klasse)
//   node scripts/mobilecheck.mjs 360        → schmaler
import { chromium } from 'playwright';

const width = Number(process.argv[2] || 390);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 140)));

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.click('text=/Try the demo|Demo ausprobieren|Demo starten/');
await page.waitForTimeout(2200);

const problems = [];

/** Läuft etwas über den rechten Rand, ohne in einem scrollbaren Kasten zu sitzen? */
async function overflow(label) {
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.right <= window.innerWidth + 2) return;
      if (getComputedStyle(el).position === 'fixed') return;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return;
      }
      out.push(`${el.tagName} bis ${Math.round(r.right)} px: „${(el.textContent || '').trim().slice(0, 24)}"`);
    });
    return [...new Set(out)].slice(0, 5);
  });
  bad.forEach(b => problems.push(`${label}: ragt über den Rand — ${b}`));
  const doc = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (doc > 2) problems.push(`${label}: die Seite selbst scrollt waagerecht (${doc} px zu breit)`);
}

const tab = async (i) => { await page.locator('nav button').nth(i).click(); await page.waitForTimeout(2200); };

await overflow('Bearbeiten');
await tab(1);
await overflow('Vorschau');

// Wird das Dokument auf die Bildschirmbreite skaliert?
const fit = await page.evaluate(() => {
  const w = document.querySelector('.cv-scale-wrapper');
  const pg = document.querySelector('.cv-scale-wrapper .cv-page');
  if (!w || !pg) return null;
  const r = pg.getBoundingClientRect();
  return { breite: Math.round(r.width), fenster: window.innerWidth, transform: getComputedStyle(w).transform };
});
if (!fit) problems.push('Vorschau: keine Seite gerendert');
else if (fit.breite > fit.fenster) problems.push(`Vorschau: Seite ${fit.breite} px breit bei ${fit.fenster} px Bildschirm — nicht skaliert`);

// Passt der Inhalt in die Seite, oder wird er unten abgeschnitten?
const clip = await page.evaluate(() => {
  const pg = document.querySelector('.cv-scale-wrapper .cv-page');
  if (!pg) return 0;
  const pr = pg.getBoundingClientRect();
  let worst = 0;
  pg.querySelectorAll('[data-cv-section]').forEach(el => {
    worst = Math.max(worst, el.getBoundingClientRect().bottom - pr.bottom);
  });
  return Math.round(worst);
});
if (clip > 1) problems.push(`Vorschau: Inhalt ragt ${clip} px unter die Seitenkante — wird abgeschnitten`);

// Leerlauf im Bildlauf: `transform: scale()` verkleinert die Darstellung, nicht
// die Layout-Maße. Wird das nicht abgefangen, lässt sich die Vorschau über
// hunderte Pixel Nichts nach unten ziehen.
const leerlauf = await page.evaluate(() => {
  const w = document.querySelector('.cv-scale-wrapper');
  if (!w) return null;
  let el = w.parentElement;
  while (el && getComputedStyle(el).overflowY !== 'auto') el = el.parentElement;
  if (!el) return null;
  const seiten = [...document.querySelectorAll('.cv-scale-wrapper .cv-page')];
  const unten = Math.max(...seiten.map(p => p.getBoundingClientRect().bottom));
  const oben = el.getBoundingClientRect().top - el.scrollTop;
  const gebraucht = (unten - oben) + parseFloat(getComputedStyle(el).paddingBottom || '0');
  // Ein Kasten ist nie kleiner als sein Sichtfenster — das ist kein Leerlauf.
  return Math.round(el.scrollHeight - Math.max(el.clientHeight, gebraucht));
});
if (leerlauf !== null && leerlauf > 120)
  problems.push(`Vorschau: ${leerlauf} px leerer Bildlauf unter dem Dokument`);

// Ist die Bereichsleiste vollständig sichtbar, und kommt man an das letzte
// Formularfeld heran? Das war der Befund vom 12.09.: `100vh` ist in iOS Safari
// die große Ansichtshöhe, die untersten rund 50 px lagen hinter der
// Browserleiste — und damit genau die Bereichsleiste.
await tab(0);
const chrome = await page.evaluate(async () => {
  const nav = document.querySelector('nav');
  if (!nav) return { fehler: 'keine Bereichsleiste' };
  const nr = nav.getBoundingClientRect();
  const shell = document.querySelector('.cv-app-shell');
  const sr = shell ? shell.getBoundingClientRect() : null;
  // Letztes Feld im Bearbeiten-Bereich ansteuern
  const area = [...document.querySelectorAll('div')].find(d => {
    const cs = getComputedStyle(d);
    return cs.overflowY === 'auto' && d.querySelector('input, textarea');
  });
  let feldUnten = null;
  if (area) {
    area.scrollTop = area.scrollHeight;
    await new Promise(r => setTimeout(r, 250));
    const felder = [...area.querySelectorAll('input, textarea')];
    const last = felder[felder.length - 1];
    if (last) feldUnten = Math.round(last.getBoundingClientRect().bottom);
  }
  return {
    navUnten: Math.round(nr.bottom), navOben: Math.round(nr.top),
    fenster: window.innerHeight,
    shellUnten: sr ? Math.round(sr.bottom) : null,
    feldUnten,
  };
});
if (process.env.VERBOSE) console.log('   · Rahmen:', JSON.stringify(chrome));
if (chrome.fehler) problems.push(`Bereichsleiste: ${chrome.fehler}`);
else {
  if (chrome.navUnten > chrome.fenster + 1)
    problems.push(`Bereichsleiste endet bei ${chrome.navUnten} px, Fenster ist ${chrome.fenster} px hoch — sie liegt unter dem sichtbaren Bereich`);
  if (chrome.shellUnten !== null && chrome.shellUnten > chrome.fenster + 1)
    problems.push(`App-Rahmen ist ${chrome.shellUnten - chrome.fenster} px höher als das Fenster`);
  if (chrome.feldUnten !== null && chrome.feldUnten > chrome.navOben + 1)
    problems.push(`letztes Formularfeld endet bei ${chrome.feldUnten} px, die Bereichsleiste beginnt bei ${chrome.navOben} px — es liegt darunter`);
}

// Schreiben im Dokument: hineintippen, zoomen, tippen, verlassen — und
// nachsehen, ob der Text im Dokument steht.
await tab(1);
const fitScaleErwartet = Math.min(1, (width - 24 - 24) / 793.7);
const feld = page.locator('.cv-scale-wrapper [data-cv-edit]').first();
if (await feld.count()) {
  const pfad = await feld.getAttribute('data-cv-edit');
  await feld.click();
  await page.waitForTimeout(700);
  const zoom = await page.evaluate(() => {
    const w = document.querySelector('.cv-scale-wrapper');
    const t = w ? getComputedStyle(w).transform : 'none';
    const aktiv = document.activeElement;
    return { transform: t, fokus: aktiv ? aktiv.getAttribute('data-cv-edit') : null };
  });
  if (process.env.VERBOSE) console.log('   · Schreiben:', pfad, JSON.stringify(zoom));
  if (zoom.fokus !== pfad) problems.push(`Schreiben: Tipp auf „${pfad}" setzt den Schreibzeiger nicht ins Feld (fokussiert: ${zoom.fokus})`);
  // Nicht „kein Transform" ist die Anforderung, sondern ein lesbarer Maßstab:
  // auf einem Tablet passt die Seite ohnehin fast in voller Größe hinein.
  const m = zoom.transform === 'none' ? 1 : Number((zoom.transform.match(/matrix\(([-\d.]+)/) || [])[1] || 1);
  if (m < 0.85) problems.push(`Schreiben: Dokument steht beim Hineintippen auf ${Math.round(m * 100)} % — darunter ist eine Textzeile keine sieben Pixel hoch`);
  await page.keyboard.type(' Prüftext');
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(1200);
  const drin = await page.evaluate(p => {
    const el = document.querySelector(`.cv-scale-wrapper [data-cv-edit="${p}"]`);
    return el ? el.textContent.includes('Prüftext') : null;
  }, pfad);
  if (drin !== true) problems.push(`Schreiben: der getippte Text steht nach dem Verlassen nicht im Dokument (${pfad})`);
  const zurueck = await page.evaluate(() => {
    const w = document.querySelector('.cv-scale-wrapper');
    return w ? getComputedStyle(w).transform : 'none';
  });
  const mz = zurueck === 'none' ? 1 : Number((zurueck.match(/matrix\(([-\d.]+)/) || [])[1] || 1);
  if (m >= 0.85 && mz < m - 0.01) { /* war nie gezoomt — nichts zu prüfen */ }
  else if (mz > 0.99 && fitScaleErwartet < 0.85) problems.push('Schreiben: nach dem Verlassen bleibt das Dokument in voller Größe — die Übersicht kommt nicht zurück');
} else {
  problems.push('Schreiben: kein beschreibbares Feld in der Vorschau gefunden');
}

// Kopfleiste: Passt alles hinein, und lassen sich die drei Auswahlblätter
// öffnen, ohne verdeckt zu werden? Befund vom 12.09.: Das Blatt „Vorlage
// wählen" lag im `<header>`, und der war ein waagerecht scrollbarer Kasten —
// WebKit begrenzt `position: fixed` darin, das Blatt war auf die Leiste
// beschnitten. Chromium tut das nicht, deshalb prüfen wir hier die Ursache
// (Scrollbreite, Portal) statt des Symptoms.
await tab(0);
const kopf = await page.evaluate(() => {
  const h = document.querySelector('header');
  return h ? { ueberhang: h.scrollWidth - h.clientWidth, rechts: Math.round(h.getBoundingClientRect().right) } : null;
});
if (!kopf) problems.push('Kopfleiste: nicht gefunden');
else if (kopf.ueberhang > 2) problems.push(`Kopfleiste scrollt waagerecht (${kopf.ueberhang} px zu breit) — Einträge liegen außerhalb des Sichtfelds`);

for (const [name, sel] of [['Vorlage', 'header button:has(span)'], ['Schrift', 'Aa'], ['Menü', '⋯']]) {
  const btn = name === 'Vorlage'
    ? page.locator('header button').filter({ hasText: /Hamburg|Wien|Genf|Lyon/ }).first()
    : page.locator('header button', { hasText: sel }).first();
  if (!(await btn.count())) { problems.push(`${name}: Schaltfläche fehlt in der Kopfleiste`); continue; }
  await btn.click();
  await page.waitForTimeout(500);
  const res = await page.evaluate(() => {
    const sh = document.querySelector('.cv-sheet');
    if (!sh) return { fehlt: true };
    const r = sh.getBoundingClientRect();
    // Unterste Zeile antippbar? Wäre das Blatt beschnitten oder überdeckt,
    // träfe der Test etwas anderes.
    const probe = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.bottom - 24));
    return {
      imHeader: !!sh.closest('header'),
      obenAb: Math.round(r.top), untenAb: Math.round(r.bottom), fenster: window.innerHeight,
      erreichbar: sh.contains(probe),
    };
  });
  if (res.fehlt) problems.push(`${name}: Blatt öffnet nicht`);
  else {
    if (res.imHeader) problems.push(`${name}: Blatt hängt in der Kopfleiste statt im Portal — WebKit beschneidet es dort`);
    if (!res.erreichbar) problems.push(`${name}: die unterste Zeile des Blatts ist verdeckt`);
    if (res.untenAb > res.fenster + 1 || res.obenAb < -1) problems.push(`${name}: Blatt liegt außerhalb des Fensters (${res.obenAb}…${res.untenAb} bei ${res.fenster} px)`);
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
}

// Dokumenttyp: Auf dem Telefon war zwischen Lebenslauf und Anschreiben gar
// nicht umzuschalten — die Umschaltung stand nur im Schreibtisch-Zweig.
const menue = page.locator('header button', { hasText: '⋯' }).first();
if (await menue.count()) {
  await menue.click();
  await page.waitForTimeout(500);
  const typen = await page.locator('.cv-sheet button').filter({ hasText: /Anschreiben|Cover Letter|Lettre|Carta/ }).count();
  if (!typen) problems.push('Menü: Anschreiben ist auf dem Telefon nicht erreichbar');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(350);
}

await tab(2);
await overflow('Export');

// Tippziele
const small = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('nav button, header button, button, a').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.height < 32 && !el.closest('.cv-scale-wrapper')) {
      out.push(`„${(el.textContent || '').trim().slice(0, 18)}" ${Math.round(r.width)}×${Math.round(r.height)}`);
    }
  });
  return [...new Set(out)].slice(0, 8);
});
small.forEach(s => problems.push(`Tippziel unter 32 px: ${s}`));
errors.forEach(e => problems.push(`Ausnahme: ${e}`));

console.log(`Telefonbreite ${width} px — ${problems.length ? problems.length + ' Befund(e)' : 'ohne Befund ✓'}`);
problems.forEach(p => console.log(`   ! ${p}`));
await browser.close();
if (problems.length) process.exitCode = 1;
