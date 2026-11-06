# Master Prompt: Leave Management System (MERN)

Copy everything below the line into your AI coding tool. Work in phases and commit after each.

---

You are a senior full-stack engineer. Build a production-quality **Leave Management System** for a company hackathon, using the **MERN stack** (MongoDB, Express, React, Node.js). Judges evaluate: coding quality and OOP, API design, database design, scalability, reliability, security, practical AI use with Responsible AI, and customer-obsessed UX. Optimize for a polished, working, demo-able product over feature sprawl. Do NOT write hosting or deployment steps; just keep the app 12-factor (all config via environment variables, a `.env.example`, a health endpoint, stateless server, a Dockerfile per service, and `docker-compose.yml` for local dev).

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
1. **Auth**: register (HOD-only invites or seeded users), login, logout, refresh, change password, forgot/reset password (token-based, mocked email via console/Mailhog-style adapter). JWT access token (short-lived) + refresh token in an httpOnly, SameSite, Secure cookie. Hash passwords with bcrypt/argon2. Account lockout after repeated failures.
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

## 6. Quality and testing
- Unit tests for: working-day calculation, overlap detection, balance/ledger math, policy rules, state transitions (Vitest/Jest).
- Integration tests for the main API flows with an in-memory/test MongoDB (supertest): apply -> approve -> balance deducted; reject restores; cancel; double-approve prevented; RBAC denials; overlap rejected.
- A few frontend component tests and one Playwright happy-path e2e if time permits.
- ESLint + Prettier + Husky/lint-staged, strict TypeScript, GitHub Actions workflow running lint, typecheck and tests.
- **Seed script** creating: 1 HOD, 2 managers, 6+ employees across a department, leave types/policies, holidays, and realistic sample leave history, so the demo looks alive immediately. Print demo credentials.

## 7. UX details that win points
- Clear status chips/colors, timeline of each request (applied, approved by X with comment), skeleton loaders, empty states with calls to action.
- Apply-leave form shows live: working days counted, remaining balance after this request, conflict warnings, policy hints.
- One-click approve/reject from the manager queue with inline comment.
- Global search/filter, keyboard shortcuts optional, polished consistent design system, brand-neutral but professional (airline-style clean look is fine).

## 8. Deliverables
- Monorepo: `/server`, `/client`, root `docker-compose.yml`, `.env.example` files, `README.md` (overview, architecture diagram, ER/collection diagram, setup in under 5 commands, API summary, design decisions and tradeoffs, scalability and security notes, AI/Responsible AI section, known limitations and next steps), `SECURITY.md`, `RESPONSIBLE_AI.md`, Postman collection or OpenAPI file.
- A 3-5 minute demo script as `DEMO.md` walking: employee applies -> manager sees conflict warning and approves -> balance updates -> HOD views analytics and policy assistant answers with citations.

## 9. How to work
1. First output a concise plan: folder structure, data models, API list, state machine, and any assumptions. Pause only if something blocks you; otherwise proceed.
2. Build in phases, committing after each: (1) scaffold + auth + RBAC, (2) models/policies/holidays/seed, (3) leave apply/approve/cancel + ledger + tests, (4) dashboards/calendar/notifications/audit, (5) AI features, (6) hardening, docs, CI.
3. After each phase, run lint, typecheck and tests, and fix failures before moving on. Never leave the app in a broken state.
4. Prefer simple, readable, well-named code with comments only where logic is non-obvious. No dead code, no TODO placeholders, no hardcoded secrets.
5. At the end, report what is done, what is not, and how to run and demo it.
