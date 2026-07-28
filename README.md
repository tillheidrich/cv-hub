# CV-Hub

**Self-hosted résumé & cover-letter studio.** Build print-ready CVs and cover
letters from structured data — 28 editorial templates, four languages
(EN / DE / FR / ES), automatic A4 fitting, and AI proofreading through a
**model-agnostic Markdown bridge** (plus an optional MCP server). **No built-in
AI, no vendor lock-in.** Runs entirely on your own server.

> Status: early open-source release, derived from a production tool. The engine
> is battle-tested; see `NEUTRALIZATION.md` for what has been generalized and
> what is still being polished for public use.

## Highlights

- **28 templates** in several layout archetypes (single-column, sidebars,
  header band, top-centered, timeline). Single-column templates are ATS-friendly.
- **Four languages** for both CV and cover letter, living in parallel in one
  profile; section, date and field labels adapt automatically.
- **PDF / HTML / Markdown / JSON** export. Automatic font-size fitting to A4.
- **AI editing without built-in AI:** export as Markdown, let any model
  (ChatGPT, Claude, Gemini, Perplexity) revise it, import the result. Version
  history snapshots before every import.
- **Optional MCP server** (`mcp/`) for registered users — programmatic access
  via a personal API key.
- **Accounts are invite-only** (nothing works without a code); optional
  **two-factor login by email code**; self-service password reset; GDPR data
  export & account deletion.
- **Demo mode** with no account (localStorage only) — nothing is stored server-side.
- Self-hosted fonts (no Google Fonts calls), sane security headers, rate limiting.

## Quickstart (Docker)

```bash
git clone <this-repo> cv-hub && cd cv-hub
cp .env.example .env         # then edit: set JWT_SECRET, admin, etc.
docker compose up -d
```

Open **http://localhost:8080**. The first account you register becomes the admin
(or set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` for a bootstrapped admin).

## Architecture

- **Frontend** (`app/`) — React 19 + Vite + TypeScript SPA, served by nginx.
- **Backend** (`pdf-service/`, service name `cv-api`) — Node/Express + PostgreSQL,
  PDF rendering via Playwright, the Markdown bridge, transactional email.
- **MCP server** (`mcp/`) — stdio server the user runs locally; talks to the API
  with a personal key.

The frontend proxies `/pdfapi/*` to the backend, so both share one origin.

## Configuration

All configuration is via environment variables — see `.env.example`. Secrets
(`JWT_SECRET`, `SMTP_*`, `ADMIN_PASSWORD`) never live in code. Database
migrations are idempotent and forward-only; they run automatically on start.

## Data & privacy

Everything personal (accounts, profiles, photos, share links, settings) lives in
Postgres / storage, **not** in the code — so upgrading only swaps code, your data
stays. Demo mode never touches the server.

> The bundled legal pages (Impressum / privacy) contain **placeholders** —
> replace them with your own details before going public.

## License

**AGPL-3.0-or-later** — see `LICENSE`. Because CV-Hub is a hosted web app, the
AGPL ensures that anyone who runs a modified version as a service also shares
their source. Third-party notices: see `NOTICE`.

## Contributing & security

See `SECURITY.md` for responsible disclosure. Issues and PRs welcome.
