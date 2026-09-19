// Prüft den Vorlagen-Export „ohne Daten": Lässt sich das ZIP bauen, enthält es
// die fünf Dateien, ist das HTML ein vollständiges Dokument mit Platzhaltern,
// und — die eigentliche Frage — lädt das leere JSON wieder ins Werkzeug?
//
//   node scripts/kitcheck.mjs lueneburg
import { chromium } from 'playwright';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const tpl = process.argv[2] || 'lueneburg';
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const dir = mkdtempSync(join(tmpdir(), 'kit-'));

const br = await chromium.launch({ executablePath: EXEC });
const page = await br.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
await page.goto(`${BASE}/dev-preview.html?tpl=${tpl}&mode=one&len=normal&p=einseiter`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const [dl] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.evaluate(() => window.__exportKit()),
]);
const zipPath = join(dir, 'kit.zip');
await dl.saveAs(zipPath);
execFileSync('unzip', ['-o', '-q', zipPath, '-d', dir]);

const ok = [], bad = [];
const check = (c, w) => (c ? ok : bad).push(w);

const files = execFileSync('unzip', ['-Z1', zipPath]).toString().split('\n').filter(Boolean);
for (const f of ['vorlage.html', 'vorlage.docx', 'daten.json', 'beispiel.json', 'ANLEITUNG.md']) {
  check(files.includes(f), `${f} liegt im Paket`);
}

const html = readFileSync(join(dir, 'vorlage.html'), 'utf8');
check(/<!doctype html/i.test(html), 'HTML ist ein vollständiges Dokument');
check(html.includes('{{personal.name}}'), 'Platzhalter statt Namen im HTML');
check(html.includes('{{experience[0].role}}'), 'Platzhalter für die erste Station');
check(!/Lina Sandmann|Katharina Vogt/.test(html), 'keine fremden Daten im HTML');
check(/@page|210mm/.test(html), 'Seitenformat im HTML gesetzt');

const leer = JSON.parse(readFileSync(join(dir, 'daten.json'), 'utf8'));
check(leer.personal?.name === '', 'daten.json ist leer, nicht voller Platzhalter');
check(Array.isArray(leer.experience) && leer.experience.length === 3, 'daten.json hat drei Stationen als Gerüst');
check(!!leer.labels?.sections?.experience, 'Beschriftungen liegen im JSON, nicht im Design');

const bsp = JSON.parse(readFileSync(join(dir, 'beispiel.json'), 'utf8'));
check(!!bsp.personal?.name, 'beispiel.json ist ausgefüllt');
/* Und zwar mit einer Musterperson, nicht mit dem geladenen Lebenslauf.
 *
 * Die Zeile darüber gab es schon, und sie war grün, während `beispiel.json`
 * die echten Daten des Nutzers enthielt — Name, Anschrift, Geburtsdatum,
 * alle Stationen. Das ZIP heißt „Vorlage ohne Daten". Eine Prüfung, die nur
 * fragt „steht da etwas?", übersieht genau den Fall, auf den es ankommt.
 *
 * Der Prüfstand lädt ein Profil mit einem bekannten Namen; taucht der im
 * Beispiel auf, ist es der falsche Inhalt. */
const ausProfil = /Till Heidrich|Lina Sandmann|Katharina Vogt/;
check(!ausProfil.test(JSON.stringify(bsp)),
  'beispiel.json enthält eine Musterperson, nicht den geladenen Lebenslauf');
const mail = String(bsp.personal?.email || '');
check(mail === '' || /@example\./i.test(mail) || /@(mail|muster|demo)\./i.test(mail),
  `beispiel.json trägt keine echte Mailadresse (${mail || 'leer'})`);

const md = readFileSync(join(dir, 'ANLEITUNG.md'), 'utf8');
check(md.includes('0,08 em'), 'Anleitung nennt die gemessene Sperrungsgrenze');
check(md.includes('Kein unsichtbarer Text'), 'Anleitung warnt vor unsichtbarem Text');

// Der Rückweg: genau diese Bedingung prüft der Import im Werkzeug. Die
// Anleitung verspricht „ausfüllen und wieder hochladen" — das muss stimmen.
check(leer.personal !== undefined && leer.experience !== undefined,
  'daten.json erfüllt die Bedingung, die der Import im Werkzeug prüft');

// Und: druckt die Platzhalter-Vorlage zu einem brauchbaren PDF?
{
  const htmlPath = join(dir, 'vorlage.html');
  const p2 = await br.newPage();
  await p2.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
  await p2.evaluate(() => document.fonts.ready);
  const pdf = join(dir, 'vorlage.pdf');
  await p2.pdf({ path: pdf, format: 'A4', printBackground: true });
  await p2.close();
  execFileSync('pdftotext', ['-layout', pdf, join(dir, 'vorlage.txt')]);
  const txt = readFileSync(join(dir, 'vorlage.txt'), 'utf8');
  const seiten = txt.split('\f').filter(t => t.trim()).length;
  check(seiten === 1, `Platzhalter-Vorlage druckt auf eine Seite (${seiten})`);
  /* Auf EINEN bestimmten Platzhalter zu prüfen wäre hier falsch. Drei
   * Verwandlungen sind normal und kein Befund: Versalien-Vorlagen zeigen
   * „{{PERSONAL.NAME}}"; in einer 58-mm-Spalte bricht ein 19 Zeichen langer
   * Platzhalter um; und bei zweispaltigen Vorlagen schiebt die
   * Extraktionsreihenfolge die Hälfte der Nachbarspalte dazwischen
   * („{{personal.na BERUFSPROFIL me}}"). Echter Inhalt tut nichts davon.
   * Bearbeitet wird der HTML-Quelltext — dort steht jeder Platzhalter
   * unversehrt, das ist oben geprüft. Vom PDF wird nur verlangt, dass die
   * Platzhalter überhaupt in der Textebene landen. */
  const marken = (txt.match(/\{\{/g) || []).length;
  check(marken >= 15, `Platzhalter stehen auch in der PDF-Textebene (${marken} gefunden)`);
}

check(errors.length === 0, `keine Ausnahmen (${errors[0] ?? ''})`);
for (const o of ok) console.log(`  ✓ ${o}`);
for (const b of bad) console.log(`  ✗ ${b}`);
await br.close();
if (bad.length) process.exitCode = 1;
