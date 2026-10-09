// Der PDF-Renderer gegen einen Kanarienvogel-Server (N1, N2 aus dem
// Technik-Bericht vom 08.10.2026).
//
// Der Nachweis des Technik-Agenten (pdfprobe2.mjs): `<link rel="prefetch">`
// und `<link rel="prerender">` laufen an `page.route()` vorbei und erreichen
// einen Dienst auf 127.0.0.1. Dieser Test führt denselben Versuch zweimal:
// einmal ohne die Abhilfe (der Kanarienvogel MUSS singen, sonst beweist der
// Test nichts) und einmal mit dem echten Renderer (er darf es nicht).
//
// Braucht ein Chromium. Fehlt es, wird übersprungen.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { chromium } from 'playwright';
import { createRenderer, MAX_PAGES } from './pdf.js';
import { isPdfFetchAllowed } from './ssrf.js';
import { findChromium, pdfPageCount } from './testkit.mjs';

const exe = findChromium();
const skip = exe ? false : 'kein Chromium gefunden (PDF_CHROMIUM_PATH setzen)';

let srv, port, hits = [];
before(async () => {
  srv = http.createServer((q, r) => {
    hits.push(`${q.headers.host}${q.url}`);
    r.setHeader('Content-Type', q.url.endsWith('.css') ? 'text/css' : 'text/plain');
    r.end(q.url.endsWith('.css') ? 'p{color:#c00}' : 'INTERN');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  port = srv.address().port;
});
after(() => srv?.close());

const attack = () => `<!doctype html><p>Lebenslauf</p>
  <link rel="prefetch" href="http://127.0.0.1:${port}/prefetch">
  <link rel="prerender" href="http://127.0.0.1:${port}/prerender">
  <link rel="prefetch" href="http://localhost:${port}/prefetch-name">
  <link rel="prefetch" href="http://[::1]:${port}/prefetch-v6">
  <link rel="preload" as="image" href="http://127.0.0.1:${port}/preload">
  <img src="http://127.0.0.1:${port}/img">
  <iframe src="http://127.0.0.1:${port}/iframe"></iframe>`;

test('Gegenprobe ohne Abhilfe: Prefetch erreicht den internen Dienst (der Test ist scharf)', { skip }, async () => {
  const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const ctx = await b.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.route('**', r => (isPdfFetchAllowed(r.request().url(), 'cv.example.org') ? r.continue() : r.abort()));
    hits = [];
    await page.setContent(attack(), { waitUntil: 'networkidle', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1500);
    assert.ok(hits.some(h => h.includes('/prefetch') || h.includes('/prerender')),
      `ohne --host-resolver-rules hätte der Kanarienvogel singen müssen: ${JSON.stringify(hits)}`);
    // Die Route allein hält img/iframe/preload auf — nur Prefetch/Prerender nicht.
    assert.ok(!hits.some(h => /\/(img|iframe|preload)$/.test(h)), JSON.stringify(hits));
  } finally { await b.close(); }
});

test('mit Abhilfe: kein einziger Aufruf beim internen Dienst, PDF entsteht trotzdem', { skip }, async () => {
  const r = createRenderer({ hosts: ['cv.example.org'], executablePath: exe });
  try {
    hits = [];
    const pdf = await r.render(attack(), { ownHost: 'cv.example.org' });
    await new Promise(res => setTimeout(res, 1500));      // späte Prefetches abwarten
    assert.deepEqual(hits, []);
    assert.ok(pdf.length > 500);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  } finally { await r.close(); }
});

test('eigener Host bleibt erreichbar (Schriften), alles andere nicht', { skip }, async () => {
  // Im Test spielt „localhost" den eigenen Host; die Prüfung je Anfrage lässt
  // ihn zu, wie ssrf.js es in der Produktion für PUBLIC_BASE_URL tut.
  const r = createRenderer({
    hosts: ['localhost'], executablePath: exe,
    isAllowed: url => url.startsWith(`http://localhost:${port}/`) || url.startsWith('data:') || url.startsWith('about:'),
  });
  try {
    hits = [];
    await r.render(`<!doctype html><link rel="stylesheet" href="http://localhost:${port}/fonts.css"><p>x</p>
      <link rel="prefetch" href="http://127.0.0.1:${port}/prefetch">`, {});
    await new Promise(res => setTimeout(res, 1000));
    assert.deepEqual(hits, [`localhost:${port}/fonts.css`]);
  } finally { await r.close(); }
});

test(`höchstens ${MAX_PAGES} Seiten`, { skip }, async () => {
  const r = createRenderer({ executablePath: exe });
  try {
    const html = '<!doctype html><body>' + '<p style="break-after:page">Seite</p>'.repeat(30) + '</body>';
    const pdf = await r.render(html, {});
    assert.equal(pdfPageCount(pdf), MAX_PAGES);
    const kurz = await r.render('<!doctype html><p>Eine Seite</p>', {});
    assert.equal(pdfPageCount(kurz), 1, 'weniger Seiten als die Grenze sind kein Fehler');
  } finally { await r.close(); }
});

test('Zeitlimit: ein Monsterdokument wird abgebrochen, der Renderer lebt weiter', { skip }, async () => {
  const r = createRenderer({ executablePath: exe });
  try {
    const html = '<html><body>' + '<p style="break-after:page">x</p>'.repeat(30000) + '</body></html>';
    const t = Date.now();
    await assert.rejects(r.render(html, { timeoutMs: 3000 }), e => e.code === 'ETIMEDOUT');
    assert.ok(Date.now() - t < 8000, `Abbruch dauerte ${Date.now() - t} ms`);
    const pdf = await r.render('<!doctype html><p>danach</p>', {});
    assert.equal(pdfPageCount(pdf), 1);
  } finally { await r.close(); }
});

test('alter Client mit /api/photos-Adresse im HTML: PDF ohne Foto statt Absturz', { skip }, async () => {
  const r = createRenderer({ hosts: ['cv.example.org'], executablePath: exe });
  try {
    const html = `<!doctype html><img src="https://cv.example.org/pdfapi/api/photos/aaaaaaaaaaaaaaaaaaaaaaaa" width="100"><p>Text</p>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`;
    const pdf = await r.render(html, { ownHost: 'cv.example.org', timeoutMs: 20000 });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  } finally { await r.close(); }
});
