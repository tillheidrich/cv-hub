# CV-Hub

**Self-hosted résumé & cover-letter studio.** Build print-ready CVs and cover
letters from structured data — 40 editorial templates, four languages
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

- **40 templates** across several layout archetypes (single-column, sidebars,
  header band, top-centered, timeline). Every template carries a label saying
  what it is made for ("good for portals", "suitable for portals", "for e-mail
  and print"); single-column templates are ATS-friendly. CVs run from one to
  four pages, or automatic — anything beyond four pages is reported, never cut.
- **Check panel** for the CV, the cover letter and both together: the text in
  the order a parser reads it from the PDF, missing details (for the letter
  also subject, date, salutation, length, leftover placeholders) and a match
  against a pasted job ad. No score.
- **LaTeX and RenderCV.** Export as `.tex` (pdfLaTeX/Overleaf) and as RenderCV
  YAML; RenderCV YAML and LaTeX files written by this tool can be imported back.
- **Four languages** for both CV and cover letter, living in parallel in one
  profile; section, date and field labels adapt automatically — and every label
  is editable, so "Berufserfahrung" can become whatever you want it to be.
- **Edit in the document**, not only in a form: click into the preview and type.
- **Import from LinkedIn.** Upload the ZIP from LinkedIn's "Get a copy of your
  data" and it reads positions, education, skills, languages, email and phone.
  It runs in the browser — the file reaches no server, so it works without an
  account too — and it shows you what it found, and what it did *not*, before
  replacing anything.
- **Word (.docx) in two versions.** The *design* version carries the template's
  handwriting into Word — a colour panel that runs to the edge of every sheet
  (a single-colour image anchored to the page behind the text, carried by the
  header, because Word has no rectangle you can lay on a page), the template's
  heading shapes rebuilt from paragraph borders, its bullet character, the date
  column. The *ATS* version is single-column, no tables, no panels, native Word
  heading styles — for portals that read the file by machine.
- **Crop the photo, and crop it again later.** The crop is baked into pixels, so
  every output shows the same frame. The uncropped original is kept alongside,
  so clicking the photo reopens the cropper and you can still zoom back out.
- **PDF / HTML / Markdown / DOCX / JSON** export, plus **"template without data"**
  — a ZIP with the design as standalone HTML and Word files, placeholders
  carrying their JSON path (`{{experience[0].role}}`), and an empty `daten.json`
  in exactly the shape the importer reads back. A documented way *out* of the
  tool, not just in. The **PDF** is the one meant for printing and for sending
  with an application; the HTML is for viewing and sharing, because what a
  browser puts on the sheet is decided by its print dialog — its own margins,
  headers and footers — not by the file.
- **AI editing without built-in AI:** export as Markdown, let any model revise
  it, import the result. Version history snapshots before every import.
- **Optional MCP server** (`mcp/`) for registered users — programmatic access
  via a personal API key.
- **Admin area** with statistics (daily counters without personal data),
  customers, payments, invoices (CSV export for the tax adviser), withdrawals,
  vouchers, invitations and an audit log. By default it lives under `/admin/`
  on the main address. Optionally it moves to its own host (`ADMIN_HOST`) with
  its own sign-in (password + e-mail code, separate cookie, strict CSP); see
  `pdf-service/ADMIN.md`.
- **Start page and magazine, prerendered.** `npm run build` renders `/`,
  `/en/`, `/fr/`, `/es/` and `/preise` with `react-dom/server` (JSON-LD,
  hreflang, sitemap, `llms.txt`) and builds the static articles under
  `/magazin/` (old `/ratgeber/` addresses redirect). The articles in
  `app/content/magazin/` are sample content; replace them with your own (see
  `app/content/magazin/README.md`). The product name for both comes from
  `app/src/landing/brand.js` (override with `VITE_APP_NAME`).
- **Accounts are invite-only** by default (nothing works without a code);
  open registration with double opt-in and self-hosted ALTCHA bot protection
  can be switched on (`OPEN_REGISTRATION=1`). Optional **two-factor login by
  email code**; self-service password reset; GDPR data export & account
  deletion.
- **Local mode** with no account — nothing is stored server-side. Profiles,
  photos and version history live in the browser's IndexedDB (localStorage as a
  fallback), and a **backup file** with a reminder brings everything back,
  also on another device. Local mode is the main path, not a trial.
- **More sections:** projects, certificates, volunteering, publications and
  free-form sections, in every template, in Word, Markdown, JSON Resume, share
  links and the LinkedIn import. Versions can be duplicated.
- **ATS PDF in one click** next to the ATS check, alongside the ATS Word file.
  The ATS check reads the same text layer as the PDF.
- **Optional paid mode** (`BILLING_ENABLED=1`, off by default): a one-off,
  time-limited pass sold through Mollie, with order page, invoice, withdrawal
  and cancellation buttons. Local use and export stay free. The contract
  texts in `app/src/legal/` are templates written for German law and must be
  reviewed before you sell anything; seller details come from `SELLER_*` in
  `.env` and `app/src/data/operator.ts`.
- Self-hosted fonts (no Google Fonts calls), sane security headers, rate limiting.
- **Hardening:** the PDF renderer cannot reach the internal network, is limited
  to six pages, 30 seconds and a small queue; share links serve a frozen
  snapshot of the visible version only; password changes and resets revoke API
  keys and OAuth tokens; sign-out ends the session on the server; photos are
  served only to their owner or through a share link, and a daily cleanup job
  removes unreferenced ones.

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
  your users share one bucket. The bundled `docker-compose.yml` sets it to 1,
  because its frontend nginx proxies the API. If the backend is reachable
  directly, set it empty: trusting a client-settable `X-Forwarded-For` would
  switch off brute-force protection entirely.
- `PUBLIC_BASE_URL=https://your.domain` — the base for links that leave the
  house (emails, share links). It is deliberately **not** derived from request
  headers; see `pdf-service/server.js`, `publicBaseUrl`.
- `ALLOWED_ORIGINS=https://your.domain` — every origin not on the list
  (including `null`) gets 403 before any handler runs; only the localhost dev
  ports are allowed by default.

**Before going live**, replace the placeholders in
`app/public/.well-known/security.txt` (`Contact: mailto:security@example.com`)
with your own address and keep `Expires` within a year (the file has no
`Canonical` field, so it fits whatever domain serves it). Fill in
`app/src/data/operator.ts` and replace every `[placeholder]` on the legal
pages. Analytics are off by default; `app/nginx.conf`
contains an optional Umami pass-through under `/u/` (set `$umami_host`, then
uncomment the tag in `app/index.html`), which you can also delete.

**Separate admin host (optional).** Point a second name (e.g.
`admin.example.com`) at the same frontend, set `ADMIN_HOST` (and SMTP, for the
sign-in code) in `.env`; `docker-compose.yml` passes it to both `cv-api` and
the frontend nginx. `app/nginx.conf` is an nginx-image template
(`/etc/nginx/templates`): only `${ADMIN_HOST}` is substituted at start-up
(`NGINX_ENVSUBST_FILTER`), and without a value it is `admin.invalid`, a name
that never resolves — so self-hosting without `ADMIN_HOST` keeps the admin page
at `/admin/`.

## Start-page screenshots and demo photo

The start page, the magazine and the link previews (`app/public/og*.png`) use
real screenshots of the app in demo mode, stored in `app/public/landing/`
together with `manifest.json`; `app/src/landing/shots.gen.ts` lists them. The
ones in this repository were taken from this code base with the `CV-Hub`
wordmark. If you change the name, the UI, the demo person or the templates,
take new ones:

```bash
cd app
npx vite --port 5261 --strictPort &
LANDING_BASE=http://127.0.0.1:5261 npm run landing:shots   # ~10 minutes
```

It needs Chromium (`CHROMIUM_PATH`), Python 3 with Pillow ≥ 11 (AVIF/WebP) and
`pdftotext`; partial runs with `LANDING_LANGS=de` or
`LANDING_ONLY=ui|thumbs|text|og`. Details in `app/src/landing/README.md`.

The demo profile "Lena Brandt" (fictitious) carries a sample photo from
`app/public/demo/`: photo by Phạm Duy Quang on Unsplash
(https://unsplash.com/photos/woman-in-grey-blazer-business-portrait-QGr6H7pri-Q),
Unsplash License; see `app/public/demo/CREDITS.txt`. The person shown is not
the fictitious sample person.

## Running the checks

```bash
cd pdf-service && npm test          # unit and integration tests
cd app && npm run dev               # then, in a second shell:
node scripts/onepagecheck.mjs einseiter
node scripts/contrastcheck.mjs
CHROMIUM_PATH=/path/to/chromium node scripts/pdfcheck.mjs hamburg one normal marketing
```

The backend integration tests start a throwaway PostgreSQL instance and the
real service; without `initdb`/`pg_ctl` (or Chromium for the PDF tests) they
are skipped rather than failed.

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

The hosted endpoint is **multi-tenant**: every user of your instance connects
their own AI client and sees only their own CVs. Adding it takes one step —
paste `https://your-domain/mcp` into the client as a custom connector. The
client discovers the rest, your instance opens, the user is already signed in,
they press *Allow*, done. No tokens to copy anywhere.

How it fits together:

- **The authorization server lives in the backend** (`pdf-service/oauth.js`),
  not in the MCP service — that is where users, sessions and the database are.
  The consent screen runs against the existing session, so there is no second
  password and no shared secret.
- **The MCP service is deliberately dumb.** It checks no passwords and keeps no
  user list; it passes the caller's token through to the API and lets the API
  decide. The token rides on the async context, not on a module variable — in a
  process serving many users, a module variable would be a data leak waiting to
  happen.
- **Tokens and codes are stored hashed**, like the API keys. Authorization codes
  are single-use, enforced in the same `UPDATE` that reads them.
- Users see and end their connections under *Settings → Connected apps*.

Configuration: set `MCP_PUBLIC_URL`, and — if your backend sits behind a path
prefix that the proxy strips (the default `/pdfapi` layout does) — also
`OAUTH_PUBLIC_BASE` and `MCP_AUTH_BASE`. A service behind a stripped prefix
cannot know its own public address, and that address goes into the metadata
every client follows, so it is configured rather than guessed.

Two failure modes worth knowing, both cost real time here:

- If discovery fails with *"registration with the authorization server failed"*,
  check that `/.well-known/oauth-protected-resource` returns JSON and not your
  SPA's `index.html`. A catch-all route in front of it is the usual cause.
- In nginx, `set` and `rewrite` both belong to the rewrite module and `break`
  ends that phase — a `set` below a `rewrite ... break` never runs.

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
