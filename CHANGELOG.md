# Changelog

## Unreleased
- Sign-up, email confirmation, forgot and reset password, change password. Email goes through Mailgun (same variables as the other projects); without it, sign-up works at once and links print in the console. The HOD chooses new people's manager, role and location.
- "More than 3 days" now means days in a row (calendar days away, Sundays and holidays between included). Split-up requests are added together and flagged to approvers, with an audit entry.
- Landing page: split-request panel replaces the globe (three.js removed); footer disclaimer.
- Leave in a row: requests that touch each other (or are separated only by Sundays and holidays) are judged together, so splitting long leave into short requests no longer skips the document or the HOD (`GET /api/leaves/chain`, shown on the apply form).
- Packaging: `.env` is kept out of Docker images; one-command launchers `scripts/run.cmd` and `scripts/run.sh`; README Node version and PowerShell note corrected.
- Home overview with numbers (`GET /api/stats`): your open requests and next time off; for managers and the HOD also what is waiting, the longest wait, who is away and how fast decisions are made.
- Team calendar: month view of who is away, with Sundays and holidays marked (`/calendar`, `GET /api/leaves/calendar`). Employees see teammates' approved leave without reasons.
- Location calendars: people work from a location, holidays can be national or local, and each request is counted with the holidays of its employee's location.
- Bulk holiday import (paste or upload CSV/TSV, day-first dates, preview, all-or-nothing apply, duplicates skipped).
- Public holidays are never counted as leave: holiday calendar (HOD-managed, `/api/holidays`), seeded fixed-date national holidays, `excluded` breakdown stored on each request and shown in the UI.
- Documents are only accepted, and the upload box only shown, for leave over 3 days.
- Renamed the product to Layover (Akasa Air logo and branding), light theme by default, new design (see DESIGN.md).
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
