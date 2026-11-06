/**
 * The OpenAPI 3.0 description of the Layover API. Served as JSON at /api/docs.json and as a browsable page at /api/docs.
 * Keep it in step with the routes: test/docs.test.js checks that every route in the app is described here.
 */
import { ALLOWED_MIME, LONG_LEAVE_THRESHOLD_DAYS, MAX_FILES, MAX_FILE_BYTES } from '@lms/shared';

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const ok = (description, schema) => ({ description, ...(schema ? { content: json(schema) } : {}) });
const err = (description) => ({ description, content: json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Request id' };
const q = (name, description, schema = { type: 'string' }) => ({ name, in: 'query', required: false, description, schema });

const COMMON = {
  400: err('Something in the request needs fixing. `error.fields` says which field.'),
  401: err('Not signed in, or the session has ended.'),
  403: err('Signed in, but not allowed to do this.'),
  404: err('Not found, or not visible to this person.'),
};
const only = (...codes) => Object.fromEntries(codes.map((c) => [c, COMMON[c]]));
const body = (schema, required = true) => ({ required, content: json(schema) });
const csvBody = {
  required: true,
  content: json({
    type: 'object',
    required: ['csv'],
    properties: {
      csv: { type: 'string', description: 'Pasted CSV or tab-separated text' },
      apply: { type: 'boolean', description: 'false (default) only previews. true saves, but only if no line has an error.' },
    },
  }),
};

const SECURED = [{ cookieAuth: [] }, { bearerAuth: [] }];
const PUBLIC = [];

function op(tag, summary, { description, security = SECURED, parameters, requestBody, responses = {}, auth = security !== PUBLIC } = {}) {
  return {
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    ...(parameters ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    security,
    responses: { ...responses, ...(auth ? only(401) : {}) },
  };
}

const leaveForm = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object',
        required: ['fromDate', 'toDate', 'reason'],
        properties: {
          employeeName: { type: 'string', description: 'Optional. If given it must match the signed-in person.' },
          fromDate: { type: 'string', format: 'date', example: '2026-11-01' },
          toDate: { type: 'string', format: 'date', example: '2026-11-05' },
          reason: { type: 'string', minLength: 5, maxLength: 500, example: 'Vacation' },
          isEmergency: {
            type: 'boolean',
            description: `Only for leave of more than ${LONG_LEAVE_THRESHOLD_DAYS} days in a row: documents can follow.`,
          },
          documents: {
            type: 'array',
            items: { type: 'string', format: 'binary' },
            description: `Up to ${MAX_FILES} files (${ALLOWED_MIME.join(', ')}), ${MAX_FILE_BYTES / 1024 / 1024} MB each. Only accepted when the leave is long.`,
          },
        },
      },
    },
  },
};

const decision = (summary, commentRequired) =>
  op('Decisions', summary, {
    parameters: [idParam],
    requestBody: body({
      type: 'object',
      properties: {
        comment: { type: 'string', description: commentRequired ? 'Required' : 'Optional' },
        version: { type: 'integer', description: 'The version you last saw. If the request changed since, you get 409 STALE_REQUEST.' },
      },
    }),
    responses: {
      200: ok('The updated request', ref('Leave')),
      ...only(400, 403, 404),
      409: err('Not allowed from the current status, or the request changed since you opened it.'),
    },
  });

export function buildOpenApi() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Layover API',
      version: '1.0.0',
      description: [
        'Leave requests, approvals, holidays and accounts for Akasa Air teams.',
        '',
        `**Long leave** is more than ${LONG_LEAVE_THRESHOLD_DAYS} days in a row (calendar days away, first to last day). It needs a document and approval from the manager, then the head of department (HOD). Leave that touches other leave is added up.`,
        '',
        '**Charged days** (`days`) leave out Sundays and public holidays. Holidays are national or tied to one location.',
        '',
        '**Signing in.** Browsers use httpOnly cookies and must send `X-Requested-With: lms` on writes. API clients can use the `token` returned by `POST /auth/login` as a Bearer token.',
        '',
        '**Errors** always look like `{ "error": { "code", "message", "hint", "fields" } }` and the message is written for the person using the app.',
        '',
        'Demo sign-in for trying this page: `priya.nair@akasa.demo` (HOD), `rahul.mehta@akasa.demo` (manager), `arjun.sharma@akasa.demo` (employee). The demo password is in the README.',
      ].join('\n'),
    },
    servers: [{ url: '/api', description: 'This server' }],
    tags: [
      { name: 'Auth', description: 'Sign in, sign up, passwords' },
      { name: 'Leave requests', description: 'File, read and change requests' },
      { name: 'Decisions', description: 'Approve, reject, ask, reply, cancel' },
      { name: 'Calendar and numbers', description: 'Team calendar, home overview, balance' },
      { name: 'Holidays', description: 'Public holidays, kept by the HOD' },
      { name: 'People', description: 'Locations, managers, roles (HOD)' },
      { name: 'Allowance', description: 'Yearly leave allowance (30 days by default)' },
      { name: 'Notifications', description: 'In-app notices and email preferences' },
      { name: 'Audit', description: 'Who did what, and when (HOD)' },
    ],
    paths: {
      '/auth/login': {
        post: op('Auth', 'Sign in', {
          security: PUBLIC,
          requestBody: body({
            type: 'object',
            required: ['email', 'password'],
            properties: { email: { type: 'string' }, password: { type: 'string' } },
          }),
          responses: {
            200: ok('Signed in. Sets cookies and returns a token for API clients.', {
              type: 'object',
              properties: { token: { type: 'string' }, user: ref('Profile') },
            }),
            400: COMMON[400],
            401: err('Wrong email or password (BAD_CREDENTIALS).'),
            403: err('Email not confirmed yet (EMAIL_NOT_VERIFIED).'),
            423: err('Locked for a while after too many wrong passwords.'),
            429: err('Too many attempts from this device.'),
          },
        }),
      },
      '/auth/refresh': {
        post: op('Auth', 'Renew the session', {
          description: 'Uses the refresh cookie and replaces it. Presenting an old one signs every session out.',
          security: PUBLIC,
          responses: { 200: ok('New cookies set', { type: 'object', properties: { user: ref('Profile') } }), 401: COMMON[401] },
          auth: false,
        }),
      },
      '/auth/logout': { post: op('Auth', 'Sign out', { security: PUBLIC, responses: { 200: ok('Done') } }) },
      '/auth/me': {
        get: op('Auth', 'Who am I', {
          description: 'Your profile: ID, department, location, manager and leave balance.',
          responses: { 200: ok('Profile', { type: 'object', properties: { user: ref('Profile') } }) },
        }),
      },
      '/auth/options': {
        get: op('Auth', 'Is email set up', {
          security: PUBLIC,
          responses: { 200: ok('Options', { type: 'object', properties: { emailEnabled: { type: 'boolean' } } }) },
        }),
      },
      '/auth/signup': {
        post: op('Auth', 'Create an account', {
          description: 'New people start as employees with no manager. The HOD chooses their manager before they can apply.',
          security: PUBLIC,
          requestBody: body({
            type: 'object',
            required: ['name', 'email', 'password'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              password: { type: 'string', description: 'At least 8 characters with a letter and a number' },
            },
          }),
          responses: {
            201: ok('Created', {
              type: 'object',
              properties: { ok: { type: 'boolean' }, needsVerification: { type: 'boolean' }, message: { type: 'string' } },
            }),
            400: COMMON[400],
            409: err('There is already an account with that email (ACCOUNT_EXISTS).'),
          },
        }),
      },
      '/auth/verify-email': {
        post: op('Auth', 'Confirm an email address', {
          security: PUBLIC,
          requestBody: body({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }),
          responses: { 200: ok('Confirmed'), 400: err('Link expired or used (LINK_INVALID).') },
        }),
      },
      '/auth/resend-verification': {
        post: op('Auth', 'Send the confirmation again', {
          description: 'Same answer whether or not the address has an account.',
          security: PUBLIC,
          requestBody: body({ type: 'object', required: ['email'], properties: { email: { type: 'string' } } }),
          responses: { 200: ok('Done') },
        }),
      },
      '/auth/forgot-password': {
        post: op('Auth', 'Email a password reset link', {
          description: 'Same answer whether or not the address has an account. The link works for 60 minutes, once.',
          security: PUBLIC,
          requestBody: body({ type: 'object', required: ['email'], properties: { email: { type: 'string' } } }),
          responses: { 200: ok('Done') },
        }),
      },
      '/auth/check-reset': {
        post: op('Auth', 'Is a reset link still valid', {
          security: PUBLIC,
          requestBody: body({ type: 'object', required: ['token'], properties: { token: { type: 'string' } } }),
          responses: { 200: ok('Result', { type: 'object', properties: { valid: { type: 'boolean' } } }) },
        }),
      },
      '/auth/reset-password': {
        post: op('Auth', 'Choose a new password with the emailed link', {
          description: 'Signs out every other session and clears a lockout.',
          security: PUBLIC,
          requestBody: body({
            type: 'object',
            required: ['token', 'password'],
            properties: { token: { type: 'string' }, password: { type: 'string' } },
          }),
          responses: { 200: ok('Changed'), 400: err('Weak password, or the link expired (LINK_INVALID).') },
        }),
      },
      '/auth/change-password': {
        post: op('Auth', 'Change your password', {
          requestBody: body({
            type: 'object',
            required: ['currentPassword', 'newPassword'],
            properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string' } },
          }),
          responses: { 200: ok('Changed. Other devices are signed out.'), 400: COMMON[400] },
        }),
      },

      '/leaves': {
        post: op('Leave requests', 'File a leave request', {
          description:
            "Counts the days with the holidays for the person's location, and joins up with their other leave to decide if it is long. Long leave needs a document unless it is an emergency.",
          requestBody: leaveForm,
          responses: {
            201: ok('Created', ref('Leave')),
            ...only(400),
            409: err(
              'Overlaps other leave (OVERLAPPING_LEAVE), no manager yet (NO_MANAGER), not enough leave left (NOT_ENOUGH_LEAVE) or documents overdue (DOCUMENTS_OVERDUE).',
            ),
          },
        }),
        get: op('Leave requests', 'List requests', {
          parameters: [
            q('scope', 'mine (default), queue (waiting for you) or all (everyone you may see)', {
              type: 'string',
              enum: ['mine', 'queue', 'all'],
            }),
            q('status', 'Filter by status'),
            q('page', 'Page number', { type: 'integer' }),
            q('pageSize', 'Up to 50', { type: 'integer' }),
          ],
          responses: {
            200: ok('A page of requests', {
              type: 'object',
              properties: {
                items: { type: 'array', items: ref('Leave') },
                total: { type: 'integer' },
                page: { type: 'integer' },
                pageSize: { type: 'integer' },
              },
            }),
            ...only(403),
          },
        }),
      },
      '/leaves/obligations': {
        get: op('Leave requests', 'Emergency leave still owing documents', {
          responses: { 200: ok('What you owe and what you may apply for', { type: 'object' }) },
        }),
      },
      '/leaves/chain': {
        get: op('Leave requests', 'Check dates against your other leave', {
          description: 'What the dates cost and whether they join up with other leave into a long stretch. The apply form calls this.',
          parameters: [
            q('from', 'First day', { type: 'string', format: 'date' }),
            q('to', 'Last day', { type: 'string', format: 'date' }),
            q('excludeId', 'A request to leave out (when editing)'),
          ],
          responses: {
            200: ok('Result', {
              type: 'object',
              properties: {
                days: { type: 'number' },
                chainDays: { type: 'number' },
                absenceDays: { type: 'integer' },
                members: { type: 'array', items: { type: 'object' } },
              },
            }),
            ...only(400),
          },
        }),
      },
      '/leaves/calendar': {
        get: op('Calendar and numbers', 'Who is away', {
          description:
            "HOD: everyone. Manager: their team. Employee: own requests and teammates' approved leave, without reasons. At most about two months.",
          parameters: [q('from', 'First day', { type: 'string', format: 'date' }), q('to', 'Last day', { type: 'string', format: 'date' })],
          responses: {
            200: ok('Leave in the range and the holidays that apply to you', {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                holidays: { type: 'array', items: ref('Holiday') },
                items: { type: 'array', items: { type: 'object' } },
              },
            }),
            ...only(400),
          },
        }),
      },
      '/leaves/{id}': {
        get: op('Leave requests', 'One request, with its history', {
          parameters: [idParam],
          responses: { 200: ok('The request', ref('Leave')), ...only(404) },
        }),
        patch: op('Leave requests', 'Edit a request', {
          description: 'Only by its owner, and only before anyone has approved it.',
          parameters: [idParam],
          requestBody: leaveForm,
          responses: {
            200: ok('Updated', ref('Leave')),
            ...only(400, 403, 404),
            409: err('Already approved, overlaps, or not enough leave left.'),
          },
        }),
      },
      '/leaves/{id}/approve': { post: decision('Approve', false) },
      '/leaves/{id}/reject': { post: decision('Reject (a reason is required)', true) },
      '/leaves/{id}/request-info': { post: decision('Ask for more information (a question is required)', true) },
      '/leaves/{id}/reply': {
        post: op('Decisions', 'Answer a question', {
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: { message: { type: 'string' }, documents: { type: 'array', items: { type: 'string', format: 'binary' } } },
                },
              },
            },
          },
          responses: { 200: ok('Back with the approver', ref('Leave')), ...only(400, 403, 404), 409: err('Nothing to reply to.') },
        }),
      },
      '/leaves/{id}/cancel': {
        post: op('Decisions', 'Cancel a request', {
          description: 'By its owner, while it is open or until the leave starts.',
          parameters: [idParam],
          responses: { 200: ok('Cancelled', ref('Leave')), ...only(403, 404), 409: err('Cannot be cancelled now.') },
        }),
      },
      '/leaves/{id}/documents': {
        post: op('Leave requests', 'Send supporting documents', {
          description: 'Only for long leave.',
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: { type: 'object', properties: { documents: { type: 'array', items: { type: 'string', format: 'binary' } } } },
              },
            },
          },
          responses: { 200: ok('Updated', ref('Leave')), ...only(400, 403, 404) },
        }),
      },
      '/leaves/{id}/documents/{docId}': {
        get: op('Leave requests', 'Open a document', {
          description: 'Checked against who may see the request, and written to the audit log.',
          parameters: [idParam, { name: 'docId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'The file', content: { 'application/pdf': {}, 'image/jpeg': {}, 'image/png': {} } },
            ...only(404),
          },
        }),
      },

      '/stats': {
        get: op('Calendar and numbers', 'Numbers for the home screen', {
          responses: { 200: ok('Your numbers. Managers and the HOD also get queue, team and decisions.', ref('Stats')) },
        }),
      },
      '/balance': {
        get: op('Calendar and numbers', 'Your leave balance', {
          parameters: [q('year', 'Defaults to this year', { type: 'integer' })],
          responses: { 200: ok('Balance', ref('Balance')) },
        }),
      },

      '/holidays': {
        get: op('Holidays', 'Holidays that apply to you', {
          description: 'National holidays plus those of your own location. The HOD can add all=true or location=Name.',
          parameters: [
            q('from', 'First day', { type: 'string', format: 'date' }),
            q('to', 'Last day', { type: 'string', format: 'date' }),
            q('location', 'HOD only'),
            q('all', 'HOD only: true for every location'),
          ],
          responses: { 200: ok('Holidays', { type: 'object', properties: { items: { type: 'array', items: ref('Holiday') } } }) },
        }),
        post: op('Holidays', 'Add a holiday (HOD)', {
          requestBody: body({
            type: 'object',
            required: ['date', 'name'],
            properties: {
              date: { type: 'string', description: '2026-10-02, 02/10/2026 or 2 Oct 2026' },
              name: { type: 'string' },
              location: { type: 'string', description: 'Empty for everyone' },
            },
          }),
          responses: {
            201: ok('Added', ref('Holiday')),
            ...only(400, 403),
            409: err('Already listed for that location (HOLIDAY_EXISTS).'),
          },
        }),
      },
      '/holidays/import': {
        post: op('Holidays', 'Add many holidays from a list (HOD)', {
          description:
            'Columns: date, name, location (blank or National = everyone). Header optional. Nothing is saved if any line has an error; dates already listed are skipped.',
          requestBody: csvBody,
          responses: { 200: ok('What was found', ref('ImportResult')), ...only(400, 403) },
        }),
      },
      '/holidays/{id}': {
        delete: op('Holidays', 'Remove a holiday (HOD)', {
          parameters: [idParam],
          responses: { 200: ok('Removed', ref('Holiday')), ...only(403, 404) },
        }),
      },

      '/locations': {
        get: op('People', 'Work locations', {
          responses: {
            200: ok('Locations with people and holiday counts', {
              type: 'object',
              properties: { items: { type: 'array', items: ref('Location') } },
            }),
          },
        }),
        post: op('People', 'Add a location (HOD)', {
          requestBody: body({ type: 'object', required: ['name'], properties: { name: { type: 'string' } } }),
          responses: { 201: ok('Added', ref('Location')), ...only(400, 403), 409: err('Already exists (LOCATION_EXISTS).') },
        }),
      },
      '/locations/{id}': {
        delete: op('People', 'Remove a location (HOD)', {
          parameters: [idParam],
          responses: { 200: ok('Removed'), ...only(403, 404), 409: err('It still has people or holidays (LOCATION_IN_USE).') },
        }),
      },
      '/people': {
        get: op('People', 'Everyone, for setting up (HOD)', {
          description: 'People who signed up and still need a manager come first (`needsSetup`).',
          responses: {
            200: ok('People', { type: 'object', properties: { items: { type: 'array', items: ref('Person') } } }),
            ...only(403),
          },
        }),
      },
      '/people/{id}/manager': {
        patch: op('People', "Choose an employee's manager (HOD)", {
          parameters: [idParam],
          requestBody: body({ type: 'object', required: ['managerId'], properties: { managerId: { type: 'string' } } }),
          responses: { 200: ok('Done'), ...only(400, 403, 404) },
        }),
      },
      '/people/{id}/role': {
        patch: op('People', 'Make someone a manager, or an employee again (HOD)', {
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            required: ['role'],
            properties: { role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER'] } },
          }),
          responses: { 200: ok('Done'), ...only(400, 403, 404), 409: err('Someone still reports to them (HAS_REPORTS).') },
        }),
      },
      '/people/{id}/location': {
        patch: op('People', 'Set where someone works (HOD)', {
          parameters: [idParam],
          requestBody: body({ type: 'object', required: ['location'], properties: { location: { type: 'string', nullable: true } } }),
          responses: { 200: ok('Done'), ...only(400, 403, 404) },
        }),
      },

      '/allowances': {
        get: op('Allowance', "Everyone's allowance and usage (HOD)", {
          parameters: [q('year', 'Defaults to this year', { type: 'integer' })],
          responses: {
            200: ok('Allowances', {
              type: 'object',
              properties: {
                year: { type: 'integer' },
                defaultDays: { type: 'number' },
                items: { type: 'array', items: ref('AllowanceRow') },
              },
            }),
            ...only(403),
          },
        }),
      },
      '/allowances/default': {
        put: op('Allowance', 'Change the default for everyone (HOD)', {
          requestBody: body({ type: 'object', required: ['days'], properties: { days: { type: 'number', minimum: 0, maximum: 365 } } }),
          responses: { 200: ok('Saved'), ...only(400, 403) },
        }),
      },
      '/allowances/import': {
        post: op('Allowance', 'Set allowances from a list (HOD)', {
          description:
            'Columns: email, allowance, year (optional). A line with email `default` sets the default for everyone. Same all-or-nothing rule as the holiday import.',
          requestBody: csvBody,
          responses: { 200: ok('What was found', ref('ImportResult')), ...only(400, 403) },
        }),
      },
      '/allowances/{userId}': {
        put: op('Allowance', "Set one person's allowance for a year (HOD)", {
          parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: body({ type: 'object', required: ['days'], properties: { days: { type: 'number' }, year: { type: 'integer' } } }),
          responses: { 200: ok('Saved'), ...only(400, 403, 404) },
        }),
        delete: op('Allowance', 'Put someone back on the default (HOD)', {
          parameters: [
            { name: 'userId', in: 'path', required: true, schema: { type: 'string' } },
            q('year', 'Defaults to this year', { type: 'integer' }),
          ],
          responses: { 200: ok('Done'), ...only(403, 404) },
        }),
      },

      '/notifications': {
        get: op('Notifications', 'Your notices', {
          parameters: [q('limit', 'Up to 100', { type: 'integer' })],
          responses: {
            200: ok('Notices, newest first', {
              type: 'object',
              properties: { unread: { type: 'integer' }, items: { type: 'array', items: ref('Notification') } },
            }),
          },
        }),
      },
      '/notifications/read': {
        post: op('Notifications', 'Mark notices as read', {
          requestBody: body({
            type: 'object',
            properties: { ids: { type: 'array', items: { type: 'string' } }, all: { type: 'boolean' } },
          }),
          responses: { 200: ok('How many were marked', { type: 'object', properties: { updated: { type: 'integer' } } }), ...only(400) },
        }),
      },
      '/preferences': {
        patch: op('Notifications', 'Email notices on or off', {
          description: 'In-app notices are always on. Emails are never sent to made-up addresses such as @akasa.demo.',
          requestBody: body({ type: 'object', required: ['emailNotifications'], properties: { emailNotifications: { type: 'boolean' } } }),
          responses: { 200: ok('Saved'), ...only(400) },
        }),
      },

      '/audit': {
        get: op('Audit', 'The audit log (HOD)', {
          parameters: [
            q('action', 'For example LEAVE_APPROVE'),
            q('q', 'Search names and details'),
            q('page', 'Page number', { type: 'integer' }),
            q('pageSize', 'Up to 100', { type: 'integer' }),
          ],
          responses: {
            200: ok('Entries, newest first. Entries cannot be changed through the API.', {
              type: 'object',
              properties: { items: { type: 'array', items: ref('AuditEntry') }, total: { type: 'integer' } },
            }),
            ...only(403),
          },
        }),
      },
    },
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'lms_access',
          description: 'Set by POST /auth/login. Writes must also send X-Requested-With: lms.',
        },
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'The `token` returned by POST /auth/login' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_FAILED' },
                message: { type: 'string' },
                hint: { type: 'string' },
                fields: { type: 'object', additionalProperties: { type: 'string' } },
              },
            },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['EMPLOYEE', 'MANAGER', 'HOD'] },
            employeeCode: { type: 'string', example: 'AKA-0007' },
            department: { type: 'string' },
            location: { type: 'string', nullable: true },
            managerName: { type: 'string', nullable: true },
            joinedAt: { type: 'string', format: 'date-time' },
            emailVerified: { type: 'boolean' },
            emailNotifications: { type: 'boolean' },
            balance: ref('Balance'),
          },
        },
        Balance: {
          type: 'object',
          properties: {
            year: { type: 'integer' },
            allowance: { type: 'number', example: 30 },
            custom: { type: 'boolean' },
            used: { type: 'number' },
            pending: { type: 'number' },
            remaining: { type: 'number' },
          },
        },
        Leave: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            employeeId: { type: 'string' },
            employeeName: { type: 'string' },
            fromDate: { type: 'string', format: 'date' },
            toDate: { type: 'string', format: 'date' },
            days: { type: 'number', description: 'Charged days: Sundays and public holidays left out' },
            absenceDays: { type: 'integer', description: 'Days in a row away, first to last day' },
            chainDays: { type: 'number' },
            excluded: { type: 'object', properties: { sundays: { type: 'integer' }, holidays: { type: 'array', items: ref('Holiday') } } },
            isLong: { type: 'boolean' },
            isEmergency: { type: 'boolean' },
            splitFlag: { type: 'boolean', description: 'Short alone but joins other leave into a long stretch' },
            joinedWith: { type: 'array', items: { type: 'object' } },
            reason: { type: 'string' },
            status: { type: 'string', enum: ['PENDING_MANAGER', 'PENDING_HOD', 'INFO_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'] },
            allowedActions: { type: 'array', items: { type: 'string' }, description: 'What the signed-in person can do with it now' },
            documentsPending: { type: 'boolean' },
            documentsDueBy: { type: 'string', nullable: true },
            documents: { type: 'array', items: { type: 'object' } },
            timeline: { type: 'array', items: { type: 'object' } },
            version: { type: 'integer' },
          },
        },
        Holiday: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            date: { type: 'string', format: 'date' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true, description: 'null = national' },
          },
        },
        Location: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, people: { type: 'integer' }, holidays: { type: 'integer' } },
        },
        Person: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            role: { type: 'string' },
            location: { type: 'string', nullable: true },
            managerId: { type: 'string', nullable: true },
            managerName: { type: 'string', nullable: true },
            needsSetup: { type: 'boolean' },
          },
        },
        AllowanceRow: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            employeeCode: { type: 'string' },
            allowance: { type: 'number' },
            custom: { type: 'boolean' },
            used: { type: 'number' },
            pending: { type: 'number' },
            remaining: { type: 'number' },
          },
        },
        ImportResult: {
          type: 'object',
          properties: {
            applied: { type: 'boolean' },
            summary: { type: 'object', additionalProperties: { type: 'integer' } },
            rows: {
              type: 'array',
              items: { type: 'object', properties: { line: { type: 'integer' }, status: { type: 'string' }, message: { type: 'string' } } },
            },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kind: { type: 'string', enum: ['WAITING', 'APPROVED', 'APPROVED_STEP', 'REJECTED', 'QUESTION', 'CANCELLED'] },
            title: { type: 'string' },
            body: { type: 'string' },
            leaveId: { type: 'string', nullable: true },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Stats: {
          type: 'object',
          properties: {
            mine: { type: 'object' },
            queue: { type: 'object' },
            team: { type: 'object' },
            decisions: { type: 'object' },
            awaitingSetup: { type: 'integer', description: 'HOD only' },
          },
        },
        AuditEntry: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            at: { type: 'string', format: 'date-time' },
            actorName: { type: 'string' },
            actorRole: { type: 'string' },
            action: { type: 'string' },
            detail: { type: 'string' },
            ip: { type: 'string' },
          },
        },
      },
    },
  };
}
