# Neutralization status

CV-Hub is derived from a private production tool. This file tracks what has been
generalized for public/self-host use and what is still in progress.

## Done (2026-10-09, security review round 6)

Mirrored diff-based like the rounds below (`git merge-file`, base = the private
tool's previous revision).

- **`security.txt` carries placeholders.** `app/public/.well-known/security.txt`
  says `Contact: mailto:security@example.com` and
  `Canonical: https://cv.example.com/.well-known/security.txt`. **Replace both
  and move `Expires` forward before going live** (also noted in the README).
- **Umami is optional and host-neutral.** The private tool proxies its own
  analytics host through `/u/`. Here the host is set once in `app/nginx.conf`
  (`map "" $umami_host`, placeholder `analytics.example.com`), the blocks are
  marked optional, and the tag in `app/index.html` is commented out with a
  `YOUR-UMAMI-WEBSITE-ID` placeholder — no website ID of the original instance.
  The legal page names `analytics.example.com`, the browser checks block it.
- **Deliberate divergence: `/oauth/` stays.** The private tool turned the
  `/oauth/` shortcut into a 404 because its hosting routes the API past this
  nginx (it answered 502 there). In the bundled `docker-compose.yml` this nginx
  does reach `cv-api`, and an empty `OAUTH_PUBLIC_BASE` relies on the shortcut,
  so it is kept; the comment says when to replace it. `nginxcheck.mjs` checks
  only that `/oauth/` never falls back to the SPA.
- **Neutralized:** `pdf-service/SICHERHEIT.md` (no private commit reference, no
  hosting-specific section, no original domain), mail subjects of the new
  e-mail-change mails use `PRODUCT_NAME`/`APP_NAME` (default `CV-Hub`), the
  declaration page title uses `APP_NAME`, test fixtures use `admin1` and
  `evil.example.com`, two code comments no longer quote the operator by name,
  Dockerfile comments describe BuildKit secrets without the original setup.

## Done (2026-10-09, vouchers and guides)

Mirrored diff-based again: files that carry neutralization were merged with
`git merge-file` (base = the private tool's previous revision), never copied.

- **Guides (`/ratgeber/`): the original operator's articles are not mirrored.**
  `app/content/ratgeber/` holds the neutralized `README.md` (generic wiki host
  `https://wiki.example.com`, no collection of the original instance) and one
  English sample, `example-guide.md`, without `outlineId`. The build also runs
  with zero articles (empty overview).
- **No built-in Outline collection.** The private sync script fell back to the
  original operator's collection ID; here `OUTLINE_RATGEBER_COLLECTION` is
  required and the sync skips cleanly without it (covered by
  `ratgebercheck.mjs`, 173/173).
- **Defaults:** `PUBLIC_BASE_URL` falls back to `https://cv.example.com`
  (build, block list, robots.txt, Dockerfile); `docker-compose.yml` passes
  `APP_BASE_URL` as build argument. Site name follows `VITE_APP_NAME`
  (default `CV-Hub`), publisher defaults to the site name; the guide overview
  defaults to English.
- **Vouchers:** the redemption address comes from `PUBLIC_BASE_URL` (server)
  or the window's origin; no fixed domain in code. The `/code` page title uses
  `APP_NAME`. `pdf-service/GUTSCHEINE.md` and code comments refer to "the
  operator" instead of a person; references to private planning notes are
  removed. UI checks block `analytics.example.com` instead of the original
  analytics host.
- **The guard only sees tracked files.** `neutralcheck.sh` uses `git grep`, so
  before the first `git add` it reported "sauber" while two new files still
  held credential-shaped literals (a GitHub-token regex in the block list, a
  PEM header in a test). Both are written so they no longer look like a key.
  Run the guard after staging.

## Done (2026-10-09)

- **Operator details in one file.** `app/src/data/operator.ts` holds name,
  address and contact for the legal pages, the contract texts of the paid mode
  and the "report content" link. In this repository it carries placeholders
  (`Your Name`, `example.com`, `phone: null`) — fill it in before going live.
  The backend takes the same data from `SELLER_*`.
- **Contract texts are templates.** `app/src/legal/` (terms, withdrawal notice,
  order page, cancellation, mails) only uses `{{SELLER_*}}` placeholders; the
  references to the original operator's research notes are replaced by a note
  that they are not part of this repository.
- **Not mirrored:** the original operator's pilot and payment planning
  documents (records of processing, TOMs, pilot agreement, payment research,
  tax thresholds). They describe one specific deployment.
- **Identifiers:** IndexedDB and backup-file names are `cv-hub-local` and
  `cv-hub-backup`; the Codex snippet uses the `cv-hub` server name.
- **Guard:** the names of the commercial sample templates that comments once
  referred to are now in the private pattern list as well.

## Done (2026-09-17)

- **Word export reworked.** The sidebar colour panel now reaches all four edges
  of every sheet (anchored image in the header, not a table-cell background);
  the name follows the template's own `nameInSidebar` flag instead of being
  forced into the sidebar; skill groups are lists again; dates do not break in
  two; entry headings stay with their first bullet; `panelFill: false` templates
  get their hairline rule instead of a shaded cell.
- **The HTML export no longer claims to be print-ready.** What lands on the sheet
  is decided by the browser's print dialog, not by the file. Interface, the
  exported file's own banner and the template kit's instructions now say the PDF
  is the print master. The banner follows the document's language (de/en/fr/es)
  and `<html lang>` is set accordingly.
- **Photo re-crop:** the thumbnail is a button; the uncropped original is kept in
  `personal.photoOriginal` so re-cropping is lossless.
- **New checks:** `app/scripts/bandcheck.mjs` (measures the panel colour at the
  bottom of the last page for every filled-sidebar template — 12/12),
  `app/scripts/docxsweep.mjs` (all 36 templates x both Word variants).

## How the neutralization breaks (finding, 2026-09-18)

**Not through carelessness in the details, but through mirroring whole files.**
While syncing with the private tool, `LandingScreen.tsx` was copied over in one
piece. Every bit of hand work in it was gone: `{APP_NAME}` became a hard-coded
domain, wordmark and copyright belonged to the original operator again, and four
languages named a data-centre location that is wrong for any other instance.

**Rule from this:** files that carry neutralization are **never** mirrored whole.
Look at the diff against the last clean revision first, then transfer only the
content change. And before every push:

```bash
./scripts/neutralcheck.sh
```

The guard itself found **one of three** leaks in this incident — it knew only the
domain. Wordmark and company name have been in it since.

### The guard was case-sensitive (finding, same day)

Turning the soft patterns case-insensitive found two leaks that were live in
this repository: `app/src/screens/HomeScreen.tsx` rendered the original
operator's wordmark in the top bar and their company name in the footer, both in
capitals. The patterns were written in the wordmark's mixed-case spelling and
went straight past the all-caps one.

**Rule from this:** a trace does not stop being a trace because it is set in
capitals. `git grep` for operator traces runs with `-i`. The credential patterns
stay case-sensitive, because their shape is part of what identifies them.

### The guard was publishing what it searched for (finding, same day)

Re-reading the sharpened guard turned up a worse problem than the one it was
written for. Its pattern list held the previous operator's **street, postcode,
phone number and private mail domain — verbatim, in a public repository**, in a
file that excludes itself from its own search. Those lines had been in
`.github/workflows/ci.yml` since the first CI commit; moving them into
`scripts/neutralcheck.sh` carried them along. A guard that publishes the data it
is looking for cancels itself out.

Those patterns now come from outside the repository:

| Source | Used for |
|--------|----------|
| `NEUTRAL_EXTRA` (env / repository secret) | CI runs on the origin repository |
| `NEUTRAL_EXTRA_FILE` | an explicit path |
| `../cv-tool/scripts/neutral-extra.txt` | picked up automatically when the private twin sits next to this checkout |

What stays in the script is only what is not a secret in the first place:
generic credential shapes (`ghp_…`, `AKIA…`, private-key headers) and the
operator traces that the README's demo link already makes public. **If no extra
patterns are loaded the check still runs** and says so as a warning rather than
failing — for a fork that is the correct behaviour, and a silent gap would be
worse than a loud one.

Note this does **not** unpublish anything: the patterns are in the git history of
the public repository and must be treated as disclosed. The fix stops the leak
from continuing, it does not undo it.

## Done

- **License:** AGPL-3.0-or-later (`LICENSE`, `NOTICE`).
- **Branding:** operator brand removed. Frontend logo reads a configurable
  `APP_NAME` (`app/src/brand.ts`, override with `VITE_APP_NAME`, default `CV-Hub`).
  Backend/email brand via `APP_NAME` env. Prose/FAQ copy uses the default name.
- **Personal data removed:** the previous operator's name, address, email and
  domain are gone. Legal pages (`app/src/screens/LegalPages.tsx`) now contain
  **placeholders** — operators must fill in their own Impressum/privacy details.
- **Domain:** hard-coded production domain replaced; photo URLs now resolve
  against `window.location.origin`. `APP_BASE_URL` drives email links.
- **Analytics:** off by default (the bundled Umami snippet was removed). Add your
  own analytics if desired.
- **Default language:** English (`DE`/`FR`/`ES` remain available).
- **Packaging:** root `docker-compose.yml` (Postgres + `cv-api` + frontend),
  `.env.example`, README, SECURITY.md.

## Done (2026-09-14)

- **Template names renamed.** The five templates named after trademarked
  characters are now `sonnenblume`, `schiefer`, `azur`, `amethyst`, `farn`.
  The old IDs live on as permanent aliases (`THEME_ALIASES` in
  `app/src/templates/theme.ts`) so saved profiles don't fall back to the first
  template. All five are `deprecated: true` and not offered in the picker.
- **Brought up to date with the upstream production tool** (September work):
  the flow-based pagination and measured type scale, eight new templates,
  editable labels everywhere, inline editing in the document, the one-page
  workshop with its shortening advisor, the "template without data" export,
  selectable paper colour, and the mobile fixes.
- **Security review applied** — see `CHANGELOG.md`: host-header injection in
  signed links, state-changing GET, Chromium as root, SSRF allowlist,
  hard-wired `trust proxy`. `pdf-service/ssrf.test.mjs` covers the SSRF guard.

## Remaining / nice-to-have
- **Legal pages i18n:** currently German-only with placeholders; make them fully
  config/markdown-driven and translatable.
- **Demo seed:** the sample profile should be a generic English example.
- **Email copy:** subjects/body are English-brand default; optionally template
  all of it through `APP_NAME` and translate.
- **Frontend `APP_NAME`:** baked at build time; document the `VITE_APP_NAME`
  build-arg path for `docker-compose` so the logo can change without editing code.
- **CSP:** `app/nginx.conf` still allows a Google-Fonts fallback and a sample
  analytics host — tighten to your deployment.
- **gitleaks CI** and a public security review before making the repo public.
