// Transactional email for cv-api (CV-Hub).
// SMTP config comes from env (set as Coolify secrets — never committed):
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
//   SMTP_FROM   (e.g. 'CV-Hub <no-reply@example.com>')
//   APP_BASE_URL (e.g. 'https://cv.example.com')
// If SMTP is not configured the module degrades gracefully: send() logs and
// resolves false instead of throwing, so auth flows never break in dev/demo.

import nodemailer from 'nodemailer';

const HOST = process.env.SMTP_HOST || '';
const PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const USER = process.env.SMTP_USER || '';
const PASS = process.env.SMTP_PASS || '';
const APP_NAME = process.env.APP_NAME || 'CV-Hub';
const FROM = process.env.SMTP_FROM || (USER ? `${APP_NAME} <${USER}>` : '');
export const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://cv.example.com').replace(/\/$/, '');

export const mailConfigured = Boolean(HOST && USER && PASS);

let transporter = null;
function getTransport() {
  if (!mailConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465,          // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: USER, pass: PASS },
    });
  }
  return transporter;
}

/** Send an email. Never throws — returns true on success, false otherwise. */
export async function sendMail({ to, subject, html, text }) {
  const tx = getTransport();
  if (!tx) {
    console.warn(`mail: SMTP not configured — skipped "${subject}" to ${to}`);
    return false;
  }
  try {
    await tx.sendMail({ from: FROM, to, subject, html, text: text || stripHtml(html) });
    return true;
  } catch (err) {
    console.error('mail: send failed:', err?.message || err);
    return false;
  }
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, '').replace(/\s+\n/g, '\n').trim();
}

// Escaped nutzergesteuerte Werte, bevor sie in E-Mail-HTML interpoliert werden
// (z. B. die freie Invite-Notiz). Verhindert Markup-/Link-Injektion in Mails.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Brand-konforme Vorlage ───────────────────────────────────────────────────
// Schlicht, hell, Indigo-Akzent — passend zur neuen Marke. Inline-CSS
// (E-Mail-Clients unterstützen kein <style>-Sheet zuverlässig).
const INK = '#1b1c22', SOFT = '#5c5e6b', ACCENT = '#3d3df0', LINE = '#e6e7ec', PAPER = '#f8f9fb';

function layout(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:${PAPER};padding:32px 0;font-family:Inter,Segoe UI,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:#fff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE};">
        <span style="font-weight:700;font-size:18px;letter-spacing:-0.02em;color:${INK};">${APP_NAME}</span>
      </td></tr>
      <tr><td style="padding:28px;">${bodyHtml}</td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};color:#9aa;font-size:11px;">
        CV-Hub · <a href="${APP_BASE_URL}" style="color:${SOFT};text-decoration:none;">cv.example.com</a><br/>
        Diese Nachricht wurde automatisch versendet.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}
function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:9px;">${label}</a>`;
}
function h(t) { return `<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0 0 12px;">${t}</div>`; }
function p(t) { return `<p style="font-size:14px;line-height:1.6;color:${SOFT};margin:0 0 16px;">${t}</p>`; }

// ── Vorlagen ─────────────────────────────────────────────────────────────────

export function tplInvite({ code, note }) {
  const url = `${APP_BASE_URL}/?invite=${encodeURIComponent(code)}`;
  return {
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
  };
}

export function tplWelcome({ username }) {
  return {
    subject: 'Willkommen bei CV-Hub',
    html: layout(
      h('Willkommen, ' + username + '.') +
      p('Dein Konto ist aktiv. Du kannst jetzt Lebensläufe und Anschreiben in vier Sprachen erstellen, als PDF exportieren, Sharelinks anlegen und die Markdown-Brücke fürs KI-Lektorat nutzen.') +
      `<div style="margin:4px 0 8px;">${btn(APP_BASE_URL, 'Zum Editor →')}</div>`,
    ),
  };
}

export function tplPasswordReset({ token }) {
  const url = `${APP_BASE_URL}/reset/${token}`;
  return {
    subject: 'Passwort zurücksetzen — CV-Hub',
    html: layout(
      h('Passwort zurücksetzen') +
      p('Es wurde angefragt, dein Passwort zurückzusetzen. Der Link ist 60 Minuten gültig und nur einmal verwendbar.') +
      `<div style="margin:4px 0 8px;">${btn(url, 'Neues Passwort setzen →')}</div>` +
      p('Warst du das nicht, ignoriere diese E-Mail — dein Passwort bleibt unverändert.'),
    ),
  };
}

export function tplPasswordChanged({ username }) {
  return {
    subject: 'Dein Passwort wurde geändert — CV-Hub',
    html: layout(
      h('Passwort geändert') +
      p(`Das Passwort für dein Konto <strong>${username}</strong> wurde soeben geändert. Warst du das nicht, melde dich umgehend.`),
    ),
  };
}

export function tplLoginCode({ code }) {
  return {
    subject: `${code} — dein Login-Code für CV-Hub`,
    html: layout(
      h('Dein Login-Code') +
      p('Gib diesen Code im Anmeldefenster ein, um dich anzumelden. Er ist 10 Minuten gültig.') +
      `<div style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:0.24em;background:${PAPER};border:1px solid ${LINE};border-radius:9px;padding:18px;text-align:center;margin:0 0 20px;">${code}</div>` +
      p('Hast du dich nicht gerade angemeldet, ignoriere diese E-Mail und ändere sicherheitshalber dein Passwort.'),
    ),
  };
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
  return {
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
  };
}

export function tplOffboarding({ username, deleted }) {
  return {
    subject: deleted ? 'Dein Konto wurde gelöscht — CV-Hub' : 'Dein Konto wurde deaktiviert — CV-Hub',
    html: layout(
      h(deleted ? 'Konto gelöscht' : 'Konto deaktiviert') +
      p(deleted
        ? `Dein Konto <strong>${username}</strong> und alle zugehörigen Daten wurden gelöscht. Danke, dass du CV-Hub genutzt hast.`
        : `Dein Konto <strong>${username}</strong> wurde deaktiviert. Melde dich bei uns, falls das ein Versehen war.`),
    ),
  };
}
