// Postgres connection + schema bootstrap for cv-api.
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Coolify-internal Postgres — no TLS.
  ssl: false,
  max: 8,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  disabled      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code        TEXT PRIMARY KEY,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT,
  max_uses    INTEGER NOT NULL DEFAULT 1,
  uses        INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invite_redemptions (
  id           SERIAL PRIMARY KEY,
  code         TEXT REFERENCES invite_codes(code) ON DELETE CASCADE,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resumes (
  id            TEXT PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  payload       JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resumes_user_idx ON resumes(user_id);

CREATE TABLE IF NOT EXISTS events (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  key_hash      TEXT UNIQUE NOT NULL,
  prefix        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ,
  revoked       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);

CREATE TABLE IF NOT EXISTS photos (
  id          TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  data        BYTEA NOT NULL,
  size_bytes  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_user_idx ON photos(user_id);

CREATE TABLE IF NOT EXISTS share_links (
  token        TEXT PRIMARY KEY,
  resume_id    TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  created_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ,
  revoked      BOOLEAN NOT NULL DEFAULT false,
  view_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_resume_idx ON share_links(resume_id);

-- Idempotent column additions for already-running databases.
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS include_cover_letter BOOLEAN NOT NULL DEFAULT true;

-- E-Mail-Adresse je Nutzer (für Onboarding, Passwort-Reset, Offboarding).
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email)) WHERE email IS NOT NULL;

-- Optional: an eine E-Mail gebundener Invite-Code (Onboarding per Mail).
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS email TEXT;

-- Self-Service-Passwort-Reset: einmalige, ablaufende Tokens.
CREATE TABLE IF NOT EXISTS password_resets (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id);

-- Zwei-Faktor-Login per E-Mail-Code (opt-in je Nutzer, abschaltbar).
ALTER TABLE users ADD COLUMN IF NOT EXISTS twofa_enabled BOOLEAN NOT NULL DEFAULT false;

-- Passwort-Änderungszeitpunkt: bump entwertet ältere Sessions (in die JWT-
-- Session eingebettete pcat-Marke). BEWUSST ohne DEFAULT — sonst würde ADD
-- COLUMN alle Bestandszeilen mit now() backfillen und beim Deploy jede aktive
-- Session zwangsabmelden. NULL zählt als 0 (kein Deploy-Logout).
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Kurzlebige Login-Codes für den 2FA-Schritt. Der Browser hält nur die
-- 'challenge'; der 6-stellige Code wird ausschließlich als Hash gespeichert.
CREATE TABLE IF NOT EXISTS login_codes (
  challenge   TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash   TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INTEGER NOT NULL DEFAULT 0,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_codes_user_idx ON login_codes(user_id);

CREATE TABLE IF NOT EXISTS share_views (
  id           SERIAL PRIMARY KEY,
  token        TEXT NOT NULL REFERENCES share_links(token) ON DELETE CASCADE,
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  variant      TEXT NOT NULL DEFAULT 'html',   -- 'html' | 'md'
  ua_summary   TEXT                             -- e.g. "Chrome/Mac", "Safari/iOS" — no IP, no full UA
);
CREATE INDEX IF NOT EXISTS share_views_token_idx ON share_views(token);

-- Version history (undo target for MD/JSON imports and AI rewrites)
CREATE TABLE IF NOT EXISTS resume_versions (
  id          SERIAL PRIMARY KEY,
  resume_id   TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  source      TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'md_import' | 'cl_md_import' | 'ai_cover' | 'json_import' | 'restore'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS resume_versions_resume_idx ON resume_versions(resume_id, created_at DESC);

-- Zugangsanfragen ohne Login: Besucher fragen Zugang an, Admin nimmt an/lehnt
-- ab (per signiertem E-Mail-Link ODER im Admin-Panel). Bei Annahme wird ein
-- an die E-Mail gebundener Invite-Code erzeugt und dem Anfragenden zugesandt.
CREATE TABLE IF NOT EXISTS access_requests (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'accepted' | 'rejected'
  invite_code  TEXT,                              -- gesetzt bei Annahme
  decided_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL = per E-Mail-Link
  ua_summary   TEXT,                              -- grober Browser/OS-String, keine IP
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS access_requests_status_idx ON access_requests(status, created_at DESC);

-- OAuth 2.1 für den MCP-Endpunkt.
--
-- Der Anmeldedienst liegt hier und nicht im MCP-Dienst, weil hier die Nutzer,
-- die Sessions und die Datenbank sind. Nur so kann sich JEDER Nutzer seinen
-- eigenen Client verbinden — mit Zustand im MCP-Dienst wäre der Endpunkt für
-- immer Single-Tenant geblieben.
--
-- Token liegen NUR als Hash vor, wie die API-Schlüssel auch. Ein Datenbank-
-- Leck gibt damit keine benutzbaren Zugänge her.
CREATE TABLE IF NOT EXISTS oauth_clients (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',
  redirect_uris JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash      TEXT PRIMARY KEY,
  client_id      TEXT NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redirect_uri   TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  scope          TEXT NOT NULL DEFAULT 'cv',
  expires_at     TIMESTAMPTZ NOT NULL,
  used           BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS oauth_codes_expiry_idx ON oauth_codes(expires_at);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id           SERIAL PRIMARY KEY,
  token_hash   TEXT UNIQUE NOT NULL,
  refresh_hash TEXT UNIQUE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id    TEXT NOT NULL,
  client_name  TEXT NOT NULL DEFAULT '',
  scope        TEXT NOT NULL DEFAULT 'cv',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked      BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS oauth_tokens_user_idx ON oauth_tokens(user_id, created_at DESC);
`;

/** Connect with retry (Postgres may still be starting) and create the schema. */
export async function initDb(retries = 12) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      await pool.query(SCHEMA);
      console.log('db: schema ready');
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`db: not ready (attempt ${attempt}/${retries}) — retrying in 5s`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

export function logEvent(userId, kind) {
  pool.query('INSERT INTO events (user_id, kind) VALUES ($1, $2)', [userId ?? null, kind])
    .catch(() => {});
}
