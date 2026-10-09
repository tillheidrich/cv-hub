// Integrationstests: der echte Dienst gegen eine echte Postgres-Instanz.
//
// Bis zum 08.10.2026 gab es keinen einzigen Test, der eine Route gegen eine
// Datenbank aufrief — nicht für Anmeldung, Quote, Löschung oder fremde IDs.
// Jeder Fall hier stammt aus einem Befund des Technik-Berichts und prüft, wo
// es geht, beide Richtungen: der Angriff scheitert, der Normalfall geht.
//
// Startet eine eigene Postgres-Instanz (Port 5441) und server.js (Port 3141).
// Ohne Postgres-Binärdateien wird die ganze Datei übersprungen; ohne Chromium
// nur die PDF-Fälle.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';
import { startPostgres, startServer, client, findChromium, findPgBin, pdfPageCount } from './testkit.mjs';
import { runJanitor, prunePhotos } from './janitor.js';

const PG_PORT = Number(process.env.TEST_PG_PORT || 5441);
const API_PORT = Number(process.env.TEST_API_PORT || 3141);
const chromiumPath = findChromium();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

// Ein „PNG" mit gültigen Magic Bytes — mehr prüft der Upload nicht.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]).toString('base64');

function profil(name, extra = {}) {
  const cv = lang => ({
    personal: { name: `${name} ${lang}`, title: 'Meisterin', location: 'Musterstadt', email: 'x@example.org', phone: '1', birthDate: '01.01.1990', nationality: 'deutsch' },
    profile: { text: `Profil ${lang}` },
    experience: [
      { id: '1', role: 'Meisterin', company: 'Sichtbar GmbH', location: '', start: '2020', end: 'heute', bullets: ['a'] },
      { id: '2', role: 'Aushilfe', company: 'Versteckt AG', location: '', start: '2010', end: '2011', bullets: [], hidden: true },
    ],
    education: [], skillGroups: [], languages: [], additionalExperience: [],
    labels: { lang },
  });
  return {
    id: extra.id || `p${crypto.randomBytes(4).toString('hex')}`,
    displayName: 'Intern: Bewerbung Acme',
    data: { de: cv('de'), en: cv('en') },
    coverLetters: { de: { subject: 'Bewerbung als Meisterin', intro: 'Hallo' }, en: { subject: 'Application EN', intro: 'Hello' } },
    settings: { lang: 'de', template: 'hamburg', fontScale: 1, fontPairing: 'auto', pageMode: 'one', hiddenSections: ['details'] },
    ...extra,
  };
}

const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';

describe('cv-api gegen Postgres', { skip: PG_MISSING }, () => {
  let pgInst, srv, db, canary, canaryPort, canaryHits = [];
  const admin = () => client(srv.base);
  let A, B, Adm;   // eingeloggte Clients
  let idA;

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    canary = http.createServer((q, r) => { canaryHits.push(q.url); r.end('INTERN'); });
    await new Promise(r => canary.listen(0, '127.0.0.1', r));
    canaryPort = canary.address().port;
    srv = await startServer({
      DATABASE_URL: pgInst.url,
      JWT_SECRET: 'integration-test-secret',
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://cv.example.org',
      JANITOR: '0',
      TRUST_PROXY: '',
      PDF_MAX_PARALLEL: '1',
      PDF_MAX_QUEUE: '1',
      PDF_TIMEOUT_MS: '8000',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      ...(chromiumPath ? { PDF_CHROMIUM_PATH: chromiumPath } : {}),
    }, { port: API_PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 2 });

    // Erster Nutzer wird Admin (Bootstrap), die weiteren brauchen Einladungen.
    Adm = admin();
    let r = await Adm.post('/api/auth/register', { username: 'chefin', password: 'admin-passwort-1', email: 'chefin@example.org' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const invA = await Adm.post('/api/admin/invites', { email: 'anna@example.org' });
    const invB = await Adm.post('/api/admin/invites', {});
    A = admin(); B = admin();
    r = await A.post('/api/auth/register', { username: 'anna', password: 'anna-passwort-1', email: 'anna@example.org', inviteCode: invA.data.code });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    r = await B.post('/api/auth/register', { username: 'bert', password: 'bert-passwort-1', inviteCode: invB.data.code });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const p = profil('Anna');
    r = await A.post('/api/resumes', { id: p.id, displayName: p.displayName, payload: p });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    idA = p.id;
  });

  after(async () => {
    await db?.end().catch(() => {});
    await srv?.stop();
    canary?.close();
    pgInst?.stop();
  });

  // ── Header, Grenzen, Fehlerbehandlung ─────────────────────────────────────

  test('N5: Sicherheitsheader, kein x-powered-by', async () => {
    const r = await fetch(`${srv.base}/health`);
    assert.equal(r.headers.get('x-powered-by'), null);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
  });

  test('Befund 4: X-Forwarded-For ohne TRUST_PROXY erzeugt eine Startwarnung', async () => {
    await fetch(`${srv.base}/health`, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
    await new Promise(r => setTimeout(r, 100));
    assert.match(srv.output, /X-Forwarded-For empfangen, aber TRUST_PROXY ist nicht gesetzt/);
  });

  test('Befund 5: globales JSON-Limit 1 MB — auch für nicht angemeldete Endpunkte', async () => {
    const r = await fetch(`${srv.base}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'x', password: 'y'.repeat(1_200_000) }),
    });
    assert.equal(r.status, 413);
    // Foto-Upload darf mehr (eigener Parser) — 1,5 MB Base64 gehen durch.
    const big = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(1_100_000, 1)]).toString('base64');
    const up = await A.post('/api/photos', { mime: 'image/png', dataBase64: big });
    assert.equal(up.status, 200, JSON.stringify(up.data));
  });

  test('N4: Fehler in async-Handlern hängen nicht mehr (Express 5)', async () => {
    const t = Date.now();
    const r = await Adm.post('/api/admin/users/abc/disable', { disabled: true });
    assert.ok(r.status >= 400 && r.status < 500, String(r.status));
    assert.ok(Date.now() - t < 3000);
    const v = await A.get(`/api/resumes/${idA}/versions/abc`);
    assert.equal(v.status, 404);
  });

  test('Befund 14: /api/templates kommt aus theme.ts, ohne Phantom-Vorlagen', async () => {
    const r = await fetch(`${srv.base}/api/templates`).then(x => x.json());
    const ids = r.templates.map(t => t.id);
    assert.ok(ids.includes('rotterdam') && ids.includes('lueneburg'));
    assert.ok(!ids.includes('pikachu') && !ids.includes('helsinki'));
    assert.ok(r.fontPairings.includes('auto'));
  });

  // ── Einladung, Admin, Quote ───────────────────────────────────────────────

  test('N8: an eine Mail gebundener Einladungscode prüft die Mail', async () => {
    const inv = await Adm.post('/api/admin/invites', { email: 'gebunden@example.org' });
    const C = client(srv.base);
    let r = await C.post('/api/auth/register', { username: 'fremd', password: 'fremd-passwort-1', email: 'andere@example.org', inviteCode: inv.data.code });
    assert.equal(r.status, 403);
    r = await C.post('/api/auth/register', { username: 'fremd', password: 'fremd-passwort-1', inviteCode: inv.data.code });
    assert.equal(r.status, 403, 'ohne Mail auch nicht');
    r = await C.post('/api/auth/register', { username: 'gebunden', password: 'gebunden-passwort-1', email: 'Gebunden@Example.org', inviteCode: inv.data.code });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  test('Befund 8: Admin liest fremde Profile nicht mehr — auch nicht per API-Schlüssel', async () => {
    assert.equal((await Adm.get(`/api/resumes/${idA}`)).status, 404);
    const key = (await Adm.post('/api/keys', { name: 'mcp' })).data.key;
    const r = await fetch(`${srv.base}/api/resumes/${idA}`, { headers: { Authorization: `Bearer ${key}` } });
    assert.equal(r.status, 404);
    assert.equal((await A.get(`/api/resumes/${idA}`)).status, 200, 'der Eigentümer schon');
  });

  test('IDOR: B kommt an nichts von A heran', async () => {
    for (const p of [`/api/resumes/${idA}`, `/api/resumes/${idA}/versions`, `/api/resumes/${idA}.md`, `/api/resumes/${idA}/cover-letter.md`]) {
      assert.equal((await B.get(p)).status, 404, p);
    }
    assert.equal((await B.put(`/api/resumes/${idA}`, { payload: profil('B') })).status, 404);
    assert.equal((await B.post(`/api/resumes/${idA}/share`, {})).status, 404);
    assert.equal((await B.post('/api/resumes', { id: idA, payload: profil('B') })).status, 409);
  });

  test('Befund 5: Größenprüfung auf allen Schreibwegen', async () => {
    const dick = profil('Anna', { id: idA });
    dick.data.de.profile.text = 'x'.repeat(250_000);
    assert.equal((await A.post('/api/resumes', { id: idA, payload: dick })).status, 413);
    assert.equal((await A.put(`/api/resumes/${idA}`, { payload: dick })).status, 413);
    const md = `---\nlang: de\n---\n# Anna\n\n## Profil\n${'y'.repeat(250_000)}\n`;
    assert.equal((await A.post(`/api/resumes/${idA}/import-md`, { markdown: md })).status, 413);
    assert.equal((await A.post(`/api/resumes/${idA}/import-md`, { markdown: md, dryRun: true })).status, 413);
    const clMd = (await A.get(`/api/resumes/${idA}/cover-letter.md`)).data;
    assert.match(clMd, /Hallo/);
    const cl = clMd.replace('Hallo', 'z'.repeat(250_000));
    assert.equal((await A.post(`/api/resumes/${idA}/import-cover-letter-md`, { markdown: cl })).status, 413);
    assert.equal((await A.post(`/api/resumes/${idA}/import-cover-letter-md`, { markdown: clMd })).status, 200, 'normale Größe geht');
    // Wiederherstellen einer übergroßen Version (die es vor dieser Prüfung geben konnte)
    const { rows } = await db.query(
      'INSERT INTO resume_versions (resume_id, user_id, payload, source) SELECT $1, user_id, $2, $3 FROM resumes WHERE id = $1 RETURNING id',
      [idA, dick, 'test'],
    );
    assert.equal((await A.post(`/api/resumes/${idA}/versions/${rows[0].id}/restore`, {})).status, 413);
    // Normale Größe geht
    assert.equal((await A.put(`/api/resumes/${idA}`, { payload: profil('Anna', { id: idA }) })).status, 200);
  });

  // ── Fotos ─────────────────────────────────────────────────────────────────

  test('Befund 1: Foto nur für den Eigentümer, private Cache-Steuerung, löschbar', async () => {
    const up = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    assert.equal(up.status, 200);
    const pfad = up.data.url.replace('https://cv.example.org/pdfapi', '');
    const anon = await fetch(srv.base + pfad);
    assert.equal(anon.status, 404, 'ohne Anmeldung nicht');
    assert.equal((await B.get(pfad, { raw: true })).status, 404, 'fremder Nutzer nicht');
    const own = await A.get(pfad, { raw: true });
    assert.equal(own.status, 200);
    assert.match(own.headers.get('cache-control'), /private/);
    assert.doesNotMatch(own.headers.get('cache-control'), /public|immutable/);
    assert.equal((await B.del(pfad)).status, 404);
    assert.equal((await A.del(pfad)).status, 200);
    assert.equal((await A.get(pfad, { raw: true })).status, 404);
  });

  test('Befund 1: entferntes oder ersetztes Foto verschwindet beim Speichern', async () => {
    const up = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    const id = up.data.id;
    const p = profil('Anna', { id: idA });
    p.data.de.personal.photo = up.data.url;
    await A.put(`/api/resumes/${idA}`, { payload: p });
    await db.query("UPDATE photos SET created_at = now() - interval '1 hour' WHERE id = $1", [id]);
    await A.put(`/api/resumes/${idA}`, { payload: p });
    assert.equal((await db.query('SELECT 1 FROM photos WHERE id = $1', [id])).rowCount, 1, 'benutzt → bleibt');
    delete p.data.de.personal.photo;
    await A.put(`/api/resumes/${idA}`, { payload: p });
    assert.equal((await db.query('SELECT 1 FROM photos WHERE id = $1', [id])).rowCount, 0, 'entfernt → weg');
    // Ein frisch hochgeladenes, noch nicht gespeichertes Foto überlebt das Aufräumen
    const frisch = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    const { rows } = await db.query('SELECT user_id FROM photos WHERE id = $1', [frisch.data.id]);
    await prunePhotos(db, rows[0].user_id);
    assert.equal((await db.query('SELECT 1 FROM photos WHERE id = $1', [frisch.data.id])).rowCount, 1);
  });

  // ── Sharelinks ────────────────────────────────────────────────────────────

  test('N3: Sharelink liefert nur die sichtbare Fassung, fest beim Anlegen', async () => {
    const foto = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    const orig = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    const p = profil('Anna', { id: idA });
    p.data.de.personal.photo = foto.data.url;
    p.data.de.personal.photoOriginal = orig.data.url;
    await A.put(`/api/resumes/${idA}`, { payload: p });

    const s = await A.post(`/api/resumes/${idA}/share`, { includeCoverLetter: false });
    assert.equal(s.status, 200);
    const token = s.data.token;
    const anon = client(srv.base);
    const r = await anon.get(`/api/share/${token}`);
    assert.equal(r.status, 200);
    const json = JSON.stringify(r.data);
    assert.deepEqual(Object.keys(r.data.resume.data), ['de']);
    assert.doesNotMatch(json, /Anna en|Application EN/);
    assert.doesNotMatch(json, /Versteckt AG/);
    assert.doesNotMatch(json, /01\.01\.1990|nationality/);
    assert.doesNotMatch(json, /photoOriginal/);
    assert.ok(!json.includes(orig.data.id) && !json.includes(foto.data.id), 'keine internen Foto-IDs');
    assert.doesNotMatch(json, /Intern: Bewerbung Acme/);
    assert.equal(r.data.include_cover_letter, false);
    assert.equal(r.data.resume.coverLetters.de.subject, '');
    assert.equal(r.data.resume.data.de.personal.name, 'Anna de');
    assert.equal(r.data.resume.data.de.experience.length, 1);

    // Foto über den Link, Original nicht
    const fp = r.data.resume.data.de.personal.photo;
    assert.equal(fp, `/pdfapi/api/share/${token}/photo`);
    const img = await fetch(srv.base + fp.replace('/pdfapi', ''));
    assert.equal(img.status, 200);
    assert.match(img.headers.get('cache-control'), /private/);

    // Markdown-Fassung: ebenfalls ohne Eckdaten
    const md = await anon.get(`/api/share/${token}.md`);
    assert.equal(md.status, 200);
    assert.doesNotMatch(md.data, /Geburtsdatum|01\.01\.1990|Versteckt AG/);

    // Anschreiben nachträglich freigeben → nur die eine Sprache
    await A.patch(`/api/shares/${token}`, { includeCoverLetter: true });
    const r2 = await anon.get(`/api/share/${token}`);
    assert.equal(r2.data.resume.coverLetters.de.subject, 'Bewerbung als Meisterin');
    assert.doesNotMatch(JSON.stringify(r2.data), /Application EN/);

    // Fester Stand: spätere Änderung erscheint erst nach „refresh"
    p.data.de.personal.name = 'Anna geändert';
    await A.put(`/api/resumes/${idA}`, { payload: p });
    assert.equal((await anon.get(`/api/share/${token}`)).data.resume.data.de.personal.name, 'Anna de');
    assert.equal((await B.post(`/api/shares/${token}/refresh`, {})).status, 404);
    await A.post(`/api/shares/${token}/refresh`, {});
    assert.equal((await anon.get(`/api/share/${token}`)).data.resume.data.de.personal.name, 'Anna geändert');

    // Widerrufen → auch das Foto ist weg
    await A.post(`/api/shares/${token}/revoke`, {});
    assert.equal((await anon.get(`/api/share/${token}`)).status, 403);
    assert.equal((await fetch(srv.base + fp.replace('/pdfapi', ''))).status, 404);
  });

  test('N3: alte Links ohne festen Stand bekommen ihn beim ersten Abruf, gefiltert', async () => {
    const token = crypto.randomBytes(18).toString('hex');
    await db.query(
      `INSERT INTO share_links (token, resume_id, created_by, include_cover_letter)
       SELECT $1, id, user_id, true FROM resumes WHERE id = $2`, [token, idA]);
    const r = await client(srv.base).get(`/api/share/${token}`);
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.data.resume.data), ['de']);
    assert.doesNotMatch(JSON.stringify(r.data), /Versteckt AG|photoOriginal|01\.01\.1990/);
    const { rows } = await db.query('SELECT snapshot FROM share_links WHERE token = $1', [token]);
    assert.ok(rows[0].snapshot, 'Stand gespeichert');
  });

  test('Crawler-Karte nutzt den festen Stand und das Link-Foto', async () => {
    const foto = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    const p = profil('Anna', { id: idA });
    p.data.de.personal.photo = foto.data.url;
    await A.put(`/api/resumes/${idA}`, { payload: p });
    const token = (await A.post(`/api/resumes/${idA}/share`, {})).data.token;
    const r = await fetch(`${srv.base}/share/${token}`, { headers: { 'User-Agent': 'LinkedInBot/1.0' } });
    const html = await r.text();
    assert.match(html, new RegExp(`og:image" content="https://cv\\.example\\.org/pdfapi/api/share/${token}/photo"`));
    assert.ok(!html.includes(foto.data.id));
  });

  // ── Sitzungen, Schlüssel, Passwort, Mail ──────────────────────────────────

  test('N7: Abmelden entwertet die Sitzung serverseitig', async () => {
    const C = client(srv.base);
    const inv = await Adm.post('/api/admin/invites', {});
    await C.post('/api/auth/register', { username: 'carla', password: 'carla-passwort-1', inviteCode: inv.data.code });
    const alt = C.cookie;
    assert.equal((await C.get('/api/auth/me')).status, 200);
    await C.post('/api/auth/logout', {});
    const D = client(srv.base);
    D.cookie = alt;                                     // abgegriffenes Cookie
    assert.equal((await D.get('/api/auth/me')).status, 401);
  });

  test('Befund 2: Passwortwechsel trennt API-Schlüssel und OAuth-Token', async () => {
    const C = client(srv.base);
    const inv = await Adm.post('/api/admin/invites', {});
    await C.post('/api/auth/register', { username: 'dora', password: 'dora-passwort-1', inviteCode: inv.data.code });
    const key = (await C.post('/api/keys', {})).data.key;
    const uid = (await C.get('/api/auth/me')).data.user.id;
    const oauth = 'cvm_' + crypto.randomBytes(32).toString('hex');
    await db.query(
      `INSERT INTO oauth_tokens (token_hash, user_id, client_id, expires_at) VALUES ($1, $2, 'cvc_test', now() + interval '1 day')`,
      [sha(oauth), uid]);
    const me = t => fetch(`${srv.base}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } }).then(r => r.status);
    assert.equal(await me(key), 200);
    assert.equal(await me(oauth), 200);
    const r = await C.post('/api/auth/change-password', { currentPassword: 'dora-passwort-1', newPassword: 'dora-passwort-2' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.revoked, { apiKeys: 1, connections: 1 });
    assert.equal(await me(key), 401);
    assert.equal(await me(oauth), 401);
    assert.equal((await C.get('/api/auth/me')).status, 200, 'die eigene Sitzung bleibt');
  });

  test('Befund 2: Passwort-Reset per Token trennt ebenfalls alles', async () => {
    const C = client(srv.base);
    const inv = await Adm.post('/api/admin/invites', {});
    await C.post('/api/auth/register', { username: 'emil', password: 'emil-passwort-1', inviteCode: inv.data.code });
    const key = (await C.post('/api/keys', {})).data.key;
    const uid = (await C.get('/api/auth/me')).data.user.id;
    const token = crypto.randomBytes(32).toString('hex');
    await db.query(`INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [token, uid]);
    assert.equal((await client(srv.base).post('/api/auth/reset-password', { token, newPassword: 'emil-passwort-2' })).status, 200);
    assert.equal((await fetch(`${srv.base}/api/auth/me`, { headers: { Authorization: `Bearer ${key}` } })).status, 401);
    assert.equal((await C.get('/api/auth/me')).status, 401, 'alte Sitzung auch');
  });

  test('Befund 2: Admin-Reset trennt alles und meldet, ob die Mail rausging', async () => {
    const key = (await B.post('/api/keys', {})).data.key;
    const uid = (await B.get('/api/auth/me')).data.user.id;
    const r = await Adm.post(`/api/admin/users/${uid}/reset-password`, { newPassword: 'neu-gesetzt-1' });
    assert.equal(r.status, 200);
    assert.equal(r.data.revoked.apiKeys, 1);
    assert.equal(r.data.notified, false, 'ohne SMTP und ohne Mail-Adresse keine Zustellung');
    assert.equal((await fetch(`${srv.base}/api/auth/me`, { headers: { Authorization: `Bearer ${key}` } })).status, 401);
    assert.equal((await B.get('/api/auth/me')).status, 401);
    assert.equal((await A.post(`/api/admin/users/${uid}/reset-password`, { newPassword: 'x'.repeat(10) })).status, 403);
  });

  test('N6: E-Mail-Wechsel nur mit aktuellem Passwort', async () => {
    let r = await A.post('/api/auth/email', { email: 'neu@example.org' });
    assert.equal(r.status, 400);
    assert.equal(r.data.code, 'password_required');
    r = await A.post('/api/auth/email', { email: 'neu@example.org', currentPassword: 'falsch-falsch' });
    assert.equal(r.status, 403);
    r = await A.post('/api/auth/email', { email: 'anna2@example.org', currentPassword: 'anna-passwort-1' });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.email, 'anna2@example.org');
  });

  test('N10: Adressen mit Kommentaren/Gruppen werden abgewiesen', async () => {
    for (const email of ['a(b)@example.org', 'a@example.org(x)', '"a"@example.org', 'a@x.org,b@y.org', 'a<b>@example.org']) {
      const r = await A.post('/api/auth/email', { email, currentPassword: 'anna-passwort-1' });
      assert.equal(r.status, 400, email);
    }
  });

  test('N9: OAuth-Client-Registrierung ist begrenzt', async () => {
    let last;
    for (let i = 0; i < 21; i++) {
      last = await fetch(`${srv.base}/api/oauth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_uris: ['https://claude.ai/cb'], client_name: `c${i}` }),
      });
    }
    assert.equal(last.status, 429);
  });

  test('N5: Zustimmungsseite erlaubt die Rückleitung im CSP, sonst nichts', async () => {
    const { rows } = await db.query(`INSERT INTO oauth_clients (id, name, redirect_uris) VALUES ('cvc_csp', 'Test', '["https://client.example.net/cb"]') RETURNING id`);
    const q = new URLSearchParams({ client_id: rows[0].id, redirect_uri: 'https://client.example.net/cb', response_type: 'code', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256' });
    const r = await A.get(`/api/oauth/authorize?${q}`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /form-action 'self' https:\/\/client\.example\.net;/);
    assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  });

  // ── Löschung und Aufräumen ────────────────────────────────────────────────

  test('Befund 7: Kontolöschung entfernt Anfrage, Einladungsnotiz und Ereignisse', async () => {
    const mail = 'loeschen@example.org';
    await db.query(`INSERT INTO access_requests (name, email, message, status) VALUES ('Lotte Löschen', $1, 'Hallo', 'accepted')`, [mail]);
    const inv = await Adm.post('/api/admin/invites', { email: mail, note: 'Zugangsanfrage #1 · Lotte Löschen' });
    const C = client(srv.base);
    await C.post('/api/auth/register', { username: 'lotte', password: 'lotte-passwort-1', email: mail, inviteCode: inv.data.code });
    const uid = (await C.get('/api/auth/me')).data.user.id;
    const p = profil('Lotte');
    await C.post('/api/resumes', { id: p.id, payload: p });
    await C.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    assert.ok((await db.query('SELECT 1 FROM events WHERE user_id = $1', [uid])).rowCount > 0);
    const r = await C.post('/api/me/delete', { password: 'lotte-passwort-1' });
    assert.equal(r.status, 200);
    assert.equal((await db.query('SELECT 1 FROM access_requests WHERE lower(email) = $1', [mail])).rowCount, 0);
    const { rows: ic } = await db.query('SELECT email, note FROM invite_codes WHERE code = $1', [inv.data.code]);
    assert.deepEqual(ic[0], { email: null, note: null });
    assert.equal((await db.query('SELECT 1 FROM events WHERE user_id = $1', [uid])).rowCount, 0);
    assert.equal((await db.query('SELECT 1 FROM photos WHERE user_id = $1', [uid])).rowCount, 0);
    assert.equal((await db.query('SELECT 1 FROM resumes WHERE user_id = $1', [uid])).rowCount, 0);
    // In keiner Tabelle steht die Adresse noch
    const { rows: tabs } = await db.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    for (const { table_name } of tabs) {
      const { rowCount } = await db.query(`SELECT 1 FROM ${table_name} t WHERE t::text ILIKE $1`, [`%${mail}%`]);
      assert.equal(rowCount, 0, `${table_name} enthält noch die Adresse`);
    }
  });

  test('Befund 7: Aufräumjob entfernt Abgelaufenes und Altes, Aktuelles bleibt', async () => {
    const { rows: u } = await db.query(`SELECT id FROM users WHERE username = 'anna'`);
    const uid = u[0].id;
    await db.query(`INSERT INTO login_codes (challenge, user_id, code_hash, expires_at) VALUES ('alt', $1, 'x', now() - interval '1 hour'), ('neu', $1, 'x', now() + interval '1 hour')`, [uid]);
    await db.query(`INSERT INTO password_resets (token, user_id, expires_at) VALUES ('alt', $1, now() - interval '1 hour')`, [uid]);
    await db.query(`INSERT INTO access_requests (name, email, status, decided_at) VALUES ('Alt', 'alt@example.org', 'rejected', now() - interval '31 days'), ('Frisch', 'frisch@example.org', 'rejected', now() - interval '2 days')`);
    const token = (await A.post(`/api/resumes/${idA}/share`, {})).data.token;
    await db.query(`INSERT INTO share_views (token, viewed_at) VALUES ($1, now() - interval '91 days'), ($1, now())`, [token]);
    await db.query(`INSERT INTO oauth_clients (id, redirect_uris, created_at) VALUES ('cvc_alt', '[]', now() - interval '2 days')`);
    await db.query(`INSERT INTO session_revocations (token_hash, user_id, expires_at) VALUES ('abgelaufen', $1, now() - interval '1 day')`, [uid]);
    const orphan = await A.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    await db.query(`UPDATE photos SET created_at = now() - interval '2 days' WHERE id = $1`, [orphan.data.id]);

    const r = await runJanitor(db);
    for (const [k, v] of Object.entries(r)) assert.equal(typeof v, 'number', `${k}: ${v}`);
    const count = async (sql, args = []) => (await db.query(sql, args)).rowCount;
    assert.equal(await count(`SELECT 1 FROM login_codes WHERE challenge = 'alt'`), 0);
    assert.equal(await count(`SELECT 1 FROM login_codes WHERE challenge = 'neu'`), 1);
    assert.equal(await count(`SELECT 1 FROM password_resets WHERE token = 'alt'`), 0);
    assert.equal(await count(`SELECT 1 FROM access_requests WHERE email = 'alt@example.org'`), 0);
    assert.equal(await count(`SELECT 1 FROM access_requests WHERE email = 'frisch@example.org'`), 1);
    assert.equal(await count(`SELECT 1 FROM share_views WHERE token = $1`, [token]), 1);
    assert.equal(await count(`SELECT 1 FROM oauth_clients WHERE id = 'cvc_alt'`), 0);
    assert.equal(await count(`SELECT 1 FROM session_revocations WHERE token_hash = 'abgelaufen'`), 0);
    assert.equal(await count(`SELECT 1 FROM photos WHERE id = $1`, [orphan.data.id]), 0);
  });

  // ── PDF ───────────────────────────────────────────────────────────────────

  describe('PDF-Dienst', { skip: chromiumPath ? false : 'kein Chromium gefunden' }, () => {
    const pdf = (html, headers = {}) => fetch(`${srv.base}/api/pdf`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ html, filename: 'Test.pdf' }),
    });

    test('N1: Prefetch/Prerender-Nachweis des Technik-Agenten scheitert über /api/pdf (ohne Konto)', async () => {
      canaryHits = [];
      const r = await pdf(`<!doctype html><p>Lebenslauf</p>
        <link rel="prefetch" href="http://127.0.0.1:${canaryPort}/prefetch">
        <link rel="prerender" href="http://127.0.0.1:${canaryPort}/prerender">
        <link rel="prefetch" href="http://localhost:${canaryPort}/prefetch-name">
        <link rel="prefetch" href="http://169.254.169.254/latest/meta-data/">`);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('content-type'), 'application/pdf');
      await new Promise(res => setTimeout(res, 1500));
      assert.deepEqual(canaryHits, []);
    });

    test('N2: höchstens 6 Seiten', async () => {
      const r = await pdf('<!doctype html><body>' + '<p style="break-after:page">x</p>'.repeat(20) + '</body>');
      assert.equal(r.status, 200);
      assert.equal(pdfPageCount(Buffer.from(await r.arrayBuffer())), 6);
    });

    test('N2: alter Client mit /api/photos-Adresse bekommt ein PDF ohne Absturz', async () => {
      const r = await pdf('<!doctype html><img src="https://cv.example.org/pdfapi/api/photos/aaaaaaaaaaaaaaaaaaaaaaaa"><p>Text mit altem Foto-Link</p>');
      assert.equal(r.status, 200);
    });

    test('N2: Warteschlange voll → 503 mit verständlicher Meldung; Zeitlimit greift', async () => {
      // PDF_MAX_PARALLEL=1, PDF_MAX_QUEUE=1, PDF_TIMEOUT_MS=8000 (siehe before)
      const schwer = '<html><body>' + '<p style="break-after:page">x</p>'.repeat(30000) + '</body></html>';
      const t = Date.now();
      const results = await Promise.all([pdf(schwer), pdf(schwer), pdf(schwer)]);
      const bodies = await Promise.all(results.map(r => r.json().catch(() => ({}))));
      const codes = results.map(r => r.status);
      assert.ok(codes.filter(c => c === 503).length >= 1, JSON.stringify(codes));
      const busy = bodies.find(b => /ausgelastet/.test(b.error || ''));
      assert.ok(busy, JSON.stringify(bodies));
      const zuLang = bodies.find(b => /zu lange gebraucht/.test(b.error || ''));
      assert.ok(zuLang, `Zeitlimit hätte greifen müssen: ${JSON.stringify(bodies)}`);
      assert.ok(Date.now() - t < 30_000, `dauerte ${Date.now() - t} ms`);
      const busyRes = results.find(r => r.status === 503 && r.headers.get('retry-after'));
      assert.ok(busyRes, 'Retry-After fehlt');
      // Satz und Kopf nennen dieselbe Wartezeit (vorher: „in einer Minute" bei Retry-After 30).
      assert.match(busy.error, new RegExp(`in ${busyRes.headers.get('retry-after')} Sekunden`), busy.error);
      // Danach geht wieder ein normales PDF
      const ok = await pdf('<!doctype html><p>wieder frei</p>');
      assert.equal(ok.status, 200);
    });
  });
});
