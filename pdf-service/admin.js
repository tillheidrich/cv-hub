// Admin-Bereich auf eigener Adresse (Runde 8b, 10.10.2026).
//
// Auftrag: Nutzer, Zahlungen und Gutscheine nur noch über eine eigene
// Admin-Adresse verwalten, „das ist mir bei einem Bezahlservice zu heikel“,
// und dazu alles an Zahlen, was er für den Betrieb braucht.
//
// Aufbau (ausführlich in ADMIN.md):
//
//  1. Host-Weiche (gate): Ist ADMIN_HOST gesetzt, antwortet /api/admin/* nur
//     auf genau diesem Host. Auf jedem anderen Host gibt es dort 404, und auf
//     dem Admin-Host gibt es nichts außer /api/admin/* und /health.
//  2. Eigene Admin-Sitzung: Cookie `__Host-cv_admin` (nur dieser Host, Secure,
//     HttpOnly, SameSite=Strict, Pfad /), ausgestellt nur nach Passwort UND
//     E-Mail-Code, 8 Stunden absolut, 30 Minuten ohne Anfrage. Die normale
//     Sitzung der Hauptdomain, API-Schlüssel und KI-Verbindungen geben auf
//     dem Admin-Host keine Rechte.
//  3. Ursprung: Schreibende Admin-Anfragen brauchen `Origin` gleich der
//     Admin-Adresse; lesende mit fremdem Origin oder `Sec-Fetch-Site:
//     same-site|cross-site` werden abgewiesen. cv.* und cv-admin.* sind
//     „same-site“: SameSite=Strict allein schützt zwischen den beiden nicht,
//     deshalb diese Prüfung.
//  4. Optional ADMIN_ALLOWED_IPS (CIDR-Liste).
//  5. Protokoll jeder Admin-Aktion in admin_audit (wer, was, Ziel, Zeit,
//     gekürzte Adresse), ein Jahr (janitor.js).
//
// Ohne ADMIN_HOST (Selbsthoster, Tests, lokal) bleibt der bisherige Weg:
// Admin-Rechte über die normale Anmeldung mit Rolle „admin“. Die Admin-Seite
// liegt dann unter /admin/ auf derselben Adresse.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { subnetOf } from './guards.js';
import { addGrant, planDetails } from './grants.js';
import { escapeHtml, layout, h, p, MAIL_COLORS } from './mail.js';
import { janitorState } from './janitor.js';
import { ROUTE_LABELS } from './stats.js';
import { createMollie } from './mollie.js';
import { MAX_ACCESS_DAYS } from './access.js';

export const ADMIN_COOKIE = '__Host-cv_admin';
export const ADMIN_SESSION_HOURS = 8;
export const ADMIN_IDLE_MINUTES = 30;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DUMMY_HASH = bcrypt.hashSync('cv-admin-timing-equalizer-not-a-password', 10);
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── Konfiguration ─────────────────────────────────────────────────────── */

/** Host ohne Schema, Pfad, Standardport und abschließenden Punkt. */
export function normHost(v) {
  let s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0];
  s = s.replace(/\.$/, '').replace(/:(443|80)$/, '');
  return s;
}

/* IP-Adressen als BigInt, für CIDR-Vergleiche ohne Abhängigkeit. */
function parseV4(s) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some(n => n > 255)) return null;
  return parts.reduce((acc, n) => (acc << 8n) + BigInt(n), 0n);
}
function parseV6(s) {
  let str = s.split('%')[0].toLowerCase();
  let tail4 = null;
  const v4m = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(str);
  if (v4m) {
    tail4 = parseV4(v4m[1]);
    if (tail4 === null) return null;
    str = str.slice(0, -v4m[1].length) + '0:0';
  }
  if (!/^[0-9a-f:]+$/.test(str) || (str.match(/::/g) || []).length > 1) return null;
  const [head, tail = ''] = str.split('::');
  const hs = head ? head.split(':') : [];
  const ts = str.includes('::') ? (tail ? tail.split(':') : []) : [];
  const fill = str.includes('::') ? 8 - hs.length - ts.length : 0;
  if (fill < 0) return null;
  const groups = [...hs, ...Array(fill).fill('0'), ...ts];
  if (groups.length !== 8 || groups.some(g => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  let big = groups.reduce((acc, g) => (acc << 16n) + BigInt(parseInt(g, 16)), 0n);
  if (tail4 !== null) big = (big >> 32n << 32n) + tail4;
  return big;
}
/** { v: 4|6, n: BigInt } oder null. IPv4 in IPv6 (::ffff:a.b.c.d) zählt als IPv4. */
export function parseIp(raw) {
  const s = String(raw ?? '').trim();
  const v4 = parseV4(s);
  if (v4 !== null) return { v: 4, n: v4 };
  const v6 = parseV6(s);
  if (v6 === null) return null;
  if (v6 >> 32n === 0xffffn) return { v: 4, n: v6 & 0xffffffffn };
  return { v: 6, n: v6 };
}
/** CIDR-Liste aus „1.2.3.4/32, 2a01:db8::/48, 5.6.7.8“. Ungültige Einträge
 *  landen in `invalid` (der Dienst warnt beim Start), gelten aber nicht. */
export function parseCidrs(list) {
  const nets = [];
  const invalid = [];
  for (const item of String(list ?? '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)) {
    const [addr, lenRaw] = item.split('/');
    const ip = parseIp(addr);
    const bits = ip?.v === 4 ? 32 : 128;
    const len = lenRaw === undefined ? bits : Number(lenRaw);
    if (!ip || !Number.isInteger(len) || len < 0 || len > bits || (lenRaw !== undefined && !/^\d+$/.test(lenRaw))) { invalid.push(item); continue; }
    const shift = BigInt(bits - len);
    nets.push({ v: ip.v, len, shift, base: ip.n >> shift, text: item });
  }
  return { nets, invalid };
}
export function ipInCidrs(raw, nets) {
  const ip = parseIp(raw);
  if (!ip) return false;
  return nets.some(n => n.v === ip.v && (ip.n >> n.shift) === n.base);
}

export function adminConfig(env = process.env) {
  const host = normHost(env.ADMIN_HOST);
  const rawUrl = String(env.ADMIN_URL || '').trim().replace(/\/+$/, '');
  let origin = null;
  try { if (rawUrl) origin = new URL(rawUrl).origin; } catch { /* ungültig */ }
  if (!origin && host) origin = `https://${host}`;
  const { nets, invalid } = parseCidrs(env.ADMIN_ALLOWED_IPS);
  const email = String(env.ADMIN_EMAIL || '').trim().toLowerCase();
  const umami = String(env.UMAMI_DASHBOARD_URL || '').trim();
  return {
    host,
    separate: !!host,
    origin,
    url: rawUrl || (host ? `https://${host}` : null),
    allowedIps: nets,
    invalidIps: invalid,
    email: /^[^\s@()<>",;:\\[\]]+@[^\s@()<>",;:\\[\]]+\.[^\s@()<>",;:\\[\]]+$/.test(email) ? email : '',
    umamiUrl: /^https:\/\/[^\s"'<>]+$/.test(umami) ? umami : null,
  };
}

/* ── CSV für die Steuerberatung ─────────────────────────────────────────── */

/** Eine Zelle: CSV-Injection neutralisieren (Zellanfang =, +, -, @, Tab,
 *  Wagenrücklauf bekommt ein Hochkomma), dann nach RFC 4180 quoten. */
export function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}
export function csvLine(cells) { return cells.map(csvCell).join(';'); }

function berlinDateDe(d) {
  if (!d) return '';
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d));
}
function eurDe(cents) {
  const n = Number(cents || 0);
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  return `${sign}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`;
}
const STATUS_DE = {
  open: 'offen', pending: 'ausstehend', authorized: 'autorisiert', paid: 'bezahlt', canceled: 'abgebrochen',
  expired: 'abgelaufen', failed: 'fehlgeschlagen', withdrawn: 'widerrufen', refunded: 'erstattet',
};
const METHOD_DE = {
  creditcard: 'Kreditkarte', paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', banktransfer: 'Überweisung',
  directdebit: 'Lastschrift', ideal: 'iDEAL', bancontact: 'Bancontact', sofort: 'SOFORT', klarna: 'Klarna', eps: 'eps', przelewy24: 'Przelewy24',
};
export const CSV_HEADER = ['Rechnungsnummer', 'Rechnungsdatum', 'Bestellnummer', 'Betrag', 'Währung', 'Steuerhinweis', 'Land', 'Zahlungsart', 'Status', 'Storno-Bezug', 'Erstattung'];
const TAX_NOTE = 'Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer ausgewiesen';

/** Zeilen für den Export. Erwartet orders-Zeilen (+ method). */
export function invoicesCsv(rows) {
  const lines = [csvLine(CSV_HEADER)];
  for (const o of rows) {
    const storno = (o.status === 'withdrawn' || o.status === 'refunded')
      ? `Widerruf vom ${berlinDateDe(o.withdrawn_at)} zu ${o.invoice_no}`
      : '';
    const cancel = o.cancelled_at ? ` (gekündigt zum ${berlinDateDe(o.cancel_effective_at || o.cancelled_at)})` : '';
    lines.push(csvLine([
      o.invoice_no, berlinDateDe(o.paid_at), o.order_no, eurDe(o.amount_cents), o.currency || 'EUR', TAX_NOTE,
      o.country, METHOD_DE[o.method] || o.method || 'unbekannt', (STATUS_DE[o.status] || o.status) + cancel,
      storno, o.refund_status ? (o.refund_status === 'refunded' ? `erstattet ${eurDe(o.amount_cents)} EUR` : `Erstattung ${o.refund_status}`) : '',
    ]));
    /* P6 (B4, 10.10.2026): Der Widerruf hat einen eigenen Stornobeleg
     * (Rechnungsnummer + „-S“). Eigene Zeile, Betrag positiv wie in der
     * Rechnung — die Spalte Status sagt „Stornobeleg“, der Bezug nennt die
     * Rechnung, die er aufhebt (ein Minuszeichen am Zellanfang würde die
     * CSV-Neutralisierung auslösen). Datum: Ausstellung des Belegs, sonst
     * Eingang des Widerrufs. */
    if (storno) {
      lines.push(csvLine([
        o.storno_no || `${o.invoice_no}-S`, berlinDateDe(o.storno_issued_at || o.withdrawn_at), o.order_no, eurDe(o.amount_cents), o.currency || 'EUR', TAX_NOTE,
        o.country, METHOD_DE[o.method] || o.method || 'unbekannt', 'Stornobeleg (mindert den Umsatz)',
        `hebt ${o.invoice_no} auf`, '',
      ]));
    }
  }
  // BOM, damit Excel Umlaute richtig liest; CRLF nach RFC 4180.
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

/** Lücken- und Doppelprüfung der Rechnungsnummern je Jahr. */
export function invoiceGaps(invoiceNos, counters) {
  const byYear = new Map();
  for (const no of invoiceNos) {
    const m = /-(\d{4})-(\d+)$/.exec(String(no || ''));
    if (!m) continue;
    const y = Number(m[1]);
    const n = Number(m[2]);
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(n);
  }
  const years = new Set([...byYear.keys(), ...counters.map(c => Number(c.year))]);
  const out = [];
  for (const y of [...years].sort((a, b) => b - a)) {
    const nums = (byYear.get(y) || []).sort((a, b) => a - b);
    const last = Number(counters.find(c => Number(c.year) === y)?.last ?? 0);
    const seen = new Set();
    const dup = [];
    for (const n of nums) { if (seen.has(n)) dup.push(n); seen.add(n); }
    const max = Math.max(last, nums.length ? nums[nums.length - 1] : 0);
    const missing = [];
    for (let i = 1; i <= max && missing.length < 200; i++) if (!seen.has(i)) missing.push(i);
    out.push({ year: y, count: nums.length, counter: last, missing, duplicates: dup, ok: !missing.length && !dup.length && last === max });
  }
  return out;
}

/* ── Mails ─────────────────────────────────────────────────────────────── */

function tplAdminLoginCode({ code, host }) {
  return {
    subject: 'Admin-Anmeldung: dein Code',
    html: layout(
      h('Admin-Anmeldung') +
      p(`Jemand meldet sich gerade mit deinem Passwort im Admin-Bereich an${host ? ` (${escapeHtml(host)})` : ''}. Der Code gilt 10 Minuten.`) +
      `<div style="font-family:monospace;font-size:30px;font-weight:700;letter-spacing:0.24em;background:${MAIL_COLORS.PAPER};border:1px solid ${MAIL_COLORS.LINE};border-radius:9px;padding:18px;text-align:center;margin:0 0 20px;">${code}</div>` +
      p('Warst du das nicht, ändere sofort ADMIN_PASSWORD in Coolify und starte den Dienst neu. Damit enden alle Sitzungen.'),
    ),
  };
}
function tplAdminTest({ host }) {
  return {
    subject: 'Testmail aus dem Admin-Bereich',
    html: layout(h('Mailversand klappt') + p(`Diese Mail hast du im Admin-Bereich${host ? ` (${escapeHtml(host)})` : ''} angefordert. Wenn sie ankommt, funktioniert der Versand.`)),
  };
}
function maskEmail(e) {
  const [u, d] = String(e || '').split('@');
  if (!d) return '';
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
}

/* ── Fabrik ────────────────────────────────────────────────────────────── */

/**
 * deps:
 *   pool, cfg (adminConfig), rateLimit, subnetLimit, bucketBlocked, bucketHit,
 *   loadUser, markAuth, sendMail, mailConfigured, billing, billingConfig,
 *   stats, publicBaseUrl, issueEmailConfirmation, issuePasswordReset,
 *   deleteAccount, revokeAllCredentials, systemInfo, summarizeUa
 */
export function createAdmin(deps) {
  const { pool, cfg } = deps;
  const log = deps.log || console.log;

  /* ── Host und Ursprung ─────────────────────────────────────────────── */

  function isAdminHost(req) {
    if (!cfg.separate) return false;
    const host = normHost(req.headers.host);
    const fwdRaw = req.headers['x-forwarded-host'];
    const fwd = fwdRaw ? normHost(String(fwdRaw).split(',')[0]) : '';
    return host === cfg.host && (!fwd || fwd === cfg.host);
  }

  function ipNet(req) { return subnetOf(req.ip); }

  async function auditWrite({ adminId, action, target, details, req }) {
    try {
      await pool.query(
        'INSERT INTO admin_audit (admin_id, action, target, details, ip_net, via) VALUES ($1, $2, $3, $4, $5, $6)',
        [adminId ?? null, String(action).slice(0, 80), target == null ? null : String(target).slice(0, 120),
          details ? JSON.stringify(details) : null, req ? ipNet(req) : null, req ? (req.adminScope || null) : null],
      );
    } catch (err) {
      log(`admin: Protokolleintrag fehlgeschlagen (${err?.message || err})`);
    }
  }

  /**
   * Läuft vor allem anderen (vor CORS und Ursprungsprüfung). Setzt
   * req.adminScope = 'separate' | 'legacy' für /api/admin/*.
   */
  function gate(req, res, next) {
    const adminPath = /^\/api\/admin(\/|$)/i.test(req.path);
    const notFound = () => res.status(404).json({ error: 'Nicht gefunden.', code: 'not_found' });
    if (cfg.separate) {
      if (!isAdminHost(req)) return adminPath ? notFound() : next();
      if (req.path === '/health') return next();
      if (!adminPath) return notFound();
      req.adminScope = 'separate';
    } else {
      if (!adminPath) return next();
      req.adminScope = 'legacy';
    }
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    if (cfg.allowedIps.length && !ipInCidrs(req.ip, cfg.allowedIps)) {
      return res.status(403).json({ error: 'Diese Adresse ist für den Admin-Bereich nicht freigegeben.', code: 'ip_not_allowed' });
    }
    if (req.adminScope === 'separate') {
      const origin = req.headers.origin;
      const site = req.headers['sec-fetch-site'];
      if (origin !== undefined && origin !== cfg.origin) {
        return res.status(403).json({ error: 'Dieser Ursprung ist nicht zugelassen.', code: 'origin_not_allowed' });
      }
      if (site && site !== 'same-origin' && site !== 'none') {
        return res.status(403).json({ error: 'Nur aus dem Admin-Bereich selbst.', code: 'cross_site' });
      }
      if (!SAFE_METHODS.has(req.method) && origin === undefined) {
        return res.status(403).json({ error: 'Ursprung fehlt.', code: 'origin_required' });
      }
    }
    // Protokoll: jede erfolgreiche schreibende Anfrage, dazu lesende, die es
    // ausdrücklich verlangen (Kundendetails, Exporte).
    res.on('finish', () => {
      if (res.statusCode >= 400 || res.locals.auditDone) return;
      if (/^\/api\/admin\/auth\//i.test(req.path)) return;          // dort ausdrücklich
      const a = res.locals.audit;
      const write = !SAFE_METHODS.has(req.method);
      if (!write && !a) return;
      // vouchers.js protokolliert Anlegen und Deaktivieren selbst.
      if (!a && /^\/api\/admin\/vouchers/i.test(req.path)) return;
      const routePath = req.route?.path ? String(req.route.path) : req.path;
      auditWrite({
        adminId: req.user?.id,
        action: a?.action || `${req.method} ${routePath}`,
        target: a?.target ?? req.params?.id ?? req.params?.code ?? null,
        details: a?.details || null,
        req,
      });
    });
    next();
  }

  /* ── Sitzungen ─────────────────────────────────────────────────────── */

  const pcmOf = u => (u?.password_changed_at ? new Date(u.password_changed_at).getTime() : 0);

  async function issueSession(req, res, user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const expires = new Date(Date.now() + ADMIN_SESSION_HOURS * 3600_000);
    await pool.query(
      'INSERT INTO admin_sessions (token_hash, user_id, pcm, expires_at, ip_net, ua_summary) VALUES ($1, $2, $3, $4, $5, $6)',
      [sha256(token), user.id, pcmOf(user), expires, ipNet(req), deps.summarizeUa ? deps.summarizeUa(req.get('user-agent') || '') : null],
    );
    res.cookie(ADMIN_COOKIE, token, {
      httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: ADMIN_SESSION_HOURS * 3600_000,
    });
    return expires;
  }

  function clearCookie(res) {
    res.clearCookie(ADMIN_COOKIE, { httpOnly: true, secure: true, sameSite: 'strict', path: '/' });
  }

  /** Gültige Admin-Sitzung aus dem Cookie, sonst null. Verlängert die Leerlaufzeit. */
  async function sessionFromCookie(req) {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const { rows } = await pool.query(
      `SELECT s.token_hash, s.pcm, s.created_at AS s_created, s.last_seen_at AS s_seen, s.expires_at AS s_expires, s.revoked_at,
              u.*
         FROM admin_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1`,
      [sha256(token)],
    );
    const r = rows[0];
    if (!r || r.revoked_at) return null;
    const now = Date.now();
    if (new Date(r.s_expires).getTime() <= now) return null;
    if (now - new Date(r.s_seen).getTime() > ADMIN_IDLE_MINUTES * 60_000) return null;
    if (r.role !== 'admin' || r.disabled) return null;
    if (Number(r.pcm) !== pcmOf(r)) return null;
    await pool.query('UPDATE admin_sessions SET last_seen_at = now() WHERE token_hash = $1', [r.token_hash]);
    const session = { tokenHash: r.token_hash, createdAt: r.s_created, expiresAt: r.s_expires };
    for (const k of ['token_hash', 'pcm', 's_created', 's_seen', 's_expires', 'revoked_at']) delete r[k];
    return { user: r, session };
  }

  /** Ersetzt requireAuth auf /api/admin/* (server.js ruft es auf). */
  async function authenticate(req, res, next) {
    if (req.adminVerified) return next();
    const s = await sessionFromCookie(req);
    if (s) {
      req.user = deps.markAuth ? deps.markAuth(s.user, 'admin-session') : s.user;
      req.adminSession = s.session;
      req.adminVerified = true;
      return next();
    }
    if (req.adminScope === 'separate') {
      return res.status(401).json({ error: 'Bitte im Admin-Bereich anmelden.', code: 'admin_login_required' });
    }
    // Ohne ADMIN_HOST: der bisherige Weg über die normale Anmeldung.
    const u = await deps.loadUser(req);
    if (!u) return res.status(401).json({ error: 'Nicht angemeldet.' });
    req.user = u;
    // Nur mit Browser-Sitzung: API-Schlüssel und OAuth/MCP-Token eines Admins
    // öffnen die Admin-API nicht (Audit 10.10.2026, S12).
    if (u.role === 'admin' && (!u.authVia || u.authVia === 'session')) req.adminVerified = true;
    next();
  }

  function needAdmin(req, res, next) {
    if (req.adminScope && req.adminVerified) return next();
    return res.status(403).json({ error: 'Nur für Administratoren.' });
  }
  const guard = [authenticate, needAdmin];

  /* ── Daten ─────────────────────────────────────────────────────────── */

  async function one(sql, args = []) { return (await pool.query(sql, args)).rows[0]; }
  async function all(sql, args = []) { return (await pool.query(sql, args)).rows; }

  async function overview() {
    await deps.stats?.flush?.();
    const accounts = await one(`
      SELECT count(*) FILTER (WHERE role <> 'admin')::int AS total,
             count(*) FILTER (WHERE role <> 'admin' AND created_at > now() - interval '7 days')::int AS new7,
             count(*) FILTER (WHERE role <> 'admin' AND created_at > now() - interval '30 days')::int AS new30,
             count(*) FILTER (WHERE role <> 'admin' AND last_seen_at > now() - interval '7 days')::int AS active7,
             count(*) FILTER (WHERE role <> 'admin' AND last_seen_at > now() - interval '30 days')::int AS active30,
             count(*) FILTER (WHERE role <> 'admin' AND disabled)::int AS disabled,
             count(*) FILTER (WHERE role <> 'admin' AND signup_source = 'self' AND email_confirmed_at IS NULL)::int AS unconfirmed,
             count(*) FILTER (WHERE role <> 'admin' AND plan_kind = 'lifetime')::int AS lifetime,
             count(*) FILTER (WHERE role <> 'admin' AND twofa_enabled)::int AS twofa
        FROM users`);
    const passes = await one(`
      SELECT count(*) FILTER (WHERE status = 'paid' AND pass_until > now() AND (cancel_effective_at IS NULL OR cancel_effective_at > now()))::int AS active,
             count(*) FILTER (WHERE status = 'paid' AND (pass_until <= now() OR cancel_effective_at <= now()))::int AS expired
        FROM orders WHERE paid_at IS NOT NULL`);
    const grants = await all(`
      SELECT source,
             count(DISTINCT user_id) FILTER (WHERE revoked_at IS NULL AND (kind = 'lifetime' OR (kind = 'set' AND until_at IS NULL) OR effective_until > now()))::int AS active
        FROM access_grants GROUP BY source ORDER BY source`);
    const money = await one(`
      SELECT coalesce(sum(amount_cents) FILTER (WHERE status NOT IN ('withdrawn', 'refunded')
                AND date_trunc('month', paid_at AT TIME ZONE 'Europe/Berlin') = date_trunc('month', now() AT TIME ZONE 'Europe/Berlin')), 0)::int AS month_cents,
             coalesce(sum(amount_cents) FILTER (WHERE status NOT IN ('withdrawn', 'refunded')
                AND date_trunc('year', paid_at AT TIME ZONE 'Europe/Berlin') = date_trunc('year', now() AT TIME ZONE 'Europe/Berlin')), 0)::int AS year_cents,
             coalesce(sum(amount_cents) FILTER (WHERE status NOT IN ('withdrawn', 'refunded')), 0)::int AS total_cents,
             count(*)::int AS paid_orders,
             count(*) FILTER (WHERE status IN ('withdrawn', 'refunded'))::int AS withdrawals,
             count(*) FILTER (WHERE status = 'refunded')::int AS refunded,
             coalesce(sum(amount_cents) FILTER (WHERE status = 'refunded'), 0)::int AS refunded_cents,
             count(*) FILTER (WHERE status = 'withdrawn' AND (refund_status IS NULL OR refund_status NOT IN ('refunded')))::int AS refunds_open,
             count(*) FILTER (WHERE cancelled_at IS NOT NULL)::int AS cancellations
        FROM orders WHERE paid_at IS NOT NULL`);
    const openOrders = await one(`SELECT count(*)::int AS n FROM orders WHERE paid_at IS NULL AND status IN ('open', 'pending', 'authorized')`);
    const decl = await one(`
      SELECT count(*) FILTER (WHERE status = 'manual')::int AS manual,
             count(*) FILTER (WHERE status = 'pending_confirmation')::int AS pending_confirmation
        FROM declarations`);
    const mail = await one(`
      SELECT coalesce(sum(n) FILTER (WHERE metric = 'mail_failed' AND day > (now() AT TIME ZONE 'Europe/Berlin')::date - 7), 0)::int AS failed7,
             coalesce(sum(n) FILTER (WHERE metric = 'mail_sent' AND day > (now() AT TIME ZONE 'Europe/Berlin')::date - 7), 0)::int AS sent7,
             coalesce(sum(n) FILTER (WHERE metric = 'mail_failed' AND day = (now() AT TIME ZONE 'Europe/Berlin')::date), 0)::int AS failed_today
        FROM usage_daily WHERE dim = 'all' AND metric IN ('mail_failed', 'mail_sent')`);
    const db = await one(`SELECT pg_database_size(current_database())::bigint AS bytes`);
    const tables = await all(`
      SELECT c.relname AS name, pg_total_relation_size(c.oid)::bigint AS bytes
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND n.nspname = 'public'
       ORDER BY 2 DESC LIMIT 6`);
    const photos = await one(`SELECT count(*)::int AS n, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM photos`);
    const resumes = await one(`SELECT count(*)::int AS n FROM resumes`);
    const pending = await one(`SELECT count(*)::int AS n FROM access_requests WHERE status = 'pending'`);
    const sys = deps.systemInfo ? deps.systemInfo() : {};
    /* P7 (B4, 10.10.2026): Umsatz an Privatkunden im EU-Ausland, laufendes und
     * voriges Jahr, mit Abstand zur Sperre (9.000 €) und zur gesetzlichen
     * Schwelle (10.000 €, § 3a Abs. 5 UStG). Frisch gerechnet. */
    let euAbroad;
    try { euAbroad = deps.billing?.euAbroadStatus ? await deps.billing.euAbroadStatus({ fresh: true }) : null; } catch { euAbroad = null; }
    const consent = await one(`
      SELECT count(*) FILTER (WHERE art9_consent_at IS NOT NULL AND art9_consent_version = $1)::int AS given,
             count(*) FILTER (WHERE art9_consent_at IS NULL OR art9_consent_version IS DISTINCT FROM $1)::int AS missing,
             count(*) FILTER (WHERE art9_withdrawn_at IS NOT NULL AND art9_consent_at IS NULL)::int AS withdrawn
        FROM users WHERE role <> 'admin'`, [deps.art9Version || '']);
    return {
      asOf: new Date().toISOString(),
      accounts,
      passes: { ...passes, grantsBySource: grants },
      money: { ...money, open_orders: openOrders.n },
      declarations: decl,
      mail: { configured: !!deps.mailConfigured, ...mail },
      janitor: { ...janitorState },
      storage: { dbBytes: Number(db.bytes), tables: tables.map(t => ({ name: t.name, bytes: Number(t.bytes) })), photos: { n: photos.n, bytes: Number(photos.bytes) }, resumes: resumes.n },
      accessRequestsPending: pending.n,
      euAbroad,
      art9Consent: { ...consent, version: deps.art9Version || null },
      version: sys.version || null,
      sale: sys.sale || null,
    };
  }

  const RANGES = new Set([30, 90, 365]);
  function rangeOf(req) {
    const d = Number.parseInt(String(req.query?.days ?? '30'), 10);
    return RANGES.has(d) ? d : 30;
  }

  async function timeseries(days) {
    await deps.stats?.flush?.();
    const rows = await all(`
      WITH t AS (SELECT (now() AT TIME ZONE 'Europe/Berlin')::date AS today),
      d AS (SELECT generate_series((SELECT today FROM t) - ($1::int - 1), (SELECT today FROM t), interval '1 day')::date AS day),
      start AS (SELECT ((SELECT today FROM t) - ($1::int - 1))::timestamp AT TIME ZONE 'Europe/Berlin' AS ts),
      r AS (SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS day, count(*)::int AS n
              FROM users WHERE role <> 'admin' AND created_at >= (SELECT ts FROM start) GROUP BY 1),
      o AS (SELECT (paid_at AT TIME ZONE 'Europe/Berlin')::date AS day, count(*)::int AS n,
                   coalesce(sum(CASE WHEN status IN ('withdrawn', 'refunded') THEN 0 ELSE amount_cents END), 0)::int AS cents
              FROM orders WHERE paid_at IS NOT NULL AND paid_at >= (SELECT ts FROM start) GROUP BY 1),
      v AS (SELECT (redeemed_at AT TIME ZONE 'Europe/Berlin')::date AS day, count(*)::int AS n
              FROM voucher_redemptions WHERE redeemed_at >= (SELECT ts FROM start) GROUP BY 1),
      e AS (SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS day,
                   count(*) FILTER (WHERE kind = 'pdf')::int AS pdf_server,
                   count(*) FILTER (WHERE kind = 'pdf_local')::int AS pdf_browser,
                   count(*) FILTER (WHERE kind = 'docx')::int AS docx
              FROM events WHERE created_at >= (SELECT ts FROM start) AND kind IN ('pdf', 'pdf_local', 'docx') GROUP BY 1)
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
             coalesce(r.n, 0) AS registrations,
             coalesce(o.n, 0) AS purchases,
             coalesce(o.cents, 0) AS revenue_cents,
             coalesce(v.n, 0) AS vouchers,
             coalesce(e.pdf_server, 0) AS pdf_server,
             coalesce(e.pdf_browser, 0) AS pdf_browser,
             coalesce(e.docx, 0) AS docx
        FROM d LEFT JOIN r USING (day) LEFT JOIN o USING (day) LEFT JOIN v USING (day) LEFT JOIN e USING (day)
       ORDER BY d.day`, [days]);
    return { asOf: new Date().toISOString(), days, series: rows };
  }

  async function usage(days) {
    await deps.stats?.flush?.();
    const rows = await all(`
      SELECT metric, dim, value, sum(n)::int AS n FROM usage_daily
       WHERE day > (now() AT TIME ZONE 'Europe/Berlin')::date - $1::int
       GROUP BY metric, dim, value ORDER BY metric, dim, n DESC`, [days]);
    const since = await one(`SELECT to_char(min(day), 'YYYY-MM-DD') AS d FROM usage_daily`);
    const metrics = {};
    for (const r of rows) {
      const m = metrics[r.metric] ||= { total: 0, dims: {} };
      if (r.dim === 'all') m.total = r.n;
      else (m.dims[r.dim] ||= []).push({ value: r.value, n: r.n, label: r.dim === 'route' ? (ROUTE_LABELS[r.value] || null) : null });
    }
    const profiles = await one(`SELECT count(*)::int AS n FROM resumes`);
    const dist = async (expr) => all(`SELECT coalesce(${expr}, '–') AS value, count(*)::int AS n FROM resumes GROUP BY 1 ORDER BY 2 DESC LIMIT 40`);
    return {
      asOf: new Date().toISOString(),
      days,
      countingSince: since?.d || null,
      metrics,
      profiles: {
        total: profiles.n,
        template: await dist(`payload->'settings'->>'template'`),
        lang: await dist(`payload->'settings'->>'lang'`),
        pageMode: await dist(`payload->'settings'->>'pageMode'`),
        pageFormat: await dist(`payload->'settings'->>'pageFormat'`),
      },
      umamiUrl: cfg.umamiUrl,
    };
  }

  async function funnel(days) {
    const r = await one(`
      SELECT count(*)::int AS registered,
             count(*) FILTER (WHERE signup_source IS DISTINCT FROM 'self' OR email_confirmed_at IS NOT NULL)::int AS confirmed,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM resumes r WHERE r.user_id = u.id))::int AS with_resume,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL))::int AS paid,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM voucher_redemptions v WHERE v.user_id = u.id))::int AS voucher,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL)
                                 OR EXISTS (SELECT 1 FROM voucher_redemptions v WHERE v.user_id = u.id))::int AS converted
        FROM users u
       WHERE u.role <> 'admin' AND u.created_at > now() - make_interval(days => $1::int)`, [days]);
    return { asOf: new Date().toISOString(), days, ...r };
  }

  function likeArg(q) { return `%${q.replace(/[\\%_]/g, m => `\\${m}`)}%`; }

  async function customers(q, offset) {
    const s = String(q || '').trim().slice(0, 120);
    const rows = await all(`
      SELECT u.id, u.username, u.email, u.pending_email, u.role, u.disabled, u.created_at, u.last_seen_at, u.access_until, u.plan_kind,
             u.signup_source, (u.signup_source IS DISTINCT FROM 'self' OR u.email_confirmed_at IS NOT NULL) AS email_confirmed,
             (SELECT count(*)::int FROM resumes r WHERE r.user_id = u.id) AS resumes,
             (SELECT count(*)::int FROM orders o WHERE o.user_id = u.id AND o.paid_at IS NOT NULL) AS paid_orders
        FROM users u
       WHERE ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2 OR u.pending_email ILIKE $2 OR u.id::text = $1)
       ORDER BY u.created_at DESC LIMIT 50 OFFSET $3`, [s, likeArg(s), Math.max(0, Math.min(100_000, Number(offset) || 0))]);
    const total = await one(`SELECT count(*)::int AS n FROM users u
       WHERE ($1 = '' OR u.username ILIKE $2 OR u.email ILIKE $2 OR u.pending_email ILIKE $2 OR u.id::text = $1)`, [s, likeArg(s)]);
    return { asOf: new Date().toISOString(), q: s, total: total.n, customers: rows };
  }

  function orderView(o) {
    return {
      id: o.id, orderNo: o.order_no, status: o.status, createdAt: o.created_at, paidAt: o.paid_at, amountCents: o.amount_cents,
      currency: o.currency, country: o.country, invoiceNo: o.invoice_no, passDays: o.pass_days, passFrom: o.pass_from, passUntil: o.pass_until,
      molliePaymentId: o.mollie_payment_id, refundStatus: o.refund_status, refundAttempts: o.refund_attempts, withdrawnAt: o.withdrawn_at,
      cancelledAt: o.cancelled_at, cancelEffectiveAt: o.cancel_effective_at, userId: o.user_id, email: o.email, billingName: o.billing_name,
      method: o.method ?? null,
      // P6: Stornobeleg nach Widerruf (Nummer; gespeichert oder beim ersten Abruf erzeugt).
      creditNoteNo: ['withdrawn', 'refunded'].includes(o.status) && o.invoice_no ? (o.storno_no || `${o.invoice_no}-S`) : null,
      consumerConfirmed: o.consumer_confirmed ?? null,
    };
  }

  async function customerDetail(id) {
    const u = await one(`SELECT * FROM users WHERE id = $1`, [id]);
    if (!u) return null;
    const account = {
      id: u.id, username: u.username, email: u.email, pendingEmail: u.pending_email, role: u.role, disabled: u.disabled,
      createdAt: u.created_at, lastSeenAt: u.last_seen_at, accessUntil: u.access_until, planKind: u.plan_kind,
      signupSource: u.signup_source, emailConfirmed: u.signup_source !== 'self' || !!u.email_confirmed_at, emailConfirmedAt: u.email_confirmed_at,
      twofaEnabled: !!u.twofa_enabled, passwordChangedAt: u.password_changed_at, ageConfirmed16At: u.age_confirmed_16_at,
      // P8/P9: AGB-Fassung bei der Registrierung, Einwilligung Art. 9 DSGVO.
      termsAcceptedVersion: u.terms_accepted_version ?? null, termsAcceptedAt: u.terms_accepted_at ?? null,
      art9ConsentAt: u.art9_consent_at ?? null, art9ConsentVersion: u.art9_consent_version ?? null, art9WithdrawnAt: u.art9_withdrawn_at ?? null,
    };
    const [grants, orders, vouchers, logins, counts, invite] = await Promise.all([
      all(`SELECT g.id, g.source, g.source_id, g.kind, g.days, g.until_at, g.ends_at, g.granted_at, g.revoked_at, g.revoke_reason,
                  g.effective_from, g.effective_until, cu.username AS created_by
             FROM access_grants g LEFT JOIN users cu ON cu.id = g.created_by
            WHERE g.user_id = $1 ORDER BY g.granted_at DESC, g.id DESC`, [id]),
      all(`SELECT o.*, pi.method FROM orders o LEFT JOIN order_payment_info pi ON pi.order_id = o.id WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT 50`, [id]),
      all(`SELECT r.redeemed_at, r.kind, r.days, r.granted_until, v.name AS voucher, v.distribution, c.name AS campaign
             FROM voucher_redemptions r JOIN vouchers v ON v.id = r.voucher_id LEFT JOIN voucher_campaigns c ON c.id = r.campaign_id
            WHERE r.user_id = $1 ORDER BY r.redeemed_at DESC`, [id]),
      all(`SELECT created_at FROM events WHERE user_id = $1 AND kind = 'login' ORDER BY created_at DESC LIMIT 10`, [id]),
      one(`SELECT (SELECT count(*)::int FROM resumes WHERE user_id = $1) AS resumes,
                  (SELECT count(*)::int FROM resume_versions WHERE user_id = $1) AS versions,
                  (SELECT count(*)::int FROM photos WHERE user_id = $1) AS photos,
                  (SELECT count(*)::int FROM share_links WHERE created_by = $1 AND NOT revoked) AS shares,
                  (SELECT count(*)::int FROM api_keys WHERE user_id = $1 AND NOT revoked) AS api_keys,
                  (SELECT count(*)::int FROM oauth_tokens WHERE user_id = $1 AND NOT revoked) AS connections`, [id]),
      one(`SELECT code FROM invite_redemptions WHERE user_id = $1 ORDER BY redeemed_at LIMIT 1`, [id]),
    ]);
    let plan = null;
    try { plan = await planDetails(pool, u); } catch { /* Anzeige ohne Plan */ }
    return {
      asOf: new Date().toISOString(),
      account, plan, inviteCode: invite?.code ?? null,
      grants, orders: orders.map(orderView), vouchers, logins: logins.map(l => l.created_at), counts,
    };
  }

  /** Zahlungsart einmal bei Mollie nachlesen und merken. Höchstens `limit`
   *  Abfragen je Aufruf, damit ein Export nicht minutenlang hängt. */
  const mollie = deps.billingConfig?.mollieKey ? createMollie({ apiKey: deps.billingConfig.mollieKey, base: deps.billingConfig.mollieBase }) : null;
  async function fillMethods(orders, limit = 25) {
    if (!mollie) return;
    let left = limit;
    for (const o of orders) {
      if (o.method || !o.mollie_payment_id || !o.paid_at || left <= 0) continue;
      left -= 1;
      try {
        const p = await mollie.getPayment(o.mollie_payment_id);
        const method = typeof p?.method === 'string' ? p.method.slice(0, 40) : null;
        await pool.query(
          `INSERT INTO order_payment_info (order_id, method) VALUES ($1, $2) ON CONFLICT (order_id) DO UPDATE SET method = EXCLUDED.method, fetched_at = now()`,
          [o.id, method],
        );
        o.method = method;
      } catch (err) {
        log(`admin: Zahlungsart für ${o.id} nicht gelesen (${err?.message || err})`);
      }
    }
  }

  async function payments(status) {
    const st = String(status || '');
    const rows = await all(`
      SELECT o.*, pi.method FROM orders o LEFT JOIN order_payment_info pi ON pi.order_id = o.id
       WHERE ($1 = '' OR o.status = $1)
       ORDER BY o.created_at DESC LIMIT 300`, [Object.hasOwn(STATUS_DE, st) ? st : '']);
    const paidNoAccess = await all(`
      SELECT o.id, o.order_no, o.user_id, o.paid_at, o.status FROM orders o
       WHERE o.paid_at IS NOT NULL AND o.status = 'paid' AND o.user_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM access_grants g WHERE g.source = 'order' AND g.source_id = o.id::text)
       ORDER BY o.paid_at DESC LIMIT 100`);
    const accessNotPaid = await all(`
      SELECT g.id AS grant_id, g.user_id, g.source_id, g.granted_at, o.order_no, o.status
        FROM access_grants g LEFT JOIN orders o ON o.id::text = g.source_id
       WHERE g.source = 'order' AND g.revoked_at IS NULL
         AND (o.id IS NULL OR o.paid_at IS NULL OR o.status NOT IN ('paid'))
       ORDER BY g.granted_at DESC LIMIT 100`);
    const counts = await all(`SELECT status, count(*)::int AS n FROM orders GROUP BY status ORDER BY status`);
    return {
      asOf: new Date().toISOString(),
      payments: rows.map(orderView),
      counts,
      reconcile: { paidNoAccess, accessNotPaid },
      mollieMode: deps.billingConfig?.mollieKey ? (/^live_/.test(deps.billingConfig.mollieKey) ? 'live' : 'test') : null,
    };
  }

  function berlinRange(year, month) {
    const y = Number(year);
    const m = month ? Number(month) : null;
    if (!Number.isInteger(y) || y < 2020 || y > 2100) return null;
    if (m !== null && (!Number.isInteger(m) || m < 1 || m > 12)) return null;
    return { y, m };
  }

  async function invoiceRows(range) {
    const args = [];
    let where = 'o.invoice_no IS NOT NULL';
    if (range) {
      args.push(range.y);
      where += ` AND extract(year FROM o.paid_at AT TIME ZONE 'Europe/Berlin') = $${args.length}`;
      if (range.m) {
        args.push(range.m);
        where += ` AND extract(month FROM o.paid_at AT TIME ZONE 'Europe/Berlin') = $${args.length}`;
      }
    }
    return all(`SELECT o.*, pi.method, sd.doc_no AS storno_no, sd.issued_at AS storno_issued_at
                  FROM orders o LEFT JOIN order_payment_info pi ON pi.order_id = o.id
                  LEFT JOIN invoice_documents sd ON sd.order_id = o.id AND sd.kind = 'storno'
                 WHERE ${where} ORDER BY o.paid_at, o.invoice_no`, args);
  }

  async function invoices(range) {
    const rows = await invoiceRows(range);
    const allNos = await all(`SELECT invoice_no FROM orders WHERE invoice_no IS NOT NULL`);
    const counters = await all(`SELECT year, last FROM invoice_counters ORDER BY year DESC`);
    const years = await all(`SELECT DISTINCT extract(year FROM paid_at AT TIME ZONE 'Europe/Berlin')::int AS y FROM orders WHERE invoice_no IS NOT NULL ORDER BY 1 DESC`);
    return {
      asOf: new Date().toISOString(),
      invoices: rows.map(orderView),
      sumCents: rows.reduce((s, o) => s + (['withdrawn', 'refunded'].includes(o.status) ? 0 : o.amount_cents), 0),
      gaps: invoiceGaps(allNos.map(r => r.invoice_no), counters),
      years: years.map(r => r.y),
    };
  }

  async function systemStatus() {
    const sys = deps.systemInfo ? deps.systemInfo() : {};
    const bc = deps.billingConfig || {};
    const missing = [];
    const want = (cond, name, why) => { if (!cond) missing.push({ name, why }); };
    want(process.env.JWT_SECRET, 'JWT_SECRET', 'Sitzungen');
    want(process.env.DATABASE_URL, 'DATABASE_URL', 'Datenbank');
    want(deps.mailConfigured, 'SMTP_HOST / SMTP_USER / SMTP_PASS', 'Mailversand, Admin-Anmeldung');
    want(cfg.email, 'ADMIN_EMAIL', 'Ziel der Admin-Codes und Testmails');
    want(process.env.TRUST_PROXY, 'TRUST_PROXY', 'echte Besucheradresse hinter dem Proxy');
    want(cfg.separate, 'ADMIN_HOST', 'Admin-Bereich auf eigener Adresse');
    want(process.env.ADMIN_URL, 'ADMIN_URL', 'Link „Admin-Bereich öffnen“ in der App');
    return {
      asOf: new Date().toISOString(),
      admin: {
        mode: cfg.separate ? 'separate' : 'legacy', host: cfg.host || null, origin: cfg.origin, url: cfg.url,
        allowedIps: cfg.allowedIps.map(n => n.text), invalidIps: cfg.invalidIps, email: cfg.email ? maskEmail(cfg.email) : null,
        sessionHours: ADMIN_SESSION_HOURS, idleMinutes: ADMIN_IDLE_MINUTES,
      },
      missing,
      billing: {
        enabled: !!bc.enabled, ready: !!bc.ready, missing: bc.missing || [],
        mollieMode: bc.mollieKey ? (/^live_/.test(bc.mollieKey) ? 'live' : 'test') : null,
        priceCents: bc.priceCents ?? null, days: bc.days ?? null, freeTierLimits: !!bc.freeTierLimits,
        euB2cStopCents: bc.euB2cStopCents ?? null,
      },
      // P5: wirksame Fassungen der Vertragstexte (Quelle: Datei oder Übersteuerung per Umgebung).
      legal: sys.legal || null,
      registration: sys.registration || null,
      mail: { configured: !!deps.mailConfigured },
      umamiUrl: cfg.umamiUrl,
      version: sys.version || null,
      nodeEnv: process.env.NODE_ENV || null,
      trustProxy: !!process.env.TRUST_PROXY,
      janitor: { ...janitorState },
    };
  }

  /* ── Routen ────────────────────────────────────────────────────────── */

  function mount(app) {
    const { rateLimit, subnetLimit } = deps;
    const loginLimit = rateLimit({ route: 'admin-login', max: 5, windowMs: 15 * 60 * 1000 });
    const loginNet = subnetLimit({ route: 'admin-login', max: 20, windowMs: 15 * 60 * 1000 });
    const verifyLimit = rateLimit({ route: 'admin-verify', max: 20, windowMs: 15 * 60 * 1000 });

    // Stand der Anmeldung. Ohne Anmeldung nur Modus und „nein“.
    app.get('/api/admin/auth/session', async (req, res) => {
      const s = await sessionFromCookie(req);
      let user = s?.user || null;
      let via = s ? 'admin-session' : null;
      if (!user && req.adminScope === 'legacy') {
        const u = await deps.loadUser(req);
        if (u?.role === 'admin') { user = u; via = 'app-session'; }
      }
      if (!user) return res.json({ mode: req.adminScope, authenticated: false, mailReady: !!deps.mailConfigured });
      res.json({
        mode: req.adminScope, authenticated: true, via,
        user: { id: user.id, username: user.username },
        expiresAt: s?.session?.expiresAt ?? null, idleMinutes: ADMIN_IDLE_MINUTES,
        mainUrl: deps.publicBaseUrl ? deps.publicBaseUrl(req) || null : null,
        umamiUrl: cfg.umamiUrl,
      });
    });

    app.post('/api/admin/auth/login', loginLimit, loginNet, async (req, res) => {
      const username = String(req.body?.username || '').trim().slice(0, 200);
      const password = String(req.body?.password || '');
      const { rows } = username.includes('@')
        ? await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [username])
        : await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
      const user = rows[0];
      const acctKey = user ? `admin-login:acct:${user.id}` : `admin-login:name:${username.toLowerCase()}`;
      const blocked = deps.bucketBlocked(acctKey, 10);
      if (blocked) {
        res.setHeader('Retry-After', blocked);
        return res.status(429).json({ error: `Zu viele Fehlversuche. Bitte ${blocked}s warten.`, code: 'account_locked' });
      }
      const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
      if (!user || !ok || user.role !== 'admin' || user.disabled) {
        deps.bucketHit(acctKey, 60 * 60 * 1000);
        await auditWrite({ adminId: null, action: 'admin_login_failed', target: null, details: null, req });
        return res.status(401).json({ error: 'Anmeldung fehlgeschlagen.' });
      }
      const dest = cfg.email || user.email;
      if (!dest || !deps.mailConfigured) {
        return res.status(503).json({ error: 'Für die Admin-Anmeldung braucht der Dienst Mailversand und ADMIN_EMAIL.', code: 'mail_missing' });
      }
      const challenge = crypto.randomBytes(24).toString('hex');
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      await pool.query(
        'INSERT INTO admin_login_codes (challenge, user_id, code_hash, expires_at) VALUES ($1, $2, $3, now() + interval \'10 minutes\')',
        [challenge, user.id, sha256(code)],
      );
      const sent = await deps.sendMail({ to: dest, ...tplAdminLoginCode({ code, host: cfg.host || normHost(req.headers.host) }) });
      if (!sent) return res.status(502).json({ error: 'Der Code ließ sich nicht verschicken. Bitte gleich noch einmal.' });
      res.json({ challenge, sentTo: maskEmail(dest) });
    });

    app.post('/api/admin/auth/verify', verifyLimit, async (req, res) => {
      const challenge = String(req.body?.challenge || '').trim();
      const code = String(req.body?.code || '').trim();
      if (!/^[0-9a-f]{48}$/.test(challenge) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Code muss sechsstellig sein.' });
      const client = await pool.connect();
      let userId;
      try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT * FROM admin_login_codes WHERE challenge = $1 FOR UPDATE', [challenge]);
        const lc = rows[0];
        if (!lc || lc.used || new Date(lc.expires_at) < new Date()) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Code ungültig oder abgelaufen. Bitte neu anmelden.' });
        }
        if (lc.attempts >= 5) {
          await client.query('UPDATE admin_login_codes SET used = true WHERE challenge = $1', [challenge]);
          await client.query('COMMIT');
          return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte neu anmelden.' });
        }
        if (!crypto.timingSafeEqual(Buffer.from(lc.code_hash), Buffer.from(sha256(code)))) {
          await client.query('UPDATE admin_login_codes SET attempts = attempts + 1 WHERE challenge = $1', [challenge]);
          await client.query('COMMIT');
          await auditWrite({ adminId: lc.user_id, action: 'admin_code_failed', target: null, details: null, req });
          return res.status(401).json({ error: 'Code falsch.' });
        }
        await client.query('UPDATE admin_login_codes SET used = true WHERE user_id = $1 AND NOT used', [lc.user_id]);
        await client.query('COMMIT');
        userId = lc.user_id;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      const user = await one('SELECT * FROM users WHERE id = $1', [userId]);
      if (!user || user.role !== 'admin' || user.disabled) return res.status(403).json({ error: 'Kein Admin-Konto.' });
      const expiresAt = await issueSession(req, res, user);
      await auditWrite({ adminId: user.id, action: 'admin_login', target: null, details: null, req });
      res.json({ ok: true, user: { id: user.id, username: user.username }, expiresAt, idleMinutes: ADMIN_IDLE_MINUTES });
    });

    app.post('/api/admin/auth/logout', async (req, res) => {
      const token = req.cookies?.[ADMIN_COOKIE];
      if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        const { rows } = await pool.query(
          'UPDATE admin_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL RETURNING user_id',
          [sha256(token)],
        );
        if (rows[0]) await auditWrite({ adminId: rows[0].user_id, action: 'admin_logout', target: null, details: null, req });
      }
      clearCookie(res);
      res.json({ ok: true });
    });

    /* ── Lesen ──────────────────────────────────────────────────────── */

    app.get('/api/admin/overview', ...guard, async (_req, res) => res.json(await overview()));
    app.get('/api/admin/timeseries', ...guard, async (req, res) => res.json(await timeseries(rangeOf(req))));
    app.get('/api/admin/usage', ...guard, async (req, res) => res.json(await usage(rangeOf(req))));
    app.get('/api/admin/funnel', ...guard, async (req, res) => res.json(await funnel(rangeOf(req))));
    // Lesende Zugriffe auf Personendaten werden protokolliert (Audit S10).
    app.get('/api/admin/customers', ...guard, async (req, res) => {
      const r = await customers(req.query.q, req.query.offset);
      res.locals.audit = { action: 'customer_search', target: req.query.q ? 'suche' : 'liste', details: { n: r?.customers?.length ?? null } };
      res.json(r);
    });

    app.get('/api/admin/customers/:id', ...guard, async (req, res) => {
      const id = Number.parseInt(String(req.params.id), 10);
      if (!Number.isInteger(id) || id < 1) return res.status(404).json({ error: 'Nicht gefunden.' });
      const d = await customerDetail(id);
      if (!d) return res.status(404).json({ error: 'Nicht gefunden.' });
      res.locals.audit = { action: 'customer_view', target: id };
      res.json(d);
    });

    app.get('/api/admin/payments', ...guard, async (req, res) => { res.locals.audit = { action: 'payments_view', target: null }; res.json(await payments(req.query.status)); });

    app.get('/api/admin/invoices', ...guard, async (req, res) => {
      const range = req.query.year ? berlinRange(req.query.year, req.query.month) : null;
      if (req.query.year && !range) return res.status(400).json({ error: 'Jahr/Monat ungültig.' });
      res.json(await invoices(range));
    });

    app.get('/api/admin/invoices.csv', ...guard, async (req, res) => {
      const range = berlinRange(req.query.year, req.query.month);
      if (!range) return res.status(400).json({ error: 'Bitte Jahr (und optional Monat) angeben.' });
      const rows = await invoiceRows(range);
      await fillMethods(rows);
      const name = `Rechnungen-${range.y}${range.m ? `-${String(range.m).padStart(2, '0')}` : ''}.csv`;
      res.locals.audit = { action: 'invoices_csv', target: name.replace(/\.csv$/, ''), details: { rows: rows.length } };
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
      res.send(invoicesCsv(rows));
    });

    app.get('/api/admin/declarations', ...guard, async (req, res) => {
      const st = String(req.query.status || '');
      const rows = await all(`
        SELECT id, type, channel, name, email, order_no, user_id, received_at, status, note, resolved_at, confirmed_at, statement
          FROM declarations WHERE ($1 = '' OR status = $1)
         ORDER BY (status = 'manual') DESC, received_at DESC LIMIT 200`, [['manual', 'done', 'processed', 'pending_confirmation'].includes(st) ? st : '']);
      res.locals.audit = { action: 'declarations_view', target: st || null, details: { n: rows.length } };
      res.json({ asOf: new Date().toISOString(), declarations: rows });
    });

    app.get('/api/admin/system', ...guard, async (_req, res) => res.json(await systemStatus()));

    app.get('/api/admin/audit', ...guard, async (req, res) => {
      const before = Number.parseInt(String(req.query.before || ''), 10);
      const rows = await all(`
        SELECT a.id, a.created_at, a.action, a.target, a.details, a.ip_net, a.via, u.username AS admin
          FROM admin_audit a LEFT JOIN users u ON u.id = a.admin_id
         WHERE ($1::int IS NULL OR a.id < $1)
         ORDER BY a.id DESC LIMIT 100`, [Number.isInteger(before) ? before : null]);
      res.json({ asOf: new Date().toISOString(), entries: rows, retentionDays: 365 });
    });

    /* ── Handeln ────────────────────────────────────────────────────── */

    const idParam = req => {
      const id = Number.parseInt(String(req.params.id), 10);
      return Number.isInteger(id) && id > 0 ? id : null;
    };
    async function target(req, res) {
      const id = idParam(req);
      const u = id ? await one('SELECT * FROM users WHERE id = $1', [id]) : null;
      if (!u) { res.status(404).json({ error: 'Nutzer nicht gefunden.' }); return null; }
      return u;
    }

    // Pass gewähren oder verlängern. Grund ist Pflicht und steht im Protokoll.
    app.post('/api/admin/customers/:id/grant', ...guard, async (req, res) => {
      const u = await target(req, res);
      if (!u) return;
      if (u.role === 'admin') return res.status(400).json({ error: 'Admin-Konten haben keine Laufzeit.' });
      const reason = String(req.body?.reason || '').trim().slice(0, 300);
      if (reason.length < 3) return res.status(400).json({ error: 'Bitte einen Grund angeben.', code: 'reason_required' });
      let grant;
      if (req.body?.days !== undefined) {
        const days = Number.parseInt(String(req.body.days), 10);
        if (!Number.isInteger(days) || days < 1 || days > MAX_ACCESS_DAYS) return res.status(400).json({ error: `1 bis ${MAX_ACCESS_DAYS} Tage.` });
        if (u.plan_kind === 'lifetime') return res.status(409).json({ error: 'Dieses Konto hat einen dauerhaften Gratiszugang.' });
        grant = { source: 'admin', kind: 'days', days, createdBy: req.user.id };
      } else if (Object.hasOwn(req.body || {}, 'until')) {
        let until = null;
        if (req.body.until !== null && req.body.until !== '') {
          const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(req.body.until));
          const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + 1)) : null;
          if (!d || Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Enddatum im Format JJJJ-MM-TT.' });
          until = d;
        }
        grant = { source: 'admin', kind: 'set', untilAt: until, createdBy: req.user.id };
      } else {
        return res.status(400).json({ error: 'Erwartet: { days } oder { until }.' });
      }
      const client = await pool.connect();
      let accessUntil;
      try {
        await client.query('BEGIN');
        await addGrant(client, u.id, grant);
        accessUntil = (await client.query('SELECT access_until FROM users WHERE id = $1', [u.id])).rows[0].access_until;
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      res.locals.audit = { action: 'customer_grant', target: u.id, details: { days: grant.days ?? null, until: grant.kind === 'set' ? grant.untilAt : undefined, reason, accessUntil } };
      res.json({ ok: true, accessUntil });
    });

    app.post('/api/admin/customers/:id/disable', ...guard, async (req, res) => {
      const u = await target(req, res);
      if (!u) return;
      if (u.id === req.user.id || u.role === 'admin') return res.status(400).json({ error: 'Admin-Konten lassen sich hier nicht sperren.' });
      const disabled = !!req.body?.disabled;
      await pool.query('UPDATE users SET disabled = $1 WHERE id = $2', [disabled, u.id]);
      res.locals.audit = { action: disabled ? 'customer_disable' : 'customer_enable', target: u.id };
      res.json({ ok: true, disabled });
      if (disabled && u.email && deps.tplOffboarding) deps.sendMail({ to: u.email, ...deps.tplOffboarding({ username: u.username, deleted: false }) });
    });

    app.post('/api/admin/customers/:id/password-reset-mail', ...guard, async (req, res) => {
      const u = await target(req, res);
      if (!u) return;
      if (!u.email) return res.status(409).json({ error: 'Im Konto ist keine E-Mail-Adresse hinterlegt.' });
      const r = await deps.issuePasswordReset(u);
      if (!r.ok) return res.status(r.status || 503).json({ error: r.error || 'Mail nicht verschickt.' });
      res.locals.audit = { action: 'customer_password_reset_mail', target: u.id };
      res.json({ ok: true });
    });

    app.post('/api/admin/customers/:id/resend-confirmation', ...guard, async (req, res) => {
      const u = await target(req, res);
      if (!u) return;
      if (!u.email) return res.status(409).json({ error: 'Im Konto ist keine E-Mail-Adresse hinterlegt.' });
      if (u.signup_source !== 'self' || u.email_confirmed_at) return res.status(409).json({ error: 'Die Adresse ist schon bestätigt.' });
      const base = deps.publicBaseUrl(req);
      if (!base) return res.status(503).json({ error: 'PUBLIC_BASE_URL fehlt, ohne sie gibt es keinen Link.' });
      const sent = await deps.issueEmailConfirmation(u, base);
      res.locals.audit = { action: 'customer_resend_confirmation', target: u.id };
      res.json({ ok: true, sent: !!sent });
    });

    // Alle Anmeldungen beenden (Sitzungen, offene Login-Codes); auf Wunsch
    // auch API-Schlüssel und KI-Verbindungen. Das Passwort bleibt.
    app.post('/api/admin/customers/:id/end-sessions', ...guard, async (req, res) => {
      const u = await target(req, res);
      if (!u) return;
      if (u.role === 'admin') return res.status(400).json({ error: 'Für Admin-Konten: ADMIN_PASSWORD ändern.' });
      const includeKeys = !!req.body?.includeKeys;
      const client = await pool.connect();
      let revoked = { apiKeys: 0, connections: 0 };
      try {
        await client.query('BEGIN');
        // Die Passwortmarke wandert weiter, damit enden alle Cookie-Sitzungen.
        await client.query('UPDATE users SET password_changed_at = now() WHERE id = $1', [u.id]);
        await client.query('UPDATE login_codes SET used = true WHERE user_id = $1 AND NOT used', [u.id]);
        if (includeKeys) revoked = await deps.revokeAllCredentials(client, u.id);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      res.locals.audit = { action: 'customer_end_sessions', target: u.id, details: { includeKeys, ...revoked } };
      res.json({ ok: true, revoked });
    });

    // Löschen: nur mit eingetipptem Nutzernamen. Gebaut, nicht ausgeführt.
    app.post('/api/admin/customers/:id/delete', ...guard, async (req, res) => {
      const u = await target(req, res);
      if (!u) return;
      if (u.role === 'admin') return res.status(400).json({ error: 'Admin-Konten lassen sich nicht löschen.' });
      if (String(req.body?.confirmUsername ?? '') !== u.username) {
        return res.status(400).json({ error: 'Zur Bestätigung den Nutzernamen genau so eintippen.', code: 'confirm_mismatch' });
      }
      const r = await deps.deleteAccount(u);
      res.locals.audit = { action: 'customer_delete', target: u.id, details: { retainedOrders: r.retainedOrders } };
      res.json({ ok: true, retainedOrders: r.retainedOrders });
      // Die Person erfährt es, wie beim Löschen über die App.
      if (u.email && deps.tplOffboarding) deps.sendMail({ to: u.email, ...deps.tplOffboarding({ username: u.username, deleted: true, retainedOrders: r.retainedOrders }) });
    });

    app.post('/api/admin/payments/:id/sync', ...guard, async (req, res) => {
      if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Nicht gefunden.' });
      const o = await one('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      if (!o) return res.status(404).json({ error: 'Nicht gefunden.' });
      if (!o.mollie_payment_id || !mollie) return res.status(409).json({ error: 'Keine Mollie-Zahlung zum Abgleichen.' });
      try {
        const r = await deps.billing.syncOrder(o);
        res.locals.audit = { action: 'payment_sync', target: o.order_no, details: { changed: !!r?.changed, mismatch: !!r?.mismatch } };
        res.json({ ok: true, changed: !!r?.changed, mismatch: !!r?.mismatch });
      } catch (err) {
        log(`admin: Abgleich ${o.id} fehlgeschlagen (${err?.message || err})`);
        res.status(502).json({ error: 'Mollie hat nicht geantwortet.' });
      }
    });

    // Erstattung erneut anstoßen: nur für widerrufene Bestellungen ohne
    // Erstattungs-ID (billing.js requestRefund, idempotent). Alles andere
    // geht über das Mollie-Dashboard.
    app.post('/api/admin/payments/:id/refund-retry', ...guard, async (req, res) => {
      if (!UUID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Nicht gefunden.' });
      const o = await one('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      if (!o) return res.status(404).json({ error: 'Nicht gefunden.' });
      if (o.status !== 'withdrawn' || o.refund_id) return res.status(409).json({ error: 'Hier gibt es nichts neu anzustoßen. Für andere Erstattungen bitte das Mollie-Dashboard.' });
      const st = await deps.billing.requestRefund(o.id);
      res.locals.audit = { action: 'refund_retry', target: o.order_no, details: { status: st } };
      res.json({ ok: true, status: st });
    });

    app.post('/api/admin/system/test-mail', ...guard, rateLimit({ route: 'admin-testmail', max: 5, windowMs: 60 * 60 * 1000 }), async (req, res) => {
      const to = cfg.email || req.user.email;
      if (!to) return res.status(409).json({ error: 'ADMIN_EMAIL fehlt.' });
      const ok = await deps.sendMail({ to, ...tplAdminTest({ host: cfg.host || normHost(req.headers.host) }) });
      res.locals.audit = { action: 'test_mail', target: null, details: { ok } };
      res.status(ok ? 200 : 502).json({ ok, to: maskEmail(to) });
    });
  }

  return { gate, authenticate, needAdmin, mount, isAdminHost, sessionFromCookie, auditWrite, config: cfg };
}
