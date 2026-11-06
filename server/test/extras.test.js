import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { todayISO, parseISODate } from '@lms/shared';

process.env.LEAVE_ALLOWANCE_DAYS = '1000';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-extras-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');
const { LeaveRequest } = await import('../src/models/LeaveRequest.js');

let mongod;
let app;
const tokens = {};
const nonSunday = (t) => (new Date(t).getUTCDay() === 0 ? t + 86400000 : t);
const day = (n) => new Date(nonSunday(parseISODate(todayISO()) + n * 86400000)).toISOString().slice(0, 10);
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const submit = (who, fields) => {
  let r = request(app).post('/api/leaves').set(as(who));
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  return r;
};
const inbox = async (who) => (await request(app).get('/api/notifications').set(as(who))).body.items;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedIfEmpty();
  app = createApp();
  const emails = {
    hod: 'priya.nair@akasa.demo',
    ananya: 'ananya.iyer@akasa.demo',
    rahul: 'rahul.mehta@akasa.demo',
    arjun: 'arjun.sharma@akasa.demo',
    sneha: 'sneha.kulkarni@akasa.demo',
    imran: 'imran.khan@akasa.demo',
    meera: 'meera.joshi@akasa.demo',
  };
  for (const [k, e] of Object.entries(emails))
    tokens[k] = (await request(app).post('/api/auth/login').send({ email: e, password: DEMO_PASSWORD })).body.token;
  await LeaveRequest.deleteMany({});
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe("manager on leave: requests go to the HOD, on the manager's behalf", () => {
  let waiting;
  let managerLeave;

  it("a request already waiting for the manager moves to the HOD when the manager's own leave is approved", async () => {
    waiting = (await submit('sneha', { fromDate: day(31), toDate: day(31), reason: 'Bank work' })).body;
    expect(waiting.status).toBe('PENDING_MANAGER');
    managerLeave = (await submit('ananya', { fromDate: day(30), toDate: day(32), reason: 'Holiday with family' })).body;
    expect(managerLeave.status).toBe('PENDING_HOD'); // a manager's own leave goes to the HOD
    const done = await request(app).post(`/api/leaves/${managerLeave.id}/approve`).set(as('hod')).send({ comment: 'Enjoy' });
    expect(done.body.status).toBe('APPROVED');
    expect(done.body.rerouted).toEqual([waiting.id]);

    const moved = (await request(app).get(`/api/leaves/${waiting.id}`).set(as('hod'))).body;
    expect(moved).toMatchObject({ status: 'PENDING_HOD', onBehalfOf: 'Ananya Iyer' });
    const last = moved.timeline.at(-1);
    expect(last).toMatchObject({ action: 'REROUTED', actorName: 'System' });
    expect(last.comment).toMatch(/on behalf of Ananya Iyer/);
    expect(moved.allowedActions).toContain('APPROVE'); // the HOD can now answer it

    const hodNote = (await inbox('hod')).find((n) => n.leaveId === waiting.id);
    expect(hodNote.body).toMatch(/on behalf of Ananya Iyer/);
    const mine = (await inbox('sneha')).find((n) => n.kind === 'REROUTED');
    expect(mine.body).toMatch(/Ananya Iyer is on leave/);
  });

  it('a new request for those days goes straight to the HOD and says so', async () => {
    const r = await submit('imran', { fromDate: day(32), toDate: day(33), reason: 'Exam preparation' });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'PENDING_HOD', onBehalfOf: 'Ananya Iyer' });
    expect(r.body.timeline.map((t) => t.action)).toEqual(['SUBMITTED', 'REROUTED']);
    const queue = (await request(app).get('/api/leaves?scope=queue').set(as('hod'))).body.items.map((l) => l.id);
    expect(queue).toContain(r.body.id);
    const note = (await inbox('hod')).find((n) => n.leaveId === r.body.id);
    expect(note.body).toMatch(/on behalf of Ananya Iyer/);
    await new Promise((res) => setTimeout(res, 150));
    const log = await request(app).get('/api/audit?pageSize=100&action=LEAVE_REROUTED').set(as('hod'));
    expect(log.body.items.some((i) => i.entityId === r.body.id)).toBe(true);
  });

  it('requests for other days still wait for the manager', async () => {
    const r = await submit('meera', { fromDate: day(90), toDate: day(90), reason: 'Dentist visit' });
    expect(r.body).toMatchObject({ status: 'PENDING_MANAGER', onBehalfOf: null });
  });

  it('a different team is not affected', async () => {
    const r = await submit('arjun', { fromDate: day(32), toDate: day(33), reason: "Cousin's wedding" });
    expect(r.body.status).toBe('PENDING_MANAGER');
  });
});

describe('overlap warning for the approver', () => {
  it('shows who else on the team is away on the same days, only to approvers', async () => {
    const a = (await submit('sneha', { fromDate: day(70), toDate: day(71), reason: 'Family function' })).body;
    const b = (await submit('imran', { fromDate: day(70), toDate: day(71), reason: 'Out of town' })).body;
    const asApprover = await request(app).get(`/api/leaves/${b.id}`).set(as('ananya'));
    expect(asApprover.body.overlaps).toMatchObject({ away: 1, teamSize: 2 });
    expect(asApprover.body.overlaps.items[0]).toMatchObject({ name: 'Sneha Kulkarni', approved: false });
    const own = await request(app).get(`/api/leaves/${b.id}`).set(as('imran'));
    expect(own.body.overlaps).toBeUndefined();
    const alone = (await submit('meera', { fromDate: day(120), toDate: day(120), reason: 'Quiet day off' })).body;
    expect((await request(app).get(`/api/leaves/${alone.id}`).set(as('ananya'))).body.overlaps).toMatchObject({ away: 0, items: [] });
    expect(a.id).toBeTruthy();
  });
});

describe('CSV export', () => {
  it('gives each person only what they may see', async () => {
    await submit('meera', { fromDate: day(140), toDate: day(140), reason: '=HYPERLINK("x")' });
    const mine = await request(app).get('/api/leaves/export.csv').set(as('arjun'));
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toMatch(/text\/csv/);
    expect(mine.headers['content-disposition']).toMatch(/attachment; filename="leave-requests-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(mine.text).toMatch(/Request ID,Employee,Employee ID,From,To,Charged days/);
    expect(mine.text).toContain('Arjun Sharma');
    expect(mine.text).not.toContain('Sneha Kulkarni');

    expect((await request(app).get('/api/leaves/export.csv?scope=all').set(as('arjun'))).status).toBe(403);
    const team = await request(app).get('/api/leaves/export.csv?scope=all').set(as('ananya'));
    expect(team.text).toContain('Sneha Kulkarni');
    expect(team.text).not.toContain('Arjun Sharma');
    const all = await request(app).get('/api/leaves/export.csv?scope=all').set(as('hod'));
    expect(all.text).toContain('Arjun Sharma');
    expect(all.text).toContain('Sneha Kulkarni');
    expect(all.text).toMatch(/AKA-\d{4}/);
  });

  it('does not let a request reason run as a spreadsheet formula', async () => {
    const all = await request(app).get('/api/leaves/export.csv?scope=all').set(as('hod'));
    expect(all.text).toContain('"\'=HYPERLINK(""x"")"');
    expect(all.text).not.toMatch(/,=HYPERLINK/);
  });

  it('can be filtered, validates its input and is audited', async () => {
    const approved = await request(app).get('/api/leaves/export.csv?scope=all&status=APPROVED').set(as('hod'));
    const lines = approved.text.trim().split(/\r\n/);
    expect(lines.length).toBe(2); // header + Ananya's approved leave
    expect(lines[1]).toContain('Approved');
    expect(lines[1]).toContain('Priya Nair');
    expect((await request(app).get('/api/leaves/export.csv?status=NOPE').set(as('hod'))).status).toBe(400);
    expect((await request(app).get('/api/leaves/export.csv?from=soon').set(as('hod'))).status).toBe(400);
    expect((await request(app).get('/api/leaves/export.csv')).status).toBe(401);
    await new Promise((res) => setTimeout(res, 150));
    const log = await request(app).get('/api/audit?pageSize=100&action=LEAVE_EXPORTED').set(as('hod'));
    expect(log.body.items.length).toBeGreaterThanOrEqual(3);
  });
});

describe('leave by month', () => {
  const year = Number(day(30).slice(0, 4));
  it('adds up approved and waiting days in the month a request starts', async () => {
    const r = await request(app).get(`/api/stats/monthly?year=${year}`).set(as('hod'));
    expect(r.status).toBe(200);
    expect(r.body.months).toHaveLength(12);
    const sum = r.body.months.reduce((n, m) => n + m.approvedDays, 0);
    expect(r.body.totals.approvedDays).toBe(sum);
    expect(r.body.totals.approvedDays).toBeGreaterThan(0); // Ananya's approved leave
    const m = r.body.months[Number(day(30).slice(5, 7)) - 1];
    expect(m.approvedDays).toBeGreaterThan(0);
    expect(m.people).toBeGreaterThan(0);
    expect(r.body.busiest).toBeTruthy();
  });
  it('shows managers their team and employees only themselves', async () => {
    const mine = await request(app).get(`/api/stats/monthly?year=${year}`).set(as('arjun'));
    const mineRequests = mine.body.months.reduce((n, m) => n + m.requests, 0);
    const hod = await request(app).get(`/api/stats/monthly?year=${year}`).set(as('hod'));
    expect(mineRequests).toBeLessThan(hod.body.totals.requests);
    expect((await request(app).get('/api/stats/monthly')).status).toBe(401);
  });
});
