# API

**Interactive docs:** open `/api/docs` on a running server (for example http://localhost:4000/api/docs) to browse and try every endpoint. The machine-readable OpenAPI file is at `/api/docs.json`. It is kept in step with the code by a test, so it cannot silently drift. This page is the written summary.

Base path `/api`. JSON in and out, except uploads (`multipart/form-data`, field `documents`). Browsers authenticate with httpOnly cookies; API clients can send `Authorization: Bearer <token>` (the token is returned by login).

## Errors
Every error has one shape:
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "hint": "…", "fields": { "toDate": "…" } } }
```
Codes: `VALIDATION_FAILED` 400, `BAD_INPUT` 400, `UPLOAD_FAILED` 400, `UNAUTHENTICATED` 401, `BAD_CREDENTIALS` 401, `FORBIDDEN` 403, `CSRF_BLOCKED` 403, `CORS_BLOCKED` 403, `NOT_FOUND` 404, `ILLEGAL_TRANSITION` 409, `STALE_REQUEST` 409, `OVERLAPPING_LEAVE` 409, `HOLIDAY_EXISTS` 409, `LOCATION_EXISTS` 409, `LOCATION_IN_USE` 409, `ACCOUNT_EXISTS` 409, `NO_MANAGER` 409, `HAS_REPORTS` 409, `LINK_INVALID` 400, `WRONG_PASSWORD` 400, `EMAIL_NOT_VERIFIED` 403, `DOCUMENTS_OVERDUE` 409, `ACCOUNT_LOCKED` 423, `TOO_MANY_REQUESTS` 429, `INTERNAL` 500.

## Endpoints
| Method and path | Who | Purpose |
|---|---|---|
| `POST /auth/login` `{email,password}` | public | Sign in; sets cookies; returns `{token,user}` |
| `POST /auth/signup` `{name,email,password}` | public | Create an employee account. No manager or location yet: the HOD sets them. `409 ACCOUNT_EXISTS`. Returns `needsVerification` (true when email is configured) |
| `POST /auth/verify-email` `{token}` | public | Confirm the address from the emailed link (24 h, single use) |
| `POST /auth/resend-verification` `{email}` | public | Send the confirmation again (same answer whether or not the address exists) |
| `POST /auth/forgot-password` `{email}` | public | Email a reset link (60 min, single use). Same answer for unknown addresses |
| `POST /auth/check-reset` `{token}` | public | Is a reset link still valid? |
| `POST /auth/reset-password` `{token,password}` | public | Choose a new password; signs out other devices and clears a lockout |
| `POST /auth/change-password` `{currentPassword,newPassword}` | signed in | Change password; other devices are signed out |
| `GET /auth/options` | public | `{emailEnabled}` |
| `POST /auth/refresh` | cookie | Rotate refresh token, new access cookie |
| `POST /auth/logout` | any | Revoke refresh token, clear cookies |
| `GET /auth/me` | signed in | Current user |
| `POST /leaves` | any | Apply. Fields: `employeeName?`, `fromDate`, `toDate`, `reason`, `isEmergency?`, files `documents` |
| `GET /leaves?scope=mine\|queue\|all&status=&page=&pageSize=` | `queue`/`all`: manager, HOD | List with pagination |
| `GET /stats` | signed in | Numbers for the home screen. Everyone: `mine` (open requests, approved days this year, next time off). Managers and HOD also `queue` (waiting, longest wait), `team` (away today, away this week) and `decisions` (median hours to decide, last 90 days) |
| `GET /leaves/chain?from=&to=&excludeId?` | signed in | What these dates cost and whether they join up with your other active leave (touching, or separated only by Sundays and holidays). Returns `{days, chainDays, members}`; the apply form uses it |
| `GET /leaves/calendar?from=&to=` | signed in | Who is away in a date range (at most about two months) plus the holidays that apply to you. HOD: everyone. Manager: their team. Employee: own requests and teammates' approved leave, names and dates only |
| `GET /leaves/obligations` | any | Emergency leaves still owing documents; what you may apply for |
| `GET /leaves/:id` | owner, their manager, HOD | Detail with timeline and `allowedActions` |
| `PATCH /leaves/:id` | owner | Edit before any approval |
| `POST /leaves/:id/approve` `{comment?, version?}` | stage approver | Approve |
| `POST /leaves/:id/reject` `{comment}` | stage approver | Reject |
| `POST /leaves/:id/request-info` `{comment}` | stage approver | Ask for more information |
| `POST /leaves/:id/reply` `message?` + files | owner | Answer a question |
| `POST /leaves/:id/documents` files | owner | Add documents (e.g. after emergency leave) |
| `POST /leaves/:id/cancel` | owner | Cancel |
| `GET /leaves/:id/documents/:docId` | same as detail | Download (access-checked, audited) |
| `GET /holidays?from=&to=` | signed in | Holidays that apply to you: national ones plus those of your own location. HOD may add `all=true` or `location=Name` |
| `POST /holidays` `{date,name,location?}` | HOD | Add a holiday; no `location` = national. Dates may be `2026-10-02`, `02/10/2026` or `2 Oct 2026`. `409 HOLIDAY_EXISTS` if that date is already listed for that location |
| `POST /holidays/import` `{csv, apply?}` | HOD | Bulk add from pasted CSV/TSV (`date,name,location`, header optional). Without `apply` it only previews. With `apply` nothing is saved unless every line is valid; dates already listed are skipped. Returns `{applied, summary:{new,duplicate,errors}, rows:[{line,date,name,location,status,message}]}` |
| `DELETE /holidays/:id` | HOD | Remove a holiday |
| `GET /locations` | signed in | Work locations with how many people and local holidays each has |
| `POST /locations` `{name}` | HOD | Add a location (`409 LOCATION_EXISTS`) |
| `DELETE /locations/:id` | HOD | Remove a location; `409 LOCATION_IN_USE` while it has people or holidays |
| `GET /people` | HOD | Everyone with role, email, location, manager; people who still need a manager come first (`needsSetup`) |
| `PATCH /people/:id/manager` `{managerId}` | HOD | Choose an employee's manager (must be a manager) |
| `PATCH /people/:id/role` `{role}` | HOD | `EMPLOYEE` or `MANAGER` (409 if a manager still has people reporting to them) |
| `PATCH /people/:id/location` `{location}` | HOD | Set where someone works (`null` or empty = none) |
| `GET /audit?action=&q=&page=` | HOD | Audit log |
| `GET /health` (not under `/api`) | public | Liveness + DB status |

Example leave body: `{ "employeeName": "Arjun Sharma", "fromDate": "2026-12-10", "toDate": "2026-12-14", "reason": "Family vacation" }`.

Not yet provided: OpenAPI/Swagger UI.
