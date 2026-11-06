import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { todayISO, parseISODate, countLeaveDays } from '@lms/shared';

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
    hod: 'priya.nair@akasa.demo', rahul: 'rahul.mehta@akasa.demo', ananya: 'ananya.iyer@akasa.demo',
    arjun: 'arjun.sharma@akasa.demo', sneha: 'sneha.kulkarni@akasa.demo',
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
    const r = await submit('arjun', { fromDate: day(60), toDate: day(61), reason: 'Medical visit' });
    const id = r.body.id;
    const q = await request(app).post(`/api/leaves/${id}/request-info`).set(as('rahul')).send({ comment: 'Which clinic?' });
    expect(q.body.status).toBe('INFO_REQUESTED');
    const empty = await request(app).post(`/api/leaves/${id}/reply`).set(as('arjun')).field('message', '');
    expect(empty.status).toBe(400);
    const rep = await request(app).post(`/api/leaves/${id}/reply`).set(as('arjun')).field('message', 'City clinic').attach('documents', PDF, 'slip.pdf');
    expect(rep.body.status).toBe('PENDING_MANAGER');
    expect(rep.body.documents).toHaveLength(1);
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
    const exe = await submit('arjun', { fromDate: day(110), toDate: day(114), reason: 'Family trip' }, [{ buffer: Buffer.from('MZ not a pdf'), name: 'x.pdf' }]);
    expect(exe.status).toBe(400);
  });
  it('employee can edit and cancel while pending', async () => {
    const r = await submit('arjun', { fromDate: day(120), toDate: day(120), reason: 'Personal work' });
    const e = await request(app).patch(`/api/leaves/${r.body.id}`).set(as('arjun')).field('fromDate', day(120)).field('toDate', day(121)).field('reason', 'Personal work, extended');
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
    const stale = await request(app).post(`/api/leaves/${r.body.id}/approve`).set(as('rahul')).send({ version: r.body.version + 5 });
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
    expect((await submit('sneha', { fromDate: day(230), toDate: day(234), reason: 'Third emergency', isEmergency: 'true' })).status).toBe(409);
    expect((await request(app).get('/api/leaves/obligations').set(as('sneha'))).body).toMatchObject({ canApplyNormal: false, canApplyEmergency: false });
    // sending documents for one request lifts the block for emergencies again
    const sent = await request(app).post(`/api/leaves/${e1.body.id}/documents`).set(as('sneha')).attach('documents', PDF, 'proof.pdf');
    expect(sent.status).toBe(200);
    expect(sent.body.documentsPending).toBe(false);
    expect((await submit('sneha', { fromDate: day(230), toDate: day(234), reason: 'Third emergency', isEmergency: 'true' })).status).toBe(201);
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
