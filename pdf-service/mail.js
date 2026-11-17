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

/* Sprache der Konto- und Sicherheitsmails (17.11.2026): de, en, fr, es wie
 * die Oberfläche. Deutsch, Englisch und Spanisch duzen bzw. sprechen neutral
 * an, Französisch siezt (wie mailflows.js und die App). Die Sprache kommt
 * vom Aufrufer: Konto (users.mail_lang), sonst die Anfrage, sonst Deutsch. */
export const MAIL_LANGS = ['de', 'en', 'fr', 'es'];
/** Unbekanntes oder leeres → null (der Aufrufer entscheidet den Rückfall). */
export function knownLang(v) {
  const s = String(v ?? '').trim().slice(0, 2).toLowerCase();
  return MAIL_LANGS.includes(s) ? s : null;
}
const langOr = (v, fallback = 'de') => knownLang(v) || fallback;
const LOCALE = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };
/** Datum in der Mail-Sprache (Deutsch 01.02.2026, sonst „1 February 2026“). */
export function mailDate(lang, d) {
  const L = langOr(lang);
  try {
    const opts = L === 'de'
      ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' };
    return new Date(d).toLocaleDateString(LOCALE[L], opts);
  } catch { return new Date(d).toISOString().slice(0, 10); }
}

const FOOT = {
  de: 'Diese Nachricht wurde automatisch versendet.',
  en: 'This message was sent automatically.',
  fr: 'Ce message a été envoyé automatiquement.',
  es: 'Este mensaje se ha enviado automáticamente.',
};

export function layout(bodyHtml, lang = 'de') {
  const L = langOr(lang);
  return `<!doctype html><html lang="${L}"><body style="margin:0;background:${PAPER};padding:32px 0;font-family:Inter,Segoe UI,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:#fff;border:1px solid ${LINE};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:22px 28px;border-bottom:1px solid ${LINE};">
        <span style="font-weight:700;font-size:18px;letter-spacing:-0.02em;color:${INK};">${APP_NAME}</span>
      </td></tr>
      <tr><td style="padding:28px;">${bodyHtml}</td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid ${LINE};color:#9aa;font-size:11px;">
        ${APP_NAME} · <a href="${APP_BASE_URL}" style="color:${SOFT};text-decoration:none;">${APP_HOST}</a><br/>
        ${FOOT[L]}
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
//
// Jede Vorlage nimmt `lang` (de, en, fr, es; Unbekanntes wird Deutsch). Die
// Texte stehen je Vorlage in einer kleinen Tabelle; Platzhalter sind
// Funktionen, alles Nutzergesteuerte geht durch escapeHtml.

const CODE_BOX = (code, size, spacing, pad) =>
  `<div style="font-family:monospace;font-size:${size}px;font-weight:700;letter-spacing:${spacing};background:${PAPER};border:1px solid ${LINE};border-radius:9px;padding:${pad}px;text-align:center;margin:0 0 20px;">${code}</div>`;

const INVITE = {
  de: { subject: 'Deine Einladung zu CV-Hub', h: 'Du bist eingeladen.', intro: 'Du wurdest eingeladen, CV-Hub zu nutzen — die selbst gehostete Werkstatt für Lebenslauf und Anschreiben.', note: n => `Notiz: <em>${n}</em>`, code: 'Dein Einladungscode:', btn: 'Konto anlegen →', outro: 'Ohne diesen Code ist keine Registrierung möglich. Der Link trägt den Code bereits ein.' },
  en: { subject: 'Your invitation to CV-Hub', h: 'You’re invited.', intro: 'You’ve been invited to use CV-Hub, the self-hosted workshop for CVs and cover letters.', note: n => `Note: <em>${n}</em>`, code: 'Your invitation code:', btn: 'Create account →', outro: 'You can only register with this code. The link fills it in for you.' },
  fr: { subject: 'Votre invitation à CV-Hub', h: 'Une invitation pour vous.', intro: 'On vous invite à utiliser CV-Hub, l’atelier auto-hébergé pour vos CV et lettres de motivation.', note: n => `Note : <em>${n}</em>`, code: 'Votre code d’invitation :', btn: 'Créer un compte →', outro: 'L’inscription n’est possible qu’avec ce code. Le lien le renseigne déjà.' },
  es: { subject: 'Tu invitación a CV-Hub', h: 'Tienes una invitación.', intro: 'Te han invitado a usar CV-Hub, el taller autoalojado para currículums y cartas de presentación.', note: n => `Nota: <em>${n}</em>`, code: 'Tu código de invitación:', btn: 'Crear cuenta →', outro: 'Sin este código no es posible registrarse. El enlace ya lo incluye.' },
};
export function tplInvite({ code, note, lang = 'de' }) {
  const L = langOr(lang);
  const t = INVITE[L];
  const url = `${APP_BASE_URL}/?invite=${encodeURIComponent(code)}`;
  return withTag('invite', {
    subject: t.subject,
    html: layout(
      h(t.h) +
      p(t.intro) +
      (note ? p(t.note(escapeHtml(note))) : '') +
      p(t.code) +
      CODE_BOX(code, 20, '0.12em', 14) +
      `<div style="margin:4px 0 8px;">${btn(url, t.btn)}</div>` +
      p(t.outro),
      L,
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
const RESET = {
  de: { subject: 'Passwort zurücksetzen — CV-Hub', h: 'Passwort zurücksetzen', intro: 'Es wurde angefragt, dein Passwort zurückzusetzen. Der Link ist 60 Minuten gültig und nur einmal verwendbar.', btn: 'Neues Passwort setzen →', outro: 'Warst du das nicht, ignoriere diese E-Mail — dein Passwort bleibt unverändert.' },
  en: { subject: 'Reset your password — CV-Hub', h: 'Reset your password', intro: 'Someone asked to reset your password. The link is valid for 60 minutes and works only once.', btn: 'Set a new password →', outro: 'If this wasn’t you, ignore this email. Your password stays as it is.' },
  fr: { subject: 'Réinitialiser votre mot de passe — CV-Hub', h: 'Réinitialiser le mot de passe', intro: 'Une réinitialisation de votre mot de passe a été demandée. Le lien est valable 60 minutes et ne sert qu’une fois.', btn: 'Choisir un nouveau mot de passe →', outro: 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.' },
  es: { subject: 'Restablecer la contraseña — CV-Hub', h: 'Restablecer la contraseña', intro: 'Se ha solicitado restablecer tu contraseña. El enlace es válido durante 60 minutos y solo se puede usar una vez.', btn: 'Elegir una contraseña nueva →', outro: 'Si no has sido tú, ignora este correo: tu contraseña no cambia.' },
};
export function tplPasswordReset({ token, base, lang = 'de' }) {
  if (!base) throw new Error('tplPasswordReset: base fehlt');
  const L = langOr(lang);
  const t = RESET[L];
  const url = `${String(base).replace(/\/+$/, '')}/reset/${encodeURIComponent(token)}`;
  return withTag('password_reset', {
    subject: t.subject,
    html: layout(
      h(t.h) +
      p(t.intro) +
      `<div style="margin:4px 0 8px;">${btn(url, t.btn)}</div>` +
      p(t.outro),
      L,
    ),
  });
}

const CHANGED = {
  de: { subject: 'Dein Passwort wurde geändert — CV-Hub', h: 'Passwort geändert', intro: u => `Das Passwort für dein Konto <strong>${u}</strong> wurde soeben geändert. Warst du das nicht, melde dich umgehend.`, outro: 'Aus Sicherheitsgründen wurden dabei alle anderen Anmeldungen beendet und alle API-Schlüssel und KI-Verbindungen getrennt. Verbinde deinen KI-Client bei Bedarf neu.' },
  en: { subject: 'Your password has been changed — CV-Hub', h: 'Password changed', intro: u => `The password for your account <strong>${u}</strong> has just been changed. If this wasn’t you, get in touch straight away.`, outro: 'For security, all other sign-ins have been ended and all API keys and AI connections disconnected. Reconnect your AI client if you need it.' },
  fr: { subject: 'Votre mot de passe a été modifié — CV-Hub', h: 'Mot de passe modifié', intro: u => `Le mot de passe de votre compte <strong>${u}</strong> vient d’être modifié. Si vous n’êtes pas à l’origine de ce changement, contactez-nous immédiatement.`, outro: 'Par sécurité, toutes les autres connexions ont été fermées, et toutes les clés API et connexions IA ont été coupées. Reconnectez votre client IA si besoin.' },
  es: { subject: 'Tu contraseña se ha cambiado — CV-Hub', h: 'Contraseña cambiada', intro: u => `La contraseña de tu cuenta <strong>${u}</strong> se acaba de cambiar. Si no has sido tú, ponte en contacto con nosotros de inmediato.`, outro: 'Por seguridad, se han cerrado todas las demás sesiones y se han desconectado todas las claves API y conexiones de IA. Vuelve a conectar tu cliente de IA si lo necesitas.' },
};
export function tplPasswordChanged({ username, lang = 'de' }) {
  const L = langOr(lang);
  const t = CHANGED[L];
  return withTag('password_changed', {
    subject: t.subject,
    html: layout(h(t.h) + p(t.intro(escapeHtml(username))) + p(t.outro), L),
  });
}

/* Der Admin hat das Passwort gesetzt. Vorher geschah das ohne jede Nachricht
 * an den Betroffenen — er merkte es erst, wenn er nicht mehr hineinkam. */
const RESET_ADMIN = {
  de: { subject: 'Dein Passwort wurde vom Administrator zurückgesetzt — CV-Hub', h: 'Passwort zurückgesetzt', intro: u => `Ein Administrator hat das Passwort für dein Konto <strong>${u}</strong> neu gesetzt. Das neue Passwort erhältst du von ihm direkt, nicht per E-Mail.`, outro: 'Alle Anmeldungen wurden beendet und alle API-Schlüssel und KI-Verbindungen getrennt. Ändere das Passwort nach der nächsten Anmeldung. Hast du das nicht veranlasst, melde dich umgehend.' },
  en: { subject: 'Your password was reset by an administrator — CV-Hub', h: 'Password reset', intro: u => `An administrator has set a new password for your account <strong>${u}</strong>. You’ll get the new password from them directly, not by email.`, outro: 'All sign-ins have been ended and all API keys and AI connections disconnected. Change the password after you next sign in. If you didn’t ask for this, get in touch straight away.' },
  fr: { subject: 'Votre mot de passe a été réinitialisé par un administrateur — CV-Hub', h: 'Mot de passe réinitialisé', intro: u => `Un administrateur a défini un nouveau mot de passe pour votre compte <strong>${u}</strong>. Il vous le communiquera directement, pas par e-mail.`, outro: 'Toutes les connexions ont été fermées, et toutes les clés API et connexions IA ont été coupées. Changez le mot de passe lors de votre prochaine connexion. Si vous n’avez rien demandé, contactez-nous immédiatement.' },
  es: { subject: 'Un administrador ha restablecido tu contraseña — CV-Hub', h: 'Contraseña restablecida', intro: u => `Un administrador ha puesto una contraseña nueva para tu cuenta <strong>${u}</strong>. Te la dará directamente, no por correo.`, outro: 'Se han cerrado todas las sesiones y se han desconectado todas las claves API y conexiones de IA. Cambia la contraseña cuando vuelvas a iniciar sesión. Si no lo has pedido tú, ponte en contacto con nosotros de inmediato.' },
};
export function tplPasswordResetByAdmin({ username, lang = 'de' }) {
  const L = langOr(lang);
  const t = RESET_ADMIN[L];
  return withTag('password_reset_admin', {
    subject: t.subject,
    html: layout(h(t.h) + p(t.intro(escapeHtml(username))) + p(t.outro), L),
  });
}

/* Geht an die ALTE Adresse, wenn die E-Mail des Kontos geändert wurde. */
const EMAIL_CHANGED = {
  de: { subject: 'Die E-Mail-Adresse deines Kontos wurde geändert — CV-Hub', h: 'E-Mail-Adresse geändert', now: (u, e) => `Für dein Konto <strong>${u}</strong> ist jetzt die Adresse <strong>${e}</strong> hinterlegt. Nachrichten und Passwort-Links gehen ab sofort dorthin.`, none: u => `Für dein Konto <strong>${u}</strong> ist keine E-Mail-Adresse mehr hinterlegt. Die Zwei-Faktor-Anmeldung wurde damit abgeschaltet.`, outro: 'Warst du das nicht, melde dich umgehend.' },
  en: { subject: 'The email address for your account has changed — CV-Hub', h: 'Email address changed', now: (u, e) => `Your account <strong>${u}</strong> now uses the address <strong>${e}</strong>. Messages and password links go there from now on.`, none: u => `Your account <strong>${u}</strong> no longer has an email address, so two-factor sign-in has been switched off.`, outro: 'If this wasn’t you, get in touch straight away.' },
  fr: { subject: 'L’adresse e-mail de votre compte a été modifiée — CV-Hub', h: 'Adresse e-mail modifiée', now: (u, e) => `Votre compte <strong>${u}</strong> utilise désormais l’adresse <strong>${e}</strong>. Les messages et les liens de mot de passe y seront envoyés.`, none: u => `Votre compte <strong>${u}</strong> n’a plus d’adresse e-mail. La connexion à deux facteurs a donc été désactivée.`, outro: 'Si vous n’êtes pas à l’origine de ce changement, contactez-nous immédiatement.' },
  es: { subject: 'Se ha cambiado la dirección de correo de tu cuenta — CV-Hub', h: 'Dirección de correo cambiada', now: (u, e) => `Tu cuenta <strong>${u}</strong> usa ahora la dirección <strong>${e}</strong>. Los mensajes y los enlaces de contraseña llegarán allí a partir de ahora.`, none: u => `Tu cuenta <strong>${u}</strong> ya no tiene dirección de correo. Por eso se ha desactivado el inicio de sesión en dos pasos.`, outro: 'Si no has sido tú, ponte en contacto con nosotros de inmediato.' },
};
export function tplEmailChanged({ username, newEmail, lang = 'de' }) {
  const L = langOr(lang);
  const t = EMAIL_CHANGED[L];
  return withTag('email_changed', {
    subject: t.subject,
    html: layout(
      h(t.h) +
      p(newEmail ? t.now(escapeHtml(username), escapeHtml(newEmail)) : t.none(escapeHtml(username))) +
      p(t.outro),
      L,
    ),
  });
}

/* Login-Code der Zwei-Faktor-Anmeldung für Nutzerkonten. Der Admin-Code hat
 * eine eigene, deutsche Vorlage in admin.js. */
const LOGIN_CODE = {
  de: { subject: 'Dein Login-Code für CV-Hub', h: 'Dein Login-Code', intro: 'Gib diesen Code im Anmeldefenster ein, um dich anzumelden. Er ist 10 Minuten gültig.', outro: 'Hast du dich nicht gerade angemeldet, ignoriere diese E-Mail und ändere sicherheitshalber dein Passwort.' },
  en: { subject: 'Your sign-in code for CV-Hub', h: 'Your sign-in code', intro: 'Enter this code in the sign-in window to sign in. It is valid for 10 minutes.', outro: 'If you didn’t just try to sign in, ignore this email and change your password to be safe.' },
  fr: { subject: 'Votre code de connexion pour CV-Hub', h: 'Votre code de connexion', intro: 'Saisissez ce code dans la fenêtre de connexion pour vous connecter. Il est valable 10 minutes.', outro: 'Si vous n’êtes pas en train de vous connecter, ignorez cet e-mail et changez votre mot de passe par précaution.' },
  es: { subject: 'Tu código de inicio de sesión para CV-Hub', h: 'Tu código de inicio de sesión', intro: 'Introduce este código en la ventana de inicio de sesión. Es válido durante 10 minutos.', outro: 'Si no acabas de intentar iniciar sesión, ignora este correo y cambia tu contraseña por precaución.' },
};
export function tplLoginCode({ code, lang = 'de' }) {
  const L = langOr(lang);
  const t = LOGIN_CODE[L];
  return withTag('login_code', {
    /* Der Code steht nicht mehr im Betreff. Betreffzeilen erscheinen in
     * Sperrbildschirm-Benachrichtigungen, Postfachlisten und Logs von
     * Mailservern — der Code gehört nur in den Text. */
    subject: t.subject,
    html: layout(h(t.h) + p(t.intro) + CODE_BOX(code, 30, '0.24em', 18) + p(t.outro), L),
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
const OFFBOARDING = {
  de: {
    subjectDeleted: 'Dein Konto wurde gelöscht — CV-Hub', subjectDisabled: 'Dein Konto wurde deaktiviert — CV-Hub',
    hDeleted: 'Konto gelöscht', hDisabled: 'Konto deaktiviert',
    retained: (u, n) => `Dein Konto <strong>${u}</strong> und alle Inhalte (Lebensläufe, Fotos, Links, Schlüssel) wurden gelöscht. Deine ${n === 1 ? 'Bestellung und die Rechnung dazu' : 'Bestellungen und die Rechnungen dazu'} bewahren wir mit Name, E-Mail-Adresse, Land, Betrag, Datum und Rechnungsnummer zehn Jahre auf, weil das Steuerrecht es verlangt (§ 147 AO, § 14b UStG). Danach werden sie gelöscht. Ein Widerruf innerhalb der Frist geht weiterhin über das Widerrufsformular auf der Website.`,
    deleted: u => `Dein Konto <strong>${u}</strong> und alle zugehörigen Daten wurden gelöscht. Danke, dass du CV-Hub genutzt hast.`,
    disabled: u => `Dein Konto <strong>${u}</strong> wurde deaktiviert. Melde dich bei uns, falls das ein Versehen war.`,
  },
  en: {
    subjectDeleted: 'Your account has been deleted — CV-Hub', subjectDisabled: 'Your account has been deactivated — CV-Hub',
    hDeleted: 'Account deleted', hDisabled: 'Account deactivated',
    retained: (u, n) => `Your account <strong>${u}</strong> and all its content (CVs, photos, links, keys) have been deleted. We keep your ${n === 1 ? 'order and its invoice' : 'orders and their invoices'} with name, email address, country, amount, date and invoice number for ten years, as German tax law requires (§ 147 AO, § 14b UStG). After that they are deleted. You can still withdraw within the withdrawal period using the withdrawal form on the website.`,
    deleted: u => `Your account <strong>${u}</strong> and all its data have been deleted. Thank you for using CV-Hub.`,
    disabled: u => `Your account <strong>${u}</strong> has been deactivated. Get in touch if this was a mistake.`,
  },
  fr: {
    subjectDeleted: 'Votre compte a été supprimé — CV-Hub', subjectDisabled: 'Votre compte a été désactivé — CV-Hub',
    hDeleted: 'Compte supprimé', hDisabled: 'Compte désactivé',
    retained: (u, n) => `Votre compte <strong>${u}</strong> et tout son contenu (CV, photos, liens, clés) ont été supprimés. Nous conservons ${n === 1 ? 'votre commande et sa facture' : 'vos commandes et leurs factures'} avec le nom, l’adresse e-mail, le pays, le montant, la date et le numéro de facture pendant dix ans, comme l’exige le droit fiscal allemand (§ 147 AO, § 14b UStG). Ces données sont ensuite supprimées. Une rétractation dans le délai reste possible via le formulaire de rétractation du site.`,
    deleted: u => `Votre compte <strong>${u}</strong> et toutes les données associées ont été supprimés. Merci d’avoir utilisé CV-Hub.`,
    disabled: u => `Votre compte <strong>${u}</strong> a été désactivé. Contactez-nous s’il s’agit d’une erreur.`,
  },
  es: {
    subjectDeleted: 'Tu cuenta se ha eliminado — CV-Hub', subjectDisabled: 'Tu cuenta se ha desactivado — CV-Hub',
    hDeleted: 'Cuenta eliminada', hDisabled: 'Cuenta desactivada',
    retained: (u, n) => `Tu cuenta <strong>${u}</strong> y todo su contenido (currículums, fotos, enlaces, claves) se han eliminado. ${n === 1 ? 'Tu pedido y su factura los' : 'Tus pedidos y sus facturas los'} conservamos con nombre, dirección de correo, país, importe, fecha y número de factura durante diez años, porque lo exige la legislación fiscal alemana (§ 147 AO, § 14b UStG). Después se eliminan. Puedes seguir desistiendo dentro del plazo con el formulario de desistimiento de la web.`,
    deleted: u => `Tu cuenta <strong>${u}</strong> y todos sus datos se han eliminado. Gracias por usar CV-Hub.`,
    disabled: u => `Tu cuenta <strong>${u}</strong> se ha desactivado. Escríbenos si ha sido un error.`,
  },
};
export function tplOffboarding({ username, deleted, retainedOrders = 0, lang = 'de' }) {
  const L = langOr(lang);
  const t = OFFBOARDING[L];
  const u = escapeHtml(username);
  return withTag('offboarding', {
    subject: deleted ? t.subjectDeleted : t.subjectDisabled,
    html: layout(
      h(deleted ? t.hDeleted : t.hDisabled) +
      p(deleted ? (retainedOrders > 0 ? t.retained(u, retainedOrders) : t.deleted(u)) : t.disabled(u)),
      L,
    ),
  });
}

/* Hinweis vor Ablauf der Laufzeit (Pilot, 08.10.2026). Geht 14 und 3 Tage
 * vorher hinaus (access.js). Seit 17.11.2026 in der Sprache des Kontos
 * (users.mail_lang). Kennt das Konto keine Sprache (ältere Konten, lang
 * leer), bleibt es bei Deutsch und Englisch in einer Mail: eine falsch
 * geratene Sprache ist schlechter als zwei. */
const ACCESS_ENDING = {
  de: {
    subject: d => `Dein Zugang zu CV-Hub endet am ${d}`,
    h: n => `Noch ${n === 1 ? 'ein Tag' : `${n} Tage`}`,
    intro: (u, d) => `Hallo ${u}, dein Zugang endet am <strong>${d}</strong>. Danach kannst du deine Lebensläufe weiter öffnen und exportieren, aber nicht mehr ändern. Gelöscht wird nichts, ohne dass du vorher davon erfährst.`,
    keep: 'Wenn du deine Unterlagen unabhängig von diesem Werkzeug behalten willst, lade sie jetzt herunter, im Export-Bereich des Editors:',
    list: ['<strong>DOCX</strong>: zum Weiterbearbeiten in Word oder LibreOffice', '<strong>JSON</strong>: alle Inhalte maschinenlesbar, wieder importierbar; in den Kontoeinstellungen gibt es zusätzlich den vollständigen Datenexport', '<strong>ZIP „Vorlage ohne Daten“</strong>: das Layout als Datei, ohne deine Angaben', '<strong>PDF</strong>: die fertige Fassung zum Versenden'],
    more: 'Brauchst du länger, wende dich an die Person, von der du den Zugang hast.',
    btn: 'Zum Editor →',
  },
  en: {
    subject: d => `Your access to CV-Hub ends on ${d}`,
    h: n => `${n === 1 ? 'One day' : `${n} days`} left`,
    intro: (u, d) => `Hi ${u}, your access ends on <strong>${d}</strong>. After that you can still open and export your CVs, but no longer edit them. Nothing is deleted without telling you first.`,
    keep: 'To keep your documents independently of this tool, download them now from the editor’s export panel:',
    list: ['<strong>DOCX</strong>: to keep editing in Word or LibreOffice', '<strong>JSON</strong>: all content, machine-readable and re-importable; the full data export is also in your account settings', '<strong>ZIP “Template without data”</strong>: the layout as a file, without your details', '<strong>PDF</strong>: the finished version to send'],
    more: 'If you need more time, contact the person who gave you access.',
    btn: 'Open the editor →',
  },
  fr: {
    subject: d => `Votre accès à CV-Hub se termine le ${d}`,
    h: n => (n === 1 ? 'Plus qu’un jour' : `Plus que ${n} jours`),
    intro: (u, d) => `Bonjour ${u}, votre accès se termine le <strong>${d}</strong>. Ensuite, vous pourrez toujours ouvrir et exporter vos CV, mais plus les modifier. Rien n’est supprimé sans que vous en soyez informé au préalable.`,
    keep: 'Pour conserver vos documents indépendamment de cet outil, téléchargez-les dès maintenant dans le panneau d’export de l’éditeur :',
    list: ['<strong>DOCX</strong> : pour continuer à les modifier dans Word ou LibreOffice', '<strong>JSON</strong> : tout le contenu, lisible par machine et réimportable ; l’export complet des données se trouve aussi dans les paramètres du compte', '<strong>ZIP « Modèle sans données »</strong> : la mise en page sous forme de fichier, sans vos informations', '<strong>PDF</strong> : la version finale à envoyer'],
    more: 'S’il vous faut plus de temps, adressez-vous à la personne qui vous a donné l’accès.',
    btn: 'Ouvrir l’éditeur →',
  },
  es: {
    subject: d => `Tu acceso a CV-Hub termina el ${d}`,
    h: n => (n === 1 ? 'Queda un día' : `Quedan ${n} días`),
    intro: (u, d) => `Hola ${u}, tu acceso termina el <strong>${d}</strong>. Después podrás seguir abriendo y exportando tus currículums, pero ya no editarlos. No se borra nada sin avisarte antes.`,
    keep: 'Si quieres conservar tus documentos sin depender de esta herramienta, descárgalos ahora en el panel de exportación del editor:',
    list: ['<strong>DOCX</strong>: para seguir editando en Word o LibreOffice', '<strong>JSON</strong>: todo el contenido en formato legible por máquina, se puede volver a importar; en los ajustes de la cuenta tienes además la exportación completa de datos', '<strong>ZIP «Plantilla sin datos»</strong>: el diseño como archivo, sin tus datos', '<strong>PDF</strong>: la versión final para enviar'],
    more: 'Si necesitas más tiempo, habla con la persona que te dio el acceso.',
    btn: 'Abrir el editor →',
  },
};
function accessEndingBlock(L, { username, until, n, link }) {
  const t = ACCESS_ENDING[L];
  return h(t.h(n)) +
    p(t.intro(escapeHtml(username), mailDate(L, until))) +
    p(t.keep) +
    `<ul style="font-size:14px;line-height:1.6;color:${SOFT};margin:0 0 16px;padding-left:20px;">${t.list.map(li => `<li>${li}</li>`).join('')}</ul>` +
    p(t.more) +
    (link ? `<div style="margin:4px 0 8px;">${btn(link, t.btn)}</div>` : '');
}
export function tplAccessEnding({ username, until, daysLeft, base, lang = null }) {
  const n = Math.max(1, Math.round(Number(daysLeft) || 1));
  const link = base ? String(base).replace(/\/+$/, '') : null;
  const L = knownLang(lang);
  const args = { username, until, n, link };
  if (L) {
    return withTag('access_ending', { subject: ACCESS_ENDING[L].subject(mailDate(L, until)), html: layout(accessEndingBlock(L, args), L) });
  }
  const sep = `<div style="border-top:1px solid ${LINE};margin:22px 0 18px;"></div>`;
  return withTag('access_ending', {
    subject: `${ACCESS_ENDING.de.subject(mailDate('de', until))} · Your access ends on ${mailDate('en', until)}`,
    html: layout(accessEndingBlock('de', args) + sep + accessEndingBlock('en', { ...args, link: null })),
  });
}
