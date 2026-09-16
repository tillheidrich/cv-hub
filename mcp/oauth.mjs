// OAuth 2.1 für den gehosteten MCP-Endpunkt.
//
// Warum es das gibt: Claude (und jeder andere Client, der sich an die
// MCP-Authorization-Spezifikation hält) verbindet sich mit einem entfernten
// Server ausschließlich über OAuth mit Dynamic Client Registration. Ein
// statisches Bearer-Token lässt sich dort gar nicht eintragen. Ohne die
// Endpunkte hier bricht der Verbindungsversuch mit „Registrierung beim
// Anmeldedienst fehlgeschlagen" ab.
//
// Entwurfsentscheidung: ZUSTANDSLOS. Client-Registrierung, Autorisierungscode
// und Access-Token sind HMAC-signierte Datensätze, keine Datenbankzeilen. Der
// MCP-Dienst hat keine eigene Datenbank, und ein Redeploy darf die Verbindung
// nicht kappen — mit Serverzustand im Speicher wäre nach jedem Ausrollen jeder
// Client abgemeldet.
//
// Single-Tenant: hinter dem Endpunkt steht genau ein CV_API_KEY. Die
// Zustimmungsseite prüft deshalb nicht „wer bist du", sondern „kennst du das
// Gate-Token" — dieselbe Schranke wie bisher, nur durch den OAuth-Ablauf
// hindurchgereicht.

import crypto from 'crypto';

const b64u = buf => Buffer.from(buf).toString('base64url');
const unb64u = s => Buffer.from(s, 'base64url');

/** Zeitkonstanter Vergleich zweier Zeichenketten beliebiger Länge. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  if (x.length !== y.length) {
    // Trotzdem vergleichen, damit die Laufzeit nicht die Länge verrät.
    crypto.timingSafeEqual(x, x);
    return false;
  }
  return crypto.timingSafeEqual(x, y);
}

/** Signierte, selbsttragende Token: <payload>.<hmac>. */
export function makeSigner(secret) {
  const key = crypto.createHmac('sha256', 'cv-mcp-oauth-v1').update(String(secret)).digest();

  function sign(type, data, ttlSeconds) {
    const body = { t: type, ...data, iat: Math.floor(Date.now() / 1000) };
    if (ttlSeconds) body.exp = body.iat + ttlSeconds;
    const payload = b64u(JSON.stringify(body));
    const mac = b64u(crypto.createHmac('sha256', key).update(payload).digest());
    return `${payload}.${mac}`;
  }

  function verify(token, type) {
    if (typeof token !== 'string') return null;
    const dot = token.lastIndexOf('.');
    if (dot < 1) return null;
    const payload = token.slice(0, dot);
    const mac = token.slice(dot + 1);
    const want = crypto.createHmac('sha256', key).update(payload).digest();
    let got;
    try { got = unb64u(mac); } catch { return null; }
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
    let body;
    try { body = JSON.parse(unb64u(payload).toString('utf8')); } catch { return null; }
    if (body.t !== type) return null;
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  }

  return { sign, verify };
}

/**
 * Ist diese Redirect-URI zulässig?
 *
 * Erlaubt sind HTTPS-Adressen und — weil lokal laufende Clients (Claude
 * Desktop, Cursor, Inspector) ihren Rückkanal auf dem eigenen Rechner öffnen —
 * http nur auf localhost bzw. 127.0.0.1. Fragmente sind nach RFC 6749
 * verboten. Alles andere wäre ein offener Weiterleiter.
 */
export function redirectUriAllowed(uri) {
  let u;
  try { u = new URL(String(uri)); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]')) return true;
  return false;
}

/** PKCE nach RFC 7636, ausschließlich S256 — „plain" ist in OAuth 2.1 raus. */
export function pkceMatches(verifier, challenge) {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return false;
  const computed = b64u(crypto.createHash('sha256').update(verifier).digest());
  return safeEqual(computed, challenge);
}

export const CODE_TTL = 300;              // 5 Minuten, wie in OAuth 2.1 empfohlen
export const ACCESS_TTL = 60 * 60 * 24 * 30;   // 30 Tage
export const REFRESH_TTL = 60 * 60 * 24 * 365; // 1 Jahr

/** Metadaten des geschützten Servers (RFC 9728). */
export function protectedResourceMetadata(publicUrl) {
  return {
    resource: `${publicUrl}/mcp`,
    authorization_servers: [publicUrl],
    bearer_methods_supported: ['header'],
    scopes_supported: ['cv'],
    resource_documentation: `${publicUrl}/mcp/oauth/info`,
  };
}

/** Metadaten des Anmeldedienstes (RFC 8414). */
export function authorizationServerMetadata(publicUrl) {
  return {
    issuer: publicUrl,
    authorization_endpoint: `${publicUrl}/mcp/oauth/authorize`,
    token_endpoint: `${publicUrl}/mcp/oauth/token`,
    registration_endpoint: `${publicUrl}/mcp/oauth/register`,
    scopes_supported: ['cv'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    service_documentation: `${publicUrl}/mcp/oauth/info`,
  };
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Zustimmungsseite. Bewusst eine einzelne Datei ohne Abhängigkeiten. */
export function consentPage({ appName, clientName, redirectUri, params, error }) {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join('\n      ');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zugriff erlauben — ${esc(appName)}</title>
<style>
  :root { color-scheme: light }
  body { margin:0; background:oklch(0.985 0.003 264); color:oklch(0.21 0.021 264);
         font:15px/1.6 Inter,system-ui,-apple-system,sans-serif;
         display:flex; align-items:center; justify-content:center; min-height:100dvh; padding:24px }
  .card { background:#fff; border:1px solid oklch(0.91 0.005 264); border-radius:14px;
          padding:32px; max-width:440px; width:100% }
  h1 { font-size:20px; margin:0 0 6px; letter-spacing:-0.02em }
  p { color:oklch(0.40 0.017 264); margin:0 0 16px }
  dl { margin:0 0 20px; font-size:14px }
  dt { color:oklch(0.58 0.012 264); font-size:11px; letter-spacing:0.12em; text-transform:uppercase; margin-top:12px }
  dd { margin:2px 0 0; word-break:break-all; font-family:ui-monospace,monospace; font-size:13px }
  label { display:block; font-size:13px; margin-bottom:6px; font-weight:500 }
  input[type=password] { width:100%; box-sizing:border-box; padding:10px 12px; font-size:15px;
          border:1px solid oklch(0.85 0.008 264); border-radius:8px; background:oklch(0.99 0.002 264) }
  button { margin-top:16px; width:100%; padding:11px; font-size:15px; font-weight:600; cursor:pointer;
          border:none; border-radius:8px; background:oklch(0.55 0.216 264); color:#fff }
  .err { background:oklch(0.96 0.03 25); border:1px solid oklch(0.80 0.10 25);
         color:oklch(0.42 0.16 25); padding:10px 12px; border-radius:8px; margin-bottom:16px; font-size:14px }
</style></head><body>
  <form class="card" method="post">
    <h1>Zugriff erlauben</h1>
    <p>Ein Client möchte über MCP auf ${esc(appName)} zugreifen — Lebensläufe und
       Anschreiben lesen und schreiben.</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ''}
    <dl>
      <dt>Client</dt><dd>${esc(clientName || 'unbenannt')}</dd>
      <dt>Rückleitung an</dt><dd>${esc(redirectUri)}</dd>
    </dl>
    <label for="gate">Zugriffs-Token des MCP-Dienstes</label>
    <input id="gate" name="gate" type="password" autocomplete="off" autofocus required>
    ${hidden}
    <button type="submit">Zugriff erlauben</button>
  </form>
</body></html>`;
}
