# Workflow

Every leave request moves through one state machine, implemented in `server/src/workflow.js`. Nothing else in the code decides what is allowed.

## States
| State | Meaning |
|---|---|
| `PENDING_MANAGER` | Waiting for the employee's manager |
| `PENDING_HOD` | Waiting for the Head of Department |
| `INFO_REQUESTED` | An approver asked a question; waiting for the employee |
| `APPROVED` | Finished: approved |
| `REJECTED` | Finished: rejected |
| `CANCELLED` | Finished: withdrawn by the employee |

```
 submit ──► PENDING_MANAGER ──approve (≤3 days)──────────────► APPROVED
                 │  │                                             ▲
                 │  └─approve (>3 days)──► PENDING_HOD ──approve──┘
                 │                            │   │
                 ├──reject──► REJECTED ◄──reject──┘   │
                 └──ask info──► INFO_REQUESTED ◄──ask info
                                   │  employee replies: back to the stage that asked
 Employee can cancel while open (or approved leave that has not started).
```

## Transitions
| Action | Who | From | To | Logged |
|---|---|---|---|---|
| Submit | Employee | – | `PENDING_MANAGER` | timeline + audit |
| Submit (manager's own leave) | Manager | – | `PENDING_HOD` | timeline + audit |
| Submit (HOD's own leave) | HOD | – | `APPROVED` (auto, flagged) | timeline + audit |
| Approve | The employee's manager | `PENDING_MANAGER` | `APPROVED` if ≤3 days, else `PENDING_HOD` | yes |
| Approve | HOD (not the requester) | `PENDING_HOD` | `APPROVED` | yes |
| Reject (comment required) | Manager / HOD at their stage | `PENDING_*` | `REJECTED` | yes |
| Ask for information (question required) | Manager / HOD at their stage | `PENDING_*` | `INFO_REQUESTED` | yes |
| Reply (text and/or documents) | Employee | `INFO_REQUESTED` | stage that asked | yes |
| Edit | Employee | open, before any approval | unchanged | yes |
| Send documents | Employee | open or approved | unchanged | yes |
| Cancel | Employee | open, or approved and not started | `CANCELLED` | yes |

Illegal moves return `409 ILLEGAL_TRANSITION`; permitted state but wrong person returns `403`. Nobody can act on their own request as an approver. Two people deciding at once is stopped by a version check (`409 STALE_REQUEST`).

## The long-leave rule
Days are counted inclusively, **except Sundays and public holidays, which are never counted as leave**. The holiday calendar lives in the database (`holidays` collection) and is kept by the HOD at `/holidays`; fixed-date national holidays (26 Jan, 15 Aug, 2 Oct, 25 Dec) are seeded the first time the server starts, and holidays that move (Diwali, Eid and so on) are added by the HOD once announced. Holidays are either national (apply to everyone) or tied to one location, and each person works from one location, so someone in Bengaluru is not charged for a Mumbai-only holiday. The HOD sets locations on the Holidays page (Locations and people tab); a person with no location gets national holidays only. The HOD can add holidays one at a time or paste or upload a list (Import a list tab), which is checked line by line before anything is saved. The server and the apply form count with the same function, and each request stores what was left out (`excluded`). A request keeps the count it had when it was filed, even if a holiday is added later. For example: Mon 2 Nov to Fri 6 Nov is **5 days**; Fri 6 Nov to Tue 10 Nov is **4 days** (the Sunday is skipped). A request that covers only Sundays and holidays is refused. Documents for emergency leave fall due on the next working day (a Sunday is skipped)

**Documents** are only taken for leave over 3 counted days. Short leave neither needs nor accepts a document (the form hides the upload box and the server refuses it).. More than 3 days (`LONG_LEAVE_THRESHOLD_DAYS`) means documents are required and both Manager and HOD must approve. Exactly 3 is short.

## Emergency leave
Tick "Emergency leave" to file a long leave without documents. Both approvals are still needed. Documents are due by the day after the leave ends, or before the next leave.
- 0 leaves missing documents: apply for anything.
- 1 missing: only one more emergency leave is allowed; normal leave is blocked.
- 2 missing: all new leave is blocked until documents are uploaded.

## Worked examples
**2-day leave (4 to 5 Dec):** Arjun applies, no document needed. His manager Rahul approves with a comment. Status: `APPROVED`. Two steps.
**5-day leave (10 to 14 Dec):** Arjun applies. Without a document he is blocked with a friendly message; he attaches a ticket and submits (`PENDING_MANAGER`). Rahul asks "Which dates is the flight?" (`INFO_REQUESTED`). Arjun replies (back to `PENDING_MANAGER`). Rahul approves (`PENDING_HOD`). Priya, the HOD, approves (`APPROVED`).
