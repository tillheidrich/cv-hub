# Changelog

## 2026-09-16

**MCP can create, rename, and write per language.** Three gaps that surfaced on
first real use — and forced a workaround:

- There was no `create_resume`. A client asked to write a new CV had to
  overwrite an existing one, because that was the only way. A tool must not
  force that.
- There was no rename. `PUT` wants the full payload, so changing a name meant
  round-tripping the whole profile and risking it.
- The Markdown bridge could only read and write the *selected* language. A
  profile keeps all four separately, so revising the German one leaves the
  others untouched — invisible until someone exports there and finds the demo
  person in their PDF.

`lang` is now optional on the Markdown endpoints and tools. Importing a
translation does **not** switch the profile's selected language, and an
explicit target beats the `lang:` line in the frontmatter — otherwise the
content would decide where it is written.

No `delete_resume`. Deleting stays in the UI: a tool that lets a model remove
CVs is a bad trade for the convenience it buys.

**The hosted MCP endpoint is multi-tenant.** Every user of an instance
authorizes their own AI client and sees only their own data. Paste
`https://your-domain/mcp` into the client — it registers itself, your instance
opens, the user is already signed in, they press *Allow*. No tokens are copied
anywhere.

- **The authorization server lives in the backend** (`pdf-service/oauth.js`),
  not in the MCP service. The first attempt put it in the MCP container, which
  has no users, no sessions and no database — so it could serve exactly one
  account, behind a shared secret. Identity belongs where the identities are.
- OAuth 2.1 with dynamic client registration (RFC 7591), PKCE (S256 only —
  OAuth 2.1 dropped `plain`), refresh, and revocation (RFC 7009). The consent
  screen runs against the existing session; users who are not signed in are
  sent to the app and land back on consent afterwards.
- **The MCP service is deliberately dumb**: no passwords, no user list. It
  passes the caller's token to the API and lets the API decide. The token rides
  on the async context rather than a module variable — in a process serving
  many users, a module variable would be a data leak waiting to happen.
- Authorization codes are single-use, enforced in the same `UPDATE` that reads
  them. Tokens and codes are stored hashed, like the API keys.
- New: *Settings → Connected apps* — see and end every connection.
- `docker-compose.yml` now includes the MCP service; `CV_API_KEY` must not be
  set there.
- Verified against a real Postgres with two users: over the same endpoint each
  sees only their own CVs, and neither can read or write the other's.


## 2026-09-14

**Security.** Five findings from a pre-release review, all of them also
affecting the private upstream instance:

- `publicBaseUrl` no longer reads `x-forwarded-host`. A forged header produced
  admin emails whose "accept" button pointed at the attacker's server; one click
  handed them a valid action token, and with it an invite code. Configured value
  first, then the `Host` header and only if it is a known host, otherwise none —
  the notification then ships without buttons and points at the admin panel.
  The same source now feeds share links, photo URLs and the share-card
  same-origin check (which was itself a bypass of the tracking-pixel guard).
- `GET /api/access/action` no longer has an effect. Mail scanners follow links
  automatically, which silently accepted access requests. GET shows a
  confirmation, POST acts. Token lifetime 30 days → 3.
- The container no longer runs as root (`USER pwuser`).
- The SSRF allowlist no longer permits `127.0.0.1` on any port, and the
  "same host" branch no longer precedes the private-address check — nor is the
  host taken from a header. Extracted to `pdf-service/ssrf.js` with tests.
- `trust proxy` is configurable via `TRUST_PROXY` and defaults to "no proxy".
  Hard-wiring `1` without a proxy disabled every rate limit in the file.

**Renamed.** Five templates named after trademarked characters became
`sonnenblume`, `schiefer`, `azur`, `amethyst`, `farn`; the old IDs remain as
aliases.

**Synced with upstream** (September work): flow-based pagination, measured type
scale (8.8 pt body, 8.2 pt floor), eight new templates, every label editable,
inline editing in the document, one-page workshop with shortening advisor,
"template without data" export, selectable paper colour, mobile fixes, and the
check scripts that go with them.

All notable changes to CV-Hub. Loosely follows
[Keep a Changelog](https://keepachangelog.com/); semantic versioning starts with
the first tagged release.

## [Unreleased]

### Added
- Initial open-source release under AGPL-3.0, derived from a production résumé
  tool. Neutralized for self-hosting: configurable `APP_NAME`, English default,
  environment-driven configuration, `docker-compose` quickstart.
- Core features: 28 templates, four languages (EN/DE/FR/ES), PDF/HTML/Markdown/
  JSON export, automatic A4 fitting, Markdown AI bridge, optional MCP server,
  invite-only accounts, optional email 2FA, share links, version history,
  GDPR export/delete, demo mode.

See `NEUTRALIZATION.md` for the generalization status and remaining work.
