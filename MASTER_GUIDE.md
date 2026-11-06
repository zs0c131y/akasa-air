# Layover: the master guide

Everything you need to explain this project without opening the code: what it does, how it works, why each rule exists, where it lives, what is extra, what is not perfect, and answers to the viva questions (Part 9).

Read Parts 1 to 4 first. Part 9 is the question bank. If you remember only one page, read the cheat sheet in Part 10.

---

## Part 1. The project in one minute

**Layover** is an employee leave management web app (built by one developer, working alone with AI tools, as an individual placement hackathon project from a problem statement; not affiliated with Akasa Air).

- An **employee** asks for leave, attaches documents when needed, and follows the status.
- A **manager** sees the requests of their team, approves, rejects (with a reason), or asks for more information.
- The **HOD** (Head of Department) gives the second approval for long leave, sees everything, keeps the holiday calendar and the audit log, and sets up new people.
- **The rule the assessors care about:** if someone is away **more than 3 days in a row**, the system forces a **document** and **two approvals** (Manager, then HOD). It cannot be skipped, and it cannot be dodged by splitting the leave into pieces.

Stack: **MERN in plain JavaScript** (MongoDB, Express, React, Node). No TypeScript.

---

## Part 2. How it is built

### 2.1 The picture

```
Browser (React app, built by Vite)
   │  fetch() with httpOnly cookies, JSON or multipart
   ▼
Express API (Node)  ── middleware: request id, Helmet/CSP, JSON parser, CORS allow-list, rate limit, NoSQL-key guard
   │                  ── routes (thin)  →  services (business logic)  →  Mongoose models
   ▼
MongoDB (Atlas in production, embedded MongoDB for local runs)

shared/  = validation and counting rules used by BOTH the browser and the server (one source of truth)
```

One Node process serves the API **and** the built React files, so hosting is one service (Railway or Docker).

### 2.2 Folder map

| Folder | What is in it |
|---|---|
| `client/` | The React app: `src/pages` (screens), `src/ui` (shadcn-style buttons, inputs, cards), `src/api.js` (all calls to the server), `src/landing` (the public page), `src/theme.jsx` (light/dark, text size) |
| `server/` | Express app: `src/routes` (HTTP), `src/services` (rules), `src/models` (MongoDB schemas), `src/middleware` (auth, security), `src/workflow.js` (the state machine), `src/seed.js` (demo data), `test/` |
| `shared/` | `src/index.js`: Zod schemas, day counting, document rule, password rules. Imported by client and server |
| `docs/` | Written documentation, grouped by purpose (see 2.3) |
| `scripts/` | One-command launchers: `run.cmd` (Windows), `run.sh` (macOS/Linux), and the zip packager |
| root files | `README.md`, this guide, `Dockerfile`, `docker-compose.yml`, `package.json`, lint/format config, `.env.example` |

### 2.3 Documentation map

| Document | Use it for |
|---|---|
| `README.md` | How to run it |
| `MASTER_GUIDE.md` | This file |
| `docs/architecture/WORKFLOW.md` | Every rule and state in detail |
| `docs/architecture/ARCHITECTURE.md` | Technical overview |
| `docs/architecture/SECURITY.md` | Security measures and known limits |
| `docs/architecture/DESIGN.md` | Look and feel, copy voice |
| `docs/architecture/GLOSSARY.md` | Plain-language terms |
| `docs/api/API.md` | Endpoint list (the live version is at `/api/docs`) |
| `docs/operations/DEPLOYMENT.md` | Hosting on Railway, all environment variables |
| `docs/operations/TESTING.md` | What each test file covers |
| `docs/operations/DEMO.md` | A 5-minute demo script |
| `docs/project/AI_USAGE.md` | How AI tools were used |
| `docs/project/CHANGELOG.md` | What changed, in order |
| `docs/project/PROMPT.md`, `PREP.md` | The original build prompt and prep notes |

### 2.3b System design in short (for "explain your architecture")

- **Style:** a single-page React app talking to a REST-style JSON API; the API is stateless apart from the database (sessions are cookies carrying signed tokens), so it can run as one process or several.
- **Layers:** route (HTTP) → service (rules) → model (data). Cross-cutting concerns (auth, security headers, rate limits, request ids, structured logs) are middleware.
- **State machine** for the request lifecycle; **shared validation package** so browser and server agree; **append-only audit** for accountability; **optimistic locking** for concurrent edits.
- **Hosting:** one Node service serving API and UI, MongoDB Atlas for data, environment variables for secrets, `/health` for monitoring, graceful shutdown for safe restarts.
- **Scaling story (if asked):** the app is stateless, so add instances behind a load balancer; move uploads to object storage and rate-limit counters to Redis; add indexes already in place; paginate lists (already done).

### 2.3c Tools and technology

JavaScript (ES modules) everywhere. React 18 + Vite + React Router + Tailwind + shadcn-style components + Lucide + GSAP on the client. Node 20.12+, Express 5, Mongoose 8 on the server. MongoDB (Atlas, or embedded locally). Zod, bcryptjs, jsonwebtoken, Helmet, express-rate-limit, multer. Mailgun for optional email. OpenAPI 3 + Swagger UI. Vitest, Supertest, Testing Library for tests; ESLint and Prettier for quality. Docker and Railway for packaging and hosting. Built with AI coding agents (Part 11).

### 2.4 One request, start to finish

Example: an employee submits leave.

1. **React** (`client/src/pages/ApplyPage.jsx`) checks the form with the shared Zod schema and shows errors under the fields. It also calls `/api/leaves/chain` to learn whether these dates join up with other leave.
2. `client/src/api.js` sends `POST /api/leaves` as multipart (dates, reason, files) with the cookie and the header `X-Requested-With: lms`.
3. **Express** runs the middleware: request id, security headers, rate limit, key guard (rejects `$` and `.` in keys), then `requireAuth` reads the cookie, verifies the JWT, loads the user.
4. `server/src/routes/leaves.js` (`POST /`) uses multer to hold the files in memory and calls `createLeave` in `server/src/services/leaveService.js`.
5. **The service** validates again with the same shared schema (holidays of the person's location included), counts days, checks overlap, allowance, manager, the document rule, then checks the real file type (magic bytes), stores files, decides the first status, and saves the document with its first timeline entry.
6. The route then writes the **audit entry**, creates **notifications** for whoever must answer, and returns JSON.
7. React navigates to the request page, which reads `GET /api/leaves/:id`. That response includes `allowedActions`, so the buttons shown are exactly what this person may do.

Why this layering: the **route** only handles HTTP, the **service** holds the business rules (so tests can call it and the rules are not scattered), the **model** describes the data. There is no separate repository layer: Mongoose models do that job, which was a deliberate choice for scope.

---

## Part 3. People and permissions

| | Employee | Manager | HOD |
|---|---|---|---|
| Apply for leave | yes | yes (goes to the HOD) | yes (approved automatically, flagged) |
| See own requests, status, history | yes | yes | yes |
| See team requests | no | their own team | everyone |
| Approve / reject / ask | no | their team, first stage | long leave, second stage; manager leave |
| Open documents | own | their team's | all (each open is logged) |
| Holiday calendar, locations, allowances, people setup | read holidays | read | **edit** |
| Audit log | no | no | yes |
| Own leave | goes to manager | goes to HOD | auto-approved and flagged |

Two layers enforce this: **role checks** (middleware and services) and **ownership checks** (is this *your* request, *your* team?). If you ask for someone else's request, you get **404, not 403**, so the system does not even reveal that it exists.

---

## Part 4. The rules, and the logic behind each

### 4.1 Counting days (two different numbers)

1. **Days in a row** (`absenceDays`, in `shared/src/index.js`): calendar days from the first day to the last day, **both included**, Sundays and holidays in the middle included. Friday to Monday is **4 days in a row**. This number decides "more than 3".
2. **Charged days** (`days`, from `leaveBreakdown`): the same range **minus Sundays and public holidays**. Friday to Monday is **3 charged days**. This number is taken from the person's yearly allowance.

Why both: the assignment says "more than 3 *consecutive* leaves". Being away Friday to Monday is four days out of office even if one is a Sunday, so the strict rule uses days in a row. But nobody should lose leave balance for a Sunday, so charging skips it.

Why both ends are counted: a leave from the 5th to the 5th is one day away, not zero.

### 4.2 Long leave (more than 3 days in a row)

- **Exactly 3 days: short.** Manager only, no documents.
- **4 or more: long.** A supporting document is required (PDF, JPG or PNG, up to 5 MB each, up to 5 files), and the request needs the Manager **then** the HOD.
- The check runs in the browser (instant message) **and** on the server (cannot be bypassed). Both use `documentRequirementError` from `shared`.
- The upload box is **only shown** for long leave, and the server **refuses** documents on short leave.

### 4.3 The anti-split rule

Someone files Friday and Saturday (2 days, short), then Monday to Wednesday (3 days, short). Together it is six days in a row.

- `consecutiveChain` (shared) joins requests of the same person that **touch**, or are separated only by Sundays and holidays, and totals them.
- The **later** request becomes long: it needs a document and the HOD, and says why ("Together with your other leave ... this is 6 days in a row").
- It is **flagged** (`splitFlag`, badge "In a row with other leave"), shown to approvers, and written to the audit log (`SPLIT_LEAVE_FLAGGED`).
- The apply form warns the person before they submit (`GET /api/leaves/chain`).

### 4.4 The workflow (state machine)

The only place that decides legal moves is `server/src/workflow.js`.

| Status | Meaning |
|---|---|
| `PENDING_MANAGER` | Waiting for the employee's manager |
| `PENDING_HOD` | Waiting for the HOD (second approval, or a manager's own leave, or manager away) |
| `INFO_REQUESTED` | An approver asked a question; waiting for the employee |
| `APPROVED` | Final yes |
| `REJECTED` | Final no (a reason is required) |
| `CANCELLED` | The employee withdrew it |

Moves:

```
file ──► PENDING_MANAGER ──approve (short)──────────────► APPROVED
              │  └─approve (long)──► PENDING_HOD ──approve──► APPROVED
              ├─reject──► REJECTED          └─reject──► REJECTED
              └─ask────► INFO_REQUESTED ──employee replies──► back to the SAME stage
```

- Approving a **long** request at the manager stage does **not** make it APPROVED: it moves to `PENDING_HOD`. That is the two-level approval.
- Approving a request you filed yourself is impossible (checked in `actorPermits`).
- **Info loop:** the request remembers which stage asked (`infoRequestedFrom` = MANAGER or HOD). The reply sends it back to that exact stage.
- Terminal states (`APPROVED`, `REJECTED`, `CANCELLED`) allow no further approval. A rejected request cannot be approved later; the person files a new one.
- Every illegal move returns **409** with a friendly message. Every move by the wrong person returns **403**.
- **Edit** is allowed only while the request is open **and nobody has approved it yet**. **Cancel** is allowed while open, or for approved leave that has not started yet.

### 4.5 Manager away: requests go to the HOD

If a manager has approved leave covering the requested days (or today), the employee's request skips the manager and goes **straight to the HOD**, who answers **on behalf of that manager**.

- Applied when a request is filed, and also to waiting requests when the manager's own leave is approved (`rerouteTeam`).
- Visible everywhere: a "Passed to the HOD" entry in the history, an "On behalf of {manager}" badge, a notice on the request page and in the HOD's notification.
- Documents are still required for long leave. This is a deliberately simple design for a time-boxed project: no delegate setup needed.

### 4.6 Overlap warning for approvers

When an approver opens a request, the server adds `overlaps`: who else on the same team is away on those days ("2 of 3 teammates are away"). It is only computed for people who can approve that request, so employees never see colleagues' leave details.

### 4.7 Emergency leave

A long leave can be marked **emergency**: it may be filed **without documents**, but documents are then **owed** (due the working day after the leave ends, or before the next leave). One outstanding emergency allows one more emergency only; **two outstanding block all new leave** until documents are uploaded. Both approvals still apply.

### 4.8 Holidays and locations

- Sundays and public holidays are **never charged** as leave.
- Holidays are **national** (everyone) or tied to a **location**. Each person works from one location, so a Bengaluru-only holiday does not affect someone in Mumbai.
- The calendar is **entered by the HOD** (the system cannot know moving festival dates). Fixed-date holidays (26 Jan, 15 Aug, 2 Oct, 25 Dec) are pre-loaded.
- The HOD can **bulk import** a CSV (`date,name,location`). The list is checked line by line first; if any line is wrong, **nothing is saved** (all or nothing). Day-first dates (`02/10/2026`) are read correctly.
- A request keeps the day count it had when filed.

### 4.9 Yearly allowance

**30 days a year** by default. The HOD changes the default, sets one person's number, or imports a CSV (`email,allowance,year`, plus a `default` line). Used days are approved days; waiting requests are set aside; rejecting, cancelling or editing gives days back. A request bigger than what is left is stopped with a message that says how many are left.

### 4.10 Notifications

In-app notices (the bell) when a request is filed, passed on, approved, rejected, questioned, answered, cancelled or rerouted. Email is optional and only if Mailgun is configured, the person has not turned it off, **and the address is real**: `.demo`, `.test`, `.example`, `.invalid`, `.local` and `example.com/.org/.net` are **never emailed**, so demo accounts cost no quota.

### 4.11 Accounts

- **Sign-up** creates an employee with no manager. The HOD chooses their manager (and location) before they can apply.
- **Email confirmation** and **forgot/reset password** use one-time links (24 hours and 60 minutes), stored only as hashes, single use. Resetting signs out every other session and clears a lockout. Without Mailgun, sign-up works at once and links print in the server console.
- **Passwords:** 8+ characters with a letter and a number, no common passwords, not containing your name or email.
- Every new person gets an **employee ID** (`AKA-0001`, in order).

### 4.12 The audit log

Every important event is recorded with **who** (name, role), **what**, **when** (timestamp), **which request**, **status before and after**, a detail, and the **IP**: sign-ins (and failures), submissions, decisions, document opens, holiday and account changes, exports, refused access. It is **append-only** at the model level: updates and deletes are blocked in code (`models/AuditLog.js`), so there is no screen or API to change an entry. Only the HOD can read it.

---

## Part 5. Security in plain words

| Measure | What it does | Where |
|---|---|---|
| bcrypt password hashing | Passwords are stored as one-way hashes (cost 10) | `models`, `routes/auth.js` |
| JWT access token (15 min) | Proves who you are; carries only the user id | `middleware/auth.js` |
| Rotating refresh token (7 days) | Renews the session; each is single use; reusing an old one signs everything out | `middleware/auth.js`, `models/RefreshToken.js` |
| httpOnly + SameSite cookies | Page scripts cannot read the tokens (limits XSS damage) | `middleware/auth.js` |
| CSRF header `X-Requested-With: lms` | A foreign site cannot make your browser perform writes | `middleware/auth.js` |
| Account lockout | 5 wrong passwords lock the account for 15 minutes | `routes/auth.js` |
| Rate limiting | Slows brute force and abuse; sign-in and email endpoints have stricter limits | `middleware/security.js` |
| Helmet + CSP | Security headers; scripts and styles only from the same origin | `middleware/security.js` |
| CORS allow-list | Only listed browser origins may call the API | `middleware/security.js` |
| NoSQL-injection guard | Rejects keys containing `$` or `.` anywhere in body or query | `middleware/security.js` |
| Zod validation (shared) | Same rules in browser and server; the server never trusts the browser | `shared/src/index.js` |
| Ownership checks | You cannot read another person's request by changing the id (404) | `services/leaveService.js` |
| Upload hardening | Type checked from the file's real bytes (not its name), size and count limits, random storage name, **not served as static files**, downloaded only through an access-checked, audited endpoint | `storage/index.js`, `leaveService.js` |
| Operator-safe CSV export | Cells starting `= + - @` are neutralised so a spreadsheet cannot run them | `leaveService.js` |
| Secrets in environment | JWT secret, database URL, mail key come from `.env` / host variables; the app refuses to start in production without `JWT_SECRET` | `config.js`, `index.js` |

---

## Part 6. Data (MongoDB collections)

| Collection | Holds |
|---|---|
| `users` | name, email, password hash, role, manager, location, employee ID, verification and notification settings |
| `leaverequests` | dates, charged days, days in a row, status, reason, flags (long, emergency, split, on behalf of), `documents[]`, `timeline[]` (every action with actor, time and comment), version |
| `auditlogs` | the append-only event record |
| `holidays`, `locations` | the calendar and the places |
| `allowances`, `settings` | per-person yearly allowances, and the default |
| `notifications` | in-app notices (self-delete after 90 days) |
| `refreshtokens`, `authtokens` | session renewal and one-time email links (hashes only) |
| `counters` | the next employee ID |

Comments live in the request's `timeline[]` (each entry has `comment`). Documents are saved as files under `DATA_DIR/uploads` with random names; the request stores the metadata.

---

## Part 7. Where to find things in the code (for "show me")

| Ask | Open |
|---|---|
| The MongoDB schema | `server/src/models/LeaveRequest.js` (and the other files in `models/`) |
| The API that submits leave | `server/src/routes/leaves.js` (`POST /`) → `createLeave` in `server/src/services/leaveService.js` |
| The 3-day rule | `shared/src/index.js`: `LONG_LEAVE_THRESHOLD_DAYS`, `isLongLeave`, `absenceDays`, `consecutiveChain` |
| Total leave days | `shared/src/index.js`: `leaveBreakdown`, `countLeaveDays` |
| Document check | `shared/src/index.js` `documentRequirementError`; enforced in `createLeave`; file type in `storage/index.js` `sniffMime` |
| Manager and HOD approval | `server/src/routes/leaves.js` (`decision('/:id/approve', ...)`) → `transition` → `applyAction` in `server/src/workflow.js` |
| Role and ownership checks | `workflow.js` `actorPermits`; `middleware/auth.js` `requireAuth`; `leaveService.js` `canView`, `visibilityFilter` |
| Where comments are stored | `timeline[]` in the leave request document |
| Where documents are stored | `server/src/storage/index.js` (files in `data/uploads`) |
| Audit log | `server/src/models/AuditLog.js`, `services/auditService.js`, `routes/audit.js` |
| Error handling | `server/src/errors.js`, and `errorHandler` in `server/src/app.js` (client side: `components.jsx` `ErrorBox`, `ErrorScreen`) |
| How React fetches data | `client/src/api.js` (one `request()` function; adds the CSRF header and refreshes the session on 401) |
| Start the app | `scripts/run.cmd` or `npm run setup` then `npm start`; development: `npm run dev` |
| Seed demo users | `server/src/seed.js` (runs automatically on first start) |
| Demo credentials | email `<name>@akasa.demo`, password constant `DEMO_PASSWORD` in `server/src/seed.js` (the sign-in page logs in with one click) |
| Run the tests | `npm test` (everything), `npm run check` (lint + format + tests) |

---

## Part 8. Features

### 8.1 What the assignment asked for, and where it stands

| Requirement | Status |
|---|---|
| Employee: submit leave | Done |
| Employee: view submitted requests, check status | Done |
| Manager: view pending requests | Done (their own team's queue) |
| Manager: approve, reject, add comments | Done (a reason is mandatory to reject) |
| More than 3 consecutive days: ask for documents, Manager then HOD | Done, strictly (including split requests) |
| Manager: view documents | Done (opens in a new tab, access-checked, logged) |
| Manager: ask for more information | Done (employee replies; returns to the same stage) |
| Fields: employeeName, fromDate, toDate, reason | Done |
| Executable and README | Done: one-command launchers plus Docker; README explains both |
| Plus: audit logs | Done |
| Plus: friendly errors | Done (every error has a message and a hint) |
| Plus: colour coding | Done (status colour plus icon plus word) |
| Plus: responsive | Done (mobile-first layout; see testing notes) |

### 8.2 Extra features (beyond the assignment)

Keep this list separate in your head: these are **additions**, not requirements.

1. Emergency leave rules (documents can follow, with blocking).
2. Anti-split detection ("in a row" across separate requests) with a flag for approvers.
3. Public holidays, per-location calendars, bulk CSV import, HOD-managed.
4. Team calendar (month view, who is away).
5. Home overview with live numbers (what is waiting, oldest request, who is away).
6. Leave allowance (30 days) with HOD controls and CSV import; balance shown everywhere.
7. Notifications (bell, unread count) and optional email that never goes to demo addresses.
8. Sign-up, email confirmation, forgot and reset password, change password.
9. Profile with employee ID and role details.
10. Manager-away routing to the HOD "on behalf of" the manager.
11. Overlap warning for approvers ("2 of 3 teammates are away").
12. CSV export of requests (role-filtered, formula-safe, audited).
13. Leave-by-month report with a chart and an accessible table.
14. API documentation page (`/api/docs`, OpenAPI 3) that a test keeps in step with the code.
15. Light and dark themes, three text sizes, keyboard and screen-reader support.
16. A public landing page and a one-click demo sign-in.
17. ESLint (with accessibility rules) and Prettier; Docker setup; Railway deployment.

### 8.4 Future goals

End-to-end browser tests and automated accessibility checks in CI; leave types (sick, casual, paid) with separate quotas and half-day leave; object storage and virus scanning for documents; a manager-chosen delegate with dates; calendar-file export and integrations; an optional AI helper that only summarises (a person always decides); multi-factor and single sign-on; multiple departments and configurable approval chains; official per-state holiday import; installable app and push notifications.

### 8.3 Not built (be honest if asked)

Automated browser (end-to-end) tests, leave types (sick, casual) with separate quotas, half-day leave, an AI assistant, calendar-file (.ics) export, delegation chosen by the manager (replaced by the simpler away-routing), multi-factor sign-in, antivirus scanning of uploads.

---

## Part 9. Viva questions and answers

### Level 1. Easy

**A. Project introduction**

1. **What is an Employee Leave Management System?** A web application where employees request leave, managers and the HOD review it, and everything is tracked with a status and history instead of emails and spreadsheets.
2. **Main objective?** To make asking for, approving and tracking leave clear and consistent, and to enforce the company rule that leave of more than 3 days needs documents and two approvals.
3. **Problem solved?** Requests get lost, nobody knows the status, rules are applied unevenly, and there is no record. Layover gives one place, automatic rule checks, and an audit trail.
4. **Users?** Employees, managers and the head of department (HOD).
5. **Roles?** `EMPLOYEE`, `MANAGER`, `HOD`.
6. **Difference?** Employee asks. Manager decides for their team (first approval). HOD gives the second approval for long leave, sees everything, and manages the calendar, people and audit log.
7. **Employee features?** Apply with live day count, attach documents (when needed), see history and status, reply to questions, edit or cancel, see balance, calendar, notifications, export their requests.
8. **Manager features?** Queue of pending requests, approve, reject with a reason, ask for information, open documents, see team requests and who is away, reports and export.
9. **Why MERN?** One language (JavaScript) across the whole stack, so validation code can be shared between browser and server; MongoDB's documents suit a request that carries its own history; React gives a responsive UI; the stack is widely supported and easy to run.
10. **CRUD?** Create, Read, Update, Delete: the four basic data operations. Here: create a request, read lists and details, update (edit, status changes), and "delete" is done as **cancel** so history is kept.

**B. MERN stack**

11. **MERN?** MongoDB, Express.js, React, Node.js.
12. **MongoDB?** A document database that stores data as JSON-like documents in collections.
13. **Express.js?** A small web framework for Node that handles routes and middleware.
14. **React.js?** A JavaScript library for building user interfaces from components.
15. **Node.js?** A runtime that runs JavaScript on a server.
16. **Frontend vs backend?** Frontend is what runs in the browser (screens). Backend runs on the server (rules, database, security).
17. **API?** A defined way for programs to talk to each other. Here the React app calls the Express API.
18. **REST API?** An API built around resources and HTTP methods: `GET /api/leaves`, `POST /api/leaves/:id/approve`.
19. **JSON?** A text format for structured data, `{ "fromDate": "2026-11-01" }`.
20. **JavaScript vs React?** JavaScript is the language. React is a library written in JavaScript for building UIs.

**C. Application functionality**

21. **How does an employee apply?** Apply page: pick from and to dates, write a reason, attach documents if the leave is long, submit.
22. **Information required?** From date, to date, reason (5 to 500 characters); documents if more than 3 days in a row (unless emergency). The name comes from the signed-in account.
23. **Check status?** "My requests" shows each request with a colour-coded status; the request page shows the full history.
24. **Manager views pending?** "Approval queue": requests waiting for that manager, oldest first (`GET /api/leaves?scope=queue`).
25. **Manager approves?** Short leave becomes `APPROVED`. Long leave moves to `PENDING_HOD`. A history entry, audit entry and notification are created.
26. **Manager rejects?** The request becomes `REJECTED` (final), the reason is saved and shown to the employee, days are returned to the balance.
27. **Why comments on rejection?** The employee deserves an explanation, and it creates a record. The server enforces it, not just the form.
28. **Why document upload?** Long leave needs proof (medical certificate, travel booking) so approvers can decide.
29. **More than 3 days?** The form asks for a document, the server blocks submission without one (unless emergency), and the request needs Manager then HOD.
30. **Purpose of the HOD?** Second approval for long leave, approving managers' own leave, oversight, and administration (holidays, people, allowances, audit).

**D. Basic technical concepts**

31. **Form validation?** Checking input is complete and correct before accepting it.
32. **Client-side validation?** Done in the browser for instant feedback.
33. **Server-side validation?** Done on the server; it is the one that counts because browsers can be bypassed.
34. **PUT vs POST?** POST creates or triggers an action; PUT replaces a resource and is idempotent (repeating gives the same result). Here, POST for actions like approve, PUT for setting an allowance, PATCH for partial edits.
35. **HTTP?** The protocol browsers and servers use to exchange requests and responses.
36. **Status codes?** Three-digit results: 2xx success, 4xx the client did something wrong, 5xx the server failed.
37. **200/400/401/403/404?** 200 OK. 400 bad input. 401 not signed in. 403 signed in but not allowed. 404 not found (we also use it to hide requests you may not see).
38. **Responsive design?** Layout that adapts to screen size (phone, laptop). Here: Tailwind breakpoints, a scrolling tab bar and stacked cards on phones.
39. **Audit log?** A permanent record of who did what and when.
40. **README?** The first file people read: what the project is and how to run it.

### Level 2. Medium

**A. Workflow**

1. **Complete workflow?** File → (manager) → approve → (if long) HOD → approve → `APPROVED`. At any approval point, reject ends it, or ask pauses it until the employee replies. See Part 4.4.
2. **How does it know it is longer than 3 days?** `absenceDays` (first to last day inclusive) is compared with the threshold of 3 in `isLongLeave`, after adding touching requests.
3. **Consecutive days?** Count calendar days from start to end inclusive; join requests that touch (gaps of only Sundays/holidays). Charged days are counted separately and skip Sundays and holidays.
4. **Why both dates?** A one-day leave starts and ends on the same date; counting only the difference would give zero.
5. **Exactly 3 days?** Not long: manager only, no documents.
6. **4 days?** Long: document required, Manager then HOD.
7. **Why documents above 3 days?** Longer absence has bigger impact; proof supports the decision and is the stated policy.
8. **Why two levels?** Control: long absences need senior sign-off, and one person alone cannot approve large leave.
9. **Manager approves, HOD rejects?** Final `REJECTED`. Both actions stay in the history, the employee is notified with the HOD's reason, days return to the balance.
10. **Employee approves own leave?** No. `actorPermits` blocks anyone acting on their own request; a conflict of interest otherwise.
11. **Manager asks for information?** Status becomes `INFO_REQUESTED`, the stage that asked is remembered, the employee is notified.
12. **How does the employee respond?** The request page shows a reply box (text and/or documents).
13. **After reply?** The request goes back to the **same stage** that asked, and that approver is notified.
14. **Edit approved leave?** No. Editing is only allowed before anyone approves. Approved leave that has not started can be cancelled and re-filed.
15. **Overlap prevention?** `assertNoOverlap` looks for the same person's active requests with `fromDate <= newTo` and `toDate >= newFrom`; if found, 409 `OVERLAPPING_LEAVE`.

**B. State and database**

16. **State machine?** A fixed list of states and the only moves allowed between them. In `server/src/workflow.js`.
17. **Statuses?** `PENDING_MANAGER`, `PENDING_HOD`, `INFO_REQUESTED`, `APPROVED`, `REJECTED`, `CANCELLED`.
18. **PENDING_MANAGER?** Waiting for the employee's manager.
19. **PENDING_HOD?** Waiting for the HOD: second approval, a manager's own leave, or a manager who is away.
20. **INFO_REQUESTED?** An approver asked a question; waiting for the employee.
21. **APPROVED vs REJECTED?** Both final. Approved: leave is granted and counts against the balance. Rejected: refused with a reason, balance unaffected.
22. **How stored?** One document per request in the `leaverequests` collection, with embedded `documents[]` and `timeline[]`.
23. **Collection?** A group of documents, like a table.
24. **Document?** One record, like a row, stored as JSON/BSON.
25. **Mongoose schema?** A description of a collection's fields, types and rules, enforced by Mongoose.
26. **Why Mongoose?** Schemas, validation, indexes, middleware and a friendly query API on top of the MongoDB driver.
27. **Connect Node to MongoDB?** `mongoose.connect(MONGODB_URI)` in `server/src/db.js`; with no URI, an embedded MongoDB is started for local use.
28. **ObjectId?** MongoDB's unique 12-byte id for each document.
29. **Employee's history?** `LeaveRequest.find({ employeeId })`, sorted and paginated (`scope=mine`).
30. **Pending for a manager?** `{ status: 'PENDING_MANAGER', managerId: <manager> }` (scope `queue`).

**C. React and backend**

31. **Components?** Reusable pieces of UI, each a function returning markup.
32. **useState?** Holds a value that changes over time (form fields, loaded data) and re-renders on change.
33. **useEffect?** Runs side effects such as loading data when a screen appears.
34. **Axios?** A popular HTTP client. This project does **not** use it: it uses the browser's built-in `fetch`, wrapped in `client/src/api.js`.
35. **React talks to Express?** `fetch('/api/...')` with cookies; in development Vite proxies `/api` to the server.
36. **Middleware?** Functions that run before a route (logging, security, auth).
37. **Routing in Express?** Mapping an HTTP method and path to a handler: `leavesRouter.post('/', ...)`.
38. **Authentication vs authorization?** Authentication: who are you. Authorization: what may you do.
39. **RBAC?** Permissions depend on role (employee, manager, HOD), plus ownership.
40. **Why validate both sides?** The browser gives fast feedback; the server protects the data from anything, including scripts and tampered requests.

**D. Validation and errors**

41. **End date before start?** The shared schema returns "End date is before the start date" on the `toDate` field; the server returns 400 with that field message.
42. **Date validation?** Real calendar date (rejects 31 Feb), format `YYYY-MM-DD`, not in the past, within one year, at most 60 days.
43. **Reason not empty?** Zod: trimmed, at least 5 and at most 500 characters.
44. **Validate uploads?** Count, size, and the real file type from its first bytes.
45. **Why limit size?** Protects storage and server memory and prevents abuse.
46. **Why limit types?** Blocks executables and scripts; only PDF, JPG, PNG are accepted.
47. **Unsupported file?** A friendly message under the upload box and a 400 from the server.
48. **Friendly error message?** Plain words that say what happened and what to do next, with no codes or stack traces.
49. **401 vs 403?** 401: not signed in or session ended. 403: signed in but not allowed.
50. **Audit trail?** The ordered record of actions; useful for accountability, investigation and proof.

### Level 3. Hard

**A. Scenarios**

1. **5 days, no document?** The form blocks it with a message; if the browser is bypassed, `createLeave` runs `documentRequirementError` and returns 400 with `fields.documents`.
2. **Document attached, manager rejects?** The request becomes `REJECTED`. The document stays stored and listed; the timeline keeps the reason, who and when. Nothing is deleted.
3. **Why not APPROVED straight away for 5 days?** Policy requires a second approval: `applyAction` sends a long request from the manager stage to `PENDING_HOD`.
4. **HOD rejects what the manager approved?** Final `REJECTED`; the manager's approval stays in the history.
5. **How does it remember which stage asked?** The field `infoRequestedFrom` (`MANAGER` or `HOD`) is set when the question is asked and used by the reply to go back.
6. **Documents but no explanation?** A reply needs a message **or** a document; documents alone are accepted (honest answer: the explanation is not forced).
7. **Changing the id in the URL?** `load()` checks `canView`; if you are not the owner, their manager, or the HOD, you get 404 (not even confirmation it exists). Denials are written to the audit log as `ACCESS_DENIED`.
8. **Two approvers at once?** Optimistic concurrency: each save checks the document's version (`__v`). The second save fails with a version error, returned as 409 `STALE_REQUEST` ("Someone else just updated this request"). The client also sends the version it saw.
9. **Manager approving own leave?** Blocked in `actorPermits` (actor equals employee). A manager's leave goes to the HOD anyway.
10. **Manager's leave?** Starts at `PENDING_HOD`; only the HOD can approve it.
11. **HOD applies?** Approved automatically, flagged in the timeline and audit log ("HOD leave is auto-approved and flagged for audit"), because nobody is above them.
12. **Rejected can't be approved?** `statePermits` allows approve only from pending states; otherwise 409 `ILLEGAL_TRANSITION`.

**B. Architecture**

13. **Architecture?** React SPA → Express API (routes → services → Mongoose models) → MongoDB; shared validation package; one Node process serves both API and built UI. Part 2.1.
14. **Request-response cycle?** Part 2.4.
15. **Controller, service, repository?** Controller handles HTTP; service holds business rules; repository hides data access. Here: routes = controllers, services = services, Mongoose models = data access (no separate repository layer, by choice).
16. **Why separate business logic from routes?** Testability, reuse, and so rules are not scattered in HTTP code.
17. **Zod?** A library to declare data shapes and validate them, with friendly messages.
18. **Share schema between frontend and backend?** It lives in the `shared` workspace package and both import it.
19. **Optimistic locking?** Assume conflicts are rare; each document has a version, and a save fails if it changed since you read it.
20. **Version field?** `__v`, bumped on each save; `optimisticConcurrency: true` makes Mongoose compare it.
21. **Atomic updates?** MongoDB updates on one document are atomic; counters use `findOneAndUpdate` with `$inc`; request saves are versioned.
22. **Transaction?** A group of operations that all succeed or all fail (needs a replica set).
23. **Where would we use one?** Saving a request together with its audit entry, so they cannot get out of step. Not used now: the audit write is best-effort so a logging problem cannot block a person's action.
24. **Index?** A structure that makes lookups fast. We index user email (unique), request owner, manager and status, holiday (date, location) unique, audit action.
25. **Improve history query?** Compound index on owner and date, projections, pagination (already paginated).
26. **Pagination?** Returning results in pages (`page`, `pageSize` up to 50) so lists stay fast.
27. **Soft deletion?** Marking something cancelled instead of erasing it. We never delete requests; cancelling keeps the record for audit.
28. **Consistency between requests and audit?** The route writes the audit entry right after the service call succeeds; the request's own `timeline[]` is saved atomically with the request, so history survives even if an audit write fails.

**C. Security**

29. **JWT?** A signed token proving identity.
30. **Inside the JWT?** Only the user id (`sub`) and expiry. Role and permissions are read fresh from the database on each request.
31. **Why hash passwords?** So a database leak does not reveal passwords.
32. **bcrypt?** A slow, salted hashing algorithm designed for passwords.
33. **Hashing vs encryption?** Hashing is one-way; encryption can be reversed with a key.
34. **Refresh token?** A long-lived secret used to get new short-lived access tokens; here it rotates on each use.
35. **httpOnly cookie?** The browser sends it but scripts cannot read it, so XSS cannot steal it.
36. **CORS?** Browser rule controlling which websites may call an API; we allow only listed origins.
37. **Helmet?** Middleware that sets protective HTTP headers, including the Content-Security-Policy.
38. **Rate limiting?** Limiting how many requests a client can make in a time window.
39. **NoSQL injection?** Sending query operators like `{"$ne": ""}` in input to alter a database query. We reject keys containing `$` or `.`.
40. **Protect documents?** Stored outside any public folder under random names; downloaded only via an endpoint that checks you may see the request, and every open is audited.
41. **Why no public URLs?** Anyone with the link could read confidential files.
42. **MIME validation?** Checking the file's real type. We read the first bytes (magic numbers) instead of trusting the browser's claim.
43. **Why not extension only?** A file named `.pdf` can contain anything.
44. **XSS?** Injecting a script that runs in another user's browser. React escapes output by default, CSP blocks inline and foreign scripts, tokens are httpOnly.
45. **IDOR?** Reading someone else's record by guessing its id. Prevented by ownership checks on every request, with 404 on failure.

**D. Audit and reliability**

46. **What should an audit entry contain?** Who, role, action, target, before/after status, detail, timestamp, IP.
47. **Why append-only?** So history cannot be rewritten; code blocks updates and deletes on the model.
48. **Who approved or rejected?** The request `timeline[]` and the audit log record the actor's name, role and time.
49. **Why timestamps?** To reconstruct the order of events and prove when something happened.
50. **Unauthorized attempts?** Audit actions `ACCESS_DENIED`, `LOGIN_FAILED` and `LOGIN_BLOCKED`; the HOD can filter for them.
51. **MongoDB unavailable?** Requests fail after Mongoose's wait; the user sees "Something went wrong on our side. Please try again in a moment." `/health` reports `db: down`. If the whole server is down, the app shows "You seem to be offline / We could not reach the server".
52. **Graceful shutdown?** On `SIGTERM`/`SIGINT` the server stops accepting connections, finishes in-flight requests and closes the database before exiting (`server/src/index.js`).
53. **Health endpoint?** `GET /health` returns `{ status, db }` so hosts and monitors can check the app is alive.
54. **Why environment variables?** Configuration and secrets differ per environment and must not live in code.
55. **Why not hard-code credentials?** They would leak through source control and could not be changed per environment.

### Level 4. Practical viva

| Scenario | Answer |
|---|---|
| Leave for 3 days | No HOD approval; manager only. Not long (3 is not more than 3). |
| Leave for 4 days, no document | Blocked in the form and by the server (400 "needs a supporting document"). Unless it is an emergency, then it can be filed and documents owed. |
| From date after To date | Field error "End date is before the start date" in the browser and 400 from the server. |
| Same dates twice | 409 `OVERLAPPING_LEAVE`: "These dates overlap with your leave from ... to ...". |
| Manager rejects with no comment | Refused: "Please explain why the request is rejected." (400, enforced on the server). |
| HOD rejects manager-approved long leave | Final `REJECTED`; both decisions stay in the history; the employee is told why. |
| Another employee downloads someone's document | No. The download endpoint checks the same visibility as the request; non-owners get 404 and an `ACCESS_DENIED` audit entry. |
| Employee opens the manager dashboard | Nav items and routes are not shown; calling the API gives 403 "Only managers and the HOD have an approval queue". |
| How does an info request return to the right stage | `infoRequestedFrom` stores MANAGER or HOD; the reply moves the request back to that stage. |
| Two approvers click at once | One succeeds; the other gets 409 `STALE_REQUEST` (version check) and the page reloads the latest state. |
| MongoDB disconnected | Friendly "something went wrong" message, `/health` shows `db: down`; no stack trace. |
| How the HOD sees who did each action | Audit log page (HOD only): actor, role, action, request, before/after status, time, IP; filter and search. |

### Level 5. Show me in the code

1. **MongoDB schema:** `server/src/models/LeaveRequest.js` (also `User.js`, `AuditLog.js`).
2. **Submit API:** `server/src/routes/leaves.js` → `createLeave` in `server/src/services/leaveService.js`.
3. **Three-day validation:** `shared/src/index.js` (`isLongLeave`, `absenceDays`, `consecutiveChain`), applied in `createLeave`.
4. **Total leave days:** `shared/src/index.js` `leaveBreakdown` / `countLeaveDays`.
5. **Document check:** `documentRequirementError` (shared) and `assertDocumentsAllowed` plus `prepareFiles` in `leaveService.js`; file type in `storage/index.js`.
6. **Manager approval API:** `server/src/routes/leaves.js` `decision('/:id/approve', 'APPROVE', ...)`; logic in `transition` and `workflow.js`.
7. **HOD approval API:** the same endpoint; `actorPermits` decides it is the HOD's turn when status is `PENDING_HOD`.
8. **Role check:** `workflow.js` `actorPermits`; `middleware/auth.js` `requireAuth`; role-limited routes use `onlyHod` helpers.
9. **Prevent viewing others' requests:** `canView` and `visibilityFilter` in `leaveService.js`.
10. **Comments:** the `timeline[]` array in the request document.
11. **Documents:** files under `data/uploads` via `storage/index.js`; metadata in `documents[]`.
12. **Audit log:** `models/AuditLog.js` (append-only), `services/auditService.js`, `routes/audit.js`, `client/src/pages/AuditPage.jsx`.
13. **Error handling:** `server/src/errors.js`, `errorHandler` in `server/src/app.js`, `client/src/components.jsx`.
14. **React fetching:** `client/src/api.js`, used inside pages with `useEffect`.
15. **Start the app:** `scripts/run.cmd` / `scripts/run.sh`, or `npm run setup && npm start`; dev: `npm run dev` (open port 5173).
16. **Seed demo users:** `server/src/seed.js` (called from `server/src/index.js` on first start when the database is empty).
17. **Demo credentials:** `DEMO_PASSWORD` and `DEMO_USERS` in `server/src/seed.js`; the one-click buttons in `client/src/landing/DemoPicker.jsx` and `LoginPage.jsx`.
18. **Testing:** `npm test` runs shared, server (API, security, workflow, accounts, allowances, extras, docs) and client tests; see `docs/operations/TESTING.md`.
19. **If the backend is stopped:** the app shows "You seem to be offline / We could not reach the server" with a retry hint; nothing crashes.
20. **AI use and verification:** see Part 11.

---

## Part 10. Cheat sheet (the ten things to remember)

1. **More than 3 days in a row** = document + Manager then HOD. 3 days exactly is short.
2. "In a row" counts **calendar days first to last**; **charged** days skip Sundays and holidays.
3. Splitting a long leave into pieces is **detected**, flagged, and treated as long.
4. One **state machine** (`workflow.js`) decides every legal move; wrong move = 409, wrong person = 403.
5. Info requests **return to the stage that asked**.
6. Two people clicking at once: **version check**, second gets 409.
7. Someone else's request: **404**, and it is logged.
8. Documents: real type check, private storage, access-checked and logged downloads.
9. Audit log is **append-only** and HOD-only.
10. Same **shared Zod rules** run in the browser and on the server.

---

## Part 11. AI usage, said honestly

- The code was written by AI coding agents (Claude, including several parallel sub-agents), steered by a written build prompt and by decisions the developer made in chat (plain JavaScript, emergency leave, holidays by location, 30-day allowance, the "in a row" rule, the manager-away shortcut, the look of the site).
- One developer worked alone on this, with AI tools as the only help; there was no team.
- It was **verified** by automated tests (unit, API integration, security, component), linting and formatting checks, and by running the app in a browser. Not every line was read by a human; say that plainly.
- Mistakes the AI made and how they were found are listed in `docs/project/AI_USAGE.md` (for example, a database index clash that would have crashed deployment, found from the dev log; a missing import found by the linter).
- No GPT/Codex models were used.
- If asked "how do you verify generated code": tests after every change, `npm run check`, reading the logs, trying the real flows, and checking every rule against the assignment text.

---

## Part 12. Known limitations (so nothing surprises you)

- **Uploads are saved on local disk.** On Railway the disk is wiped on redeploy unless a volume is attached. Fine for a demo; for real use switch to object storage.
- Uploaded files are not virus-scanned.
- Rate-limit counters live in memory (per process).
- No multi-factor sign-in.
- The holiday calendar depends on the HOD entering moving festival dates.
- Demo sign-in buttons are public on the landing page. For real use, set `SEED=false` and remove them.
- No end-to-end browser test suite; the UI was tested by component tests and manual checks.
- Emergency leave allows more than 3 days with no documents (by your decision); documents are then owed and two owing blocks new leave.
- A manager's own leave goes to the HOD alone, and the HOD's own leave is auto-approved and flagged.
- Photos are illustrated faces generated from the name, not real photographs.

---

## Part 13. Packaging the submission (zip)

**Run `npm run package`.** It creates `layover-submission.zip` in the project root from the files **committed to git**, so it automatically leaves out everything that must not ship:

| Not in the zip | Why |
|---|---|
| `node_modules/` | Large, rebuilt by `npm install` |
| `client/dist/` | Rebuilt by `npm run setup` |
| `data/` | Local database files and uploaded documents |
| `.env` | **Secrets** (database password, mail key). Never submit it |
| `*.log` | Local logs |
| `.git/` | Not needed (add it yourself only if the assessors want the history) |

Commit first (`git status` should be clean), then package. Before sending, open the zip and confirm there is **no `.env`** in it. The README explains how to run from the zip: install Node 20.12+, then `scripts\run.cmd` (Windows) or `sh scripts/run.sh`.
