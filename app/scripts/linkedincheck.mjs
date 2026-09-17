// LinkedIn-Import gegen ein echtes Archiv prüfen.
//
// Baut ein LinkedIn-ähnliches ZIP — mit genau den Eigenheiten, an denen die
// erste Fassung scheiterte — und lässt es durch den Import laufen, im Browser,
// also über denselben Weg wie beim Nutzer.
//
//   node scripts/linkedincheck.mjs
import { chromium } from 'playwright';
import JSZip from '../node_modules/jszip/dist/jszip.min.js';

const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';

/* Ein Archiv, das die vier Fallen enthält:
   — Beschreibung mit Zeilenumbrüchen UND Komma in Anführungszeichen
   — Datum als Monatsname („Aug 2018"), als ISO und als bloßes Jahr
   — laufende Stelle mit leerem „Finished On"
   — zwei E-Mail-Adressen, eine davon als primär markiert */
const CSV = {
  'Profile.csv':
    'First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Websites\n' +
    'Katharina,Vogt,,,,Senior Marketing Manager | B2B,"Erklärungsbedürftige Produkte, verständlich gemacht",Marketing,20149,"Hamburg, Deutschland",\n',
  'Email Addresses.csv':
    'Email Address,Confirmed,Primary,Updated On\n' +
    'alt@uni-beispiel.de,Yes,No,2016-04-01\n' +
    'k.vogt@example.com,Yes,Yes,2024-01-01\n',
  'PhoneNumbers.csv':
    'Extension,Number,Type\n' +
    ',+49 151 22446688,MOBILE\n',
  'Positions.csv':
    'Company Name,Title,Description,Location,Started On,Finished On\n' +
    '"Nordwerk Software GmbH",Senior Marketing Manager,' +
    '"• Positionierung und Messaging für zwei Produktlinien neu aufgesetzt, gemeinsam mit Vertrieb\n' +
    '• Content-Programm aufgebaut: Fachbeiträge, Webinare, Kundenberichte\n' +
    '- Marketing-Automation in HubSpot eingeführt",Hamburg,Mar 2021,\n' +
    'Elbkontor Digital,Marketing Manager,"Google Ads und LinkedIn Ads für sechs Kunden betreut.",Hamburg,Aug 2018,2021-02\n' +
    'Prenzlauer Medienhaus,Junior Marketing Manager,,Berlin,2016,2018\n',
  'Education.csv':
    'School Name,Start Date,End Date,Notes,Degree Name,Activities\n' +
    'Freie Universität Berlin,2014,2016,"Schwerpunkt Organisationskommunikation",M.A. Kommunikationswissenschaft,\n' +
    'Universität Mannheim,2010,2014,,B.A. Medien- und Kommunikationswissenschaft,\n',
  'Skills.csv': 'Name\nPositionierung & Messaging\nContent-Strategie\nHubSpot\n',
  'Languages.csv':
    'Name,Proficiency\n' +
    'Deutsch,Native or bilingual proficiency\n' +
    'Englisch,Full professional proficiency\n' +
    'Französisch,Limited working proficiency\n',
  'Connections.csv': 'First Name,Last Name\nIrrelevant,Datei\n',
};

const zip = new JSZip();
// In einen Unterordner, wie LinkedIn es tut — der Import muss den Basisnamen finden.
for (const [n, t] of Object.entries(CSV)) zip.file(`Basic_LinkedInDataExport_17-09-2026/${n}`, t);
const bytes = [...await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })];

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();
const fehler = [];
page.on('pageerror', e => fehler.push(String(e).slice(0, 200)));
await page.goto(`${BASE}/dev-import.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const r = await page.evaluate(([b, n]) => window.__linkedin(b, n), [bytes, 'Basic_LinkedInDataExport.zip']);

// Einzelteile, die die erste Fassung falsch machte.
const csvMehrzeilig = await page.evaluate(() =>
  window.__csv('a,b\n"eins\nzwei",drei\n').length);
const datumsproben = await page.evaluate(() =>
  ['Aug 2018', 'August 2018', '2018-08-01', '2018-08', '2018', 'Mär 2020', 'unleserlich'].map(window.__datum));
await browser.close();

const pruefungen = [
  ['CSV mit Zeilenumbruch im Feld ergibt EINE Zeile', csvMehrzeilig === 1, csvMehrzeilig],
  ['Datumsformate', JSON.stringify(datumsproben) === JSON.stringify(['08/2018','08/2018','08/2018','08/2018','2018','03/2020','unleserlich']), datumsproben.join(' · ')],
  ['Name gelesen', r.name === 'Katharina Vogt', r.name],
  ['Primäre E-Mail bevorzugt', r.email === 'k.vogt@example.com', r.email],
  ['Telefon gelesen', r.phone === '+49 151 22446688', r.phone],
  ['Ort gelesen', r.location === 'Hamburg, Deutschland', r.location],
  ['Drei Stationen', r.gefunden.stationen === 3, r.gefunden.stationen],
  ['Laufende Stelle als „heute"', r.stationen[0].end === 'heute', r.stationen[0].end],
  ['Monatsname umgerechnet', r.stationen[1].start === '08/2018', r.stationen[1].start],
  ['Drei Stichpunkte aus mehrzeiliger Beschreibung', r.stationen[0].bullets.length === 3, r.stationen[0].bullets.length],
  ['Listenzeichen entfernt', !/^[•\-]/.test(r.stationen[0].bullets[0] || ''), r.stationen[0].bullets[0]],
  ['Komma im Stichpunkt erhalten', (r.stationen[0].bullets[0] || '').includes('Produktlinien neu aufgesetzt, gemeinsam'), r.stationen[0].bullets[0]],
  ['Zwei Ausbildungen', r.gefunden.ausbildung === 2, r.gefunden.ausbildung],
  ['Abschluss + Fach zusammengesetzt', r.ausbildung[0].degree === 'M.A. Kommunikationswissenschaft', r.ausbildung[0].degree],
  ['Drei Skills', r.gefunden.skills === 3, r.gefunden.skills],
  ['Sprachstufe zu Punkten', JSON.stringify(r.sprachen.map(s => s.dots)) === '[5,4,2]', r.sprachen.map(s => s.dots).join(',')],
  ['Foto unangetastet', r.fotoBleibt, r.fotoBleibt],
  ['Profiltext unangetastet', r.profilBleibt, r.profilBleibt],
  ['Hinweis auf fehlendes Foto/Profiltext', r.hinweise.some(h => /foto/i.test(h)), r.hinweise.length + ' Hinweise'],
  ['Keine Ausnahmen', fehler.length === 0, fehler.join(' | ') || 'keine'],
];

let schlecht = 0;
for (const [was, ok, ist] of pruefungen) {
  if (!ok) schlecht++;
  console.log(`${ok ? '✓' : '✗'} ${was.padEnd(48)} ${ok ? '' : '→ ' + ist}`);
}
console.log(schlecht ? `\n${schlecht} Prüfung(en) fehlgeschlagen` : '\nAlle Prüfungen bestanden ✓');
process.exitCode = schlecht ? 1 : 0;
