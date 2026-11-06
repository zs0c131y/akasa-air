# Master Prompt: Leave Management System (MERN)

Copy everything below the line into your AI coding tool. Work in phases and commit after each.

---

You are a senior full-stack engineer. Build a production-quality **Leave Management System** for a company hackathon, using the **MERN stack** (MongoDB, Express, React, Node.js). Judges evaluate: coding quality and OOP, API design, database design, scalability, reliability, security, practical AI use with Responsible AI, and customer-obsessed UX. Optimize for a polished, working, demo-able product over feature sprawl. Keep the app 12-factor (all config via environment variables, a `.env.example`, a health endpoint, stateless server, a Dockerfile per service, and `docker-compose.yml` for local dev) and make it deploy-ready for Railway (see section 10).

**Top priority: meet every requirement in the official problem statement first** (leave management with Employee, Manager and HOD roles). Treat the features below as a checklist; core requirements must be complete, correct and demo-ready before any extra or "additional" feature is started. If the official statement conflicts with anything here, the official statement wins. Extras are a bonus that must never compromise the core.

## 1. Roles and hierarchy
Three roles with strict RBAC:
- **Employee**: applies for leave, views own balance/history, cancels own pending or future approved leave.
- **Manager**: manages a team of employees. Approves/rejects team leave requests, sees team calendar and team balances. Also applies for own leave.
- **HOD (Head of Department)**: oversees managers and the department. Approves manager leave requests, can approve or override employee requests (escalation), manages department policy settings, holidays and reports.

Approval routing:
- Employee request -> their Manager (HOD can also act as escalation/override, with a mandatory comment).
- Manager request -> HOD.
- HOD request -> auto-approved with audit flag (or routed to a seeded "Admin" if you prefer; document your choice).
- Auto-escalate to HOD if a manager hasn't acted within a configurable number of days (background job).
- Each user has `department`, `managerId`, and `role`. A manager cannot approve their own request or anyone outside their team.

## 2. Core features
1. **Auth (complete, not a demo stub)**: HOD-only user invites (emailed one-time link to set password) plus seeded users, login, logout, silent refresh, change password, forgot/reset password (hashed, single-use, expiring token; mocked email via console/Mailhog-style adapter), email verification on invite acceptance. Short-lived JWT access token (in memory) + rotating refresh token in an httpOnly, Secure, SameSite cookie with reuse detection. Hash passwords with argon2 (or bcrypt cost 12), enforce a sensible password policy (length over complexity, breached-password check optional), account lockout and progressive delay after repeated failures, generic error messages to avoid user enumeration. "Active sessions" screen where a user can see and revoke devices. Optional TOTP-based MFA for managers and HOD. Auto-logout with a gentle, accessible warning before session expiry. Deactivating a user instantly revokes their sessions.
2. **Leave types and policy** (configurable per department by HOD): Casual, Sick, Earned/Privileged, Comp-off, Unpaid, Maternity/Paternity. Each with annual quota, carry-forward cap, max consecutive days, min notice days, document required (e.g., medical certificate if sick > 2 days), half-day allowed.
3. **Apply leave**: type, from/to dates, half-day (first/second half), reason, optional attachment (validated type/size, stored on disk or GridFS behind a storage interface), notify manager.
   - Count only working days: exclude weekends and department holidays.
   - Validate: sufficient balance, no overlap with existing pending/approved leave, notice period, max consecutive days, no past dates (except sick backdating within N days), start <= end.
   - **Team conflict warning**: show if more than X% of the team is already on leave in that range, and let manager see it before approving.
4. **Approval workflow** as a state machine: `PENDING -> APPROVED | REJECTED | CANCELLED | ESCALATED`, with allowed transitions enforced in one place. Approve/reject with comment. Bulk approve. Optimistic locking (version field) so two approvers can't double-process a request.
5. **Balance ledger**: do not just mutate a number. Keep an append-only `LeaveLedger` (accrual, deduction, restoration on cancel/reject, carry-forward, manual adjustment by HOD) and compute balances from it (with a cached snapshot). Use MongoDB transactions (replica set) for approve/cancel so ledger and request stay consistent.
6. **Cancellation**: employee cancels pending or future approved leave; balance is restored; approver is notified. Past leave cannot be cancelled.
7. **Calendar views**: personal calendar, team calendar (manager), department calendar (HOD) with holidays and leave overlays; list view with filters (status, type, date range, employee) and server-side pagination/sorting.
8. **Dashboards**:
   - Employee: balances per type (cards/rings), upcoming leave, recent requests, status timeline.
   - Manager: pending approvals queue, who's out today/this week, team balances.
   - HOD: department utilization, leave trends by month/type, top absentees, pending escalations, holiday and policy management. Export CSV.
9. **Notifications**: in-app notification center (unread count, mark read) plus email adapter (console/SMTP via env). Optional real-time via SSE/Socket.IO for new requests and decisions.
10. **Audit log**: immutable record of every state change and policy change (who, what, before/after, IP, timestamp). HOD can view/filter.
11. **Holidays**: HOD CRUD of holiday calendar per year; weekends configurable.

## 3. AI features (practical, with Responsible AI)
Add two focused features, not a chatbot gimmick. Use a provider-agnostic `LLMClient` interface (OpenAI/Anthropic/Gemini/Ollama selected via env) so the app works with the AI feature disabled.
1. **Policy Assistant (RAG)**: HOD uploads/edits policy text (markdown). Chunk, embed, store vectors (MongoDB Atlas Vector Search if available, otherwise a local cosine-similarity fallback). Employees ask "Can I take sick leave for 3 days without a certificate?" and get an answer **with citations to policy sections**. If retrieval confidence is low, answer "I'm not sure, please contact HR" instead of guessing.
2. **Natural-language leave drafting**: "I need next Friday and Monday off for my sister's wedding" -> LLM returns **schema-validated JSON** (type, dates, half-day, reason) used only to pre-fill the form. The user always reviews and submits; the AI never submits or approves anything.
3. **Optional**: manager-side summary of the team's upcoming absences and conflict risk.

Responsible AI requirements: validate all LLM output with a schema (zod) and fall back deterministically on failure; defend against prompt injection (treat user text and documents as data, never instructions; strip/flag attempts); never send sensitive data (medical details, passwords, tokens) to the LLM — redact first; log prompts/outputs with PII masking; rate limit AI endpoints; show a clear "AI-generated, verify with policy" disclaimer; human-in-the-loop for every decision; no AI used for approval decisions or ranking employees; add a short `RESPONSIBLE_AI.md` documenting risks, mitigations and evaluation (a small test set with accuracy checks).

## 4. Tech stack and architecture
- **Backend**: Node 20+, Express, **TypeScript**, Mongoose. Layered architecture: `routes -> controllers -> services -> repositories -> models`, with dependency injection-friendly classes (show OOP and SOLID; Strategy pattern for leave-policy rules, State pattern or a transition map for workflow, Adapter for LLM/email/storage). Central error handling with typed `AppError`, consistent error envelope `{ error: { code, message, details } }`, request IDs, structured logging (pino).
- **Validation**: zod on every request body/query/params.
- **Frontend**: React 18 + Vite + TypeScript, React Router, TanStack Query for server state, React Hook Form + zod, Tailwind (or MUI), a calendar component (FullCalendar or a custom one), charts (Recharts). Responsive/mobile-first, accessible (labels, keyboard nav, contrast, ARIA), loading/empty/error states, optimistic updates where safe, toasts, dark mode optional.
- **API design**: REST, versioned `/api/v1`, resource-oriented, proper status codes, pagination (`page`, `limit`, `total`), filtering, idempotency key for create-leave, OpenAPI/Swagger docs served at `/api/docs`.
- **Database design**: collections `users`, `departments`, `leaveTypes`/`policies`, `leaveRequests`, `leaveLedger`, `holidays`, `notifications`, `auditLogs`, `policyDocs`/`policyChunks`, `refreshTokens`. Define indexes (e.g., `{employeeId, fromDate, toDate}`, `{approverId, status}`, `{managerId}`), explain reference-vs-embed decisions in the README, and include a diagram.
- **Scalability/reliability**: stateless API, pagination everywhere, indexes, no N+1 queries (use aggregation/`$lookup` or batched fetches), background jobs (node-cron or BullMQ) for escalation and year-end carry-forward, graceful shutdown, retries with backoff for email/LLM, timeouts and circuit breaker around LLM calls, health (`/health`) and readiness endpoints.

## 5. Security
Helmet + strict CSP, CORS allowlist from env, CSRF protection for cookie auth, rate limiting (stricter on auth and AI routes), `express-mongo-sanitize`/input sanitization against NoSQL injection, XSS-safe rendering, password policy, secure cookies, RBAC middleware plus resource-level ownership checks (no IDOR: every query scoped by role/team), file upload validation, secrets only via env, no sensitive data in logs, dependency audit in CI, least-privilege DB user. Include a short `SECURITY.md` listing threats and mitigations (OWASP Top 10 mapping).

## 6. Quality and testing (treat as a first-class deliverable)
- **Unit tests** (Vitest/Jest): working-day calculation (weekends, holidays, half-days, year boundaries, leap years), overlap detection, balance/ledger math, policy rules per leave type, state-transition map (every legal and illegal transition), date/timezone handling, LLM output schema validation and fallback.
- **Auth tests**: register/invite, login success/failure, lockout after N failures, password hashing, JWT expiry, refresh-token rotation and **reuse detection** (reused token revokes the whole family), logout invalidation, password reset token single-use and expiry, cookie flags (httpOnly, Secure, SameSite), CSRF rejection, brute-force rate limiting, session listing and revocation.
- **Authorization tests**: a full role x endpoint matrix (employee/manager/HOD/anonymous) asserting 200/401/403/404 correctly, IDOR attempts (employee reading another's leave, manager approving outside their team, manager approving own request), privilege escalation attempts via body tampering (e.g., sending `role` or `employeeId`).
- **Integration tests** (supertest + in-memory/test MongoDB replica set): apply -> approve -> balance deducted; reject restores; cancel restores; double-approve prevented by version check; concurrent approvals race; overlap rejected; insufficient balance rejected; escalation job; carry-forward job; audit entries written for every change; pagination/filter correctness.
- **Security tests**: NoSQL injection payloads, XSS payloads in reason/comment fields, oversized bodies, malicious file uploads, prompt-injection strings against the AI endpoints.
- **Frontend tests** (Vitest + Testing Library): forms, validation messages, role-based route guards, calendar interactions, approval queue; mock the API with MSW.
- **E2E** (Playwright): employee applies -> manager approves -> employee sees status and balance; HOD overrides; login/logout/session expiry; run in Chromium and one mobile viewport; include keyboard-only paths.
- **Accessibility tests**: axe-core on every main page in light, dark and high-contrast themes; Lighthouse CI thresholds (a11y >= 95, performance >= 85, best-practices >= 95).
- Coverage target 80%+ on services and 100% on the workflow/ledger logic; coverage report in CI; fail CI below thresholds.
- ESLint + Prettier + Husky/lint-staged, strict TypeScript, GitHub Actions workflow running lint, typecheck and tests.
- **Seed script** creating: 1 HOD, 2 managers, 6+ employees across a department, leave types/policies, holidays, and realistic sample leave history, so the demo looks alive immediately. Print demo credentials.

## 7. UI/UX and design direction (this is a major judging factor)
**Goal**: a distinctive, calm, premium interface that looks designed by a human product designer, and that a 22-year-old and a 62-year-old can both use without help.

**Research first**: before writing UI code, study the *principles* (not layouts to copy) of: Awwwards site-of-the-day winners and honorable mentions for typography and rhythm, Linear and Cal.com for product polish, Stripe and Vercel for clarity, Notion Calendar and Google Calendar for scheduling patterns, Airbnb for approachable forms, and GOV.UK Design System plus the WCAG 2.2 / WAI patterns for accessibility. Summarize the chosen direction in `DESIGN.md` (type scale, color tokens, spacing, motion, component rules) and follow it.

**Anti-"AI slop" rules (hard constraints)**:
- No purple/blue-pink gradients, no glowing blobs, no generic glassmorphism, no neon-on-dark by default, no stock "SaaS hero" with a gradient headline.
- No emoji as icons. Use one consistent icon set (Lucide or Phosphor), same stroke weight.
- No lorem ipsum, "John Doe", or placeholder numbers. Seed data must be realistic (Indian names, real-sounding departments, believable dates).
- No default, unstyled component-library look. Customize tokens so it does not look like stock shadcn/MUI.
- No decorative clutter: every element earns its place. No more than one accent color plus semantic status colors.
- No fake testimonials, fake metrics, or filler marketing copy. Microcopy must be human, plain and specific ("Your manager Priya will review this, usually within a day").

**Visual system**:
- Typography: a characterful display face for headings (e.g., a refined serif such as Fraunces or Newsreader) paired with a highly legible sans for UI (e.g., Inter, Source Sans 3 or Atkinson Hyperlegible). Fluid type scale with `clamp()`, generous line-height (1.5-1.7), body text at least 16px (default 17-18px), no light-weight thin fonts for body.
- Color: define semantic design tokens as CSS variables (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--success`, `--warning`, `--danger`). Warm, slightly off-white neutrals with deep ink text; one confident brand accent; muted, harmonious status colors. Support **light, dark and a high-contrast theme**, respecting `prefers-color-scheme` and `prefers-contrast`, with a visible theme switcher.
- Layout: 8px spacing grid, strong alignment, generous whitespace, clear visual hierarchy, cards used sparingly (prefer dividers and spacing), responsive from 320px to ultra-wide. Considered empty, loading (skeletons) and error states.
- Motion: subtle, purposeful (page transitions, calendar range selection, status changes, number count-ups), 150-300ms ease-out. Respect `prefers-reduced-motion` fully (no motion at all). No parallax, no autoplaying loops.
- Data viz: accessible charts (not color-only, patterns/labels, readable axes, table fallback), balance shown as clear rings/bars with numbers.
- Signature touches: a beautiful, readable calendar as the hero of the product (range selection by click/drag and by keyboard, holidays and team leave overlaid), a request timeline, and a satisfying approve/reject interaction with undo.

**Accessibility for all ages (WCAG 2.2 AA minimum, aim for AAA on text contrast)**:
- Contrast: body text 7:1 where possible, UI components and focus indicators at least 3:1. Never convey status by color alone; use text label + icon + color.
- Keyboard: everything operable by keyboard, logical tab order, visible 2-3px focus ring, skip-to-content link, no keyboard traps, shortcuts optional and discoverable.
- Screen readers: semantic HTML first (landmarks, headings in order, real buttons/links/labels), ARIA only where needed, live regions for toasts and async results, accessible names on icon buttons, accessible dialogs (focus trap and return), data tables with proper headers, calendar with a list/table alternative.
- Touch and motor: targets at least 44x44px, generous spacing, no precision-dependent gestures, no hover-only actions, drag interactions always have a button/keyboard alternative.
- Readability for older and low-vision users: a text-size control (A / A+ / A++) that scales via `rem`, works at 200% browser zoom and 400% reflow without horizontal scroll, avoid truncating important text, plain language at roughly grade 8 reading level, consistent navigation, short labelled steps instead of dense screens.
- Cognitive ease: one primary action per screen, forms with visible (not placeholder-only) labels, helpful inline validation with specific fix instructions, confirmation summaries before submit, undo for approve/reject/cancel, no time-limited actions without warning, consistent terminology.
- Date inputs: allow typing dates in addition to picking; unambiguous formats ("Fri, 14 Nov 2026"); show working-day count in words.
- Internationalization-ready: externalized strings, `lang` attribute, support RTL-safe layout, and relative/absolute date display with timezone awareness.
- Pass automated checks: eslint-plugin-jsx-a11y, axe-core in tests, Lighthouse accessibility score of 95+, and manual checks with keyboard-only, screen reader (NVDA/VoiceOver) and zoom. Document results in `ACCESSIBILITY.md`.

**Core screens to design with care**: login/reset, employee home (balances, upcoming, quick "Apply leave"), apply-leave flow (live working-day count, balance-after, conflict hints, policy tips), my leaves with timeline, manager approval queue (inline comment, bulk actions, team conflict view), team/department calendar, HOD analytics and policy/holiday admin, notification center, profile/settings (theme, text size, notification prefs, sessions).

## 8. Deliverables
- Monorepo: `/server`, `/client`, root `docker-compose.yml`, `.env.example` files, `README.md` (overview, architecture diagram, ER/collection diagram, setup in under 5 commands, API summary, design decisions and tradeoffs, scalability and security notes, AI/Responsible AI section, known limitations and next steps), `SECURITY.md`, `RESPONSIBLE_AI.md`, `DESIGN.md`, `ACCESSIBILITY.md`, `TESTING.md` (test strategy, how to run, coverage), Postman collection or OpenAPI file.
- A 3-5 minute demo script as `DEMO.md` walking: employee applies -> manager sees conflict warning and approves -> balance updates -> HOD views analytics and policy assistant answers with citations.

## 9. Additional features (only after all core requirements are done and tested)
Pick the ones that add real user value, in this order, and cut the rest:
1. Leave **delegation / backup person** while away, with an in-app note to the delegate.
2. **Comp-off and overtime credit** requests with approval.
3. **Calendar export** (.ics) and subscribe link so approved leave shows in Google/Outlook calendars.
4. **Leave encashment/balance forecast**: "if you take these dates, your balance on 31 Dec will be X".
5. **Smart suggestions**: recommend low-conflict dates around public holidays (long weekends) using plain rules, not AI.
6. **Saved filters and reports**, scheduled weekly summary email to managers.
7. **Mobile PWA** (installable, offline-readable balances and calendar).
8. **Org chart view** showing who reports to whom and who is currently out.
Each extra needs its own tests and documentation, and must degrade gracefully if disabled via a feature flag.

## 10. Hosting (Railway) and deployment readiness
- Deploy-ready for **Railway**: separate services for `server` and `client` (or serve the built client from the server), MongoDB via MongoDB Atlas or a Railway Mongo service (must support transactions/replica set), all secrets via Railway environment variables, `PORT` read from env, health check path configured, build and start commands defined in `package.json` scripts, `railway.json`/`nixpacks`/Dockerfile settings as appropriate.
- Production hardening: `NODE_ENV=production`, trust proxy configured, secure cookies and CORS set from env for the deployed client origin, HTTPS-only, production logging, graceful shutdown, DB connection retry, seed script safe to run once on the deployed DB, no dev-only endpoints exposed.
- CI/CD: GitHub Actions runs lint, typecheck and tests, and only a green `main` is deployed.
- Provide `DEPLOYMENT.md` with a step-by-step guide anyone can follow: prerequisites, creating the database, listing every environment variable (name, purpose, example, required or optional), deploying each service, running the seed, verifying with a smoke-test checklist, rolling back, and a troubleshooting section for the common failures (CORS, cookies on cross-site domains, DB connection, wrong port).
- Put the live URLs and demo credentials at the top of `README.md`.

## 11. Documentation standards (clear terms, explained well)
The documentation is judged as seriously as the code. Write for a reader who has never seen the project.
- **Plain language, defined terms**: add a `GLOSSARY.md` (and a short glossary in the README) defining every domain and technical term in simple words, e.g. HOD, ledger, carry-forward, comp-off, RBAC, JWT, refresh token rotation, idempotency, RAG, optimistic locking. Never use a term before defining it. Prefer short sentences and concrete examples over jargon.
- **README** (the front door): what the product is and who it is for in two sentences, screenshots/GIFs, live demo link and credentials, features by role, quick start in under five commands, architecture diagram, tech stack with one-line reasons for each choice, folder structure, and links to every other doc.
- **Explain the "why"**: `ARCHITECTURE.md` with diagrams (system context, component, data model/ER, leave-request state machine, auth/refresh flow, RAG flow), the key decisions and tradeoffs (e.g., ledger vs mutable balance, transactions, reference vs embed), and what you would change at 10x scale.
- **Business rules in one place**: `LEAVE_POLICY_RULES.md` with every rule in a table (leave types, quotas, notice, max days, carry-forward, working-day counting, approval routing, escalation timing) plus worked examples with real dates.
- **API docs**: OpenAPI/Swagger at `/api/docs`, plus an `API.md` with request/response examples, error codes and auth requirements per endpoint.
- **User guides**: short, illustrated role-based guides (Employee, Manager, HOD) in `USER_GUIDE.md`, written in non-technical language, answering "How do I apply?", "How do I approve?", "What happens if I cancel?".
- **Also required**: `DESIGN.md`, `ACCESSIBILITY.md`, `SECURITY.md`, `RESPONSIBLE_AI.md`, `TESTING.md`, `DEPLOYMENT.md`, `DEMO.md`, `CONTRIBUTING.md` and a `CHANGELOG.md`. Keep them consistent, cross-linked, and free of contradictions.
- In code: meaningful names, JSDoc/TSDoc on public services and non-obvious logic, and no stale or misleading comments.
- Be honest: include a "Known limitations and future work" section rather than overclaiming.

## 12. How to work
1. First output a concise plan: folder structure, data models, API list, state machine, and any assumptions. Pause only if something blocks you; otherwise proceed.
2. Build in phases, committing after each: (1) scaffold + auth + RBAC, (2) models/policies/holidays/seed, (3) leave apply/approve/cancel + ledger + tests, (4) dashboards/calendar/notifications/audit, (5) AI features, (6) hardening, CI, Railway deploy-readiness, (7) additional features (only if time remains), (8) full documentation pass and a final requirements-traceability check (a table mapping each official requirement to where it is implemented and tested).
3. After each phase, run lint, typecheck and tests, and fix failures before moving on. Never leave the app in a broken state.
4. Prefer simple, readable, well-named code with comments only where logic is non-obvious. No dead code, no TODO placeholders, no hardcoded secrets.
5. At the end, report what is done, what is not, and how to run and demo it.
