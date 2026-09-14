// End-to-End-Prüfung des PDF-Pfads.
//
// Holt aus dem Umbruch-Prüfstand exakt das HTML, das auch an den PDF-Dienst
// geht, druckt es mit Chromium zu PDF und vergleicht dann drei Dinge:
//
//   1. Seitenzahl Vorschau ↔ PDF
//   2. Text je Seite Vorschau ↔ PDF — die eigentliche Invariante. Nur wenn auf
//      Seite 2 des PDF dasselbe steht wie auf Seite 2 der Vorschau, ist „was du
//      siehst, bekommst du" mehr als eine Behauptung. Die Seitenzahl allein
//      kann stimmen, während der Umbruch verrutscht ist.
//   3. Qualität der Textebene: Wortzwischenräume, Trennstriche, Mojibake.
//      Selbst gehostete Schrift-Subsets ohne saubere ToUnicode-Tabelle liefern
//      ein PDF, das für Menschen richtig aussieht und für jeden Parser Müll
//      ist — ein größeres reales Risiko als jede Schriftgrößenregel.
//
//   node scripts/pdfcheck.mjs hamburg two long handwerk
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const [tpl = 'hamburg', mode = 'one', len = 'normal', persona = 'demo'] = process.argv.slice(2);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = join(process.cwd(), 'tmp-preview');
mkdirSync(out, { recursive: true });

const norm = (t) => t.replace(/\s+/g, ' ').replace(/[·•–—]/g, '-').trim().toLowerCase();
/** Anteil der Wörter der Vorschauseite, die auch auf der PDF-Seite stehen. */
function overlap(a, b) {
  const wa = norm(a).split(' ').filter(w => w.length > 3);
  const sb = new Set(norm(b).split(' '));
  if (!wa.length) return 1;
  return wa.filter(w => sb.has(w)).length / wa.length;
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 900, height: 2400 } });
await page.goto(`${BASE}/dev-preview.html?tpl=${tpl}&mode=${mode}&len=${len}&p=${persona}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const previewTexts = await page.$$eval('.cv-scale-wrapper .cv-page', els => els.map(e => e.innerText));
const personName = await page.$eval('.cv-scale-wrapper .cv-page h1', h => h.textContent.trim());
const html = await page.evaluate(() => window.__exportHtml());
const htmlPath = join(out, `${persona}-${tpl}-${mode}-${len}.html`);
writeFileSync(htmlPath, html);

const printer = await browser.newPage();
await printer.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
await printer.evaluate(() => document.fonts.ready);
await printer.waitForTimeout(800);
const fontsLoaded = await printer.evaluate(async () => {
  await document.fonts.ready;
  return [...document.fonts].filter(f => f.status === 'loaded').length;
});
const pdfPath = join(out, `${persona}-${tpl}-${mode}-${len}.pdf`);
await printer.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();

const raw = readFileSync(pdfPath, 'latin1');
const pdfPages = [...raw.matchAll(/\/Type\s*\/Page[^s]/g)].length;

// Textebene seitenweise auslesen — ohne -layout, damit die Reihenfolge im
// Content-Stream geprüft wird und nicht eine hübsch rekonstruierte Ansicht.
const pageText = [];
for (let i = 1; i <= pdfPages; i++) {
  pageText.push(execFileSync('pdftotext', ['-f', String(i), '-l', String(i), pdfPath, '-'], { encoding: 'utf8' }));
}

const problems = [];
if (previewTexts.length !== pdfPages) problems.push(`Seitenzahl: Vorschau ${previewTexts.length}, PDF ${pdfPages}`);
const scores = [];
for (let i = 0; i < Math.min(previewTexts.length, pdfPages); i++) {
  const o = overlap(previewTexts[i], pageText[i] || '');
  scores.push(o);
  if (o < 0.95) problems.push(`Seite ${i + 1}: nur ${(o * 100).toFixed(0)} % des Vorschautexts wiedergefunden`);
}

// Qualität der Textebene
const all = pageText.join('\n');
if (/�/.test(all)) problems.push('Ersatzzeichen (U+FFFD) im PDF-Text — ToUnicode fehlerhaft');
if (/ﬁ|ﬂ/.test(all)) problems.push('Ligaturen landen unzerlegt im Text — Parser lesen sie falsch');
// Trennstriche am Zeilenende: echte Bindestriche in Komposita („CI/CD-
// Pipelines") sind in Ordnung — sie stehen so im Text. Gefährlich wären nur
// vom Browser eingefügte Trennstriche; die gäbe es nur mit Silbentrennung, die
// global aus ist. Deshalb wird gegenprüft, ob das zusammengesetzte Wort
// wirklich im Dokumenttext vorkommt.
const previewFlat = norm(previewTexts.join(' ')).replace(/ /g, '');
for (const m of all.matchAll(/([A-Za-zÄÖÜäöüß]{2,})-\s*\n([A-Za-zÄÖÜäöüß]{2,})/g)) {
  const joined = norm(`${m[1]}-${m[2]}`).replace(/ /g, '');
  if (!previewFlat.includes(joined)) {
    problems.push(`Eingefügter Trennstrich im Text: „${m[1]}-${m[2]}" — bricht die Stichwortsuche`);
    break;
  }
}
// Zeilenenden kommen aus pdftotext als Newline, nicht als Leerzeichen —
// beides zählt als Wortgrenze. Deutscher Fließtext liegt bei 13–16 %.
const spaceRatio = ((all.match(/[ \n]/g) || []).length) / Math.max(1, all.length);
if (spaceRatio < 0.1) problems.push(`Auffällig wenige Wortgrenzen (${(spaceRatio * 100).toFixed(1)} %) — Wörter kleben zusammen`);

// Lesereihenfolge im Content-Stream (-raw): Name muss ganz vorn stehen und
// die erste Position vor dem Sidebar-Kleinkram kommen. Das ist die Reihenfolge,
// die ein Parser ohne Layoutanalyse sieht.
const rawText = execFileSync('pdftotext', ['-raw', '-f', '1', '-l', '1', pdfPath, '-'], { encoding: 'utf8' });
// Der Name darf dabei über mehrere Zeilen laufen (schmale Seitenspalte),
// deshalb wird der Anfang des Stroms normalisiert verglichen statt zeilenweise.
const rawHead = rawText.replace(/\s+/g, ' ').trim();
if (!rawHead.toLowerCase().startsWith(personName.replace(/\s+/g, ' ').toLowerCase())) problems.push(`Content-Stream beginnt nicht mit dem Namen, sondern mit „${rawHead.slice(0, 40)}"`);
if (!/[äöüßÄÖÜ]/.test(all)) problems.push('Keine Umlaute im extrahierten Text gefunden — verdächtig');

// Gesperrte Versalzeilen: ab etwa 0.10 em Sperrung zerlegt die Textextraktion
// eine Zeile in Einzelbuchstaben. Betroffen sind genau die Sektionstitel, an
// denen ein Parser den Lebenslauf in Abschnitte teilt.
const spaced = all.match(/(?:[A-ZÄÖÜ] ){3,}[A-ZÄÖÜ]/g);
if (spaced) problems.push(`Gesperrte Versalzeile zerfällt im Text in Einzelbuchstaben: „${spaced[0]}"`);

const head = `${persona}/${tpl}/${mode}/${len}`.padEnd(32);
const ok = problems.length === 0;
console.log(`${head} ${previewTexts.length}→${pdfPages} S · Text ${scores.map(s => Math.round(s * 100) + '%').join(' ')} · ${fontsLoaded} Schriften · ${ok ? '✓' : '✗'}`);
for (const p of problems) console.log(`   ! ${p}`);
if (!ok) process.exitCode = 1;
