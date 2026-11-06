# Master Prompt: Employee Leave Management System (MERN)

Copy everything below the line into your AI coding tool.

---

You are a senior full-stack engineer. Build the **Employee Leave Management System** below with the **MERN stack** (MongoDB, Express, React, Node.js, JavaScript preferred). It is an assessment project: evaluators will RUN it, read the README, try the workflow, and read the code. They score: workflow implementation, form validation, CRUD, usage of AI tools, and code/system knowledge. Plus points: audit logs, friendly error messages, colour coding, responsive UI.

## HOW YOU MUST WORK (read this first)

Work in **stages with checkpoints**:

1. **Stage 1 – Build everything the assignment requires (Section 1-3), completely and correctly. Nothing extra.** Do not start any "good-to-have" until Stage 1 is done, tested and runnable.
2. **Checkpoint 1 – Stop and report to me.** Give a short progress update: what is done, how to run it, test results, assumptions you made, any requirement you found ambiguous, and a ranked list of the next 3-5 improvements you propose (with one line of value each). Then continue automatically with the first proposed item unless I redirect you.
3. **Stage 2 – Plus points from the assignment** (Section 4): audit logs, friendly errors, colour coding, responsive UI. Then **Checkpoint 2** report.
4. **Stage 3 – Quality and polish, in small rounds** (Section 5, in priority order). After **each round**, commit, run lint + typecheck + tests, and send a brief progress update (done / next / any risk). Add the most important or highest-value items first. Stop adding when returns diminish; never leave the app broken.
5. **Final report**: requirement-traceability table (each requirement -> where implemented -> which test covers it), how to run, demo script, known limitations.

Rules for every stage: commit often with clear messages, keep the app runnable at every commit, run tests before reporting, never invent requirements that contradict the assignment (the assignment text always wins), and record assumptions in the README.

## 1. Assignment (authoritative requirements)

Build a simple portal where employees submit leave requests and managers approve or reject them.

**Employees can**: submit leave requests; view their submitted requests (history); check request status; attach documents when necessary.

**Managers can**: view all pending requests (those assigned to them/their team); approve; reject; add comments while approving/rejecting; view attached documents; **ask for more information** to be provided.

**Leave fields** (the API must accept this shape; `employeeName` comes from the logged-in user and, if sent, must match it):

```json
{
  "employeeName": "John",
  "fromDate": "2026-11-01",
  "toDate": "2026-11-05",
  "reason": "Vacation"
}
```

**Strict rule – long leave**: if the number of **consecutive leave days is more than 3**, then

- the system must **require supporting document(s)** (blocked on both client and server if missing), and
- it follows a **two-level approval**: first the **Manager**, then the **HOD**. Both must approve for the leave to become Approved. A rejection by either ends the request.
  Leave of 3 days or fewer needs only the Manager's approval and no mandatory document.

**Deliverable (very important)**: an **executable the evaluators can run**, plus a **README with run instructions**. See Section 6.

## 2. Roles, workflow and rules

Roles: **Employee**, **Manager**, **HOD**. Each employee has a manager; managers report to the HOD. Seed users for all three roles.

**Workflow as a single state machine** (one place in code enforces legal transitions; illegal ones return a friendly 409):

- `PENDING_MANAGER` -> Manager approves: if days <= 3 -> `APPROVED`; if days > 3 -> `PENDING_HOD`.
- `PENDING_MANAGER` -> Manager rejects -> `REJECTED` (comment required).
- `PENDING_MANAGER` / `PENDING_HOD` -> approver asks for info -> `INFO_REQUESTED` (question required). Employee replies (text and/or documents) -> returns to the stage that asked.
- `PENDING_HOD` -> HOD approves -> `APPROVED`; HOD rejects -> `REJECTED` (comment required).
- Employee may `CANCEL` while pending or info-requested (and future approved leave if you choose; document it).
- A manager's own leave goes straight to the HOD. The HOD's own leave is auto-approved and flagged in the audit log (document this assumption).
- A user can never approve their own request or one outside their scope. Two approvers can't double-process a request (optimistic locking via a version field).

**Interpretation of "consecutive days"**: count inclusive calendar days from `fromDate` to `toDate`. Make the threshold a config constant (`LONG_LEAVE_THRESHOLD_DAYS=3`), document the assumption in the README, and cover boundaries in tests (exactly 3 vs 4 days).

**Form validation (client AND server, same rules via shared schema, e.g. zod)**: required fields; valid ISO dates; `fromDate <= toDate`; no overlap with the employee's other active (pending/approved) requests; reason length limits; document required if > 3 days; file type/size limits (PDF, JPG, PNG, max ~5 MB, a few files); dates not too far in the past or future (configurable); comments required on rejection and on info requests. Every message must say what went wrong AND how to fix it.

**Documents**: stored on local disk behind a storage interface (so cloud storage could be swapped in), served only through an authenticated endpoint with access checks (employee owner, their manager, HOD), safe filenames, MIME sniffing, no direct public URLs.

**CRUD**: create (apply), read (list with filters/pagination, detail with timeline), update (employee can edit while pending or when info is requested; reply to info request), delete/cancel (soft delete, keep history). Manager decisions are updates through the workflow endpoints.

## 3. Core screens (Stage 1)

- **Login** (email + password).
- **Employee**: "Apply for leave" form (live day count, shows if documents will be required, upload), "My requests" list with status chips, request detail with a timeline of every step and comment, reply-to-info-request.
- **Manager**: "Pending requests" queue, request detail (reason, dates, days, documents viewer/download, history), actions: Approve, Reject, Ask for more info, each with a comment box.
- **HOD**: queue of requests awaiting HOD approval with the manager's decision/comment visible, same actions; plus a view of all requests.

## 4. Plus points from the assignment (Stage 2)

- **Audit log**: append-only record of every important event (login, submit, edit, document upload/view, each approval/rejection/info request/reply/cancel, role-sensitive access denials) with who, what, before/after status, timestamp, IP. A readable audit view for the HOD and a per-request activity timeline for everyone allowed to see that request.
- **Friendly error messages**: one error envelope `{ error: { code, message, hint, fields } }`; human, specific, non-technical text ("Leave longer than 3 days needs a supporting document. Please attach one, for example a medical certificate or travel booking."). Never show stack traces or raw server errors; friendly offline/timeout/404/403 screens.
- **Colour coding**: consistent status colours (Pending = amber, Awaiting HOD = blue, Info requested = purple, Approved = green, Rejected = red, Cancelled = grey), always paired with text and an icon (never colour alone). Also colour/badge long-leave requests.
- **Responsive**: usable from 320px phones to desktop; tables collapse into cards on small screens; touch-friendly.

## 5. Stage 3 – improvements to add, in this priority order (report after each round)

**Round A – Auth and security (important)**: password hashing (argon2/bcrypt), JWT access token + rotating refresh token in httpOnly Secure SameSite cookie, logout, lockout after repeated failures, RBAC middleware plus ownership checks (no IDOR), rate limiting, Helmet/CSP, CORS allowlist, input sanitization (NoSQL injection/XSS), upload hardening, secrets via env, no sensitive data in logs. Short `SECURITY.md`.
**Round B – Testing**: unit tests (day counting, overlap, >3 rule boundary, state machine incl. every illegal transition), API integration tests (full short-leave flow, full long-leave two-level flow, reject at each level, info-request loop, missing document blocked, double approval prevented, RBAC/IDOR matrix, auth tests), frontend component tests, one Playwright end-to-end per role flow. Coverage report; `TESTING.md`.
**Round C – Beautiful, accessible UI**: study principles of Awwwards-level sites, Linear, Stripe, Cal.com and GOV.UK for inspiration (not copying) and write `DESIGN.md`. Rules: **no AI slop** (no purple-pink gradients, glowing blobs, glassmorphism, emoji icons, lorem ipsum, "John Doe" placeholder data, stock unstyled component look; realistic seed data; human microcopy). Pair a refined serif display face with a very legible sans, semantic colour tokens on warm neutrals with one accent, light/dark/high-contrast themes, subtle purposeful motion that respects `prefers-reduced-motion`. **Accessible for all ages**: WCAG 2.2 AA (aim higher on text contrast), 16-18px+ body text with an A/A+/A++ text-size control, 44px touch targets, full keyboard support with visible focus, semantic HTML and correct ARIA, screen-reader-friendly status updates, no colour-only meaning, plain language, one primary action per screen, visible labels, typed-or-picked dates, confirm-and-undo on decisions. Verify with eslint-jsx-a11y, axe tests, Lighthouse a11y >= 95; write `ACCESSIBILITY.md`.
**Round D – Reliability and system quality**: pagination, indexes, no N+1 queries, graceful shutdown, health endpoint, structured logging with request IDs, OpenAPI docs at `/api/docs`, consistent layered architecture (routes -> controllers -> services -> repositories -> models) with clear OOP/SOLID.
**Round E – Documentation**: see Section 7.
**Round F – Hosting readiness (Railway)**: 12-factor config, `PORT` from env, production cookies/CORS, health check, MongoDB Atlas or Railway Mongo, safe one-time seed, `DEPLOYMENT.md` with every env var, steps, smoke-test checklist and troubleshooting. Put live URL and demo credentials at the top of the README if deployed.
**Round G – Nice-to-have features (pick only the most valuable, one at a time, each with tests and docs, behind a feature flag):**

1. Team calendar showing who is on leave and overlap warnings for the manager.
2. Notifications (in-app, plus email adapter via env) on submit/decision/info request.
3. Dashboard stats for manager/HOD (pending counts, average decision time, leave by month), CSV export.
4. Leave balance / annual quota with clear warnings.
5. Holiday calendar and optional "working days" counting.
6. **Small, responsible AI assistant** (optional, off by default, provider-agnostic): e.g. summarise a long request for the approver, or suggest a clearer reason / flag a missing document. Rules: AI never approves or rejects, human decides; schema-validated output with deterministic fallback; redact sensitive data; defend against prompt injection; label as AI-generated; document in `RESPONSIBLE_AI.md`.
7. Installable PWA, Delegation while on leave, .ics export.

## 6. Executable and run instructions (mandatory, from Stage 1)

Evaluators must be able to run it with minimal effort. Provide **all** of these and test them from a clean clone:

- **Option 1 (primary): `docker compose up --build`** starting MongoDB (single-node replica set), server and client, auto-seeding demo data on first run, then printing the URL and demo credentials.
- **Option 2 (no Docker): `npm run setup && npm start`** at the repo root that installs both apps, builds the client, and serves everything from one Express port. If `MONGODB_URI` is not set, automatically fall back to an embedded MongoDB (`mongodb-memory-server` with a persisted data path) so it works with **zero external dependencies**.
- A root `README.md` whose first screen contains: what it is, prerequisites, the two run options above, demo accounts (employee, manager, HOD with passwords), the ports/URLs, how to run tests, and a note on assumptions. A Windows-friendly instruction set (PowerShell) as well as macOS/Linux.
- Seed data: 1 HOD, 2 managers, 5-6 employees, and sample requests in every status, including a long (>3 day) leave in each stage, with a document attached, so every screen and colour is visible immediately.
- A `/health` endpoint and a clear startup log. `.env.example` for each app with safe defaults so it runs without any configuration.

## 7. Documentation (clear terms, explained well)

Write for someone who has never seen the project. Plain language, define every term before using it.

- `README.md`: what/why in two sentences, quick start, demo accounts, features by role, screenshots/GIF, architecture diagram, tech choices with one-line reasons, folder structure, assumptions, known limitations, links to other docs.
- `GLOSSARY.md`: HOD, consecutive leave, state machine, audit log, RBAC, JWT, refresh token, optimistic locking, etc.
- `WORKFLOW.md`: the state diagram, a table of every transition (who, when, what changes, what is logged), worked examples with real dates (2-day leave vs 5-day leave).
- `ARCHITECTURE.md`: system and data model diagrams (collections, indexes, why), key decisions and tradeoffs, what changes at 10x scale.
- `API.md` + OpenAPI at `/api/docs`: examples, error codes, auth per endpoint.
- `USER_GUIDE.md`: short role-based guides in non-technical language.
- `AI_USAGE.md`: **honest account of how AI tools were used to build this** (which tools, example prompts, what was generated vs hand-reviewed, how outputs were verified, mistakes the AI made and how they were fixed). This directly maps to the "Usage of AI tools" evaluation criterion.
- Plus: `SECURITY.md`, `TESTING.md`, `DESIGN.md`, `ACCESSIBILITY.md`, `DEPLOYMENT.md`, `DEMO.md` (a 3-5 minute script: employee applies a 5-day leave without a document and sees the friendly block -> adds a document -> manager asks for more info -> employee replies -> manager approves -> HOD approves -> audit log shows everything), and `CHANGELOG.md`.
- In code: meaningful names, TSDoc on services and non-obvious logic, no stale comments. Include a "Known limitations and future work" section; do not overclaim.

## 8. Engineering standards

- TypeScript strict mode, ESLint + Prettier, small functions, no dead code, no TODO placeholders, no hardcoded secrets.
- Shared validation schemas between client and server so rules never drift.
- Simple and readable beats clever. This is a "simple portal": prefer a clean, correct, well-explained solution over a sprawling one.
- Every checkpoint report must be short and honest: what works, what was verified (tests/commands run), what is not done, what you will do next.

Begin with Stage 1 now: print a concise plan (folder structure, data models, API list, state machine, assumptions), then build, then report at Checkpoint 1.
