# Changelog

## Unreleased
- Home overview with numbers (`GET /api/stats`): your open requests and next time off; for managers and the HOD also what is waiting, the longest wait, who is away and how fast decisions are made.
- Team calendar: month view of who is away, with Sundays and holidays marked (`/calendar`, `GET /api/leaves/calendar`). Employees see teammates' approved leave without reasons.
- Location calendars: people work from a location, holidays can be national or local, and each request is counted with the holidays of its employee's location.
- Bulk holiday import (paste or upload CSV/TSV, day-first dates, preview, all-or-nothing apply, duplicates skipped).
- Public holidays are never counted as leave: holiday calendar (HOD-managed, `/api/holidays`), seeded fixed-date national holidays, `excluded` breakdown stored on each request and shown in the UI.
- Documents are only accepted, and the upload box only shown, for leave over 3 days.
- Renamed the product to Layover (Akasa Air branding, placeholder logo to replace), light theme by default, new design (see DESIGN.md).
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
