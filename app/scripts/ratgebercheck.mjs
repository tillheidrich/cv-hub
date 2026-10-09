// Prüflauf für den Ratgeber (Sync aus Outline, statischer Bau, Auslieferung).
//
//   node scripts/ratgebercheck.mjs
//   RATGEBERCHECK_SHOTS=/pfad node scripts/ratgebercheck.mjs   (zusätzlich Bildschirmfotos)
//
// Was geprüft wird, und warum:
//   0. Die echten Artikel in content/ratgeber: Frontmatter und Sperrliste.
//      Der Bau überspringt fehlerhafte Artikel still weiter; hier fällt es auf.
//   1. Sperrliste als Einzelfälle, in BEIDE Richtungen: Geheimnisse müssen
//      anschlagen, gewöhnliche Artikeltexte (Quellen-URLs, Versionsnummern,
//      Beispieladressen) dürfen es nicht. Eine Sperre, die alles sperrt,
//      wird abgeschaltet; eine, die nichts findet, ist keine.
//   2. Bau mit zwei Beispielartikeln plus einem präparierten (Schlüssel im
//      Text) und einem kaputten (Frontmatter): nur die zwei landen online.
//   3. Ausgabe statisch: HTML valide (html-validate), kein Skript außer
//      JSON-LD, keine style-Attribute (CSP), kein rohes HTML aus dem Markdown,
//      canonical/og:url aus PUBLIC_BASE_URL, JSON-LD Article mit
//      dateModified, Sitemap mit allen Seiten, robots.txt mit Sitemap.
//   4. Auslieferung über den echten nginx (app/nginx.conf, falls nginx
//      installiert ist): /ratgeber/<slug>/ statisch, unbekannte Artikel 404
//      statt SPA, Weiterleitung ohne Schrägstrich relativ, CSP-Kopfzeile.
//   5. Browser (Chromium, 1440 und 390 px): axe ohne Verstöße, kein
//      waagerechtes Scrollen, Kontrast jedes Textelements, Zeilenlänge,
//      Schrift geladen, keine CSP-Verletzung, keine fremden Anfragen.
//   6. Sync gegen eine nachgebaute Outline-API: nur Veröffentlichtes, Anleitung
//      übersprungen, Sperrliste hält präparierte Dokumente zurück, Bilder
//      werden geladen (Token nie an fremde Hosts), Querverweise umgebogen,
//      zurückgezogene Artikel entfernt, Repo-Artikel unangetastet.
//   7. Ohne Token: Sync tut nichts, Bau läuft.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, cpSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { deflateSync, crc32 } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { HtmlValidate } from 'html-validate';
import { leseArtikel, parseFrontmatter, ANLEITUNG_TITEL } from './ratgeber-lib.mjs';
import { pruefeText, impressumsEmail } from './ratgeber-sperrmuster.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const NGINX_PORT = Number(process.env.RATGEBER_PORT || 5222);
const SHOTS = process.env.RATGEBERCHECK_SHOTS || '';
const TMP = mkdtempSync(join(tmpdir(), 'ratgebercheck-'));
const BASIS_TEST = 'https://ratgeber-test.example';
const STANDARD_BASIS = 'https://cv.example.com';

let fehler = 0;
let geprueft = 0;
function ok(bedingung, text, detail) {
  geprueft++;
  if (bedingung) console.log(`  ✓ ${text}`);
  else { fehler++; console.log(`  ✗ ${text}${detail ? `\n      ${String(detail).split('\n').join('\n      ')}` : ''}`); }
}
const abschnitt = t => console.log(`\n── ${t}`);

function node(skript, env, cwd = APP) {
  const r = spawnSync(process.execPath, [join(APP, 'scripts', skript)], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/** Wie node(), aber ohne die Ereignisschleife zu blockieren: Die Outline-
 *  Attrappe läuft in diesem Prozess und muss antworten können. */
function nodeAsync(skript, env) {
  return new Promise(res => {
    const p = spawn(process.execPath, [join(APP, 'scripts', skript)], { cwd: APP, env: { ...process.env, ...env } });
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { out += d; });
    p.on('close', code => res({ code, out }));
  });
}

/** Kleines PNG mit Farbverlauf (für Bild-Fixtures), ohne Abhängigkeit. */
function png(w, h, farbe = [60, 90, 200]) {
  const zeilen = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    zeilen[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3;
      const f = x / w;
      zeilen[o] = Math.round(farbe[0] + (240 - farbe[0]) * f);
      zeilen[o + 1] = Math.round(farbe[1] + (240 - farbe[1]) * f);
      zeilen[o + 2] = Math.round(farbe[2] + (245 - farbe[2]) * (y / h));
    }
  }
  const chunk = (typ, daten) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(daten.length);
    const td = Buffer.concat([Buffer.from(typ, 'latin1'), daten]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(zeilen)), chunk('IEND', Buffer.alloc(0))]);
}

const BILD = png(960, 420);
const BILD_NAME = `${createHash('sha256').update(BILD).digest('hex').slice(0, 16)}.png`;

/* ── Beispielartikel ─────────────────────────────────────────────────────── */
const LANG_TEXT = `Viele Ratgeber behaupten, ein Bewerbungsportal lese nur Word. Die Anbieter selbst sagen etwas anderes, und sie widersprechen sich sogar. Dieser Absatz ist absichtlich lang, damit die Prüfung die Zeilenlänge im Lesemaß messen kann, ohne auf eine kurze Zeile hereinzufallen.`;
const ARTIKEL_A = `---
title: "PDF oder Word? Was ATS-Anbieter selbst sagen"
slug: "pdf-oder-word-ats"
description: "Greenhouse, Personio und Roche beschreiben selbst, welche Dateien ihre Systeme lesen. Ein Überblick mit Quellen und Abrufdatum."
lang: "de"
updated: "2026-10-08"
published: "2026-10-01"
---
${LANG_TEXT}

Die Kurzfassung steht im Kasten, die Belege darunter. Wer nur ==eine Sache== mitnimmt: Es kommt auf das Portal an.

:::info
Personio nennt Tabellen und mehrspaltigen Aufbau ausdrücklich als Grund für gescheitertes Auslesen.
:::

## Was Greenhouse unterstützt

Greenhouse nimmt laut [eigener Hilfeseite](https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads) .doc, .docx, .pdf, .rtf und .txt an. Node 20.11 und Version 1.2.3 sind hier nur Zahlen, keine Adressen.

### Dateigröße

Die Grenze steht ebenfalls dort.

## Was Personio schreibt

> Parsing kann scheitern, wenn Angaben in Tabellen oder mehrspaltig stehen.

| Anbieter | PDF | Word | Spalten | Quelle | Abgerufen |
|---|:---:|:---:|---|---|---|
| Greenhouse | ja | ja | keine Angabe | Hilfeseite | 08.10.2026 |
| Personio | ja | ja | problematisch | Hilfeseite | 08.10.2026 |
| Roche | ja | bevorzugt | vermeiden | Karriere-FAQ | 08.10.2026 |

## Was Roche empfiehlt

Roche nennt .docx das am genauesten auslesbare Format.

![Vorschau und PDF nebeneinander](/ratgeber/img/${BILD_NAME})

## Was das für dich heißt

- [x] Ein PDF mit echter Textebene
- [ ] Eine einspaltige Word-Fassung für Portale

\`\`\`text
Lebenslauf_Vorname_Nachname.pdf
\`\`\`

Mehr dazu im Artikel [Anschreiben aufbauen](/ratgeber/anschreiben-aufbauen/). Beispieladresse: max.muster@example.com.

<script>alert('roh')</script>

Ein Link mit [gefährlicher Adresse](javascript:alert(1)) bleibt nur Text. <img src=x onerror=alert(1)>

:::warning
Kein Anbieter garantiert, dass ein Lebenslauf fehlerfrei gelesen wird.
:::
`;

const ARTIKEL_B = `---
title: "Anschreiben aufbauen: Die vier Teile"
slug: "anschreiben-aufbauen"
description: "Einstieg, Bezug zur Stelle, Belege, Schluss: wie ein Anschreiben aufgebaut ist und was in keinen Teil gehört."
lang: "de"
updated: "2026-10-06"
---
Ein Anschreiben hat vier Teile. ${LANG_TEXT}

## Einstieg

Der erste Satz nennt die Stelle.

## Schluss

Ein Satz zum nächsten Schritt reicht.
`;

const ARTIKEL_GEHEIM = `---
title: "Präpariert"
slug: "praepariert"
description: "Dieser Artikel enthält einen Schlüssel und darf nie veröffentlicht werden, egal wie er hierher kam."
lang: "de"
updated: "2026-10-07"
---
Der Schlüssel lautet cvk_9f8e7d6c5b4a39281706.
`;

const ARTIKEL_KAPUTT = `---
title: Kaputt
slug: Falscher Slug
lang: "xx"
---
Text.
`;

function schreibeFixtures(ordner, img) {
  mkdirSync(ordner, { recursive: true });
  mkdirSync(img, { recursive: true });
  writeFileSync(join(ordner, 'pdf-oder-word-ats.md'), ARTIKEL_A);
  writeFileSync(join(ordner, 'anschreiben-aufbauen.md'), ARTIKEL_B);
  writeFileSync(join(ordner, 'praepariert.md'), ARTIKEL_GEHEIM);
  writeFileSync(join(ordner, 'kaputt.md'), ARTIKEL_KAPUTT);
  writeFileSync(join(img, BILD_NAME), BILD);
}

/* ── Server: echter nginx mit app/nginx.conf, sonst Ersatz in Node ──────── */
function nginxVorhanden() {
  return spawnSync('nginx', ['-v'], { encoding: 'utf8' }).status === 0;
}

function ratgeberCsp() {
  const conf = readFileSync(join(APP, 'nginx.conf'), 'utf8');
  const block = conf.slice(conf.indexOf('location ^~ /ratgeber/'));
  const m = /Content-Security-Policy "([^"]+)"/.exec(block);
  return m ? m[1] : null;
}

async function warteAufPort(port) {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${port}/`); return true; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  return false;
}

async function starteNginx(root) {
  const conf = readFileSync(join(APP, 'nginx.conf'), 'utf8')
    .replace(/listen\s+80;/, `listen 127.0.0.1:${NGINX_PORT};`)
    .replace(/root\s+\/usr\/share\/nginx\/html;/, `root ${root};`);
  const dir = join(TMP, 'nginx');
  mkdirSync(dir, { recursive: true });
  const temp = ['client_body', 'proxy', 'fastcgi', 'uwsgi', 'scgi'].map(n => `${n}_temp_path ${join(dir, n)};`).join('\n  ');
  const user = process.getuid && process.getuid() === 0 ? 'user root;' : '';
  writeFileSync(join(dir, 'nginx.conf'), `${user}
worker_processes 1;
daemon off;
pid ${join(dir, 'nginx.pid')};
error_log ${join(dir, 'error.log')} warn;
events { worker_connections 64; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log off;
  ${temp}
${conf}
}
`);
  const p = spawn('nginx', ['-c', join(dir, 'nginx.conf'), '-p', dir], { stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', d => { err += d; });
  if (!(await warteAufPort(NGINX_PORT))) throw new Error(`nginx startet nicht: ${err}${existsSync(join(dir, 'error.log')) ? readFileSync(join(dir, 'error.log'), 'utf8') : ''}`);
  return { stop: () => p.kill('SIGTERM'), art: 'nginx' };
}

/** Ersatz, wenn kein nginx da ist: bildet die Regeln des /ratgeber/-Blocks nach. */
async function starteNodeServer(root) {
  const csp = ratgeberCsp();
  const typen = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml' };
  const server = createServer((req, res) => {
    const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (pfad === '/ratgeber') { res.writeHead(301, { Location: '/ratgeber/' }); return res.end(); }
    let datei = join(root, pfad);
    if (pfad.startsWith('/ratgeber/')) {
      if (existsSync(datei) && statSync(datei).isDirectory()) {
        if (!pfad.endsWith('/')) { res.writeHead(301, { Location: `${pfad}/` }); return res.end(); }
        datei = join(datei, 'index.html');
      }
      const h = { 'Content-Security-Policy': csp };
      if (!existsSync(datei)) { res.writeHead(404, { ...h, 'Content-Type': typen['.html'] }); return res.end(readFileSync(join(root, 'ratgeber', '404.html'))); }
      res.writeHead(200, { ...h, 'Content-Type': typen[datei.slice(datei.lastIndexOf('.'))] || 'application/octet-stream' });
      return res.end(readFileSync(datei));
    }
    if (existsSync(datei) && statSync(datei).isFile()) { res.writeHead(200, { 'Content-Type': typen[datei.slice(datei.lastIndexOf('.'))] || 'application/octet-stream' }); return res.end(readFileSync(datei)); }
    res.writeHead(200, { 'Content-Type': typen['.html'] }); res.end(readFileSync(join(root, 'index.html')));
  });
  await new Promise(r => server.listen(NGINX_PORT, '127.0.0.1', r));
  return { stop: () => server.close(), art: 'Node-Ersatz (kein nginx installiert – Auslieferung nur nachgebildet)' };
}

/* ── Browser-Messungen ──────────────────────────────────────────────────── */
const AXE = readFileSync(join(APP, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

async function axe(page) {
  // Die CSP verbietet Skripte auf diesen Seiten; evaluate läuft über das
  // DevTools-Protokoll und ist davon nicht betroffen (addScriptTag wäre es).
  await page.evaluate(AXE);
  return page.evaluate(async () => {
    // @ts-ignore
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map(v => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
  });
}

async function messungen(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (farbe) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000'; ctx.fillStyle = farbe;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const ueber = (oben, unten) => [0, 1, 2].map(i => oben[i] * oben[3] + unten[i] * (1 - oben[3])).concat(1);
    const lum = ([r, g, b]) => {
      const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const root = getComputedStyle(document.documentElement);
    const leinwand = ['--canvas-top', '--canvas-mid', '--canvas-bottom'].map(v => rgba(root.getPropertyValue(v).trim()));
    // Hintergründe vom Element nach oben zusammensetzen; endet es auf der
    // Leinwand (Verlauf), zählt der ungünstigste der drei Verlaufspunkte.
    const hintergruende = (el) => {
      const schichten = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const c = rgba(getComputedStyle(e).backgroundColor);
        if (c[3] > 0) schichten.push(c);
        if (c[3] >= 1) return [schichten.reduceRight((acc, s) => (acc ? ueber(s, acc) : s), null)];
      }
      return leinwand.map(l => schichten.reduceRight((acc, s) => ueber(s, acc), l));
    };
    const verstoesse = [];
    let minimum = 99, gezaehlt = 0;
    for (const el of document.querySelectorAll('body *')) {
      const hatText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!hatText) continue;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (cs.visibility === 'hidden' || cs.display === 'none' || rect.width === 0 || rect.bottom < 0 || el.closest('.skip')) continue;
      if (el.closest('details:not([open])') && !el.closest('summary')) continue;
      const fg = rgba(cs.color);
      const groesse = parseFloat(cs.fontSize);
      const gross = groesse >= 24 || (groesse >= 18.66 && Number(cs.fontWeight) >= 700);
      for (const bg of hintergruende(el)) {
        const r = ratio(ueber(fg, bg), bg);
        gezaehlt++;
        minimum = Math.min(minimum, r);
        if (r < (gross ? 3 : 4.5)) verstoesse.push(`${el.tagName.toLowerCase()}.${el.className || ''} „${el.textContent.trim().slice(0, 30)}" ${r.toFixed(2)}:1`);
      }
    }
    // Zeilenlänge: mittlere Zeichenbreite im Fließtext → Zeichen je Zeile.
    let zeichenJeZeile = null;
    const p = [...document.querySelectorAll('.prosa > p')].sort((a, b) => b.textContent.length - a.textContent.length)[0];
    if (p) {
      const cs = getComputedStyle(p);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const t = p.textContent.replace(/\s+/g, ' ');
      zeichenJeZeile = Math.round(p.clientWidth / (ctx.measureText(t).width / t.length));
    }
    const ueberstand = [...document.querySelectorAll('body *')].filter(e => {
      if (e.closest('.tabelle, pre')) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > window.innerWidth + 1;
    }).slice(0, 5).map(e => `${e.tagName.toLowerCase()}.${e.className}`);
    const geist = [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Geist Variable' && f.status === 'loaded');
    return {
      waagerecht: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ueberstand, verstoesse, minimum: Math.round(minimum * 100) / 100, gezaehlt, zeichenJeZeile, geist,
      skripte: [...document.scripts].map(s => s.type),
    };
  });
}

/* ── Nachgebaute Outline-API ─────────────────────────────────────────────── */
function outlineAttrappe({ token, collectionId, docs, fremdPort }) {
  const protokoll = { listen: [], authFehlt: 0, collectionFalsch: 0 };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const auth = req.headers.authorization === `Bearer ${token}`;
    if (!auth) { protokoll.authFehlt++; res.writeHead(401); return res.end('{}'); }
    if (url.pathname === '/api/attachments.redirect') {
      const id = url.searchParams.get('id');
      if (id === 'bild-1') { res.writeHead(302, { Location: `http://127.0.0.1:${fremdPort()}/speicher/bild-1.png` }); return res.end(); }
      if (id === 'bild-svg') { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'); }
      res.writeHead(404); return res.end();
    }
    let body = '';
    for await (const c of req) body += c;
    const j = body ? JSON.parse(body) : {};
    res.setHeader('Content-Type', 'application/json');
    if (docs.fehler) { res.writeHead(500); return res.end('{"ok":false}'); }
    if (url.pathname === '/api/documents.list') {
      protokoll.listen.push(j);
      if (j.collectionId !== collectionId) { protokoll.collectionFalsch++; return res.end(JSON.stringify({ data: [] })); }
      const seite = docs.liste.slice(j.offset || 0, (j.offset || 0) + (j.limit || 25)).map(d => ({ ...d, text: d.ohneText ? undefined : d.text }));
      return res.end(JSON.stringify({ data: seite, pagination: { offset: j.offset, limit: j.limit } }));
    }
    if (url.pathname === '/api/documents.info') {
      const d = docs.liste.find(x => x.id === j.id);
      return res.end(JSON.stringify({ data: d ? { ...d } : null }));
    }
    if (url.pathname === '/api/documents.export') {
      const d = docs.liste.find(x => x.id === j.id);
      return res.end(JSON.stringify({ data: d ? `# ${d.title}\n\n${d.text}` : '' }));
    }
    res.writeHead(404); res.end('{}');
  });
  return { server, protokoll };
}

function speicherAttrappe() {
  const protokoll = { abrufe: 0, mitAuth: 0 };
  const server = createServer((req, res) => {
    protokoll.abrufe++;
    if (req.headers.authorization) protokoll.mitAuth++;
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(BILD);
  });
  return { server, protokoll };
}

const lauschen = s => new Promise(r => s.listen(0, '127.0.0.1', () => r(s.address().port)));

function verzeichnisHash(ordner) {
  if (!existsSync(ordner)) return 'leer';
  const h = createHash('sha256');
  for (const n of readdirSync(ordner).sort()) { h.update(n); const p = join(ordner, n); if (statSync(p).isFile()) h.update(readFileSync(p)); }
  return h.digest('hex');
}

/* ═════════════════════════════════════════════════════════════════════════ */

async function main() {
  console.log(`Ratgeber-Prüflauf · Arbeitsordner ${TMP}`);

  abschnitt('0 · Echte Artikel in content/ratgeber');
  const echt = leseArtikel(join(APP, 'content', 'ratgeber'));
  if (!echt.length) console.log('  (noch keine Artikeldateien)');
  for (const a of echt) {
    const name = a.datei.split('/').pop();
    ok(!a.fehler.length, `${name}: Frontmatter gültig`, a.fehler.join('\n'));
    if (!a.fehler.length) {
      const t = pruefeText(`${a.meta.title}\n${a.meta.description}\n${a.body}`);
      ok(!t.length, `${name}: Sperrliste ohne Treffer`, t.map(x => `Zeile ${x.zeile}: ${x.muster} – ${x.auszug}`).join('\n'));
    }
  }

  abschnitt('1 · Sperrliste (beide Richtungen)');
  const dom = new URL(STANDARD_BASIS).host.split('.').slice(-2).join('.');
  const imp = impressumsEmail();
  ok(Boolean(imp), 'Impressumsadresse aus src/data/operator.ts gelesen');
  const sollTreffen = [
    ['API-Schlüssel cvk_', 'Mein Schlüssel cvk_9f8e7d6c5b4a3928'],
    ['MCP-Token cvm_', 'Token cvm_abc'],
    ['Mollie test_', 'test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM'],
    ['Mollie live_', 'live_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM'],
    ['Outline-Schlüssel', 'ol_api_AbCdEfGhIjKlMnOpQrStUvWx'],
    ['Passwortzuweisung', 'Passwort: Sommer2024!'],
    ['Bearer', 'Authorization: Bearer abcdefghijklmnop1234'],
    ['Wiki-Domain', `siehe https://wiki.${dom}/doc/abc-XyZ1234567`],
    ['Git-Domain', `git clone https://git.${dom}/team/cv`],
    ['intranet.', 'https://intranet.firma.de/start'],
    ['sslip.io', 'http://10-0-0-1.sslip.io/'],
    ['IPv4', 'Server 10.0.0.5 neu starten'],
    ['IPv6', 'Adresse 2a01:4f8:c012:abcd::1'],
    ['fremde E-Mail', 'schreib an max@firma-intern.de'],
    ['JWT', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijk'],
    // Zusammengesetzt, damit scripts/neutralcheck.sh die Testzeile nicht für einen Schlüssel hält.
    ['PEM', '-----BEGIN OPENSSH ' + 'PRIVATE KEY-----'],
    ['Wiki-Verweis', '[intern](/doc/strategie-AbCdEfGhIj)'],
    ['Zugangsdaten in URL', 'https://admin:geheim@example.org/'],
  ];
  for (const [name, text] of sollTreffen) ok(pruefeText(text).length > 0, `schlägt an: ${name}`);
  const sollNicht = [
    ['Quellen-URL mit langem Pfad', 'https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads'],
    ['öffentliche Adresse', `Probier ${STANDARD_BASIS}/demo aus`],
    ['Agentur-Domain', `https://${dom}/ und https://www.${dom}/`],
    ['Impressumsadresse', `Fragen an ${imp}`],
    ['Beispieladresse', 'max.muster@example.com, erika@bewerbung.test'],
    ['Versionsnummern', 'Node 20.11, Version 1.2.3, arXiv 2511.04453'],
    ['Passwort-Ratschlag', 'Passwort: mindestens zwölf Zeichen'],
    ['Uhrzeit', 'Um 12:30 Uhr'],
    ['Wort „Token" im Text', 'Ein Token ist eine Zugangsmarke.'],
    ['test_ als Wort', 'Datei test_lebenslauf.pdf'],
  ];
  for (const [name, text] of sollNicht) ok(pruefeText(text).length === 0, `schlägt nicht an: ${name}`, JSON.stringify(pruefeText(text)));

  abschnitt('2 · Bau mit Beispielartikeln');
  const inhalt = join(TMP, 'inhalt');
  const img = join(TMP, 'img');
  const out = join(TMP, 'out');
  schreibeFixtures(inhalt, img);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.html'), '<!doctype html><html lang="de"><head><title>SPA</title></head><body><div id="root">SPA-HUELLE</div></body></html>');
  cpSync(join(APP, 'public', 'favicon.svg'), join(out, 'favicon.svg'));
  cpSync(join(APP, 'public', 'robots.txt'), join(out, 'robots.txt'));
  const bau = node('ratgeber-build.mjs', { RATGEBER_CONTENT_DIR: inhalt, RATGEBER_IMG_DIR: img, RATGEBER_OUT_DIR: out, PUBLIC_BASE_URL: `${BASIS_TEST}/` });
  ok(bau.code === 0, 'Bau läuft durch (Exit 0)', bau.out);
  ok(/2 Artikel gebaut, 2 übersprungen/.test(bau.out), 'genau zwei Artikel gebaut, zwei übersprungen', bau.out);
  ok(/praepariert\.md GESPERRT/.test(bau.out) && /API-Schlüssel \(cvk_\)/.test(bau.out), 'präparierter Artikel von der Sperrliste zurückgehalten');
  ok(!bau.out.includes('cvk_9f8e7d6c5b4a39281706'), 'Schlüssel erscheint nicht im Log');
  ok(/kaputt\.md übersprungen/.test(bau.out), 'Artikel mit kaputtem Frontmatter übersprungen');
  ok(!existsSync(join(out, 'ratgeber', 'praepariert')) && !existsSync(join(out, 'ratgeber', 'kaputt')), 'keine Ausgabe für zurückgehaltene Artikel');
  ok(/rohes HTML verworfen/.test(bau.out) && /Link entfernt/.test(bau.out), 'rohes HTML und javascript:-Link gemeldet');

  abschnitt('3 · Ausgabe statisch');
  const seiten = ['ratgeber/index.html', 'ratgeber/pdf-oder-word-ats/index.html', 'ratgeber/anschreiben-aufbauen/index.html', 'ratgeber/404.html'];
  const hv = new HtmlValidate({ extends: ['html-validate:recommended'], rules: { 'no-trailing-whitespace': 'off', 'long-title': 'off' } });
  for (const s of seiten) {
    const html = readFileSync(join(out, s), 'utf8');
    const r = await hv.validateString(html, s);
    ok(r.valid, `${s}: HTML valide (html-validate)`, r.results.flatMap(x => x.messages.map(m => `${m.line}:${m.column} ${m.ruleId} ${m.message}`)).slice(0, 8).join('\n'));
    const skripte = [...html.matchAll(/<script\b([^>]*)>/gi)].map(m => m[1]);
    ok(skripte.every(a => /type="application\/ld\+json"/.test(a)), `${s}: kein Skript außer JSON-LD`, skripte.join(' | '));
    ok(!/\sstyle=/.test(html) && !/\son[a-z]+=/i.test(html), `${s}: keine style- und on*-Attribute`);
    ok(!/<script>alert|javascript:|onerror/.test(html), `${s}: nichts aus dem rohen HTML übrig`);
    ok(!/https?:\/\/(?!ratgeber-test\.example|schema\.org|support\.greenhouse\.io|www\.w3\.org)/.test(html.replace(/<a [^>]*rel="noopener external"[^>]*>/g, '')), `${s}: keine eingebundenen Fremdadressen`);
  }
  const a = readFileSync(join(out, 'ratgeber', 'pdf-oder-word-ats', 'index.html'), 'utf8');
  ok(a.includes(`<link rel="canonical" href="${BASIS_TEST}/ratgeber/pdf-oder-word-ats/">`), 'canonical aus PUBLIC_BASE_URL (Schrägstrich am Ende entfernt)');
  ok(a.includes(`<meta property="og:url" content="${BASIS_TEST}/ratgeber/pdf-oder-word-ats/">`) && a.includes('og:type" content="article"') && a.includes('og:title') && a.includes('og:description'), 'Open-Graph-Angaben vollständig');
  ok(/<meta name="description" content="Greenhouse, Personio und Roche/.test(a), 'meta description aus dem Frontmatter');
  ok(/<title>PDF oder Word\? Was ATS-Anbieter selbst sagen · /.test(a), '<title> mit Artikeltitel');
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(a)[1]);
  ok(ld['@type'] === 'Article' && ld.dateModified === '2026-10-08' && ld.datePublished === '2026-10-01' && ld.mainEntityOfPage['@id'] === `${BASIS_TEST}/ratgeber/pdf-oder-word-ats/`, 'JSON-LD Article mit dateModified, datePublished und @id');
  ok(/<nav class="toc"/.test(a), 'langer Artikel hat ein Inhaltsverzeichnis');
  ok(!/<nav class="toc"/.test(readFileSync(join(out, 'ratgeber', 'anschreiben-aufbauen', 'index.html'), 'utf8')), 'kurzer Artikel hat keines');
  ok(/<a href="https:\/\/support\.greenhouse\.io[^"]*" rel="noopener external">/.test(a), 'externer Link mit rel="noopener"');
  ok(/<a href="\/ratgeber\/anschreiben-aufbauen\/">/.test(a) && !/href="\/ratgeber\/anschreiben-aufbauen\/" rel=/.test(a), 'interner Link ohne rel');
  ok(a.includes(`src="/ratgeber/img/${BILD_NAME}"`) && existsSync(join(out, 'ratgeber', 'img', BILD_NAME)), 'Bild eingebunden und kopiert');
  ok(/<div class="kasten kasten-hinweis">/.test(a) && /<div class="kasten kasten-warnung">/.test(a) && /<mark>eine Sache<\/mark>/.test(a), 'Outline-Hinweiskästen und Markierungen umgesetzt');
  const css = readdirSync(join(out, 'ratgeber', 'assets'));
  ok(css.some(n => /^ratgeber\.[a-f0-9]{10}\.css$/.test(n)) && css.some(n => /^geist-latin-wght-normal\.[a-f0-9]{10}\.woff2$/.test(n)), 'CSS und Geist mit Inhalts-Hash ausgeliefert');
  const sm = readFileSync(join(out, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).sort();
  const erwartet = [`${BASIS_TEST}/`, `${BASIS_TEST}/preise`, `${BASIS_TEST}/ratgeber/`, `${BASIS_TEST}/ratgeber/anschreiben-aufbauen/`, `${BASIS_TEST}/ratgeber/pdf-oder-word-ats/`].sort();
  ok(JSON.stringify(locs) === JSON.stringify(erwartet), 'Sitemap enthält Startseite, /preise, Übersicht und alle Artikel (und nur die)', locs.join('\n'));
  ok(/<lastmod>2026-10-08<\/lastmod>/.test(sm), 'Sitemap mit lastmod');
  const rb = readFileSync(join(out, 'robots.txt'), 'utf8');
  ok(rb.includes(`Sitemap: ${BASIS_TEST}/sitemap.xml`) && (rb.match(/^Sitemap:/gm) || []).length === 1, 'robots.txt mit genau einer Sitemap-Zeile auf die Basis');
  ok(/Disallow: \/share\//.test(rb), 'robots.txt behält Disallow /share/');
  const std = join(TMP, 'out-standard');
  mkdirSync(std, { recursive: true });
  const bauStd = node('ratgeber-build.mjs', { RATGEBER_CONTENT_DIR: inhalt, RATGEBER_IMG_DIR: img, RATGEBER_OUT_DIR: std, PUBLIC_BASE_URL: '' });
  ok(bauStd.code === 0 && readFileSync(join(std, 'ratgeber', 'anschreiben-aufbauen', 'index.html'), 'utf8').includes(`href="${STANDARD_BASIS}/ratgeber/anschreiben-aufbauen/"`), 'ohne PUBLIC_BASE_URL: Standardbasis');

  abschnitt('4 · Auslieferung');
  const server = nginxVorhanden() ? await starteNginx(out) : await starteNodeServer(out);
  console.log(`  (Server: ${server.art})`);
  const B = `http://127.0.0.1:${NGINX_PORT}`;
  try {
    let r = await fetch(`${B}/ratgeber/pdf-oder-word-ats/`, { redirect: 'manual' });
    const text = await r.text();
    ok(r.status === 200 && text.includes('PDF oder Word?') && !text.includes('SPA-HUELLE'), '/ratgeber/<slug>/ liefert die statische Seite, nicht die SPA');
    ok((r.headers.get('content-security-policy') || '').includes("script-src 'none'") || (r.headers.get('content-security-policy') || '').includes("default-src 'none'"), 'strenge CSP auf Ratgeber-Seiten', r.headers.get('content-security-policy'));
    ok(/no-cache/.test(r.headers.get('cache-control') || '') || server.art !== 'nginx', 'HTML ohne Langzeit-Cache');
    r = await fetch(`${B}/ratgeber/gibt-es-nicht/`, { redirect: 'manual' });
    const t404 = await r.text();
    ok(r.status === 404 && t404.includes('noindex') && !t404.includes('SPA-HUELLE'), 'unbekannter Artikel → 404-Seite (noindex), keine SPA');
    r = await fetch(`${B}/ratgeber/pdf-oder-word-ats`, { redirect: 'manual' });
    ok(r.status === 301 && r.headers.get('location') === '/ratgeber/pdf-oder-word-ats/', 'ohne Schrägstrich → 301 relativ auf die kanonische Adresse', `${r.status} ${r.headers.get('location')}`);
    r = await fetch(`${B}/ratgeber`, { redirect: 'manual' });
    ok(r.status === 301 && r.headers.get('location') === '/ratgeber/', '/ratgeber → 301 /ratgeber/', `${r.status} ${r.headers.get('location')}`);
    const cssName = css.find(n => n.endsWith('.css'));
    r = await fetch(`${B}/ratgeber/assets/${cssName}`);
    ok(r.status === 200 && (server.art !== 'nginx' || /immutable/.test(r.headers.get('cache-control') || '')), 'Assets mit immutable-Cache', r.headers.get('cache-control'));
    r = await fetch(`${B}/ratgeber/img/${BILD_NAME}`);
    ok(r.status === 200 && (r.headers.get('content-type') || '').startsWith('image/png'), 'Bild wird ausgeliefert');
    r = await fetch(`${B}/sitemap.xml`);
    ok(r.status === 200 && (await r.text()).includes('/ratgeber/'), '/sitemap.xml erreichbar');
    r = await fetch(`${B}/irgendwas`);
    ok((await r.text()).includes('SPA-HUELLE'), 'übrige Adressen weiter über die SPA');

    abschnitt('5 · Browser: axe, Kontrast, Breite, Schrift, CSP');
    const browser = await chromium.launch({ executablePath: EXECUTABLE });
    try {
      for (const [w, h] of [[1440, 950], [390, 844]]) {
        for (const pfad of ['/ratgeber/', '/ratgeber/pdf-oder-word-ats/', '/ratgeber/anschreiben-aufbauen/', '/ratgeber/gibt-es-nicht/']) {
          const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'de-DE' });
          const meldungen = [];
          const fremd = [];
          page.on('console', m => { if (/Content Security Policy|Refused to/i.test(m.text())) meldungen.push(m.text()); });
          page.on('request', q => { if (!q.url().startsWith(B) && !q.url().startsWith('data:')) fremd.push(q.url()); });
          await page.goto(`${B}${pfad}`, { waitUntil: 'networkidle' });
          const m = await messungen(page);
          const v = await axe(page);
          const n = `${w}px ${pfad}`;
          ok(v.length === 0, `${n}: axe ohne Verstöße`, v.join('\n'));
          ok(m.waagerecht <= 0 && m.ueberstand.length === 0, `${n}: kein waagerechtes Scrollen`, `scrollWidth−clientWidth=${m.waagerecht}; ${m.ueberstand.join(', ')}`);
          ok(m.verstoesse.length === 0, `${n}: Kontrast aller ${m.gezaehlt} Textstellen ≥ 4,5:1 (min. ${m.minimum}:1)`, m.verstoesse.slice(0, 6).join('\n'));
          ok(m.geist, `${n}: Geist geladen (selbst ausgeliefert)`);
          ok(meldungen.length === 0, `${n}: keine CSP-Verletzung`, meldungen.join('\n'));
          ok(fremd.length === 0, `${n}: keine Anfrage an fremde Hosts`, fremd.join('\n'));
          ok(m.skripte.every(t => t === 'application/ld+json'), `${n}: keine ausführbaren Skripte im DOM`);
          if (pfad === '/ratgeber/pdf-oder-word-ats/' && w === 1440) ok(m.zeichenJeZeile >= 55 && m.zeichenJeZeile <= 72, `Zeilenlänge im Fließtext ${m.zeichenJeZeile} Zeichen (Ziel ≈ 68)`);
          await page.close();
        }
      }
      // Bildschirmfotos: mit den echten Artikeln, falls vorhanden.
      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        const gueltig = echt.filter(x => !x.fehler.length);
        let shotOut = out;
        let artikelSlug = 'pdf-oder-word-ats';
        if (gueltig.length) {
          shotOut = join(TMP, 'out-echt');
          mkdirSync(shotOut, { recursive: true });
          cpSync(join(out, 'index.html'), join(shotOut, 'index.html'));
          cpSync(join(APP, 'public', 'favicon.svg'), join(shotOut, 'favicon.svg'));
          const rb2 = node('ratgeber-build.mjs', { RATGEBER_OUT_DIR: shotOut });
          console.log(`  (Bau mit echten Artikeln: ${rb2.out.trim().split('\n').pop()})`);
          const lang = gueltig.map(x => ({ slug: x.meta.slug, n: x.body.length })).sort((p, q) => q.n - p.n)[0];
          artikelSlug = lang.slug;
          server.stop();
          const s2 = nginxVorhanden() ? await starteNginx(shotOut) : await starteNodeServer(shotOut);
          server.stop = s2.stop;
        }
        for (const [w, h] of [[1440, 950], [390, 844]]) {
          const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'de-DE', deviceScaleFactor: w < 500 ? 2 : 1 });
          for (const [pfad, name] of [['/ratgeber/', 'uebersicht'], [`/ratgeber/${artikelSlug}/`, 'artikel']]) {
            await page.goto(`${B}${pfad}`, { waitUntil: 'networkidle' });
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: join(SHOTS, `${name}-${w}.png`), fullPage: true });
            await page.screenshot({ path: join(SHOTS, `${name}-${w}-oben.png`), fullPage: false });
          }
          await page.close();
        }
        console.log(`  Bildschirmfotos → ${SHOTS} (Artikel: ${artikelSlug})`);
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.stop();
  }

  abschnitt('6 · Sync gegen nachgebaute Outline-API');
  const TOKEN = 'ol_api_attrappe_nur_fuer_den_test';
  const COLL = '00000000-0000-4000-8000-000000000001';
  const speicher = speicherAttrappe();
  const speicherPort = await lauschen(speicher.server);
  const jetzt = '2026-10-09T08:00:00.000Z';
  const doc = (id, urlId, title, text, extra = {}) => ({ id, urlId, title, text, collectionId: COLL, publishedAt: jetzt, updatedAt: jetzt, archivedAt: null, deletedAt: null, language: 'de', template: false, ...extra });
  const docs = {
    liste: [
      doc('d1', 'Aa11111111', 'ATS: Was Anbieter selbst sagen', `Beschreibung: Was Greenhouse, Personio und Roche selbst über PDF, Word und Spalten schreiben.\n\nErster Absatz.\n\\\n\n![Vorschau](/api/attachments.redirect?id=bild-1)\n\n![Fremd](https://example.org/x.png)\n\n![SVG](/api/attachments.redirect?id=bild-svg)\n\nWeiter mit [Anschreiben](/doc/anschreiben-richtig-aufbauen-Bb22222222#h-einstieg).`),
      doc('d2', 'Bb22222222', 'Anschreiben richtig aufbauen', 'Ein Anschreiben hat vier Teile, und jeder Teil hat genau eine Aufgabe. Fragen an die Impressumsadresse.\n\n## Einstieg\n\nText.', { ohneText: true }),
      doc('d3', 'Cc33333333', 'Präpariert mit Schlüssel', 'Zum Testen: cvk_9f8e7d6c5b4a39281706'),
      doc('d4', 'Dd44444444', 'Entwurf', 'Noch nicht fertig.', { publishedAt: null }),
      doc('d5', 'Ee55555555', ANLEITUNG_TITEL, 'Anleitung.'),
      doc('d6', 'Ff66666666', 'Mit internem Server', 'Läuft auf http://10.0.0.5:3000'),
      doc('d7', 'Gg77777777', 'Mit fremder Mail', 'Schreib an max@firma-intern.de'),
      doc('d8', 'Hh88888888', 'Mit Mollie-Schlüssel', 'test_dHar4XY7LxsDOtmnkVtjNVWXLSlXsM'),
      doc('d9', 'Ii99999999', 'Andere Sammlung', 'Gehört nicht hierher.', { collectionId: 'fremd' }),
      doc('d10', 'Jj10101010', 'Archiviert', 'Alt.', { archivedAt: jetzt }),
    ],
  };
  const outline = outlineAttrappe({ token: TOKEN, collectionId: COLL, docs, fremdPort: () => speicherPort });
  const outlinePort = await lauschen(outline.server);
  const sInhalt = join(TMP, 'sync-inhalt');
  const sImg = join(TMP, 'sync-img');
  mkdirSync(sInhalt, { recursive: true });
  const eigen = `---\ntitle: "Eigener Artikel"\nslug: "eigener-artikel"\ndescription: "Direkt im Repo geschrieben, ohne Outline. Der Sync darf ihn nie anfassen."\nlang: "de"\nupdated: "2026-10-01"\n---\nText.\n`;
  writeFileSync(join(sInhalt, 'eigener-artikel.md'), eigen);
  const syncEnv = { OUTLINE_URL: `http://127.0.0.1:${outlinePort}/`, OUTLINE_RATGEBER_TOKEN: TOKEN, OUTLINE_RATGEBER_COLLECTION: COLL, RATGEBER_CONTENT_DIR: sInhalt, RATGEBER_IMG_DIR: sImg, PUBLIC_BASE_URL: 'https://cv.beispiel-firma.de' };
  const s1 = await nodeAsync('ratgeber-sync.mjs', syncEnv);
  const dateien = readdirSync(sInhalt).sort();
  ok(s1.code === 0, 'Sync läuft durch (Exit 0)', s1.out);
  ok(JSON.stringify(dateien) === JSON.stringify(['anschreiben-richtig-aufbauen.md', 'ats-was-anbieter-selbst-sagen.md', 'eigener-artikel.md']), 'nur die zwei sauberen, veröffentlichten Dokumente übernommen (+ Repo-Artikel)', dateien.join(', ') + '\n' + s1.out);
  ok(outline.protokoll.authFehlt === 0 && outline.protokoll.collectionFalsch === 0 && outline.protokoll.listen.every(l => l.collectionId === COLL), 'API mit Token und nur mit der Sammlungs-ID abgefragt');
  for (const t of ['Präpariert mit Schlüssel', 'Mit internem Server', 'Mit fremder Mail', 'Mit Mollie-Schlüssel']) ok(s1.out.includes(`„${t}" GESPERRT`), `gesperrt: ${t}`);
  ok(!/cvk_9f8e7d6c5b4a39281706|dHar4XY7LxsDOtmnkVtjNVWXLSlXsM|max@firma-intern/.test(s1.out), 'gesperrte Werte stehen nicht vollständig im Log');
  ok(s1.out.includes(`„${ANLEITUNG_TITEL}" übersprungen`), 'Anleitung übersprungen');
  ok(!s1.out.includes('Entwurf') && !s1.out.includes('Andere Sammlung') && !s1.out.includes('Archiviert'), 'Entwurf, Archiv und fremde Sammlung nicht angefasst');
  const d1 = parseFrontmatter(readFileSync(join(sInhalt, 'ats-was-anbieter-selbst-sagen.md'), 'utf8'));
  ok(d1.meta.description === 'Was Greenhouse, Personio und Roche selbst über PDF, Word und Spalten schreiben.' && !d1.body.includes('Beschreibung:'), 'Beschreibung aus der ersten Zeile übernommen und entfernt');
  ok(d1.meta.outlineId === 'd1' && d1.meta.updated === '2026-10-09' && d1.meta.lang === 'de', 'Frontmatter mit outlineId, updated, lang');
  const bilder = existsSync(sImg) ? readdirSync(sImg) : [];
  ok(bilder.length === 1 && d1.body.includes(`![Vorschau](/ratgeber/img/${bilder[0]})`), 'Outline-Anhang heruntergeladen und eingesetzt');
  ok(speicher.protokoll.abrufe === 1 && speicher.protokoll.mitAuth === 0, 'Token nicht an den Speicher-Host weitergereicht (Weiterleitung auf fremden Host)');
  ok(!d1.body.includes('example.org') && !d1.body.includes('SVG') && !d1.body.includes('attachments.redirect'), 'fremdes Bild und SVG-Anhang entfernt');
  ok(d1.body.includes('](/ratgeber/anschreiben-richtig-aufbauen/#einstieg)'), 'Querverweis auf Outline-Dokument → /ratgeber/<slug>/ mit Anker');
  ok(!/^\\$/m.test(d1.body), 'Outline-Leerabsätze („\\") entfernt');
  const d2 = parseFrontmatter(readFileSync(join(sInhalt, 'anschreiben-richtig-aufbauen.md'), 'utf8'));
  ok(d2.meta.description.startsWith('Ein Anschreiben hat vier Teile') && !d2.body.startsWith('# '), 'Text über documents.info/export nachgeladen, Titelzeile entfernt, Beschreibung aus erstem Absatz');
  ok(readFileSync(join(sInhalt, 'eigener-artikel.md'), 'utf8') === eigen, 'Repo-Artikel ohne outlineId unverändert');

  const s1b = await nodeAsync('ratgeber-sync.mjs', syncEnv);
  ok(/2 unverändert/.test(s1b.out) && /0 geschrieben/.test(s1b.out), 'zweiter Lauf ohne Änderung schreibt nichts', s1b.out.split('\n').pop());

  // Von Hand gesetzte Beschreibung bleibt, wenn Outline keine „Beschreibung:"-Zeile hat.
  const d2pfad = join(sInhalt, 'anschreiben-richtig-aufbauen.md');
  writeFileSync(d2pfad, readFileSync(d2pfad, 'utf8').replace(/^description: .*$/m, 'description: "Von Hand gesetzt: vier Teile eines Anschreibens und was in keinen davon gehört."'));
  docs.liste[1].text += '\n\nNeuer Absatz.';
  const s1c = await nodeAsync('ratgeber-sync.mjs', syncEnv);
  const d2b = parseFrontmatter(readFileSync(d2pfad, 'utf8'));
  ok(d2b.body.includes('Neuer Absatz.') && d2b.meta.description.startsWith('Von Hand gesetzt'), 'von Hand gesetzte Beschreibung übersteht den Sync', s1c.out);

  docs.liste[0].title = 'ATS: Was die Anbieter sagen (neu)';
  docs.liste.splice(1, 1);
  const s2 = await nodeAsync('ratgeber-sync.mjs', syncEnv);
  const dateien2 = readdirSync(sInhalt).sort();
  ok(!dateien2.includes('anschreiben-richtig-aufbauen.md') && /entfernt \(in Outline nicht mehr veröffentlicht\)/.test(s2.out), 'zurückgezogenes Dokument entfernt');
  const d1neu = parseFrontmatter(readFileSync(join(sInhalt, 'ats-was-anbieter-selbst-sagen.md'), 'utf8'));
  ok(d1neu.meta.title.includes('(neu)'), 'Titeländerung behält den Slug (geteilte Adressen bleiben gültig)', s2.out);
  ok(d1neu.body.includes('Weiter mit Anschreiben.') && !d1neu.body.includes('/doc/') && /Verweis auf ein Wiki-Dokument außerhalb/.test(s2.out), 'Verweis auf nicht mehr veröffentlichtes Dokument → nur noch Text');

  const vorher = verzeichnisHash(sInhalt);
  docs.fehler = true;
  const s3 = await nodeAsync('ratgeber-sync.mjs', syncEnv);
  ok(s3.code === 0 && verzeichnisHash(sInhalt) === vorher && /Sync abgebrochen/.test(s3.out), 'Outline-Fehler (HTTP 500): nichts geändert, Exit 0');
  const s3s = await nodeAsync('ratgeber-sync.mjs', { ...syncEnv, RATGEBER_SYNC_STRICT: '1' });
  ok(s3s.code === 1, 'mit RATGEBER_SYNC_STRICT=1 Exit 1');
  docs.fehler = false;
  const falsch = await nodeAsync('ratgeber-sync.mjs', { ...syncEnv, OUTLINE_RATGEBER_TOKEN: 'falsch' });
  ok(falsch.code === 0 && verzeichnisHash(sInhalt) === vorher, 'falscher Token (401): nichts geändert, Exit 0');

  abschnitt('7 · Ohne Token');
  const ohne = await nodeAsync('ratgeber-sync.mjs', { ...syncEnv, OUTLINE_RATGEBER_TOKEN: '' });
  ok(ohne.code === 0 && /nicht gesetzt – Sync übersprungen/.test(ohne.out) && verzeichnisHash(sInhalt) === vorher, 'Sync ohne Token tut nichts, Exit 0');
  const ohneSammlung = await nodeAsync('ratgeber-sync.mjs', { ...syncEnv, OUTLINE_RATGEBER_COLLECTION: '' });
  ok(ohneSammlung.code === 0 && /OUTLINE_RATGEBER_COLLECTION nicht gesetzt/.test(ohneSammlung.out) && verzeichnisHash(sInhalt) === vorher, 'Sync ohne Sammlungs-ID tut nichts, Exit 0 (keine eingebaute ID)');
  const outOhne = join(TMP, 'out-ohne-token');
  const bauOhne = node('ratgeber-build.mjs', { RATGEBER_CONTENT_DIR: sInhalt, RATGEBER_IMG_DIR: sImg, RATGEBER_OUT_DIR: outOhne, OUTLINE_RATGEBER_TOKEN: '', OUTLINE_URL: '' });
  ok(bauOhne.code === 0 && existsSync(join(outOhne, 'ratgeber', 'ats-was-anbieter-selbst-sagen', 'index.html')) && existsSync(join(outOhne, 'ratgeber', 'eigener-artikel', 'index.html')), 'Bau ohne Token mit vorhandenen Dateien', bauOhne.out);
  const leer = join(TMP, 'out-leer');
  const bauLeer = node('ratgeber-build.mjs', { RATGEBER_CONTENT_DIR: join(TMP, 'gibt-es-nicht'), RATGEBER_OUT_DIR: leer });
  ok(bauLeer.code === 0 && existsSync(join(leer, 'ratgeber', 'index.html')) && existsSync(join(leer, 'sitemap.xml')), 'Bau ohne einen einzigen Artikel (leere Übersicht)', bauLeer.out);

  outline.server.close();
  speicher.server.close();

  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden${fehler ? `, ${fehler} FEHLGESCHLAGEN` : ''}.`);
  if (!process.env.RATGEBERCHECK_BEHALTEN) rmSync(TMP, { recursive: true, force: true });
  process.exit(fehler ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
