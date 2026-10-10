# Neutralization status

CV-Hub is derived from a private production tool. This file tracks what has been
generalized for public/self-host use and what is still in progress.

## Done (2026-10-10, template tier and mail workflows)

Mirrored diff-based (`git merge-file`, base = the private tool's previous
revision); conflicts resolved in favour of the neutral CV-Hub wording, new
files taken over and neutralized.

- **Template tier off by default.** `freeTemplates.ts`, `freeTier.ts`, the
  unlock window and the "Pass" tags only act when the server reports
  `freeTier.limited` (paid mode ready to sell plus `FREE_TIER_LIMITS`), which
  `docker-compose.yml` does not pass. `TEMPLATE_TIER_SINCE` is documented in
  `.env.example` (commented out) and the README only. The magazine texts took
  the new AI paragraphs but keep the pass conditional ("if the instance offers
  the optional pass") instead of naming free templates; the pricing FAQ and
  comparison table keep "on the server" without a location.
- **Mail workflows.** `mailflows.js`, `mailqueue.js`, `mailsettings.js`,
  `mailadmin.js`, the admin page `Mails.tsx`, `MailPrefs.tsx`,
  `UnsubscribePage.tsx` and `MAILS.md` came over. Product name from
  `APP_NAME`/`PRODUCT_NAME` (default `CV-Hub`) in mail headings, sender
  fallback and the unsubscribe page title; mail subjects use `productName` or
  `CV-Hub`. `MAILS.md` and code comments no longer quote the operator's
  request, name the original mail provider or a private legal reviewer; the
  hosting tool's name is gone from the new admin texts ("Umgebung"). Test
  fixtures use `Testverkäufer` / `Testweg 1, 12345 Teststadt` and
  `ops@example.test`. `MAIL_SETTINGS_KEY` was added to `.env.example`
  (optional, empty) and `docker-compose.yml` (`${MAIL_SETTINGS_KEY:-}`).
- **Legal texts version 2026-10-10.2** merged into the placeholder templates;
  the privacy policy's new section "E-Mails an Ihr Konto" / "E-mails to your
  account" came over, the sending service stays `[Mail-Provider]` /
  `[mail provider]` with `[Land]` / `[country]`. The terms no longer say the
  service runs "on servers in Germany" (left over from earlier rounds).
  `legal-texts.json` regenerated with `sync-legal.mjs`. The private
  `mailtexts/archiv/` is not mirrored.
- **Repository links.** The private tool hard-coded its repository in
  `LandingScreen.tsx`, `ssr.tsx` and `LegalPages.tsx` and switched the imprint
  link text to its own git host. Here all of them use `SOURCE_REPO_URL` again
  (link text `shortUrl(SOURCE_REPO_URL)`), and the new `sourceFileUrl()` builds
  GitHub paths (`/tree/<branch>/…`) instead of Forgejo's `/src/branch/…`, so
  the start page's link to `pdfcheck.mjs` resolves on GitHub.
- **No server location** in the new landing FAQ, the pricing FAQ ("Why does it
  cost anything?") or the tier comparison table, in all four languages.
- **Comments** no longer attribute the tier to an "advisor decision" or a
  numbered variant of a private planning document.
- **Start-page photos not re-taken.** The photographed views (editor, design
  panel, check, export menu, phone, thumbnails) only change when the tier is
  active; the new AI section is text only. The existing `app/public/landing/`
  stays as it is.

## Done (2026-10-10, round 8)

Mirrored diff-based (`git merge-file`, base = the private tool's previous
revision) — new start page, magazine, 40 templates, admin area, legal review,
audit. Files that were rewritten from scratch in the private tool
(`LandingScreen.tsx`, `HomeScreen.tsx`) were taken from it and then checked
line by line; the legal pages were rebuilt from the private revision with
every earlier CV-Hub neutralization re-applied (template notice, `[placeholder]`
fields, `shortUrl(SOURCE_REPO_URL)`).

- **One name in one place.** `app/src/landing/brand.js` says `CV-Hub` and
  reads `VITE_APP_NAME` (in the browser and in the build scripts), so start
  page, magazine, JSON-LD, `llms.txt`, admin area and preview images follow the
  same override as `src/brand.ts`. `FALLBACK_BASE_URL` is
  `https://cv.example.com`. The wordmark splits at the first `/` or `-`.
- **Screenshots re-taken, not mirrored.** The private `app/public/landing/`
  (~15 MB) and the `og*.png` previews showed the original operator's wordmark
  and a server-location sentence. They were taken again from this code base
  with `scripts/landing-shots.mjs` (Vite on a spare port, `LANDING_BASE`,
  Pillow/AVIF, `pdftotext`): 473 files, 15.1 MB, plus a new `shots.gen.ts`.
  The README says how to repeat that after a rename.
- **Magazine (`/ratgeber/` → `/magazin/`).** All nine articles came over as
  sample content: they hold no personal data, only generic, sourced advice.
  Neutralized: `outlineId` removed (the sync never touches them), product name
  `CV-Hub`, the pass sentence made conditional ("if the instance offers the
  optional pass"). Keeping all nine keeps the tips panel
  (`src/knowledge/magazin.ts`) free of dead links. `example-guide.md` stays.
  `OUTLINE_MAGAZIN_COLLECTION` (or the old `OUTLINE_RATGEBER_COLLECTION`) is
  still required — the private fallback collection ID was dropped again — and
  the Dockerfile now passes both collection names as build args.
- **Admin area.** Taken over with `ADMIN_HOST` optional. `docker-compose.yml`
  passes `ADMIN_HOST` to `cv-api` (empty = admin page under `/admin/`) and to
  the frontend (`admin.invalid` when unset); `app/nginx.conf` is installed as
  `/etc/nginx/templates/default.conf.template` and the image substitutes only
  `${ADMIN_HOST}` (`NGINX_ENVSUBST_FILTER=^ADMIN_HOST$`). `pdf-service/ADMIN.md`
  lost the original deployment section (DNS, IP, app IDs) in favour of generic
  steps; examples use `admin.example.com`.
- **No server location claimed.** Landing FAQ, sign-up trust tile, pricing
  table, photo hint, export note, order page, terms and the Art. 9 consent no
  longer say "our server in Germany"; the privacy policy keeps `[Land]` /
  `[country]`. `legal-texts.json` regenerated with `sync-legal.mjs`. The
  private `mailtexts/archiv/` (the original deployment's delivered contract
  versions) is not mirrored.
- **Umami** stays off: both tags (`umami-filter-v1.js` and `/u/script.js`) are
  commented out in `index.html` with `YOUR-UMAMI-WEBSITE-ID`; no website ID or
  analytics host of the original instance. The privacy template marks the
  section and the opt-out switch as "remove if you do not measure".
- **Also neutralized:** `security.txt` keeps the placeholder contact (no
  `Canonical` any more, as in the private tool), `robots.txt`/`llms.txt` use
  `cv.example.com`, mail footer uses `APP_NAME` and the host of
  `PUBLIC_BASE_URL`, `admin.html` title, test fixtures (`leitung`,
  `ops@example.test`), code comments that quoted the operator by first name
  (also the older ones from earlier rounds), "CV-Tool" in package description,
  server and MCP headers, review-report references to a private wiki.

## Done (2026-10-09, free-tier limits)

Mirrored diff-based (`git merge-file`, base = the private tool's previous
revision). The JSON-LD FAQ count (32) was already in place here.

- **Off by default.** `FREE_TIER_LIMITS` is not passed by `docker-compose.yml`;
  `.env.example` documents it as optional and commented out. Without it, or
  without a paid mode that is ready to sell, `freeTier.limited` is `false` and
  nothing is locked.
- **Source link in one place.** `SOURCE_REPO_URL` (`app/src/data/urls.ts`)
  points to this public repository and now drives the imprint (DE/EN, which
  used to name a `git.example.com` placeholder) and the "self-host" note on
  the pricing page. Operators of a modified version set their own repository
  there. The landing-page footer keeps no source link, as before.
- **Neutralized:** comments no longer attribute the decision to a person;
  `freetiercheck.mjs` uses `CV-Hub` as product name and the `cv-hub-local`
  IndexedDB. `legal-texts.json` regenerated with `sync-legal.mjs`.

## Done (2026-10-09, six new templates)

Mirrored diff-based (`git merge-file`, base = the private tool's previous
revision). Bamberg, Weimar, Kiel, Göttingen, Bergen and Porto came over
unchanged in `theme.ts`, `ResumeRenderer.tsx`, `exportDocx.ts` and
`templates.json` (`sync-templates.mjs --check` passes); they carry no operator
data.

- **Template count is CV-Hub's own text.** `index.html` and `LandingScreen.tsx`
  conflicted only where CV-Hub has its own wording (title/meta with `CV-Hub`,
  the LinkedIn FAQ without "not even ours"); the count moved from 26 to 32
  there, and also in the JSON-LD FAQ and the README, which the private tool
  had left at 26.
- **Fonts:** Fraunces and IBM Plex Mono 500 (plus Source Serif 4 500) are
  built from `@fontsource` like the others; both are OFL and already listed in
  `NOTICE`, the licence file is copied next to the build output.
- **MCP:** the new-resume default template is `espoo`; `fontPairing` no longer
  lists the IDs inline but points to `get_resume_settings`.

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
