# Security

| Area | What is done |
|---|---|
| Passwords | Hashed with bcrypt. Accounts lock for 15 minutes after 5 wrong passwords (`MAX_FAILED_LOGINS`, `LOCK_MINUTES`). |
| Sessions | 15-minute access JWT and a 7-day refresh token, both in **httpOnly, SameSite=Lax** cookies (`Secure` in production). The refresh token is rotated on every use; only its hash is stored. Re-using an old refresh token revokes all of that user's sessions. Logout revokes server-side. No token is kept in JavaScript. |
| CSRF | SameSite cookies plus a required `X-Requested-With: lms` header on cookie-authenticated writes. |
| Access control | Role checks and ownership checks on every request in the workflow module. Requests you cannot see return 404 (no existence leak). The queue is limited to your own team. Denied attempts are written to the audit log. |
| Input | Shared zod schemas on client and server. Keys containing `$` or `.` are rejected (NoSQL operator injection). React escapes output (XSS). |
| Uploads | PDF/JPG/PNG only, verified by file contents (not the claimed type), max 5 MB and 5 files, random storage names, sanitised display names, served only through an authenticated endpoint with `nosniff`. |
| Transport and headers | Helmet with a strict Content-Security-Policy (same-origin scripts), no `X-Powered-By`, CORS allowlist (`CORS_ORIGINS`), rate limits (sign-in and API). |
| Secrets | All from environment (`.env` is git-ignored). Production refuses to start without `JWT_SECRET`. |
| Logging | One JSON line per request with a request ID. Passwords, tokens and cookies are never logged. |

## Known limitations
- Demo accounts share one password and the sign-in page has one-click demo login. **Remove the demo buttons and set `SEED=false` for real use.**
- Uploaded files are not virus-scanned. Files live on local disk.
- No email verification, password reset or MFA.
- Rate-limit counters are in memory (per process).
- No automated dependency audit in CI.
