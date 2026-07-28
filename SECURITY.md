# Security Policy

## Reporting a vulnerability

Please report security issues privately rather than opening a public issue.
Open a confidential/security advisory on the repository, or contact the
maintainer directly. We aim to acknowledge reports promptly and coordinate a
fix and disclosure timeline with you.

## Scope & posture

CV-Hub is an authenticated, invite-only web app. Notable hardening already in
place:

- JWT session cookies (`httpOnly`, `secure`, `sameSite=lax`); sessions are
  invalidated on password change/reset.
- Invite-only registration; the invite code is validated before any duplicate
  check, so registration does not leak which usernames/emails exist.
- Rate limiting keyed on the trusted client IP (`req.ip`), not a spoofable
  `X-Forwarded-For` header.
- Optional email 2FA that **fails closed** (login is refused if the code cannot
  be delivered, rather than silently downgrading to password-only).
- Constant-time-ish login (dummy bcrypt on unknown users).
- PDF rendering runs behind an SSRF allowlist (blocks private/loopback/metadata
  addresses).
- All SQL is parameterized; migrations are idempotent.

## Deploying safely

- Set a strong, persistent `JWT_SECRET` (required in production).
- Put the app behind HTTPS/TLS.
- Keep secrets in environment variables, never in the repository.
- Replace the placeholder legal pages with your own before going public.
