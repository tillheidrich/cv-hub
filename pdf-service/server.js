// cv-api — CV-Hub backend
// Invite-only auth (username + password), résumé storage, admin, PDF rendering.

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { mountOAuth, userForAccessToken } from './oauth.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { readFileSync } from 'node:fs';
import { pool, initDb, logEvent } from './db.js';
import { cvToMarkdown, markdownToCV, clToMarkdown, markdownToCl, MAX_MARKDOWN_CHARS } from './markdown.js';
import { sendMail, mailConfigured, onMailResult, tplInvite, tplWelcome, tplPasswordReset, tplPasswordChanged, tplEmailChanged, tplOffboarding, tplLoginCode, tplAccessRequest } from './mail.js';
import { securityHeaders, trustProxyWarning, assertPayloadSize, createLimiter, BusyError, originGuard, subnetOf, clientKey } from './guards.js';
import { createRenderer, rendererHosts, MAX_PAGES } from './pdf.js';
import { buildShareSnapshot, shareResponse } from './share.js';
import { prunePhotos, startJanitor } from './janitor.js';
import { accessInfo, requireWritable, isAccessExpired, startAccessNotices, MAX_ACCESS_DAYS, planInfo, passRequiredMessage } from './access.js';
import { createBilling, billingConfig } from './billing.js';
import { addGrant, planDetails } from './grants.js';
import { createVouchers } from './vouchers.js';
import { createAltcha } from './altcha.js';
import { tplConfirmEmail, tplConfirmEmailChange, tplEmailChangeTaken, tplEmailChangeRequested, tplRegisterExisting } from './mailtexts/index.js';
import { createAdmin, adminConfig } from './admin.js';
import { ART9_VERSION, art9Info, hasArt9Consent, requireArt9Consent, legalVersions } from './consent.js';
import { createStats } from './stats.js';

/* Befund N10 (08.10.2026): Die alte Prüfung ließ Klammern, Anführungszeichen,
 * spitze Klammern und Kommas durch. Genau diese Zeichen bilden die
 * RFC-5322-Kommentare und Gruppen, über die nodemailers Adressparser Post an
 * eine fremde Domain zustellen ließ. Eine Adresse aus einem freien Formular
 * braucht keins davon. */
const EMAIL_RE = /^[^\s@()<>",;:\\[\]]+@[^\s@()<>",;:\\[\]]+\.[^\s@()<>",;:\\[\]]+$/;

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
/* Nur für Integrationstests, die viele Konten von 127.0.0.1 anlegen: hebt alle
 * Grenzen um diesen Faktor an. Greift ausschließlich bei NODE_ENV=test. */
const RATE_FACTOR = process.env.NODE_ENV === 'test' ? Math.max(1, Number.parseInt(process.env.TEST_RATE_LIMIT_FACTOR || '1', 10) || 1) : 1;
function rateLimit({ route, max: baseMax, windowMs }) {
  const max = baseMax * RATE_FACTOR;
  return (req, res, next) => {
    // req.ip wird von Express aus 'trust proxy' abgeleitet (rechter, vom
    // vertrauten Proxy gesetzter Hop) und ist NICHT client-spoofbar. Den rohen
    // X-Forwarded-For-Header direkt zu lesen (linker Wert) hebelte das Rate-
    // Limiting komplett aus. (Security-Review-Finding #1.)
    // M3 (09.10.2026): IPv6 je /64, nicht je einzelner Adresse (guards.js).
    const ip = clientKey(req.ip);
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
/* Zähler, die nicht an der Adresse hängen, sondern an einem Ziel (Konto,
 * Mailadresse). bucketBlocked prüft nur, bucketHit zählt. So zählt der
 * Login je Konto nur Fehlversuche, und die Reset-Mail je Adresse nur
 * verschickte Mails. */
function bucketBlocked(key, baseMax) {
  const b = rateBuckets.get(key);
  if (!b || b.reset < Date.now()) return 0;
  return b.count >= baseMax * RATE_FACTOR ? Math.ceil((b.reset - Date.now()) / 1000) : 0;
}
function bucketHit(key, windowMs) {
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.reset < now) rateBuckets.set(key, { count: 1, reset: now + windowMs });
  else b.count += 1;
}
/* Dasselbe je Netz statt je Adresse (offene Registrierung, öffentlicher
 * Widerruf, Login, anonymes PDF): IPv4 je /24, IPv6 je /64. Wer viele
 * Adressen eines Netzes hat, teilt sich einen Eimer. subnetOf steht in
 * guards.js (mit Test). */
function subnetLimit({ route, max, windowMs }) {
  const inner = rateLimit({ route: `${route}/net`, max, windowMs });
  return (req, res, next) => inner({ ip: subnetOf(req.ip) }, res, next);
}

// Janitor — purge stale entries every 5min so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (v.reset < now) rateBuckets.delete(k);
}, 5 * 60 * 1000).unref?.();

/* Vorlagenliste aus EINER Quelle.
 *
 * Hier stand bis zum 08.10.2026 eine Handliste mit dem Kommentar „muss mit
 * theme.ts synchron bleiben" — fünf Phantom-IDs, fünf ausgemusterte, acht
 * fehlende. Jetzt erzeugt scripts/sync-templates.mjs die Datei templates.json
 * aus app/src/templates/theme.ts (PICKABLE_THEMES); templates.test.mjs
 * schlägt an, sobald beide auseinanderlaufen. */
const TEMPLATE_DATA = JSON.parse(readFileSync(new URL('./templates.json', import.meta.url), 'utf8'));
const TEMPLATES = TEMPLATE_DATA.templates;
const FONT_PAIRING_IDS = TEMPLATE_DATA.fontPairings;

/* Admin-Bereich auf eigener Adresse und Nutzungszähler (Runde 8b,
 * 10.10.2026; admin.js, stats.js, ADMIN.md). `admin` entsteht weiter unten,
 * wenn Bezahlung und Gutscheine stehen; die Host-Weiche greift erst bei
 * Anfragen darauf zu. */
const ADMIN_CFG = adminConfig();
let admin = null;
const STARTED_AT = new Date().toISOString();
const stats = createStats({ pool, templateIds: new Set(TEMPLATES.map(t => t.id)), flushMs: process.env.NODE_ENV === 'test' ? 0 : 15_000 });
onMailResult(ok => stats.count(ok ? 'mail_sent' : 'mail_failed'));

const app = express();
// Kein „x-powered-by: Express" (N5) — verrät nur die Angriffsfläche.
app.disable('x-powered-by');
app.use(securityHeaders);
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
app.use(trustProxyWarning(app));
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
/* M6 (09.10.2026): Fremder Ursprung → 403 vor jedem Handler (guards.js),
 * nicht mehr 500 aus der Fehler-Middleware. Ausgenommen sind nur die
 * OAuth-Endpunkte ohne Cookie, die ausdrücklich für Browser-Clients gedacht
 * sind (Access-Control-Allow-Origin: *, siehe oauth.js) — dort schützt PKCE,
 * nicht der Ursprung. */
const PUBLIC_CORS_PATHS = new Set([
  '/api/oauth/token', '/api/oauth/register', '/api/oauth/revoke',
  '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp',
  '/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/mcp',
]);
const guardOrigin = originGuard(ALLOWLIST);
/* Host-Weiche für den Admin-Bereich VOR der allgemeinen Ursprungsprüfung:
 * Auf dem Admin-Host gilt nur dessen eigener Ursprung (admin.js). */
app.use((req, res, next) => admin.gate(req, res, next));
app.use((req, res, next) => (PUBLIC_CORS_PATHS.has(req.path) || req.adminScope === 'separate' ? next() : guardOrigin(req, res, next)));
app.use(cors({
  // Same-origin requests (no Origin header) always pass — they're either
  // server-to-server, curl, or the SPA itself hitting its own backend. Ein
  // fremder Ursprung kommt hier nur noch auf den öffentlichen OAuth-Wegen an:
  // keine CORS-Freigabe mit Cookies, die Handler setzen selbst „*“.
  origin: (origin, cb) => cb(null, !origin || ALLOWLIST.has(origin)),
  credentials: true,
}));
app.use(cookieParser());
/* JSON-Grenzen (Befund 5). Vorher galten 12 MB für jeden Endpunkt, auch für
 * nicht angemeldete: Jeder Login-Versuch durfte 12 MB JSON schicken, die
 * geparst wurden. Jetzt 1 MB für alles, mit genau zwei Ausnahmen:
 * Foto-Upload (4 MB Bild ≈ 5,4 MB Base64) und PDF (bis 3 MB HTML, als JSON
 * maskiert etwas mehr, eingebettetes Foto eingeschlossen). */
const jsonDefault = express.json({ limit: '1mb' });
const jsonPhoto = express.json({ limit: '6mb' });
const jsonPdf = express.json({ limit: '4mb' });
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/photos') return jsonPhoto(req, res, next);
  if (req.method === 'POST' && req.path === '/api/pdf') return jsonPdf(req, res, next);
  return jsonDefault(req, res, next);
});
// Tageszähler ohne Personenbezug (stats.js). Zählt erst nach der Antwort.
app.use(stats.middleware);

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
/* Dieselbe Marke auf die Millisekunde (08.10.2026). In Sekunden überlebte eine
 * Sitzung einen Reset, der in derselben Sekunde wie die Anmeldung geschah.
 * Neue Sitzungen tragen beide Marken; geprüft wird die genaue, wenn sie da
 * ist — alte Sitzungen gelten deshalb beim Deploy weiter. */
function pwdVersionMs(user) {
  return user?.password_changed_at ? new Date(user.password_changed_at).getTime() : 0;
}

function issueSession(res, user) {
  const token = jwt.sign({ uid: user.id, pcat: pwdVersion(user), pcm: pwdVersionMs(user) }, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400 * 1000,
  });
}

/** Bestätigt gilt jede Adresse aus Einladung und Bestand; nur selbst
 *  registrierte Konten brauchen den Klick in der Mail. */
function emailConfirmed(u) {
  return u?.signup_source !== 'self' || !!u?.email_confirmed_at;
}

function publicUser(u) {
  return {
    id: u.id, username: u.username, role: u.role, email: u.email ?? null,
    twofaEnabled: !!u.twofa_enabled, createdAt: u.created_at,
    // Laufzeit des Kontos (Pilot). null = unbegrenzt. Siehe access.js.
    access: accessInfo(u),
    // Bezahlmodell (09.10.2026): unlimited | pilot | pass | none.
    plan: planInfo(u),
    emailConfirmed: emailConfirmed(u),
    // M2: angeforderte neue Adresse, bis sie bestätigt ist. Bis dahin gilt `email`.
    pendingEmail: u.pending_email ?? null,
    // P9 (B4, 10.10.2026): Einwilligung Art. 9 DSGVO — ohne sie speichert das Konto nicht.
    art9: art9Info(u),
    // P8: Fassung der AGB, die bei der Registrierung galt (null bei Bestandskonten).
    termsAcceptedVersion: u.terms_accepted_version ?? null,
    // Runde 8b: Admins sehen in der App nur noch einen Link zum Admin-Bereich.
    ...(u.role === 'admin' ? { adminUrl: ADMIN_CFG.url ? `${ADMIN_CFG.url}/` : '/admin/' } : {}),
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

/* Woher die Anmeldung kommt (Sitzung, API-Schlüssel, OAuth/MCP). Nicht
 * aufzählbar, damit es in keiner JSON-Antwort landet. Gebraucht vom
 * Gutschein-Einlösen, das nur mit Sitzung geht. */
function markAuth(u, via) {
  Object.defineProperty(u, 'authVia', { value: via, enumerable: false });
  return u;
}

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
        return markAuth(rows[0], 'apikey');
      }
    } catch { /* fall through to cookie */ }
  }
  // 1b. OAuth-Access-Token (MCP-Clients, pro Nutzer ausgestellt). Gilt überall
  // dort, wo auch ein API-Schlüssel gilt — dieselbe Stelle, dieselben Rechte.
  if (auth && auth.startsWith('Bearer cvm_')) {
    try {
      const u = await userForAccessToken(pool, auth.slice(7).trim());
      if (u) return markAuth(u, 'oauth');
    } catch { /* fall through to cookie */ }
  }
  // 2. cookie session (browser)
  const token = req.cookies?.[COOKIE];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose) return null;                 // ein Aktions-Token ist keine Sitzung
    /* Abgemeldete Sitzungen stehen mit dem Hash ihres Tokens in
     * session_revocations (N7). Eine Abfrage, kein zweiter Rundgang. */
    const { rows } = await pool.query(
      `SELECT u.*, EXISTS (SELECT 1 FROM session_revocations r WHERE r.token_hash = $2) AS session_revoked
         FROM users u WHERE u.id = $1`,
      [decoded.uid, sha256(token)],
    );
    const u = rows[0];
    if (!u || u.disabled || u.session_revoked) return null;
    delete u.session_revoked;
    // Passwortwechsel entwertet ältere Sessions. Fehlt der Claim (Alt-Token vor
    // Einführung), gilt 0 — dann kein Zwangs-Logout beim Deploy, aber ein
    // späterer Passwortwechsel invalidiert auch diese. (Finding #7.)
    if (decoded.pcm !== undefined) {
      if (decoded.pcm !== pwdVersionMs(u)) return null;
    } else if ((decoded.pcat ?? 0) !== pwdVersion(u)) return null;
    return markAuth(u, 'session');
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  // /api/admin/*: eigene Anmeldung (admin.js). Mit ADMIN_HOST zählt dort nur
  // die Admin-Sitzung, nie das Cookie der Hauptdomain oder ein API-Schlüssel.
  if (req.adminScope) return admin.authenticate(req, res, next);
  const u = await loadUser(req);
  if (!u) return res.status(401).json({ error: 'Nicht angemeldet.' });
  req.user = u;
  pool.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [u.id]).catch(() => {});
  next();
}

function requireAdmin(req, res, next) {
  if (req.adminScope) return admin.needAdmin(req, res, next);
  // Außerhalb von /api/admin/* gibt es keine Admin-Routen; zur Sicherheit 403.
  return res.status(403).json({ error: 'Nur für Administratoren.' });
}

// ── OAuth 2.1 für den MCP-Endpunkt ──────────────────────────────────────────
// Liegt hier, weil hier Nutzer, Sessions und Datenbank sind: nur so kann jeder
// Nutzer seinen eigenen Client verbinden. Die Zustimmungsseite läuft gegen die
// bestehende Anmeldung — kein zweites Passwort, kein geteiltes Token.
mountOAuth(app, {
  pool,
  loadUser,
  requireAuth,
  baseUrlOf: publicBaseUrl,
  appName: process.env.APP_NAME || 'CV-Hub',
  urlencoded: express.urlencoded({ extended: false, limit: '64kb' }),
  // Die KI-Verbindung ist eine Pass-Funktion: ohne aktiven Pass keine neue.
  canConnect: user => planInfo(user)?.kind !== 'none',
  cannotConnectMessage: passRequiredMessage(),
  registerLimit: rateLimit({ route: 'oauthreg', max: 20, windowMs: 60 * 60 * 1000 }),
});

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
function generateCode() {
  const pick = n => Array.from({ length: n }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');
  return `${pick(4)}-${pick(4)}`;
}

// ── Health / templates ──────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, service: 'cv-api' }));
app.get('/api/templates', (_req, res) => res.json({ templates: TEMPLATES, fontPairings: FONT_PAIRING_IDS }));

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

/* ── Offene Registrierung (09.10.2026) ──────────────────────────────────────
 *
 * OPEN_REGISTRATION=1: Konto mit E-Mail und Passwort, ohne Einladungscode.
 * Bot-Schutz über ALTCHA (selbst geprüft), Begrenzung je Adresse und je Netz,
 * Pflicht-Häkchen „ab 16“. Das Konto ist sofort angemeldet, aber noch nicht
 * bestätigt; die Mail mit dem Bestätigungslink gilt 48 Stunden. Unbestätigte
 * Konten ohne Kauf löscht der Aufräumjob danach (janitor.js). Neue Konten
 * starten ohne Pass (plan.kind 'none'): lesen ja, schreiben erst mit Pass.
 * Einladungscodes gehen weiter den bisherigen Weg. */
const OPEN_REGISTRATION = /^(1|true|yes|on)$/i.test(String(process.env.OPEN_REGISTRATION || '').trim());
const altcha = createAltcha({ pool });
const CONFIRM_HOURS = 48;

/* kind 'signup': bestätigt die Adresse des Kontos (Double-Opt-in).
 * kind 'change' (M2, 09.10.2026): bestätigt eine NEUE Adresse; erst der Klick
 * macht sie zur Adresse des Kontos. Ein neuer Link entwertet alle älteren. */
async function issueEmailConfirmation(user, base, lang = 'de', { kind = 'signup', email = user.email } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const to = String(email).toLowerCase();
  await pool.query('UPDATE email_confirmations SET used = true WHERE user_id = $1 AND NOT used', [user.id]);
  await pool.query(
    `INSERT INTO email_confirmations (token_hash, user_id, email, expires_at, kind) VALUES ($1, $2, $3, now() + make_interval(hours => $4), $5)`,
    [sha256(token), user.id, to, CONFIRM_HOURS, kind],
  );
  if (!base) {
    console.error('confirm-email: keine Basis-URL bekannt (PUBLIC_BASE_URL setzen) — Bestätigungsmail nicht verschickt.');
    return false;
  }
  const productName = (process.env.PRODUCT_NAME || 'CV-Hub').trim();
  const tpl = kind === 'change' ? tplConfirmEmailChange({ token, base, lang, productName }) : tplConfirmEmail({ token, base, lang, productName });
  return sendMail({ to, ...tpl });
}

/** Nutzername aus der Mailadresse, wenn keiner angegeben ist: lokaler Teil,
 *  bereinigt, plus vier Zeichen Zufall. Angemeldet wird mit der Adresse. */
async function generateUsername(client, email) {
  const local = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9_.-]/g, '').replace(/^[._-]+/, '').slice(0, 20) || 'konto';
  for (let i = 0; i < 8; i++) {
    const name = `${local.length < 3 ? `${local}konto` : local}-${crypto.randomBytes(2).toString('hex')}`;
    const { rowCount } = await client.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [name]);
    if (!rowCount) return name;
  }
  return `konto-${crypto.randomBytes(6).toString('hex')}`;
}

/* P8/P9 (B4, 10.10.2026): Bei der Registrierung merkt sich das Konto die
 * Fassung der AGB, die in diesem Moment galt (Hinweis unter dem Knopf,
 * § 305 Abs. 2 BGB), und — wenn das Formular sie mitschickt — die
 * Einwilligung nach Art. 9 DSGVO in genau der Textfassung, die der Server
 * kennt. Eine andere Fassung zählt nicht; dann fragt der Dialog in der App. */
function signupArt9Version(body) {
  return String(body?.art9Consent?.version || '') === ART9_VERSION ? ART9_VERSION : null;
}
const signupTermsVersion = () => legalVersions().terms;

async function registerOpen(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const wanted = String(req.body?.username || '').trim();
  if (!EMAIL_RE.test(email) || email.length > 200) return res.status(400).json({ error: 'E-Mail-Adresse ungültig.', code: 'email_invalid' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben.', code: 'password_short' });
  if (wanted && !/^[a-zA-Z0-9_.-]{3,32}$/.test(wanted)) return res.status(400).json({ error: 'Nutzername: 3–32 Zeichen (Buchstaben, Zahlen, . _ -).' });
  if (req.body?.ageConfirmed16 !== true) {
    return res.status(400).json({ error: 'Ein Konto ist ab 16 Jahren möglich. Bitte bestätige dein Alter.', code: 'age16_required' });
  }
  if (!altcha.configured) {
    console.error('register: OPEN_REGISTRATION=1, aber ALTCHA_HMAC_KEY fehlt — offene Registrierung abgewiesen.');
    return res.status(503).json({ error: 'Die Registrierung ist gerade nicht verfügbar.', code: 'registration_unavailable' });
  }
  const check = await altcha.verify(req.body?.altcha);
  if (!check.ok) return res.status(400).json({ error: 'Die Sicherheitsprüfung ist fehlgeschlagen. Bitte noch einmal versuchen.', code: 'altcha_invalid' });

  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const dupE = await client.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
    if (dupE.rowCount) {
      await client.query('ROLLBACK');
      /* N5: Die Antwort bleibt (die Oberfläche meldet direkt an, ein
       * einheitliches „Mail ist unterwegs“ braucht einen anderen Ablauf,
       * siehe SICHERHEIT.md). Dafür erfährt der Inhaber der Adresse davon —
       * höchstens einmal am Tag, sonst wäre das ein Mailwerfer. */
      const k = `register-existing:${email}`;
      if (!bucketBlocked(k, 1)) {
        bucketHit(k, 24 * 60 * 60 * 1000);
        sendMail({ to: email, ...tplRegisterExisting({ base: publicBaseUrl(req) }) }).catch(() => {});
      }
      return res.status(409).json({ error: 'Für diese E-Mail-Adresse gibt es schon ein Konto. Melde dich an oder setze das Passwort zurück.', code: 'email_taken' });
    }
    if (wanted) {
      const dup = await client.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [wanted]);
      if (dup.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Nutzername ist bereits vergeben.', code: 'username_taken' }); }
    }
    const username = wanted || await generateUsername(client, email);
    const hash = await bcrypt.hash(password, 10);
    /* access_until = jetzt: Das Konto hat keine Laufzeit, die läuft — es
     * ist ab dem ersten Augenblick „ohne Pass“ (plan_kind 'none'). Der erste
     * Kauf setzt die Laufzeit ab jetzt. */
    const { rows } = await client.query(
      `INSERT INTO users (username, password_hash, role, email, password_changed_at, access_until,
                          signup_source, plan_kind, age_confirmed_16_at,
                          terms_accepted_version, terms_accepted_at, art9_consent_version, art9_consent_at)
       VALUES ($1, $2, 'user', $3, now(), now(), 'self', 'none', now(),
               $4, now(), $5::text, CASE WHEN $5::text IS NULL THEN NULL ELSE now() END) RETURNING *`,
      [username, hash, email, signupTermsVersion(), signupArt9Version(req.body)],
    );
    user = rows[0];
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err?.code === '23505') return res.status(409).json({ error: 'Für diese E-Mail-Adresse gibt es schon ein Konto.', code: 'email_taken' });
    console.error('register (offen) failed:', err?.message || err);
    return res.status(500).json({ error: 'Registrierung fehlgeschlagen.' });
  } finally {
    client.release();
  }
  logEvent(user.id, 'register_open');
  issueSession(res, user);
  res.json({ user: publicUser(user), emailConfirmed: false, plan: planInfo(user) });
  const lang = String(req.body?.lang || req.get('accept-language') || 'de').slice(0, 2).toLowerCase();
  issueEmailConfirmation(user, publicBaseUrl(req), lang).catch(err => console.error('confirm-email failed:', err?.message || err));
}

// Register: 10/hour/IP — keeps invite-burning bots in check.
app.post('/api/auth/register', rateLimit({ route: 'register', max: 10, windowMs: 60 * 60 * 1000 }), async (req, res, next) => {
  /* Offener Weg nur ohne Einladungscode und nur, wenn es schon Konten gibt
   * (das erste Konto wird wie bisher der Admin). Zusätzlich je Netz begrenzt. */
  if (OPEN_REGISTRATION && !String(req.body?.inviteCode || '').trim()) {
    const { rows } = await pool.query('SELECT EXISTS (SELECT 1 FROM users) AS any');
    if (rows[0].any) {
      return subnetLimit({ route: 'register-open', max: 30, windowMs: 60 * 60 * 1000 })(req, res, () => {
        rateLimit({ route: 'register-open', max: 5, windowMs: 60 * 60 * 1000 })(req, res, () => {
          registerOpen(req, res).catch(next);
        });
      });
    }
  }
  return next();
}, async (req, res) => {
  let username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
  const email = String(req.body?.email || '').trim().toLowerCase();
  /* Das neue Registrierungsformular fragt keinen Nutzernamen mehr ab — auch
   * nicht mit Einladungscode. Dann entsteht er aus der Adresse. */
  if (!username && email && EMAIL_RE.test(email)) username = await generateUsername(pool, email);

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
    let accessDays = null;   // Laufzeit des Platzes aus dem Code (Pilot)

    if (firstUser) {
      role = 'admin'; // bootstrap: first account is the admin, no code needed
    } else {
      if (!inviteCode) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode erforderlich.' }); }
      const { rows: ic } = await client.query('SELECT * FROM invite_codes WHERE code = $1 FOR UPDATE', [inviteCode]);
      const code = ic[0];
      if (!code || code.revoked) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode ungültig.' }); }
      if (code.expires_at && new Date(code.expires_at) < new Date()) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode ist abgelaufen.' }); }
      if (code.uses >= code.max_uses) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Einladungscode wurde bereits aufgebraucht.' }); }
      /* N8: Ein an eine Adresse gebundener Code war nur dem Namen nach
       * gebunden — gespeichert wurde die Adresse, verglichen nie. */
      if (code.email && String(code.email).trim().toLowerCase() !== email) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Dieser Einladungscode gilt nur für die E-Mail-Adresse, an die er geschickt wurde. Bitte genau diese Adresse angeben.' });
      }
      if (Number.isInteger(code.access_days) && code.access_days > 0) accessDays = code.access_days;
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
      `INSERT INTO users (username, password_hash, role, email, password_changed_at, access_until,
                          terms_accepted_version, terms_accepted_at, art9_consent_version, art9_consent_at)
       VALUES ($1, $2, $3, $4, now(), NULL, $5, now(), $6::text, CASE WHEN $6::text IS NULL THEN NULL ELSE now() END) RETURNING *`,
      [username, hash, role, email || null, signupTermsVersion(), signupArt9Version(req.body)],
    );
    let user = created[0];
    /* Laufzeit aus dem Code als Berechtigung (grants.js); die Neuberechnung
     * setzt access_until = jetzt + access_days. Ohne Laufzeit bleibt das
     * Konto unbegrenzt (keine Zeile). */
    if (accessDays) {
      await addGrant(client, user.id, { source: 'pilot', sourceId: inviteCode, kind: 'days', days: accessDays });
      ({ rows: [user] } = await client.query('SELECT * FROM users WHERE id = $1', [user.id]));
    }

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
/* M3 (09.10.2026): Das Limit je Adresse allein half nicht gegen Proxy-Pools
 * mit wechselnden Adressen. Dazu jetzt: je Netz (/24 bzw. /64) 20 in 15
 * Minuten und je Konto 10 Fehlversuche in der Stunde. Das Konto-Limit kann
 * ein Angreifer bewusst auslösen (Anmeldung eine Stunde gesperrt) — das ist
 * der Preis dafür, dass verteiltes Raten nicht mehr geht. */
const LOGIN_ACCOUNT_FAILS = 10;
const LOGIN_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;
app.post('/api/auth/login', rateLimit({ route: 'login', max: 5, windowMs: 15 * 60 * 1000 }), subnetLimit({ route: 'login', max: 20, windowMs: 15 * 60 * 1000 }), async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  try {
    /* Anmeldung mit Nutzername ODER E-Mail-Adresse — selbst registrierte
     * Konten kennen ihren erzeugten Nutzernamen nicht. Ein @ kommt in
     * Nutzernamen nicht vor, die beiden Wege können sich nicht überschneiden. */
    const { rows } = username.includes('@')
      ? await pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [username])
      : await pool.query('SELECT * FROM users WHERE lower(username) = lower($1)', [username]);
    const user = rows[0];
    // Je Konto, nicht je Schreibweise: Name und Adresse teilen sich den Zähler.
    const acctKey = user ? `login:acct:id:${user.id}` : `login:acct:name:${username.toLowerCase().slice(0, 200)}`;
    const blockedFor = bucketBlocked(acctKey, LOGIN_ACCOUNT_FAILS);
    if (blockedFor) {
      res.setHeader('Retry-After', blockedFor);
      return res.status(429).json({ error: `Zu viele Fehlversuche für dieses Konto. Bitte ${blockedFor}s warten oder das Passwort zurücksetzen.`, code: 'account_locked' });
    }
    // Immer einen bcrypt-Vergleich ausführen (Dummy-Hash bei fehlendem Nutzer),
    // damit die Antwortzeit keine gültigen Nutzernamen verrät. (Finding #5.)
    const passOk = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
    if (!user || !passOk) {
      bucketHit(acctKey, LOGIN_ACCOUNT_WINDOW_MS);
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

/* Abmelden entwertet die Sitzung jetzt auch auf dem Server (N7).
 *
 * Vorher wurde nur das Cookie gelöscht; das JWT galt 30 Tage weiter. Wer es
 * vorher abgegriffen hatte, blieb angemeldet. Jetzt landet der Hash des
 * Tokens bis zu seinem Ablauf in einer Sperrtabelle — die kleinste Lösung,
 * die einzelne Geräte abmeldet, ohne alle anderen mitzunehmen. */
app.post('/api/auth/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const exp = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
      await pool.query(
        'INSERT INTO session_revocations (token_hash, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (token_hash) DO NOTHING',
        [sha256(token), decoded.uid ?? null, exp],
      );
    } catch { /* ungültiges oder abgelaufenes Token: nichts zu sperren */ }
  }
  res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: 'lax' });
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const user = publicUser(req.user);
  // Plan mit Herkunft (grants, freeUntil, hasPaid) — siehe grants.js planDetails.
  user.plan = await planDetails(pool, req.user);
  res.json({ user });
});

/* Dasselbe unter dem kürzeren Pfad, mit der Laufzeit zusätzlich oben.
 * access: null = unbegrenzt; sonst { until, expired, daysLeft, notice,
 * readOnly } — notice 'soon' ab 14 Tagen, 'final' ab 3 Tagen, 'expired'. */
app.get('/api/me', requireAuth, async (req, res) => {
  const user = publicUser(req.user);
  user.plan = await planDetails(pool, req.user);
  res.json({ user, access: user.access, plan: user.plan, emailConfirmed: user.emailConfirmed, pendingEmail: user.pendingEmail });
});

/* Einwilligung Art. 9 DSGVO erteilen oder widerrufen (P9, B4 10.10.2026).
 * Erteilen nur mit der Textfassung, die der Server kennt (sonst 409 — die
 * App lädt dann neu und zeigt den aktuellen Text). Widerruf leert Zeitpunkt
 * und Fassung, merkt sich den Widerruf und löscht nichts: Ab dann speichert
 * das Konto nicht mehr, Lesen, Export und Löschen gehen weiter. Beides steht
 * im Ereignisprotokoll (events: art9_consent / art9_withdraw). */
app.post('/api/me/consent/art9', rateLimit({ route: 'consent', max: 30, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
  const give = req.body?.consent === true;
  const take = req.body?.consent === false;
  if (!give && !take) return res.status(400).json({ error: 'Bitte consent: true oder false angeben.', code: 'consent_invalid' });
  // Einwilligen nur im Browser (Dialog mit Text), nicht über API-Schlüssel oder KI-Verbindung.
  if (give && req.user.authVia && req.user.authVia !== 'session') {
    return res.status(403).json({ error: 'Die Einwilligung können Sie nur in der App erteilen.', code: 'consent_session_only' });
  }
  if (give && String(req.body?.version || '') !== ART9_VERSION) {
    return res.status(409).json({ error: 'Der Einwilligungstext hat sich geändert. Bitte laden Sie die Seite neu.', code: 'consent_version_mismatch', version: ART9_VERSION });
  }
  const { rows } = give
    ? await pool.query(
      `UPDATE users SET art9_consent_at = now(), art9_consent_version = $2, art9_withdrawn_at = NULL WHERE id = $1 RETURNING *`,
      [req.user.id, ART9_VERSION])
    : await pool.query(
      `UPDATE users SET art9_consent_at = NULL, art9_consent_version = NULL,
              art9_withdrawn_at = CASE WHEN art9_consent_at IS NOT NULL THEN now() ELSE art9_withdrawn_at END
        WHERE id = $1 RETURNING *`,
      [req.user.id]);
  const u = rows[0];
  if (!u) return res.status(404).json({ error: 'Konto nicht gefunden.' });
  logEvent(u.id, give ? 'art9_consent' : 'art9_withdraw');
  const user = publicUser(u);
  user.plan = await planDetails(pool, u);
  res.json({ ok: true, consent: hasArt9Consent(u), user });
});

/* Double-Opt-in: Token aus der Mail (nur sein Hash liegt in der Datenbank).
 * Ohne Anmeldung — der Token ist die Berechtigung. Gilt nur für die Adresse,
 * an die er ging. */
app.post('/api/auth/confirm-email', rateLimit({ route: 'confirm', max: 20, windowMs: 30 * 60 * 1000 }), async (req, res) => {
  const token = String(req.body?.token || '').trim();
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) return res.status(400).json({ error: 'Der Bestätigungslink ist ungültig oder abgelaufen.', code: 'token_invalid' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT c.*, u.email AS current_email FROM email_confirmations c JOIN users u ON u.id = c.user_id
        WHERE c.token_hash = $1 FOR UPDATE OF c`,
      [sha256(token)],
    );
    const c = rows[0];
    const invalid = () => res.status(400).json({ error: 'Der Bestätigungslink ist ungültig oder abgelaufen.', code: 'token_invalid' });
    if (!c || c.used || new Date(c.expires_at) < new Date()) { await client.query('ROLLBACK'); return invalid(); }
    if (c.kind === 'change') {
      /* M2: Erst hier wird die neue Adresse die des Kontos — und zwar nur,
       * wenn sie noch die angeforderte ist und kein anderes Konto sie
       * inzwischen hat. Bestätigt ist sie damit auch. */
      const { rows: u } = await client.query('SELECT id, username, email, pending_email FROM users WHERE id = $1 FOR UPDATE', [c.user_id]);
      if (!u[0] || String(u[0].pending_email || '').toLowerCase() !== c.email) { await client.query('ROLLBACK'); return invalid(); }
      const taken = await client.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [c.email, c.user_id]);
      if (taken.rowCount) {
        await client.query('UPDATE users SET pending_email = NULL WHERE id = $1', [c.user_id]);
        await client.query('UPDATE email_confirmations SET used = true WHERE user_id = $1', [c.user_id]);
        await client.query('COMMIT');
        return res.status(409).json({ error: 'Diese Adresse gehört inzwischen zu einem anderen Konto. Bitte eine andere wählen.', code: 'email_taken' });
      }
      await client.query('UPDATE email_confirmations SET used = true WHERE user_id = $1', [c.user_id]);
      await client.query('UPDATE users SET email = $2, pending_email = NULL, email_confirmed_at = now() WHERE id = $1', [c.user_id, c.email]);
      await client.query('COMMIT');
      logEvent(c.user_id, 'email_changed');
      const old = u[0].email;
      if (old && old.toLowerCase() !== c.email) sendMail({ to: old, ...tplEmailChanged({ username: u[0].username, newEmail: c.email }) });
      return res.json({ ok: true, emailConfirmed: true, kind: 'change', email: c.email });
    }
    if (String(c.current_email || '').toLowerCase() !== c.email) { await client.query('ROLLBACK'); return invalid(); }
    await client.query('UPDATE email_confirmations SET used = true WHERE user_id = $1', [c.user_id]);
    await client.query('UPDATE users SET email_confirmed_at = coalesce(email_confirmed_at, now()) WHERE id = $1', [c.user_id]);
    await client.query('COMMIT');
    logEvent(c.user_id, 'email_confirmed');
    res.json({ ok: true, emailConfirmed: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('confirm-email failed:', err?.message || err);
    res.status(500).json({ error: 'Bestätigung fehlgeschlagen.' });
  } finally {
    client.release();
  }
});

app.post('/api/auth/resend-confirmation', rateLimit({ route: 'resend-confirm', max: 3, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
  // Offener Adresswechsel (M2): dessen Link noch einmal schicken.
  if (req.user.pending_email) {
    const taken = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [String(req.user.pending_email).toLowerCase(), req.user.id]);
    // Gleiche Antwort, auch wenn die Adresse vergeben ist (N5) — dann geht nichts hinaus.
    const sent = taken.rowCount ? true : await issueEmailConfirmation(req.user, publicBaseUrl(req), 'de', { kind: 'change', email: req.user.pending_email });
    return res.json({ ok: true, sent: !!sent, pending: true });
  }
  if (emailConfirmed(req.user)) return res.json({ ok: true, alreadyConfirmed: true });
  if (!req.user.email) return res.status(400).json({ error: 'Im Konto ist keine E-Mail-Adresse hinterlegt.' });
  const sent = await issueEmailConfirmation(req.user, publicBaseUrl(req));
  res.json({ ok: true, sent: !!sent });
});

/* ALTCHA-Aufgabe für Registrierung und öffentlichen Widerruf. */
app.get('/api/altcha/challenge', rateLimit({ route: 'altcha', max: 120, windowMs: 10 * 60 * 1000 }), async (_req, res) => {
  if (!altcha.configured) return res.status(503).json({ error: 'Die Sicherheitsprüfung ist nicht eingerichtet.' });
  res.setHeader('Cache-Control', 'no-store');
  res.json(await altcha.challenge());
});

/* Passwortwechsel, Reset und Admin-Reset trennen ALLE Zugänge (Befund 2).
 *
 * Vorher wurden nur Cookie-Sitzungen entwertet (über die Passwortmarke im
 * JWT). API-Schlüssel und OAuth-Token galten weiter. Wer eine Sitzung gekapert
 * hatte, legte sich einen Schlüssel an und behielt den Zugriff nach jedem
 * Passwortwechsel. Jetzt in derselben Transaktion wie das neue Passwort. */
async function revokeAllCredentials(client, userId) {
  const k = await client.query('UPDATE api_keys SET revoked = true WHERE user_id = $1 AND NOT revoked', [userId]);
  const t = await client.query('UPDATE oauth_tokens SET revoked = true WHERE user_id = $1 AND NOT revoked', [userId]);
  await client.query('UPDATE login_codes SET used = true WHERE user_id = $1 AND NOT used', [userId]);
  await client.query('DELETE FROM oauth_codes WHERE user_id = $1', [userId]);
  return { apiKeys: k.rowCount, connections: t.rowCount };
}

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const cur = String(req.body?.currentPassword || '');
  const nxt = String(req.body?.newPassword || '');
  if (nxt.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
  if (!(await bcrypt.compare(cur, req.user.password_hash))) {
    return res.status(403).json({ error: 'Aktuelles Passwort ist falsch.' });
  }
  const hash = await bcrypt.hash(nxt, 10);
  const client = await pool.connect();
  let user, revoked;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2 RETURNING *',
      [hash, req.user.id],
    );
    user = rows[0];
    revoked = await revokeAllCredentials(client, req.user.id);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('change-password failed:', err?.message || err);
    return res.status(500).json({ error: 'Passwortänderung fehlgeschlagen.' });
  } finally {
    client.release();
  }
  // Andere (ggf. kompromittierte) Sessions sind über die Passwortmarke
  // entwertet; die eigene aktuelle wird frisch ausgestellt.
  issueSession(res, user);
  logEvent(req.user.id, 'password_changed');
  if (user?.email) { const m = tplPasswordChanged({ username: user.username }); sendMail({ to: user.email, ...m }); }
  res.json({
    ok: true,
    revoked,
    message: 'Passwort geändert. Alle anderen Anmeldungen, API-Schlüssel und KI-Verbindungen wurden getrennt.',
  });
});

// Eigene E-Mail-Adresse setzen/ändern/entfernen (für Reset, Benachrichtigungen,
// 2FA). Leert man sie, wird 2FA sicherheitshalber automatisch deaktiviert.
//
// N6 (08.10.2026): Nur noch mit dem aktuellen Passwort. Vorher reichte eine
// Sitzung: Wer sie gekapert hatte, trug seine Adresse ein, schaltete 2FA ein
// und sperrte den Inhaber dauerhaft aus. Die alte Adresse bekommt eine
// Nachricht.
app.post('/api/auth/email', rateLimit({ route: 'setemail', max: 12, windowMs: 30 * 60 * 1000 }), requireAuth, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.currentPassword || req.body?.password || '');
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'E-Mail-Adresse ungültig.' });
  if (!password) return res.status(400).json({ error: 'Bitte zur Bestätigung das aktuelle Passwort angeben.', code: 'password_required' });
  if (!(await bcrypt.compare(password, req.user.password_hash))) {
    return res.status(403).json({ error: 'Aktuelles Passwort ist falsch.', code: 'password_wrong' });
  }
  const oldEmail = req.user.email || null;
  /* M2 (09.10.2026): Die neue Adresse wird nur vorgemerkt (pending_email).
   * Vorher wurde sie sofort übernommen, und email_confirmed_at blieb stehen —
   * eine nie bestätigte Adresse galt als bestätigt (Gutschein-Limits ließen
   * sich so mit einem einzigen Postfach leeren). Jetzt gilt bis zum Klick in
   * der Mail an die NEUE Adresse die alte.
   * N5: Die Antwort ist dieselbe, ob die Adresse frei ist oder nicht. Ist sie
   * vergeben, bekommt ihr Inhaber einen Hinweis statt eines Links. */
  if (email && email === String(oldEmail || '').toLowerCase()) {
    await pool.query('UPDATE users SET pending_email = NULL WHERE id = $1', [req.user.id]);
    await pool.query('UPDATE email_confirmations SET used = true WHERE user_id = $1 AND kind = $2 AND NOT used', [req.user.id, 'change']);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    return res.json({ ok: true, pending: false, pendingEmail: null, user: publicUser(rows[0]) });
  }
  if (email) {
    await pool.query('UPDATE users SET pending_email = $1 WHERE id = $2', [email, req.user.id]);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const dupE = await pool.query('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [email, req.user.id]);
    const base = publicBaseUrl(req);
    const lang = String(req.body?.lang || req.get('accept-language') || 'de').slice(0, 2).toLowerCase();
    if (dupE.rowCount) {
      const k = `email-change-taken:${email}`;
      if (!bucketBlocked(k, 1)) {
        bucketHit(k, 24 * 60 * 60 * 1000);
        sendMail({ to: email, ...tplEmailChangeTaken({ base }) }).catch(() => {});
      }
    } else {
      issueEmailConfirmation(rows[0], base, lang, { kind: 'change', email })
        .catch(err => console.error('email-change confirm failed:', err?.message || err));
    }
    logEvent(req.user.id, 'email_change_requested');
    if (oldEmail) sendMail({ to: oldEmail, ...tplEmailChangeRequested({ username: rows[0].username, newEmail: email }) });
    return res.json({ ok: true, pending: true, pendingEmail: email, user: publicUser(rows[0]) });
  }
  // E-Mail entfernt → 2FA kann nicht mehr greifen, also abschalten. Sofort
  // wirksam: dafür braucht es keinen Nachweis über ein Postfach.
  await pool.query('UPDATE users SET email = NULL, pending_email = NULL, twofa_enabled = false WHERE id = $1', [req.user.id]);
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  logEvent(req.user.id, 'email_changed');
  if (oldEmail) sendMail({ to: oldEmail, ...tplEmailChanged({ username: rows[0].username, newEmail: null }) });
  res.json({ ok: true, pending: false, pendingEmail: null, user: publicUser(rows[0]) });
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
  /* Befund 9: Kein fester Ersatz mehr für die Adresse im Link. Ohne
   * PUBLIC_BASE_URL/APP_BASE_URL und ohne bekannten Host geht keine Mail
   * hinaus — lieber keine als eine, die auf einen fremden Server führt. */
  const base = publicBaseUrl(req);
  res.json({ ok: true }); // früh antworten; Rest läuft best-effort im Hintergrund
  if (!id) return;
  if (!base) {
    console.error('forgot-password: keine Basis-URL bekannt (PUBLIC_BASE_URL oder APP_BASE_URL setzen) — Reset-Mail nicht verschickt.');
    return;
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE lower(email) = $1 OR lower(username) = $1',
      [id],
    );
    const user = rows[0];
    if (!user || user.disabled || !user.email) return;   // ohne hinterlegte Mail kein Reset
    await issuePasswordReset(user, { base });
  } catch (err) {
    console.error('forgot-password failed:', err?.message || err);
  }
});

/* Reset-Mail ausstellen (Selbstbedienung und Admin-Bereich, Runde 8b).
 * Offene Registrierung: erst nach bestätigter Adresse — sonst wäre ein Konto
 * mit fremder Adresse über deren Postfach übernehmbar. Höchstens drei Mails
 * je Adresse und Stunde (M3), auch auf Admin-Wunsch. */
async function issuePasswordReset(user, { base = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '') || null } = {}) {
  if (!user?.email || user.disabled) return { ok: false, status: 409, error: 'Konto ohne Adresse oder gesperrt.' };
  if (!emailConfirmed(user)) return { ok: false, status: 409, error: 'Die Adresse ist noch nicht bestätigt.' };
  if (!base) return { ok: false, status: 503, error: 'PUBLIC_BASE_URL fehlt.' };
  /* M3: höchstens drei Reset-Mails je Adresse und Stunde — unabhängig
   * davon, von wie vielen Adressen die Anfragen kommen. */
  const toKey = `forgot:to:${String(user.email).toLowerCase()}`;
  if (bucketBlocked(toKey, 3)) return { ok: false, status: 429, error: 'Für diese Adresse gingen in der letzten Stunde schon drei Mails raus.' };
  bucketHit(toKey, 60 * 60 * 1000);
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 60 min
  /* N6: gespeichert wird nur der SHA-256 des Tokens (wie bei Bestätigung,
   * API-Schlüssel und OAuth). Ein Datenbankauszug enthält damit keinen
   * benutzbaren Reset-Link mehr. */
  await pool.query(
    'INSERT INTO password_resets (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [sha256(token), user.id, expires],
  );
  logEvent(user.id, 'password_reset_requested');
  const m = tplPasswordReset({ token, base });
  const sent = await sendMail({ to: user.email, ...m });
  return sent ? { ok: true } : { ok: false, status: 502, error: 'Mailversand fehlgeschlagen.' };
}

// Setzt das Passwort per Token. Token: einmalig, 60 min gültig.
app.post('/api/auth/reset-password', rateLimit({ route: 'reset', max: 10, windowMs: 30 * 60 * 1000 }), async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const nxt = String(req.body?.newPassword || '');
  if (!token) return res.status(400).json({ error: 'Token fehlt.' });
  if (nxt.length < 8) return res.status(400).json({ error: 'Neues Passwort muss mindestens 8 Zeichen haben.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM password_resets WHERE token = $1 FOR UPDATE', [sha256(token)]);
    const pr = rows[0];
    if (!pr || pr.used || new Date(pr.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Link ist ungültig oder abgelaufen.' });
    }
    const hash = await bcrypt.hash(nxt, 10);
    // password_changed_at bump entwertet alle Alt-Sessions — wichtig, wenn der
    // Reset der Wiederherstellung nach einer Kompromittierung dient. (Finding #7.)
    await client.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [hash, pr.user_id]);
    await client.query('UPDATE password_resets SET used = true WHERE token = $1', [sha256(token)]);
    // Alle anderen offenen Tokens dieses Nutzers entwerten.
    await client.query('UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false', [pr.user_id]);
    await revokeAllCredentials(client, pr.user_id);
    await client.query('COMMIT');
    logEvent(pr.user_id, 'password_reset_done');
    // Wer sein Passwort über die Mail neu gesetzt hat, ist nicht mehr gesperrt (M3, Konto-Limit).
    rateBuckets.delete(`login:acct:id:${pr.user_id}`);
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
  // API-Schlüssel sind eine Pass-Funktion. Bestehende Schlüssel gelten weiter
  // (nur noch lesend, die Schreibwege sperren selbst).
  if (planInfo(req.user)?.kind === 'none') {
    return res.status(403).json({ error: passRequiredMessage(), code: 'pass_required', plan: planInfo(req.user) });
  }
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

const MAX_PHOTOS_PER_USER = 50;
const MAX_PHOTO_BYTES_PER_USER = 100 * 1024 * 1024;
app.post('/api/photos', requireAuth, requireWritable, requireArt9Consent, rateLimit({ route: 'photos', max: 30, windowMs: 60 * 60 * 1000 }), async (req, res) => {
  const mime = String(req.body?.mime || '');
  const b64 = String(req.body?.dataBase64 || '');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return res.status(400).json({ error: 'Nur JPEG, PNG, WebP oder GIF.' });
  let buf;
  try { buf = Buffer.from(b64, 'base64'); } catch { return res.status(400).json({ error: 'Ungültige Base64-Daten.' }); }
  if (buf.length < 100) return res.status(400).json({ error: 'Datei zu klein.' });
  if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'Maximal 4 MB.' });
  if (!imageMagicMatches(buf, mime)) return res.status(400).json({ error: 'Dateiformat passt nicht zum angegebenen MIME-Typ.' });
  /* N4: Obergrenze je Konto. Fotos ohne Verweis räumt prunePhotos nach der
   * Schonfrist ab; wer trotzdem hier ankommt, lädt in Serie hoch. */
  const { rows: q } = await pool.query('SELECT count(*)::int AS n, coalesce(sum(size_bytes), 0)::bigint AS bytes FROM photos WHERE user_id = $1', [req.user.id]);
  if (q[0].n >= MAX_PHOTOS_PER_USER || Number(q[0].bytes) + buf.length > MAX_PHOTO_BYTES_PER_USER) {
    return res.status(413).json({ error: `Höchstens ${MAX_PHOTOS_PER_USER} Fotos bzw. ${Math.round(MAX_PHOTO_BYTES_PER_USER / 1024 / 1024)} MB je Konto. Bitte nicht mehr benutzte Fotos entfernen.`, code: 'photo_quota' });
  }
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

/* Fotos nur noch für den Eigentümer (Befund 1).
 *
 * Vorher: ohne Anmeldung, `public, immutable` für ein Jahr, nicht löschbar.
 * Die Adresse stand in jedem geteilten Profil, im HTML-Export und im
 * Share-JSON. Jetzt sieht ein Foto nur, wem es gehört (Cookie oder Token);
 * Empfänger eines Sharelinks bekommen es über /api/share/:token/photo.
 * Wer keinen Zugriff hat, bekommt 404, nicht 403 — sonst wäre die Antwort
 * ein Orakel dafür, welche IDs existieren. */
const PHOTO_ID_RE = /^[0-9a-f]{24}$/;

function sendPhoto(res, p) {
  res.setHeader('Content-Type', p.mime);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Content-Disposition', 'inline');
  res.send(p.data);
}

app.get('/api/photos/:id', async (req, res) => {
  if (!PHOTO_ID_RE.test(req.params.id)) return res.status(404).send('Not found');
  const user = await loadUser(req).catch(() => null);
  if (!user) return res.status(404).send('Not found');
  const { rows } = await pool.query('SELECT mime, data FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, user.id]);
  if (!rows[0]) return res.status(404).send('Not found');
  sendPhoto(res, rows[0]);
});

/* Foto löschen. Vorher gab es dafür keinen Weg: „Foto entfernen" ließ die
 * Datei bis zur Kontolöschung in der Datenbank. Eine Profilversion oder ein
 * Sharelink, der noch darauf zeigt, zeigt danach kein Foto mehr. */
app.delete('/api/photos/:id', requireAuth, async (req, res) => {
  if (!PHOTO_ID_RE.test(req.params.id)) return res.status(404).json({ error: 'Foto nicht gefunden.' });
  const { rowCount } = await pool.query('DELETE FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rowCount) return res.status(404).json({ error: 'Foto nicht gefunden.' });
  logEvent(req.user.id, 'photo_delete');
  res.json({ ok: true });
});

/** Nach jedem Schreiben eines Profils: Fotos, auf die nichts mehr zeigt,
 *  sofort entfernen (mit kurzer Schonfrist für frische Uploads). */
function prunePhotosSoon(userId) {
  return prunePhotos(pool, userId).catch(err => console.error('prunePhotos failed:', err?.message || err));
}

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

app.post('/api/resumes/:id/share', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const id = req.params.id;
  const { rows } = await pool.query('SELECT 1 FROM resumes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  const token = crypto.randomBytes(18).toString('hex');
  const days = parseInt(req.body?.expiresInDays, 10);
  const expiresAt = Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400 * 1000) : null;
  const includeCl = req.body?.includeCoverLetter !== false; // default true
  // Fester Stand der sichtbaren Fassung (N3) — siehe share.js.
  const { rows: pr } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  const snapshot = buildShareSnapshot(pr[0].payload, token);
  await pool.query(
    'INSERT INTO share_links (token, resume_id, created_by, expires_at, include_cover_letter, snapshot) VALUES ($1, $2, $3, $4, $5, $6)',
    [token, id, req.user.id, expiresAt, includeCl, snapshot],
  );
  logEvent(req.user.id, 'share_create');
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
  await prunePhotosSoon(req.user.id);
  res.json({ ok: true });
});

/* Den festen Stand eines Links auf den aktuellen Stand des Profils bringen —
 * für den Fall, dass der Inhaber nach dem Verschicken noch etwas korrigiert
 * hat und denselben Link behalten will. */
app.post('/api/shares/:token/refresh', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.payload FROM share_links s JOIN resumes r ON r.id = s.resume_id
      WHERE s.token = $1 AND s.created_by = $2`,
    [req.params.token, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Link nicht gefunden.' });
  await pool.query('UPDATE share_links SET snapshot = $1 WHERE token = $2 AND created_by = $3',
    [buildShareSnapshot(rows[0].payload, req.params.token), req.params.token, req.user.id]);
  await prunePhotosSoon(req.user.id);
  res.json({ ok: true });
});

// Toggle the cover-letter inclusion on an existing share link.
app.patch('/api/shares/:token', requireAuth, async (req, res) => {
  const includeCl = req.body?.includeCoverLetter;
  if (typeof includeCl !== 'boolean') return res.status(400).json({ error: 'includeCoverLetter (bool) erwartet.' });
  // Nach Ablauf darf ein Link nur weniger zeigen, nicht mehr.
  if (includeCl && isAccessExpired(req.user)) return requireWritable(req, res, () => {});
  const r = await pool.query(
    'UPDATE share_links SET include_cover_letter = $1 WHERE token = $2 AND created_by = $3',
    [includeCl, req.params.token, req.user.id],
  );
  if (r.rowCount === 0) return res.status(404).json({ error: 'Link nicht gefunden.' });
  res.json({ ok: true });
});

/* Einen Link laden — für JSON, Markdown, Crawler-Karte und Foto.
 *
 * Links von vor dem 08.10.2026 haben keinen festen Stand. Sie bekommen ihn
 * beim ersten Abruf aus dem dann aktuellen Profil, gefiltert wie ein neuer
 * Link; ab da gilt dieser Stand. */
async function loadShare(token) {
  if (!/^[0-9a-fA-F]{8,64}$/.test(String(token || ''))) return { status: 404, msg: 'Link nicht gefunden.' };
  const { rows } = await pool.query(
    `SELECT s.token, s.created_by, s.expires_at, s.revoked, s.include_cover_letter, s.snapshot, r.payload
       FROM share_links s JOIN resumes r ON r.id = s.resume_id WHERE s.token = $1`,
    [token],
  );
  const s = rows[0];
  if (!s) return { status: 404, msg: 'Link nicht gefunden.' };
  if (s.revoked) return { status: 403, msg: 'Link widerrufen.' };
  if (s.expires_at && new Date(s.expires_at) < new Date()) return { status: 410, msg: 'Link abgelaufen.' };
  let snap = s.snapshot;
  if (!snap) {
    snap = buildShareSnapshot(s.payload, s.token);
    await pool.query('UPDATE share_links SET snapshot = $1 WHERE token = $2 AND snapshot IS NULL', [snap, s.token]);
  }
  return { status: 200, snap, ownerId: s.created_by, includeCoverLetter: s.include_cover_letter };
}

// Markdown variant — MUST be declared BEFORE the catch-all :token route,
// otherwise Express matches the .md suffix as part of the token param.
app.get(/^\/api\/share\/([0-9a-fA-F]+)\.md$/, async (req, res) => {
  const r = await loadShare(req.params[0]);
  if (r.status !== 200) return res.status(r.status).type('text/plain').send(r.msg);
  recordShareView(req.params[0], 'md', req.get('user-agent'));
  const { resume } = shareResponse(r.snap, { includeCoverLetter: r.includeCoverLetter });
  res.setHeader('Cache-Control', 'private, no-store');
  res.type('text/markdown; charset=utf-8').send(cvToMarkdown(resume));
});

/* Foto eines Links: nur der Zuschnitt aus dem festen Stand, nur solange der
 * Link gilt, nur wenn das Foto dem Inhaber des Links gehört. */
app.get('/api/share/:token/photo', async (req, res) => {
  const r = await loadShare(req.params.token);
  if (r.status !== 200 || !r.snap?.photoId) return res.status(404).send('Not found');
  const { rows } = await pool.query('SELECT mime, data FROM photos WHERE id = $1 AND user_id = $2', [r.snap.photoId, r.ownerId]);
  if (!rows[0]) return res.status(404).send('Not found');
  sendPhoto(res, rows[0]);
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
  const r = await loadShare(req.params[0]);
  if (r.status !== 200) return res.status(r.status).type('text/plain').send(r.msg);
  const cv = r.snap.profile?.data?.[r.snap.lang] || {};
  const name = (cv.personal && cv.personal.name) || 'Lebenslauf';
  const title = (cv.personal && cv.personal.title) || '';
  const location = (cv.personal && cv.personal.location) || '';
  /* og:image nur aus dem festen Stand und nur als Link-Foto (eigener Host,
   * eigener Pfad). Eine fremde Adresse wäre ein Zählpixel für jede Vorschau
   * (Befund #10), und eine /api/photos-Adresse funktioniert für Crawler nicht
   * mehr, seit Fotos nur der Eigentümer sieht. Die Basis kommt aus der
   * Konfiguration; fehlt sie, gibt es kein Bild. */
  const ownBase = publicBaseUrl(req);
  const photo = ownBase && r.snap.photoPath ? `${ownBase}${r.snap.photoPath}` : '';
  const description = [title, location].filter(Boolean).join(' · ') || 'Lebenslauf in editorialem Layout — geteilte Vorschau.';
  /* `reqProto`/`reqHost` gab es hier einmal. Die Härtung gegen gefälschte
     `X-Forwarded-Host`-Header hat die beiden Definitionen entfernt und diese
     Verwendung stehen lassen — seitdem warf jeder Crawler-Aufruf dieser Route
     einen ReferenceError, und weil es keine Fehler-Middleware gab, beendete
     das den Prozess. Die Basis-URL steht zwei Zeilen weiter oben schon da.
     Fehlt sie, lassen wir `og:url` weg: Eine Karte ohne kanonische Adresse
     ist ein kleiner Mangel, ein abgestürzter Dienst ist keiner. */
  const url = ownBase ? `${ownBase}/share/${req.params[0]}` : '';
  res.type('html').send(`<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(name)} — Lebenslauf</title>
<meta name="description" content="${escapeHtml(description)}">
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(name)} — Lebenslauf">
<meta property="og:description" content="${escapeHtml(description)}">
${url ? `<meta property="og:url" content="${escapeHtml(url)}">` : ''}
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
  const r = await loadShare(req.params.token);
  if (r.status !== 200) return res.status(r.status).json({ error: r.msg });
  recordShareView(req.params.token, 'html', req.get('user-agent'));
  /* Antwortform wie vorher ({ resume, include_cover_letter }) — die ShareView
   * liest sie unverändert. Inhalt: nur die sichtbare Fassung (share.js). */
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(shareResponse(r.snap, { includeCoverLetter: r.includeCoverLetter }));
});

// Export own résumé as Markdown (auth)
/* Zielsprache für die Markdown-Brücke.
 *
 * Ohne sie kommt man nur an die gerade eingestellte Sprachfassung heran. Genau
 * daran sind in einem Profil die französische und die spanische Fassung mit
 * Demo-Inhalt stehen geblieben: unsichtbar, bis jemand dort exportiert. */
const LANG_KEYS = ['de', 'en', 'fr', 'es'];
const wantedLang = v => (typeof v === 'string' && LANG_KEYS.includes(v) ? v : undefined);

app.get(/^\/api\/resumes\/([^/]+)\.md$/, requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params[0], req.user.id]);
  if (!rows[0]) return res.status(404).type('text/plain').send('Profil nicht gefunden.');
  res.type('text/markdown; charset=utf-8').send(cvToMarkdown(rows[0].payload, wantedLang(req.query.lang)));
});

// Import a corrected Markdown back into the user's profile (auth)
// Pass dryRun:true to receive the parsed payload without persisting — used by
// the Diff-Preview modal in the client.
app.post('/api/resumes/:id/import-md', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const md = String(req.body?.markdown || '');
  const dryRun = req.body?.dryRun === true;
  if (md.length < 20) return res.status(400).json({ error: 'Markdown fehlt oder zu kurz.' });
  // H1: Obergrenze vor dem Parser (ein Profil hat höchstens 200 KB, siehe guards.js).
  if (md.length > MAX_MARKDOWN_CHARS) return res.status(413).json({ error: `Markdown zu groß (höchstens ${Math.round(MAX_MARKDOWN_CHARS / 1000)} KB).`, code: 'markdown_too_large' });
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  let updated;
  try { updated = markdownToCV(md, rows[0].payload, wantedLang(req.body?.lang)); }
  catch (e) { return res.status(400).json({ error: 'Markdown-Parser-Fehler: ' + (e?.message || 'unbekannt') }); }
  updated.id = req.params.id;
  if (assertPayloadSize(res, updated)) return;
  if (dryRun) return res.json({ ok: true, payload: updated, dryRun: true });
  await snapshotResume(req.params.id, req.user.id, 'md_import');
  await pool.query('UPDATE resumes SET payload = $1, updated_at = now() WHERE id = $2 AND user_id = $3', [updated, req.params.id, req.user.id]);
  await prunePhotosSoon(req.user.id);
  logEvent(req.user.id, 'md_import');
  res.json({ ok: true, payload: updated });
});

// ── Cover-Letter Markdown (download + upload) ───────────────────────────────

app.get(/^\/api\/resumes\/([^/]+)\/cover-letter\.md$/, requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params[0], req.user.id]);
  if (!rows[0]) return res.status(404).type('text/plain').send('Profil nicht gefunden.');
  res.type('text/markdown; charset=utf-8').send(clToMarkdown(rows[0].payload, wantedLang(req.query.lang)));
});

app.post('/api/resumes/:id/import-cover-letter-md', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const md = String(req.body?.markdown || '');
  const dryRun = req.body?.dryRun === true;
  if (md.length < 10) return res.status(400).json({ error: 'Markdown fehlt oder zu kurz.' });
  if (md.length > MAX_MARKDOWN_CHARS) return res.status(413).json({ error: `Markdown zu groß (höchstens ${Math.round(MAX_MARKDOWN_CHARS / 1000)} KB).`, code: 'markdown_too_large' });
  const { rows } = await pool.query('SELECT payload FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Profil nicht gefunden.' });
  let updated;
  try { updated = markdownToCl(md, rows[0].payload, wantedLang(req.body?.lang)); }
  catch (e) { return res.status(400).json({ error: 'Markdown-Parser-Fehler: ' + (e?.message || 'unbekannt') }); }
  updated.id = req.params.id;
  if (assertPayloadSize(res, updated)) return;
  if (dryRun) return res.json({ ok: true, payload: updated, dryRun: true });
  await snapshotResume(req.params.id, req.user.id, 'cl_md_import');
  await pool.query('UPDATE resumes SET payload = $1, updated_at = now() WHERE id = $2 AND user_id = $3', [updated, req.params.id, req.user.id]);
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
  if (!/^\d{1,9}$/.test(req.params.vid)) return res.status(404).json({ error: 'Version nicht gefunden.' });
  const { rows } = await pool.query(
    `SELECT v.payload, v.source, v.created_at FROM resume_versions v
       JOIN resumes r ON r.id = v.resume_id
      WHERE v.id = $1 AND v.resume_id = $2 AND r.user_id = $3`,
    [req.params.vid, req.params.id, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Version nicht gefunden.' });
  res.json({ version: rows[0] });
});

app.post('/api/resumes/:id/versions/:vid/restore', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  if (!/^\d{1,9}$/.test(req.params.vid)) return res.status(404).json({ error: 'Version nicht gefunden.' });
  const { rows } = await pool.query(
    `SELECT v.payload FROM resume_versions v
       JOIN resumes r ON r.id = v.resume_id
      WHERE v.id = $1 AND v.resume_id = $2 AND r.user_id = $3`,
    [req.params.vid, req.params.id, req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Version nicht gefunden.' });
  const restored = { ...rows[0].payload, id: req.params.id };
  if (assertPayloadSize(res, restored)) return;
  await snapshotResume(req.params.id, req.user.id, 'restore');
  await pool.query('UPDATE resumes SET payload = $1, updated_at = now() WHERE id = $2 AND user_id = $3', [restored, req.params.id, req.user.id]);
  await prunePhotosSoon(req.user.id);
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

/* Befund 8: Hier stand die einzige Stelle, an der die Admin-Rolle fremde
 * Profile öffnete — ohne Protokoll, auch über MCP mit einem Admin-Token.
 * Gestrichen. Support braucht eine Freigabe des Nutzers, keine Hintertür. */
app.get('/api/resumes/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  const r = rows[0];
  if (!r) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.json({ resume: { id: r.id, displayName: r.display_name, payload: r.payload, updatedAt: r.updated_at } });
});

/* Obergrenze je Profil: MAX_RESUME_PAYLOAD_BYTES in guards.js (200 KB), seit
 * dem 08.10.2026 auf ALLEN Schreibwegen (assertPayloadSize). */
/** Per-user resume cap. Anyone trying to spam the table burns through 50
 *  resumes long before they make a dent. */
const MAX_RESUMES_PER_USER = 50;

app.post('/api/resumes', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const id = String(req.body?.id || crypto.randomUUID());
  // Profil-IDs sind kurz und schlicht (App: Base36, MCP: UUID). Alles andere
  // ist kein Profil, sondern ein Versuch.
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return res.status(400).json({ error: 'Ungültige Profil-ID.' });
  const displayName = String(req.body?.displayName || 'Profil').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').slice(0, 120);
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload fehlt.' });
  if (assertPayloadSize(res, payload)) return;
  // Der Payload trägt seine eigene id; fehlt sie (über MCP angelegt), gilt die der Zeile.
  if (!payload.id) payload.id = id;
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
  await prunePhotosSoon(req.user.id);
  logEvent(req.user.id, 'resume_save');
  res.json({ id });
});

app.put('/api/resumes/:id', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const displayName = String(req.body?.displayName || 'Profil').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').slice(0, 120);
  const payload = req.body?.payload;
  if (!payload || typeof payload !== 'object') return res.status(400).json({ error: 'payload fehlt.' });
  if (assertPayloadSize(res, payload)) return;
  const { rowCount } = await pool.query(
    'UPDATE resumes SET display_name = $1, payload = $2, updated_at = now() WHERE id = $3 AND user_id = $4',
    [displayName, payload, req.params.id, req.user.id],
  );
  if (!rowCount) return res.status(404).json({ error: 'Nicht gefunden.' });
  await prunePhotosSoon(req.user.id);
  res.json({ ok: true });
});

/* Nur umbenennen.
 *
 * PUT verlangt den vollständigen Payload — wer bloß den Namen ändern will,
 * müsste das ganze Profil durchreichen und könnte es dabei beschädigen. */
app.patch('/api/resumes/:id', requireAuth, requireWritable, requireArt9Consent, async (req, res) => {
  const displayName = String(req.body?.displayName || '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').trim().slice(0, 120);
  if (!displayName) return res.status(400).json({ error: 'displayName fehlt.' });
  const { rowCount } = await pool.query(
    'UPDATE resumes SET display_name = $1, updated_at = now() WHERE id = $2 AND user_id = $3',
    [displayName, req.params.id, req.user.id],
  );
  if (!rowCount) return res.status(404).json({ error: 'Nicht gefunden.' });
  res.json({ ok: true, displayName });
});

app.delete('/api/resumes/:id', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM resumes WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  await prunePhotosSoon(req.user.id);
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
    const [user, resumes, versions, shares, photos, events, apiKeys, orders, grants, redemptions, declarations] = await Promise.all([
      pool.query('SELECT id, username, email, pending_email, role, twofa_enabled, created_at, last_seen_at, access_until, plan_kind, signup_source, email_confirmed_at, age_confirmed_16_at, terms_accepted_version, terms_accepted_at, art9_consent_at, art9_consent_version, art9_withdrawn_at FROM users WHERE id = $1', [req.user.id]),
      pool.query('SELECT id, display_name, payload, created_at, updated_at FROM resumes WHERE user_id = $1', [req.user.id]),
      pool.query(`SELECT v.id, v.resume_id, v.source, v.payload, v.created_at
                    FROM resume_versions v JOIN resumes r ON r.id = v.resume_id
                   WHERE r.user_id = $1`, [req.user.id]),
      pool.query(`SELECT s.token, s.resume_id, s.expires_at, s.revoked, s.view_count, s.last_viewed_at, s.include_cover_letter, s.created_at
                    FROM share_links s WHERE s.created_by = $1`, [req.user.id]),
      pool.query('SELECT id, mime, data, size_bytes, created_at FROM photos WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT id, kind, created_at FROM events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1000', [req.user.id]),
      pool.query('SELECT id, name, prefix, created_at, last_used_at, revoked FROM api_keys WHERE user_id = $1', [req.user.id]),
      pool.query(`SELECT order_no, email, billing_name, country, sku, amount_cents, currency, status, created_at, paid_at,
                         terms_version, withdrawal_version, age_confirmed_18, consumer_confirmed, pass_days, pass_from, pass_until, invoice_no,
                         refund_status, withdrawn_at, withdraw_channel, withdraw_statement,
                         cancelled_at, cancel_kind, cancel_reason, cancel_effective_at, cancel_channel
                    FROM orders WHERE user_id = $1 ORDER BY created_at`, [req.user.id]),
      // Berechtigungen und Gutschein-Einlösungen (09.10.2026) — ohne Codes.
      pool.query(`SELECT source, kind, days, until_at, ends_at, granted_at, revoked_at, revoke_reason, effective_from, effective_until
                    FROM access_grants WHERE user_id = $1 ORDER BY granted_at, id`, [req.user.id]),
      pool.query(`SELECT redeemed_at, kind, days, granted_from, granted_until, origin
                    FROM voucher_redemptions WHERE user_id = $1 ORDER BY redeemed_at`, [req.user.id]),
      /* N8: Widerrufs- und Kündigungserklärungen gehören zum Datenauszug —
       * die des Kontos und die zu seinen Bestellungen (auch öffentlich
       * eingereichte). Ohne Bestätigungs-Token. */
      pool.query(`SELECT type, channel, name, email, order_no, received_at, statement, status, note, confirmed_at, resolved_at
                    FROM declarations
                   WHERE user_id = $1 OR order_ids && coalesce((SELECT array_agg(id) FROM orders WHERE user_id = $1), '{}'::uuid[])
                   ORDER BY received_at`, [req.user.id]),
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
      orders: orders.rows,
      accessGrants: grants.rows,
      voucherRedemptions: redemptions.rows,
      declarations: declarations.rows,
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

/* Konto löschen (Selbstbedienung und Admin-Bereich, Runde 8b): eine
 * Transaktion, dieselben Regeln für beide Wege. Gibt die Zahl der
 * aufbewahrten bezahlten Bestellungen zurück. */
async function deleteAccount({ id: userId, email: emailRaw }) {
  /* Befund 7: Die Kaskaden erfassen Profile, Versionen, Fotos, Schlüssel,
   * OAuth, Sharelinks samt Aufrufen und alle Codes. Nicht erfasst waren:
   * die Zugangsanfrage (Name, Mail, Freitext), Mail und Notiz am
   * Einladungscode („Zugangsanfrage #id · Name") und die Ereignisse (nur
   * auf NULL gesetzt). Alles in einer Transaktion: halb gelöscht gibt es
   * nicht. */
  const email = String(emailRaw || '').trim().toLowerCase();
  let retainedOrders;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (email) {
      await client.query('DELETE FROM access_requests WHERE lower(email) = $1', [email]);
      await client.query('UPDATE invite_codes SET email = NULL, note = NULL WHERE lower(email) = $1', [email]);
    }
    /* Nur Codes für genau eine Person tragen deren Namen in der Notiz. Ein
     * Code mit mehreren Plätzen (Pilot) trägt den Namen des Pakets — der
     * gehört nicht zur löschenden Person und bleibt stehen. */
    await client.query(
      `UPDATE invite_codes SET email = NULL, note = NULL
        WHERE code IN (SELECT code FROM invite_redemptions WHERE user_id = $1)
          AND (max_uses <= 1 OR email IS NOT NULL)`,
      [userId],
    );
    await client.query('DELETE FROM events WHERE user_id = $1', [userId]);
    /* Bestellungen (09.10.2026): nie bezahlte gehen mit, bezahlte bleiben
     * mit Minimaldaten stehen (Aufbewahrungspflicht, Art. 17 Abs. 3 lit. b
     * DSGVO); user_id wird über den Fremdschlüssel NULL. Was an einer
     * bezahlten Bestellung nicht zur Rechnung gehört, kommt weg. */
    /* N3: Eine Zahlung, die bei Mollie noch offen ist, kann nach der
     * Löschung noch eingehen. Ihre Bestellung bleibt deshalb stehen (ohne
     * Konto, user_id wird NULL); kommt die Zahlung, meldet billing.js das
     * dem Betreiber zur Erstattung. Den Rest räumt der Aufräumjob nach 30
     * Tagen ab. Gelöscht werden sofort nur Bestellungen ohne Zahlung oder
     * mit Endstatus. */
    await client.query(
      `DELETE FROM orders WHERE user_id = $1 AND paid_at IS NULL
          AND NOT (mollie_payment_id IS NOT NULL AND status IN ('open', 'pending', 'authorized'))`,
      [userId],
    );
    await client.query(
      `UPDATE orders SET checkout_url = NULL WHERE user_id = $1 AND paid_at IS NULL`,
      [userId],
    );
    const kept = await client.query(
      'UPDATE orders SET checkout_url = NULL, locale = NULL WHERE user_id = $1 AND paid_at IS NOT NULL',
      [userId],
    );
    retainedOrders = kept.rowCount;
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  return { retainedOrders };
}

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
    const { retainedOrders } = await deleteAccount({ id: req.user.id, email: info[0]?.email });
    res.clearCookie(COOKIE, { httpOnly: true, secure: true, sameSite: 'lax' });
    res.json({ ok: true });
    if (info[0]?.email) { const m = tplOffboarding({ username: info[0].username, deleted: true, retainedOrders }); sendMail({ to: info[0].email, ...m }); }
  } catch (err) {
    console.error('me/delete failed:', err);
    res.status(500).json({ error: 'Löschung fehlgeschlagen.' });
  }
});

// ── Ereignisse aus dem Browser ──────────────────────────────────────────────
/* DOCX und das Druck-PDF entstehen ganz im Browser; der Server erfährt davon
 * nichts. Für die Auswertung je Einladungscode meldet das Frontend sie hier.
 * Nur angemeldet, nur die Arten aus der Liste, gespeichert wird Art und
 * Zeitpunkt am Konto, sonst nichts. Für die Demo ohne Konto gibt es diesen
 * Weg nicht. Auch nach Ablauf der Laufzeit erlaubt: Exportieren bleibt. */
const CLIENT_EVENTS = new Set(['docx', 'pdf_local', 'share_create', 'latex']);
app.post('/api/events', rateLimit({ route: 'events', max: 120, windowMs: 60 * 60 * 1000 }), requireAuth, async (req, res) => {
  const kind = String(req.body?.kind || '');
  if (!CLIENT_EVENTS.has(kind)) return res.status(400).json({ error: 'Unbekannte Ereignisart.' });
  logEvent(req.user.id, kind);
  res.status(204).end();
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
  /* Laufzeit je Platz (Pilot). Leer = unbegrenzt. Nicht zu verwechseln mit
   * expiresInDays: das begrenzt nur, bis wann der Code eingelöst werden kann. */
  let accessDays = null;
  if (req.body?.accessDays !== undefined && req.body?.accessDays !== null && req.body?.accessDays !== '') {
    accessDays = parseInt(req.body.accessDays, 10);
    if (!Number.isInteger(accessDays) || accessDays < 1 || accessDays > MAX_ACCESS_DAYS) {
      return res.status(400).json({ error: `Laufzeit je Platz: 1 bis ${MAX_ACCESS_DAYS} Tage oder leer für unbegrenzt.` });
    }
  }
  let code;
  for (let i = 0; i < 6; i++) {
    code = generateCode();
    const { rowCount } = await pool.query('SELECT 1 FROM invite_codes WHERE code = $1', [code]);
    if (!rowCount) break;
  }
  await pool.query(
    'INSERT INTO invite_codes (code, created_by, note, max_uses, expires_at, email, access_days) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [code, req.user.id, note, maxUses, expiresAt, email || null, accessDays],
  );
  // Onboarding-Automatik: wenn eine E-Mail angegeben ist, Einladung direkt versenden.
  let emailed = false;
  if (email) { const m = tplInvite({ code, note }); emailed = await sendMail({ to: email, ...m }); }
  res.json({ code, maxUses, note, expiresAt, accessDays, email: email || null, emailed });
});

app.get('/api/admin/invites', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.code, c.note, c.max_uses, c.uses, c.expires_at, c.access_days, c.revoked, c.created_at,
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
    `SELECT u.id, u.username, u.role, u.disabled, u.created_at, u.last_seen_at, u.access_until, u.plan_kind, u.signup_source,
            (u.signup_source IS DISTINCT FROM 'self' OR u.email_confirmed_at IS NOT NULL) AS email_confirmed,
            (SELECT count(*)::int FROM resumes r WHERE r.user_id = u.id) AS resume_count,
            (SELECT ir.code FROM invite_redemptions ir WHERE ir.user_id = u.id ORDER BY ir.redeemed_at LIMIT 1) AS invite_code
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

/* Direktes Setzen eines Kundenpassworts durch den Admin gibt es seit dem
 * Audit vom 10.10.2026 (S2) nicht mehr: Damit hätte sich ein Admin in fremde
 * Konten einloggen und Art.-9-Daten lesen können. Der Admin-Bereich schickt
 * stattdessen eine Reset-Mail (admin.js, password-reset-mail). */

/* Laufzeit eines Kontos ändern (Pilot).
 *
 *   { days: 30 }            verlängert ab dem späteren von heute und dem
 *                           bisherigen Ende — ein abgelaufenes Konto läuft
 *                           also ab heute 30 Tage, ein laufendes 30 Tage
 *                           über sein Ende hinaus.
 *   { until: "2027-03-31" } setzt das Ende auf diesen Tag; gespeichert wird
 *                           Mitternacht UTC des Folgetags, damit der
 *                           genannte Tag ganz zählt.
 *   { until: null }         unbegrenzt.
 *
 * Die Hinweis-Mails werden zurückgesetzt, damit sie zum neuen Ende wieder
 * kommen. Ein unbegrenztes Konto lässt sich nicht „um 30 Tage verlängern" —
 * das wäre in Wahrheit eine Begrenzung und braucht ein Datum. */
app.post('/api/admin/users/:id/access', requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Ungültige Nutzer-ID.' });
  const { rows: cur } = await pool.query('SELECT id, role, access_until, plan_kind FROM users WHERE id = $1', [id]);
  if (!cur[0]) return res.status(404).json({ error: 'Nutzer nicht gefunden.' });
  if (cur[0].role === 'admin') return res.status(400).json({ error: 'Admin-Konten haben keine Laufzeit.' });
  const body = req.body || {};
  /* Seit 09.10.2026 als Berechtigung (grants.js, source 'admin'): { days } ist
   * ein Abschnitt ab dem späteren von jetzt und bisherigem Ende, { until }
   * setzt das Ende (kind 'set'). Die Laufzeit entsteht aus der Neuberechnung,
   * Gutscheine und Bestellungen bleiben dabei erhalten. */
  let grant;
  if (body.days !== undefined) {
    const days = parseInt(body.days, 10);
    if (!Number.isInteger(days) || days < 1 || days > MAX_ACCESS_DAYS) {
      return res.status(400).json({ error: `Verlängerung: 1 bis ${MAX_ACCESS_DAYS} Tage.` });
    }
    if (cur[0].plan_kind === 'lifetime') return res.status(409).json({ error: 'Dieses Konto hat einen dauerhaften Gratiszugang.' });
    if (!cur[0].access_until) return res.status(409).json({ error: 'Dieses Konto ist unbegrenzt. Für eine Begrenzung ein Enddatum setzen.' });
    grant = { source: 'admin', kind: 'days', days, createdBy: req.user.id };
  } else if (Object.prototype.hasOwnProperty.call(body, 'until')) {
    let until = null;
    if (body.until !== null && body.until !== '') {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body.until));
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
    await addGrant(client, id, grant);
    const { rows } = await client.query('SELECT access_until FROM users WHERE id = $1', [id]);
    accessUntil = rows[0].access_until;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  logEvent(req.user.id, 'admin_access_change');
  // Protokoll über admin.js (gekürzte Adresse, Weg der Anmeldung).
  res.locals.audit = { action: 'user_access', target: id, details: { days: grant.days ?? null, until: grant.kind === 'set' ? grant.untilAt : undefined, accessUntil } };
  res.json({ ok: true, accessUntil });
});

/* Auswertung je Einladungscode — der Messpunkt des Pilots (Startup-Bericht,
 * Empfehlung): eingelöste Plätze, aktive Nutzer, Nutzer mit Export.
 *
 * Nur Zählungen. Keine Namen, keine Inhalte, keine Ereignis-Zeitpunkte je
 * Person. „Aktiv" heißt: in den letzten 14 Tagen irgendeine angemeldete
 * Anfrage (last_seen_at, auch über MCP). „Eingelöst" ist der Zähler am Code
 * und enthält auch Konten, die inzwischen gelöscht sind; „Konten" sind die,
 * die es noch gibt. Exporte, die ganz im Browser entstehen (DOCX, Druck-PDF),
 * kennt der Server nur, wenn das Frontend sie über POST /api/events meldet. */
app.get('/api/admin/invite-stats', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.code, c.note, c.max_uses, c.uses AS redeemed, c.access_days, c.expires_at, c.revoked, c.created_at,
            count(u.id)::int AS accounts,
            count(u.id) FILTER (WHERE u.last_seen_at > now() - interval '14 days')::int AS active14d,
            count(u.id) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.kind IN ('pdf', 'pdf_local')))::int AS with_pdf,
            count(u.id) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.kind = 'docx'))::int AS with_docx,
            count(u.id) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.kind IN ('pdf', 'pdf_local', 'docx')))::int AS with_export,
            count(u.id) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.kind = 'share_create')
                                  OR EXISTS (SELECT 1 FROM share_links s WHERE s.created_by = u.id))::int AS with_share,
            count(u.id) FILTER (WHERE u.access_until IS NOT NULL AND u.access_until <= now())::int AS expired
       FROM invite_codes c
       LEFT JOIN invite_redemptions r ON r.code = c.code
       LEFT JOIN users u ON u.id = r.user_id
      GROUP BY c.code
      ORDER BY c.created_at DESC`,
  );
  res.json({ codes: rows });
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

/* Der Renderer läuft mit einem Chromium, das nur die eigenen, öffentlichen
 * Hostnamen auflösen kann (N1, siehe pdf.js). Welche das sind, steht in der
 * Konfiguration — nicht in der Anfrage, sonst erweitert der Aufrufer die
 * Freigabe selbst. */
const RENDER_HOSTS = rendererHosts([
  process.env.PUBLIC_BASE_URL, process.env.APP_BASE_URL, ...ALLOWLIST,
]);
const renderer = createRenderer({
  hosts: RENDER_HOSTS,
  // Nur für lokale Läufe und Tests, deren Playwright-Browser nicht zur
  // Paketversion passt. In der Produktion leer.
  executablePath: (process.env.PDF_CHROMIUM_PATH || '').trim() || undefined,
});
/* N2: höchstens zwei Aufträge gleichzeitig, zehn in der Warteschlange.
 * Gilt für alle Aufrufer, auch ohne Konto (Demo).
 *
 * Ganzzahl aus der Umgebung, mit Untergrenze. Vorher `parseInt(x) || 10`:
 * PDF_MAX_QUEUE=0 („keine Warteschlange, sofort 503") ergab 0 → falsy → 10,
 * die Einstellung wurde still ignoriert. */
function envInt(name, fallback, min) {
  const raw = String(process.env[name] ?? '').trim();
  if (raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(min, n) : fallback;
}
const pdfLimiter = createLimiter({
  maxParallel: envInt('PDF_MAX_PARALLEL', 2, 1),
  maxQueue: envInt('PDF_MAX_QUEUE', 10, 0),
});
const PDF_TIMEOUT_MS = Math.max(5_000, parseInt(process.env.PDF_TIMEOUT_MS || '30000', 10) || 30_000);
const MAX_PDF_HTML_CHARS = 3_000_000;

// Map our PageFormat ids → Playwright format strings. preferCSSPageSize on
// the request still wins, but we set format as a safety net for clients
// that don't propagate the CSS @page rule cleanly.
const PDF_FORMAT_MAP = { a4: 'A4', letter: 'Letter', legal: 'Legal', a5: 'A5' };

async function optionalAuth(req, _res, next) {
  try { req.user = await loadUser(req); } catch { req.user = null; }
  next();
}

/* M5 (09.10.2026): Ohne Konto (Demo) höchstens EIN Auftrag gleichzeitig je
 * Netz (/24 bzw. /64) und 60 je Stunde und Netz. Vorher konnte jeder ohne
 * Konto mit wenigen Adressen die ganze Warteschlange belegen — und damit
 * auch Rechnung und Bestellbestätigung aufhalten (die haben jetzt eine
 * eigene Warteschlange, siehe renderOwnPdf). */
const anonPdfActive = new Map();
const anonPdfNetLimit = subnetLimit({ route: 'pdf-anon', max: 60, windowMs: 60 * 60 * 1000 });
function anonPdfGate(req, res, next) {
  if (req.user) return next();
  anonPdfNetLimit(req, res, () => {
    const net = subnetOf(req.ip);
    if ((anonPdfActive.get(net) || 0) >= 1) {
      res.setHeader('Retry-After', '10');
      return res.status(429).json({ error: 'Aus deinem Netz läuft gerade schon ein PDF-Auftrag ohne Anmeldung. Bitte in 10 Sekunden noch einmal versuchen.', code: 'pdf_busy_anon' });
    }
    anonPdfActive.set(net, (anonPdfActive.get(net) || 0) + 1);
    let done = false;
    const free = () => {
      if (done) return;
      done = true;
      const n = (anonPdfActive.get(net) || 1) - 1;
      if (n <= 0) anonPdfActive.delete(net); else anonPdfActive.set(net, n);
    };
    res.on('finish', free);
    res.on('close', free);
    next();
  });
}

app.post('/api/pdf', optionalAuth, rateLimit({ route: 'pdf', max: 60, windowMs: 60 * 60 * 1000 }), anonPdfGate, async (req, res) => {
  const { html, filename, pageFormat } = req.body || {};
  if (typeof html !== 'string' || html.length < 30) {
    return res.status(400).json({ error: 'Field "html" is required.' });
  }
  if (html.length > MAX_PDF_HTML_CHARS) {
    return res.status(413).json({ error: 'Das Dokument ist zu groß für den PDF-Export (höchstens 3 MB).' });
  }
  const fmt = PDF_FORMAT_MAP[pageFormat] || 'A4';
  /* Der „eigene Host" für die SSRF-Prüfung kommt aus der Konfiguration, nicht
   * aus einem Header — sonst erweitert der Aufrufer die Allowlist selbst. */
  const ownHost = (() => {
    const base = publicBaseUrl(req);
    try { return base ? new URL(base).host : null; } catch { return null; }
  })();

  // Bricht der Aufrufer ab, während er wartet, gibt er seinen Platz frei.
  const abort = new AbortController();
  res.on('close', () => { if (!res.writableEnded) abort.abort(); });

  let release;
  try {
    release = await pdfLimiter.acquire(abort.signal);
  } catch (err) {
    if (err instanceof BusyError) {
      if (res.headersSent || abort.signal.aborted) return;
      /* Der Satz aus guards.js sagt „in einer Minute", der Kopf `Retry-After`
       * aber 30 Sekunden. Hier stehen beide auf demselben Wert. */
      const wait = err.retryAfter || 30;
      res.setHeader('Retry-After', String(wait));
      return res.status(503).json({ error: `Der PDF-Dienst ist gerade ausgelastet. Bitte in ${wait} Sekunden noch einmal versuchen.` });
    }
    throw err;
  }
  try {
    const pdf = await renderer.render(html, {
      format: fmt,
      ownHost,
      timeoutMs: PDF_TIMEOUT_MS,
      onBlocked: url => console.warn(`[pdf] blocked SSRF candidate: ${String(url).slice(0, 200)}`),
    });
    const requested = typeof filename === 'string' && filename ? filename.slice(0, 200) : 'Lebenslauf.pdf';
    // Strip anything weird, keep umlauts + dashes + underscores for the UTF-8 filename*.
    const utf8 = requested.replace(/[^\w.\-äöüÄÖÜß]/g, '_');
    // ASCII fallback for old clients: transliterate umlauts.
    const ascii = utf8
      .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
      .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
      .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
      .replace(/ß/g, 'ss')
      .replace(/[^\w.-]/g, '_');   // Bindestrich am Ende braucht keine Maskierung
    logEvent(req.user?.id ?? null, 'pdf');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Pdf-Max-Pages', String(MAX_PAGES));
    // RFC 5987 — modern browsers prefer the filename* with UTF-8 encoding.
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`,
    );
    res.send(pdf);
  } catch (err) {
    if (err?.code === 'ETIMEDOUT') {
      console.warn('pdf render timed out');
      if (!res.headersSent) res.status(503).json({ error: 'Das PDF hat zu lange gebraucht und wurde abgebrochen. Bitte erneut versuchen; bei sehr langen Dokumenten erst kürzen.' });
      return;
    }
    console.error('pdf render failed:', err?.message || err);
    if (!res.headersSent) res.status(500).json({ error: 'PDF rendering failed' });
  } finally {
    release();
  }
});

// ── Bezahlung (Bewerbungs-Pass über Mollie) ────────────────────────────────
/* Rechnung und Vertragsunterlagen laufen über denselben Renderer, aber seit
 * dem 09.10.2026 über eine EIGENE Warteschlange (M5): Eine volle
 * /api/pdf-Schlange hielt sonst Bestellbestätigung und Rechnung auf. Eigenes,
 * schlichtes HTML (invoice.js), nie Nutzer-HTML. */
const ownPdfLimiter = createLimiter({ maxParallel: 1, maxQueue: 50, queueTimeoutMs: 120_000 });
async function renderOwnPdf(html) {
  const release = await ownPdfLimiter.acquire();
  try {
    return await renderer.render(html, { format: 'A4', ownHost: null, timeoutMs: PDF_TIMEOUT_MS });
  } finally {
    release();
  }
}
const BILLING = billingConfig();
const billing = createBilling({ pool, config: BILLING, renderPdf: renderOwnPdf, emailConfirmed });
billing.mount(app, { requireAuth, requireAdmin, rateLimit, subnetLimit, altcha });

// ── Gutscheine (09.10.2026, vouchers.js) ───────────────────────────────────
const vouchers = createVouchers({
  pool,
  // Wirklich offen nur mit Bot-Schutz; sonst weist die Registrierung ab.
  registrationOpen: () => OPEN_REGISTRATION && altcha.configured,
  emailConfirmed,
  baseUrl: BILLING.base,
});
vouchers.mount(app, { requireAuth, requireAdmin, rateLimit, subnetLimit, loadUser });

// ── Admin-Bereich (Runde 8b, 10.10.2026; admin.js, ADMIN.md) ────────────────
function systemInfo() {
  return {
    version: {
      commit: (process.env.SOURCE_COMMIT || process.env.GIT_COMMIT || '').trim().slice(0, 40) || null,
      package: process.env.npm_package_version || null,
      node: process.version,
      startedAt: STARTED_AT,
    },
    registration: { openVar: OPEN_REGISTRATION, botProtection: altcha.configured, open: OPEN_REGISTRATION && altcha.configured },
    sale: { enabled: BILLING.enabled, ready: BILLING.ready },
    // P5: wirksame Fassungen der Vertragstexte und woher sie kommen (Datei oder Übersteuerung).
    legal: {
      terms: BILLING.legalVersions.terms, withdrawal: BILLING.legalVersions.withdrawal,
      source: BILLING.legalVersions.source, file: BILLING.legalVersions.file, warnings: BILLING.legalVersions.warnings,
      art9Consent: ART9_VERSION,
    },
  };
}
admin = createAdmin({
  pool, cfg: ADMIN_CFG, rateLimit, subnetLimit, bucketBlocked, bucketHit, loadUser, markAuth,
  sendMail, mailConfigured, billing, billingConfig: BILLING, stats, publicBaseUrl, art9Version: ART9_VERSION,
  issueEmailConfirmation, issuePasswordReset, deleteAccount, revokeAllCredentials, systemInfo, summarizeUa, tplOffboarding,
});
admin.mount(app);

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
    const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE lower(username) = lower($1)', [u]);
    if (!rows[0]) {
      const hash = await bcrypt.hash(p, 10);
      await pool.query('INSERT INTO users (username, password_hash, role, password_changed_at) VALUES ($1, $2, $3, now())', [u, hash, 'admin']);
      console.log(`bootstrap: admin '${u}' created`);
    } else if (await bcrypt.compare(p, rows[0].password_hash)) {
      // Passwort unverändert: nur Rolle und Sperre sicherstellen. Kein
      // Widerruf — der Abgleich läuft bei jedem Start.
      await pool.query('UPDATE users SET role = $1, disabled = false WHERE id = $2', ['admin', rows[0].id]);
    } else {
      /* Das Passwort in der Umgebung hat sich geändert — das ist ein
       * Passwortwechsel und trennt wie jeder andere alle Zugänge. */
      const hash = await bcrypt.hash(p, 10);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE users SET password_hash = $1, role = $2, disabled = false, password_changed_at = now() WHERE id = $3', [hash, 'admin', rows[0].id]);
        await revokeAllCredentials(client, rows[0].id);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      console.log(`bootstrap: admin '${u}' password reset from env (Schlüssel und Verbindungen getrennt)`);
    }
  } catch (err) {
    console.error('bootstrap: admin reset failed:', err);
  }
}

/* ── Auffangnetz ───────────────────────────────────────────────────────────
 *
 * Bis hierher gab es weder eine Fehler-Middleware noch einen Handler für
 * unbehandelte Promises. Express 4 fängt einen Fehler aus einem `async`
 * Handler nicht ab; Node beendet daraufhin den Prozess. Das war keine
 * theoretische Lage: Eine einzige Route warf bei jedem Crawler-Aufruf, und
 * jede Route, die einen Pfadparameter ungeprüft in eine Integer-Spalte
 * schiebt (`/api/resumes/:id/versions/abc`), bringt Postgres dazu, mit
 * `22P02` zu antworten — ein eingeladener Nutzer hätte den Dienst für alle
 * beenden können.
 *
 * Die Middleware ersetzt keine Eingabeprüfung. Sie sorgt nur dafür, dass ein
 * Fehler den Aufrufer trifft und nicht die anderen Nutzer. */
/* Seit Express 5 (08.10.2026) landen auch Fehler aus async-Handlern hier.
 * Unter Express 4 blieb eine solche Anfrage bis zum Proxy-Timeout (120 s)
 * hängen (N4), der Kommentar oben versprach mehr, als der Code hielt. */
/* Live-Befund 09.10.2026: Unbekannte Pfade bekamen die Express-Standardseite
 * „Cannot GET …“ (HTML, verrät das Framework). Jetzt JSON wie überall. */
app.use((_req, res) => {
  res.status(404).json({ error: 'Nicht gefunden.', code: 'not_found' });
});

app.use((err, req, res, _next) => {
  const status = err && err.status && Number.isInteger(err.status) ? err.status : 500;
  // Postgres meldet eine unbrauchbare Eingabe mit 22P02/22003 — das ist ein
  // Fehler des Aufrufers, keine Störung.
  const code = err && err.code;
  const eingabe = code === '22P02' || code === '22003';
  const zuGross = err?.type === 'entity.too.large' || status === 413;
  const kaputt = err?.type === 'entity.parse.failed';
  if (!zuGross && !kaputt) console.error('unhandled:', req.method, req.originalUrl, code || '', err && err.message);
  if (res.headersSent) return;
  if (zuGross) return res.status(413).json({ error: 'Anfrage zu groß.' });
  if (kaputt) return res.status(400).json({ error: 'Ungültiges JSON.' });
  res.status(eingabe ? 400 : (status >= 400 && status < 600 ? status : 500))
    .json({ error: eingabe ? 'Ungültiger Parameter.' : (status < 500 ? 'Ungültige Anfrage.' : 'Interner Fehler.') });
});

process.on('unhandledRejection', (grund) => {
  // Nicht beenden: Eine einzelne fehlgeschlagene Zusage ist kein Grund, alle
  // offenen Sitzungen mitzunehmen. Sichtbar bleibt sie trotzdem.
  console.error('unhandledRejection:', grund);
});

const port = process.env.PORT || 3000;
initDb()
  .then(() => bootstrapAdmin())
  .then(() => {
    // Aufräumen beim Start und danach täglich (janitor.js).
    if (process.env.JANITOR !== '0') startJanitor(pool);
    // Hinweis-Mails vor Ablauf der Laufzeit (access.js), alle 6 Stunden.
    if (process.env.ACCESS_NOTICES !== '0') {
      const base = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').trim().replace(/\/+$/, '') || null;
      startAccessNotices(pool, { base });
    }
    console.log(`pdf: Renderer löst nur diese Hosts auf: ${RENDER_HOSTS.join(', ') || '(keine)'}`);
    // P5: Fassung der Vertragstexte; eine abweichende Übersteuerung steht als Warnung im Log.
    for (const w of BILLING.legalVersions.warnings) console.warn(`legal: ${w}`);
    console.log(`legal: AGB-Fassung ${BILLING.termsVersion || '(keine)'} (${BILLING.legalVersions.source.terms}), Widerrufsbelehrung ${BILLING.withdrawalVersion || '(keine)'} (${BILLING.legalVersions.source.withdrawal}), Einwilligung Art. 9 ${ART9_VERSION}`);
    // Bezahlung: was fehlt, sagt der Dienst beim Start — ohne Werte.
    if (BILLING.enabled) {
      if (BILLING.missing.length) console.warn(`billing: BILLING_ENABLED=1, aber es fehlt: ${BILLING.missing.join(', ')} — der Kauf bleibt aus.`);
      else console.log(`billing: bereit (${billing.offer().priceCents} Cent, ${BILLING.days} Tage, Mollie-${/^live_/.test(BILLING.mollieKey) ? 'Live' : 'Test'}modus)`);
      if (/^live_/.test(BILLING.mollieKey) && process.env.NODE_ENV !== 'production') console.warn('billing: Live-Schlüssel außerhalb von NODE_ENV=production.');
      if (BILLING.priceCents > 25_000 && !BILLING.seller.taxId) console.warn('billing: Preis über 250 € — die Rechnung braucht dann SELLER_TAX_ID (Paragraf 14 Abs. 4 UStG).');
      if (process.env.BILLING_JOBS !== '0') billing.startJobs();
    } else if (process.env.BILLING_JOBS !== '0') {
      // Auch ohne Kauf: unbestätigte öffentliche Erklärungen nach 14 Tagen melden.
      billing.startJobs({ onlyDeclarations: true });
    }
    if (OPEN_REGISTRATION && !altcha.configured) console.warn('register: OPEN_REGISTRATION=1 ohne ALTCHA_HMAC_KEY — offene Registrierung bleibt zu.');
    if (ADMIN_CFG.separate) console.log(`admin: eigener Host ${ADMIN_CFG.host} (Ursprung ${ADMIN_CFG.origin})${ADMIN_CFG.allowedIps.length ? `, nur ${ADMIN_CFG.allowedIps.length} Netz(e)` : ''}`);
    else console.log('admin: kein ADMIN_HOST — Admin-Rechte über die normale Anmeldung (Selbsthoster-Weg, ADMIN.md)');
    if (ADMIN_CFG.invalidIps.length) console.warn(`admin: ADMIN_ALLOWED_IPS enthält ungültige Einträge, die nicht gelten: ${ADMIN_CFG.invalidIps.join(', ')}`);
    if (ADMIN_CFG.separate && !ADMIN_CFG.email) console.warn('admin: ADMIN_EMAIL fehlt — die Admin-Codes gehen an die Adresse im Admin-Konto.');
    app.listen(port, () => console.log(`cv-api listening on :${port}`));
  })
  .catch(err => { console.error('FATAL: db init failed', err); process.exit(1); });
