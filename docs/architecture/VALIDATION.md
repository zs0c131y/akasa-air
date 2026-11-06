# Validations

Every rule that checks what a person types, picks or uploads, in one place. Each row says what is checked, the message the person sees, and where the check runs.

**Where it runs:**

- **Both**: the browser checks first (so mistakes show at once), and the server checks again. The server never trusts the browser.
- **Server**: only the server checks. The page shows the server's message next to the field.
- **Browser**: only the browser checks. These are conveniences; the server has its own rule for the same thing (noted in the row).

Most shared rules live in `shared/src/index.js` and are used by both the React pages and the Express server, so the two can never disagree. Server-only rules live in `server/src/services/*.js`, `server/src/routes/*.js` and `server/src/middleware/security.js`.

Every server error comes back as `{ error: { code, message, hint, fields } }`. `fields` maps a field name to its message, and the page puts that message under the field.

---

## 1. Names and accounts

| Field | Rule | Message shown | Where | File |
|---|---|---|---|---|
| Sign-up full name | Required | "Please tell us your name." | Both | `shared/src/index.js` (`signupSchema`), `client/src/pages/SignupPage.jsx` |
| Sign-up full name | At least 3 characters after trimming (runs of spaces count as one) | "Please enter a full name of at least 3 letters." | Both | `nameProblem` in `shared/src/index.js` |
| Sign-up full name | At most 100 characters | "Please keep your name under 100 characters." | Both | `signupSchema` |
| Sign-up full name | No digits | "A full name cannot contain numbers." | Both | `nameProblem` |
| Sign-up full name | Only letters (any language, accents and Indian scripts included) separated by single spaces. No hyphens, apostrophes, full stops or any other special characters | "A full name can only have letters and spaces." | Both | `nameProblem` |
| Email (sign-up and forgot password in both; "send it again" for the confirmation link on the server only) | Required, trimmed and lower-cased | "Please enter your email address." | Both | `emailField` in `shared/src/index.js` |
| Email | At most 254 characters | "That email address is too long." | Both | `emailField` |
| Email | Looks like `name@domain.tld` (no spaces, one `@`, at least 2 characters after the last dot) | "That does not look like an email address. Check for typos." | Both | `emailField` |
| Email (sign-up) | Must use an allowed work domain, only when `ALLOWED_EMAIL_DOMAINS` is set | "Please use your work email (@domain)." | Server | `server/src/services/accountService.js` (`signUp`) |
| Email (sign-up) | Not already registered | "There is already an account with that email." (409, field: "Already registered.") | Server | `accountService.js` (`signUp`) |
| Sign-in email and password | Both required | Browser: "Enter your email and password to sign in." Server: "Please enter your email and password." with "Email is required." / "Password is required." | Both | `client/src/pages/LoginPage.jsx`, `server/src/routes/auth.js` |
| Sign-in | Email and password must match an account | "That email and password do not match." (401). The same message whether or not the email exists | Server | `routes/auth.js` |
| Sign-in | Email must be confirmed first (only when email sending is set up) | "Please confirm your email before signing in." (403) | Server | `routes/auth.js` |
| Sign-in | Lockout: after 5 wrong passwords in a row (`MAX_FAILED_LOGINS`) the account is locked for 15 minutes (`LOCK_MINUTES`), even for the right password | "This account is locked after too many wrong passwords. Try again in N minutes." (423) | Server | `routes/auth.js`, `server/src/config.js` |
| Forgot password / resend confirmation | Same answer whether or not the address has an account | "If there is an account for that address, we have sent a link..." | Server | `routes/auth.js` |
| Confirmation link token | Must be a string of at least 20 characters, unused and not expired (24 hours) | "This confirmation link has expired or was already used." | Server | `accountService.js` (`takeToken`, `confirmEmail`) |
| Reset link token | Required, 20 to 200 characters, unused and not expired (60 minutes) | "This link is missing its code." / "This link is not valid." / "This reset link has expired or was already used." | Server | `resetSchema`, `accountService.js` (`resetPassword`) |

## 2. Passwords

The same rules apply to the sign-up password, the new password on the reset page and the new password on the account page (`passwordProblem` in `shared/src/index.js`). They are checked in this order and the first problem is shown.

| Rule | Message shown | Where |
|---|---|---|
| At least 8 characters | "Use at least 8 characters." | Both |
| At most 128 characters | "Please keep it under 128 characters." | Both |
| At least one letter and one number | "Include at least one letter and one number." | Both |
| Not one of the common passwords (for example `password1`, `12345678`, `abcd1234`; exact match, any case) | "That password is too easy to guess. Try something less common." | Both |
| Does not contain the part of the email before the `@` (when that part is 4 or more characters) | "Please do not use your email name in your password." | Both on sign-up and change password; server only on reset (the reset page does not know who you are) |
| Does not contain your first name (when it is 4 or more characters) | "Please do not use your own name in your password." | Same as above |
| Change password: current password required | "Please enter your current password." | Both (`changePasswordSchema`) |
| Change password: current password must be right | "That is not your current password." (field: "This does not match.") | Server (`accountService.js`) |
| Change password: new one differs from the old one | "Your new password is the same as the old one." | Server (`accountService.js`) |

Files: `shared/src/index.js`, `server/src/routes/auth.js`, `server/src/services/accountService.js`, `client/src/pages/SignupPage.jsx`, `ResetPasswordPage.jsx`, `AccountPage.jsx`, and the live hint under the password box in `AuthShell.jsx`.

## 3. Leave requests and dates

The apply form and the server use the same schema, `makeLeaveInputSchema(holidays)` in `shared/src/index.js`, with the same holiday calendar (national holidays plus the person's own location). The server runs it in `parseLeaveInput` in `server/src/services/leaveService.js`, for both new requests and edits.

| Field | Rule | Message shown | Where |
|---|---|---|---|
| Start date / End date | Required | "Start date is required. Please pick a date." (or End date) | Both |
| Start date / End date | A real calendar date in `YYYY-MM-DD` form (31 February is refused) | "Start date is not a valid date. Use the format YYYY-MM-DD." | Both (`parseISODate`) |
| End date | Not before the start date | "End date is before the start date. Please pick an end date on or after the start date." | Both. The date picker also sets its earliest choice to the start date |
| Start date | Not in the past (today is fine) | "Start date is in the past. Please pick today or a later date." | Both. The date picker also starts at today |
| End date | At most 365 days from today | "Leave can be requested up to 365 days ahead. Please pick an earlier end date." | Both |
| Dates | At most 60 charged days in one request | "A single request can cover at most 60 days. Please split it into two requests." | Both |
| Dates | At least one working day: a range that is only Sundays and public holidays is refused | "Sundays and public holidays are not counted as leave, so this request has no leave days. Please include at least one working day." | Both |
| Reason | Required, trimmed, 5 to 500 characters. Any text is fine (digits and punctuation included) | "Please tell us the reason for your leave." / "Please give a reason of at least 5 characters, for example "Family wedding"." / "Please keep the reason under 500 characters." | Both |
| Employee name | Optional; if sent it must match the signed-in person's name (any case). The form always sends the signed-in name | "Leave can only be requested for yourself (Name)." | Server |
| Emergency leave | `true` / `false` (or the text "true" / "false" from a form) | Default schema message | Both |
| Overlap | Must not overlap another of your own active requests (waiting, info requested or approved) | "These dates overlap with your leave from X to Y." (409) | Server |
| Allowance | Charged days must fit what is left of that year's allowance (allowance minus approved minus waiting). When editing, the request's own days are given back first | "This needs N leave days, but you only have M left for YEAR." (409). The form shows a warning beforehand but does not block | Server (warning in browser) |
| Manager | An employee must have a manager before applying | "Your account is not set up for leave yet." (409) | Server |
| Edit | Only allowed before any approval, by the owner | Workflow messages (409 / 403) | Server (`server/src/workflow.js`) |
| Version | Decisions carry the version the person saw; if it changed meanwhile the action is refused | "This request changed after you opened it." / "Someone else just updated this request." (409) | Server |
| Team calendar range | Valid start and end dates, start first, the end at most 62 days after the start | "Please give a start and an end date, start first (YYYY-MM-DD)." / "Please ask for at most about two months at a time." | Server (`calendar`) |
| "Days in a row" preview | Valid start and end dates, start first | Same message as above | Server (`previewChain`) |

### Emergency leave

| Rule | Message shown | Where |
|---|---|---|
| Emergency leave over 3 days in a row may be filed without documents; the documents are then owed (due the working day after it ends) | Shown on the request page | Both |
| One emergency leave still owing documents: only another emergency leave may be filed | "Your earlier emergency leave still needs supporting documents. Please upload them before applying for another leave (only one more emergency leave is allowed meanwhile)." | Both (the form disables Submit; the server answers 409 `DOCUMENTS_OVERDUE`) |
| Two owing: no new leave of any kind | "You have emergency leave without supporting documents twice over, so new leave of any kind is blocked until you upload them." | Both |

Files: `emergencyBlockMessage` in `shared/src/index.js`, `assertMayApply` and `getObligations` in `leaveService.js`, `client/src/pages/ApplyPage.jsx`.

## 4. Documents

"More than 3 days in a row" counts calendar days from the first to the last day, including Sundays and holidays in the middle, and includes other active requests that touch this one (so splitting a long leave does not avoid the rule).

| Rule | Message shown | Where | File |
|---|---|---|---|
| Required when the stretch is more than 3 days in a row, unless it is emergency leave | "Leave longer than 3 days needs a supporting document. Please attach one..." (plus which other leave it joins with) | Both | `documentRequirementError` in `shared/src/index.js`, `leaveService.js` |
| Not accepted for short leave (3 days or fewer in a row), on a new request, an edit, the "send documents" button, or a reply to a question | "Supporting documents are only accepted for leave longer than 3 days. This request does not need one." | Both (the form drops picked files and the request page hides the picker; the server refuses) | `leaveService.js` (`assertDocumentsAllowed`, `attachDocuments`, `transition`) |
| At most 5 documents per request, counting the ones already attached | "You can attach at most 5 documents per request." | Both | `prepareFiles` in `leaveService.js`, `ApplyPage.jsx` |
| At most 5 MB each | "\"name\" is larger than 5 MB. Please attach a smaller file." (upload limit: "A file is larger than 5 MB. Please attach a smaller file.") | Both | `leaveService.js`, `server/src/app.js` (multer limit), `ApplyPage.jsx` |
| Real file type is PDF, JPG or PNG, read from the file's first bytes, not from its name or the type the browser reports | "\"name\" is not a PDF, JPG or PNG file. Please convert it and try again." | Server checks the content. The browser checks the type it reports and limits the picker to `.pdf,.jpg,.jpeg,.png` | `sniffMime` in `server/src/storage/index.js`, `leaveService.js` |
| "Send documents" needs at least one file | "Please choose at least one PDF, JPG or PNG file." | Server | `attachDocuments` |
| Files must use the `documents` field | "Unexpected file field. Please use the document picker." | Server | `app.js` |
| File name is cleaned: only the base name is kept, characters other than letters, digits, `_ . - ( )` and spaces become `_`, at most 100 characters, "document" if empty | (no message, done silently) | Server | `safeFilename` in `storage/index.js` |
| Files are stored under a random id, never served as static files, and only downloaded through an access-checked, audited route with `nosniff`; quotes are removed from the download name | (no message) | Server | `storage/index.js`, `server/src/routes/leaves.js` |

## 5. Approvals and comments

| Action | Rule | Message shown | Where | File |
|---|---|---|---|---|
| Reject | Comment required, 3 to 1000 characters after trimming | "Please explain why the request is rejected." / "...(at least 3 characters)." / "Please keep the comment under 1000 characters." | Both | `rejectSchema`, `client/src/pages/DetailPage.jsx` |
| Ask for information | Comment required, 3 to 1000 characters | "Please write what information you need." / "...(at least 3 characters)." / "Please keep the question under 1000 characters." | Both | `infoRequestSchema` |
| Approve | Comment optional, at most 1000 characters | "Please keep the comment under 1000 characters." | Server | `approveSchema` |
| Cancel | Comment optional, at most 1000 characters, must be text | "Please keep the comment under 1000 characters." | Server | `cancelSchema`, `routes/leaves.js` |
| Reply to a question | Message optional, at most 1000 characters, but a message or a document is needed | "Please keep the reply under 1000 characters." / "Please write a reply or attach a document." | Server | `replySchema`, `transition` in `leaveService.js` |
| Any decision | Only the right person at the right stage: nobody decides on their own request, a manager only at the manager stage for their own team, the HOD at the HOD stage | 403 / 409 workflow messages; requests you cannot see answer 404 | Server | `server/src/workflow.js`, `leaveService.js` |

Comments and reasons are free text: digits and punctuation are allowed. They are shown as text (React escapes them), never as HTML.

## 6. Holidays, locations and allowances

### Holidays (HOD only)

| Field | Rule | Message shown | Where | File |
|---|---|---|---|---|
| Date | A real date. Accepts `2026-10-02`, `02/10/2026`, `2-10-2026`, `02.10.2026`, `2 Oct 2026`, `02-Oct-2026` (numbers read day first) | "Please pick a valid date." | Server (the form uses a date picker) | `normalizeDate` in `server/src/services/holidayImport.js`, `holidayService.js` |
| Name | 3 to 80 characters; only letters (any language) separated by single spaces; no digits, hyphens, apostrophes, full stops or other special characters | "Please enter a holiday name of at least 3 letters." / "Please keep the holiday name under 80 characters." / "A holiday name cannot contain numbers." / "A holiday name can only have letters and spaces." | Server | `nameProblem`, `addHoliday` |
| Who it applies to | Blank or a word such as "National", "All", "India" means everyone; otherwise it must be an existing location (any case) | "We do not have a location called "X". Add it under Locations first, or fix the spelling." | Server (the form offers a list) | `resolveLocation` in `holidayService.js` |
| Date and location | Only one holiday per date per location | "That date is already a holiday for this location." (409) | Server | `addHoliday` |

### Holiday CSV import (HOD only)

| Rule | Message shown | Where |
|---|---|---|
| Something must be pasted or chosen | "Paste or upload some holidays first. Each line is: date, name, location." | Server (the Check button is disabled while empty) |
| At least one holiday line found | "We could not find any holiday lines. Each line is: date, name, location." | Server |
| At most 1000 lines | "That is N lines. Please import at most 1000 at a time." | Server |
| A chosen file is at most 100 KB | "That file is too big." | Browser (the server also caps every JSON body at 100 KB) |
| Commas, tabs or semicolons; quoted cells; header row optional (columns found by name, otherwise date, name, location) | (no message) | Server |
| Each line: same date, name and location rules as a single holiday | Per line: ""X" is not a date we can read. Try 2026-10-02 or 02/10/2026.", the name messages above, or the location message | Server |
| Dates already in the calendar, or listed twice, are skipped | "Already in the calendar, so it will be skipped." | Server |
| All or nothing: nothing is saved unless every line is valid; without "apply" it is only a preview | Apply button disabled while any line has an error | Both |

Files: `importHolidays` in `server/src/services/holidayService.js`, `parseDelimited` and `parseHolidayRows` in `holidayImport.js`, `client/src/pages/HolidaysPage.jsx`.

### Locations and people (HOD only)

| Field | Rule | Message shown | Where |
|---|---|---|---|
| Location name | 3 to 60 characters; letters separated by single spaces only (no digits, hyphens, apostrophes, full stops or other special characters) | "Please enter a location name of at least 3 letters." / "Please keep the location name under 60 characters." / "A location name cannot contain numbers." / "A location name can only have letters and spaces." | Server |
| Location name | Not a word reserved for national holidays ("National", "All", "Everyone", "India", "Common", "All locations") | ""X" is reserved for holidays that apply everywhere." | Server |
| Location name | Unique | "That location already exists." (409) | Server |
| Remove location | Only when no people and no holidays use it | "X still has N people and M holidays." (409) | Server |
| Person's role | Employee or Manager only; the HOD's role cannot change; a manager with people reporting to them cannot become an employee | "Choose Employee or Manager." / "The Head of Department role cannot be changed here." / "X still has N people reporting to them." | Server (the page offers a list) |
| Person's manager | Only employees get a manager here, and it must be an existing manager. Names are not typed: the manager is picked by id, so manager names are whatever passed the sign-up name rule | "Only employees have a manager chosen here. Managers report to the HOD." / "Please choose one of the managers." | Server (the page offers a list) |
| Person's location | Blank or a national word means none; otherwise an existing location | Same message as for holidays | Server (the page offers a list) |

Files: `server/src/services/holidayService.js`, `server/src/routes/holidays.js`, `client/src/pages/HolidaysPage.jsx`.

### Allowances (HOD only)

| Field | Rule | Message shown | Where |
|---|---|---|---|
| Default allowance and one person's allowance | A number from 0 to 365; the server accepts whole or half days | Server: "Please enter a number of days between 0 and 365 (half days are fine)." Browser: "Use a whole number from 0 to 365." (the page itself only takes whole numbers) | Both |
| Year for one person's allowance | Whole number from 2000 to 2100 | "Please enter a year such as 2026." | Server |
| `year` in the address (balance, allowance list, reports) | Four digits, otherwise the current year is used | (no message) | Server |

### Allowance CSV import (HOD only)

| Rule | Message shown | Where |
|---|---|---|
| Something must be pasted | "Paste or upload some lines first. Each line is: email, allowance, year." | Server |
| At least one line; at most 2000 lines (not counting the header) | "We could not find any lines..." / "That is N lines. Please import at most 2000 at a time." | Server |
| A chosen file is at most 100 KB | "That file is too big." | Browser |
| Email must belong to someone, or be `default`, `everyone`, `all`, `everybody`, `*` or blank, which sets the default for everyone | "We do not have anyone with the email "X"." | Server |
| Allowance 0 to 365, whole or half days | ""X" is not a number of days between 0 and 365." | Server |
| Year blank (this year) or 2000 to 2100 | ""X" is not a year we can read. Try 2026." | Server |
| A person (and year) only once per file | "This person is listed twice. Keep one line for them." | Server |
| All or nothing; preview first | Apply disabled while any line has an error | Both |

Files: `server/src/services/allowanceService.js`, `server/src/routes/account.js`, `client/src/pages/AllowanceTab.jsx`.

## 7. Notifications and preferences

| Field | Rule | Message shown | Where |
|---|---|---|---|
| Mark as read | Either `all: true` or a list of `ids`; only your own notices change; anything that is not a real id is ignored | "Say which notices to mark as read, or send all: true." | Server |
| Notification list `limit` | 1 to 100, default 30 | (no message) | Server |
| Email notices on or off | Must be `true` or `false` | "Choose on or off." | Server |

Files: `server/src/routes/account.js`, `server/src/services/notificationService.js`.

## 8. Lists, export and security guards

| Guard | Rule | Message shown | File |
|---|---|---|---|
| NoSQL operator keys | Any key containing `$` or `.` anywhere in the JSON body or query string is refused (checked 6 levels deep) | "That request contains characters we cannot accept." (400) | `rejectOperatorKeys` in `server/src/middleware/security.js` |
| JSON body | At most 100 KB, must be valid JSON | "We could not read that request." (400) | `server/src/app.js` |
| Ids in the address | A request id that is not a real id answers 404, the same as one you may not see | "We could not find that request." | `leaveService.js` (`load`) |
| Request list | `scope` is mine, queue or all; `status` is one of the known statuses; page size 1 to 50 (default 20) | "Scope must be mine, queue or all." / "Unknown status filter." | `listLeaves` in `leaveService.js` |
| Audit log | Page size 1 to 100 (default 25); search text is matched literally, never as a pattern | (no message) | `server/src/services/auditService.js` |
| Team calendar | End at most 62 days after the start; at most 500 rows | See section 3 | `leaveService.js` |
| CSV export | `scope` mine or all (all for managers and the HOD); valid status; `from` and `to` real dates; at most 5000 rows | "Scope must be mine or all." / "Unknown status filter." / "Please use a date like 2026-11-01." | `exportCsv` in `leaveService.js` |
| CSV export cells | A cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading `'` so a spreadsheet will not run it as a formula; cells with commas, quotes or line breaks are quoted | (no message) | `csvCell` in `leaveService.js` |
| Cookie writes | Must carry the `X-Requested-With: lms` header (CSRF guard) | "This request was blocked for your safety." (403) | `server/src/middleware/auth.js` |
| Other websites | Only same-origin or listed origins (`CORS_ORIGINS`) | "This website is not allowed to use the API." (403) | `security.js` |
| Rate limit, whole API | 600 requests a minute per device (`API_RATE_MAX`) | "You are doing that too quickly." (429) | `security.js` |
| Rate limit, sign-in | 60 attempts per 10 minutes (`LOGIN_RATE_MAX`) | "Too many sign-in attempts from this device." (429) | `routes/auth.js` |
| Rate limit, sign-up | 10 an hour | "Too many sign-ups from this device." (429) | `routes/auth.js` |
| Rate limit, email links | 6 per 15 minutes for confirm email, resend confirmation, forgot password, check reset link and reset password | "Too many requests from this device." (429) | `routes/auth.js` |
| Lockout | See section 1 | | `routes/auth.js` |

In automated tests the sign-up and email-link limits are raised to 1000 so tests do not trip them.

---

## Tests that cover these rules

| Area | Tests |
|---|---|
| Dates, reason, days, documents, emergency, names | `shared/src/index.test.js` |
| Names on sign-up, holidays, locations and the holiday CSV | `server/test/names.test.js` |
| Bad dates, overlap, wrong name, bad file type, reject comment, short leave refusing documents, holiday CSV | `server/test/api.test.js` |
| Cancel and approve comment limits, reply documents on short leave, bad notice ids | `server/test/validation.test.js` |
| Weak passwords, bad emails, duplicates, domains, reset and change password | `server/test/account.test.js` |
| Allowance numbers, allowance CSV, notifications, preferences | `server/test/allowance-notify.test.js` |
| Lockout, NoSQL operator keys, CORS, CSRF, sign-in rate limit | `server/test/security.test.js` |
| CSV export filters and formula neutralising | `server/test/extras.test.js` |
| Holiday date formats and CSV parsing | `server/test/holidayImport.test.js` |
| Who may act at each stage | `server/test/workflow.test.js` |
| Sign-up form errors, allowance import Apply button | `client/src/auth-pages.test.jsx`, `client/src/balance-notify.test.jsx` |
