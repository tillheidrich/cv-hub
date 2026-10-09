// ReDoS-Prüfung der Markdown-Einleser (Sicherheitsbefund H1, 09.10.2026).
//
//   1. Statisch: jedes Regex-Literal in src/import/*.ts (über die TypeScript-
//      AST gefunden) gegen bösartige Eingaben getimt — Präfix + 3000 Mal
//      dasselbe Zeichen + Störzeichen am Ende. Schwelle 100 ms je Probe (der alte
//      Sprachen-Ausdruck brauchte hier über eine Sekunde; lineare Ausdrücke
//      liegen je nach Last bei 1–50 ms).
//   2. Ende-zu-Ende im Browser: markdownToCvData und markdownToCoverLetter mit
//      den Eingaben, die vorher hängen blieben („- " + 3000 Leerzeichen + „a"
//      in „Sprachen"), mit 1 MB Markdown und mit 2001-Zeichen-Zeilen.
//      Jeder Aufruf unter 300 ms.
//   3. Gleichwertigkeit: die neue Zerlegung der Sprach- und der Schlüssel-
//      zeilen („- E-Mail: …") liefert für je 4000 zufällige kurze Zeilen
//      dasselbe wie der alte Ausdruck.
//   4. Grenzen: Zeilen über 2000 Zeichen fallen weg (außer im Profiltext),
//      Markdown über 200 000 Zeichen wird abgeschnitten.
//
//   node scripts/redoscheck.mjs      (braucht einen laufenden Vite-Server)
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.HARNESS_BASE || 'http://localhost:5199';
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const require = createRequire(import.meta.url);
const ts = require('typescript');

let fail = 0;
const check = (ok, label, extra = '') => { console.log(`${ok ? 'ok  ' : 'FEHL'} ${label}${extra ? ` (${extra})` : ''}`); if (!ok) fail++; };

// 1. Statisch
{
  const dir = 'src/import';
  const pres = ['', '- ', '* ', '+ ', '### ', '## ', '# ', '**', '| ', 'a: ', '- a: ', '1 ', '('];
  const chs = [' ', 'a', '-', '—', '–', ':', '*', '|', '·', '1', '.', '_', '(', '\t', '/', '@', ' -', '- ', 'a ', '\\', '[', '#', ','];
  const tails = ['\u0001', 'a', '', '\n', '!'];
  let n = 0, worst = 0, worstWhere = '';
  for (const f of readdirSync(dir).filter(f => /\.tsx?$/.test(f))) {
    const file = join(dir, f);
    const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    const lits = [];
    (function walk(x) { if (x.kind === ts.SyntaxKind.RegularExpressionLiteral) lits.push(x); ts.forEachChild(x, walk); })(sf);
    for (const lit of lits) {
      const txt = lit.getText(sf);
      const cut = txt.lastIndexOf('/');
      let re; try { re = new RegExp(txt.slice(1, cut), txt.slice(cut + 1).replace(/[gy]/g, '')); } catch { continue; }
      n++;
      let w = 0;
      outer: for (const p of pres) for (const c of chs) for (const t of tails) {
        const s = p + c.repeat(Math.ceil(3000 / c.length)) + t;
        const t0 = process.hrtime.bigint(); re.test(s); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (ms > w) w = ms;
        if (w > 150) break outer;
      }
      if (w > worst) { worst = w; worstWhere = `${file}:${sf.getLineAndCharacterOfPosition(lit.getStart(sf)).line + 1} ${txt}`; }
    }
  }
  check(worst < 100, `${n} Regexe in src/import ohne Rückverfolgungs-Explosion`, `langsamste Probe ${worst.toFixed(1)} ms: ${worstWhere}`);
}

// 2.–4. im Browser
const browser = await chromium.launch({ executablePath: EXECUTABLE });
const page = await browser.newPage();
await page.goto(`${BASE}/dev-preview.html`, { waitUntil: 'networkidle' });
const res = await page.evaluate(async () => {
  const mb = await import('/src/import/markdownBridge.ts');
  const { demoDE } = await import('/src/data/demo-de.ts');
  const { markdownToCvData, markdownToCoverLetter, splitLanguageLine, splitKeyLine, MAX_MD_CHARS, MAX_MD_LINE } = mb;
  const out = { times: {}, eq: { n: 0, diff: [] }, limits: {} };
  const time = (label, fn) => { const t0 = performance.now(); const r = fn(); out.times[label] = Math.round(performance.now() - t0); return r; };
  const cl = { company: '', contactPerson: '', companyAddress: '', city: '', date: '', subject: '', salutation: '', intro: '', mainBody: '', companyReference: '', motivation: '', closing: '', signoff: '' };

  const evil = '# Alex\n\n## Sprachen\n\n- ' + ' '.repeat(3000) + 'a\n';
  time('Sprachen 3 KB (vorher 8,8 s am Server)', () => markdownToCvData(evil, demoDE));
  const evilMany = '# Alex\n\n## Sprachen\n\n' + ('- ' + ' '.repeat(1990) + 'a\n').repeat(100);
  time('Sprachen 100 × 2 KB', () => markdownToCvData(evilMany, demoDE));
  const huge = '# Alex\n\n## Sprachen\n\n' + ('- ' + ' '.repeat(5000) + 'a\n').repeat(200);
  time('1 MB Markdown', () => markdownToCvData(huge, demoDE));
  const mixed = ['## Kontakt', '- a: ' + ' '.repeat(1990) + '\u0001', '## Berufserfahrung', '### x', ' '.repeat(1990) + '–', '## Ausbildung', '### y', '- ' + '- '.repeat(990)].join('\n').repeat(40);
  time('gemischte Abschnitte', () => markdownToCvData(mixed, demoDE));
  time('Anschreiben Empfänger', () => markdownToCoverLetter('## Empfänger\n' + ('- ' + ' '.repeat(1990) + 'a\n').repeat(100), cl));

  // 3. Gleichwertigkeit mit dem alten Ausdruck (auf kurzen Zeilen harmlos)
  const OLD = /^[-*+]\s*([^—–-]+?)\s*[—–-]\s*(.+)$/;
  const alphabet = ['-', '*', '+', ' ', ' ', 'a', 'B', 'é', '—', '–', '-', '(', ')', '3', '/', '5', '\t', '\u2028'];
  let seed = 7;
  const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const samples = ['- Deutsch — Muttersprache (5)', '- Englisch – C1 (4/5)', '* Französisch - B2', '-Spanisch—A2', '- Deutsch', '- — C1', '- Deutsch —', '+ Latein - Latinum (3)', '- Schweizerdeutsch — fließend - verhandlungssicher'];
  for (let k = 0; k < 4000; k++) {
    let s = ['- ', '* ', '+ ', '-', ''][rnd(5)];
    const len = rnd(24);
    for (let j = 0; j < len; j++) s += alphabet[rnd(alphabet.length)];
    samples.push(s);
  }
  for (const s of samples) {
    const t = s.trim();
    const m = t.match(OLD);
    const want = m ? { language: m[1].trim(), level: m[2].trim() } : null;
    const got = splitLanguageLine(t);
    out.eq.n++;
    if (JSON.stringify(want) !== JSON.stringify(got)) out.eq.diff.push({ t, want, got });
  }

  const OLDKV = /^-\s*([^:]+):\s*(.+)$/;
  const kvAlphabet = ['-', ':', ' ', ' ', 'a', 'E', '@', '.', '\t', '/', '\u2028'];
  const kvSamples = ['- E-Mail: a@b.de', '- Telefon:+49 1', '-Ort: Lüneburg', '- : x', '-  : x', '- a:', '- a: ', '-:x', 'x- a: b', '- Web: https://a.b/c:d'];
  for (let k = 0; k < 4000; k++) {
    let s = ['- ', '-', '', '-  '][rnd(4)];
    const len = rnd(20);
    for (let j = 0; j < len; j++) s += kvAlphabet[rnd(kvAlphabet.length)];
    kvSamples.push(s);
  }
  for (const t of kvSamples) {
    const m = t.match(OLDKV);
    const want = m ? { key: m[1], value: m[2].trim() } : null;
    const got = splitKeyLine(t);
    out.eq.n++;
    if (JSON.stringify(want) !== JSON.stringify(got)) out.eq.diff.push({ t, want, got });
  }

  // 4. Grenzen
  const long = 'x'.repeat(MAX_MD_LINE + 1);
  const a = markdownToCvData(`# Alex\n\n## Berufserfahrung\n\n### Rolle\n\n- ${long}\n- kurz\n`, demoDE);
  out.limits.bulletSkipped = a.experience[0]?.bullets.join('|') === 'kurz';
  const p = markdownToCvData(`# Alex\n\n## Profil\n\n${long}\n`, demoDE);
  out.limits.profileKept = p.profile.text.length === long.length;
  const big = `# Alex\n\n## Skills\n\n### Werkzeuge\n\n` + '- a\n'.repeat(60000) + '\n## Sprachen\n\n- Deutsch — Muttersprache\n';
  const b = markdownToCvData(big, demoDE);
  out.limits.capped = big.length > MAX_MD_CHARS && b.languages.length === 0 && (b.skillGroups[0]?.items.length ?? 0) < 60000;
  const ok = markdownToCvData(`# Alex\n\n## Sprachen\n\n- Deutsch — Muttersprache (5)\n- Englisch – C1 (4/5)\n`, demoDE);
  out.limits.normal = JSON.stringify(ok.languages);
  return out;
});
await browser.close();

for (const [label, ms] of Object.entries(res.times)) check(ms < 300, `${label}: ${ms} ms`);
check(res.eq.diff.length === 0, `Sprach- und Schlüsselzeilen: neue Zerlegung = alter Ausdruck auf ${res.eq.n} Zeilen`, res.eq.diff.slice(0, 3).map(d => JSON.stringify(d).replace(/[\u0080-\uffff]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"))).join(' · '));
check(res.limits.bulletSkipped, 'Zeile über 2000 Zeichen wird übersprungen');
check(res.limits.profileKept, 'Profiltext über 2000 Zeichen in einer Zeile bleibt erhalten');
check(res.limits.capped, 'Markdown über 200 000 Zeichen wird abgeschnitten');
check(res.limits.normal === JSON.stringify([{ language: 'Deutsch', level: 'Muttersprache', dots: 5 }, { language: 'Englisch', level: 'C1', dots: 4 }]), 'normale Sprachzeilen wie bisher', res.limits.normal);
console.log(fail ? `\n${fail} Befund(e)` : '\nohne Befund');
process.exit(fail ? 1 : 0);
