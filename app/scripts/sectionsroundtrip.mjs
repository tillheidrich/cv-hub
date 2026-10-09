// Rundlauf der eigenen Abschnitte (Projekte, Zertifikate, Ehrenamt,
// Publikationen, freie Abschnitte) durch jeden Datenausgang — ohne Feldverlust.
//
//   1. Markdown im Browser: buildMarkdown → markdownToCvData
//   2. Markdown am Server:  dieselbe Datei durch pdf-service/markdown.js
//   3. Beide Schreiber liefern für dieselben Daten denselben Text
//   4. JSON Resume:          cvToJsonResume → jsonResumeToCv
//   5. JSON-Sicherung:       der Datensatz selbst, unverändert
//   6. Bestandsdaten (Personas ohne eigene Abschnitte): kein neuer Abschnitt
//      im Markdown, nichts Neues im JSON Resume
//
// Mit OLD_BASE (Vite-Server auf einem älteren Stand) zusätzlich: Markdown und
// JSON Resume der Bestandsdaten sind byte-gleich zum alten Stand.
//
//   node scripts/sectionsroundtrip.mjs
//   OLD_BASE=http://localhost:5204 node scripts/sectionsroundtrip.mjs
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const OLD = process.env.OLD_BASE || '';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SERVER_MD = resolve(process.cwd(), '../pdf-service/markdown.js');

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });

const res = await page.evaluate(async (serverPath) => {
  const { PERSONAS } = await import('/src/dev/personas.ts');
  const { demoDE } = await import('/src/data/demo-de.ts');
  const { demoEN } = await import('/src/data/demo-en.ts');
  const { buildMarkdown } = await import('/src/export/exportMarkdown.ts');
  const { markdownToCvData } = await import('/src/import/markdownBridge.ts');
  const { cvToJsonResume, jsonResumeToCv } = await import('/src/export/jsonResume.ts');
  const server = await import(`/@fs${serverPath}`);

  const KEYS = ['projects', 'certificates', 'volunteering', 'publications', 'customSections'];
  /* Einheitliche Form zum Vergleichen: Kennungen raus (werden beim Einlesen
   * neu vergeben), fehlende Felder als leer. */
  const S = x => (x == null ? '' : String(x));
  const L = x => (Array.isArray(x) ? x.map(S) : []);
  const norm = cv => ({
    projects: (cv.projects || []).map(p => ({ title: S(p.title), role: S(p.role), start: S(p.start), end: S(p.end), url: S(p.url), description: S(p.description), bullets: L(p.bullets) })),
    certificates: (cv.certificates || []).map(c => ({ name: S(c.name), issuer: S(c.issuer), date: S(c.date), credentialId: S(c.credentialId), url: S(c.url) })),
    volunteering: (cv.volunteering || []).map(v => ({ role: S(v.role), organization: S(v.organization), location: S(v.location), start: S(v.start), end: S(v.end), bullets: L(v.bullets) })),
    publications: (cv.publications || []).map(p => ({ title: S(p.title), publisher: S(p.publisher), date: S(p.date), url: S(p.url), description: S(p.description) })),
    customSections: (cv.customSections || []).map(c => ({ title: S(c.title), items: L(c.items), entries: (c.entries || []).map(e => ({ title: S(e.title), subtitle: S(e.subtitle), date: S(e.date), text: S(e.text) })) })),
  });
  const diff = (a, b) => KEYS.filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  const body = md => md.replace(/^---[\s\S]*?\n---\n/, '');

  const out = [];
  const cv = PERSONAS.abschnitte;
  const want = norm(cv);
  const counts = KEYS.map(k => `${k}:${want[k].length}`).join(' ');

  const md = buildMarkdown(cv);
  const viaBrowser = markdownToCvData(md, cv);
  out.push({ name: `Markdown Browser hin und zurück (${counts})`, bad: diff(norm(viaBrowser), want) });

  const prof = { settings: { lang: 'de' }, data: { de: cv } };
  const viaServer = server.markdownToCV(md, prof).data.de;
  out.push({ name: 'Markdown aus dem Browser, gelesen am Server', bad: diff(norm(viaServer), want) });
  const serverMd = server.cvToMarkdown(prof);
  out.push({ name: 'Markdown vom Server, gelesen im Browser', bad: diff(norm(markdownToCvData(serverMd, cv)), want) });
  out.push({ name: 'Browser- und Server-Schreiber: gleicher Text', bad: body(serverMd) === body(md) ? [] : ['Text weicht ab'] });
  out.push({ name: 'Zweiter Durchgang stabil', bad: buildMarkdown(viaBrowser) === md ? [] : ['Markdown ändert sich'] });

  const jr = cvToJsonResume(cv);
  const std = ['projects', 'certificates', 'volunteer', 'publications'].filter(k => !Array.isArray(jr[k]) || !jr[k].length);
  out.push({ name: 'JSON Resume nutzt die Standardfelder', bad: std.map(k => `${k} fehlt`) });
  const viaJr = jsonResumeToCv(JSON.parse(JSON.stringify(jr)), { ...cv, projects: undefined, certificates: undefined, volunteering: undefined, publications: undefined, customSections: undefined });
  out.push({ name: 'JSON Resume hin und zurück', bad: diff(norm(viaJr), want) });

  const backup = JSON.parse(JSON.stringify(cv));
  out.push({ name: 'JSON-Sicherung', bad: diff(norm(backup), want) });

  // Bestandsdaten: kein neuer Abschnitt.
  const alt = { demoDE, demoEN, ...Object.fromEntries(Object.entries(PERSONAS).filter(([k]) => k !== 'abschnitte')) };
  const legacy = {};
  for (const [name, d] of Object.entries(alt)) {
    const m = buildMarkdown(d);
    const j = cvToJsonResume(d);
    legacy[name] = { md: m, jr: JSON.stringify(j) };
    const bad = [];
    for (const h of ['## Projekte', '## Zertifikate', '## Ehrenamt', '## Publikationen', '## Abschnitt']) if (m.includes(h)) bad.push(h);
    for (const k of ['projects', 'certificates', 'volunteer', 'publications']) if (k in j) bad.push(`JSON Resume ${k}`);
    if (j.x_cvhub && 'customSections' in j.x_cvhub) bad.push('x_cvhub.customSections');
    if (body(server.cvToMarkdown({ settings: { lang: d.labels.lang }, data: { [d.labels.lang]: d } })) !== body(m)) bad.push('Server-Markdown weicht ab');
    out.push({ name: `Bestandsdaten ${name}: nichts Neues`, bad });
  }
  return { out, legacy, md };
}, SERVER_MD);

let fail = 0;
for (const r of res.out) {
  if (r.bad.length) fail++;
  console.log(`${r.bad.length ? '✗' : '✓'} ${r.name}${r.bad.length ? ' — ' + r.bad.join(', ') : ''}`);
}

if (OLD) {
  const old = await browser.newPage();
  await old.goto(`${OLD}/dev-preview.html`, { waitUntil: 'networkidle' });
  const was = await old.evaluate(async (names) => {
    const { PERSONAS } = await import('/src/dev/personas.ts');
    const { demoDE } = await import('/src/data/demo-de.ts');
    const { demoEN } = await import('/src/data/demo-en.ts');
    const { buildMarkdown } = await import('/src/export/exportMarkdown.ts');
    const { cvToJsonResume } = await import('/src/export/jsonResume.ts');
    const all = { demoDE, demoEN, ...PERSONAS };
    return Object.fromEntries(names.filter(n => all[n]).map(n => [n, { md: buildMarkdown(all[n]), jr: JSON.stringify(cvToJsonResume(all[n])) }]));
  }, Object.keys(res.legacy));
  for (const [name, now] of Object.entries(res.legacy)) {
    if (!was[name]) continue;
    const same = was[name].md === now.md && was[name].jr === now.jr;
    if (!same) fail++;
    console.log(`${same ? '✓' : '✗'} Bestandsdaten ${name}: Markdown und JSON Resume byte-gleich zum alten Stand`);
  }
}

await browser.close();
console.log(fail ? `\n${fail} Prüfung(en) fehlgeschlagen.` : '\nAlle Rundläufe ohne Feldverlust.');
if (fail) process.exitCode = 1;
