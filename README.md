# Layover — Employee Leave Management System

A small MERN portal where employees request leave and managers/HODs approve, reject or ask for more information. Leave of more than 3 days in a row needs documents and two approvals (Manager, then HOD), unless it is filed as emergency leave.

**Prerequisite:** Node.js 20.12 or newer (tested on Node 24). Docker is optional.

## Run it

### Option 1 — no Docker (zero external dependencies)
One command that installs, builds and starts everything:
```
scripts
un.cmd        (Windows)
sh scripts/run.sh      (macOS / Linux)
```
Or step by step:
```
npm run setup
npm start
```
On Windows PowerShell, if it says running scripts is disabled, use `npm.cmd run setup` and `npm.cmd start` (or run them in Command Prompt).
Open http://localhost:4000. To use your own MongoDB (e.g. Atlas) put `MONGODB_URI=...` in a `.env` file in the repo root (git-ignored; see `.env.example`; allow your IP in Atlas Network Access). If it is not set, an embedded MongoDB starts automatically (data kept in `./data`; the first run downloads the MongoDB binary, so it needs internet once). Demo data is seeded on first start.

### Option 2 — Docker
```
docker compose up --build
```
Open http://localhost:4000. (Starts MongoDB as a single-node replica set, the app, and seeds demo data.)

### Development
`npm run dev` runs the API (port 4000, restarts by itself when server or shared code changes) and Vite (port 5173, proxies `/api`, hot-reloads the page as you edit client code). **While developing, open http://localhost:5173**, not 4000: port 4000 serves the last production build (`npm run build`) and does not hot-reload.

### API docs, lint and formatting
- **API docs:** `/api/docs` (browsable) and `/api/docs.json` (OpenAPI 3).
- `npm run lint` checks the code (ESLint, with accessibility and React hooks rules for the client); `npm run lint:fix` repairs what it can; `npm run format` / `npm run format:check` use Prettier.

### Tests
`npm test` (unit tests for the day-count/validation rules and the workflow state machine, plus API integration tests).

## Demo accounts
On the sign-in page, click any name to sign in with one click (no typing). Accounts:
| Role | Email |
|---|---|
| HOD | priya.nair@akasa.demo |
| Manager (team: Arjun, Kavya, Rohan) | rahul.mehta@akasa.demo |
| Manager (team: Sneha, Imran, Meera) | ananya.iyer@akasa.demo |
| Employee | arjun.sharma@akasa.demo (others: kavya.reddy, rohan.das, sneha.kulkarni, imran.khan, meera.joshi @akasa.demo) |

(The shared demo password is defined in `server/src/seed.js`.)

Seed data has requests in every status, including long leaves waiting at the manager and HOD stage with documents. Imran has an emergency leave with documents still owed.

## What it does
**Employee:** apply (live day count, document upload), see history and status, edit/cancel before any approval, reply to questions, send documents later for emergency leave.
**Manager:** approval queue for their team, approve / reject / ask for more information with comments, view documents.
**HOD:** second-level queue (sees the manager's comment), all requests.

## Rules and assumptions
- **"More than 3 days" means in a row**: calendar days away from the first to the last day, Sundays and holidays in the middle included (Fri to Mon = 4). Requests that touch each other are added up, so splitting a long leave does not get around it, and the later request is flagged. **What is charged as leave** is different: inclusive days from start to end, **not counting Sundays** (Mon 2 Nov to Fri 6 Nov = 5; Fri 6 Nov to Tue 10 Nov = 4). **Public holidays are not counted either**; the HOD keeps the holiday calendar in the app (`/holidays`). Documents are only accepted for leave over 3 days. Threshold is `LONG_LEAVE_THRESHOLD_DAYS = 3` in `shared/src/index.js`; exactly 3 days is *not* long.
- **More than 3 days:** documents are required (blocked in UI and API) and approval goes Manager → HOD; either can reject, which ends the request. 3 days or fewer: Manager only.
- **Emergency leave** (checkbox): may exceed 3 days without documents, still needs both approvals. Documents are due before the employee returns to work (end date + 1 day) or before their next leave. While one emergency leave is missing documents, only one more *emergency* leave is allowed; normal leave is blocked. With two missing, all new leave is blocked until documents are uploaded.
- A manager's own leave goes straight to the HOD; HOD leave is auto-approved and marked on the timeline.
- Nobody can decide on their own request; managers only see their own team. Concurrent decisions are guarded by a version check.
- Employees may cancel while open, or approved leave that has not started. Editing is allowed only before any approval.
- Leave cannot start in the past (earliest start date is today) and up to 365 days ahead; a request spans at most 60 days; overlapping active requests are refused.
- Documents: PDF/JPG/PNG, max 5 MB, up to 5 per request, type verified from file contents, stored on local disk and served only through an authenticated endpoint.

## Layout
`shared/` validation rules used by client and server · `server/` Express API, Mongoose models, `workflow.js` (state machine), `services/` · `client/` React (Vite, Tailwind, shadcn-style components) UI with a landing page, light/dark theme and text-size control; see DESIGN.md.

## Documentation
[DEPLOYMENT](DEPLOYMENT.md) · [WORKFLOW](WORKFLOW.md) · [API](API.md) · [ARCHITECTURE](ARCHITECTURE.md) · [SECURITY](SECURITY.md) · [TESTING](TESTING.md) · [DEMO script](DEMO.md) · [GLOSSARY](GLOSSARY.md) · [AI_USAGE](AI_USAGE.md) · [CHANGELOG](CHANGELOG.md)

## Known limitations
Demo accounts share one password and one-click demo sign-in is on the login page (remove for real use); no email notifications; no Playwright end-to-end tests or automated accessibility audit yet; no OpenAPI page (see API.md); uploaded files are stored on local disk and not virus-scanned; no password reset or MFA.
