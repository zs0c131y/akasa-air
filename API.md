# API

Base path `/api`. JSON in and out, except uploads (`multipart/form-data`, field `documents`). Browsers authenticate with httpOnly cookies; API clients can send `Authorization: Bearer <token>` (the token is returned by login).

## Errors
Every error has one shape:
```json
{ "error": { "code": "VALIDATION_FAILED", "message": "…", "hint": "…", "fields": { "toDate": "…" } } }
```
Codes: `VALIDATION_FAILED` 400, `BAD_INPUT` 400, `UPLOAD_FAILED` 400, `UNAUTHENTICATED` 401, `BAD_CREDENTIALS` 401, `FORBIDDEN` 403, `CSRF_BLOCKED` 403, `CORS_BLOCKED` 403, `NOT_FOUND` 404, `ILLEGAL_TRANSITION` 409, `STALE_REQUEST` 409, `OVERLAPPING_LEAVE` 409, `DOCUMENTS_OVERDUE` 409, `ACCOUNT_LOCKED` 423, `TOO_MANY_REQUESTS` 429, `INTERNAL` 500.

## Endpoints
| Method and path | Who | Purpose |
|---|---|---|
| `POST /auth/login` `{email,password}` | public | Sign in; sets cookies; returns `{token,user}` |
| `POST /auth/refresh` | cookie | Rotate refresh token, new access cookie |
| `POST /auth/logout` | any | Revoke refresh token, clear cookies |
| `GET /auth/me` | signed in | Current user |
| `POST /leaves` | any | Apply. Fields: `employeeName?`, `fromDate`, `toDate`, `reason`, `isEmergency?`, files `documents` |
| `GET /leaves?scope=mine\|queue\|all&status=&page=&pageSize=` | `queue`/`all`: manager, HOD | List with pagination |
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
| `GET /audit?action=&q=&page=` | HOD | Audit log |
| `GET /health` (not under `/api`) | public | Liveness + DB status |

Example leave body: `{ "employeeName": "Arjun Sharma", "fromDate": "2026-12-10", "toDate": "2026-12-14", "reason": "Family vacation" }`.

Not yet provided: OpenAPI/Swagger UI.
