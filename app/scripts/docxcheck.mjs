// Word-Export prüfen, indem er tatsächlich geöffnet wird.
//
// Baut die DOCX-Datei im Browser (dieselbe Funktion wie in der App), speichert
// sie, rendert sie mit LibreOffice zu PDF und legt Seitenbilder daneben. Erst
// damit lässt sich beurteilen, ob eine Vorlage in Word ankommt — und ob sie das
// auch ohne Microsoft-Lizenz tut.
//
//   node scripts/docxcheck.mjs seoul design marketing
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

const [tpl = 'hamburg', variant = 'design', persona = 'marketing'] = process.argv.slice(2);
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const out = join(process.cwd(), 'tmp-docx');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await page.goto(`${BASE}/dev-preview.html?tpl=${tpl}&mode=one&len=normal&p=${persona}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const b64 = await page.evaluate(v => window.__docx(v), variant);
/* Zeigt DIESE Vorlage überhaupt ein Foto? Zürich, Berlin und Basel setzen
 * `photo: 'none'` — dort wäre ein Bild in der Word-Datei der Fehler. */
const zeigtFoto = await page.evaluate(() =>
  !!document.querySelector('.cv-scale-wrapper .cv-page img[src]'));
await browser.close();

const base = `${persona}-${tpl}-${variant}`;
const docxPath = join(out, `${base}.docx`);
writeFileSync(docxPath, Buffer.from(b64, 'base64'));

// LibreOffice rendert die Datei genauso, wie sie ein Empfänger ohne
// Office-Lizenz sieht. Das ist der Punkt der Prüfung.
execFileSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', out, docxPath], { stdio: 'pipe', timeout: 120000 });
const pdfPath = join(out, `${base}.pdf`);
if (!existsSync(pdfPath)) { console.error('LibreOffice hat kein PDF erzeugt'); process.exit(1); }

const raw = execFileSync('pdftotext', ['-raw', pdfPath, '-'], { encoding: 'utf8' });
const pages = (execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' }).match(/Pages:\s+(\d+)/) || [])[1];
execFileSync('pdftoppm', ['-png', '-r', '110', pdfPath, join(out, base)], { stdio: 'pipe' });

const firstLine = raw.replace(/\s+/g, ' ').trim().slice(0, 60);

/* Liegt das Bewerbungsfoto wirklich in der Datei?
 *
 * Befund vom 14.09.2026: Es fehlte — und zwar lautlos. Word kann nur
 * Rasterbilder einbetten, `photoRun` nahm ausschließlich Data-URLs. Ein
 * gespeichertes Foto liegt aber als Adresse vor, das Platzhalterbild der
 * Testdaten als SVG. Beides fiel unter denselben Tisch. Eine DOCX ist ein
 * ZIP: die Bilder liegen unter `word/media/`. */
const zipListe = execFileSync('unzip', ['-Z1', docxPath], { encoding: 'utf8' });
// Der Ordnereintrag „word/media/" selbst zählt nicht als Bild.
const medien = zipListe.split('\n').filter(l => /^word\/media\/.+/.test(l));
const hatFoto = medien.length > 0;
const fotoHinweis = hatFoto ? `Foto: ${medien.length} Bild(er)` : (zeigtFoto ? 'OHNE FOTO' : 'Vorlage ohne Foto');

console.log(`${base.padEnd(34)} ${pages} Seite(n) · ${fotoHinweis} · beginnt mit „${firstLine}"`);
if (variant === 'design' && zeigtFoto && !hatFoto) {
  console.error('  ✗ Die Design-Fassung enthält kein Bild — genau der Befund vom 14.09.');
  process.exitCode = 1;
}
