// Postgres connection + schema bootstrap for cv-api.
import pg from 'pg';
import { migrateGrants } from './grants.js';

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
-- Der Refresh-Token hatte keinen Ablauf: die Konstante dafür war deklariert
-- und wurde nie benutzt, der Grant prüfte nur das Widerrufs-Kennzeichen. Ein
-- einmal abgeflossener Refresh-Token hätte auf unbestimmte Zeit frische
-- Access-Token geliefert. (Backticks haben in dieser Datei nichts zu suchen:
-- das SQL steht in einem Template-Literal.)
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS refresh_expires_at TIMESTAMPTZ;

-- Sharelinks mit festem Stand (08.10.2026). Beim Anlegen entsteht ein Abzug
-- der sichtbaren Fassung: eine Sprache, nichts Ausgeblendetes, kein
-- Originalfoto. Bestehende Links haben NULL und bekommen ihren Stand beim
-- ersten Abruf aus dem dann aktuellen Profil.
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS snapshot JSONB;
CREATE INDEX IF NOT EXISTS share_views_viewed_idx ON share_views(viewed_at);

-- Abmelden entwertet die Sitzung serverseitig (08.10.2026). Gespeichert wird
-- der Hash des Sitzungs-Tokens bis zu dessen Ablauf; der Aufräumjob entfernt
-- abgelaufene Zeilen. Gilt auch für Sitzungen, die vor dieser Änderung
-- ausgestellt wurden.
CREATE TABLE IF NOT EXISTS session_revocations (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Pilot mit Laufzeit je Platz (08.10.2026, Gegenprüfung H2).
-- invite_codes.expires_at begrenzt nur das Einlösen. access_days am Code legt
-- fest, wie lange ein damit angelegtes Konto schreiben darf; beim Einlösen
-- wird daraus users.access_until. NULL heißt unbegrenzt, so bleiben alle
-- Bestandskonten, wie sie sind. Nach Ablauf: lesen und exportieren ja,
-- ändern nein, gelöscht wird nichts.
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS access_days INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_until TIMESTAMPTZ;
-- Wann der Hinweis 14 bzw. 3 Tage vor Ablauf verschickt wurde. Verlängern
-- setzt beide zurück, damit die Hinweise zum neuen Datum wieder kommen.
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_notice14_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_notice3_at TIMESTAMPTZ;
-- Die Auswertung je Code zählt Ereignisse je Nutzer und Art.
CREATE INDEX IF NOT EXISTS events_user_kind_idx ON events(user_id, kind);

-- ── Bezahlung über Mollie, offene Registrierung (09.10.2026) ──────────────
-- signup_source: NULL = Einladung oder Bestand, 'self' = offene Registrierung.
-- plan_kind: NULL = aus access_until abgeleitet (unbegrenzt oder Pilot),
-- 'none' = registriert ohne Pass, 'pass' = mindestens einmal bezahlt.
-- Bestandskonten bekommen keinen Wert und bleiben damit, wie sie sind.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_kind TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_confirmed_16_at TIMESTAMPTZ;

-- Double-Opt-in. Gespeichert wird nur der Hash des Tokens, 48 Stunden gültig.
CREATE TABLE IF NOT EXISTS email_confirmations (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_confirmations_user_idx ON email_confirmations(user_id);

-- Gelöste ALTCHA-Aufgaben bis zu ihrem Ablauf (Wiederholungsschutz).
CREATE TABLE IF NOT EXISTS altcha_spent (
  id          TEXT PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Bestellungen. Bleiben nach einer Kontolöschung mit Minimaldaten stehen
-- (user_id wird NULL): Rechnungen sind 10 Jahre aufzubewahren (Paragraf 147
-- AO, 14b UStG; Art. 17 Abs. 3 lit. b DSGVO). Nie bezahlte Bestellungen
-- löscht der Aufräumjob nach 30 Tagen.
CREATE SEQUENCE IF NOT EXISTS order_no_seq START 1001;
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY,
  order_no            TEXT UNIQUE NOT NULL,
  user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email               TEXT NOT NULL,
  billing_name        TEXT NOT NULL,
  country             TEXT NOT NULL,
  sku                 TEXT NOT NULL,
  amount_cents        INTEGER NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'EUR',
  status              TEXT NOT NULL DEFAULT 'open',
  mollie_payment_id   TEXT UNIQUE,
  checkout_url        TEXT,
  locale              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at             TIMESTAMPTZ,
  terms_version       TEXT,
  withdrawal_version  TEXT,
  age_confirmed_18    BOOLEAN NOT NULL DEFAULT false,
  pass_days           INTEGER NOT NULL,
  pass_from           TIMESTAMPTZ,
  pass_until          TIMESTAMPTZ,
  invoice_no          TEXT UNIQUE,
  refund_id           TEXT,
  refund_status       TEXT,
  refund_attempts     INTEGER NOT NULL DEFAULT 0,
  withdrawn_at        TIMESTAMPTZ,
  withdraw_channel    TEXT,
  withdraw_statement  TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  last_synced_at      TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_paid_idx ON orders(paid_at);

-- Kündigung (Paragraf 312k BGB, Kündigungsschaltfläche). Der Pass endet
-- zum gewählten Zeitpunkt; die Bestellung bleibt "paid".
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_kind TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_effective_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_channel TEXT;

-- Jede Widerrufs- und Kündigungserklärung im Wortlaut, auch die, die sich
-- nicht sofort einer Bestellung zuordnen lässt — eine Erklärung ist wirksam,
-- auch wenn der Abgleich scheitert, und braucht dann Handarbeit.
-- status: 'processed' (automatisch erledigt), 'manual' (offen), 'done'.
CREATE TABLE IF NOT EXISTS declarations (
  id           UUID PRIMARY KEY,
  type         TEXT NOT NULL,
  channel      TEXT NOT NULL,
  name         TEXT,
  email        TEXT,
  order_no     TEXT,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  order_ids    UUID[] NOT NULL DEFAULT '{}',
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  statement    TEXT NOT NULL,
  status       TEXT NOT NULL,
  note         TEXT,
  resolved_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS declarations_status_idx ON declarations(status, received_at);

-- Lückenlose Rechnungsnummern je Jahr. Vergeben wird erst bei "paid", in
-- derselben Transaktion wie der Statuswechsel: Die Zeile des Jahres ist
-- dabei gesperrt, ein Abbruch nimmt die Nummer mit zurück.
CREATE TABLE IF NOT EXISTS invoice_counters (
  year  INTEGER PRIMARY KEY,
  last  INTEGER NOT NULL
);

-- ── Gutscheine und Herkunft je Berechtigung (09.10.2026) ──────────────────
-- Einmalige Datenmigrationen (z. B. Grants für den Altbestand) merken sich
-- hier, dass sie gelaufen sind.
CREATE TABLE IF NOT EXISTS schema_migrations (
  name    TEXT PRIMARY KEY,
  ran_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Jede Berechtigung eine Zeile. users.access_until und plan_kind sind nur
-- noch der Spiegel der Neuberechnung aus diesen Zeilen (grants.js).
--   source: order (bezahlte Bestellung), voucher (Gutschein), pilot
--           (Einladung mit Laufzeit), admin (Freischaltung von Hand),
--           legacy (übernommener Altwert, siehe grants.js ensureBaseline)
--   kind:   days, lifetime, set (nur admin/legacy: Ende = until_at, NULL = unbegrenzt)
--   ends_at: Kündigung — der Abschnitt endet spätestens hier
--   effective_from/effective_until: zuletzt berechneter Abschnitt (Anzeige,
--           Auswertung); bei widerrufenen Zeilen der Stand zum Widerruf
CREATE TABLE IF NOT EXISTS access_grants (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source           TEXT NOT NULL CHECK (source IN ('order', 'voucher', 'pilot', 'admin', 'legacy')),
  source_id        TEXT,
  kind             TEXT NOT NULL CHECK (kind IN ('days', 'lifetime', 'set')),
  days             INTEGER CHECK (days IS NULL OR (days >= 1 AND days <= 3650)),
  until_at         TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  granted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at       TIMESTAMPTZ,
  revoke_reason    TEXT,
  effective_from   TIMESTAMPTZ,
  effective_until  TIMESTAMPTZ,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'days' AND days IS NOT NULL) OR (kind <> 'days' AND days IS NULL)),
  CHECK (kind <> 'set' OR source IN ('admin', 'legacy'))
);
CREATE INDEX IF NOT EXISTS access_grants_user_idx ON access_grants(user_id, granted_at, id);
-- Eine Bestellung gewährt höchstens einmal Laufzeit (Webhook-Wiederholungen).
CREATE UNIQUE INDEX IF NOT EXISTS access_grants_order_uq ON access_grants(source_id) WHERE source = 'order';

-- Kampagnen bündeln Codes (z. B. LinkedIn + Newsletter): höchstens eine
-- Einlösung je Konto und Kampagne.
CREATE TABLE IF NOT EXISTS voucher_campaigns (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  name_key    TEXT UNIQUE NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gutscheine. Gespeichert wird nur der SHA-256 der Normalform; öffentliche
-- Codes zusätzlich im Klartext (sie sind nicht geheim), persönliche nur mit
-- den letzten vier Zeichen als Hinweis.
CREATE TABLE IF NOT EXISTS vouchers (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  campaign_id      INTEGER REFERENCES voucher_campaigns(id) ON DELETE RESTRICT,
  distribution     TEXT NOT NULL CHECK (distribution IN ('personal', 'public')),
  code_hash        TEXT UNIQUE NOT NULL,
  code_plain       TEXT,
  code_hint        TEXT,
  kind             TEXT NOT NULL CHECK (kind IN ('days', 'lifetime')),
  days             INTEGER,
  max_redemptions  INTEGER CHECK (max_redemptions IS NULL OR max_redemptions >= 1),
  redemptions      INTEGER NOT NULL DEFAULT 0 CHECK (redemptions >= 0),
  redeem_until     TIMESTAMPTZ,
  active           BOOLEAN NOT NULL DEFAULT true,
  batch_id         TEXT,
  deactivated_at   TIMESTAMPTZ,
  deactivated_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deactivate_note  TEXT,
  created_by       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'days' AND days BETWEEN 1 AND 3650) OR (kind = 'lifetime' AND days IS NULL)),
  CHECK (distribution = 'personal' OR redeem_until IS NOT NULL),
  CHECK (distribution = 'personal' OR code_plain IS NOT NULL),
  CHECK (max_redemptions IS NULL OR redemptions <= max_redemptions)
);
CREATE INDEX IF NOT EXISTS vouchers_campaign_idx ON vouchers(campaign_id);

-- Typ, Dauer, Kampagne und Code sind nach der ersten Einlösung fest. Es gibt
-- dafür ohnehin keinen Bearbeiten-Weg; die Sperre steht trotzdem in der
-- Datenbank, damit ihn auch kein späterer Code aus Versehen baut.
CREATE OR REPLACE FUNCTION vouchers_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.redemptions > 0 AND (
       NEW.kind IS DISTINCT FROM OLD.kind OR NEW.days IS DISTINCT FROM OLD.days
    OR NEW.campaign_id IS DISTINCT FROM OLD.campaign_id OR NEW.distribution IS DISTINCT FROM OLD.distribution
    OR NEW.code_hash IS DISTINCT FROM OLD.code_hash) THEN
    RAISE EXCEPTION 'voucher % ist schon eingelöst: Typ, Dauer, Kampagne und Code sind fest', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS vouchers_guard ON vouchers;
CREATE TRIGGER vouchers_guard BEFORE UPDATE ON vouchers FOR EACH ROW EXECUTE FUNCTION vouchers_guard();

-- Einlösungen. Bleiben nach einer Kontolöschung ohne Personenbezug stehen
-- (user_id NULL), damit Zähler und Auswertung stimmen.
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id             SERIAL PRIMARY KEY,
  voucher_id     INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  campaign_id    INTEGER REFERENCES voucher_campaigns(id) ON DELETE RESTRICT,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  grant_id       INTEGER REFERENCES access_grants(id) ON DELETE SET NULL,
  redeemed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind           TEXT NOT NULL,
  days           INTEGER,
  granted_from   TIMESTAMPTZ,
  granted_until  TIMESTAMPTZ,
  origin         TEXT NOT NULL DEFAULT 'account'
);
-- Doppeleinlösung je Konto+Code und Konto+Kampagne verhindert die Datenbank.
CREATE UNIQUE INDEX IF NOT EXISTS voucher_redemptions_voucher_user_uq ON voucher_redemptions(voucher_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS voucher_redemptions_campaign_user_uq ON voucher_redemptions(campaign_id, user_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS voucher_redemptions_user_idx ON voucher_redemptions(user_id);

-- Protokoll der Admin-Aktionen (Gutscheine anlegen und deaktivieren,
-- Laufzeiten ändern). Keine vollständigen persönlichen Codes.
CREATE TABLE IF NOT EXISTS admin_audit (
  id          SERIAL PRIMARY KEY,
  admin_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit(created_at DESC);

-- ── Sicherheit Runde 6 (09.10.2026, SICHERHEIT.md) ───────────────────────
-- M2: Eine neue Adresse wird erst vorgemerkt. Erst der Link an die neue
-- Adresse (email_confirmations.kind = 'change') macht sie zur Adresse des
-- Kontos. Bis dahin gilt die alte.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email TEXT;
ALTER TABLE email_confirmations ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'signup';

-- H2, M1: Öffentlicher Widerruf und öffentliche Kündigung wirken erst nach
-- dem Klick auf den Link an die Bestelladresse. Gespeichert wird nur der
-- Hash des Tokens, 14 Tage gültig, einmalig. request hält, was zur
-- Ausführung gebraucht wird (Art, Zeitpunkt, Grund, eingegebener Name);
-- received_at bleibt der Eingang und zählt für die Rechtzeitigkeit.
-- status: zusätzlich 'pending_confirmation' (wartet auf den Klick).
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS confirm_token_hash TEXT;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS confirm_expires_at TIMESTAMPTZ;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS request JSONB;
ALTER TABLE declarations ADD COLUMN IF NOT EXISTS result JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS declarations_confirm_token_uq ON declarations(confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;
`;

/** Connect with retry (Postgres may still be starting) and create the schema. */
export async function initDb(retries = 12) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query('SELECT 1');
      await pool.query(SCHEMA);
      console.log('db: schema ready');
      // Einmalig: Berechtigungen für den Altbestand nachtragen, ohne eine
      // gespeicherte Laufzeit zu ändern (Abweichungen stehen im Log).
      await migrateGrants(pool);
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
