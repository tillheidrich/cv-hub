# CV-Hub

**Self-hosted résumé & cover-letter studio.** Build print-ready CVs and cover
letters from structured data — 26 editorial templates, four languages
(EN / DE / FR / ES), automatic A4 fitting, and AI proofreading through a
**model-agnostic Markdown bridge** (plus an optional MCP server). **No built-in
AI, no vendor lock-in.** Runs entirely on your own server.

**Try it: [cv.heidrich-digital.de](https://cv.heidrich-digital.de)** — the demo
mode needs no account and stores nothing on the server; your data stays in your
browser. That instance is the author's own deployment, not a hosted service:
accounts there are invite-only, and it is where this code runs in production.
Self-host your own with the Quickstart below.

## What makes this different: the claims are measured

Every résumé builder claims to be "ATS-friendly". This one checks, and you can
run the checks yourself. Thirteen scripts drive a real browser, print real PDFs
and read them back:

| Script | What it proves |
|--------|----------------|
| `contrastcheck.mjs` | Every template × accent × paper combination clears WCAG AA (1,404 combinations at the time of writing) |
| `pdfcheck.mjs` | Page count **and per-page text** match between preview and PDF — "what you see is what you get", verified, not asserted. Also checks the text layer for broken word spacing, hyphen artefacts and mojibake |
| `onepagecheck.mjs` | Each template fits one page for a one-page CV — separating "can the tool" from "does this text fit" |
| `twopagecheck.mjs` | Multi-page documents don't produce near-empty last pages, orphaned sidebars or unlabelled continuation sheets |
| `overflowcheck.mjs` | No text hangs below the page edge — the failure mode where a PDF silently loses a line |
| `docxcheck.mjs` | The Word export is rendered by LibreOffice and inspected, so "looks fine in Word" is a result, not a hope |
| `kitcheck.mjs` | The "template without data" export round-trips back through the importer |
| `measure-tracking.mjs` | The letter-spacing limit above which `pdftotext` shatters a heading into single characters |
| `inlinecheck.mjs`, `mobilecheck.mjs` | Editing in the document, and the editor on a phone |

The typographic limits in the code are measured or sourced, and each one carries
its source in a comment next to it:

- **Letter-spacing ≤ 0.08 em.** Measured: at 0.11 em the PDF text layer splits a
  tracked capital line into individual letters — independent of font size
  (`app/scripts/measure-tracking.mjs`).
- **Never below 8.2 pt automatically.** Personio's own parsing documentation
  lists "the font size is smaller than or equal to 8 pt" as a cause of failed CV
  parsing. The automatic fitter never crosses that line; the human at the slider
  may, and is told which line they are crossing.
- **One to two pages.** The German Federal Employment Agency states "one to a
  maximum of two A4 pages". Neither Personio nor Textkernel mention page count
  as a parsing criterion at all — so it is a question for the reader, not the
  machine, and the tool says so instead of treating page two as an error.

## Highlights

- **26 templates** across several layout archetypes (single-column, sidebars,
  header band, top-centered, timeline). Single-column templates are ATS-friendly.
- **Four languages** for both CV and cover letter, living in parallel in one
  profile; section, date and field labels adapt automatically — and every label
  is editable, so "Berufserfahrung" can become whatever you want it to be.
- **Edit in the document**, not only in a form: click into the preview and type.
- **PDF / HTML / Markdown / DOCX / JSON** export, plus **"template without data"**
  — a ZIP with the design as standalone HTML and Word files, placeholders
  carrying their JSON path (`{{experience[0].role}}`), and an empty `daten.json`
  in exactly the shape the importer reads back. A documented way *out* of the
  tool, not just in.
- **AI editing without built-in AI:** export as Markdown, let any model revise
  it, import the result. Version history snapshots before every import.
- **Optional MCP server** (`mcp/`) for registered users — programmatic access
  via a personal API key.
- **Accounts are invite-only** (nothing works without a code); optional
  **two-factor login by email code**; self-service password reset; GDPR data
  export & account deletion.
- **Demo mode** with no account (localStorage only) — nothing is stored server-side.
- Self-hosted fonts (no Google Fonts calls), sane security headers, rate limiting.

## Quickstart (Docker)

```bash
git clone https://github.com/tillheidrich/cv-hub.git && cd cv-hub
cp .env.example .env         # then edit: set JWT_SECRET, admin, etc.
docker compose up -d
```

Open **http://localhost:8080**. The first account you register becomes the admin
(or set `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env` for a bootstrapped admin).

**Behind a reverse proxy**, set two variables or two things break quietly:

- `TRUST_PROXY=1` — otherwise every rate limit keys on the proxy's IP and all
  your users share one bucket. Without a proxy, leave it unset: the default is
  "no proxy", because trusting a client-settable `X-Forwarded-For` would switch
  off brute-force protection entirely.
- `PUBLIC_BASE_URL=https://your.domain` — the base for links that leave the
  house (emails, share links). It is deliberately **not** derived from request
  headers; see `pdf-service/server.js`, `publicBaseUrl`.

## Running the checks

```bash
cd pdf-service && npm test          # unit tests, no browser, no database
cd app && npm run dev               # then, in a second shell:
node scripts/onepagecheck.mjs einseiter
node scripts/contrastcheck.mjs
CHROMIUM_PATH=/path/to/chromium node scripts/pdfcheck.mjs hamburg one normal marketing
```

The browser-driven scripts need a running dev server (`HARNESS_BASE`, default
`http://localhost:5199`) and a Chromium binary (`CHROMIUM_PATH`). `pdfcheck` and
`docxcheck` additionally need `pdftotext`/`pdfinfo` (poppler-utils), and
`docxcheck` needs `soffice` (LibreOffice).

## Architecture

- **Frontend** (`app/`) — React 19 + Vite + TypeScript SPA, served by nginx.
  The renderer is a single component driven by a theme object; there is no
  per-template component to keep in sync.
- **Backend** (`pdf-service/`, service name `cv-api`) — Node/Express +
  PostgreSQL, Playwright/Chromium for PDF rendering. The schema is bootstrapped
  idempotently at startup (`db.js`); there is no separate migration step.
- **MCP server** (`mcp/`) — optional, stdio or hosted HTTP.

### Connecting an MCP client to the hosted endpoint

Run the server in HTTP mode behind the same domain as the app (the bundled
nginx config already proxies `/mcp` and the two OAuth discovery paths), set
`MCP_PUBLIC_URL` and `MCP_GATE_TOKEN`, and add `https://your-domain/mcp` as a
custom connector in the client.

The endpoint speaks **OAuth 2.1 with dynamic client registration and PKCE**,
because that is the only way a remote MCP client can connect — clients have no
field for a static bearer token. The flow is deliberately stateless: the client
registration, the authorization code and the access token are HMAC-signed
records rather than database rows, so a redeploy does not disconnect anyone.

Since one endpoint acts as exactly one `CV_API_KEY`, the consent screen asks for
`MCP_GATE_TOKEN` instead of a username — that token is the gate, passed through
the OAuth flow. It also still works directly as a bearer token, so scripts and
the command line keep working.

If discovery fails with *"registration with the authorization server failed"*,
check that `/.well-known/oauth-protected-resource` returns JSON and not your
SPA's `index.html`: a catch-all route in front of it is the usual cause.

## Security

Please read `SECURITY.md` before exposing an instance to the internet, and
report vulnerabilities the way it describes. The PDF renderer accepts HTML from
unauthenticated callers by design (so the demo can produce a real PDF); it is
guarded by an SSRF allowlist (`pdf-service/ssrf.js`, with tests), runs with
JavaScript disabled, is size-capped and rate-limited, and the container runs as
a non-root user.

## License

AGPL-3.0-or-later — see `LICENSE` and `NOTICE`. The bundled fonts are
SIL Open Font License 1.1; template layouts marked "after Reactive Resume" are
derived from an MIT-licensed project, which `NOTICE` records.

`NEUTRALIZATION.md` tracks what was generalized when this was split out of a
private production tool, and what is still being polished.
