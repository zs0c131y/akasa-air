# Testing

Run everything: `npm test` (the server tests start a throwaway in-memory MongoDB, so no setup is needed).

| Suite | Covers |
|---|---|
| `shared/src/index.test.js` | Day counting (inclusive, Sundays skipped, Sunday-only rejected, month/year/leap edges), the 3 vs 4 day boundary, emergency waiver and blocking rules, date validation, no past start dates |
| `server/test/workflow.test.js` | The state machine: every happy path, every illegal transition (409), who may act (403), self-approval, manager and HOD stage rules |
| `server/test/api.test.js` | Short-leave flow, long-leave two-level flow, reject at each level, info-request loop, missing document blocked, overlap, bad file type, edit/cancel, stale version, RBAC/IDOR (other team, other employee, documents), manager/HOD own leave, emergency leave sequence, audit log (recorded, HOD-only, append-only) |
| `server/test/security.test.js` | Cookie sessions, CSRF header, refresh rotation and replay revocation, logout, account lockout, operator injection, security headers, CORS allowlist, rate limiting |
| `client/src/components.test.jsx` | Status chips and legend (text, not colour alone), badges, friendly error screens, one-click sign-in |

Manual check done in a real browser against MongoDB Atlas: one-click sign-in, 5-day leave blocked without a document with a friendly message, emergency submit, manager sign-in, rejecting without a comment refused, approval moving the request to the HOD, session surviving a page reload.

## Not covered yet
- Automated browser (Playwright) end-to-end tests.
- Accessibility automation (axe, Lighthouse) and screen-reader testing.
- Load testing; coverage percentage report.
