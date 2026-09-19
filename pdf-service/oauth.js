// OAuth 2.1 für den MCP-Endpunkt — mehrbenutzerfähig.
//
// WARUM HIER UND NICHT IM MCP-DIENST
//
// Der erste Anlauf legte den Anmeldedienst in den MCP-Container. Der hat aber
// weder Nutzer noch Sessions noch eine Datenbank, also konnte er nur EIN Konto
// bedienen: die Zustimmungsseite fragte ein geteiltes Token ab, und der
// Endpunkt sprach immer mit demselben API-Schlüssel. Für ein Werkzeug, das
// jeder Nutzer an seinen eigenen KI-Client hängen soll, ist das die falsche
// Stelle. Hier liegen Nutzer, Sessions und Datenbank — hier gehört der
// Anmeldedienst hin.
//
// ABLAUF
//
//   Client trägt https://host/mcp ein
//     → 401 mit WWW-Authenticate: … resource_metadata="…"
//     → /.well-known/oauth-protected-resource  (wer schützt das)
//     → /.well-known/oauth-authorization-server (wo sind die Endpunkte)
//     → POST /oauth/register                   (Client meldet sich selbst an)
//     → Browser öffnet /oauth/authorize        (Zustimmungsseite IM Tool)
//        · nicht angemeldet → ab ins Tool, danach zurück hierher
//        · angemeldet       → „Erlauben" klicken
//     → POST /oauth/token                      (Code gegen Token, mit PKCE)
//     → MCP-Aufrufe mit cvm_… als Bearer, im Namen genau dieses Nutzers
//
// Token und Codes liegen nur als Hash in der Datenbank, wie die API-Schlüssel
// auch. Wer die Datenbank liest, hält keine benutzbaren Zugänge in der Hand.

import crypto from 'crypto';

const ACCESS_TTL_S = 60 * 60 * 24 * 30;    // 30 Tage
const REFRESH_TTL_S = 60 * 60 * 24 * 365;  // 1 Jahr
const CODE_TTL_S = 300;                    // 5 Minuten

export function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

/**
 * Ist diese Redirect-URI zulässig?
 *
 * HTTPS ja; http nur auf dem eigenen Rechner, weil lokal laufende Clients
 * (Claude Desktop, Cursor, Inspector) ihren Rückkanal dort öffnen. Fragmente
 * sind nach RFC 6749 verboten. Alles andere wäre ein offener Weiterleiter —
 * und der ist in einem OAuth-Ablauf kein Schönheitsfehler, sondern der Weg,
 * auf dem ein fremder Code beim Angreifer landet.
 */
export function redirectUriAllowed(uri) {
  let u;
  try { u = new URL(String(uri)); } catch { return false; }
  if (u.hash) return false;
  if (u.protocol === 'https:') return true;
  if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) return true;
  return false;
}

/** PKCE nach RFC 7636, ausschließlich S256 — „plain" ist in OAuth 2.1 gestrichen. */
export function pkceMatches(verifier, challenge) {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return false;
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  const a = Buffer.from(computed);
  const b = Buffer.from(String(challenge ?? ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function protectedResourceMetadata(base) {
  return {
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
    scopes_supported: ['cv'],
  };
}

/**
 * Öffentliche Adresse der OAuth-Endpunkte.
 *
 * Nicht ableitbar, sondern konfiguriert: dieser Dienst hängt in der Produktion
 * unter einem Pfadpräfix (/pdfapi), das der Reverse-Proxy abschneidet, bevor
 * die Anfrage hier ankommt. Der Dienst kann also gar nicht wissen, unter
 * welcher Adresse er von außen erreichbar ist. Raten wäre hier besonders
 * schädlich, weil die Adresse in den Metadaten steht, nach denen sich jeder
 * Client richtet.
 */
export function endpointsBase(base) {
  const configured = (process.env.OAUTH_PUBLIC_BASE || '').trim();
  return configured ? configured.replace(/\/+$/, '') : `${base}/oauth`;
}

export function authorizationServerMetadata(base) {
  const e = endpointsBase(base);
  return {
    issuer: base,
    authorization_endpoint: `${e}/authorize`,
    token_endpoint: `${e}/token`,
    registration_endpoint: `${e}/register`,
    revocation_endpoint: `${e}/revoke`,
    scopes_supported: ['cv'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Zustimmungsseite im Look des Produkts. Server-gerendert, ohne Abhängigkeiten. */
export function consentPage({ appName, username, clientName, redirectUri, params }) {
  let host = redirectUri;
  try { host = new URL(redirectUri).host; } catch { /* Rohwert zeigen */ }
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('\n      ');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zugriff erlauben — ${esc(appName)}</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{margin:0;background:oklch(0.985 0.003 264);color:oklch(0.21 0.021 264);
       font:15px/1.6 Inter,system-ui,-apple-system,sans-serif;
       display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:24px}
  .card{background:#fff;border:1px solid oklch(0.91 0.005 264);border-radius:16px;
        padding:36px;max-width:460px;width:100%}
  .brand{font-family:"Space Grotesk",Inter,sans-serif;font-weight:600;font-size:15px;
         letter-spacing:-0.02em;margin-bottom:28px;color:oklch(0.21 0.021 264)}
  .brand span{color:oklch(0.55 0.216 264)}
  h1{font-family:"Space Grotesk",Inter,sans-serif;font-size:22px;margin:0 0 8px;letter-spacing:-0.02em}
  p{color:oklch(0.40 0.017 264);margin:0 0 20px}
  .who{font-size:13px;color:oklch(0.58 0.012 264);margin:0 0 20px}
  ul{margin:0 0 20px;padding-left:20px;color:oklch(0.40 0.017 264);font-size:14px}
  li{margin-bottom:4px}
  dl{margin:0 0 24px;font-size:14px;border-top:1px solid oklch(0.94 0.004 264);padding-top:16px}
  dt{color:oklch(0.58 0.012 264);font-size:11px;letter-spacing:0.12em;text-transform:uppercase;margin-top:12px}
  dt:first-child{margin-top:0}
  dd{margin:3px 0 0;word-break:break-all;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:13px}
  .row{display:flex;gap:10px}
  button{flex:1;padding:12px;font-size:15px;font-weight:600;cursor:pointer;border-radius:9px;
         font-family:inherit}
  .ok{border:none;background:oklch(0.55 0.216 264);color:#fff}
  .no{border:1px solid oklch(0.88 0.006 264);background:#fff;color:oklch(0.40 0.017 264)}
</style></head><body>
  <form class="card" method="post">
    <div class="brand">${esc(appName)}</div>
    <h1>Zugriff erlauben?</h1>
    <p><strong>${esc(clientName || 'Ein Client')}</strong> möchte in deinem Namen auf
       deine Lebensläufe und Anschreiben zugreifen.</p>
    <ul>
      <li>Lebensläufe und Anschreiben lesen</li>
      <li>Inhalte als Markdown zurückschreiben</li>
      <li>Vorlage, Sprache und Einstellungen ändern</li>
    </ul>
    <p class="who">Angemeldet als <strong>${esc(username)}</strong>. Du kannst die
       Verbindung jederzeit im Konto unter „Schlüssel &amp; Verbindungen" beenden.</p>
    <dl>
      <dt>Rückleitung an</dt><dd>${esc(host)}</dd>
    </dl>
    ${hidden}
    <div class="row">
      <button class="no" type="submit" name="action" value="deny">Ablehnen</button>
      <button class="ok" type="submit" name="action" value="allow">Erlauben</button>
    </div>
  </form>
</body></html>`;
}

/**
 * Hängt alle OAuth-Routen in die App.
 *
 * @param app        Express-App
 * @param pool       pg-Pool
 * @param loadUser   (req) => user|null — die bestehende Session-Auflösung
 * @param requireAuth Express-Middleware für die Konto-Endpunkte
 * @param baseUrlOf  (req) => string|null — geprüfte öffentliche Basis-Adresse
 * @param appName    Anzeigename für die Zustimmungsseite
 * @param urlencoded Express-Body-Parser für Formulare
 */
export function mountOAuth(app, { pool, loadUser, requireAuth, baseUrlOf, appName, urlencoded }) {
  const form = urlencoded;

  /** Ohne bekannte öffentliche Adresse ist jede Metadaten-Antwort geraten. */
  function requireBase(req, res) {
    const base = baseUrlOf(req);
    if (!base) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'PUBLIC_BASE_URL ist nicht gesetzt und der Host ist nicht in TRUSTED_HOSTS.',
      });
      return null;
    }
    return base;
  }

  const meta = fn => (req, res) => {
    const base = requireBase(req, res);
    if (!base) return;
    res.set('Access-Control-Allow-Origin', '*');
    res.json(fn(base));
  };
  app.get('/.well-known/oauth-protected-resource', meta(protectedResourceMetadata));
  app.get('/.well-known/oauth-protected-resource/mcp', meta(protectedResourceMetadata));
  app.get('/.well-known/oauth-authorization-server', meta(authorizationServerMetadata));
  app.get('/.well-known/oauth-authorization-server/mcp', meta(authorizationServerMetadata));

  // ── Dynamic Client Registration (RFC 7591) ────────────────────────────────
  // Offen, absichtlich: der Client bekommt hier nur eine Kennung, keinen
  // Zugriff. Zugriff entsteht erst, wenn ein angemeldeter Mensch auf der
  // Zustimmungsseite „Erlauben" klickt.
  app.post('/api/oauth/register', form, async (req, res) => {
    const b = req.body || {};
    const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris : [];
    if (uris.length === 0 || uris.length > 10 || !uris.every(redirectUriAllowed)) {
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: 'redirect_uris fehlt oder enthält eine unzulässige Adresse (https, oder http auf localhost).',
      });
    }
    const name = typeof b.client_name === 'string' ? b.client_name.slice(0, 120) : '';
    const id = 'cvc_' + crypto.randomBytes(16).toString('hex');
    await pool.query(
      'INSERT INTO oauth_clients (id, name, redirect_uris) VALUES ($1, $2, $3)',
      [id, name, JSON.stringify(uris)],
    );
    res.status(201).json({
      client_id: id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name || undefined,
      redirect_uris: uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
  });

  /** Gemeinsame Prüfung für GET und POST auf /authorize. */
  async function checkParams(q) {
    const clientId = typeof q.client_id === 'string' ? q.client_id : '';
    const { rows } = await pool.query('SELECT * FROM oauth_clients WHERE id = $1', [clientId]);
    const client = rows[0];
    if (!client) return { error: 'invalid_client', description: 'client_id unbekannt.' };
    const list = Array.isArray(client.redirect_uris) ? client.redirect_uris : JSON.parse(client.redirect_uris);
    const redirectUri = typeof q.redirect_uri === 'string' && q.redirect_uri ? q.redirect_uri : list[0];
    if (!list.includes(redirectUri)) {
      return { error: 'invalid_request', description: 'redirect_uri gehört nicht zu dieser Registrierung.' };
    }
    if (q.response_type !== 'code') {
      return { error: 'unsupported_response_type', description: 'Nur response_type=code.' };
    }
    if (q.code_challenge_method !== 'S256' || typeof q.code_challenge !== 'string' || q.code_challenge.length < 20) {
      return { error: 'invalid_request', description: 'PKCE mit code_challenge_method=S256 ist Pflicht.' };
    }
    return { client, redirectUri };
  }

  const carry = q => ({
    client_id: q.client_id,
    redirect_uri: q.redirect_uri ?? '',
    response_type: 'code',
    code_challenge: q.code_challenge,
    code_challenge_method: 'S256',
    state: q.state ?? '',
    scope: q.scope ?? 'cv',
    resource: q.resource ?? '',
  });

  app.get('/api/oauth/authorize', async (req, res) => {
    const base = requireBase(req, res);
    if (!base) return;
    const chk = await checkParams(req.query);
    if (chk.error) return res.status(400).type('text/plain').send(`${chk.error}: ${chk.description}`);

    const user = await loadUser(req);
    if (!user) {
      // Nicht angemeldet: ins Tool schicken und danach exakt hierher zurück.
      // Der Rücksprungpfad bleibt relativ — eine absolute Adresse von außen
      // wäre ein offener Weiterleiter.
      const qs = new URLSearchParams(carry(req.query)).toString();
      // Rücksprungziel relativ zur öffentlichen Basis — eine absolute Adresse
      // von außen wäre ein offener Weiterleiter.
      const path = endpointsBase(base).replace(base, '') || '/oauth';
      return res.redirect(302, `${base}/?next=${encodeURIComponent(`${path}/authorize?${qs}`)}`);
    }
    res.type('html').send(consentPage({
      appName,
      username: user.username,
      clientName: chk.client.name,
      redirectUri: chk.redirectUri,
      params: carry(req.query),
    }));
  });

  app.post('/api/oauth/authorize', form, async (req, res) => {
    const chk = await checkParams(req.body || {});
    if (chk.error) return res.status(400).type('text/plain').send(`${chk.error}: ${chk.description}`);
    const user = await loadUser(req);
    if (!user) return res.status(401).type('text/plain').send('Nicht angemeldet.');

    const back = new URL(chk.redirectUri);
    if (req.body.state) back.searchParams.set('state', req.body.state);

    if (req.body.action !== 'allow') {
      back.searchParams.set('error', 'access_denied');
      return res.redirect(302, back.toString());
    }

    const code = 'cvo_' + crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scope, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval)`,
      [sha256(code), chk.client.id, user.id, chk.redirectUri, req.body.code_challenge, req.body.scope || 'cv', String(CODE_TTL_S)],
    );
    back.searchParams.set('code', code);
    res.redirect(302, back.toString());
  });

  /* Der Refresh-Token hat eine ABSOLUTE Lebensdauer.
   *
   * Beim Erneuern einen frischen Refresh-Token mit voller Frist auszugeben,
   * hieße: Wer einmal einen Token hat, behält den Zugang für immer, solange er
   * ihn einmal im Jahr benutzt. Deshalb wird das Ende der Kette beim ersten
   * Ausstellen festgelegt und beim Erneuern weitergereicht. */
  function refreshTtlFor(ende) {
    if (!ende) return REFRESH_TTL_S;
    const rest = Math.floor((new Date(ende).getTime() - Date.now()) / 1000);
    return Math.max(60, Math.min(REFRESH_TTL_S, rest));
  }

  /** Legt Access- und Refresh-Token an und gibt die Antwort nach RFC 6749 zurück. */
  async function issue({ userId, clientId, clientName, scope, refreshAbsoluteEnd = null }) {
    const access = 'cvm_' + crypto.randomBytes(32).toString('hex');
    const refresh = 'cvr_' + crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO oauth_tokens (token_hash, refresh_hash, user_id, client_id, client_name, scope, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, now() + ($7 || ' seconds')::interval, now() + ($8 || ' seconds')::interval)`,
      [sha256(access), sha256(refresh), userId, clientId, clientName || '', scope || 'cv',
       String(ACCESS_TTL_S), String(refreshTtlFor(refreshAbsoluteEnd))],
    );
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_S,
      refresh_token: refresh,
      scope: scope || 'cv',
    };
  }

  app.post('/api/oauth/token', form, async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'no-store');
    const b = req.body || {};

    if (b.grant_type === 'authorization_code') {
      const hash = sha256(b.code || '');
      // Einmalgebrauch: der Code wird im selben Schritt als verbraucht
      // markiert, in dem er gelesen wird. Zwei parallele Einlösungen können so
      // nicht beide gewinnen.
      const { rows } = await pool.query(
        `UPDATE oauth_codes SET used = true
          WHERE code_hash = $1 AND NOT used AND expires_at > now()
          RETURNING *`,
        [hash],
      );
      const code = rows[0];
      if (!code) return res.status(400).json({ error: 'invalid_grant', error_description: 'Code ungültig, verbraucht oder abgelaufen.' });
      if (typeof b.redirect_uri === 'string' && b.redirect_uri && b.redirect_uri !== code.redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri passt nicht zum Code.' });
      }
      if (b.client_id && b.client_id !== code.client_id) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id passt nicht zum Code.' });
      }
      if (!pkceMatches(b.code_verifier, code.code_challenge)) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'code_verifier passt nicht zur code_challenge.' });
      }
      const { rows: cr } = await pool.query('SELECT name FROM oauth_clients WHERE id = $1', [code.client_id]);
      return res.json(await issue({
        userId: code.user_id, clientId: code.client_id, clientName: cr[0]?.name, scope: code.scope,
      }));
    }

    if (b.grant_type === 'refresh_token') {
      const { rows } = await pool.query(
        `SELECT t.*, u.disabled FROM oauth_tokens t JOIN users u ON u.id = t.user_id
          WHERE t.refresh_hash = $1 AND NOT t.revoked`,
        [sha256(b.refresh_token || '')],
      );
      const t = rows[0];
      if (!t || t.disabled) return res.status(400).json({ error: 'invalid_grant', error_description: 'refresh_token ungültig oder widerrufen.' });
      /* Abgelaufene Kette: Der Client muss sich neu anmelden. Alte Zeilen ohne
         `refresh_expires_at` (vor dieser Migration ausgestellt) bekommen die
         Frist ab jetzt — sie stillschweigend für immer gelten zu lassen wäre
         genau der Fehler, den diese Änderung behebt. */
      if (t.refresh_expires_at && new Date(t.refresh_expires_at).getTime() < Date.now()) {
        await pool.query('UPDATE oauth_tokens SET revoked = true WHERE id = $1', [t.id]);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'refresh_token abgelaufen.' });
      }
      // Der alte Access-Token wird ersetzt, nicht ergänzt.
      await pool.query('UPDATE oauth_tokens SET revoked = true WHERE id = $1', [t.id]);
      return res.json(await issue({
        userId: t.user_id, clientId: t.client_id, clientName: t.client_name, scope: t.scope,
        refreshAbsoluteEnd: t.refresh_expires_at,
      }));
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
  });

  // RFC 7009. Antwortet auch bei unbekanntem Token mit 200 — so ist es
  // vorgeschrieben, und es verrät nicht, welche Token existieren.
  app.post('/api/oauth/revoke', form, async (req, res) => {
    const t = String(req.body?.token || '');
    if (t) {
      await pool.query(
        'UPDATE oauth_tokens SET revoked = true WHERE token_hash = $1 OR refresh_hash = $1',
        [sha256(t)],
      );
    }
    res.sendStatus(200);
  });

  // ── Konto: verbundene Clients sehen und beenden ───────────────────────────
  app.get('/api/oauth/connections', requireAuth, async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, client_name, created_at, last_used_at, expires_at, revoked
         FROM oauth_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.user.id],
    );
    res.json({ connections: rows });
  });

  app.post('/api/oauth/connections/:id/revoke', requireAuth, async (req, res) => {
    await pool.query(
      'UPDATE oauth_tokens SET revoked = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id],
    );
    res.json({ ok: true });
  });
}

/**
 * Löst ein Access-Token zu seinem Nutzer auf. Wird von der bestehenden
 * Auth-Kette benutzt, damit ein cvm_-Token überall dort gilt, wo auch ein
 * API-Schlüssel gilt — und nirgends sonst.
 */
export async function userForAccessToken(pool, token) {
  const { rows } = await pool.query(
    `SELECT u.* FROM oauth_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1 AND NOT t.revoked AND t.expires_at > now() AND NOT u.disabled`,
    [sha256(token)],
  );
  if (!rows[0]) return null;
  pool.query('UPDATE oauth_tokens SET last_used_at = now() WHERE token_hash = $1', [sha256(token)]).catch(() => {});
  return rows[0];
}
