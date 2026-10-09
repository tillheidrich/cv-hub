// Tests für guards.js, mail.js-Vorlagen und die Vorlagenliste — ohne Datenbank.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  createLimiter, BusyError, withTimeout, payloadSizeError, MAX_RESUME_PAYLOAD_BYTES,
  consentCsp, HTML_CSP, trustProxyWarning,
} from './guards.js';
import { tplLoginCode, tplPasswordReset } from './mail.js';
import { buildTemplatesJson, serialize, THEME_TS, TEMPLATES_JSON } from './scripts/sync-templates.mjs';
import { rendererHosts, chromiumArgs } from './pdf.js';

test('Warteschlange: 2 parallel, 10 wartend, der elfte bekommt sofort eine Absage', async () => {
  const lim = createLimiter({ maxParallel: 2, maxQueue: 10, queueTimeoutMs: 5000 });
  const r1 = await lim.acquire();
  const r2 = await lim.acquire();
  assert.equal(lim.active, 2);
  const waiting = Array.from({ length: 10 }, () => lim.acquire());
  assert.equal(lim.waiting, 10);
  await assert.rejects(lim.acquire(), e => e instanceof BusyError && /ausgelastet/.test(e.message));
  r1(); r1();                       // doppeltes Freigeben zählt nur einmal
  const r3 = await waiting[0];
  assert.equal(lim.active, 2);
  r2(); r3();
  for (const w of waiting.slice(1)) (await w)();
  assert.equal(lim.active, 0);
});

test('Warteschlange: wer zu lange wartet oder abbricht, gibt seinen Platz frei', async () => {
  const lim = createLimiter({ maxParallel: 1, maxQueue: 2, queueTimeoutMs: 50 });
  const r = await lim.acquire();
  await assert.rejects(lim.acquire(), BusyError);          // Zeitlimit in der Warteschlange
  const ac = new AbortController();
  const p = lim.acquire(ac.signal);
  ac.abort();
  await assert.rejects(p, BusyError);
  assert.equal(lim.waiting, 0);
  r();
  (await lim.acquire())();
});

test('withTimeout bricht ab und ruft das Aufräumen', async () => {
  let cleaned = false;
  await assert.rejects(
    withTimeout(new Promise(() => {}), 30, () => { cleaned = true; }),
    e => e.code === 'ETIMEDOUT',
  );
  assert.equal(cleaned, true);
  assert.equal(await withTimeout(Promise.resolve(7), 1000), 7);
});

test('Größenprüfung zählt Bytes, nicht Zeichen', () => {
  assert.equal(payloadSizeError({ a: 'x'.repeat(1000) }), null);
  assert.match(payloadSizeError({ a: 'x'.repeat(MAX_RESUME_PAYLOAD_BYTES) }), /zu groß/);
  // Umlaute zählen doppelt — 120 000 „ä" sind 240 KB.
  assert.match(payloadSizeError({ a: 'ä'.repeat(120_000) }), /zu groß/);
});

test('CSP der Zustimmungsseite: Rückleitung erlaubt, sonst nichts dazu', () => {
  assert.match(HTML_CSP, /frame-ancestors 'none'/);
  assert.match(HTML_CSP, /default-src 'none'/);
  assert.match(consentCsp('https://claude.ai/api/mcp/auth_callback'), /form-action 'self' https:\/\/claude\.ai;/);
  assert.match(consentCsp('http://localhost:33418/cb'), /form-action 'self' http:\/\/localhost:33418;/);
  assert.equal(consentCsp('kaputt'), HTML_CSP);
});

test('TRUST_PROXY-Warnung kommt genau einmal und nur ohne Einstellung', () => {
  const logs = [];
  const fakeApp = { get: () => false };
  const mw = trustProxyWarning(fakeApp, m => logs.push(m));
  const next = () => {};
  mw({ headers: {} }, {}, next);
  assert.equal(logs.length, 0);
  mw({ headers: { 'x-forwarded-for': '1.2.3.4' } }, {}, next);
  mw({ headers: { 'x-forwarded-for': '1.2.3.4' } }, {}, next);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /TRUST_PROXY=1/);
  const quiet = [];
  trustProxyWarning({ get: () => 1 }, m => quiet.push(m))({ headers: { 'x-forwarded-for': 'x' } }, {}, next);
  assert.equal(quiet.length, 0);
});

test('2FA-Code steht nicht im Betreff, nur im Text', () => {
  const m = tplLoginCode({ code: '493817' });
  assert.doesNotMatch(m.subject, /493817/);
  assert.match(m.html, /493817/);
});

test('Reset-Link ohne Basis: keine Mail statt fester Fallback-Domain', () => {
  assert.throws(() => tplPasswordReset({ token: 'abc' }), /base fehlt/);
  const m = tplPasswordReset({ token: 'abc', base: 'https://cv.example.org/' });
  assert.match(m.html, /https:\/\/cv\.example\.org\/reset\/abc/);
  assert.doesNotMatch(m.html, /cv\.example\.com\/reset/);
});

test('Renderer löst nur eigene, öffentliche Hostnamen auf', () => {
  const hosts = rendererHosts([
    'https://cv.example.org', 'http://localhost:5173', 'https://cv-api:3000',
    'https://10.0.0.5', 'https://169.254.169.254', 'http://[::1]:3000', '', null, 'kaputt',
  ]);
  assert.deepEqual(hosts, ['cv.example.org']);
  const args = chromiumArgs(hosts);
  assert.ok(args.includes('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE cv.example.org'));
  assert.ok(chromiumArgs([]).includes('--host-resolver-rules=MAP * ~NOTFOUND'));
});

test('Vorlagenliste: templates.json entspricht theme.ts (PICKABLE_THEMES)', { skip: !existsSync(THEME_TS) && 'app/ fehlt' }, async () => {
  const want = serialize(await buildTemplatesJson());
  assert.equal(readFileSync(TEMPLATES_JSON, 'utf8'), want, 'templates.json neu erzeugen: node scripts/sync-templates.mjs');
  const ids = JSON.parse(want).templates.map(t => t.id);
  for (const phantom of ['pikachu', 'onyx', 'azurill', 'gengar', 'leafish', 'muenchen', 'stockholm', 'tokio', 'cobalt', 'helsinki']) {
    assert.ok(!ids.includes(phantom), `${phantom} darf nicht angeboten werden`);
  }
  for (const real of ['lueneburg', 'husum', 'bregenz', 'uppsala', 'aarhus', 'lille', 'antwerpen', 'rotterdam']) {
    assert.ok(ids.includes(real), `${real} fehlt`);
  }
});
