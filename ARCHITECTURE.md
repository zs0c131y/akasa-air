# Architecture

```
Browser (React, Vite build) ──HTTPS/cookies──► Express API ──► MongoDB
                                                  │
                                                  └─► document storage (local disk, behind an interface)
```
One Node process serves the built React app and the API on one port.

## Layers (server)
`routes/` (HTTP, upload parsing, audit calls) → `services/leaveService.js` (rules, validation, persistence) → `workflow.js` (pure state machine) → `models/` (Mongoose). Shared rules live in `shared/` and are imported by both server and client so they cannot drift.

## Data model
| Collection | Key fields | Indexes (why) |
|---|---|---|
| `users` | name, email, role, managerId, failedLogins, lockUntil | unique email (login) |
| `leaverequests` | employeeId, managerId, fromDate/toDate (ISO strings), days, isLong, isEmergency, status, infoRequestedFrom, documents[], timeline[] | employeeId+dates (overlap check), managerId and status (queues) |
| `auditlogs` | at, actor, action, entityId, from/toStatus, detail, ip | at, action, entityId (audit view and filters) |
| `refreshtokens` | userId, tokenHash, expiresAt, revokedAt | unique hash, TTL on expiresAt |

Dates are stored as `YYYY-MM-DD` strings: no time-zone surprises, and comparing strings works for ranges.

## Key decisions and trade-offs
- **Single state machine** so rules are in one tested place. Cost: every new action needs an entry there.
- **Optimistic locking** (`optimisticConcurrency`) instead of transactions: simple, and a stale write fails cleanly.
- **Timeline inside the request document** (a bounded list) for the per-request history, plus a separate append-only **audit log** for the HOD view across everything.
- **Storage interface** so S3 could replace the local disk.
- **Embedded MongoDB fallback** for zero-setup runs; real deployments set `MONGODB_URI`.

## At 10x scale
Move documents to object storage with virus scanning; put rate limits and sessions in Redis; page the audit log by cursor; add read replicas or indexes on status/date for dashboards; send notifications through a queue.
