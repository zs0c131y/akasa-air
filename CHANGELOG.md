# Changelog

## Unreleased
- Full redesign: landing page, new sign-in, light/dark theme toggle, text-size control, Tailwind + shadcn-style components, self-hosted fonts; rewrote DESIGN.md.
- Sundays are no longer counted as leave days (a Sunday-only request is refused; document due dates skip Sundays).
- Design polish: design tokens, automatic dark theme, sticky header with brand mark and avatar, skip link, refined cards and forms; added DESIGN.md.
- Security hardening: httpOnly cookie sessions with rotating refresh tokens, account lockout, rate limits, Helmet/CSP, CORS allowlist, operator-injection guard, request IDs and structured logs.
- Frontend component tests; security test suite; documentation set.

## Audit and polish
- Append-only audit log with HOD view; friendly 403/404/offline/crash screens; status colour key; one-click demo sign-in; `.env` loading; MongoDB Atlas support.
- Leave can no longer start in the past.

## Core
- Employee, manager and HOD workflow with two-level approval for leave over 3 days, document upload, info requests, emergency leave rule, seed data, Docker setup, README.
