# Testing

Run everything: `npm test` (the server tests start a throwaway in-memory MongoDB, so no setup is needed).

| Suite | Covers |
|---|---|
| `shared/src/index.test.js` | Day counting (inclusive, Sundays and public holidays skipped, holiday-on-Sunday, Sunday/holiday-only rejected, month/year/leap edges), the 3 vs 4 day boundary, emergency waiver and blocking rules, date validation, no past start dates |
| `server/test/workflow.test.js` | The state machine: every happy path, every illegal transition (409), who may act (403), self-approval, manager and HOD stage rules |
| `server/test/api.test.js` | Short-leave flow, long-leave two-level flow, reject at each level, info-request loop, missing document blocked, overlap, bad file type, edit/cancel, stale version, RBAC/IDOR (other team, other employee, documents), manager/HOD own leave, emergency leave sequence, audit log (recorded, HOD-only, append-only), holiday calendar (HOD-only changes, holiday not counted and reported, holiday-only request refused), no documents on short leave, location calendars (local holiday only counted for that location, HOD-only locations and people, location in use cannot be removed), bulk import (preview, all-or-nothing, duplicates, day-first dates) |
| `server/test/security.test.js` | Cookie sessions, CSRF header, refresh rotation and replay revocation, logout, account lockout, operator injection, security headers, CORS allowlist, rate limiting |
| `shared/src/index.test.js` (leave in a row) | Touching requests, Sunday and holiday gaps, working-day gaps, chains in both directions |
| `server/test/allowance-notify.test.js` | Profile and employee IDs, 30-day allowance (blocked when too big, HOD overrides, days returned on reject), allowance CSV import (HOD only, preview, all-or-nothing, default row), notifications (who is told, read state, both approvals, question and reply, cancel), email never sent to demo addresses, email preference |
| `server/test/docs.test.js` | The OpenAPI file describes exactly the routes in the code, is well formed, and the docs page loads |
| `server/test/account.test.js` | Sign-up (weak password, duplicate, domain limit), no leave until the HOD chooses a manager, promote/demote, email confirmation (Mailgun stubbed), forgot and reset password (single use, signs out other sessions, clears lockout), change password |
| `server/test/holidayImport.test.js` | Date formats (ISO, day-first numeric, month names), CSV/TSV/semicolon parsing, quotes, BOM, headers in any order |
| `client/src/components.test.jsx` | Status chips and legend (text, not colour alone), badges, friendly error screens, one-click sign-in |

Manual check done in a real browser against MongoDB Atlas: one-click sign-in, 5-day leave blocked without a document with a friendly message, emergency submit, manager sign-in, rejecting without a comment refused, approval moving the request to the HOD, session surviving a page reload.

## Not covered yet
- Automated browser (Playwright) end-to-end tests.
- Accessibility automation (axe, Lighthouse) and screen-reader testing.
- Load testing; coverage percentage report.
