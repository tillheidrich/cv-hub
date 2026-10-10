// SMTP-Einstellungen aus dem Admin-Bereich und die Schlüssel der
// E-Mail-Workflows (10.10.2026, MAILS.md).
//
// Der Mailversand soll zentral im Admin-Bereich einstellbar sein, auch wenn
// SMTP erst später eingerichtet wird. Deshalb lassen sich Host, Port,
// Verschlüsselung, Benutzer, Passwort, Absender und Antwortadresse im
// Admin-Bereich pflegen. Gespeichert wird in mail_settings (eine Zeile), das
// Passwort mit AES-256-GCM verschlüsselt.
//
// Schlüssel: MAIL_SETTINGS_KEY (32 Byte als 64 Hex-Zeichen oder Base64; jede
// andere Zeichenkette wird per HKDF auf 32 Byte gebracht). Fehlt er, wird ein
// Schlüssel aus JWT_SECRET abgeleitet (HKDF-SHA256, eigener Kontext) und beim
// Start gewarnt: Wer JWT_SECRET wechselt, muss dann das SMTP-Passwort neu
// setzen. Der Geheimtext trägt die Herkunft des Schlüssels („k" oder „j"),
// damit die Oberfläche sagen kann, warum er sich nicht mehr öffnen lässt.
//
// Vorrang: Gespeicherte UND aktivierte Einstellungen gehen der Umgebung vor
// (mail.js). Aktiviert wird nur nach bestandener Verbindungsprüfung.
// Notschalter: SMTP_FORCE_ENV=1.

import crypto from 'node:crypto';
import { configureMail } from './mail.js';

const AAD = Buffer.from('cv-smtp-password-v1');

function hkdf(secret, info) {
  return Buffer.from(crypto.hkdfSync('sha256', Buffer.from(String(secret)), Buffer.from('cv-mail-settings'), Buffer.from(info), 32));
}

/** { key, id, warning } für die Verschlüsselung. Wirft, wenn gar kein
 *  Geheimnis da ist (dann gibt es auch keine Sitzungen). */
export function settingsKey(env = process.env) {
  const raw = String(env.MAIL_SETTINGS_KEY || '').trim();
  if (raw) {
    if (/^[0-9a-f]{64}$/i.test(raw)) return { key: Buffer.from(raw, 'hex'), id: 'k', warning: null };
    try {
      const b = Buffer.from(raw, 'base64');
      if (b.length === 32 && /^[A-Za-z0-9+/_-]+=*$/.test(raw)) return { key: b, id: 'k', warning: null };
    } catch { /* kein Base64 */ }
    return { key: hkdf(raw, 'smtp-password'), id: 'k', warning: 'MAIL_SETTINGS_KEY ist kein 32-Byte-Schlüssel (64 Hex-Zeichen oder Base64), er wird per HKDF abgeleitet.' };
  }
  const jwt = String(env.JWT_SECRET || '');
  if (!jwt) throw new Error('Weder MAIL_SETTINGS_KEY noch JWT_SECRET gesetzt.');
  return { key: hkdf(jwt, 'smtp-password'), id: 'j', warning: 'MAIL_SETTINGS_KEY fehlt: Das SMTP-Passwort wird mit einem aus JWT_SECRET abgeleiteten Schlüssel verschlüsselt. Ein Wechsel von JWT_SECRET macht es unlesbar.' };
}

export function encryptSecret(plain, env = process.env) {
  const { key, id } = settingsKey(env);
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(AAD);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `v1:${id}:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

/** Klartext oder null (falscher Schlüssel, kaputter Wert). */
export function decryptSecret(blob, env = process.env) {
  const m = /^v1:([kj]):([^:]+):([^:]+):([^:]*)$/.exec(String(blob || ''));
  if (!m) return null;
  try {
    const { key, id } = settingsKey(env);
    if (id !== m[1]) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(m[2], 'base64'));
    d.setAAD(AAD);
    d.setAuthTag(Buffer.from(m[3], 'base64'));
    return Buffer.concat([d.update(Buffer.from(m[4], 'base64')), d.final()]).toString('utf8');
  } catch { return null; }
}

/* ── Abmelde-Token ─────────────────────────────────────────────────────
 * Zustandslos: Konto-ID plus HMAC. Der Schlüssel kommt aus demselben
 * Geheimnis (eigener HKDF-Kontext), Abmeldelinks gelten damit so lange, wie
 * MAIL_SETTINGS_KEY bzw. JWT_SECRET gleich bleiben. Ein ungültiger Link
 * führt auf eine Seite mit dem Weg über die Kontoeinstellungen. */
function tokenKey(env = process.env) {
  const secret = String(env.MAIL_SETTINGS_KEY || '').trim() || String(env.JWT_SECRET || '');
  return hkdf(secret, 'unsubscribe-v1');
}
export function unsubscribeToken(userId, env = process.env) {
  const id = String(Number(userId));
  const mac = crypto.createHmac('sha256', tokenKey(env)).update(`unsub:${id}`).digest('base64url').slice(0, 32);
  return `${id}.${mac}`;
}
/** Konto-ID oder null. */
export function verifyUnsubscribeToken(token, env = process.env) {
  const m = /^(\d{1,10})\.([A-Za-z0-9_-]{32})$/.exec(String(token || '').trim());
  if (!m) return null;
  const want = Buffer.from(unsubscribeToken(m[1], env).split('.')[1]);
  const got = Buffer.from(m[2]);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? Number(m[1]) : null;
}

/* ── Gespeicherte Einstellungen ─────────────────────────────────────── */

const SECURITY = new Set(['tls', 'starttls', 'none']);
const ADDR_RE = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[^\s@<>()",;:\\[\]]+$/;
const HOST_RE = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;

/** „Name <adresse>" oder „adresse"; sonst null. */
export function cleanFrom(v) {
  const s = String(v ?? '').trim().replace(/[\r\n\t]/g, ' ').slice(0, 200);
  if (!s) return '';
  const m = /^(.{0,120}?)\s*<([^<>]+)>$/.exec(s);
  if (m) {
    const name = m[1].replace(/["\\]/g, '').trim();
    return ADDR_RE.test(m[2].trim()) ? (name ? `${name} <${m[2].trim()}>` : m[2].trim()) : null;
  }
  return ADDR_RE.test(s) ? s : null;
}

/**
 * Prüft eine Eingabe aus dem Admin-Bereich. Gibt { ok, value, errors } zurück.
 * Das Passwort: undefined = unverändert, '' = löschen, sonst ersetzen.
 */
export function validateSettings(body) {
  const errors = [];
  const host = String(body?.host ?? '').trim().toLowerCase();
  if (!HOST_RE.test(host)) errors.push('Host ungültig.');
  const port = Number.parseInt(String(body?.port ?? ''), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('Port 1 bis 65535.');
  const security = String(body?.security ?? '');
  if (!SECURITY.has(security)) errors.push('Sicherheit: tls, starttls oder none.');
  const username = String(body?.username ?? '').trim().slice(0, 200);
  if (/[\r\n]/.test(username)) errors.push('Benutzer ungültig.');
  const from = cleanFrom(body?.from);
  if (!from) errors.push('Absender als „Name <adresse@domain>" oder „adresse@domain".');
  const replyTo = body?.replyTo ? cleanFrom(body.replyTo) : '';
  if (replyTo === null) errors.push('Antwortadresse ungültig.');
  let password;
  if (body?.password !== undefined && body?.password !== null) {
    password = String(body.password);
    if (password.length > 500 || /[\r\n]/.test(password)) errors.push('Passwort ungültig.');
  }
  return { ok: !errors.length, errors, value: { host, port, security, username, from, replyTo: replyTo || '', password } };
}

/** Zeile → Konfiguration für mail.js (entschlüsselt) oder null. */
function rowToCfg(r) {
  if (!r || !r.enabled || !r.host) return null;
  const pass = r.password_enc ? decryptSecret(r.password_enc) : '';
  if (r.password_enc && pass === null) return null;
  return { host: r.host, port: r.port, security: r.security, user: r.username || '', pass: pass || '', from: r.from_addr, replyTo: r.reply_to || '' };
}

/** Sicht für die Oberfläche: nie das Passwort, nur ob eines gesetzt ist. */
export function publicSettings(r) {
  if (!r) return null;
  const decryptable = r.password_enc ? decryptSecret(r.password_enc) !== null : null;
  return {
    host: r.host, port: r.port, security: r.security, username: r.username || '', from: r.from_addr, replyTo: r.reply_to || '',
    passwordSet: !!r.password_enc, passwordReadable: decryptable,
    enabled: !!r.enabled, verifiedAt: r.verified_at, updatedAt: r.updated_at,
  };
}

export async function loadSettingsRow(db) {
  return (await db.query('SELECT * FROM mail_settings WHERE id = 1')).rows[0] || null;
}

/** Liest die Zeile und gibt sie an mail.js weiter. Fehler: nur Umgebung. */
export async function applyStoredSettings(db, log = console.log) {
  try {
    const r = await loadSettingsRow(db);
    const cfg = rowToCfg(r);
    if (r?.enabled && !cfg) log('mail: gespeicherte SMTP-Einstellungen lassen sich nicht entschlüsseln (MAIL_SETTINGS_KEY bzw. JWT_SECRET geändert?) — es gilt die Umgebung.');
    configureMail(cfg);
    return r;
  } catch (err) {
    log(`mail: SMTP-Einstellungen nicht gelesen (${err?.message || err})`);
    return null;
  }
}

/** Konfiguration aus einer Eingabe plus gespeichertem Passwort (zum Prüfen). */
export function candidateCfg(value, row) {
  const pass = value.password !== undefined ? value.password : (row?.password_enc ? decryptSecret(row.password_enc) : '');
  return { host: value.host, port: value.port, security: value.security, user: value.username, pass: pass ?? '', from: value.from, replyTo: value.replyTo };
}

/** Speichert. `enabled` nur, wenn der Aufrufer geprüft hat. */
export async function saveSettings(db, value, { enabled, verified, adminId }) {
  const row = await loadSettingsRow(db);
  let enc = row?.password_enc ?? null;
  if (value.password !== undefined) enc = value.password === '' ? null : encryptSecret(value.password);
  await db.query(
    `INSERT INTO mail_settings (id, host, port, security, username, password_enc, from_addr, reply_to, enabled, verified_at, updated_at, updated_by)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $9 THEN now() ELSE NULL END, now(), $10)
     ON CONFLICT (id) DO UPDATE SET host = EXCLUDED.host, port = EXCLUDED.port, security = EXCLUDED.security,
       username = EXCLUDED.username, password_enc = EXCLUDED.password_enc, from_addr = EXCLUDED.from_addr,
       reply_to = EXCLUDED.reply_to, enabled = EXCLUDED.enabled,
       verified_at = CASE WHEN $9 THEN now() ELSE mail_settings.verified_at END,
       updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [value.host, value.port, value.security, value.username || null, enc, value.from, value.replyTo || null, !!enabled, !!verified, adminId ?? null],
  );
  return applyStoredSettings(db);
}

export async function setEnabled(db, enabled, adminId) {
  await db.query('UPDATE mail_settings SET enabled = $1, updated_at = now(), updated_by = $2 WHERE id = 1', [!!enabled, adminId ?? null]);
  return applyStoredSettings(db);
}

export async function deleteSettings(db) {
  await db.query('DELETE FROM mail_settings WHERE id = 1');
  configureMail(null);
}
