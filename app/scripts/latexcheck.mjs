// LaTeX- und RenderCV-Ausgang: übersetzt es, ist es dicht, kommt es zurück?
//
// Seit 10.10.2026 gibt es zwei Ausgänge „als Code": eine .tex-Datei
// (export/exportLatex.ts, im Pass) und RenderCV-YAML (import/rendercv.ts,
// frei), dazu den Rückweg für beide. Dieses Skript prüft:
//
//   1. Übersetzen: Für sechs Testpersonen (Demo DE/EN, Technik, Handwerk,
//      alle Abschnitte, Angriff) entsteht eine .tex-Datei, die mit pdfLaTeX
//      fehlerfrei übersetzt (ohne Shell-Escape). Zwei davon zusätzlich mit
//      XeLaTeX (der Zweig mit fontspec). Der Name steht im PDF-Text.
//   2. Dicht: Die Testperson „angriff" trägt in jedem Feld LaTeX-Befehle
//      (\input, \write18, \openout, ^^5c, \catcode, \end{document},
//      unausgeglichene Klammern). Nichts davon darf wirken: keine Datei
//      entsteht, keine Datei außerhalb des Arbeitsordners wird gelesen
//      (Mitschrift `-recorder`), und der Befehlstext steht als Text im PDF.
//   3. Rundlauf LaTeX: .tex → Datenblock → Lebenslauf ergibt dieselben
//      Felder (Kennungen und Foto ausgenommen). Fremdes LaTeX und ein
//      beschädigter Block werden abgelehnt.
//   4. Rundlauf RenderCV: Lebenslauf → YAML → Lebenslauf ohne Verlust in
//      den gemeinsamen Feldern (Datumsform und Link-Schreibweise
//      normalisiert). Feindliches YAML (Verweisbombe, Tiefe, Tags, doppelte
//      Schlüssel) wird abgelehnt, ohne zu hängen.
//   5. Gegenprobe mit RenderCV selbst, wenn installiert (RENDERCV=/pfad/
//      zu/rendercv): jedes exportierte YAML wird mit `rendercv render`
//      gesetzt, und RenderCVs eigene Beispieldatei (`rendercv new`) wird
//      eingelesen.
//
//   node scripts/latexcheck.mjs
import { chromium } from 'playwright';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir, hostname } from 'node:os';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXEC = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RENDERCV = process.env.RENDERCV || '';
const work = mkdtempSync(join(tmpdir(), 'latexcheck-'));
let bad = 0, ok = 0;
const check = (cond, label, detail = '') => {
  if (cond) { ok++; console.log(`  ✓ ${label}`); } else { bad++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

const browser = await chromium.launch({ executablePath: EXEC });
const page = await browser.newPage();
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });

const sample = RENDERCV ? (() => {
  const dir = mkdtempSync(join(work, 'rcnew-'));
  spawnSync(RENDERCV, ['new', 'Jane Doe'], { cwd: dir, encoding: 'utf8' });
  const f = readdirSync(dir).find(n => n.endsWith('.yaml'));
  return f ? readFileSync(join(dir, f), 'utf8') : '';
})() : '';

const result = await page.evaluate(async ({ sample }) => {
  const X = await import('/src/export/exportLatex.ts');
  const LI = await import('/src/import/latexImport.ts');
  const RC = await import('/src/import/rendercv.ts');
  const { PERSONAS } = await import('/src/dev/personas.ts');
  const { demoDE } = await import('/src/data/demo-de.ts');
  const { demoEN } = await import('/src/data/demo-en.ts');
  const clone = o => JSON.parse(JSON.stringify(o));

  /* Angriff: in jedem Feld, das im Dokument landet, ein Befehl. */
  const angriff = clone(PERSONAS.abschnitte);
  const evil = [
    '\\input{/etc/hostname}', '\\immediate\\write18{touch PWNED-write18}', '^^5cinput{/etc/passwd}',
    '\\immediate\\openout5=PWNED-openout.tex\\immediate\\write5{x}\\immediate\\closeout5',
    '\\end{document}', '\\catcode`\\@=11', '}}}{{{', '$x^2$ & # % ~ _ < > | " `', '\\\\[3pt] [Klammer]',
  ];
  let k = 0;
  const ev = () => evil[k++ % evil.length];
  angriff.personal.name = `Eva ${ev()} Prüfer`;
  angriff.personal.title = ev();
  angriff.personal.location = `Straße 1 ${ev()}\n12345 Köln`;
  angriff.personal.email = 'eva_test#1@example.com';
  angriff.personal.website = 'https://example.com/a b?c=1&d=%20#frag';
  angriff.personal.birthPlace = ev();
  angriff.profile.text = `100 % sicher ${ev()}\n\n${ev()} — „Anführung“ ,,x'' --- C++ / C# 🚀 王 λ → ✓`;
  for (const e of angriff.experience) { e.role = ev(); e.company = `${ev()}\n\nzweite Zeile`; e.bullets = e.bullets.map(() => ev()); e.bullets.push('[x] Klammer am Anfang'); }
  for (const g of angriff.skillGroups) { g.label = ev(); g.items = g.items.map(() => ev()); }
  for (const l of angriff.languages) l.level = ev();
  for (const p of angriff.projects || []) { p.title = ev(); p.description = ev(); p.url = 'javascript:alert(1)'; }
  for (const c of angriff.customSections || []) { c.title = ev(); c.items = (c.items || []).map(() => ev()); }

  const people = {
    'demo-de': demoDE, 'demo-en': demoEN, tech: PERSONAS.tech, handwerk: PERSONAS.handwerk,
    abschnitte: PERSONAS.abschnitte, angriff,
  };
  const out = {};
  for (const [id, cv] of Object.entries(people)) {
    const tex = X.buildLatex(cv, { themeId: id === 'tech' ? 'tallinn' : 'espoo', pageFormat: id === 'demo-en' ? 'letter' : 'a4' });
    const back = LI.latexToCv(tex, cv);
    const yaml = await RC.buildRenderCvYaml(cv);
    const rcBack = await RC.renderCvToCv(yaml, cv);
    out[id] = { cv: clone(cv), tex, back: clone(back), yaml, rcBack: clone(rcBack) };
  }

  /* Ablehnungen. */
  const refuse = async (fn) => { try { await fn(); return 'angenommen'; } catch (e) { return e && e.code ? e.code : String(e); } };
  const base = demoDE;
  const fremd = '\\documentclass{moderncv}\n\\begin{document}\n\\name{Max}{Muster}\n\\end{document}\n';
  const tex0 = out['demo-de'].tex;
  const kaputt = tex0.replace(/(cv-daten v1[^\n]*\n% )(.)/, (m, a, b) => a + (b === 'A' ? '!' : 'A!'));
  const bomb = 'a: &a ["x","x","x","x","x","x","x","x","x"]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\nd: &d [*c,*c,*c,*c,*c,*c,*c,*c,*c]\ne: &e [*d,*d,*d,*d,*d,*d,*d,*d,*d]\nf: &f [*e,*e,*e,*e,*e,*e,*e,*e,*e]\ng: &g [*f,*f,*f,*f,*f,*f,*f,*f,*f]\ncv: {name: *g}\n';
  const deep = `cv:\n  sections:\n    x: ${'['.repeat(60)}1${']'.repeat(60)}\n`;
  const tag = 'cv: !!js/function "function(){return 1}"\n';
  const dup = 'cv:\n  name: A\n  name: B\n';
  const proto = 'cv:\n  name: Eva\n  __proto__: {polluted: true}\n  sections:\n    experience:\n      - company: X\n        position: Y\n';
  const refusals = {
    fremd: await refuse(() => LI.latexToCv(fremd, base)),
    kaputt: await refuse(() => LI.latexToCv(kaputt, base)),
    bomb: await refuse(() => RC.renderCvToCv(bomb, base)),
    deep: await refuse(() => RC.renderCvToCv(deep, base)),
    tag: await refuse(() => RC.renderCvToCv(tag, base)),
    dup: await refuse(() => RC.renderCvToCv(dup, base)),
    leer: await refuse(() => RC.renderCvToCv('cv: {}\n', base)),
  };
  let protoOk = true;
  try { await RC.renderCvToCv(proto, base); protoOk = ({}).polluted === undefined; } catch { protoOk = ({}).polluted === undefined; }
  /* Eingang über die gemeinsame Erkennung (HomeScreen, Export-Paneel). */
  const viaTex = await RC.readCodeImport('lebenslauf.tex', tex0, base);
  const viaYaml = await RC.readCodeImport('cv.yaml', out['demo-de'].yaml, base);
  const viaMd = await RC.readCodeImport('cv.md', '# Lebenslauf\n', base);
  let rcSample = null;
  if (sample) {
    const cv = await RC.renderCvToCv(sample, base);
    rcSample = {
      name: cv.personal.name, exp: cv.experience.length, edu: cv.education.length, pub: (cv.publications || []).length,
      prj: (cv.projects || []).length, skills: cv.skillGroups.length, custom: (cv.customSections || []).map(c => `${c.title}:${(c.items || []).length}`),
      profile: cv.profile.text.length, socials: (cv.personal.socials || []).length, firstStart: cv.experience[0]?.start, firstEnd: cv.experience[0]?.end,
      prjUrl: cv.projects?.[0]?.url, prjDate: cv.projects?.[1]?.start,
    };
  }
  return { out, refusals, protoOk, viaTex: viaTex?.what, viaYaml: viaYaml?.what, viaMd, rcSample };
}, { sample });
await browser.close();

// ── Vergleich ────────────────────────────────────────────────────────────────
const t = v => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const dateN = v => {
  const x = t(v);
  if (/^(present|heute|today|now|aujourd’hui|aujourd'hui|actualidad|hoy)$/i.test(x)) return 'present';
  let m = /^(\d{1,2})[/.](\d{4})$/.exec(x); if (m) return `${m[2]}-${m[1].padStart(2, '0')}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(x); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return x;
};
const urlN = v => t(v).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
const handle = v => { const x = urlN(v); return (x.split('/').filter(Boolean).pop() || x).replace(/^@/, ''); };
/** Gemeinsame Felder als flache Liste „Pfad = Wert". `rc` normalisiert die
 *  Unterschiede, die RenderCVs Form mit sich bringt. */
function flat(cv, rc) {
  const o = [];
  const put = (k, v) => o.push(`${k} = ${v}`);
  const d = rc ? dateN : t, u = rc ? urlN : t;
  const p = cv.personal || {};
  put('name', t(p.name)); put('title', t(p.title)); put('email', t(p.email)); put('phone', t(p.phone));
  put('location', rc ? t(p.location).replace(/\s*\n+\s*/g, ', ') : t(p.location));
  put('website', u(p.website));
  for (const k of ['birthDate', 'birthPlace', 'maritalStatus', 'nationality', 'driversLicense']) put(k, t(p[k]));
  const socials = (p.socials && p.socials.length) ? p.socials
    : [['linkedin', p.linkedin], ['instagram', p.instagram]].filter(([, v]) => t(v)).map(([platform, value]) => ({ platform, value }));
  for (const s of socials.filter(s => t(s.value))) put(`social.${s.platform}`, rc ? handle(s.value) : t(s.value));
  put('profile', t(cv.profile?.text));
  (cv.experience || []).filter(e => !e.hidden).forEach((e, i) => { for (const f of ['role', 'company', 'location']) put(`exp${i}.${f}`, t(e[f])); put(`exp${i}.start`, d(e.start)); put(`exp${i}.end`, d(e.end) || (rc ? 'present' : '')); put(`exp${i}.bullets`, (e.bullets || []).map(t).filter(Boolean).join(' | ')); });
  (cv.education || []).forEach((e, i) => { for (const f of ['degree', 'institution', 'location', 'notes']) put(`edu${i}.${f}`, t(e[f])); put(`edu${i}.start`, d(e.start)); put(`edu${i}.end`, d(e.end) || (rc ? 'present' : '')); });
  (cv.skillGroups || []).filter(g => (g.items || []).some(x => t(x))).forEach((g, i) => put(`skill${i}`, `${t(g.label)}: ${(g.items || []).map(t).filter(Boolean).join(' | ')}`));
  (cv.languages || []).forEach((l, i) => put(`lang${i}`, `${t(l.language)} / ${t(l.level)} / ${l.dots ?? ''}`));
  put('additional', (cv.additionalExperience || []).map(t).filter(Boolean).join(' | '));
  (cv.projects || []).forEach((e, i) => { for (const f of ['title', 'role', 'description']) put(`prj${i}.${f}`, t(e[f])); put(`prj${i}.url`, u(e.url)); put(`prj${i}.start`, d(e.start)); put(`prj${i}.end`, d(e.end) || (rc && t(e.start) ? 'present' : '')); put(`prj${i}.bullets`, (e.bullets || []).map(t).join(' | ')); });
  (cv.certificates || []).forEach((e, i) => { for (const f of ['name', 'issuer', 'credentialId']) put(`cert${i}.${f}`, t(e[f])); put(`cert${i}.url`, u(e.url)); put(`cert${i}.date`, d(e.date)); });
  (cv.volunteering || []).forEach((e, i) => { for (const f of ['role', 'organization', 'location']) put(`vol${i}.${f}`, t(e[f])); put(`vol${i}.start`, d(e.start)); put(`vol${i}.end`, d(e.end) || (rc && t(e.start) ? 'present' : '')); put(`vol${i}.bullets`, (e.bullets || []).map(t).join(' | ')); });
  (cv.publications || []).forEach((e, i) => { for (const f of ['title', 'publisher', 'description']) put(`pub${i}.${f}`, t(e[f])); put(`pub${i}.url`, u(e.url)); put(`pub${i}.date`, d(e.date)); });
  (cv.customSections || []).forEach((c, i) => { put(`sec${i}.title`, t(c.title)); put(`sec${i}.items`, (c.items || []).map(t).join(' | ')); (c.entries || []).forEach((e, j) => put(`sec${i}.${j}`, [t(e.title), t(e.subtitle), d(e.date), t(e.text)].join(' / '))); });
  return o;
}
function diff(a, b) {
  const out = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) out.push(`${a[i] ?? '∅'}  ≠  ${b[i] ?? '∅'}`);
  return out;
}

// ── Übersetzen ───────────────────────────────────────────────────────────────
const host = hostname();
function compile(engine, id, tex) {
  const dir = mkdtempSync(join(work, `${engine}-${id}-`));
  writeFileSync(join(dir, 'cv.tex'), tex);
  const args = engine === 'pdflatex'
    ? ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', '-recorder', 'cv.tex']
    : ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', '-recorder', 'cv.tex'];
  const r = spawnSync(engine, args, { cwd: dir, encoding: 'utf8', timeout: 120000 });
  const pdf = join(dir, 'cv.pdf');
  const text = existsSync(pdf) ? execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }) : '';
  const fls = existsSync(join(dir, 'cv.fls')) ? readFileSync(join(dir, 'cv.fls'), 'utf8') : '';
  const log = existsSync(join(dir, 'cv.log')) ? readFileSync(join(dir, 'cv.log'), 'utf8') : (r.stdout || '');
  return { code: r.status, dir, text, fls, log, files: readdirSync(dir) };
}

for (const [id, r] of Object.entries(result.out)) {
  console.log(`\n${id}`);
  const engines = id === 'demo-de' || id === 'angriff' ? ['pdflatex', 'xelatex'] : ['pdflatex'];
  for (const eng of engines) {
    const c = compile(eng, id, r.tex);
    const err = (c.log.match(/^! .*$/m) || [''])[0];
    check(c.code === 0, `${eng}: übersetzt ohne Fehler`, err || `Exit ${c.code}`);
    const nameWord = (r.cv.personal.name || '').split(/\s+/).filter(w => /^[\p{L}]+$/u.test(w)).pop() || '';
    check(!nameWord || c.text.includes(nameWord), `${eng}: Name „${nameWord}" im PDF-Text`);
    check(!c.text.includes('\u00AD'), `${eng}: keine weichen Trennstriche im Text`);
    if (id === 'angriff') {
      check(!c.files.some(f => f.startsWith('PWNED')), `${eng}: \\write18 und \\openout ohne Wirkung (keine Datei)`, c.files.join(','));
      const reads = c.fls.split('\n').filter(l => l.startsWith('INPUT ') && /\/etc\/(hostname|passwd)/.test(l));
      check(reads.length === 0, `${eng}: keine Datei außerhalb gelesen (/etc/hostname, /etc/passwd)`, reads.join(' '));
      check(!host || !c.text.includes(host) || r.tex.includes(host), `${eng}: Inhalt von /etc/hostname nicht im PDF`);
      const flat1 = c.text.replace(/\s+/g, '');
      check(flat1.includes('input{/etc/hostname}') && flat1.includes('write18{touchPWNED-write18}'), `${eng}: Befehle stehen als Text im PDF`);
      check(/\\end\{document\}|end\{document\}/.test(c.text), `${eng}: „\\end{document}" aus den Daten beendet das Dokument nicht`);
      const after = c.text.indexOf('Klammer am Anfang');
      check(after >= 0, `${eng}: Stichpunkt mit „[" am Anfang bleibt Text`);
    }
  }
  if (id === 'angriff') {
    check(!/\\href\{(javascript|data|file|vbscript):/i.test(r.tex), 'Link mit javascript: wird nicht als Verweis ausgegeben');
    check(/\\DeclareUnicodeCharacter\{1F680\}/.test(r.tex) && /\\DeclareUnicodeCharacter\{738B\}/.test(r.tex), 'Zeichen ohne pdfLaTeX-Schnitt (🚀, 王) bekommen eine Ersatzdefinition');
  }
  const a = flat(r.cv, false), b = flat(r.back, false);
  const dl = diff(a, b);
  check(dl.length === 0, `Rundlauf .tex: ${a.length} Felder gleich`, dl.slice(0, 4).join(' ; '));
  const ra = flat(r.cv, true), rb = flat(r.rcBack, true);
  const dr = diff(ra, rb);
  check(dr.length === 0, `Rundlauf RenderCV: ${ra.length} gemeinsame Felder gleich`, dr.slice(0, 4).join(' ; '));
  /* Die Angriffs-Testperson setzt RenderCV selbst nicht: es reicht Text an
   * Typst weiter, und „}}}{{{" oder „[Klammer" bricht dort den Satz. Das ist
   * eine Grenze von RenderCV, nicht unseres YAML (der Rundlauf oben zeigt,
   * dass die Daten vollständig ankommen). */
  if (RENDERCV && id !== 'angriff') {
    const dir = mkdtempSync(join(work, `rc-${id}-`));
    writeFileSync(join(dir, 'cv.yaml'), r.yaml);
    const rr = spawnSync(RENDERCV, ['render', 'cv.yaml', '--dont-generate-png', '--dont-generate-html', '--dont-generate-markdown'], { cwd: dir, encoding: 'utf8', timeout: 180000 });
    const pdfs = existsSync(join(dir, 'rendercv_output')) ? readdirSync(join(dir, 'rendercv_output')).filter(f => f.endsWith('.pdf')) : [];
    check(rr.status === 0 && pdfs.length === 1, 'RenderCV setzt das exportierte YAML', (rr.stdout + rr.stderr).split('\n').filter(l => /error|invalid|│/i.test(l)).slice(0, 6).join(' / '));
  }
}

console.log('\nAblehnungen');
const R = result.refusals;
check(R.fremd === 'foreign-latex', 'fremdes LaTeX (moderncv) → klare Absage', R.fremd);
check(R.kaputt === 'broken', 'beschädigter Datenblock → Absage', R.kaputt);
check(R.bomb === 'yaml', 'YAML-Verweisbombe → Absage ohne Hängen', R.bomb);
check(R.deep === 'yaml', 'YAML mit 60 Ebenen → Absage', R.deep);
check(R.tag === 'yaml' || R.tag === 'not-rendercv', 'YAML mit !!js/function → kein Code, Absage', R.tag);
check(R.dup === 'yaml', 'doppelte Schlüssel → Absage', R.dup);
check(R.leer === 'not-rendercv', 'leeres cv: → Absage', R.leer);
check(result.protoOk, '__proto__ im YAML verändert keine Objekte');
check(result.viaTex === 'LaTeX' && result.viaYaml === 'RenderCV' && result.viaMd === null, 'gemeinsame Erkennung: .tex, .yaml, Markdown bleibt beim alten Weg', `${result.viaTex}/${result.viaYaml}/${result.viaMd}`);
if (result.rcSample) {
  const s = result.rcSample;
  console.log('\nRenderCV-Beispieldatei (rendercv new)');
  check(s.name === 'Jane Doe' && s.exp === 5 && s.edu === 2 && s.pub === 4 && s.prj >= 2 && s.skills === 4, 'Name, 5 Stationen, 2 Abschlüsse, 4 Publikationen, Projekte, 4 Kenntnisgruppen', JSON.stringify(s));
  check(s.profile > 0 && s.socials === 2, 'Einleitung als Profil, zwei Netzwerke', JSON.stringify(s));
  check(s.firstStart === '06/2023' && s.firstEnd === 'present', 'Datumsform 2023-06/present → 06/2023/heute', `${s.firstStart} ${s.firstEnd}`);
  check(s.prjUrl === 'https://github.com/' && s.prjDate === '2021', 'Projektlink aus [Text](url), Einzeldatum', `${s.prjUrl} ${s.prjDate}`);
  check(s.custom.some(c => /Selected Honors:5/.test(c)) && s.custom.some(c => /Patents:3/.test(c)) && s.custom.some(c => /Invited Talks:4/.test(c)), 'Ehrungen, Patente, Vorträge als freie Abschnitte', s.custom.join(', '));
} else if (!RENDERCV) {
  console.log('\n(RenderCV nicht angegeben — Gegenprobe übersprungen: RENDERCV=/pfad/zu/rendercv)');
}

console.log(`\n${bad ? `${bad} Befund(e)` : 'ohne Befund'} — ${ok} Prüfungen bestanden. Arbeitsordner: ${work}`);
if (bad) process.exitCode = 1;
