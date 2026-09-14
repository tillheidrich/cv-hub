# Changelog

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
