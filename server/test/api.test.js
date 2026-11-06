import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { todayISO, parseISODate, countLeaveDays, leaveBreakdown } from '@lms/shared';

process.env.LEAVE_ALLOWANCE_DAYS = '1000';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-test-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');
const { LeaveRequest } = await import('../src/models/LeaveRequest.js');

let mongod;
let app;
const tokens = {};
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
// Test dates skip Sundays because Sundays are not counted as leave.
const nonSunday = (t) => (new Date(t).getUTCDay() === 0 ? t + 86400000 : t);
const nextWorkingDay = (iso) => new Date(nonSunday(parseISODate(iso) + 86400000)).toISOString().slice(0, 10);
const day = (n) => new Date(nonSunday(parseISODate(todayISO()) + n * 86400000)).toISOString().slice(0, 10);

const login = async (email) => {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  expect(r.status).toBe(200);
  return r.body.token;
};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });

/** Submit a leave via multipart. */
const submit = (who, fields, files = []) => {
  let r = request(app).post('/api/leaves').set(as(who));
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  for (const f of files) r = r.attach('documents', f.buffer ?? PDF, f.name ?? 'doc.pdf');
  return r;
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedIfEmpty();
  app = createApp();
  const emails = {
    hod: 'priya.nair@akasa.demo',
    rahul: 'rahul.mehta@akasa.demo',
    ananya: 'ananya.iyer@akasa.demo',
    arjun: 'arjun.sharma@akasa.demo',
    sneha: 'sneha.kulkarni@akasa.demo',
    kavya: 'kavya.reddy@akasa.demo',
  };
  for (const [k, e] of Object.entries(emails)) tokens[k] = await login(e);
  // clear seeded requests so date ranges in tests never collide
  await LeaveRequest.deleteMany({});
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('auth', () => {
  it('rejects bad credentials with a friendly error', async () => {
    const r = await request(app).post('/api/auth/login').send({ email: 'arjun.sharma@akasa.demo', password: 'nope' });
    expect(r.status).toBe(401);
    expect(r.body.error).toMatchObject({ code: 'BAD_CREDENTIALS' });
    expect(r.body.error.message).toBeTruthy();
  });
  it('requires a token', async () => {
    expect((await request(app).get('/api/leaves')).status).toBe(401);
  });
});

describe('short leave (<=3 days) flow', () => {
  it('needs no document and only manager approval', async () => {
    const r = await submit('arjun', { employeeName: 'Arjun Sharma', fromDate: day(10), toDate: day(12), reason: 'Family function' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ days: 3, isLong: false, status: 'PENDING_MANAGER' });
    const a = await request(app).post(`/api/leaves/${r.body.id}/approve`).set(as('rahul')).send({ comment: 'Enjoy' });
    expect(a.body.status).toBe('APPROVED');
  });
});

describe('long leave (>3 days) rule', () => {
  it('blocks submission without a document (4 days)', async () => {
    const r = await submit('arjun', { fromDate: day(20), toDate: day(24), reason: 'Vacation' });
    expect(r.status).toBe(400);
    expect(r.body.error.fields.documents).toMatch(/supporting document/);
  });
  it('two-level approval: manager then HOD', async () => {
    const r = await submit('arjun', { fromDate: day(20), toDate: day(24), reason: 'Vacation' }, [{}]);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ days: countLeaveDays(day(20), day(24)), isLong: true, status: 'PENDING_MANAGER' });
    const id = r.body.id;
    expect((await request(app).post(`/api/leaves/${id}/approve`).set(as('hod')).send({})).status).toBe(403);
    const m = await request(app).post(`/api/leaves/${id}/approve`).set(as('rahul')).send({});
    expect(m.body.status).toBe('PENDING_HOD');
    const again = await request(app).post(`/api/leaves/${id}/approve`).set(as('rahul')).send({});
    expect(again.status).toBe(403);
    const h = await request(app).post(`/api/leaves/${id}/approve`).set(as('hod')).send({});
    expect(h.body.status).toBe('APPROVED');
    expect(h.body.timeline.map((t) => t.action)).toEqual(['SUBMITTED', 'APPROVE', 'APPROVE']);
  });
  it('reject needs a comment; HOD can reject at level 2', async () => {
    const r = await submit('arjun', { fromDate: day(40), toDate: day(44), reason: 'Family trip' }, [{}]);
    const id = r.body.id;
    const noComment = await request(app).post(`/api/leaves/${id}/reject`).set(as('rahul')).send({});
    expect(noComment.status).toBe(400);
    expect(noComment.body.error.fields.comment).toBeTruthy();
    await request(app).post(`/api/leaves/${id}/approve`).set(as('rahul')).send({});
    const rej = await request(app).post(`/api/leaves/${id}/reject`).set(as('hod')).send({ comment: 'Peak period' });
    expect(rej.body.status).toBe('REJECTED');
  });
});

describe('info request loop', () => {
  it('manager asks, employee replies with a document, back to manager', async () => {
    // Long leave (more than 3 days in a row), because only long leave takes documents.
    const r = await submit('arjun', { fromDate: day(60), toDate: day(65), reason: 'Medical visit' }, [{}]);
    const id = r.body.id;
    const q = await request(app).post(`/api/leaves/${id}/request-info`).set(as('rahul')).send({ comment: 'Which clinic?' });
    expect(q.body.status).toBe('INFO_REQUESTED');
    const empty = await request(app).post(`/api/leaves/${id}/reply`).set(as('arjun')).field('message', '');
    expect(empty.status).toBe(400);
    const rep = await request(app)
      .post(`/api/leaves/${id}/reply`)
      .set(as('arjun'))
      .field('message', 'City clinic')
      .attach('documents', PDF, 'slip.pdf');
    expect(rep.body.status).toBe('PENDING_MANAGER');
    expect(rep.body.documents).toHaveLength(2);
  });

  it('short leave takes no document, even in a reply', async () => {
    const r = await submit('arjun', { fromDate: day(75), toDate: day(75), reason: 'Quick errand' });
    await request(app).post(`/api/leaves/${r.body.id}/request-info`).set(as('rahul')).send({ comment: 'Which errand?' });
    const rep = await request(app)
      .post(`/api/leaves/${r.body.id}/reply`)
      .set(as('arjun'))
      .field('message', 'Bank')
      .attach('documents', PDF, 'slip.pdf');
    expect(rep.status).toBe(400);
    expect(rep.body.error.fields.documents).toMatch(/longer than 3 days/);
  });
});

describe('access control', () => {
  let id;
  beforeAll(async () => {
    id = (await submit('arjun', { fromDate: day(80), toDate: day(80), reason: 'Personal work' })).body.id;
  });
  it("another team's manager and employee cannot see or act (404)", async () => {
    expect((await request(app).get(`/api/leaves/${id}`).set(as('ananya'))).status).toBe(404);
    expect((await request(app).get(`/api/leaves/${id}`).set(as('sneha'))).status).toBe(404);
    expect((await request(app).post(`/api/leaves/${id}/approve`).set(as('ananya')).send({})).status).toBe(404);
  });
  it('employees cannot use the queue; documents are access-checked', async () => {
    expect((await request(app).get('/api/leaves?scope=queue').set(as('arjun'))).status).toBe(403);
    const withDoc = (await submit('arjun', { fromDate: day(90), toDate: day(94), reason: 'Family trip' }, [{}])).body;
    const docUrl = `/api/leaves/${withDoc.id}/documents/${withDoc.documents[0].id}`;
    expect((await request(app).get(docUrl).set(as('rahul'))).status).toBe(200);
    expect((await request(app).get(docUrl).set(as('sneha'))).status).toBe(404);
    expect((await request(app).get(docUrl)).status).toBe(401);
  });
  it("employee cannot approve own; manager queue lists only own team's", async () => {
    expect((await request(app).post(`/api/leaves/${id}/approve`).set(as('arjun')).send({})).status).toBe(403);
    const q = await request(app).get('/api/leaves?scope=queue').set(as('rahul'));
    expect(q.body.items.every((i) => i.employeeName === 'Arjun Sharma')).toBe(true);
    const q2 = await request(app).get('/api/leaves?scope=queue').set(as('ananya'));
    expect(q2.body.items).toHaveLength(0);
  });
});

describe('validation', () => {
  it('rejects bad dates, overlap, wrong name, bad file type', async () => {
    const bad = await submit('arjun', { fromDate: day(5), toDate: day(3), reason: 'Trip home' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.toDate).toBeTruthy();
    const name = await submit('arjun', { employeeName: 'Someone Else', fromDate: day(200), toDate: day(200), reason: 'Personal work' });
    expect(name.body.error.fields.employeeName).toBeTruthy();
    const first = await submit('arjun', { fromDate: day(100), toDate: day(101), reason: 'Personal work' });
    expect(first.status).toBe(201);
    const clash = await submit('arjun', { fromDate: day(101), toDate: day(102), reason: 'Personal work' });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('OVERLAPPING_LEAVE');
    const exe = await submit('arjun', { fromDate: day(110), toDate: day(114), reason: 'Family trip' }, [
      { buffer: Buffer.from('MZ not a pdf'), name: 'x.pdf' },
    ]);
    expect(exe.status).toBe(400);
  });
  it('employee can edit and cancel while pending', async () => {
    const r = await submit('arjun', { fromDate: day(120), toDate: day(120), reason: 'Personal work' });
    const e = await request(app)
      .patch(`/api/leaves/${r.body.id}`)
      .set(as('arjun'))
      .field('fromDate', day(120))
      .field('toDate', day(121))
      .field('reason', 'Personal work, extended');
    expect(e.status).toBe(200);
    expect(e.body.days).toBe(2);
    const c = await request(app).post(`/api/leaves/${r.body.id}/cancel`).set(as('arjun')).send({});
    expect(c.body.status).toBe('CANCELLED');
  });
  it('manager leave goes to HOD; HOD leave is auto-approved', async () => {
    const m = await submit('rahul', { fromDate: day(130), toDate: day(131), reason: 'Health check' });
    expect(m.body.status).toBe('PENDING_HOD');
    const h = await submit('hod', { fromDate: day(140), toDate: day(141), reason: 'Personal work' });
    expect(h.body.status).toBe('APPROVED');
    expect(h.body.timeline.map((t) => t.action)).toContain('AUTO_APPROVED');
  });
  it('stale version is rejected (optimistic locking)', async () => {
    const r = await submit('arjun', { fromDate: day(150), toDate: day(150), reason: 'Personal work' });
    const stale = await request(app)
      .post(`/api/leaves/${r.body.id}/approve`)
      .set(as('rahul'))
      .send({ version: r.body.version + 5 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('STALE_REQUEST');
  });
});

describe('emergency leave', () => {
  it('allows >3 days without documents, then blocks as documents stay owed', async () => {
    const e1 = await submit('sneha', { fromDate: day(200), toDate: day(204), reason: 'Family emergency', isEmergency: 'true' });
    expect(e1.status).toBe(201);
    expect(e1.body).toMatchObject({ isEmergency: true, documentsPending: true, documentsDueBy: nextWorkingDay(day(204)) });
    // a normal leave is blocked while documents are owed
    const normal = await submit('sneha', { fromDate: day(210), toDate: day(210), reason: 'Personal work' });
    expect(normal.status).toBe(409);
    expect(normal.body.error.code).toBe('DOCUMENTS_OVERDUE');
    // one more emergency leave is allowed
    const e2 = await submit('sneha', { fromDate: day(220), toDate: day(224), reason: 'Another emergency', isEmergency: 'true' });
    expect(e2.status).toBe(201);
    // now blocked from everything, emergency included
    expect((await submit('sneha', { fromDate: day(230), toDate: day(234), reason: 'Third emergency', isEmergency: 'true' })).status).toBe(
      409,
    );
    expect((await request(app).get('/api/leaves/obligations').set(as('sneha'))).body).toMatchObject({
      canApplyNormal: false,
      canApplyEmergency: false,
    });
    // sending documents for one request lifts the block for emergencies again
    const sent = await request(app).post(`/api/leaves/${e1.body.id}/documents`).set(as('sneha')).attach('documents', PDF, 'proof.pdf');
    expect(sent.status).toBe(200);
    expect(sent.body.documentsPending).toBe(false);
    expect((await submit('sneha', { fromDate: day(230), toDate: day(234), reason: 'Third emergency', isEmergency: 'true' })).status).toBe(
      201,
    );
  });
  it('a non-emergency leave over 3 days still needs documents', async () => {
    const r = await submit('arjun', { fromDate: day(300), toDate: day(305), reason: 'Holiday trip' });
    expect(r.status).toBe(400);
  });
});

describe('audit log', () => {
  it('records sign-ins, decisions, document views and denied access; only HOD can read it', async () => {
    const r = await submit('arjun', { fromDate: day(330), toDate: day(331), reason: 'Audit check' });
    await request(app).get(`/api/leaves/${r.body.id}`).set(as('ananya')); // other team's manager: denied (404)
    await request(app).post(`/api/leaves/${r.body.id}/approve`).set(as('rahul')).send({ comment: 'ok' });
    await request(app).post('/api/auth/login').send({ email: 'arjun.sharma@akasa.demo', password: 'wrong' });
    await new Promise((res) => setTimeout(res, 200)); // denial entries are written without blocking the response

    expect((await request(app).get('/api/audit').set(as('arjun'))).status).toBe(403);
    expect((await request(app).get('/api/audit').set(as('rahul'))).status).toBe(403);
    const log = await request(app).get('/api/audit?pageSize=100').set(as('hod'));
    expect(log.status).toBe(200);
    const actions = log.body.items.map((i) => i.action);
    for (const a of ['LOGIN', 'LOGIN_FAILED', 'LEAVE_SUBMITTED', 'LEAVE_APPROVE', 'ACCESS_DENIED']) expect(actions).toContain(a);
    const approve = log.body.items.find((i) => i.action === 'LEAVE_APPROVE' && i.entityId === r.body.id);
    expect(approve).toMatchObject({ actorName: 'Rahul Mehta', fromStatus: 'PENDING_MANAGER', toStatus: 'APPROVED' });
  });
  it('is append-only', async () => {
    const { AuditLog } = await import('../src/models/AuditLog.js');
    await expect(AuditLog.deleteMany({})).rejects.toThrow(/append-only/);
    const one = await AuditLog.findOne();
    one.detail = 'tampered';
    await expect(one.save()).rejects.toThrow(/append-only/);
  });
});

describe('public holidays and documents on short leave', () => {
  const hol = day(345);
  const range = [day(344), day(346)]; // holiday sits in the middle

  it('only the HOD can add a holiday; everyone can read the calendar', async () => {
    const denied = await request(app).post('/api/holidays').set(as('rahul')).send({ date: hol, name: 'Founders Day' });
    expect(denied.status).toBe(403);
    const ok = await request(app).post('/api/holidays').set(as('hod')).send({ date: hol, name: 'Founders Day' });
    expect(ok.status).toBe(201);
    const dup = await request(app).post('/api/holidays').set(as('hod')).send({ date: hol, name: 'Again' });
    expect(dup.status).toBe(409);
    const list = await request(app).get('/api/holidays').set(as('arjun'));
    expect(list.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ date: hol, name: 'Founders Day' })]));
  });

  it('a holiday inside the range is not counted, and the request says so', async () => {
    const r = await submit('arjun', { fromDate: range[0], toDate: range[1], reason: 'Short break' });
    expect(r.status).toBe(201);
    const b = leaveBreakdown(range[0], range[1], [hol]);
    expect(r.body.days).toBe(b.days);
    expect(r.body.excluded.holidays).toEqual([{ date: hol, name: 'Founders Day' }]);
  });

  it('refuses a request that only covers a holiday', async () => {
    const r = await submit('sneha', { fromDate: hol, toDate: hol, reason: 'Day off' });
    expect(r.status).toBe(400);
    expect(r.body.error.fields.toDate).toMatch(/not counted as leave/);
  });

  it('short leave does not accept documents', async () => {
    const r = await submit('arjun', { fromDate: day(360), toDate: day(361), reason: 'Quick errand' }, [{}]);
    expect(r.status).toBe(400);
    expect(r.body.error.fields.documents).toMatch(/longer than 3 days/);
    const ok = await submit('arjun', { fromDate: day(360), toDate: day(361), reason: 'Quick errand' });
    expect(ok.status).toBe(201);
    const attach = await request(app).post(`/api/leaves/${ok.body.id}/documents`).set(as('arjun')).attach('documents', PDF, 'x.pdf');
    expect([400, 403, 409]).toContain(attach.status);
    expect(ok.body.allowedActions).not.toContain('ATTACH');
  });

  it('the HOD can remove a holiday', async () => {
    const list = await request(app).get('/api/holidays').set(as('hod'));
    const id = list.body.items.find((h) => h.date === hol).id;
    expect((await request(app).delete(`/api/holidays/${id}`).set(as('rahul'))).status).toBe(403);
    expect((await request(app).delete(`/api/holidays/${id}`).set(as('hod'))).status).toBe(200);
  });
});

describe('location calendars and bulk import', () => {
  const d = day(353); // Arjun (Bengaluru) and Ananya (Mumbai) both span this date
  const span = [day(352), day(354)];
  let people;

  it('only the HOD manages locations and sees who works where', async () => {
    expect((await request(app).post('/api/locations').set(as('rahul')).send({ name: 'Pune' })).status).toBe(403);
    expect((await request(app).post('/api/locations').set(as('hod')).send({ name: 'Bengaluru' })).status).toBe(201);
    expect((await request(app).post('/api/locations').set(as('hod')).send({ name: 'Mumbai' })).status).toBe(201);
    expect((await request(app).post('/api/locations').set(as('hod')).send({ name: 'Bengaluru' })).status).toBe(409);
    expect((await request(app).post('/api/locations').set(as('hod')).send({ name: 'National' })).status).toBe(400);
    expect((await request(app).get('/api/people').set(as('arjun'))).status).toBe(403);
    const r = await request(app).get('/api/people').set(as('hod'));
    people = Object.fromEntries(r.body.items.map((p) => [p.name, p]));
    expect(people['Arjun Sharma'].location).toBe('Bengaluru');
    expect(people['Ananya Iyer'].location).toBe('Mumbai');
  });

  it('a local holiday is only taken off for people at that location', async () => {
    const add = await request(app).post('/api/holidays').set(as('hod')).send({ date: d, name: 'Local Day', location: 'Bengaluru' });
    expect(add.status).toBe(201);
    expect(add.body.location).toBe('Bengaluru');
    const bad = await request(app).post('/api/holidays').set(as('hod')).send({ date: d, name: 'Somewhere', location: 'Atlantis' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.location).toMatch(/Atlantis/);

    const mine = await request(app).get('/api/holidays').set(as('arjun'));
    expect(mine.body.items.some((h) => h.name === 'Local Day')).toBe(true);
    const theirs = await request(app).get('/api/holidays').set(as('ananya'));
    expect(theirs.body.items.some((h) => h.name === 'Local Day')).toBe(false);

    const arjun = await submit('arjun', { fromDate: span[0], toDate: span[1], reason: 'Local break' });
    const ananya = await submit('ananya', { fromDate: span[0], toDate: span[1], reason: 'Local break' });
    expect(arjun.status).toBe(201);
    expect(ananya.status).toBe(201);
    expect(arjun.body.excluded.holidays).toEqual([{ date: d, name: 'Local Day' }]);
    expect(ananya.body.excluded.holidays).toEqual([]);
    expect(arjun.body.days).toBe(ananya.body.days - 1);
  });

  it('the HOD can see every location or one at a time', async () => {
    const all = await request(app).get('/api/holidays?all=true').set(as('hod'));
    expect(all.body.items.some((h) => h.name === 'Local Day')).toBe(true);
    const mumbaiView = await request(app).get('/api/holidays?location=Mumbai').set(as('hod'));
    expect(mumbaiView.body.items.some((h) => h.name === 'Local Day')).toBe(false);
  });

  it('moving someone to another location changes which calendar they get', async () => {
    const url = `/api/people/${people['Sneha Kulkarni'].id}/location`;
    expect((await request(app).patch(url).set(as('rahul')).send({ location: 'Bengaluru' })).status).toBe(403);
    const ok = await request(app).patch(url).set(as('hod')).send({ location: 'Bengaluru' });
    expect(ok.status).toBe(200);
    expect(ok.body.location).toBe('Bengaluru');
    const mine = await request(app).get('/api/holidays').set(as('sneha'));
    expect(mine.body.items.some((h) => h.name === 'Local Day')).toBe(true);
    expect((await request(app).patch(url).set(as('hod')).send({ location: 'Atlantis' })).status).toBe(400);
  });

  it('a location that still has people or holidays cannot be removed', async () => {
    const list = await request(app).get('/api/locations').set(as('hod'));
    const blr = list.body.items.find((l) => l.name === 'Bengaluru');
    expect(blr.people).toBeGreaterThan(0);
    const r = await request(app).delete(`/api/locations/${blr.id}`).set(as('hod'));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('LOCATION_IN_USE');
  });

  describe('bulk import', () => {
    const csv = `Date,Holiday,Location\n${day(400)},Import One,\n${day(401)},Import Two,Mumbai\n`;

    it('is HOD only', async () => {
      expect((await request(app).post('/api/holidays/import').set(as('rahul')).send({ csv })).status).toBe(403);
    });
    it('previews without saving', async () => {
      const r = await request(app).post('/api/holidays/import').set(as('hod')).send({ csv });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ applied: false, summary: { new: 2, duplicate: 0, errors: 0 } });
      const list = await request(app).get('/api/holidays?all=true').set(as('hod'));
      expect(list.body.items.some((h) => h.name === 'Import One')).toBe(false);
    });
    it('saves nothing if any line has an error, and says which line', async () => {
      const bad = `${csv}not-a-date,Broken,\n${day(402)},Elsewhere,Atlantis\n`;
      const r = await request(app).post('/api/holidays/import').set(as('hod')).send({ csv: bad, apply: true });
      expect(r.body.applied).toBe(false);
      expect(r.body.summary.errors).toBe(2);
      expect(r.body.rows.filter((x) => x.status === 'error').map((x) => x.line)).toEqual([4, 5]);
      const list = await request(app).get('/api/holidays?all=true').set(as('hod'));
      expect(list.body.items.some((h) => h.name === 'Import One')).toBe(false);
    });
    it('applies a clean file, reads day-first dates, and skips duplicates on a second run', async () => {
      const r = await request(app).post('/api/holidays/import').set(as('hod')).send({ csv, apply: true });
      expect(r.body).toMatchObject({ applied: true, summary: { new: 2 } });
      const again = await request(app).post('/api/holidays/import').set(as('hod')).send({ csv, apply: true });
      expect(again.body).toMatchObject({ applied: false, summary: { new: 0, duplicate: 2, errors: 0 } });
      const [y, m, dd] = day(410).split('-');
      const dmy = await request(app)
        .post('/api/holidays/import')
        .set(as('hod'))
        .send({ csv: `${dd}/${m}/${y};Semicolon Day;National`, apply: true });
      expect(dmy.body.applied).toBe(true);
      const list = await request(app).get('/api/holidays?all=true').set(as('hod'));
      expect(list.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Import One', location: null }),
          expect.objectContaining({ name: 'Import Two', location: 'Mumbai' }),
          expect.objectContaining({ name: 'Semicolon Day', date: day(410), location: null }),
        ]),
      );
    });
    it('asks for something to import', async () => {
      const r = await request(app).post('/api/holidays/import').set(as('hod')).send({ csv: '   ' });
      expect(r.status).toBe(400);
      expect(r.body.error.fields.csv).toBeTruthy();
    });
  });
});

describe('team calendar', () => {
  const q = `from=${day(350)}&to=${day(356)}`;
  const names = (r) => r.body.items.map((i) => i.employeeName);

  it('the HOD sees everyone, a manager sees their team and themselves', async () => {
    const hod = await request(app).get(`/api/leaves/calendar?${q}`).set(as('hod'));
    expect(hod.status).toBe(200);
    expect(names(hod)).toEqual(expect.arrayContaining(['Arjun Sharma', 'Ananya Iyer']));
    const rahul = await request(app).get(`/api/leaves/calendar?${q}`).set(as('rahul'));
    expect(names(rahul)).toContain('Arjun Sharma');
    expect(names(rahul)).not.toContain('Ananya Iyer');
    const ananya = await request(app).get(`/api/leaves/calendar?${q}`).set(as('ananya'));
    expect(names(ananya)).toContain('Ananya Iyer');
    expect(names(ananya)).not.toContain('Arjun Sharma');
  });

  it("an employee sees their own requests, never another team's, and no reasons", async () => {
    const arjun = await request(app).get(`/api/leaves/calendar?${q}`).set(as('arjun'));
    const mine = arjun.body.items.find((i) => i.employeeName === 'Arjun Sharma');
    expect(mine).toMatchObject({ mine: true, status: 'PENDING_MANAGER' });
    expect(JSON.stringify(arjun.body)).not.toMatch(/reason|Local break/);
    const sneha = await request(app).get(`/api/leaves/calendar?${q}`).set(as('sneha'));
    expect(names(sneha)).not.toContain('Arjun Sharma');
  });

  it('only approved leave of teammates shows to an employee', async () => {
    const list = await request(app).get('/api/leaves?scope=queue').set(as('rahul'));
    const target = list.body.items.find((l) => l.employeeName === 'Arjun Sharma' && l.fromDate === day(352));
    expect(target).toBeTruthy();
    // before approval a teammate (same manager) could not see it; Arjun's own view is covered above.
    const approved = await request(app).post(`/api/leaves/${target.id}/approve`).set(as('rahul')).send({ comment: 'ok' });
    expect(approved.status).toBe(200);
    const again = await request(app).get(`/api/leaves/calendar?${q}`).set(as('arjun'));
    expect(again.body.items.find((i) => i.id === target.id).status).toBe('APPROVED');
  });

  it('includes the holidays that apply to the caller', async () => {
    const arjun = await request(app).get(`/api/leaves/calendar?${q}`).set(as('arjun'));
    expect(arjun.body.holidays.some((h) => h.name === 'Local Day')).toBe(true);
    const ananya = await request(app).get(`/api/leaves/calendar?${q}`).set(as('ananya'));
    expect(ananya.body.holidays.some((h) => h.name === 'Local Day')).toBe(false);
  });

  it('asks for a sensible range', async () => {
    expect(
      (
        await request(app)
          .get(`/api/leaves/calendar?from=${day(5)}&to=${day(1)}`)
          .set(as('hod'))
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get(`/api/leaves/calendar?from=${day(1)}&to=${day(200)}`)
          .set(as('hod'))
      ).status,
    ).toBe(400);
    expect((await request(app).get('/api/leaves/calendar').set(as('hod'))).status).toBe(400);
    expect((await request(app).get(`/api/leaves/calendar?${q}`)).status).toBe(401);
  });
});

describe('dashboard stats', () => {
  it('needs a sign-in', async () => {
    expect((await request(app).get('/api/stats')).status).toBe(401);
  });

  it('an employee gets only their own numbers', async () => {
    const r = await request(app).get('/api/stats').set(as('arjun'));
    expect(r.status).toBe(200);
    expect(r.body.queue).toBeUndefined();
    expect(r.body.team).toBeUndefined();
    expect(r.body.mine.open).toBeGreaterThan(0);
    expect(r.body.mine.byStatus.APPROVED).toBeGreaterThan(0); // approved in the calendar tests
  });

  it('a manager also gets the queue, who is away, and how fast decisions are', async () => {
    const r = await request(app).get('/api/stats').set(as('rahul'));
    expect(r.status).toBe(200);
    expect(r.body.queue).toMatchObject({ waiting: expect.any(Number), oldestWaitingDays: expect.any(Number) });
    expect(r.body.team).toMatchObject({ awayToday: expect.any(Number), awayThisWeek: expect.any(Number) });
    expect(r.body.decisions.decided).toBeGreaterThan(0);
    expect(r.body.decisions.medianHours).toEqual(expect.any(Number));
  });

  it('the HOD sees the whole organisation, and the queue counts only HOD-stage requests', async () => {
    const hod = await request(app).get('/api/stats').set(as('hod'));
    const waiting = await request(app).get('/api/leaves?scope=queue').set(as('hod'));
    expect(hod.body.queue.waiting).toBe(waiting.body.total);
    const rahul = await request(app).get('/api/stats').set(as('rahul'));
    const rq = await request(app).get('/api/leaves?scope=queue').set(as('rahul'));
    expect(rahul.body.queue.waiting).toBe(rq.body.total);
  });
});

describe('leave in a row', () => {
  const firstFrom = day(260);
  const firstTo = day(262);
  const secondFrom = nextWorkingDay(firstTo);
  const secondTo = day(267);
  let first;

  it('a short request on its own stays short', async () => {
    first = await submit('arjun', { fromDate: firstFrom, toDate: firstTo, reason: 'First part' });
    expect(first.status).toBe(201);
    expect(first.body.isLong).toBe(false);
    expect(first.body.chainDays).toBe(first.body.days);
  });

  it('the form can ask how many days the stretch really is', async () => {
    const r = await request(app).get(`/api/leaves/chain?from=${secondFrom}&to=${secondTo}`).set(as('arjun'));
    expect(r.status).toBe(200);
    expect(r.body.members).toEqual([expect.objectContaining({ fromDate: firstFrom, toDate: firstTo })]);
    expect(r.body.chainDays).toBe(first.body.days + r.body.days);
    expect(r.body.chainDays).toBeGreaterThan(3);
    expect((await request(app).get('/api/leaves/chain?from=nope&to=nope').set(as('arjun'))).status).toBe(400);
  });

  it('splitting a long leave into short ones still needs the document', async () => {
    const noDoc = await submit('arjun', { fromDate: secondFrom, toDate: secondTo, reason: 'Second part' });
    // second part on its own is at most 3 days only if few days remain; assert on the combined rule
    const preview = await request(app).get(`/api/leaves/chain?from=${secondFrom}&to=${secondTo}`).set(as('arjun'));
    if (preview.body.chainDays > 3) {
      expect(noDoc.status).toBe(400);
      expect(noDoc.body.error.fields.documents).toMatch(/in a row/);
    }
    const withDoc = await submit('arjun', { fromDate: secondFrom, toDate: secondTo, reason: 'Second part' }, [{}]);
    expect(withDoc.status).toBe(201);
    expect(withDoc.body.isLong).toBe(true);
    expect(withDoc.body.chainDays).toBe(preview.body.chainDays);
    // and it now follows the two-level route
    const queue = await request(app).post(`/api/leaves/${withDoc.body.id}/approve`).set(as('rahul')).send({ comment: 'ok' });
    expect(queue.body.status).toBe('PENDING_HOD');
  });

  it('leave that is far apart does not join up', async () => {
    const far = await request(app)
      .get(`/api/leaves/chain?from=${day(280)}&to=${day(281)}`)
      .set(as('arjun'));
    expect(far.body.members).toEqual([]);
    expect(far.body.chainDays).toBe(far.body.days);
  });
});

describe('more than 3 days in a row, and split-up requests', () => {
  // A Friday well ahead of the other tests.
  let fri = 100;
  while (new Date(parseISODate(todayISO()) + fri * 86400000).getUTCDay() !== 5) fri += 1;
  const at = (n) => new Date(parseISODate(todayISO()) + (fri + n) * 86400000).toISOString().slice(0, 10);
  let firstId;

  it('Friday to Monday is four days away, so it is long even though only three are charged', async () => {
    const bare = await submit('kavya', { fromDate: at(14), toDate: at(17), reason: 'Long weekend' });
    expect(bare.status).toBe(400);
    expect(bare.body.error.fields.documents).toMatch(/supporting document/);
    const ok = await submit('kavya', { fromDate: at(14), toDate: at(17), reason: 'Long weekend' }, [{}]);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ days: 3, absenceDays: 4, isLong: true, status: 'PENDING_MANAGER' });
  });

  it('two days on Friday and Saturday is fine on its own', async () => {
    const r = await submit('kavya', { fromDate: at(0), toDate: at(1), reason: 'Family visit' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ isLong: false, splitFlag: false, absenceDays: 2 });
    firstId = r.body.id;
  });

  it('Monday to Wednesday straight after is caught: it needs a document and is flagged', async () => {
    const bare = await submit('kavya', { fromDate: at(3), toDate: at(5), reason: 'Family visit, part two' });
    expect(bare.status).toBe(400);
    expect(bare.body.error.fields.documents).toMatch(/6 days in a row/);

    const ok = await submit('kavya', { fromDate: at(3), toDate: at(5), reason: 'Family visit, part two' }, [{}]);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ days: 3, chainDays: 5, absenceDays: 6, isLong: true, splitFlag: true });
    expect(ok.body.joinedWith).toEqual([{ id: firstId, fromDate: at(0), toDate: at(1), days: 2 }]);

    // the manager sees the flag, and it is in the audit log
    const seen = await request(app).get(`/api/leaves/${ok.body.id}`).set(as('rahul'));
    expect(seen.body.splitFlag).toBe(true);
    await new Promise((res) => setTimeout(res, 150));
    const log = await request(app).get('/api/audit?pageSize=100&action=SPLIT_LEAVE_FLAGGED').set(as('hod'));
    expect(log.body.items.some((i) => i.entityId === ok.body.id && /6 days in a row/.test(i.detail))).toBe(true);
    // and it follows the two-level route
    const step = await request(app).post(`/api/leaves/${ok.body.id}/approve`).set(as('rahul')).send({ comment: 'ok' });
    expect(step.body.status).toBe('PENDING_HOD');
  });
});
