# Glossary

- **HOD** (Head of Department): the senior approver. Approves long leave after the manager and approves managers' own leave.
- **Consecutive leave**: leave days in a row. Counted as every calendar day from start to end, both included, except Sundays and public holidays, which are never counted.
- **Long leave**: more than 3 days in a row away (first to last day, Sundays and holidays between included). Needs documents and two approvals.
- **Split request**: a long leave filed in short pieces. Layover adds touching requests together and flags the later one.
- **Emergency leave**: long leave that may be filed without documents, which are then owed.
- **State machine**: a fixed list of statuses and the only moves allowed between them.
- **Audit log**: a permanent record of who did what and when. Entries cannot be edited or removed.
- **RBAC** (role-based access control): what you can do depends on your role (Employee, Manager, HOD) and on whether the request is yours or your team's.
- **IDOR**: guessing another person's record ID to read it. Prevented by checking access on every request.
- **JWT**: a signed token proving who you are. Here it lives 15 minutes.
- **Refresh token**: a long-lived secret that gets a new JWT without signing in again. Replaced on every use.
- **httpOnly cookie**: a cookie that page scripts cannot read, which protects it from XSS.
- **CSRF**: a malicious site making your browser send a request. Blocked by SameSite cookies and a required header.
- **Optimistic locking**: each record has a version number; saving with an old version fails, so two people cannot overwrite each other.
- **Rate limiting**: refusing too many requests in a short time.
