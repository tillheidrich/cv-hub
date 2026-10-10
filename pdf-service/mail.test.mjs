// E-Mail-Workflows (10.10.2026): Warteschlange, Einwilligung, Abmeldung,
// SMTP aus dem Admin-Bereich. Echter Dienst gegen echte Postgres-Instanz und
// einen kleinen SMTP-Ersatz in diesem Prozess (kein Netz nach draußen).
//
// Ports: MAIL_PG_PORT (5771), MAIL_API_PORT (3471), MAIL_SMTP_PORT (2571).

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import { startPostgres, startServer, findPgBin, client } from './testkit.mjs';
import { encryptSecret, decryptSecret, settingsKey, unsubscribeToken, verifyUnsubscribeToken, validateSettings } from './mailsettings.js';
import { renderWorkflow, validateOverride, validateTiming, sampleCtx, TIPS_CONSENT_VERSION } from './mailflows.js';
import { createMailer } from './mailqueue.js';
import { runAccessNotices } from './access.js';

const PG_PORT = Number(process.env.MAIL_PG_PORT || 5771);
const API_PORT = Number(process.env.MAIL_API_PORT || 3471);
const SMTP_PORT = Number(process.env.MAIL_SMTP_PORT || 2571);
const PG_MISSING = findPgBin() ? false : 'keine Postgres-Binärdateien gefunden (PG_BIN setzen)';
const KEY = 'a'.repeat(64);
const BASE = 'https://cv.example.test';
const SMTP_PASS = 'smtp-geheim-Passwort-42';

/* ── Reine Funktionen ─────────────────────────────────────────────────── */

test('SMTP-Passwort: AES-256-GCM, Schlüssel aus MAIL_SETTINGS_KEY oder abgeleitet aus JWT_SECRET', () => {
  const env = { MAIL_SETTINGS_KEY: KEY, JWT_SECRET: 'x' };
  const blob = encryptSecret('geheim', env);
  assert.match(blob, /^v1:k:/);
  assert.ok(!blob.includes('geheim'));
  assert.equal(decryptSecret(blob, env), 'geheim');
  assert.notEqual(encryptSecret('geheim', env), blob, 'eigener IV je Verschlüsselung');
  assert.equal(decryptSecret(blob, { MAIL_SETTINGS_KEY: 'b'.repeat(64) }), null, 'falscher Schlüssel: null');
  assert.equal(decryptSecret(blob.replace(/.$/, c => (c === 'A' ? 'B' : 'A')), env), null, 'verändert: null');
  const j = settingsKey({ JWT_SECRET: 'jwt' });
  assert.equal(j.id, 'j');
  assert.match(j.warning, /MAIL_SETTINGS_KEY fehlt/);
  const jb = encryptSecret('x', { JWT_SECRET: 'jwt' });
  assert.match(jb, /^v1:j:/);
  assert.equal(decryptSecret(jb, { JWT_SECRET: 'jwt', MAIL_SETTINGS_KEY: KEY }), null, 'Herkunft passt nicht: null statt Unsinn');
});

test('Abmelde-Token: gültig, verändert ungültig, fremde Konto-ID ungültig', () => {
  const env = { JWT_SECRET: 'jwt' };
  const t = unsubscribeToken(42, env);
  assert.equal(verifyUnsubscribeToken(t, env), 42);
  assert.equal(verifyUnsubscribeToken(t.replace(/^42/, '43'), env), null);
  assert.equal(verifyUnsubscribeToken(`${t.slice(0, -1)}${t.endsWith('A') ? 'B' : 'A'}`, env), null);
  assert.equal(verifyUnsubscribeToken('kaputt', env), null);
  assert.equal(verifyUnsubscribeToken(t, { JWT_SECRET: 'anders' }), null);
});

test('SMTP-Eingabe wird geprüft (keine Zeilenumbrüche, gültiger Absender)', () => {
  assert.equal(validateSettings({ host: 'smtp.example.de', port: 587, security: 'starttls', username: 'u', from: 'CV-Hub <a@b.de>' }).ok, true);
  assert.equal(validateSettings({ host: 'smtp.example.de', port: 587, security: 'starttls', from: 'a@b.de\r\nBcc: x@y.de' }).ok, false);
  assert.equal(validateSettings({ host: 'smtp example', port: 587, security: 'starttls', from: 'a@b.de' }).ok, false);
  assert.equal(validateSettings({ host: 'smtp.example.de', port: 70000, security: 'tls', from: 'a@b.de' }).ok, false);
  assert.equal(validateSettings({ host: 'smtp.example.de', port: 465, security: 'ssl', from: 'a@b.de' }).ok, false);
});

test('Tipps-Mail: Abmeldelink im Text und List-Unsubscribe nach RFC 8058; Servicemail ohne', () => {
  const tips = renderWorkflow('tips_1', 'de', sampleCtx('tips_1', BASE), {
    unsubscribeUrl: `${BASE}/mail/abmelden?token=1.x`, oneClickUrl: `${BASE}/pdfapi/api/mail/unsubscribe?token=1.x`, consentAt: new Date(),
    seller: { name: 'Testverkäufer', address: 'Testweg 1\n12345 Teststadt' },
  });
  assert.equal(tips.headers['List-Unsubscribe'], `<${BASE}/pdfapi/api/mail/unsubscribe?token=1.x>`);
  assert.equal(tips.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.ok(tips.html.includes(`${BASE}/mail/abmelden?token=1.x`));
  assert.match(tips.html, /Tipps abbestellen/);
  assert.match(tips.html, /Absender: Testverkäufer, Testweg 1, 12345 Teststadt/);
  assert.match(tips.text, /Abbestellen geht mit einem Klick/);
  const welcome = renderWorkflow('welcome', 'en', sampleCtx('welcome', BASE));
  assert.deepEqual(welcome.headers, {});
  assert.match(welcome.subject, /confirmed/);
  for (const l of ['de', 'en', 'fr', 'es']) {
    for (const id of ['welcome', 'pass_expired', 'voucher_redeemed', 'tips_1', 'tips_3', 'tips_7']) {
      const m = renderWorkflow(id, l, sampleCtx(id, BASE), { unsubscribeUrl: 'https://u', consentAt: new Date() });
      assert.ok(m.subject && !/\{\{/.test(m.subject + m.html + m.text), `${id}/${l}: kein offener Platzhalter`);
    }
  }
});

test('Anpassung: nur bekannte Platzhalter, alles escaped, keine Template-Injection', () => {
  assert.equal(validateOverride('welcome', { body: 'Hallo {{name}} {{konto}}' }).ok, true);
  assert.match(validateOverride('welcome', { body: 'x {{constructor}}' }).error, /Unbekannte Platzhalter/);
  assert.match(validateOverride('welcome', { body: 'x {{name.constructor}}' }).error, /Unbekannte Platzhalter/);
  assert.match(validateOverride('welcome', { subject: 'a\nb' }).error, /eine Zeile/);
  assert.equal(validateOverride('pass_ending', { body: 'x' }).ok, false, 'bestehende Vorlage nicht anpassbar');
  const o = validateOverride('welcome', { heading: '<i>Hi</i>', body: '<script>alert(1)</script> Hallo {{name}}\n\n- <b>eins</b>' }).value;
  const m = renderWorkflow('welcome', 'de', { ...sampleCtx('welcome', BASE), user: { username: '<img src=x onerror=alert(2)>' } }, { overrides: { de: o } });
  assert.ok(!/<script>|<img src=x|<b>eins|<i>Hi/.test(m.html), 'kein eingeschleustes Markup');
  assert.ok(m.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(m.html.includes('&lt;img src=x onerror=alert(2)&gt;'));
  assert.ok(m.html.includes('<li style="margin:0 0 6px;">&lt;b&gt;eins&lt;/b&gt;</li>'));
  assert.equal(validateTiming('pass_ending', { soonDays: 3, finalDays: 5 }).ok, false);
  assert.equal(validateTiming('tips_1', { delayDays: 30 }).ok, false, 'Tipps höchstens zwei Wochen (so steht es in der Einwilligung)');
});

/* ── SMTP-Ersatz ──────────────────────────────────────────────────────── */

function fakeSmtp(port, { user, pass }) {
  const mails = [];
  const srv = net.createServer(sock => {
    sock.write('220 fake ESMTP\r\n');
    let buf = '';
    let inData = false;
    let cur = { data: '' };
    let authUser = null;
    let stage = null;
    sock.on('error', () => {});
    sock.on('data', d => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === '.') { inData = false; mails.push(cur); cur = { data: '' }; sock.write('250 OK\r\n'); } else cur.data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
          continue;
        }
        if (stage === 'user') { authUser = Buffer.from(line, 'base64').toString(); stage = 'pass'; sock.write('334 UGFzc3dvcmQ6\r\n'); continue; }
        if (stage === 'pass') { stage = null; sock.write(authUser === user && Buffer.from(line, 'base64').toString() === pass ? '235 ok\r\n' : '535 bad\r\n'); continue; }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') sock.write('250-fake\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n');
        else if (cmd === 'AUTH') {
          const parts = line.split(' ');
          if (String(parts[1]).toUpperCase() === 'PLAIN') {
            const dec = Buffer.from(parts[2] || '', 'base64').toString().split('\0');
            sock.write(dec[1] === user && dec[2] === pass ? '235 ok\r\n' : '535 bad\r\n');
          } else { stage = 'user'; sock.write('334 VXNlcm5hbWU6\r\n'); }
        } else if (cmd === 'MAIL') { cur.from = line; sock.write('250 OK\r\n'); }
        else if (cmd === 'RCPT') { (cur.rcpt ||= []).push(line); sock.write('250 OK\r\n'); }
        else if (cmd === 'DATA') { inData = true; sock.write('354 go\r\n'); }
        else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
        else sock.write('250 OK\r\n');
      }
    });
  });
  return new Promise(resolve => srv.listen(port, '127.0.0.1', () => resolve({ mails, close: () => new Promise(r => srv.close(r)) })));
}
/** Quoted-Printable und Zeilenumbrüche aus dem Mailtext entfernen. */
const plain = raw => raw.replace(/\n[ \t]+/g, ' ').replace(/=\r?\n/g, '').replace(/(?:=[0-9A-F]{2})+/g, m => Buffer.from(m.replace(/=/g, ''), 'hex').toString('utf8'));

/* ── Gegen den laufenden Dienst ──────────────────────────────────────── */

describe('E-Mail-Workflows gegen die laufende API', { skip: PG_MISSING }, () => {
  let pgInst, api, db, smtp, mailer;
  let A; // Admin
  const ids = {};
  const pw = 'kunde-passwort-1';

  async function login(name) {
    const c = client(api.base);
    const r = await c.post('/api/auth/login', { username: name, password: name === 'root' ? 'admin-passwort-1' : pw });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return c;
  }
  /** Das Protokoll schreibt admin.js nach der Antwort: kurz warten. */
  async function auditRows(sql) {
    for (let i = 0; i < 40; i++) {
      const { rows } = await db.query(sql);
      if (rows.length) return rows;
      await new Promise(r => setTimeout(r, 50));
    }
    return [];
  }
  const queue = async (where = 'true', args = []) => (await db.query(`SELECT * FROM mail_queue WHERE ${where} ORDER BY id`, args)).rows;

  before(async () => {
    pgInst = await startPostgres(PG_PORT);
    smtp = await fakeSmtp(SMTP_PORT, { user: 'cvmail', pass: SMTP_PASS });
    api = await startServer({
      DATABASE_URL: pgInst.url, JWT_SECRET: 'mail-test-secret', MAIL_SETTINGS_KEY: KEY, NODE_ENV: 'test',
      PUBLIC_BASE_URL: BASE, ALLOWED_ORIGINS: BASE, ADMIN_HOST: '', ADMIN_URL: '', ADMIN_EMAIL: 'ops@example.test',
      ADMIN_USERNAME: 'root', ADMIN_PASSWORD: 'admin-passwort-1',
      MAIL_CAPTURE_FILE: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', SMTP_FORCE_ENV: '',
      JANITOR: '0', ACCESS_NOTICES: '0', BILLING_JOBS: '0', MAIL_JOBS: '0', TRUST_PROXY: '', TEST_RATE_LIMIT_FACTOR: '20',
      SELLER_NAME: 'Testverkäufer', SELLER_ADDRESS: 'Testweg 1\n12345 Teststadt',
    }, { port: API_PORT });
    db = new pg.Pool({ connectionString: pgInst.url, max: 3 });
    const hash = await bcrypt.hash(pw, 4);
    for (const [name, extra] of [['kim', "email_confirmed_at = now(), mail_lang = 'en'"], ['nora', 'email_confirmed_at = now()'], ['pia', "email_confirmed_at = now(), plan_kind = 'pass', access_until = now() + interval '2 days'"], ['ole', 'email_confirmed_at = NULL']]) {
      const { rows } = await db.query(`INSERT INTO users (username, password_hash, email, signup_source, password_changed_at) VALUES ($1, $2, $3, 'self', now()) RETURNING id`, [name, hash, `${name}@example.test`]);
      ids[name] = rows[0].id;
      await db.query(`UPDATE users SET ${extra} WHERE id = $1`, [ids[name]]);
    }
    A = await login('root');
    // Eigener Mailer in diesem Prozess auf derselben Datenbank (für Einreihen und Abläufe).
    process.env.JWT_SECRET = 'mail-test-secret';
    process.env.MAIL_SETTINGS_KEY = KEY;
    mailer = createMailer({ pool: db, base: BASE, configured: () => true, send: async () => ({ ok: true }), log: () => {} });
  });

  after(async () => {
    await db?.end().catch(() => {});
    await api?.stop();
    await smtp?.close();
    pgInst?.stop();
  });

  test('Einreihen ist idempotent je Konto, Workflow und Anlass', async () => {
    const a = await mailer.enqueue('welcome', ids.nora, 'v1');
    const b = await mailer.enqueue('welcome', ids.nora, 'v1');
    assert.equal(a.queued, true);
    assert.deepEqual(b, { queued: false, reason: 'duplicate' });
    assert.equal((await queue("workflow = 'welcome' AND user_id = $1", [ids.nora])).length, 1);
    // Abgeschaltet: wird gar nicht erst eingereiht.
    const off = await A.post('/api/admin/mail/workflows/voucher_redeemed', { enabled: false });
    assert.equal(off.status, 200);
    assert.deepEqual(await mailer.enqueue('voucher_redeemed', ids.nora, '1'), { queued: false, reason: 'disabled' });
    await A.post('/api/admin/mail/workflows/voucher_redeemed', { enabled: true });
  });

  test('Ohne SMTP: Mails warten („wartet auf SMTP“) und verschwinden nicht', async () => {
    const r = await A.post('/api/admin/mail/run', {});
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const rows = await queue("workflow = 'welcome' AND user_id = $1", [ids.nora]);
    assert.equal(rows[0].status, 'waiting_smtp');
    const q = await A.get('/api/admin/mail/queue');
    assert.equal(q.status, 200);
    const e = q.data.entries.find(x => x.id === Number(rows[0].id));
    assert.equal(e.status, 'waiting_smtp');
    assert.match(e.to, /^no•+@example\.test$/, 'Empfänger gekürzt');
    assert.equal(q.data.smtpConfigured, false);
    const log = await A.get('/api/admin/mail/log');
    assert.ok(log.data.entries.some(x => x.workflow === 'welcome' && x.status === 'waiting_smtp'));
    // Ein zweiter Lauf ändert nichts: wartende Mails gehen nicht von selbst.
    await A.post('/api/admin/mail/run', {});
    assert.equal((await queue("workflow = 'welcome' AND user_id = $1", [ids.nora]))[0].status, 'waiting_smtp');
    // Senden ohne SMTP: klare Absage.
    const s = await A.post(`/api/admin/mail/queue/${rows[0].id}/send`, {});
    assert.equal(s.status, 409);
  });

  test('Einwilligung in Tipps: nur ausdrücklich, mit Fassung; ohne Einwilligung keine Tipps', async () => {
    const K = await login('kim');
    let r = await K.get('/api/me/mail');
    assert.equal(r.data.tips, 'off');
    r = await K.post('/api/me/mail', { tips: true, version: 'alt' });
    assert.equal(r.status, 409, 'andere Textfassung zählt nicht');
    r = await K.post('/api/me/mail', { tips: true, version: TIPS_CONSENT_VERSION });
    assert.equal(r.status, 200);
    assert.equal(r.data.tips, 'on');
    assert.equal(r.data.consentVersion, TIPS_CONSENT_VERSION);
    // Unbestätigte Adresse: Einwilligung wartet auf den Bestätigungslink.
    const O = await login('ole');
    r = await O.post('/api/me/mail', { tips: true, version: TIPS_CONSENT_VERSION });
    assert.equal(r.data.tips, 'pending');
    // Zwei Tage nach der Einwilligung: Tipp 1 fällig, Tipp 2 und 3 noch nicht. Nora und Ole: nichts.
    await db.query(`UPDATE mail_prefs SET tips_consent_at = now() - interval '2 days' WHERE user_id = $1`, [ids.kim]);
    await db.query(`UPDATE mail_prefs SET tips_requested_at = now() - interval '2 days' WHERE user_id = $1`, [ids.ole]);
    await mailer.scanDue();
    await mailer.scanDue();
    const tips = await queue("workflow LIKE 'tips_%'");
    assert.deepEqual(tips.map(t => [t.workflow, t.user_id]), [['tips_1', ids.kim]], 'genau ein Tipp, nur mit wirksamer Einwilligung');
    // Auch von Hand eingereiht geht ohne Einwilligung nichts raus.
    const n = await mailer.enqueue('tips_1', ids.nora, 'v1');
    const row = (await queue('id = $1', [n.id]))[0];
    const d = await mailer.deliverRow(row);
    assert.deepEqual(d, { status: 'skipped', error: 'keine Einwilligung' });
  });

  test('Hinweis vor Pass-Ende und „Pass abgelaufen“: je genau einmal', async () => {
    const opts = await mailer.accessNoticeOptions();
    const r1 = await runAccessNotices(db, opts);
    const r2 = await runAccessNotices(db, opts);
    assert.deepEqual(r1.filter(x => x.userId === ids.pia).map(x => [x.workflow, x.kind]), [['pass_ending', 'final']]);
    assert.equal(r2.filter(x => x.userId === ids.pia).length, 0);
    assert.equal((await queue("workflow = 'pass_ending' AND user_id = $1", [ids.pia])).length, 1);
    await db.query(`UPDATE users SET access_until = now() - interval '1 hour' WHERE id = $1`, [ids.pia]);
    await mailer.scanDue();
    await mailer.scanDue();
    const exp = await queue("workflow = 'pass_expired' AND user_id = $1", [ids.pia]);
    assert.equal(exp.length, 1);
    // Die Hinweis-Mail zum alten Ende ist jetzt überholt.
    const old = (await queue("workflow = 'pass_ending' AND user_id = $1", [ids.pia]))[0];
    assert.deepEqual(await mailer.deliverRow(old), { status: 'skipped', error: 'Laufzeit hat sich geändert' });
  });

  test('SMTP im Admin-Bereich: verschlüsselt gespeichert, nie in Antworten, erst nach Prüfung aktiv', async () => {
    const bad = await A.post('/api/admin/mail/smtp', { host: '127.0.0.1', port: SMTP_PORT, security: 'none', username: 'cvmail', password: 'falsch', from: 'CV-Hub <cv@example.test>', activate: true });
    assert.equal(bad.status, 422);
    assert.match(bad.data.error, /Verbindung fehlgeschlagen/);
    assert.equal(bad.data.smtp.configured, false, 'falsches Passwort: nicht aktiv');
    const ok = await A.post('/api/admin/mail/smtp', { host: '127.0.0.1', port: SMTP_PORT, security: 'none', username: 'cvmail', password: SMTP_PASS, from: 'CV-Hub <cv@example.test>', replyTo: 'hilfe@example.test', activate: true });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.equal(ok.data.smtp.configured, true);
    assert.equal(ok.data.smtp.source, 'db');
    assert.equal(ok.data.stored.passwordSet, true);
    const st = await A.get('/api/admin/mail');
    for (const body of [JSON.stringify(ok.data), JSON.stringify(bad.data), JSON.stringify(st.data)]) {
      assert.ok(!body.includes(SMTP_PASS) && !body.includes('falsch'), 'kein Passwort in einer Antwort');
      assert.ok(!/password_enc|v1:k:/.test(body), 'auch nicht verschlüsselt');
    }
    const row = (await db.query('SELECT password_enc FROM mail_settings WHERE id = 1')).rows[0];
    assert.ok(row.password_enc.startsWith('v1:k:') && !row.password_enc.includes(SMTP_PASS));
    assert.equal(decryptSecret(row.password_enc, { MAIL_SETTINGS_KEY: KEY }), SMTP_PASS);
    await auditRows(`SELECT 1 FROM admin_audit WHERE action = 'mail_smtp_save' AND details->>'verified' = 'true'`);
    const audit = (await db.query(`SELECT action, details::text AS d FROM admin_audit WHERE action LIKE 'mail_smtp%'`)).rows;
    assert.ok(audit.length >= 2, 'gescheiterte und erfolgreiche Speicherung im Protokoll');
    assert.ok(audit.every(a => !String(a.d).includes(SMTP_PASS)), 'kein Passwort im Protokoll');
    // Speichern ohne Passwortfeld lässt das Passwort stehen.
    const keep = await A.post('/api/admin/mail/smtp', { host: '127.0.0.1', port: SMTP_PORT, security: 'none', username: 'cvmail', from: 'CV-Hub <cv@example.test>', replyTo: 'hilfe@example.test', activate: true });
    assert.equal(keep.status, 200);
    // Testmail an mich.
    const before = smtp.mails.length;
    const t = await A.post('/api/admin/mail/test', {});
    assert.equal(t.status, 200, JSON.stringify(t.data));
    assert.equal(smtp.mails.length, before + 1);
    assert.match(smtp.mails.at(-1).rcpt.join(), /ops@example\.test/);
    assert.match(smtp.mails.at(-1).data, /Reply-To: hilfe@example\.test/i);
  });

  test('Nach dem Einrichten: wartende Mails senden; Tipps mit List-Unsubscribe; Abmelden per One-Click', async () => {
    const before = smtp.mails.length;
    const r = await A.post('/api/admin/mail/queue/waiting', { action: 'send' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.sent >= 1);
    assert.equal((await queue("workflow = 'welcome' AND user_id = $1", [ids.nora]))[0].status, 'sent');
    // Tipp 1 an Kim (Englisch, weil mail_lang en).
    await A.post('/api/admin/mail/run', {});
    const tipMail = smtp.mails.slice(before).find(m => /kim@example\.test/.test(m.rcpt.join()));
    assert.ok(tipMail, 'Tipp an Kim gesendet');
    const raw = plain(tipMail.data);
    assert.match(raw, /^List-Unsubscribe: <https:\/\/cv\.example\.test\/pdfapi\/api\/mail\/unsubscribe\?token=\d+\.[A-Za-z0-9_-]{32}>/m);
    assert.match(raw, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click/m);
    assert.match(raw, /Tip 1 of 3/);
    const token = /unsubscribe\?token=(\d+\.[A-Za-z0-9_-]{32})/.exec(raw)[1];
    assert.equal(verifyUnsubscribeToken(token, { MAIL_SETTINGS_KEY: KEY, JWT_SECRET: 'mail-test-secret' }), ids.kim);
    // GET ändert nichts (Link-Scanner).
    const g = await fetch(`${api.base}/api/mail/unsubscribe?token=${token}`);
    assert.deepEqual(await g.json(), { valid: true });
    const K = await login('kim');
    assert.equal((await K.get('/api/me/mail')).data.tips, 'on');
    // Verändert: abgewiesen.
    const bad = await fetch(`${api.base}/api/mail/unsubscribe?token=${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`, { method: 'POST' });
    assert.equal(bad.status, 400);
    // One-Click wie ein Mailanbieter: POST ohne Cookie, Formular-Body.
    const oc = await fetch(`${api.base}/api/mail/unsubscribe?token=${token}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' });
    assert.equal(oc.status, 200);
    assert.deepEqual(await oc.json(), { ok: true, changed: true });
    const p = (await K.get('/api/me/mail')).data;
    assert.equal(p.tips, 'off');
    assert.ok(p.withdrawnAt);
    assert.equal((await db.query('SELECT tips_withdrawn_via FROM mail_prefs WHERE user_id = $1', [ids.kim])).rows[0].tips_withdrawn_via, 'one-click');
    // Danach keine Tipps mehr.
    await db.query(`DELETE FROM mail_queue WHERE workflow = 'tips_3'`);
    const n = await mailer.enqueue('tips_3', ids.kim, 'v1');
    assert.equal((await mailer.deliverRow((await queue('id = $1', [n.id]))[0])).status, 'skipped');
    const ov = await A.get('/api/admin/mail');
    assert.equal(ov.data.workflows.find(w => w.id === 'tips_1').counts.unsubscribed, 1);
  });

  test('Double-Opt-in: Bestätigungsmail nennt die Tipps, der Klick macht sie wirksam und schickt das Willkommen', async () => {
    const O = await login('ole');
    const before = smtp.mails.length;
    const r = await O.post('/api/auth/resend-confirmation', {});
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const m = smtp.mails.slice(before).find(x => /ole@example\.test/.test(x.rcpt.join()));
    assert.ok(m, 'Bestätigungsmail an Ole');
    const raw = plain(m.data);
    assert.match(raw, /Tipps zur Nutzung per E-Mail/);
    assert.match(raw, /bestätigen Sie auch diese Einwilligung/);
    const token = /email-bestaetigen\?token=([A-Za-z0-9_-]+)/.exec(raw)[1];
    const c = await O.post('/api/auth/confirm-email', { token });
    assert.equal(c.status, 200, JSON.stringify(c.data));
    assert.equal(c.data.tips, 'on');
    const p = (await O.get('/api/me/mail')).data;
    assert.equal(p.tips, 'on');
    assert.equal(p.consentVersion, TIPS_CONSENT_VERSION);
    assert.equal((await queue("workflow = 'welcome' AND user_id = $1", [ids.ole])).length, 1, 'Willkommen nach der Bestätigung');
  });

  test('Admin-Anpassung: escaped, unbekannte Platzhalter abgewiesen, Rücksetzen auf Standard, Protokoll', async () => {
    const bad = await A.post('/api/admin/mail/workflows/welcome', { overrides: { de: { body: 'Hallo {{passwort}}' } } });
    assert.equal(bad.status, 400);
    const ok = await A.post('/api/admin/mail/workflows/welcome', { overrides: { de: { subject: 'Hallo {{name}}', body: '<img src=x onerror=alert(1)> Willkommen {{name}}' } } });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    const pv = await A.post('/api/admin/mail/preview', { workflow: 'welcome', lang: 'de' });
    assert.equal(pv.status, 200);
    assert.ok(pv.data.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!pv.data.html.includes('<img src=x'));
    assert.equal(pv.data.subject, 'Hallo beispiel');
    const page = await fetch(`${api.base}/api/admin/mail/preview.html?workflow=welcome&lang=de`, { headers: { Cookie: A.cookie } });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
    const reset = await A.post('/api/admin/mail/workflows/welcome', { overrides: { de: null } });
    assert.equal(reset.status, 200);
    const pv2 = await A.post('/api/admin/mail/preview', { workflow: 'welcome', lang: 'de' });
    assert.match(pv2.data.subject, /Deine Adresse ist bestätigt/);
    const tm = await A.post('/api/admin/mail/workflows/pass_ending', { timing: { soonDays: 7, finalDays: 1 } });
    assert.equal(tm.status, 200);
    assert.deepEqual(tm.data.settings.timing, { soonDays: 7, finalDays: 1 });
    await auditRows(`SELECT 1 FROM admin_audit WHERE action = 'mail_workflow_save' AND target = 'pass_ending'`);
    const audit = (await db.query(`SELECT action, target FROM admin_audit WHERE action = 'mail_workflow_save'`)).rows;
    assert.ok(audit.some(a => a.target === 'welcome') && audit.some(a => a.target === 'pass_ending'));
    // Vorschau steht nicht im Protokoll (liest nur).
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM admin_audit WHERE action LIKE '%preview%'`)).rows[0].n, 0);
  });

  test('Admin-Routen nur für Admins', async () => {
    const K = await login('nora');
    for (const [m, p] of [['get', '/api/admin/mail'], ['post', '/api/admin/mail/smtp'], ['get', '/api/admin/mail/queue'], ['post', '/api/admin/mail/run']]) {
      const r = m === 'get' ? await K.get(p) : await K.post(p, {});
      assert.equal(r.status, 403, `${m} ${p}`);
    }
  });
});
