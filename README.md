# Layover: Employee Leave Management System

Employees ask for leave. Managers approve, reject or ask for more information. For leave of **more than 3 days in a row**, the system requires a supporting document and **two approvals: the Manager, then the HOD**.

Built by one developer, alone, as an individual placement hackathon project from a problem statement: a MERN application in plain JavaScript. Not affiliated with Akasa Air.

**In this README:** [System design](#system-design) · [Tools and tech](#tools-and-tech) · [How to run](#how-to-run) · [Features](#features) · [Future goals](#future-goals) · [Demo accounts](#demo-accounts) · [Rules and assumptions](#rules-and-assumptions) · [Documentation](#documentation) · [Known limitations](#known-limitations)

New to the project? Read **[MASTER_GUIDE.md](MASTER_GUIDE.md)**. It explains how everything works and why, lists every feature, and answers the likely viva questions.

---

## System design

```
 Browser (React app built by Vite)
    |  fetch() + httpOnly cookies, JSON / multipart uploads
    v
 Express API (Node.js)
    |  middleware: request id, Helmet/CSP, JSON parser, CORS allow-list, rate limit, NoSQL-key guard, auth
    |  routes (HTTP only)  ->  services (business rules)  ->  Mongoose models
    v
 MongoDB (Atlas in production, embedded MongoDB for local runs)

 shared/  validation and day-counting rules imported by BOTH the browser and the server
```

- **One process, one port.** Express serves the API and the built React files, so hosting is a single service (Railway or Docker).
- **Layers.** Routes only handle HTTP. Services hold the business rules, so they can be tested and are not scattered. Models describe the data.
- **One state machine** (`server/src/workflow.js`) decides every legal status change. Anything else is refused with a friendly 409 (illegal move) or 403 (wrong person).
- **Shared rules.** The same Zod schemas and counting code run in the browser (instant feedback) and on the server (cannot be bypassed).
- **Sessions.** A 15-minute JWT and a rotating 7-day refresh token, both in httpOnly cookies, with a CSRF header on writes.
- **Documents** are stored on disk under random names and are only served through an endpoint that checks who may see the request and logs every open.

**Request lifecycle**

```
 file --> PENDING_MANAGER --approve (3 days or fewer)-----------------> APPROVED
              |   \-approve (more than 3 days)--> PENDING_HOD --approve--> APPROVED
              +-reject--> REJECTED                   \-reject--> REJECTED
              \-ask-----> INFO_REQUESTED --employee replies--> back to the SAME stage
 (a request can be CANCELLED by its owner while open)
```

**Data (MongoDB collections):** `users`, `leaverequests` (each carries its own `documents[]` and `timeline[]`), `auditlogs` (append-only), `holidays`, `locations`, `allowances`, `settings`, `notifications`, `refreshtokens`, `authtokens`, `counters`.

More detail: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) and [docs/architecture/WORKFLOW.md](docs/architecture/WORKFLOW.md).

---

## Tools and tech

| Area | What is used |
|---|---|
| Language | JavaScript (ES modules), no TypeScript |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, shadcn/ui-style components (Radix primitives), Lucide icons, GSAP (landing page motion) |
| Backend | Node.js 20.12+, Express 5, Mongoose 8 |
| Database | MongoDB (Atlas hosted, or an embedded MongoDB via `mongodb-memory-server` for local runs) |
| Validation | Zod, shared between client and server |
| Security | bcryptjs, jsonwebtoken, Helmet (CSP), express-rate-limit, multer (uploads), CORS allow-list |
| Email | Mailgun HTTP API (optional) |
| API docs | OpenAPI 3 with Swagger UI at `/api/docs` |
| Testing | Vitest, Supertest, Testing Library, in-memory MongoDB |
| Quality | ESLint (React hooks and accessibility rules), Prettier |
| Packaging and hosting | npm workspaces, Docker and docker-compose, Railway |
| Built with | AI coding agents (Claude), see [docs/project/AI_USAGE.md](docs/project/AI_USAGE.md) |

---

## How to run

### Already hosted

The app is live at **https://akasa.adarsh.run/**. Open it and click any person on the sign-in page to try it (no sign-up needed). To run it yourself instead, use one of the options below.

### Run it yourself

**Prerequisite:** Node.js 20.12 or newer (tested on Node 24). Docker is optional.

### Option 1: no Docker
One command that installs, builds and starts everything:

```
scripts\run.cmd          (Windows)
sh scripts/run.sh        (macOS / Linux)
```

Or step by step:

```
npm run setup
npm start
```

Open http://localhost:4000. On Windows PowerShell, if it says running scripts is disabled, use `npm.cmd run setup` and `npm.cmd start`, or run them in Command Prompt.

**Database.** To use your own MongoDB (for example Atlas), copy `.env.example` to `.env` and set `MONGODB_URI`. If it is not set, an embedded MongoDB starts automatically and keeps its data in `./data` (the first run downloads the MongoDB binary, so it needs internet once). Demo data is created on first start.

### Option 2: Docker
```
docker compose up --build
```
Open http://localhost:4000. This starts MongoDB (single-node replica set) and the app, and seeds demo data.

### Development
`npm run dev` runs the API (port 4000, restarts itself when server or shared code changes) and Vite (port 5173, hot-reloads as you edit). **While developing, open http://localhost:5173**, not 4000: port 4000 serves the last production build.

### Tests, lint, docs
- `npm test` runs every test. `npm run check` runs lint, the format check and all tests.
- `npm run lint`, `npm run lint:fix`, `npm run format`, `npm run format:check`.
- API documentation: http://localhost:4000/api/docs (OpenAPI file at `/api/docs.json`).
- `npm run package` builds the submission zip (see [MASTER_GUIDE.md](MASTER_GUIDE.md), Part 13).

### Hosting
See [docs/operations/DEPLOYMENT.md](docs/operations/DEPLOYMENT.md) for Railway: required variables (`MONGODB_URI`, `JWT_SECRET`), optional email variables, and a smoke-test checklist.

---

## Features

### A. Required by the problem statement

| Requirement | How it is met |
|---|---|
| Employee submits leave (name, from date, to date, reason) | Apply page; the name comes from the signed-in account; validation in browser and server |
| Employee views submitted requests and checks status | "My requests" with colour-coded status, filters, and a full history on each request |
| Manager views all pending requests | Approval queue for their team, oldest first |
| Manager approves or rejects with comments | Comment box; a reason is mandatory when rejecting |
| **More than 3 consecutive days: ask for documents and two approvals (Manager, then HOD)** | Enforced in the browser and the server; the document is mandatory, the request moves Manager then HOD; split-up requests are caught |
| Employee attaches documents | PDF, JPG or PNG, up to 5 files of 5 MB; type verified from the file's contents |
| Manager views documents | Opens from the request page; access-checked and logged |
| Manager asks for more information | Employee gets a notice and replies; the request returns to the stage that asked |
| Executable and README | `scripts/run.cmd` / `run.sh`, Docker, and this README |

### B. Plus points from the problem statement

| Plus point | How it is met |
|---|---|
| Audit logs | Append-only record of sign-ins, submissions, decisions, document opens, holiday and account changes, exports and refused access; HOD-only page with filters and search |
| Friendly error messages | Every error has a plain message and a hint ("what to do next"); no codes or stack traces; dedicated screens for no access, not found and offline |
| Colour coding | Status colours (amber, blue, purple, green, red, grey) always paired with an icon and a word; badges for long, emergency and flagged leave |
| Responsive web / mobile | Mobile-first layout, scrolling tab bar and stacked cards on phones, 44px touch targets, light and dark themes, three text sizes |

### C. Added on top (not asked for)

1. **Strict "in a row" counting and anti-split detection.** Separate requests that touch (even across a Sunday or holiday) are added up; the later one is treated as long leave and flagged to approvers.
2. **Emergency leave.** Over 3 days can be filed without documents; the documents are owed. Two outstanding block all new leave.
3. **Public holidays and Sundays are never charged.** Holidays are national or per location; the HOD edits them, or bulk-imports a CSV (checked line by line, all or nothing).
4. **Locations.** Each person works from a location so local holidays apply to the right people.
5. **Yearly leave allowance** (30 days by default). The HOD changes the default, sets one person's allowance, or imports a CSV. Requests larger than the balance are stopped.
6. **Notifications.** In-app bell with unread count; optional email that is never sent to demo or test addresses.
7. **Accounts.** Sign-up, email confirmation, forgot and reset password, change password, employee IDs, a profile page.
8. **Manager away.** If a manager is on leave, their team's requests for those days go to the HOD, who answers on the manager's behalf (stated everywhere it shows).
9. **Overlap warning** for approvers: "2 of 3 teammates are away on those days".
10. **Team calendar**, **home overview** with live numbers, and a **leave-by-month report** with an accessible chart.
11. **CSV export** of requests, limited to what the person may see and safe to open in a spreadsheet.
12. **API documentation page** (OpenAPI) that a test keeps in step with the code.
13. **Public landing page** and one-click demo sign-in.
14. **Tooling:** ESLint with accessibility rules, Prettier, Docker, Railway deployment guide, a large automated test suite.

---

## Future goals

- Automated browser (end-to-end) tests and an automated accessibility audit in CI.
- Leave types (sick, casual, paid) with their own quotas, and half-day leave.
- Object storage (for example S3) for documents, with virus scanning.
- A manager-chosen delegate with start and end dates, as an alternative to automatic routing to the HOD.
- Calendar-file (.ics) export and calendar integrations.
- Optional AI helper that summarises a long request for the approver and flags a missing document. It would only assist; a person always decides.
- Multi-factor sign-in, and single sign-on with the company's identity provider.
- Multiple departments with more than one HOD, and configurable approval chains.
- Public-holiday import from an official source per state.
- Progressive web app (installable) and push notifications.

---

## Demo accounts

On the sign-in page, click any name to sign in with one click (no typing).

| Role | Email |
|---|---|
| HOD | priya.nair@akasa.demo |
| Manager (team: Arjun, Kavya, Rohan) | rahul.mehta@akasa.demo |
| Manager (team: Sneha, Imran, Meera) | ananya.iyer@akasa.demo |
| Employee | arjun.sharma@akasa.demo (others: kavya.reddy, rohan.das, sneha.kulkarni, imran.khan, meera.joshi @akasa.demo) |

The shared demo password is defined in `server/src/seed.js`. Seed data has requests in every status, including long leave waiting at each stage with documents, and an emergency leave with documents still owed. To see both sides of an approval: sign in as Arjun, file a request, then sign in as Rahul and answer it.

---

## Rules and assumptions

- **"More than 3 days" means days in a row:** calendar days from the first to the last day, Sundays and holidays in the middle included (Friday to Monday is 4). Exactly 3 is short. Threshold: `LONG_LEAVE_THRESHOLD_DAYS` in `shared/src/index.js`.
- **What is charged** to a person's allowance is different: the same range without Sundays and public holidays (Friday to Monday is 3 charged days).
- **Long leave:** a document is required (blocked in the form and by the API) and approval goes Manager then HOD; either can reject. Short leave: Manager only, and no documents are accepted.
- **Emergency leave:** may exceed 3 days without documents, still needs both approvals. Documents are due the working day after it ends, or before the next leave. One owing allows only one more emergency; two owing block everything.
- A manager's own leave goes to the HOD. HOD leave is approved automatically and flagged. Nobody can decide on their own request. Managers only see their own team.
- Employees may cancel while open, or approved leave that has not started. Editing is only allowed before any approval.
- Leave cannot start in the past or more than 365 days ahead; one request spans at most 60 days; overlapping active requests are refused.
- Concurrent decisions are guarded by a version check (the second gets a "someone else just updated this" message).

---

## Documentation

| Topic | File |
|---|---|
| Everything explained, extras list, viva answers | [MASTER_GUIDE.md](MASTER_GUIDE.md) |
| Rules and states in detail | [docs/architecture/WORKFLOW.md](docs/architecture/WORKFLOW.md) |
| Technical overview | [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) |
| Security | [docs/architecture/SECURITY.md](docs/architecture/SECURITY.md) |
| Design and copy voice | [docs/architecture/DESIGN.md](docs/architecture/DESIGN.md) |
| Plain-language terms | [docs/architecture/GLOSSARY.md](docs/architecture/GLOSSARY.md) |
| Endpoints (live version at `/api/docs`) | [docs/api/API.md](docs/api/API.md) |
| Hosting on Railway | [docs/operations/DEPLOYMENT.md](docs/operations/DEPLOYMENT.md) |
| Tests | [docs/operations/TESTING.md](docs/operations/TESTING.md) |
| 5-minute demo script | [docs/operations/DEMO.md](docs/operations/DEMO.md) |
| How AI was used | [docs/project/AI_USAGE.md](docs/project/AI_USAGE.md) |
| What changed | [docs/project/CHANGELOG.md](docs/project/CHANGELOG.md) |

---

## Known limitations

- Uploaded files are stored on local disk (on Railway they are lost on redeploy unless a volume is attached) and are not virus-scanned.
- Demo accounts share one password and the demo buttons are public. For real use, set `SEED=false` and remove them.
- Email only works when Mailgun is configured; without it, sign-up works immediately and links print in the server console.
- No multi-factor sign-in; rate-limit counters are in memory.
- The holiday calendar relies on the HOD entering festival dates that move each year.
- No end-to-end browser test suite yet.
