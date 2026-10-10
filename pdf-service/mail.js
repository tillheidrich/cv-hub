// Transactional email for cv-api (CV-Hub).
// SMTP config comes from env (set as Coolify secrets — never committed):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
//   SMTP_FROM   (e.g. 'CV-Hub <no-reply@example.com>'), SMTP_REPLY_TO
//   APP_BASE_URL (e.g. 'https://cv.example.com')
// … or from the admin area (mailsettings.js, MAILS.md); saved settings take
// precedence over the environment, SMTP_FORCE_ENV=1 switches them off.
// If SMTP is not configured the module degrades gracefully: send() logs and
// resolves false instead of throwing, so auth flows never break in dev/demo.

import nodemailer from 'nodemailer';
import { appendFileSync } from 'node:fs';

const HOST = (process.env.SMTP_HOST || '').trim();
const PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const APP_NAME = process.env.APP_NAME || 'CV-Hub';
const FROM = process.env.SMTP_FROM || (USER ? `${APP_NAME} <${USER}>` : '');
const REPLY_TO = (process.env.SMTP_REPLY_TO || '').trim();
/* E-Mail-Workflows: Die SMTP-Einstellungen lassen sich im Admin-Bereich
 * pflegen (mailsettings.js, verschlüsselt in der Datenbank). Gespeicherte und
 * aktivierte Einstellungen gehen der Umgebung vor; mit SMTP_FORCE_ENV=1 gilt
 * nur die Umgebung (Notschalter, falls die gespeicherten Werte kaputt sind
 * und der Admin-Code nicht mehr ankommt). */
const FORCE_ENV = /^(1|true|yes|on)$/i.test(String(process.env.SMTP_FORCE_ENV || '').trim());
/* PUBLIC_BASE_URL zuerst, wie überall sonst im Dienst; bei einem
 * Domainwechsel reicht es, PUBLIC_BASE_URL zu ändern. */
export const APP_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://cv.example.com').trim().replace(/\/+$/, '');
/** Host für den Mail-Fuß, aus derselben Adresse. */
const APP_HOST = (() => { try { return new URL(APP_BASE_URL).host; } catch { return 'cv.example.com'; } })();

/* Zähler und Versandprotokoll für das Admin-Dashboard. Wer zählen will,
 * meldet sich hier an; mail.js selbst kennt keine Datenbank. Übergeben wird,
 * ob es geklappt hat, und als zweites Argument { tag, to, error,
 * notConfigured } — den Betreff nie (er kann Namen enthalten). */
const mailHooks = new Set();
export function onMailResult(fn) { mailHooks.add(fn); return () => mailHooks.delete(fn); }
function reportMail(ok, meta) { for (const fn of mailHooks) { try { fn(ok, meta); } catch { /* egal */ } } }

/* Nur für Tests (billing.test.mjs): statt SMTP jede Mail als JSON-Zeile in
 * diese Datei schreiben, Anhänge als Base64. In der Produktion ignoriert —
 * dort darf keine Kundenmail auf der Platte landen. */
const CAPTURE = process.env.NODE_ENV !== 'production' ? (process.env.MAIL_CAPTURE_FILE || '').trim() : '';

const ENV_CFG = HOST && USER && PASS
  ? { source: 'env', host: HOST, port: PORT, security: PORT === 465 ? 'tls' : 'auto', user: USER, pass: PASS, from: FROM, replyTo: REPLY_TO }
  : null;
/** Aus der Datenbank (mailsettings.js), sonst null. */
let dbCfg = null;

/** Wirksame Einstellungen: Datenbank vor Umgebung, außer SMTP_FORCE_ENV. */
function activeCfg() {
  if (!FORCE_ENV && dbCfg) return dbCfg;
  return ENV_CFG;
}

/* Live-Bindung: server.js liest `mailConfigured` direkt und sieht damit
 * jede Änderung aus dem Admin-Bereich. Wer den Wert weiterreicht, nimmt
 * isMailConfigured(). */
export let mailConfigured = Boolean(activeCfg()) || Boolean(CAPTURE);
export function isMailConfigured() { return mailConfigured; }

let transporter = null;
let envTransporter = null;

/** nodemailer-Optionen. security: tls (465, sofort verschlüsselt), starttls
 *  (Pflicht), none (unverschlüsselt, nur interne Relays), auto (bisheriges
 *  Verhalten der Umgebung: STARTTLS, wenn der Server es anbietet). */
export function transportOptions(c) {
  const base = {
    host: c.host, port: c.port,
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 30_000,
    ...(c.user ? { auth: { user: c.user, pass: c.pass || '' } } : {}),
  };
  if (c.security === 'tls') return { ...base, secure: true };
  if (c.security === 'starttls') return { ...base, secure: false, requireTLS: true };
  if (c.security === 'none') return { ...base, secure: false, ignoreTLS: true };
  return { ...base, secure: c.port === 465 };
}

function getTransport() {
  const c = activeCfg();
  if (!c) return null;
  if (!transporter) transporter = nodemailer.createTransport(transportOptions(c));
  return transporter;
}
function getEnvTransport() {
  if (!ENV_CFG) return null;
  if (!envTransporter) envTransporter = nodemailer.createTransport(transportOptions(ENV_CFG));
  return envTransporter;
}

/** Übernimmt Einstellungen aus der Datenbank (oder null = nur Umgebung). */
export function configureMail(cfg) {
  dbCfg = cfg && cfg.host ? { source: 'db', ...cfg } : null;
  try { transporter?.close?.(); } catch { /* egal */ }
  transporter = null;
  mailConfigured = Boolean(activeCfg()) || Boolean(CAPTURE);
}

function maskUser(u) {
  const s = String(u || '');
  if (!s) return null;
  const [a, d] = s.split('@');
  return d ? `${a.slice(0, 2)}…@${d}` : `${s.slice(0, 2)}…`;
}

/** Stand für den Admin-Bereich. Nie ein Passwort, Benutzer gekürzt. */
export function smtpStatus() {
  const c = activeCfg();
  return {
    configured: mailConfigured,
    capture: Boolean(CAPTURE),
    source: c ? c.source : (CAPTURE ? 'capture' : null),
    host: c?.host || null,
    port: c?.port || null,
    security: c?.security || null,
    user: c ? maskUser(c.user) : null,
    from: c?.from || null,
    replyTo: c?.replyTo || null,
    envConfigured: Boolean(ENV_CFG),
    envHost: ENV_CFG?.host || null,
    dbActive: Boolean(dbCfg),
    forceEnv: FORCE_ENV,
  };
}

/** Verbindung und Anmeldung prüfen, ohne etwas zu senden. Wirft nicht. */
export async function verifySmtp(c) {
  try {
    const tx = nodemailer.createTransport(transportOptions(c));
    await tx.verify();
    try { tx.close(); } catch { /* egal */ }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: smtpError(err) };
  }
}

/** Fehlertext ohne Zugangsdaten, gekürzt. */
function smtpError(err) {
  const msg = String(err?.response || err?.message || err || 'Fehler').replace(/\s+/g, ' ');
  return `${err?.code ? `${err.code}: ` : ''}${msg}`.replace(/(pass(word)?|auth)\s*[=:]\s*\S+/gi, '$1=…').slice(0, 300);
}

/** Send an email. Never throws — returns true on success, false otherwise.
 *  attachments: [{ filename, content: Buffer|string, contentType }] (nodemailer).
 *  headers: zusätzliche Kopfzeilen (List-Unsubscribe). tag: Name für das
 *  Versandprotokoll. fallbackEnv: scheitert der Versand über die gespeicherten
 *  Einstellungen, noch einmal über die Umgebung (Admin-Code). */
export async function sendMail(args) {
  return (await sendMailDetailed(args)).ok;
}

/** Wie sendMail, aber mit Grund: { ok, error?, notConfigured? }. */
export async function sendMailDetailed(args) {
  const r = await sendMailInner(args);
  reportMail(r.ok, { tag: args?.tag || null, to: args?.to || null, error: r.error || null, notConfigured: !!r.notConfigured, queueId: args?.queueId ?? null });
  return r;
}

async function sendMailInner({ to, subject, html, text, attachments, headers, replyTo, fallbackEnv }) {
  const c = activeCfg();
  if (CAPTURE) {
    try {
      appendFileSync(CAPTURE, JSON.stringify({
        to, subject, html, text: text || stripHtml(html),
        headers: headers || {},
        replyTo: replyTo || c?.replyTo || null,
        attachments: (attachments || []).map(a => ({
          filename: a.filename, contentType: a.contentType,
          contentBase64: Buffer.from(a.content).toString('base64'),
        })),
        at: new Date().toISOString(),
      }) + '\n');
      return { ok: true };
    } catch (err) {
      console.error('mail: capture failed:', err?.message || err);
      return { ok: false, error: 'capture failed' };
    }
  }
  const tx = getTransport();
  if (!tx) {
    // Ohne Empfängeradresse im Protokoll: das Log ist kein Adressbuch.
    console.warn(`mail: SMTP not configured — skipped "${subject}"`);
    return { ok: false, notConfigured: true, error: 'SMTP nicht eingerichtet' };
  }
  const msg = {
    from: c.from || (c.user ? `${APP_NAME} <${c.user}>` : undefined), to, subject, html, text: text || stripHtml(html),
    ...(replyTo || c.replyTo ? { replyTo: replyTo || c.replyTo } : {}),
    ...(headers && Object.keys(headers).length ? { headers } : {}),
    ...(attachments?.length ? { attachments } : {}),
  };
  try {
    await tx.sendMail(msg);
    return { ok: true };
  } catch (err) {
    const error = smtpError(err);
    console.error('mail: send failed:', error);
    if (fallbackEnv && c.source === 'db' && getEnvTransport()) {
      try {
        await getEnvTransport().sendMail({ ...msg, from: ENV_CFG.from || msg.from });
        console.warn('mail: über die Umgebung zugestellt (gespeicherte SMTP-Einstellungen scheitern)');
        return { ok: true };
      } catch (err2) {
        return { ok: false, error: `${error} · Umgebung: ${smtpError(err2)}` };
      }
    }
    return { ok: false, error };
  }
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim();
}

// Escaped nutzergesteuerte Werte, bevor sie in E-Mail-HTML interpoliert werden
// (z. B. die freie Invite-Notiz). Verhindert Markup-/Link-Injektion in Mails.
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Brand-konforme Vorlage ───────────────────────────────────────────────────
// Schlicht, hell, Indigo-Akzent — passend zur neuen Marke. Inline-CSS
// (E-Mail-Clients unterstützen kein <style>-Sheet zuverlässig).
const INK = '#1b1c22', SOFT = '#5c5e6b', ACCENT = '#3d3df0', LINE = '#e6e7ec', PAPER = '#f8f9fb';

export const MAIL_COLORS = { INK, SOFT, ACCENT, LINE, PAPER };

export function layout(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:${PAPER};padding:32px 0;font-family:Inter,Segoe UI,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:#fff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE};">
        <span style="font-weight:700;font-size:18px;letter-spacing:-0.02em;color:${INK};">${APP_NAME}</span>
      </td></tr>
      <tr><td style="padding:28px;">${bodyHtml}</td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};color:#9aa;font-size:11px;">
        ${APP_NAME} · <a href="${APP_BASE_URL}" style="color:${SOFT};text-decoration:none;">${APP_HOST}</a><br/>
        Diese Nachricht wurde automatisch versendet.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
export function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:9px;">${label}</a>`;
}
export function h(t) { return `<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 12px;">${t}</div>`; }
export function p(t) { return `<p style="font-size:14px;line-height:1.6;color:${SOFT};margin:0 0 16px;">${t}</p>`; }

/** Hängt den Namen für das Versandprotokoll an (sendMail liest `tag`). */
export function withTag(tag, m) { return m && typeof m === 'object' ? { ...m, tag } : m; }

// ── Vorlagen ─────────────────────────────────────────────────────────────────

export function tplInvite({ code, note }) {
  const url = `${APP_BASE_URL}/?invite=${encodeURIComponent(code)}`;
  return withTag('invite', {
    subject: 'Deine Einladung zu CV-Hub',
    html: layout(
      h('Du bist eingeladen.') +
      p('Du wurdest eingeladen, CV-Hub zu nutzen — die selbst gehostete Werkstatt für Lebenslauf und Anschreiben.') +
      (note ? p(`Notiz: <em>${escapeHtml(note)}</em>`) : '') +
      p(`Dein Einladungscode:`) +
      `<div style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:0.12em;background:${PAPER};border:1px solid ${LINE};border-radius:9px;padding:14px;text-align:center;margin:0 0 20px;">${code}</div>` +
      `<div style="margin:4px 0 8px;">${btn(url, 'Konto anlegen →')}</div>` +
      p('Ohne diesen Code ist keine Registrierung möglich. Der Link trägt den Code bereits ein.'),
    ),
  });
}

/* tplWelcome (Willkommen nach Registrierung mit Einladung) ist am 10.10.2026
 * im Workflow „welcome“ aufgegangen (mailflows.js, vier Sprachen, Warteschlange). */

/* Die Basis kommt vom Aufrufer (publicBaseUrl der Anfrage bzw. PUBLIC_BASE_URL),
 * nicht aus einem festen Wert in dieser Datei. Vorher fiel der Link ohne
 * Konfiguration auf eine fest eingetragene Domain zurück — eine selbst gehostete Kopie
 * verschickte damit Reset-Links auf einen fremden Server. Ohne Basis schickt
 * server.js gar keine Mail. */
export function tplPasswordReset({ token, base }) {
  if (!base) throw new Error('tplPasswordReset: base fehlt');
  const url = `${String(base).replace(/\/+$/, '')}/reset/${encodeURIComponent(token)}`;
  return withTag('password_reset', {
    subject: 'Passwort zurücksetzen — CV-Hub',
    html: layout(
      h('Passwort zurücksetzen') +
      p('Es wurde angefragt, dein Passwort zurückzusetzen. Der Link ist 60 Minuten gültig und nur einmal verwendbar.') +
      `<div style="margin:4px 0 8px;">${btn(url, 'Neues Passwort setzen →')}</div>` +
      p('Warst du das nicht, ignoriere diese E-Mail — dein Passwort bleibt unverändert.'),
    ),
  });
}

export function tplPasswordChanged({ username }) {
  return withTag('password_changed', {
    subject: 'Dein Passwort wurde geändert — CV-Hub',
    html: layout(
      h('Passwort geändert') +
      p(`Das Passwort für dein Konto <strong>${escapeHtml(username)}</strong> wurde soeben geändert. Warst du das nicht, melde dich umgehend.`) +
      p('Aus Sicherheitsgründen wurden dabei alle anderen Anmeldungen beendet und alle API-Schlüssel und KI-Verbindungen getrennt. Verbinde deinen KI-Client bei Bedarf neu.'),
    ),
  });
}

/* Der Admin hat das Passwort gesetzt. Vorher geschah das ohne jede Nachricht
 * an den Betroffenen — er merkte es erst, wenn er nicht mehr hineinkam. */
export function tplPasswordResetByAdmin({ username }) {
  return withTag('password_reset_admin', {
    subject: 'Dein Passwort wurde vom Administrator zurückgesetzt — CV-Hub',
    html: layout(
      h('Passwort zurückgesetzt') +
      p(`Ein Administrator hat das Passwort für dein Konto <strong>${escapeHtml(username)}</strong> neu gesetzt. Das neue Passwort erhältst du von ihm direkt, nicht per E-Mail.`) +
      p('Alle Anmeldungen wurden beendet und alle API-Schlüssel und KI-Verbindungen getrennt. Ändere das Passwort nach der nächsten Anmeldung. Hast du das nicht veranlasst, melde dich umgehend.'),
    ),
  });
}

/* Geht an die ALTE Adresse, wenn die E-Mail des Kontos geändert wurde. */
export function tplEmailChanged({ username, newEmail }) {
  return withTag('email_changed', {
    subject: 'Die E-Mail-Adresse deines Kontos wurde geändert — CV-Hub',
    html: layout(
      h('E-Mail-Adresse geändert') +
      p(newEmail
        ? `Für dein Konto <strong>${escapeHtml(username)}</strong> ist jetzt die Adresse <strong>${escapeHtml(newEmail)}</strong> hinterlegt. Nachrichten und Passwort-Links gehen ab sofort dorthin.`
        : `Für dein Konto <strong>${escapeHtml(username)}</strong> ist keine E-Mail-Adresse mehr hinterlegt. Die Zwei-Faktor-Anmeldung wurde damit abgeschaltet.`) +
      p('Warst du das nicht, melde dich umgehend.'),
    ),
  });
}

export function tplLoginCode({ code }) {
  return withTag('login_code', {
    /* Der Code steht nicht mehr im Betreff. Betreffzeilen erscheinen in
     * Sperrbildschirm-Benachrichtigungen, Postfachlisten und Logs von
     * Mailservern — der Code gehört nur in den Text. */
    subject: 'Dein Login-Code für CV-Hub',
    html: layout(
      h('Dein Login-Code') +
      p('Gib diesen Code im Anmeldefenster ein, um dich anzumelden. Er ist 10 Minuten gültig.') +
      `<div style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:0.24em;background:${PAPER};border:1px solid ${LINE};border-radius:9px;padding:18px;text-align:center;margin:0 0 20px;">${code}</div>` +
      p('Hast du dich nicht gerade angemeldet, ignoriere diese E-Mail und ändere sicherheitshalber dein Passwort.'),
    ),
  });
}

// Benachrichtigung an den Admin bei einer neuen Zugangsanfrage. Enthält zwei
// signierte Ein-Klick-Links (Annehmen / Ablehnen), sodass ohne Login und ohne
// Admin-Panel entschieden werden kann. Die Links tragen die Autorisierung im
// signierten Token — deshalb hier nur einsetzen, nicht selbst bauen.
export function tplAccessRequest({ name, email, message, acceptUrl, rejectUrl }) {
  const btnGhost = (href, label) =>
    `<a href="${href}" style="display:inline-block;background:#fff;color:${INK};text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border:1px solid ${LINE};border-radius:9px;">${label}</a>`;
  const row = (label, value) =>
    `<tr><td style="padding:6px 0;font-size:12px;color:${SOFT};width:92px;vertical-align:top;">${escapeHtml(label)}</td>` +
    `<td style="padding:6px 0;font-size:14px;color:${INK};">${value}</td></tr>`;
  return withTag('access_request', {
    subject: `Zugangsanfrage: ${name} <${email}>`,
    html: layout(
      h('Neue Zugangsanfrage') +
      p('Jemand möchte Zugang. Du kannst direkt hier entscheiden — kein Login nötig.') +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${PAPER};border:1px solid ${LINE};border-radius:9px;padding:8px 16px;margin:0 0 20px;">` +
      row('Name', escapeHtml(name)) +
      row('E-Mail', `<a href="mailto:${escapeHtml(email)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(email)}</a>`) +
      (message ? row('Nachricht', escapeHtml(message).replace(/\n/g, '<br/>')) : '') +
      `</table>` +
      (acceptUrl && rejectUrl
        ? `<div style="margin:4px 0 8px;">${btn(acceptUrl, 'Annehmen →')} &nbsp; ${btnGhost(rejectUrl, 'Ablehnen')}</div>`
          + p('Beide Knöpfe öffnen erst eine Nachfrage — der Link allein löst nichts aus. Bei „Annehmen" wird ein einmaliger, an diese E-Mail gebundener Einladungscode erzeugt und dem Anfragenden zugeschickt. „Ablehnen" verwirft die Anfrage stillschweigend.')
        : p('Diese Nachricht enthält keine Aktionsknöpfe, weil keine Basis-URL konfiguriert ist (PUBLIC_BASE_URL oder APP_BASE_URL). Entscheide die Anfrage im Admin-Panel.')),
    ),
  });
}

/* retainedOrders: Zahl der bezahlten Bestellungen, die wegen der
 * Aufbewahrungspflicht stehen bleiben. Ohne diesen Satz wäre „alle Daten
 * gelöscht“ nicht wahr. */
export function tplOffboarding({ username, deleted, retainedOrders = 0 }) {
  return withTag('offboarding', {
    subject: deleted ? 'Dein Konto wurde gelöscht — CV-Hub' : 'Dein Konto wurde deaktiviert — CV-Hub',
    html: layout(
      h(deleted ? 'Konto gelöscht' : 'Konto deaktiviert') +
      p(deleted
        ? (retainedOrders > 0
          ? `Dein Konto <strong>${escapeHtml(username)}</strong> und alle Inhalte (Lebensläufe, Fotos, Links, Schlüssel) wurden gelöscht. Deine ${retainedOrders === 1 ? 'Bestellung und die Rechnung dazu' : 'Bestellungen und die Rechnungen dazu'} bewahren wir mit Name, E-Mail-Adresse, Land, Betrag, Datum und Rechnungsnummer zehn Jahre auf, weil das Steuerrecht es verlangt (§ 147 AO, § 14b UStG). Danach werden sie gelöscht. Ein Widerruf innerhalb der Frist geht weiterhin über das Widerrufsformular auf der Website.`
          : `Dein Konto <strong>${escapeHtml(username)}</strong> und alle zugehörigen Daten wurden gelöscht. Danke, dass du CV-Hub genutzt hast.`)
        : `Dein Konto <strong>${escapeHtml(username)}</strong> wurde deaktiviert. Melde dich bei uns, falls das ein Versehen war.`),
    ),
  });
}

/* Hinweis vor Ablauf der Laufzeit (Pilot, 08.10.2026). Geht 14 und 3 Tage
 * vorher hinaus (access.js). Zweisprachig in einer Mail: Das Konto kennt
 * keine Sprache, und eine falsch geratene ist schlechter als zwei. */
export function tplAccessEnding({ username, until, daysLeft, base }) {
  const d = new Date(until);
  const de = (() => { try { return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }); } catch { return d.toISOString().slice(0, 10); } })();
  const en = (() => { try { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }); } catch { return d.toISOString().slice(0, 10); } })();
  const n = Math.max(1, Math.round(Number(daysLeft) || 1));
  const link = base ? String(base).replace(/\/+$/, '') : null;
  const sep = `<div style="border-top:1px solid ${LINE};margin:22px 0 18px;"></div>`;
  return withTag('access_ending', {
    subject: `Dein Zugang zu CV-Hub endet am ${de} · Your access ends on ${en}`,
    html: layout(
      h(`Noch ${n === 1 ? 'ein Tag' : `${n} Tage`}`) +
      p(`Hallo ${escapeHtml(username)}, dein Zugang endet am <strong>${de}</strong>. Danach kannst du deine Lebensläufe weiter öffnen und exportieren, aber nicht mehr ändern. Gelöscht wird nichts, ohne dass du vorher davon erfährst.`) +
      p('Wenn du deine Unterlagen unabhängig von diesem Werkzeug behalten willst, lade sie jetzt herunter, im Export-Bereich des Editors:') +
      `<ul style="font-size:14px;line-height:1.6;color:${SOFT};margin:0 0 16px;padding-left:20px;">` +
      '<li><strong>DOCX</strong>: zum Weiterbearbeiten in Word oder LibreOffice</li>' +
      '<li><strong>JSON</strong>: alle Inhalte maschinenlesbar, wieder importierbar; in den Kontoeinstellungen gibt es zusätzlich den vollständigen Datenexport</li>' +
      '<li><strong>ZIP „Vorlage ohne Daten“</strong>: das Layout als Datei, ohne deine Angaben</li>' +
      '<li><strong>PDF</strong>: die fertige Fassung zum Versenden</li>' +
      '</ul>' +
      p('Brauchst du länger, wende dich an die Person, von der du den Zugang hast.') +
      (link ? `<div style="margin:4px 0 8px;">${btn(link, 'Zum Editor →')}</div>` : '') +
      sep +
      h(`${n === 1 ? 'One day' : `${n} days`} left`) +
      p(`Hi ${escapeHtml(username)}, your access ends on <strong>${en}</strong>. After that you can still open and export your résumés, but no longer edit them. Nothing is deleted without telling you first.`) +
      p('To keep your documents independent of this tool, download them now (in the editor’s export panel): <strong>DOCX</strong> to keep editing in Word or LibreOffice, <strong>JSON</strong> with all content (re-importable; the full data export is in your account settings), the <strong>ZIP</strong> “template without data”, and the finished <strong>PDF</strong>.') +
      p('If you need more time, contact the person who gave you access.'),
    ),
  });
}
