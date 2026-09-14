// cv-api — CV-Tool backend
// Invite-only auth (username + password), résumé storage, admin, PDF rendering.

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { chromium } from 'playwright';
import { isPdfFetchAllowed } from './ssrf.js';
import { pool, initDb, logEvent } from './db.js';
import { cvToMarkdown, markdownToCV, clToMarkdown, markdownToCl } from './markdown.js';
import { sendMail, mailConfigured, tplInvite, tplWelcome, tplPasswordReset, tplPasswordChanged, tplOffboarding, tplLoginCode, tplAccessRequest } from './mail.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_VERSIONS_PER_RESUME = 25;

/**
 * Snapshot the *current* payload of a resume before mutating it. Call this
 * inside any endpoint that overwrites resumes.payload. Best-effort: failures
 * are logged but do not block the write — the user's edit takes priority.
 */
async function snapshotResume(resumeId, userId, source) {
  try {
    const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [resumeId, userId]);
    if (!rows[0]) return; // first save, nothing to snapshot
    await pool.query(
      'INSERT INTO resume_versions (resume_id, user_id, payload, source) VALUES ($1, $2, $3, $4)',
      [resumeId, userId, rows[0].payload, source],
    );
    // Keep only the N most-recent versions per resume to bound storage.
    await pool.query(
      `DELETE FROM resume_versions WHERE id IN (
         SELECT id FROM resume_versions WHERE resume_id = $1
         ORDER BY created_at DESC OFFSET $2
       )`,
      [resumeId, MAX_VERSIONS_PER_RESUME],
    );
  } catch (err) {
    console.error('snapshotResume failed:', err?.message || err);
  }
}

// Fail-closed in production: a missing JWT_SECRET silently rotated on every
// redeploy is a footgun (sessions invalidate, attacker behind a forgotten
// staging deploy could brute-force a 32-byte random more easily than a
// strong env-set secret). In dev we still allow the random fallback so
// local hacking stays frictionless. (Security audit finding #11.)
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET env var is required in production.');
    process.exit(1);
  }
  console.warn('JWT_SECRET not set — using random fallback (dev only). Sessions reset on every redeploy.');
}
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE = 'cv_session';
const SESSION_DAYS = 30;

// ── In-memory rate limiter ──────────────────────────────────────────────────
// Cheap protection against brute-force on login + abusive registration. Keys
// the bucket on (route, client-IP). Resets the count when the window elapses.
// Not a replacement for Redis or a WAF, but enough to make casual abuse
// expensive — the next attacker would need a botnet.
const rateBuckets = new Map();
function rateLimit({ route, max, windowMs }) {
  return (req, res, next) => {
    // req.ip wird von Express aus 'trust proxy' abgeleitet (rechter, vom
    // vertrauten Proxy gesetzter Hop) und ist NICHT client-spoofbar. Den rohen
    // X-Forwarded-For-Header direkt zu lesen (linker Wert) hebelte das Rate-
    // Limiting komplett aus. (Security-Review-Finding #1.)
    const ip = (req.ip || 'unknown').toString();
    const key = `${route}:${ip}`;
    const now = Date.now();
    const b = rateBuckets.get(key);
    if (!b || b.reset < now) {
      rateBuckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }
    if (b.count >= max) {
      const retry = Math.ceil((b.reset - now) / 1000);
      res.setHeader('Retry-After', retry);
      return res.status(429).json({ error: `Zu viele Versuche. Bitte ${retry}s warten.` });
    }
    b.count += 1;
    next();
  };
}
// Janitor — purge stale entries every 5min so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (v.reset < now) rateBuckets.delete(k);
}, 5 * 60 * 1000).unref?.();

// Muss mit app/src/templates/theme.ts (THEMES) synchron bleiben — Quelle der
// Wahrheit ist theme.ts; diese Liste bedient /api/templates + MCP list_templates.
const TEMPLATES = [
  { id: 'hamburg', name: 'Hamburg', category: 'klassisch' },
  { id: 'kopenhagen', name: 'Kopenhagen', category: 'modern' },
  { id: 'oslo', name: 'Oslo', category: 'modern' },
  { id: 'berlin', name: 'Berlin', category: 'modern' },
  { id: 'wien', name: 'Wien', category: 'klassisch' },
  { id: 'zuerich', name: 'Zürich', category: 'minimal' },
  { id: 'terrakotta', name: 'Terrakotta', category: 'kreativ' },
  { id: 'muenchen', name: 'München', category: 'klassisch' },
  { id: 'lissabon', name: 'Lissabon', category: 'modern' },
  { id: 'mailand', name: 'Mailand', category: 'kreativ' },
  { id: 'stockholm', name: 'Stockholm', category: 'modern' },
  { id: 'bordeaux', name: 'Bordeaux', category: 'kreativ' },
  { id: 'tokio', name: 'Tokio', category: 'minimal' },
  { id: 'amsterdam', name: 'Amsterdam', category: 'kreativ' },
  { id: 'genf', name: 'Genf', category: 'klassisch' },
  // Reactive-Resume-inspirierte Welle
  { id: 'pikachu', name: 'Pikachu', category: 'kreativ' },
  { id: 'onyx', name: 'Onyx', category: 'minimal' },
  { id: 'azurill', name: 'Azurill', category: 'modern' },
  { id: 'gengar', name: 'Gengar', category: 'kreativ' },
  { id: 'leafish', name: 'Leafish', category: 'modern' },
  // Etsy-Inspo Welle 2026-06
  { id: 'cobalt', name: 'Cobalt', category: 'kreativ' },
  { id: 'patterson', name: 'Patterson', category: 'modern' },
  { id: 'karlsruhe', name: 'Karlsruhe', category: 'minimal' },
  { id: 'rosenheim', name: 'Rosenheim', category: 'kreativ' },
  // Nordische/moderne Welle 2026-07
  { id: 'helsinki', name: 'Helsinki', category: 'minimal' },
  { id: 'espoo', name: 'Espoo', category: 'minimal' },
  { id: 'seoul', name: 'Seoul', category: 'modern' },
  { id: 'lyon', name: 'Lyon', category: 'klassisch' },
];

const app = express();
/* Befund vom 14.09.2026: „1" war fest verdrahtet.
 *
 * Hinter einem Reverse-Proxy ist das richtig — Express nimmt dann den rechten,
 * vom Proxy gesetzten Hop als `req.ip`, und den kann ein Aufrufer nicht
 * fälschen. OHNE Proxy ist derselbe Wert fatal: dann stammt `req.ip` aus einem
 * X-Forwarded-For, das der Client frei setzt, und JEDES Rate-Limit dieser
 * Datei (Login 5/15 min, Registrierung, PDF) ist mit einem Header abgeschaltet.
 * Passwort-Brute-Force liefe nur noch gegen die bcrypt-Kosten.
 *
 * Eine selbstgehostete Kopie hat in aller Regel keinen Proxy. Deshalb ist die
 * Vorgabe jetzt „kein Proxy", und wer einen hat, sagt es: TRUST_PROXY=1 (Zahl
 * der Hops) oder ein Express-Schlüsselwort wie „loopback". */
const TRUST_PROXY = (process.env.TRUST_PROXY || '').trim();
app.set('trust proxy',
  TRUST_PROXY === '' ? false
  : /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY)
  : TRUST_PROXY);
// CORS: only allow our own frontend origin (plus localhost for dev). Reflecting
// the request origin (origin: true) is an unnecessary footgun when we also set
// credentials: true — even with sameSite:'lax' on the session cookie, this used
// to be a finding in the security audit. ALLOWED_ORIGINS env can extend the
// list at deploy-time for staging branches.
const DEFAULT_ALLOWED = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:4173',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOWLIST = new Set([...DEFAULT_ALLOWED, ...ALLOWED_ORIGINS]);
app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests (no Origin header) always pass — they're either
    // server-to-server, curl, or the SPA itself hitting its own backend.
    if (!origin) return cb(null, true);
    if (ALLOWLIST.has(origin)) return cb(null, true);
    cb(new Error(`CORS: origin "${origin}" not allowed`));
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '12mb' }));

/* Hosts, unter denen dieser Dienst wirklich erreichbar ist.
 *
 * Gebraucht an zwei Stellen, die beide vorher einen frei wählbaren Header
 * gelesen haben: beim Bauen von Links, die das Haus verlassen (E-Mail,
 * Teilen-Link), und bei der SSRF-Prüfung des PDF-Renderers. */
const TRUSTED_HOSTS = new Set();
for (const o of ALLOWLIST) { try { TRUSTED_HOSTS.add(new URL(o).host); } catch { /* kein gültiger Ursprung */ } }
for (const v of [process.env.PUBLIC_BASE_URL, process.env.APP_BASE_URL]) {
  if (!v) continue;
  try { TRUSTED_HOSTS.add(new URL(v.trim()).host); } catch { /* kein gültiger Ursprung */ }
}

// ── Auth helpers ────────────────────────────────────────────────────────────

// Passwort-Versionsmarke: Sekunden-Epoche von password_changed_at (0 wenn nie
// gesetzt). Wird in die Session eingebettet; ändert sich das Passwort, passen
// alte Sessions nicht mehr und werden ungültig. (Security-Review-Finding #7.)
function pwdVersion(user) {
  return user?.password_changed_at ? Math.floor(new Date(user.password_changed_at).getTime() / 1000) : 0;
}

function issueSession(res, user) {
  const token = jwt.sign({ uid: user.id, pcat: pwdVersion(user) }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400 * 1000,
  });
}

function publicUser(u) {
  return {
    id: u.id, username: u.username, role: u.role, email: u.email ?? null,
    twofaEnabled: !!u.twofa_enabled, createdAt: u.created_at,
  };
}

// Erzeugt einen 6-stelligen Login-Code, legt eine Challenge in der DB an und
// mailt den Code. Gibt { challenge, sent } zurück. sent=false, wenn der
// E-Mail-Versand fehlschlug — dann darf der Login NICHT fortgesetzt werden.
async function startTwoFactor(user) {
  const challenge = crypto.randomBytes(24).toString('hex');
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await pool.query(
    'INSERT INTO login_codes (challenge, user_id, code_hash, expires_at) VALUES ($1, $2, $3, $4)',
    [challenge, user.id, sha256(code), expires],
  );
  const m = tplLoginCode({ code });
  const sent = await sendMail({ to: user.email, ...m });
  logEvent(user.id, 'twofa_challenge');
  return { challenge, sent };
}

// Konstanter bcrypt-Vergleich gegen einen Dummy-Hash, damit Login bei nicht
// existierendem Nutzer genauso lange braucht wie bei existierendem — sonst
// verrät die Antwortzeit gültige Nutzernamen. (Security-Review-Finding #5.)
const DUMMY_HASH = bcrypt.hashSync('cv-timing-equalizer-not-a-real-password', 10);

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

async function loadUser(req) {
  // 1. API-key auth (MCP / programmatic access). On hit we return immediately.
  // On miss / DB-error we *fall through* to cookie auth — earlier this used
  // to `return null` even with a perfectly valid cookie present, which meant
  // a bogus Authorization header could disable session auth for that request.
  // (Security audit finding #2.)
  const auth = req.headers?.authorization;
  if (auth && auth.startsWith('Bearer cvk_')) {
    const hash = sha256(auth.slice(7).trim());
    try {
      const { rows } = await pool.query(
        `SELECT u.* FROM api_keys k JOIN users u ON u.id = k.user_id
          WHERE k.key_hash = $1 AND NOT k.revoked AND NOT u.disabled`,
        [hash],
      );
      if (rows[0]) {
        pool.query('UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1', [hash]).catch(() => {});
        return rows[0];
      }
    } catch { /* fall through to cookie */ }
  }
  // 2. cookie session (browser)
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [decoded.uid]);
    const u = rows[0];
    if (!u || u.disabled) return null;
    // Passwortwechsel entwertet ältere Sessions. Fehlt der Claim (Alt-Token vor
    // Einführung), gilt 0 — dann kein Zwangs-Logout beim Deploy, aber ein
    // späterer Passwortwechsel invalidiert auch diese. (Finding #7.)
    if ((decoded.pcat ?? 0) !== pwdVersion(u)) return null;
    return u;
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const u = await loadUser(req);
  if (!u) return res.status(401).json({ error: 'Nicht angemeldet.' });
  req.user = u;
  pool.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id]).catch(() => {});
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Nur für Administratoren.' });
  next();
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
function generateCode() {
  const pick = n => Array.from({ length: n }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  return `${pick(4)}-${pick(4)}`;
}

// ── Health / templates ──────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, service: 'cv-api' }));
app.get('/api/templates', (_req, res) => res.json({ templates: TEMPLATES }));

// ── Zugangsanfragen (Registrierung anfragen) ─────────────────────────────────
// Besucher fragen ohne Login Zugang an. Der Admin entscheidet per signiertem
// Ein-Klick-Link aus der Benachrichtigungs-E-Mail (kein Login) ODER im Admin-
// Panel. Bei Annahme wird ein einmaliger, an die E-Mail gebundener Invite-Code
// erzeugt und dem Anfragenden zugesandt. KEINE KI beteiligt.
// ACCESS_NOTIFY_EMAIL bestimmt, wohin die Benachrichtigung geht (Fallback:
// SMTP_USER). Ohne beides wird nur die Anfrage gespeichert, keine Mail versandt.

const ACCESS_NOTIFY_EMAIL = (process.env.ACCESS_NOTIFY_EMAIL || process.env.SMTP_USER || '').trim();

/* Basis-URL für alles, was das Haus verlässt.
 *
 * Befund vom 14.09.2026: Die Adresse wurde aus `x-forwarded-host` gebaut — aus
 * einem Header also, den jeder Aufrufer frei setzt. Wer eine Zugangsanfrage mit
 * `X-Forwarded-Host: angreifer.tld` stellte, erzeugte damit eine Admin-Mail,
 * deren „Annehmen"-Knopf auf SEINEN Server zeigte. Ein Klick, und er hatte den
 * gültigen Aktions-Token in seinem Log — und damit einen Einladungscode. Das
 * ganze Zugang-nur-auf-Einladung-Modell hing an diesem einen Header.
 *
 * Jetzt: konfigurierter Wert zuerst. Sonst der `Host`-Header, und auch der nur,
 * wenn er zu einem bekannten Host gehört. Sonst `null` — und die aufrufende
 * Stelle entscheidet, was sie ohne Link tut. Lieber eine Mail ohne Knopf als
 * ein Knopf, der woanders hinführt. */
function publicBaseUrl(req) {
  const configured = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const host = (req.get('host') || '').trim();
  if (host && TRUSTED_HOSTS.has(host)) return `${req.protocol}://${host}`;
  return null;
}

// Signierter Aktions-Token (Autorisierung steckt im Token, daher kein Login
// nötig). Zweck-Claim verhindert Verwechslung mit Session-Tokens.
function signAccessAction(id, action) {
  /* 30 Tage waren für einen Ein-Klick-Knopf in einer E-Mail absurd lang: einen
   * Monat lang lag in einem Postfach ein gültiger Schlüssel zum Einladungs-
   * system. Drei Tage reichen, um eine Anfrage zu entscheiden. */
  return jwt.sign({ ar: id, act: action, purpose: 'access-action' }, JWT_SECRET, { expiresIn: '3d' });
}

// Schlichte HTML-Seite als Antwort auf die im Browser geöffneten Aktionslinks.
function actionPage(title, body, ok = true) {
  const accent = ok ? '#3d3df0' : '#b23b3b';
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;background:#f8f9fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1b1c22;">
    <div style="max-width:460px;margin:12vh auto;background:#fff;border:1px solid #e6e7ec;border-radius:14px;padding:32px;">
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;color:${accent};margin-bottom:10px;">${escapeHtml(title)}</div>
      <p style="font-size:14px;line-height:1.6;color:#5c5e6b;margin:0;">${body}</p>
    </div>
  </body></html>`;
}

// Gemeinsame Annahme-Logik (E-Mail-Link wie Admin-Panel): Invite erzeugen,
// Anfrage als angenommen markieren, Invite-Code an den Anfragenden mailen.
async function acceptAccessRequest(reqRow, decidedBy) {
  let code;
  for (let i = 0; i < 6; i++) {
    code = generateCode();
    const { rowCount } = await pool.query('SELECT 1 FROM invite_codes WHERE code = $1', [code]);
    if (!rowCount) break;
  }
  const expiresAt = new Date(Date.now() + 14 * 86400 * 1000);
  await pool.query(
    'INSERT INTO invite_codes (code, created_by, note, max_uses, expires_at, email) VALUES ($1, $2, $3, 1, $4, $5)',
    [code, decidedBy, `Zugangsanfrage #${reqRow.id} · ${reqRow.name}`.slice(0, 160), expiresAt, reqRow.email],
  );
  await pool.query(
    `UPDATE access_requests SET status = 'accepted', invite_code = $1, decided_by = $2, decided_at = now() WHERE id = $3`,
    [code, decidedBy, reqRow.id],
  );
  const m = tplInvite({ code, note: null });
  const emailed = await sendMail({ to: reqRow.email, ...m });
  logEvent(decidedBy ?? null, 'access_accept');
  return { code, emailed };
}

// Öffentlich, 5/Stunde/IP. Honeypot + Dedupe gegen Bots/Doppel-Mails.
app.post('/api/access/request', rateLimit({ route: 'access', max: 5, windowMs: 60 * 60 * 1000 }), async (req, res) => {
  if (String(req.body?.website || '').trim()) return res.json({ ok: true }); // Honeypot: still schlucken
  const name = String(req.body?.name || '').trim().slice(0, 120);
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 200);
  const message = String(req.body?.message || '').trim().slice(0, 1000);
  if (name.length < 2) return res.status(400).json({ error: 'Bitte gib deinen Namen an.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-Mail-Adresse ungültig.' });

  const dupe = await pool.query(
    `SELECT 1 FROM users WHERE lower(email) = $1
      UNION SELECT 1 FROM access_requests WHERE lower(email) = $1 AND status = 'pending'`,
    [email],
  );
  if (dupe.rowCount) return res.json({ ok: true });

  const ua = summarizeUa(req.get('user-agent') || '');
  const { rows } = await pool.query(
    'INSERT INTO access_requests (name, email, message, ua_summary) VALUES ($1, $2, $3, $4) RETURNING id',
    [name, email, message || null, ua],
  );
  const id = rows[0].id;
  /* Ohne bekannte Basis-URL entstehen KEINE Aktionslinks. Lieber eine
   * Benachrichtigung ohne Knöpfe — entschieden wird dann im Admin-Panel — als
   * ein Knopf, der irgendwohin führt. */
  const base = publicBaseUrl(req);
  const acceptUrl = base ? `${base}/pdfapi/api/access/action?token=${encodeURIComponent(signAccessAction(id, 'accept'))}` : null;
  const rejectUrl = base ? `${base}/pdfapi/api/access/action?token=${encodeURIComponent(signAccessAction(id, 'reject'))}` : null;
  if (ACCESS_NOTIFY_EMAIL) {
    sendMail({ to: ACCESS_NOTIFY_EMAIL, ...tplAccessRequest({ name, email, message, acceptUrl, rejectUrl }) });
  } else {
    console.warn('access: no ACCESS_NOTIFY_EMAIL/SMTP_USER — request stored but no notification sent.');
  }
  logEvent(null, 'access_request');
  res.json({ ok: true });
});

/* Aktion aus der E-Mail (Token = Autorisierung, kein Login).
 *
 * Befund vom 14.09.2026: Das war ein GET, und ein GET hat hier Wirkung entfaltet
 * — Einladungscode anlegen und verschicken. Outlook SafeLinks, Proofpoint,
 * Virenscanner und jede Link-Vorschau rufen Links in E-Mails automatisch ab.
 * Damit wurde eine Zugangsanfrage angenommen, sobald die Benachrichtigung einen
 * solchen Scanner passierte — ohne dass der Admin je geklickt hatte.
 *
 * Jetzt trennt sich beides: GET zeigt nur die Nachfrage, POST führt aus. Ein
 * Scanner folgt Links, aber er schickt keine Formulare ab. */
function actionConfirmPage(reqRow, act, token) {
  const ja = act === 'accept' ? 'Annehmen' : 'Ablehnen';
  const text = act === 'accept'
    ? `${escapeHtml(reqRow.name)} &lt;${escapeHtml(reqRow.email)}&gt; bekommt einen einmaligen Einladungscode per E-Mail.`
    : `Die Anfrage von ${escapeHtml(reqRow.name)} wird verworfen. Der Anfragende erhält keine Nachricht.`;
  const body = `${text}</p>
      <form method="post" action="" style="margin:18px 0 0;">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <button type="submit" style="font:600 14px Inter,Segoe UI,Arial,sans-serif;padding:11px 22px;border-radius:9px;border:1px solid #d7d8e0;background:${act === 'accept' ? '#3d3df0' : '#fff'};color:${act === 'accept' ? '#fff' : '#1b1c22'};cursor:pointer;">${ja}</button>
      </form>
      <p style="font-size:12px;color:#8b8d9b;margin:16px 0 0;">`;
  return actionPage(`${ja}?`, `${body}Erst der Knopf löst etwas aus. Der Link allein tut nichts — sonst entschieden Mail-Scanner die Anfrage.`);
}

app.get('/api/access/action', async (req, res) => {
  res.type('html');
  const token = String(req.query.token || '');
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); }
  catch { return res.status(400).send(actionPage('Link ungültig oder abgelaufen', 'Dieser Aktionslink ist nicht mehr gültig. Entscheide die Anfrage im Admin-Panel.', false)); }
  if (payload.purpose !== 'access-action' || !payload.ar || !['accept', 'reject'].includes(payload.act)) {
    return res.status(400).send(actionPage('Link ungültig', 'Dieser Link ist nicht verwendbar.', false));
  }
  const { rows } = await pool.query('SELECT * FROM access_requests WHERE id = $1', [payload.ar]);
  const reqRow = rows[0];
  if (!reqRow) return res.status(404).send(actionPage('Anfrage nicht gefunden', 'Die Anfrage existiert nicht mehr.', false));
  if (reqRow.status !== 'pending') {
    const label = reqRow.status === 'accepted' ? 'bereits angenommen' : 'bereits abgelehnt';
    return res.send(actionPage('Schon entschieden', `Diese Anfrage von ${escapeHtml(reqRow.name)} wurde ${label}.`));
  }
  return res.send(actionConfirmPage(reqRow, payload.act, token));
});

app.post('/api/access/action', express.urlencoded({ extended: false, limit: '8kb' }), async (req, res) => {
  res.type('html');
  let payload;
  try { payload = jwt.verify(String(req.body?.token || req.query.token || ''), JWT_SECRET); }
  catch { return res.status(400).send(actionPage('Link ungültig oder abgelaufen', 'Dieser Aktionslink ist nicht mehr gültig. Entscheide die Anfrage im Admin-Panel.', false)); }
  if (payload.purpose !== 'access-action' || !payload.ar || !['accept', 'reject'].includes(payload.act)) {
    return res.status(400).send(actionPage('Link ungültig', 'Dieser Link ist nicht verwendbar.', false));
  }
  const { rows } = await pool.query('SELECT * FROM access_requests WHERE id = $1', [payload.ar]);
  const reqRow = rows[0];
  if (!reqRow) return res.status(404).send(actionPage('Anfrage nicht gefunden', 'Die Anfrage existiert nicht mehr.', false));
  if (reqRow.status !== 'pending') {
    const label = reqRow.status === 'accepted' ? 'bereits angenommen' : 'bereits abgelehnt';
    return res.send(actionPage('Schon entschieden', `Diese Anfrage von ${escapeHtml(reqRow.name)} wurde ${label}.`));
  }
  if (payload.act === 'reject') {
    await pool.query(`UPDATE access_requests SET status = 'rejected', decided_at = now() WHERE id = $1`, [reqRow.id]);
    logEvent(null, 'access_reject');
    return res.send(actionPage('Abgelehnt', `Die Anfrage von ${escapeHtml(reqRow.name)} wurde abgelehnt. Dem Anfragenden wurde keine E-Mail gesendet.`));
  }
  const { code, emailed } = await acceptAccessRequest(reqRow, null);
  return res.send(actionPage('Angenommen', `${escapeHtml(reqRow.name)} wurde eingeladen. Einladungscode <strong>${escapeHtml(code)}</strong> ${emailed ? 'wurde per E-Mail zugestellt.' : '— E-Mail-Versand ist nicht konfiguriert, bitte den Code manuell weitergeben.'}`));
});

// ── Auth ────────────────────────────────────────────────────────────────────

// Register: 10/hour/IP — keeps invite-burning bots in check.
app.post('/api/auth/register', rateLimit({ route: 'register', max: 10, windowMs: 60 * 60 * 1000 }), async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
  const email = String(req.body?.email || '').trim().toLowerCase();

  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
    return res.status(400).json({ error: 'Nutzername: 3–32 Zeichen (Buchstaben, Zahlen, . _ -).' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.' });
  }
  if (email && !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'E-Mail-Adresse ungültig.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // WICHTIG: Einladungscode ZUERST prüfen (vor den Dublettenchecks). Sonst
    // könnte ein Angreifer OHNE gültigen Code über die 409-Meldungen Nutzer-
    // namen und E-Mail-Adressen enumerieren. (Security-Review-Finding #2.)
    const { rows: cnt } = await client.query('SELECT count(*)::int AS n FROM users');
    const firstUser = cnt[0].n === 0;
    let role = 'user';

    if (firstUser) {
      role = 'admin'; // bootstrap: first account is the admin, no code needed
    } else {
      if (!inviteCode) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode erforderlich.' }); }
      const { rows: ic } = await client.query('SELECT * FROM invite_codes WHERE code = $1 FOR UPDATE', [inviteCode]);
      const code = ic[0];
      if (!code || code.revoked) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode ungültig.' }); }
      if (code.expires_at && new Date(code.expires_at) < new Date()) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode ist abgelaufen.' }); }
      if (code.uses >= code.max_uses) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode wurde bereits aufgebraucht.' }); }
    }

    // Erst NACH akzeptiertem Code (bzw. Bootstrap) auf Dubletten prüfen.
    const dup = await client.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username]);
    if (dup.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Nutzername ist bereits vergeben.' }); }

    if (email) {
      const dupE = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
      if (dupE.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'E-Mail-Adresse ist bereits registriert.' }); }
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows: created } = await client.query(
      'INSERT INTO users (username, password_hash, role, email, password_changed_at) VALUES ($1, $2, $3, $4, now()) RETURNING *',
      [username, hash, role, email || null],
    );
    const user = created[0];

    if (!firstUser) {
      await client.query('UPDATE invite_codes SET uses = uses + 1 WHERE code = $1', [inviteCode]);
      await client.query('INSERT INTO invite_redemptions (code, user_id) VALUES ($1, $2)', [inviteCode, user.id]);
    }

    await client.query('COMMIT');
    logEvent(user.id, 'register');
    issueSession(res, user);
    res.json({ user: publicUser(user) });
    if (email) { const m = tplWelcome({ username }); sendMail({ to: email, ...m }); }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('register failed:', err);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen.' });
  } finally {
    client.release();
  }
});

// Login: 5/15min/IP — brute-force on a single account would require ~96 days
// at this rate to try a 6-character lowercase password, with the bcrypt cost
// on top. That's enough deterrent for the X-shared-link drive-by scenario.
app.post('/api/auth/login', rateLimit({ route: 'login', max: 5, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    const user = rows[0];
    // Immer einen bcrypt-Vergleich ausführen (Dummy-Hash bei fehlendem Nutzer),
    // damit die Antwortzeit keine gültigen Nutzernamen verrät. (Finding #5.)
    const passOk = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    if (!user || !passOk) {
      return res.status(401).json({ error: 'Nutzername oder Passwort falsch.' });
    }
    if (user.disabled) return res.status(403).json({ error: 'Konto gesperrt.' });

    // Zwei-Faktor: aktiv + E-Mail hinterlegt (Aktivieren setzt beides voraus).
    // FAIL CLOSED: Ist der E-Mail-Versand nicht verfügbar, wird der Login
    // verweigert statt still auf Passwort-only herabgestuft. (Finding #3.)
    if (user.twofa_enabled && user.email) {
      if (!mailConfigured) {
        return res.status(503).json({ error: 'Zwei-Faktor ist für dieses Konto aktiv, aber der E-Mail-Versand ist derzeit nicht verfügbar. Bitte später erneut versuchen oder den Administrator kontaktieren.' });
      }
      const { challenge, sent } = await startTwoFactor(user);
      if (!sent) {
        return res.status(502).json({ error: 'Der Bestätigungscode konnte nicht versendet werden. Bitte in Kürze erneut anmelden.' });
      }
      return res.json({ twofa: true, challenge });
    }

    await pool.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id]);
    logEvent(user.id, 'login');
    issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('login failed:', err);
    res.status(500).json({ error: 'Login fehlgeschlagen.' });
  }
});

// Schritt 2 des 2FA-Logins: Code prüfen und Session ausstellen.
// 5 Fehlversuche je Challenge, dann verbrannt. Rate-Limit gegen Brute-Force.
app.post('/api/auth/verify-2fa', rateLimit({ route: 'verify2fa', max: 20, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const challenge = String(req.body?.challenge || '').trim();
  const code = String(req.body?.code || '').trim();
  if (!challenge || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Code muss 6-stellig sein.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM login_codes WHERE challenge = $1 FOR UPDATE', [challenge]);
    const lc = rows[0];
    if (!lc || lc.used || new Date(lc.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Code ist ungültig oder abgelaufen. Bitte erneut anmelden.' });
    }
    if (lc.attempts >= 5) {
      await client.query('UPDATE login_codes SET used = true WHERE challenge = $1', [challenge]);
      await client.query('COMMIT');
      return res.status(429).json({ error: 'Zu viele Fehlversuche. Bitte erneut anmelden.' });
    }
    if (lc.code_hash !== sha256(code)) {
      await client.query('UPDATE login_codes SET attempts = attempts + 1 WHERE challenge = $1', [challenge]);
      await client.query('COMMIT');
      return res.status(401).json({ error: 'Code falsch.' });
    }
    await client.query('UPDATE login_codes SET used = true WHERE challenge = $1', [challenge]);
    // Alle anderen offenen Codes dieses Nutzers ebenfalls entwerten.
    await client.query('UPDATE login_codes SET used = true WHERE user_id = $1 AND used = false', [lc.user_id]);
    await client.query('COMMIT');

    const { rows: u } = await pool.query('SELECT * FROM users WHERE id = $1', [lc.user_id]);
    const user = u[0];
    if (!user || user.disabled) return res.status(403).json({ error: 'Konto gesperrt.' });
    await pool.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id]);
    logEvent(user.id, 'login');
    issueSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('verify-2fa failed:', err?.message || err);
    res.status(500).json({ error: 'Anmeldung fehlgeschlagen.' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const cur = String(req.body?.currentPassword || '');
  const nxt = String(req.body?.newPassword || '');
  if (nxt.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
  try {
    if (!(await bcrypt.compare(cur, req.user.password_hash))) {
      return res.status(403).json({ error: 'Aktuelles Passwort ist falsch.' });
    }
    const hash = await bcrypt.hash(nxt, 10);
    const { rows } = await pool.query(
      'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2 RETURNING *',
      [hash, req.user.id],
    );
    // Andere (ggf. kompromittierte) Sessions entwerten, eigene aktuelle Session
    // aber frisch ausstellen, damit der Nutzer angemeldet bleibt.
    issueSession(res, rows[0]);
    logEvent(req.user.id, 'password_changed');
    if (rows[0]?.email) { const m = tplPasswordChanged({ username: rows[0].username }); sendMail({ to: rows[0].email, ...m }); }
    res.json({ ok: true });
  } catch (err) {
    console.error('change-password failed:', err);
    res.status(500).json({ error: 'Passwortänderung fehlgeschlagen.' });
  }
});

// Eigene E-Mail-Adresse setzen/ändern/entfernen (für Reset, Benachrichtigungen,
// 2FA). Leert man sie, wird 2FA sicherheitshalber automatisch deaktiviert.
app.post('/api/auth/email', rateLimit({ route: 'setemail', max: 12, windowMs: 30 * 60 * 1000 }), requireAuth, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-Mail-Adresse ungültig.' });
  try {
    if (email) {
      const dupE = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [email, req.user.id]);
      if (dupE.rowCount) return res.status(409).json({ error: 'E-Mail-Adresse ist bereits registriert.' });
      await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, req.user.id]);
    } else {
      // E-Mail entfernt → 2FA kann nicht mehr greifen, also abschalten.
      await pool.query('UPDATE users SET email = NULL, twofa_enabled = false WHERE id = $1', [req.user.id]);
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error('set email failed:', err?.message || err);
    res.status(500).json({ error: 'Änderung fehlgeschlagen.' });
  }
});

// ── Zwei-Faktor-Authentifizierung (E-Mail-Code) ─────────────────────────────

// Status: ist 2FA an? Kann sie überhaupt aktiviert werden (E-Mail + SMTP)?
app.get('/api/auth/2fa', requireAuth, (req, res) => {
  res.json({
    enabled: !!req.user.twofa_enabled,
    hasEmail: !!req.user.email,
    mailReady: mailConfigured,
    canEnable: !!req.user.email && mailConfigured,
  });
});

// Ein-/ausschalten. Aktivieren nur möglich, wenn eine E-Mail hinterlegt ist
// und SMTP läuft — sonst könnte man sich aussperren.
app.post('/api/auth/2fa', rateLimit({ route: 'twofatoggle', max: 20, windowMs: 30 * 60 * 1000 }), requireAuth, async (req, res) => {
  const enabled = !!req.body?.enabled;
  if (enabled) {
    if (!req.user.email) return res.status(400).json({ error: 'Für 2FA muss eine E-Mail-Adresse im Konto hinterlegt sein.' });
    if (!mailConfigured) return res.status(503).json({ error: 'E-Mail-Versand ist derzeit nicht konfiguriert.' });
  }
  try {
    await pool.query('UPDATE users SET twofa_enabled = $1 WHERE id = $2', [enabled, req.user.id]);
    logEvent(req.user.id, enabled ? 'twofa_enabled' : 'twofa_disabled');
    res.json({ ok: true, enabled });
  } catch (err) {
    console.error('2fa toggle failed:', err?.message || err);
    res.status(500).json({ error: 'Änderung fehlgeschlagen.' });
  }
});

// ── Self-Service-Passwort-Reset (per E-Mail) ────────────────────────────────

// Fordert einen Reset-Link an. Antwortet IMMER mit { ok: true } — kein
// User-Enumeration-Leak (verrät nicht, ob eine Adresse existiert).
app.post('/api/auth/forgot-password', rateLimit({ route: 'forgot', max: 5, windowMs: 30 * 60 * 1000 }), async (req, res) => {
  const id = String(req.body?.identifier || req.body?.email || req.body?.username || '').trim().toLowerCase();
  res.json({ ok: true }); // früh antworten; Rest läuft best-effort im Hintergrund
  if (!id) return;
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(email) = $1 OR lower(username) = $1',
      [id],
    );
    const user = rows[0];
    if (!user || user.disabled || !user.email) return;   // ohne hinterlegte Mail kein Reset
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 60 min
    await pool.query(
      'INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, user.id, expires],
    );
    logEvent(user.id, 'password_reset_requested');
    const m = tplPasswordReset({ token });
    await sendMail({ to: user.email, ...m });
  } catch (err) {
    console.error('forgot-password failed:', err?.message || err);
  }
});

// Setzt das Passwort per Token. Token: einmalig, 60 min gültig.
app.post('/api/auth/reset-password', rateLimit({ route: 'reset', max: 10, windowMs: 30 * 60 * 1000 }), async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const nxt = String(req.body?.newPassword || '');
  if (!token) return res.status(400).json({ error: 'Token fehlt.' });
  if (nxt.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM password_resets WHERE token = $1 FOR UPDATE', [token]);
    const pr = rows[0];
    if (!pr || pr.used || new Date(pr.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Link ist ungültig oder abgelaufen.' });
    }
    const hash = await bcrypt.hash(nxt, 10);
    // password_changed_at bump entwertet alle Alt-Sessions — wichtig, wenn der
    // Reset der Wiederherstellung nach einer Kompromittierung dient. (Finding #7.)
    await client.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [hash, pr.user_id]);
    await client.query('UPDATE password_resets SET used = true WHERE token = $1', [token]);
    // Alle anderen offenen Tokens dieses Nutzers entwerten.
    await client.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false', [pr.user_id]);
    await client.query('COMMIT');
    logEvent(pr.user_id, 'password_reset_done');
    const { rows: u } = await pool.query('SELECT username, email FROM users WHERE id = $1', [pr.user_id]);
    if (u[0]?.email) { const m = tplPasswordChanged({ username: u[0].username }); sendMail({ to: u[0].email, ...m }); }
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('reset-password failed:', err?.message || err);
    res.status(500).json({ error: 'Zurücksetzen fehlgeschlagen.' });
  } finally {
    client.release();
  }
});

// ── API keys (per-user, for MCP / programmatic access) ──────────────────────

app.post('/api/keys', requireAuth, async (req, res) => {
  const name = (String(req.body?.name || '').trim().slice(0, 80)) || 'MCP-Key';
  const key = 'cvk_' + crypto.randomBytes(20).toString('hex');
  const prefix = key.slice(0, 14);
  await pool.query(
    'INSERT INTO api_keys (user_id, name, key_hash, prefix) VALUES ($1, $2, $3, $4)',
    [req.user.id, name, sha256(key), prefix],
  );
  // The full key is shown exactly once — only its hash is stored.
  res.json({ key, prefix, name });
});

app.get('/api/keys', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, prefix, created_at, last_used_at, revoked FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [req.user.id],
  );
  res.json({ keys: rows });
});

app.post('/api/keys/:id/revoke', requireAuth, async (req, res) => {
  await pool.query('UPDATE api_keys SET revoked = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ── Photo upload (BYTEA in Postgres — small scale, no volume needed) ────────

/** Validate that the raw buffer actually matches the claimed MIME by sniffing
 *  the magic bytes. Prevents users from POSTing arbitrary binary blobs with
 *  `mime: image/png` and storing them as fake images. */
function imageMagicMatches(buf, mime) {
  if (buf.length < 12) return false;
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  if (mime === 'image/gif') return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
  if (mime === 'image/webp') return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
  return false;
}

app.post('/api/photos', requireAuth, rateLimit({ route: 'photos', max: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
  const mime = String(req.body?.mime || '');
  const b64 = String(req.body?.dataBase64 || '');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return res.status(400).json({ error: 'Nur JPEG, PNG, WebP oder GIF.' });
  let buf;
  try { buf = Buffer.from(b64, 'base64'); } catch { return res.status(400).json({ error: 'Ungültige Base64-Daten.' }); }
  if (buf.length < 100) return res.status(400).json({ error: 'Datei zu klein.' });
  if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'Maximal 4 MB.' });
  if (!imageMagicMatches(buf, mime)) return res.status(400).json({ error: 'Dateiformat passt nicht zum angegebenen MIME-Typ.' });
  const id = crypto.randomBytes(12).toString('hex');
  await pool.query('INSERT INTO photos (id, user_id, mime, data, size_bytes) VALUES ($1, $2, $3, $4, $5)', [id, req.user.id, mime, buf, buf.length]);
  // Absolute URL so exported HTML/PDF works outside the app too.
  /* Auch hier nicht mehr aus Headern: Ein gefälschter X-Forwarded-Host
   * schrieb dem Hochladenden eine fremde Adresse in sein eigenes Profil.
   * Ohne bekannte Basis-URL kommt der relative Pfad zurück — den löst das
   * Frontend ohnehin gegen seinen eigenen Ursprung auf. */
  const base = publicBaseUrl(req);
  res.json({ id, url: `${base || ''}/pdfapi/api/photos/${id}` });
});

app.get('/api/photos/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT mime, data FROM photos WHERE id = $1', [req.params.id]);
  const p = rows[0];
  if (!p) return res.status(404).send('Not found');
  res.setHeader('Content-Type', p.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(p.data);
});

// ── Public share links ──────────────────────────────────────────────────────

// Minimal UA summary — browser-family + OS-family only, no IP, no version dump.
// DSGVO: we don't store the raw UA, just a coarse label for the link owner.
function summarizeUa(ua) {
  const u = String(ua || '').toLowerCase();
  let browser = 'Other';
  if (u.includes('edg/')) browser = 'Edge';
  else if (u.includes('opr/') || u.includes('opera/')) browser = 'Opera';
  else if (u.includes('chrome/') && !u.includes('chromium')) browser = 'Chrome';
  else if (u.includes('safari/') && !u.includes('chrome/')) browser = 'Safari';
  else if (u.includes('firefox/')) browser = 'Firefox';
  let os = 'Other';
  if (u.includes('iphone') || u.includes('ipad') || u.includes('ipod')) os = 'iOS';
  else if (u.includes('android')) os = 'Android';
  else if (u.includes('mac os') || u.includes('macintosh')) os = 'Mac';
  else if (u.includes('windows')) os = 'Win';
  else if (u.includes('linux')) os = 'Linux';
  return `${browser}/${os}`;
}

function recordShareView(token, variant, ua) {
  pool.query(
    'UPDATE share_links SET view_count = view_count + 1, last_viewed_at = now() WHERE token = $1',
    [token],
  ).catch(() => {});
  pool.query(
    'INSERT INTO share_views (token, variant, ua_summary) VALUES ($1, $2, $3)',
    [token, variant, summarizeUa(ua)],
  ).catch(() => {});
}

app.post('/api/resumes/:id/share', requireAuth, async (req, res) => {
  const id = req.params.id;
  const { rows } = await pool.query('SELECT 1 FROM resumes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  const token = crypto.randomBytes(18).toString('hex');
  const days = parseInt(req.body?.expiresInDays, 10);
  const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400 * 1000) : null;
  const includeCl = req.body?.includeCoverLetter !== false; // default true
  await pool.query(
    'INSERT INTO share_links (token, resume_id, created_by, expires_at, include_cover_letter) VALUES ($1, $2, $3, $4, $5)',
    [token, id, req.user.id, expiresAt, includeCl],
  );
  /* Dieselbe Quelle wie für die E-Mail-Links (siehe publicBaseUrl): aus einem
   * gefälschten X-Forwarded-Host entstand sonst ein Teilen-Link, der den
   * Empfänger auf einen fremden Server schickt. Ist keine Basis-URL bekannt,
   * kommt der Pfad allein zurück — relativ zur Anwendung stimmt er immer. */
  const baseUrl = publicBaseUrl(req);
  res.json({ token, url: `${baseUrl || ''}/share/${token}`, expires_at: expiresAt, include_cover_letter: includeCl });
});

app.get('/api/resumes/:id/shares', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT token, expires_at, revoked, view_count, last_viewed_at, include_cover_letter, created_at
       FROM share_links WHERE resume_id = $1 AND created_by = $2 ORDER BY created_at DESC`,
    [req.params.id, req.user.id],
  );
  // tack on the last 5 ua_summaries per link so the UI can show "wer hat geklickt"
  for (const row of rows) {
    const v = await pool.query(
      'SELECT viewed_at, variant, ua_summary FROM share_views WHERE token = $1 ORDER BY viewed_at DESC LIMIT 5',
      [row.token],
    );
    row.recent_views = v.rows;
  }
  res.json({ shares: rows });
});

app.post('/api/shares/:token/revoke', requireAuth, async (req, res) => {
  await pool.query('UPDATE share_links SET revoked = true WHERE token = $1 AND created_by = $2', [req.params.token, req.user.id]);
  res.json({ ok: true });
});

// Toggle the cover-letter inclusion on an existing share link.
app.patch('/api/shares/:token', requireAuth, async (req, res) => {
  const includeCl = req.body?.includeCoverLetter;
  if (typeof includeCl !== 'boolean') return res.status(400).json({ error: 'includeCoverLetter (bool) erwartet.' });
  const r = await pool.query(
    'UPDATE share_links SET include_cover_letter = $1 WHERE token = $2 AND created_by = $3',
    [includeCl, req.params.token, req.user.id],
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Link nicht gefunden.' });
  res.json({ ok: true });
});

// Markdown variant — MUST be declared BEFORE the catch-all :token route,
// otherwise Express matches the .md suffix as part of the token param.
async function loadShareForMd(token) {
  const { rows } = await pool.query(
    `SELECT r.payload, s.expires_at, s.revoked, s.include_cover_letter FROM share_links s
       JOIN resumes r ON r.id = s.resume_id WHERE s.token = $1`,
    [token],
  );
  const s = rows[0];
  if (!s) return { status: 404, msg: 'Link nicht gefunden.' };
  if (s.revoked) return { status: 403, msg: 'Link widerrufen.' };
  if (s.expires_at && new Date(s.expires_at) < new Date()) return { status: 410, msg: 'Link abgelaufen.' };
  return { status: 200, payload: s.payload, includeCoverLetter: s.include_cover_letter };
}

app.get(/^\/api\/share\/([0-9a-fA-F]+)\.md$/, async (req, res) => {
  const r = await loadShareForMd(req.params[0]);
  if (r.status !== 200) return res.status(r.status).type('text/plain').send(r.msg);
  recordShareView(req.params[0], 'md', req.get('user-agent'));
  res.type('text/markdown; charset=utf-8').send(cvToMarkdown(r.payload));
});

/** Per-share OG-card endpoint. Returns minimal HTML with og:title/description/
 *  image populated from the linked resume payload, so LinkedIn / Slack /
 *  WhatsApp / Discord previews show the candidate name and headline instead
 *  of the generic "Application Studio" landing card. The crawler-detection
 *  is intentionally permissive — when in doubt we serve the rich card; the
 *  SPA still loads on document interaction. */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
app.get(/^\/share\/([0-9a-fA-F]+)\/?$/, async (req, res, next) => {
  // Only intercept for crawlers — humans hit the SPA via the catch-all
  // index.html below (nginx already does that). Heuristic on UA.
  const ua = String(req.get('user-agent') || '').toLowerCase();
  const isCrawler = /bot|facebookexternalhit|linkedinbot|slackbot|twitterbot|whatsapp|discordbot|telegrambot|pinterest|skypeuripreview|embedly|google-inspectiontool|bingbot|duckduckbot/i.test(ua);
  if (!isCrawler) return next();
  const r = await loadShareForMd(req.params[0]);
  if (r.status !== 200) return res.status(r.status).type('text/plain').send(r.msg);
  const payload = r.payload || {};
  const cv = (payload.data && (payload.data.de || payload.data.en)) || {};
  const name = (cv.personal && cv.personal.name) || 'Lebenslauf';
  const title = (cv.personal && cv.personal.title) || '';
  const location = (cv.personal && cv.personal.location) || '';
  /* OG-image allowlist: only same-origin /api/photos/:id URLs are safe to
   * emit, otherwise a malicious profile could embed an attacker-controlled
   * URL as og:image and turn every share-card preview into a confirmed-read
   * tracking pixel for the recipient. (Audit finding #10.) */
  const rawPhoto = (cv.personal && cv.personal.photo) || '';
  /* Der Schutz aus Befund #10 hing an denselben Headern wie alles andere:
   * Wer `X-Forwarded-Host` auf seine eigene Adresse setzte, bestand die
   * „gleicher Ursprung"-Prüfung — und das Zählpixel war wieder da. Die
   * Basis-URL kommt deshalb aus der Konfiguration; fehlt sie, gilt nur noch
   * die relative Schreibweise, die gar keinen Host enthalten kann. */
  const ownBase = publicBaseUrl(req);
  const sameOriginPhoto = rawPhoto && (
    rawPhoto.startsWith('/pdfapi/api/photos/') ||
    (!!ownBase && rawPhoto.startsWith(`${ownBase}/pdfapi/api/photos/`))
  );
  const photo = sameOriginPhoto ? rawPhoto : '';
  const description = [title, location].filter(Boolean).join(' · ') || 'Lebenslauf in editorialem Layout — geteilte Vorschau.';
  const url = `${reqProto}://${reqHost}/share/${req.params[0]}`;
  res.type('html').send(`<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(name)} — Lebenslauf</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(name)} — Lebenslauf">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
${photo ? `<meta property="og:image" content="${escapeHtml(photo)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(name)} — Lebenslauf">
<meta name="twitter:description" content="${escapeHtml(description)}">
${photo ? `<meta name="twitter:image" content="${escapeHtml(photo)}">` : ''}
<meta name="robots" content="noindex, nofollow">
</head>
<body>
<h1>${escapeHtml(name)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(url)}">Vollständigen Lebenslauf ansehen</a></p>
</body>
</html>`);
});

app.get('/api/share/:token', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.payload, s.expires_at, s.revoked, s.include_cover_letter FROM share_links s
       JOIN resumes r ON r.id = s.resume_id
      WHERE s.token = $1`,
    [req.params.token],
  );
  const s = rows[0];
  if (!s) return res.status(404).json({ error: 'Link nicht gefunden.' });
  if (s.revoked) return res.status(403).json({ error: 'Link widerrufen.' });
  if (s.expires_at && new Date(s.expires_at) < new Date()) return res.status(410).json({ error: 'Link abgelaufen.' });
  recordShareView(req.params.token, 'html', req.get('user-agent'));
  // Strip cover-letter from public payload if the link owner disabled the toggle.
  let payload = s.payload;
  if (!s.include_cover_letter) {
    payload = { ...payload, coverLetters: {} };
  }
  res.json({ resume: payload, include_cover_letter: s.include_cover_letter });
});

// Export own résumé as Markdown (auth)
app.get(/^\/api\/resumes\/([^/]+)\.md$/, requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params[0], req.user.id]);
  if (!rows[0]) return res.status(404).type('text/plain').send('Profil nicht gefunden.');
  res.type('text/markdown; charset=utf-8').send(cvToMarkdown(rows[0].payload));
});

// Import a corrected Markdown back into the user's profile (auth)
// Pass dryRun:true to receive the parsed payload without persisting — used by
// the Diff-Preview modal in the client.
app.post('/api/resumes/:id/import-md', requireAuth, async (req, res) => {
  const md = String(req.body?.markdown || '');
  const dryRun = req.body?.dryRun === true;
  if (md.length < 20) return res.status(400).json({ error: 'Markdown fehlt oder zu kurz.' });
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  let updated;
  try { updated = markdownToCV(md, rows[0].payload); }
  catch (e) { return res.status(400).json({ error: 'Markdown-Parser-Fehler: ' + (e?.message || 'unbekannt') }); }
  updated.id = req.params.id;
  if (dryRun) return res.json({ ok: true, payload: updated, dryRun: true });
  await snapshotResume(req.params.id, req.user.id, 'md_import');
  await pool.query('UPDATE resumes SET payload = $1, updated_at = now() WHERE id = $2', [updated, req.params.id]);
  logEvent(req.user.id, 'md_import');
  res.json({ ok: true, payload: updated });
});

// ── Cover-Letter Markdown (download + upload) ───────────────────────────────

app.get(/^\/api\/resumes\/([^/]+)\/cover-letter\.md$/, requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params[0], req.user.id]);
  if (!rows[0]) return res.status(404).type('text/plain').send('Profil nicht gefunden.');
  res.type('text/markdown; charset=utf-8').send(clToMarkdown(rows[0].payload));
});

app.post('/api/resumes/:id/import-cover-letter-md', requireAuth, async (req, res) => {
  const md = String(req.body?.markdown || '');
  const dryRun = req.body?.dryRun === true;
  if (md.length < 10) return res.status(400).json({ error: 'Markdown fehlt oder zu kurz.' });
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  let updated;
  try { updated = markdownToCl(md, rows[0].payload); }
  catch (e) { return res.status(400).json({ error: 'Markdown-Parser-Fehler: ' + (e?.message || 'unbekannt') }); }
  updated.id = req.params.id;
  if (dryRun) return res.json({ ok: true, payload: updated, dryRun: true });
  await snapshotResume(req.params.id, req.user.id, 'cl_md_import');
  await pool.query('UPDATE resumes SET payload = $1, updated_at = now() WHERE id = $2', [updated, req.params.id]);
  logEvent(req.user.id, 'cl_md_import');
  res.json({ ok: true, payload: updated });
});

// ── Version history (undo target for imports / AI edits) ────────────────────

app.get('/api/resumes/:id/versions', requireAuth, async (req, res) => {
  const r = await pool.query('SELECT 1 FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!r.rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  const { rows } = await pool.query(
    'SELECT id, source, created_at FROM resume_versions WHERE resume_id = $1 ORDER BY created_at DESC LIMIT 25',
    [req.params.id],
  );
  res.json({ versions: rows });
});

app.get('/api/resumes/:id/versions/:vid', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.payload, v.source, v.created_at FROM resume_versions v
       JOIN resumes r ON r.id = v.resume_id
      WHERE v.id = $1 AND v.resume_id = $2 AND r.user_id = $3`,
    [req.params.vid, req.params.id, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Version nicht gefunden.' });
  res.json({ version: rows[0] });
});

app.post('/api/resumes/:id/versions/:vid/restore', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT v.payload FROM resume_versions v
       JOIN resumes r ON r.id = v.resume_id
      WHERE v.id = $1 AND v.resume_id = $2 AND r.user_id = $3`,
    [req.params.vid, req.params.id, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Version nicht gefunden.' });
  const restored = { ...rows[0].payload, id: req.params.id };
  await snapshotResume(req.params.id, req.user.id, 'restore');
  await pool.query('UPDATE resumes SET payload = $1, updated_at = now() WHERE id = $2', [restored, req.params.id]);
  logEvent(req.user.id, 'resume_restore');
  res.json({ ok: true, payload: restored });
});

// ── Résumés (per user) ──────────────────────────────────────────────────────

app.get('/api/resumes', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, display_name, created_at, updated_at FROM resumes WHERE user_id = $1 ORDER BY updated_at DESC',
    [req.user.id],
  );
  res.json({ resumes: rows });
});

app.get('/api/resumes/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM resumes WHERE id = $1', [req.params.id]);
  const r = rows[0];
  if (!r || (r.user_id !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Nicht gefunden.' });
  }
  res.json({ resume: { id: r.id, displayName: r.display_name, payload: r.payload, updatedAt: r.updated_at } });
});

/** Hard upper bound on a single resume payload — DSGVO-relevant data fits
 *  comfortably in 200 KB JSON. Without this an invited user could push 12 MB
 *  payloads per request (express.json limit), fill the JSONB column and
 *  exhaust the postgres volume. (Security audit finding #3.) */
const MAX_RESUME_PAYLOAD_BYTES = 200_000;
/** Per-user resume cap. Anyone trying to spam the table burns through 50
 *  resumes long before they make a dent. */
const MAX_RESUMES_PER_USER = 50;

app.post('/api/resumes', requireAuth, async (req, res) => {
  const id = String(req.body?.id || crypto.randomUUID());
  const displayName = String(req.body?.displayName || 'Profil').slice(0, 120);
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload fehlt.' });
  // Payload-size + per-user-count quotas. Both are cheap to check.
  const payloadStr = JSON.stringify(payload);
  if (payloadStr.length > MAX_RESUME_PAYLOAD_BYTES) {
    return res.status(413).json({ error: `Profil zu groß (${Math.round(payloadStr.length/1024)} KB > ${MAX_RESUME_PAYLOAD_BYTES/1024} KB).` });
  }
  // Count current resumes for this user — only block if we're INSERTING a new
  // id; existing-id UPDATEs always pass.
  const existsForUser = await pool.query('SELECT 1 FROM resumes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (existsForUser.rowCount === 0) {
    const { rows: cnt } = await pool.query('SELECT count(*)::int AS n FROM resumes WHERE user_id = $1', [req.user.id]);
    if (cnt[0].n >= MAX_RESUMES_PER_USER) {
      return res.status(403).json({ error: `Maximal ${MAX_RESUMES_PER_USER} Profile pro Konto.` });
    }
  }
  // Cross-user ID-collision guard. The ON CONFLICT clause used to silently
  // skip the UPDATE when another user owned the same id, but still returned
  // 200 — which means a client could spam ids and pollute the table with
  // ghost-INSERTs. Refuse explicitly with 409. (Security audit finding.)
  const existing = await pool.query('SELECT user_id FROM resumes WHERE id = $1', [id]);
  if (existing.rows[0] && existing.rows[0].user_id !== req.user.id) {
    return res.status(409).json({ error: 'Diese Profil-ID ist bereits vergeben.' });
  }
  // Opt-in snapshot for callers that know they're doing a wholesale replace
  // (e.g. JSON upload). Regular debounced editor saves do NOT pass this flag
  // so we don't churn the version table on every keystroke.
  if (req.body?.snapshotBefore) {
    await snapshotResume(id, req.user.id, String(req.body?.snapshotSource || 'json_import'));
  }
  await pool.query(
    `INSERT INTO resumes (id, user_id, display_name, payload) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET display_name = $3, payload = $4, updated_at = now()
     WHERE resumes.user_id = $2`,
    [id, req.user.id, displayName, payload],
  );
  logEvent(req.user.id, 'resume_save');
  res.json({ id });
});

app.put('/api/resumes/:id', requireAuth, async (req, res) => {
  const displayName = String(req.body?.displayName || 'Profil').slice(0, 120);
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload fehlt.' });
  const { rowCount } = await pool.query(
    'UPDATE resumes SET display_name = $1, payload = $2, updated_at = now() WHERE id = $3 AND user_id = $4',
    [displayName, payload, req.params.id, req.user.id],
  );
  if (!rowCount) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.json({ ok: true });
});

app.delete('/api/resumes/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

// ── DSGVO self-service ──────────────────────────────────────────────────────

/**
 * Returns a single JSON document with every record the system stores about
 * the calling user. Photos are returned as base64-encoded data URLs so the
 * archive is self-contained (no follow-up requests needed to reconstruct).
 */
app.get('/api/me/export', requireAuth, rateLimit({ route: 'export', max: 3, windowMs: 60 * 60 * 1000 }), async (req, res) => {
  try {
    const [user, resumes, versions, shares, photos, events, apiKeys] = await Promise.all([
      pool.query('SELECT id, username, role, created_at, last_seen_at FROM users WHERE id = $1', [req.user.id]),
      pool.query('SELECT id, display_name, payload, created_at, updated_at FROM resumes WHERE user_id = $1', [req.user.id]),
      pool.query(`SELECT v.id, v.resume_id, v.source, v.payload, v.created_at
                    FROM resume_versions v JOIN resumes r ON r.id = v.resume_id
                   WHERE r.user_id = $1`, [req.user.id]),
      pool.query(`SELECT s.token, s.resume_id, s.expires_at, s.revoked, s.view_count, s.last_viewed_at, s.include_cover_letter, s.created_at
                    FROM share_links s WHERE s.created_by = $1`, [req.user.id]),
      pool.query('SELECT id, mime, data, size_bytes, created_at FROM photos WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT id, kind, created_at FROM events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000', [req.user.id]),
      pool.query('SELECT id, name, prefix, created_at, last_used_at, revoked FROM api_keys WHERE user_id = $1', [req.user.id]),
    ]);

    const dump = {
      exportedAt: new Date().toISOString(),
      account: user.rows[0] || null,
      resumes: resumes.rows,
      versions: versions.rows,
      shares: shares.rows,
      photos: photos.rows.map(p => ({
        id: p.id, mime: p.mime, sizeBytes: p.size_bytes, createdAt: p.created_at,
        dataUrl: `data:${p.mime};base64,${Buffer.from(p.data).toString('base64')}`,
      })),
      events: events.rows,
      apiKeys: apiKeys.rows,
    };

    logEvent(req.user.id, 'dsgvo_export');
    const filename = `application-studio-export-${(user.rows[0]?.username || 'user').replace(/[^A-Za-z0-9_-]/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    console.error('me/export failed:', err);
    res.status(500).json({ error: 'Export fehlgeschlagen.' });
  }
});

/**
 * Permanently deletes the calling user's account. Requires the current
 * password as a confirmation factor so a stolen session can't wipe data.
 * Cascade deletes everything (resumes, versions, photos, shares, keys, events).
 */
app.post('/api/me/delete', requireAuth, async (req, res) => {
  const password = String(req.body?.password || '');
  if (!password) return res.status(400).json({ error: 'Passwort zur Bestätigung erforderlich.' });
  // Admin accounts can't be deleted via this endpoint — they're bootstrapped
  // from env and would be re-created on next boot. Admin: change ADMIN_USERNAME first.
  if (req.user.role === 'admin') return res.status(403).json({ error: 'Admin-Konto: bitte ADMIN_USERNAME in Coolify ändern und neu deployen.' });
  try {
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Konto nicht gefunden.' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Passwort falsch.' });

    // Kontaktdaten vor dem Löschen sichern (für die Offboarding-Mail).
    const { rows: info } = await pool.query('SELECT username, email FROM users WHERE id = $1', [req.user.id]);
    // FK cascades handle resumes → versions → shares; photos + api_keys + events
    // also cascade per schema.
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.clearCookie(COOKIE);
    res.json({ ok: true });
    if (info[0]?.email) { const m = tplOffboarding({ username: info[0].username, deleted: true }); sendMail({ to: info[0].email, ...m }); }
  } catch (err) {
    console.error('me/delete failed:', err);
    res.status(500).json({ error: 'Löschung fehlgeschlagen.' });
  }
});

// ── Admin ───────────────────────────────────────────────────────────────────

app.post('/api/admin/invites', requireAuth, requireAdmin, async (req, res) => {
  const maxUses = Math.max(1, Math.min(500, parseInt(req.body?.maxUses, 10) || 1));
  const note = String(req.body?.note || '').slice(0, 160) || null;
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-Mail-Adresse ungültig.' });
  const days = parseInt(req.body?.expiresInDays, 10);
  const expiresAt = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86400 * 1000)
    : null;
  let code;
  for (let i = 0; i < 6; i++) {
    code = generateCode();
    const { rowCount } = await pool.query('SELECT 1 FROM invite_codes WHERE code = $1', [code]);
    if (!rowCount) break;
  }
  await pool.query(
    'INSERT INTO invite_codes (code, created_by, note, max_uses, expires_at, email) VALUES ($1, $2, $3, $4, $5, $6)',
    [code, req.user.id, note, maxUses, expiresAt, email || null],
  );
  // Onboarding-Automatik: wenn eine E-Mail angegeben ist, Einladung direkt versenden.
  let emailed = false;
  if (email) { const m = tplInvite({ code, note }); emailed = await sendMail({ to: email, ...m }); }
  res.json({ code, maxUses, note, expiresAt, email: email || null, emailed });
});

app.get('/api/admin/invites', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.code, c.note, c.max_uses, c.uses, c.expires_at, c.revoked, c.created_at,
            u.username AS created_by
       FROM invite_codes c LEFT JOIN users u ON u.id = c.created_by
      ORDER BY c.created_at DESC`,
  );
  res.json({ invites: rows });
});

app.post('/api/admin/invites/:code/revoke', requireAuth, requireAdmin, async (req, res) => {
  await pool.query('UPDATE invite_codes SET revoked = true WHERE code = $1', [req.params.code]);
  res.json({ ok: true });
});

// Zugangsanfragen im Admin-Panel (Alternative zu den E-Mail-Links).
app.get('/api/admin/access-requests', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, email, message, status, invite_code, ua_summary, created_at, decided_at
       FROM access_requests ORDER BY (status = 'pending') DESC, created_at DESC LIMIT 200`,
  );
  res.json({ requests: rows });
});

app.post('/api/admin/access-requests/:id/accept', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM access_requests WHERE id = $1', [req.params.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Anfrage nicht gefunden.' });
  if (r.status !== 'pending') return res.status(409).json({ error: 'Anfrage wurde bereits entschieden.' });
  const { code, emailed } = await acceptAccessRequest(r, req.user.id);
  res.json({ ok: true, code, emailed });
});

app.post('/api/admin/access-requests/:id/reject', requireAuth, requireAdmin, async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE access_requests SET status = 'rejected', decided_by = $1, decided_at = now() WHERE id = $2 AND status = 'pending'`,
    [req.user.id, req.params.id],
  );
  if (!rowCount) return res.status(409).json({ error: 'Anfrage wurde bereits entschieden oder existiert nicht.' });
  logEvent(req.user.id, 'access_reject');
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.username, u.role, u.disabled, u.created_at, u.last_seen_at,
            (SELECT count(*)::int FROM resumes r WHERE r.user_id = u.id) AS resume_count
       FROM users u ORDER BY u.created_at ASC`,
  );
  res.json({ users: rows });
});

app.post('/api/admin/users/:id/disable', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const disabled = !!req.body?.disabled;
  if (id === req.user.id) return res.status(400).json({ error: 'Eigenes Konto kann nicht gesperrt werden.' });
  const { rows } = await pool.query('UPDATE users SET disabled = $1 WHERE id = $2 RETURNING username, email', [disabled, id]);
  res.json({ ok: true });
  if (disabled && rows[0]?.email) { const m = tplOffboarding({ username: rows[0].username, deleted: false }); sendMail({ to: rows[0].email, ...m }); }
});

app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const nxt = String(req.body?.newPassword || '');
  if (nxt.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
  const hash = await bcrypt.hash(nxt, 10);
  const { rowCount } = await pool.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [hash, id]);
  if (!rowCount) return res.status(404).json({ error: 'Nutzer nicht gefunden.' });
  res.json({ ok: true });
});

app.get('/api/admin/stats', requireAuth, requireAdmin, async (_req, res) => {
  const q = async (sql) => (await pool.query(sql)).rows[0].n;
  res.json({
    users: await q('SELECT count(*)::int n FROM users'),
    resumes: await q('SELECT count(*)::int n FROM resumes'),
    invitesActive: await q('SELECT count(*)::int n FROM invite_codes WHERE NOT revoked AND uses < max_uses'),
    pdfExports: await q("SELECT count(*)::int n FROM events WHERE kind = 'pdf'"),
    registrations7d: await q("SELECT count(*)::int n FROM events WHERE kind = 'register' AND created_at > now() - interval '7 days'"),
    accessPending: await q("SELECT count(*)::int n FROM access_requests WHERE status = 'pending'"),
    accessAccepted: await q("SELECT count(*)::int n FROM access_requests WHERE status = 'accepted'"),
    accessRejected: await q("SELECT count(*)::int n FROM access_requests WHERE status = 'rejected'"),
    accessRequests7d: await q("SELECT count(*)::int n FROM access_requests WHERE created_at > now() - interval '7 days'"),
  });
});
// ── PDF rendering ───────────────────────────────────────────────────────────

let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    if (b.isConnected()) return b;
  }
  browserPromise = chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  return browserPromise;
}

// Map our PageFormat ids → Playwright format strings. preferCSSPageSize on
// the request still wins, but we set format as a safety net for clients
// that don't propagate the CSS @page rule cleanly.
const PDF_FORMAT_MAP = { a4: 'A4', letter: 'Letter', legal: 'Legal', a5: 'A5' };

/** SSRF allowlist for the headless-Chromium PDF render. Without this, a
 *  user-supplied HTML body can pull arbitrary URLs (private-network probes,
 *  AWS/Hetzner metadata at 169.254.169.254, file://, gopher://, internal
 *  Postgres at cv-postgres:5432, etc.) because Playwright honours every
 *  <img src>, <link href> and <script src>. The allowlist below covers
 *  exactly what our renderer legitimately needs: HTTPS Google Fonts +
 *  same-origin photos + data: URLs (inline base64). Everything else gets
 *  aborted before the network request leaves the container. */
async function optionalAuth(req, _res, next) {
  try { req.user = await loadUser(req); } catch { req.user = null; }
  next();
}

app.post('/api/pdf', optionalAuth, rateLimit({ route: 'pdf', max: 60, windowMs: 60 * 60 * 1000 }), async (req, res) => {
  const { html, filename, pageFormat } = req.body || {};
  if (typeof html !== 'string' || html.length < 30) {
    return res.status(400).json({ error: 'Field "html" is required.' });
  }
  // Cap HTML payload size so a hostile user can't push 12 MB of <img> tags
  // and keep the Chromium busy.
  if (html.length > 2_000_000) {
    return res.status(413).json({ error: 'HTML payload exceeds 2 MB limit.' });
  }
  const fmt = PDF_FORMAT_MAP[pageFormat] || 'A4';
  /* Der „eigene Host" für die SSRF-Prüfung kommt aus der Konfiguration, nicht
   * aus einem Header — sonst erweitert der Aufrufer die Allowlist selbst. */
  const ownHost = (() => {
    const base = publicBaseUrl(req);
    try { return base ? new URL(base).host : null; } catch { return null; }
  })();
  let page;
  try {
    const browser = await getBrowser();
    /* Each PDF request runs in its OWN browser context, not a shared default —
     * that way the abort-route, no-JS setting and timeouts can't leak between
     * concurrent users and a crashed page doesn't take down the singleton. */
    const ctx = await browser.newContext({ javaScriptEnabled: false, bypassCSP: false });
    page = await ctx.newPage();
    // SSRF guard: abort every request whose URL falls outside the allowlist.
    // Belt-and-suspenders with the no-script context (above) so even resource
    // loaders for fonts/images cannot reach private hosts.
    await page.route('**', (route) => {
      const url = route.request().url();
      if (isPdfFetchAllowed(url, ownHost)) return route.continue();
      console.warn(`[pdf] blocked SSRF candidate: ${url}`);
      return route.abort();
    });
    await page.emulateMedia({ media: 'print' });
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 20000 });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      format: fmt,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    const requested = filename || 'Lebenslauf.pdf';
    // Strip anything weird, keep umlauts + dashes + underscores for the UTF-8 filename*.
    const utf8 = requested.replace(/[^\w.\-äöüÄÖÜß]/g, '_');
    // ASCII fallback for old clients: transliterate umlauts.
    const ascii = utf8
      .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
      .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
      .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .replace(/[^\w.\-]/g, '_');
    logEvent(req.user?.id ?? null, 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    // RFC 5987 — modern browsers prefer the filename* with UTF-8 encoding.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`,
    );
    res.send(pdf);
  } catch (err) {
    console.error('pdf render failed:', err);
    res.status(500).json({ error: 'PDF rendering failed' });
  } finally {
    // Close BOTH the page and its parent context so the per-request isolation
    // actually frees memory. Without the context-close the BrowserContext leaks
    // and accumulates over hours of usage.
    if (page) {
      const ctx = page.context();
      await page.close().catch(() => {});
      await ctx.close().catch(() => {});
    }
  }
});

// ── Start ───────────────────────────────────────────────────────────────────

// Bootstrap admin account from env vars. Source of truth is Coolify env, not
// the DB — so a forgotten password is recoverable by updating the env value
// and redeploying. Runs on every boot; safe to leave the env set permanently.
async function bootstrapAdmin() {
  const u = (process.env.ADMIN_USERNAME || '').trim();
  const p = process.env.ADMIN_PASSWORD || '';
  if (!u || !p) return;
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(u)) { console.warn('bootstrap: ADMIN_USERNAME invalid — skipped'); return; }
  if (p.length < 8) { console.warn('bootstrap: ADMIN_PASSWORD too short — skipped'); return; }
  try {
    const hash = await bcrypt.hash(p, 10);
    const { rows } = await pool.query('SELECT id FROM users WHERE lower(username) = lower($1)', [u]);
    if (!rows[0]) {
      await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [u, hash, 'admin']);
      console.log(`bootstrap: admin '${u}' created`);
    } else {
      await pool.query('UPDATE users SET password_hash = $1, role = $2, disabled = false WHERE id = $3', [hash, 'admin', rows[0].id]);
      console.log(`bootstrap: admin '${u}' password reset from env`);
    }
  } catch (err) {
    console.error('bootstrap: admin reset failed:', err);
  }
}

const port = process.env.PORT || 3000;
initDb()
  .then(() => bootstrapAdmin())
  .then(() => app.listen(port, () => console.log(`cv-api listening on :${port}`)))
  .catch(err => { console.error('FATAL: db init failed', err); process.exit(1); });
