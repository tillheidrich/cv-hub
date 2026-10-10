// Integrationstests für den bezahlten Pilot (08.10.2026).
//
// Gegenprüfung H2 / Startup-Bericht, Bau-Liste 2 und 3: Laufzeit je Platz
// (access_days am Code → access_until am Konto), Hinweise 14 und 3 Tage vor
// Ablauf, nach Ablauf nur noch lesen und exportieren, Verlängern durch den
// Admin, Auswertung je Einladungscode. Wie integration.test.mjs: echter Dienst
// gegen echte Postgres-Instanz, beide Richtungen geprüft.
//
// Eigene Ports (Postgres 5453, API 3153), damit die Datei neben
// integration.test.mjs laufen kann.

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { startPostgres, startServer, client, findChromium, findPgBin } from './testkit.mjs';
import { runAccessNotices, accessInfo, isAccessExpired } from './access.js';
import { runJanitor } from './janitor.js';
import { ART9_VERSION } from './consent.js';
// Einwilligung Art. 9 DSGVO (B4, 10.10.2026): Ohne sie speichert ein Konto nicht.
const ART9 = { version: ART9_VERSION };

const PG_PORT = Number(process.env.PILOT_PG_PORT || 5453);
const API_PORT = Number(process.env.PILOT_API_PORT || 3153);
const chromiumPath = findChromium();
const DAY = 86_400_000;

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 7)]).toString('base64');

function profil(name, id = `p${crypto.randomBytes(4).toString('hex')}`) {
  const cv = {
    personal: { name, title: 'Fachkraft', location: 'Musterstadt', email: 'x@example.org', phone: '1' },
    profile: { text: 'Profil' },
    experience: [{ id: '1', role: 'Fachkraft', company: 'Firma', location: '', start: '2020', end: 'heute', bullets: ['a'] }],
    education: [], skillGroups: [], languages: [], additionalExperience: [], labels: { lang: 'de' },
  };
  return { id, displayName: `Profil ${name}`, data: { de: cv }, coverLetters: { de: { subject: 'Bewerbung', intro: 'Hallo' } }, settings: { lang: 'de', template: 'hamburg' } };
}

const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';

describe('Pilot: Laufzeit je Platz und Auswertung je Code', { skip: PG_MISSING }, () => {
  let pgInst, srv, db;
  let Adm, K1, K2, Alt;          // Admin, zwei Pilot-Klienten, ein Bestandskonto
  let pilotCode, altCode;
  let k1Id, k2Id, altId, profilK1;

  const setUntil = (id, sqlExpr) => db.query(`UPDATE users SET access_until = ${sqlExpr} WHERE id = $1`, [id]);

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    srv = await startServer({
      DATABASE_URL: pgInst.url,
      JWT_SECRET: 'pilot-test-secret',
      NODE_ENV: 'test',
      PUBLIC_BASE_URL: 'https://cv.example.org',
      JANITOR: '0',
      ACCESS_NOTICES: '0',
      TRUST_PROXY: '',
      SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
      ...(chromiumPath ? { PDF_CHROMIUM_PATH: chromiumPath } : {}),
    }, { port: API_PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 2 });

    Adm = client(srv.base);
    let r = await Adm.post('/api/auth/register', { username: 'leitung', password: 'admin-passwort-1', email: 'admin@example.org', art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));

    // Bestandsfall: Code ohne Laufzeit.
    altCode = (await Adm.post('/api/admin/invites', {})).data.code;
    Alt = client(srv.base);
    r = await Alt.post('/api/auth/register', { username: 'bestand', password: 'bestand-passwort-1', inviteCode: altCode, art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    altId = r.data.user.id;

    // Pilot: 10 Plätze, 90 Tage je Platz.
    r = await Adm.post('/api/admin/invites', { maxUses: 10, accessDays: 90, note: 'Pilot Coach A' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.accessDays, 90);
    pilotCode = r.data.code;
    K1 = client(srv.base); K2 = client(srv.base);
    r = await K1.post('/api/auth/register', { username: 'klientin1', password: 'klient-passwort-1', email: 'k1@example.org', inviteCode: pilotCode, art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    k1Id = r.data.user.id;
    r = await K2.post('/api/auth/register', { username: 'klient2', password: 'klient-passwort-2', inviteCode: pilotCode, art9Consent: ART9 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    k2Id = r.data.user.id;

    profilK1 = profil('Klientin Eins');
    r = await K1.post('/api/resumes', { id: profilK1.id, displayName: profilK1.displayName, payload: profilK1 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  });

  after(async () => {
    await db?.end().catch(() => {});
    await srv?.stop();
    pgInst?.stop();
  });

  // ── Laufzeit beim Einlösen ────────────────────────────────────────────────

  test('Einlösen setzt access_until = jetzt + access_days; ohne Laufzeit bleibt es unbegrenzt', async () => {
    const { rows } = await db.query('SELECT id, access_until FROM users WHERE id = ANY($1)', [[k1Id, k2Id, altId]]);
    const by = Object.fromEntries(rows.map(r => [r.id, r.access_until]));
    for (const id of [k1Id, k2Id]) {
      const diff = new Date(by[id]).getTime() - Date.now();
      assert.ok(Math.abs(diff - 90 * DAY) < 60_000, `Konto ${id}: ${diff}`);
    }
    assert.equal(by[altId], null, 'Bestandskonto ohne Laufzeit');

    const me = await K1.get('/api/me');
    assert.equal(me.status, 200);
    assert.equal(me.data.access.daysLeft, 90);
    assert.equal(me.data.access.notice, null);
    assert.equal(me.data.access.expired, false);
    assert.deepEqual(me.data.user.access, me.data.access, '/api/me und user.access stimmen überein');
    assert.equal((await K1.get('/api/auth/me')).data.user.access.daysLeft, 90, 'auch in /api/auth/me');
    assert.equal((await Alt.get('/api/me')).data.access, null, 'unbegrenzt = null');
    assert.equal((await Adm.get('/api/me')).data.access, null, 'Admin = null');

    const list = (await Adm.get('/api/admin/invites')).data.invites;
    assert.equal(list.find(c => c.code === pilotCode).access_days, 90);
    assert.equal(list.find(c => c.code === altCode).access_days, null);
  });

  test('accessDays wird geprüft; nur der Admin legt Codes an', async () => {
    for (const bad of [0, -5, 4000, 'abc']) {
      const r = await Adm.post('/api/admin/invites', { accessDays: bad });
      assert.equal(r.status, 400, `accessDays=${bad}`);
    }
    assert.equal((await K1.post('/api/admin/invites', { maxUses: 10, accessDays: 90 })).status, 403);
  });

  // ── Hinweise vor Ablauf ──────────────────────────────────────────────────

  test('Banner-Feld: 14 Tage → soon, 3 Tage → final, vorbei → expired', async () => {
    await setUntil(k1Id, "now() + interval '10 days'");
    let a = (await K1.get('/api/me')).data.access;
    assert.equal(a.notice, 'soon'); assert.equal(a.daysLeft, 10);
    await setUntil(k1Id, "now() + interval '2 days 1 hour'");
    a = (await K1.get('/api/me')).data.access;
    assert.equal(a.notice, 'final'); assert.equal(a.daysLeft, 3);
    await setUntil(k1Id, "now() + interval '20 days'");
    assert.equal((await K1.get('/api/me')).data.access.notice, null);
    // Reine Funktion, ohne Datenbank
    const now = Date.now();
    assert.equal(accessInfo({ role: 'user', access_until: new Date(now - 1000) }, now).notice, 'expired');
    assert.equal(accessInfo({ role: 'admin', access_until: new Date(now - 1000) }, now), null);
    assert.equal(isAccessExpired({ role: 'admin', access_until: new Date(now - 1000) }, now), false);
    assert.equal(isAccessExpired({ role: 'user', access_until: null }, now), false);
  });

  test('Mails 14 und 3 Tage vorher: je einmal, mit den Ausgängen, de und en; ohne Adresse keine', async () => {
    const sent = [];
    const send = async (m) => { sent.push(m); return true; };
    await setUntil(k1Id, "now() + interval '10 days'");
    await setUntil(k2Id, "now() + interval '10 days'");   // K2 hat keine E-Mail
    await db.query('UPDATE users SET access_notice14_at = NULL, access_notice3_at = NULL');

    let r = await runAccessNotices(db, { send, base: 'https://cv.example.org' });
    assert.deepEqual(r.map(x => [x.userId, x.kind, x.sent]), [[k1Id, 'soon', true]]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'k1@example.org');
    assert.match(sent[0].subject, /endet am/);
    assert.match(sent[0].subject, /ends on/);
    for (const w of ['DOCX', 'JSON', 'ZIP', 'PDF', 'Noch 10 Tage', '10 days left', 'Gelöscht wird nichts', 'Nothing is deleted', 'https://cv.example.org']) {
      assert.ok(sent[0].html.includes(w), `Mail enthält ${w}`);
    }
    r = await runAccessNotices(db, { send });
    assert.equal(r.length, 0, 'kein zweites Mal');

    await setUntil(k1Id, "now() + interval '2 days'");
    r = await runAccessNotices(db, { send });
    assert.deepEqual(r.map(x => [x.userId, x.kind]), [[k1Id, 'final']]);
    assert.match(sent[1].html, /Noch 2 Tage/);
    assert.equal((await runAccessNotices(db, { send })).length, 0, 'final auch nur einmal');

    // Scheitert der Versand, wird der Vermerk zurückgenommen und neu versucht.
    await db.query('UPDATE users SET access_notice3_at = NULL WHERE id = $1', [k1Id]);
    r = await runAccessNotices(db, { send: async () => false });
    assert.equal(r[0].sent, false);
    const { rows } = await db.query('SELECT access_notice3_at FROM users WHERE id = $1', [k1Id]);
    assert.equal(rows[0].access_notice3_at, null);
    assert.equal((await runAccessNotices(db, { send })).length, 1, 'nächster Lauf versucht es erneut');

    // Bestandskonten (unbegrenzt) und abgelaufene Konten bekommen nichts.
    await db.query("UPDATE users SET email = 'bestand@example.org' WHERE id = $1", [altId]);
    await setUntil(k1Id, "now() - interval '1 day'");
    await db.query('UPDATE users SET access_notice14_at = NULL, access_notice3_at = NULL WHERE id = $1', [k1Id]);
    assert.equal((await runAccessNotices(db, { send })).length, 0);
  });

  // ── Nach Ablauf ──────────────────────────────────────────────────────────

  test('Nach Ablauf: alle Schreibwege 403 mit Klartext und Code; nichts wird geändert', async () => {
    // Vorher noch einen Link anlegen — er soll nach Ablauf weiter gelten.
    await setUntil(k1Id, "now() + interval '20 days'");
    const share = await K1.post(`/api/resumes/${profilK1.id}/share`, {});
    assert.equal(share.status, 200);
    const foto = await K1.post('/api/photos', { mime: 'image/png', dataBase64: PNG });
    assert.equal(foto.status, 200);
    const { rows: v } = await db.query(
      'INSERT INTO resume_versions (resume_id, user_id, payload, source) SELECT id, user_id, payload, $2 FROM resumes WHERE id = $1 RETURNING id',
      [profilK1.id, 'test'],
    );

    await setUntil(k1Id, "now() - interval '1 hour'");
    const geaendert = { ...profilK1, displayName: 'GEÄNDERT' };
    const md = (await K1.get(`/api/resumes/${profilK1.id}.md`)).data;
    const versuche = [
      ['POST /api/resumes (neu)', () => K1.post('/api/resumes', { payload: profil('Neu') })],
      ['POST /api/resumes (speichern)', () => K1.post('/api/resumes', { id: profilK1.id, displayName: 'x', payload: geaendert })],
      ['PUT /api/resumes/:id', () => K1.put(`/api/resumes/${profilK1.id}`, { displayName: 'x', payload: geaendert })],
      ['PATCH /api/resumes/:id', () => K1.patch(`/api/resumes/${profilK1.id}`, { displayName: 'x' })],
      ['import-md', () => K1.post(`/api/resumes/${profilK1.id}/import-md`, { markdown: md })],
      ['import-md dryRun', () => K1.post(`/api/resumes/${profilK1.id}/import-md`, { markdown: md, dryRun: true })],
      ['import-cover-letter-md', () => K1.post(`/api/resumes/${profilK1.id}/import-cover-letter-md`, { markdown: '# Anschreiben\n\nHallo Welt' })],
      ['restore', () => K1.post(`/api/resumes/${profilK1.id}/versions/${v[0].id}/restore`, {})],
      ['POST /api/photos', () => K1.post('/api/photos', { mime: 'image/png', dataBase64: PNG })],
      ['share anlegen', () => K1.post(`/api/resumes/${profilK1.id}/share`, {})],
      ['share auffrischen', () => K1.post(`/api/shares/${share.data.token}/refresh`, {})],
      ['share Anschreiben einschalten', () => K1.patch(`/api/shares/${share.data.token}`, { includeCoverLetter: true })],
    ];
    for (const [name, f] of versuche) {
      const r = await f();
      assert.equal(r.status, 403, `${name}: ${r.status} ${JSON.stringify(r.data)}`);
      assert.equal(r.data.code, 'access_expired', name);
      assert.match(r.data.error, /abgelaufen/, name);
      assert.match(r.data.error, /Exportieren/, name);
      assert.ok(r.data.accessUntil, name);
    }
    const { rows } = await db.query('SELECT display_name, (SELECT count(*)::int FROM resumes WHERE user_id = $2) AS n FROM resumes WHERE id = $1', [profilK1.id, k1Id]);
    assert.deepEqual(rows[0], { display_name: profilK1.displayName, n: 1 }, 'nichts geändert, nichts dazugekommen');
    assert.equal((await K1.get('/api/me')).data.access.readOnly, true);
  });

  test('Nach Ablauf: lesen, exportieren, Link, Datenauszug, Ereignis und Löschen gehen weiter', async () => {
    assert.ok(isAccessExpired((await db.query('SELECT * FROM users WHERE id = $1', [k1Id])).rows[0]));
    assert.equal((await K1.get('/api/resumes')).data.resumes.length, 1);
    assert.equal((await K1.get(`/api/resumes/${profilK1.id}`)).status, 200);
    assert.equal((await K1.get(`/api/resumes/${profilK1.id}.md`)).status, 200);
    assert.equal((await K1.get(`/api/resumes/${profilK1.id}/cover-letter.md`)).status, 200);
    assert.equal((await K1.get(`/api/resumes/${profilK1.id}/versions`)).status, 200);
    const dump = await K1.get('/api/me/export');
    assert.equal(dump.status, 200);
    assert.equal(dump.data.resumes.length, 1);
    assert.equal((await K1.post('/api/events', { kind: 'docx' })).status, 204, 'DOCX-Export meldet sich weiter');

    // Der vorher angelegte Sharelink gilt weiter (der Coach sieht weiter, was geteilt wurde).
    const shares = (await K1.get(`/api/resumes/${profilK1.id}/shares`)).data.shares;
    const tok = shares[0].token;
    assert.equal((await fetch(`${srv.base}/api/share/${tok}`)).status, 200);
    // Weniger zeigen geht, widerrufen geht.
    assert.equal((await K1.patch(`/api/shares/${tok}`, { includeCoverLetter: false })).status, 200);
    assert.equal((await K1.post(`/api/shares/${tok}/revoke`, {})).status, 200);

    // Der Aufräumjob löscht keine Profile abgelaufener Konten.
    await runJanitor(db);
    assert.equal((await db.query('SELECT count(*)::int n FROM resumes WHERE user_id = $1', [k1Id])).rows[0].n, 1);
  });

  test('Nach Ablauf: PDF über den Dienst geht weiter', { skip: chromiumPath ? false : 'kein Chromium' }, async () => {
    const html = '<!doctype html><html><body><h1>Klientin Eins</h1><p>Lebenslauf</p></body></html>';
    const r = await K1.post('/api/pdf', { html, filename: 'x.pdf' }, { raw: true });
    assert.equal(r.status, 200);
    assert.equal(r.data.subarray(0, 4).toString(), '%PDF');
  });

  // ── Verlängern ───────────────────────────────────────────────────────────

  test('Admin verlängert: ab heute bei abgelaufenem Konto, danach wieder schreiben', async () => {
    assert.equal((await K1.post(`/api/admin/users/${k1Id}/access`, { days: 30 })).status, 403, 'nur Admin');
    await db.query('UPDATE users SET access_notice14_at = now(), access_notice3_at = now() WHERE id = $1', [k1Id]);
    let r = await Adm.post(`/api/admin/users/${k1Id}/access`, { days: 30 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const diff = new Date(r.data.accessUntil).getTime() - Date.now();
    assert.ok(Math.abs(diff - 30 * DAY) < 60_000, String(diff));
    const { rows } = await db.query('SELECT access_notice14_at, access_notice3_at FROM users WHERE id = $1', [k1Id]);
    assert.deepEqual(rows[0], { access_notice14_at: null, access_notice3_at: null }, 'Hinweise kommen zum neuen Ende wieder');
    r = await K1.post('/api/resumes', { id: profilK1.id, displayName: 'Wieder offen', payload: profilK1 });
    assert.equal(r.status, 200, JSON.stringify(r.data));

    // Laufendes Konto: 30 Tage über das bisherige Ende hinaus.
    r = await Adm.post(`/api/admin/users/${k1Id}/access`, { days: 30 });
    const diff2 = new Date(r.data.accessUntil).getTime() - Date.now();
    assert.ok(Math.abs(diff2 - 60 * DAY) < 60_000, String(diff2));

    // Festes Datum, dann unbegrenzt.
    r = await Adm.post(`/api/admin/users/${k1Id}/access`, { until: '2031-03-31' });
    assert.equal(r.status, 200);
    assert.equal(new Date(r.data.accessUntil).toISOString(), '2031-04-01T00:00:00.000Z');
    r = await Adm.post(`/api/admin/users/${k1Id}/access`, { until: null });
    assert.equal(r.data.accessUntil, null);
    assert.equal((await K1.get('/api/me')).data.access, null);

    // Unbegrenzt um Tage verlängern ist keine Verlängerung.
    assert.equal((await Adm.post(`/api/admin/users/${altId}/access`, { days: 30 })).status, 409);
    for (const bad of [{ days: 0 }, { days: 'x' }, { until: '31.03.2031' }, {}]) {
      assert.equal((await Adm.post(`/api/admin/users/${k1Id}/access`, bad)).status, 400, JSON.stringify(bad));
    }
    assert.equal((await Adm.post('/api/admin/users/999999/access', { days: 5 })).status, 404);
    const me = (await Adm.get('/api/me')).data.user;
    assert.equal((await Adm.post(`/api/admin/users/${me.id}/access`, { days: 5 })).status, 400, 'Admin hat keine Laufzeit');

    // Nutzerliste zeigt Laufzeit und Code.
    const u = (await Adm.get('/api/admin/users')).data.users.find(x => x.id === k2Id);
    assert.equal(u.invite_code, pilotCode);
    assert.ok(u.access_until);
  });

  // ── Ereignisse und Auswertung ────────────────────────────────────────────

  test('POST /api/events: nur angemeldet, nur erlaubte Arten', async () => {
    assert.equal((await client(srv.base).post('/api/events', { kind: 'docx' })).status, 401);
    for (const kind of ['pdf', 'register', 'resume_save', '', 'x'.repeat(200)]) {
      assert.equal((await K2.post('/api/events', { kind })).status, 400, kind);
    }
    for (const kind of ['docx', 'pdf_local', 'share_create']) {
      assert.equal((await K2.post('/api/events', { kind })).status, 204, kind);
    }
  });

  test('Auswertung je Code: eingelöst, aktiv, PDF, DOCX, Link — nur Zahlen', async () => {
    // Stand: K1 hat docx (vorher), einen Sharelink und, mit Chromium, ein PDF
    // über den Dienst; K2 hat docx + pdf_local + share_create.
    // K2 gilt als lange nicht aktiv; ein Ereignis ohne Klientin bleibt außen vor.
    await new Promise(r => setTimeout(r, 200));   // last_seen_at wird nebenbei geschrieben
    await db.query("UPDATE users SET last_seen_at = now() - interval '20 days' WHERE id = $1", [k2Id]);
    await db.query("UPDATE users SET access_until = now() - interval '1 day' WHERE id = $1", [k2Id]);

    const r = await Adm.get('/api/admin/invite-stats');
    assert.equal(r.status, 200);
    const p = r.data.codes.find(c => c.code === pilotCode);
    assert.deepEqual(
      { max: p.max_uses, redeemed: p.redeemed, accounts: p.accounts, active14d: p.active14d, with_pdf: p.with_pdf, with_docx: p.with_docx, with_export: p.with_export, with_share: p.with_share, expired: p.expired, access_days: p.access_days, note: p.note },
      { max: 10, redeemed: 2, accounts: 2, active14d: 1, with_pdf: chromiumPath ? 2 : 1, with_docx: 2, with_export: 2, with_share: 2, expired: 1, access_days: 90, note: 'Pilot Coach A' },
    );
    const a = r.data.codes.find(c => c.code === altCode);
    assert.equal(a.redeemed, 1); assert.equal(a.with_export, 0); assert.equal(a.access_days, null);
    // Keine Namen, keine Inhalte in der Antwort.
    const text = JSON.stringify(r.data);
    for (const w of ['klientin1', 'klient2', 'k1@example.org', 'Klientin Eins']) assert.ok(!text.includes(w), w);
    assert.equal((await K1.get('/api/admin/invite-stats')).status, 403);
  });

  test('Kontolöschung eines Klienten lässt die Notiz am Pilot-Code stehen und zählt weiter als eingelöst', async () => {
    const r = await K2.post('/api/me/delete', { password: 'klient-passwort-2' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const { rows } = await db.query('SELECT note FROM invite_codes WHERE code = $1', [pilotCode]);
    assert.equal(rows[0].note, 'Pilot Coach A');
    const p = (await Adm.get('/api/admin/invite-stats')).data.codes.find(c => c.code === pilotCode);
    assert.equal(p.redeemed, 2);
    assert.equal(p.accounts, 1);
  });
});
