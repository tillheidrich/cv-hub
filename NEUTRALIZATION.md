# Neutralization status

CV-Hub is derived from a private production tool. This file tracks what has been
generalized for public/self-host use and what is still in progress.

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
