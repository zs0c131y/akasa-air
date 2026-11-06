# Leave Desk — Employee Leave Management System

A small MERN portal where employees request leave and managers/HODs approve, reject or ask for more information. Leave longer than 3 consecutive days needs documents and two approvals (Manager, then HOD), unless it is filed as emergency leave.

**Prerequisite:** Node.js 20.11+ (tested on Node 24). Docker is optional.

## Run it

### Option 1 — no Docker (zero external dependencies)
macOS / Linux / Windows PowerShell:
```
npm run setup
npm start
```
Open http://localhost:4000. If `MONGODB_URI` is not set, an embedded MongoDB starts automatically (data kept in `./data`; the first run downloads the MongoDB binary, so it needs internet once). Demo data is seeded on first start.

### Option 2 — Docker
```
docker compose up --build
```
Open http://localhost:4000. (Starts MongoDB as a single-node replica set, the app, and seeds demo data.)

### Development
`npm run dev` runs the API (port 4000) and Vite (port 5173, proxies `/api`).

### Tests
`npm test` (unit tests for the day-count/validation rules and the workflow state machine, plus API integration tests).

## Demo accounts (password `Password@123` for all)
| Role | Email |
|---|---|
| HOD | priya.nair@akasa.demo |
| Manager (team: Arjun, Kavya, Rohan) | rahul.mehta@akasa.demo |
| Manager (team: Sneha, Imran, Meera) | ananya.iyer@akasa.demo |
| Employee | arjun.sharma@akasa.demo (others: kavya.reddy, rohan.das, sneha.kulkarni, imran.khan, meera.joshi @akasa.demo) |

Seed data has requests in every status, including long leaves waiting at the manager and HOD stage with documents. Imran has an emergency leave with documents still owed.

## What it does
**Employee:** apply (live day count, document upload), see history and status, edit/cancel before any approval, reply to questions, send documents later for emergency leave.
**Manager:** approval queue for their team, approve / reject / ask for more information with comments, view documents.
**HOD:** second-level queue (sees the manager's comment), all requests.

## Rules and assumptions
- **Consecutive days** = inclusive calendar days from start to end (1 Nov to 5 Nov = 5). Threshold is `LONG_LEAVE_THRESHOLD_DAYS = 3` in `shared/src/index.js`; exactly 3 days is *not* long.
- **More than 3 days:** documents are required (blocked in UI and API) and approval goes Manager → HOD; either can reject, which ends the request. 3 days or fewer: Manager only.
- **Emergency leave** (checkbox): may exceed 3 days without documents, still needs both approvals. Documents are due before the employee returns to work (end date + 1 day) or before their next leave. While one emergency leave is missing documents, only one more *emergency* leave is allowed; normal leave is blocked. With two missing, all new leave is blocked until documents are uploaded.
- A manager's own leave goes straight to the HOD; HOD leave is auto-approved and marked on the timeline.
- Nobody can decide on their own request; managers only see their own team. Concurrent decisions are guarded by a version check.
- Employees may cancel while open, or approved leave that has not started. Editing is allowed only before any approval.
- Dates may be up to 30 days in the past and 365 days ahead; a request spans at most 60 days; overlapping active requests are refused.
- Documents: PDF/JPG/PNG, max 5 MB, up to 5 per request, type verified from file contents, stored on local disk and served only through an authenticated endpoint.

## Layout
`shared/` validation rules used by client and server · `server/` Express API, Mongoose models, `workflow.js` (state machine), `services/` · `client/` React (Vite) UI.

## Known limitations (so far)
No audit-log screen yet (the per-request timeline records every step); basic JWT in session storage and no login lockout/rate limiting yet; no email notifications; the UI has been built but not yet browser-tested or accessibility-audited.
