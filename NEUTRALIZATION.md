# Neutralization status

CV-Hub is derived from a private production tool. This file tracks what has been
generalized for public/self-host use and what is still in progress.

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

## Remaining / nice-to-have

- **Template names:** five templates are still named after trademarked
  characters (`pikachu`, `onyx`, `azurill`, `gengar`, `leafish`). Rename to
  neutral names **with back-compat aliases** so existing saved profiles that
  reference the old IDs don't break.
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
