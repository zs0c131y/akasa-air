import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { todayISO, parseISODate } from '@lms/shared';

delete process.env.LEAVE_ALLOWANCE_DAYS; // this file tests the real default of 30 days
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-allow-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');
const { LeaveRequest } = await import('../src/models/LeaveRequest.js');
const { User } = await import('../src/models/User.js');
const { notify, isDeliverableEmail } = await import('../src/services/notificationService.js');
const { Notification } = await import('../src/models/Notification.js');

let mongod;
let app;
const tokens = {};
const PDF = Buffer.from('%PDF-1.4\n%%EOF\n');
const nonSunday = (t) => (new Date(t).getUTCDay() === 0 ? t + 86400000 : t);
const day = (n) => new Date(nonSunday(parseISODate(todayISO()) + n * 86400000)).toISOString().slice(0, 10);
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const submit = (who, fields, files = []) => {
  let r = request(app).post('/api/leaves').set(as(who));
  for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
  for (const _f of files) r = r.attach('documents', PDF, 'doc.pdf');
  return r;
};
const inbox = async (who) => (await request(app).get('/api/notifications').set(as(who))).body;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedIfEmpty();
  app = createApp();
  const emails = {
    hod: 'priya.nair@akasa.demo',
    rahul: 'rahul.mehta@akasa.demo',
    arjun: 'arjun.sharma@akasa.demo',
    sneha: 'sneha.kulkarni@akasa.demo',
  };
  for (const [k, e] of Object.entries(emails)) {
    const r = await request(app).post('/api/auth/login').send({ email: e, password: DEMO_PASSWORD });
    tokens[k] = r.body.token;
  }
  await LeaveRequest.deleteMany({});
  await Notification.deleteMany({});
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('profile', () => {
  it('has an employee ID, department, manager and balance', async () => {
    const r = await request(app).get('/api/auth/me').set(as('arjun'));
    expect(r.body.user).toMatchObject({
      name: 'Arjun Sharma',
      role: 'EMPLOYEE',
      location: 'Bengaluru',
      managerName: 'Rahul Mehta',
      department: 'Operations',
    });
    expect(r.body.user.employeeCode).toMatch(/^AKA-\d{4}$/);
    expect(r.body.user.balance).toMatchObject({ allowance: 30, used: 0, pending: 0, remaining: 30 });
  });
  it('gives everyone a different ID', async () => {
    const codes = (await User.find({}, { employeeCode: 1 }).lean()).map((u) => u.employeeCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every(Boolean)).toBe(true);
  });
});

describe('yearly leave allowance (30 days to start with)', () => {
  it('stops a request that is bigger than what is left, in plain words', async () => {
    const r = await submit('arjun', { fromDate: day(20), toDate: day(60), reason: 'Long trip abroad' }, [{}]);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('NOT_ENOUGH_LEAVE');
    expect(r.body.error.message).toMatch(/only have 30 left/);
    expect(r.body.error.hint).toMatch(/allowance is 30 days/);
  });

  it("lets the HOD raise one person's allowance, and counts requests against it", async () => {
    const people = (await request(app).get('/api/people').set(as('hod'))).body.items;
    const arjun = people.find((p) => p.name === 'Arjun Sharma');
    expect((await request(app).put(`/api/allowances/${arjun.id}`).set(as('rahul')).send({ days: 60 })).status).toBe(403);
    expect((await request(app).put(`/api/allowances/${arjun.id}`).set(as('hod')).send({ days: 400 })).status).toBe(400);
    expect((await request(app).put(`/api/allowances/${arjun.id}`).set(as('hod')).send({ days: 60 })).status).toBe(200);

    const ok = await submit('arjun', { fromDate: day(20), toDate: day(60), reason: 'Long trip abroad' }, [{}]);
    expect(ok.status).toBe(201);
    const bal = (await request(app).get('/api/balance').set(as('arjun'))).body;
    expect(bal).toMatchObject({ allowance: 60, custom: true, used: 0 });
    expect(bal.pending).toBe(ok.body.days);
    expect(bal.remaining).toBe(60 - ok.body.days);

    // turning it down gives the days back
    await request(app).post(`/api/leaves/${ok.body.id}/approve`).set(as('rahul')).send({ comment: 'fine' });
    await request(app).post(`/api/leaves/${ok.body.id}/reject`).set(as('hod')).send({ comment: 'Not this time, sorry.' });
    expect((await request(app).get('/api/balance').set(as('arjun'))).body.remaining).toBe(60);
  });

  it("shows the HOD everyone's numbers, and can put someone back on the default", async () => {
    const list = await request(app).get('/api/allowances').set(as('hod'));
    expect(list.body.defaultDays).toBe(30);
    const arjun = list.body.items.find((i) => i.name === 'Arjun Sharma');
    expect(arjun).toMatchObject({ allowance: 60, custom: true });
    expect((await request(app).get('/api/allowances').set(as('arjun'))).status).toBe(403);
    expect((await request(app).delete(`/api/allowances/${arjun.id}`).set(as('hod'))).status).toBe(200);
    expect((await request(app).get('/api/balance').set(as('arjun'))).body.allowance).toBe(30);
  });

  describe('CSV import', () => {
    const csv = 'email,allowance,year\nsneha.kulkarni@akasa.demo,35,\ndefault,28,';

    it('is HOD only', async () => {
      expect((await request(app).post('/api/allowances/import').set(as('rahul')).send({ csv })).status).toBe(403);
    });
    it('previews without saving', async () => {
      const r = await request(app).post('/api/allowances/import').set(as('hod')).send({ csv });
      expect(r.body).toMatchObject({ applied: false, summary: { new: 1, changed: 1, errors: 0 } });
      expect((await request(app).get('/api/balance').set(as('sneha'))).body.allowance).toBe(30);
    });
    it('saves nothing if a line is wrong, and says which', async () => {
      const bad = `${csv}\nghost@akasa.demo,10,\nrahul.mehta@akasa.demo,abc,`;
      const r = await request(app).post('/api/allowances/import').set(as('hod')).send({ csv: bad, apply: true });
      expect(r.body.applied).toBe(false);
      expect(r.body.summary.errors).toBe(2);
      expect(r.body.rows.filter((x) => x.status === 'error').map((x) => x.line)).toEqual([4, 5]);
      expect((await request(app).get('/api/balance').set(as('sneha'))).body.allowance).toBe(30);
    });
    it('applies a clean list: one person, and the default for everyone else', async () => {
      const r = await request(app).post('/api/allowances/import').set(as('hod')).send({ csv, apply: true });
      expect(r.body).toMatchObject({ applied: true, summary: { new: 1, changed: 1 } });
      expect((await request(app).get('/api/balance').set(as('sneha'))).body).toMatchObject({ allowance: 35, custom: true });
      expect((await request(app).get('/api/balance').set(as('arjun'))).body).toMatchObject({ allowance: 28, custom: false });
      const again = await request(app).post('/api/allowances/import').set(as('hod')).send({ csv, apply: true });
      expect(again.body).toMatchObject({ applied: false, summary: { same: 2, errors: 0 } });
    });
    it('can change the default on its own', async () => {
      expect((await request(app).put('/api/allowances/default').set(as('hod')).send({ days: 30 })).body.days).toBe(30);
      expect((await request(app).put('/api/allowances/default').set(as('hod')).send({ days: -1 })).status).toBe(400);
      expect((await request(app).get('/api/balance').set(as('arjun'))).body.allowance).toBe(30);
    });
  });
});

describe('notifications', () => {
  it('tells the manager when a request arrives, and nobody else', async () => {
    await Notification.deleteMany({});
    const r = await submit('sneha', { fromDate: day(100), toDate: day(101), reason: 'Moving house' });
    expect(r.status).toBe(201);
    const { unread, items } = await inbox('rahul'); // Sneha reports to Ananya, so Rahul hears nothing
    expect(unread).toBe(0);
    expect(items).toEqual([]);
    const sub = await submit('arjun', { fromDate: day(110), toDate: day(111), reason: 'Wedding in Jaipur' });
    const mine = await inbox('rahul');
    expect(mine.unread).toBe(1);
    expect(mine.items[0]).toMatchObject({ kind: 'WAITING', leaveId: sub.body.id, read: false });
    expect(mine.items[0].title).toMatch(/Arjun Sharma asked for leave/);
    expect((await inbox('arjun')).items).toEqual([]);
  });

  it('marks notices as read', async () => {
    const before = await inbox('rahul');
    const r = await request(app)
      .post('/api/notifications/read')
      .set(as('rahul'))
      .send({ ids: [before.items[0].id] });
    expect(r.body.updated).toBe(1);
    expect((await inbox('rahul')).unread).toBe(0);
    expect((await request(app).post('/api/notifications/read').set(as('rahul')).send({})).status).toBe(400);
    // nobody can mark someone else's notices
    const other = await inbox('hod');
    expect(other.items.length).toBe(0);
  });

  it('follows a long request through both approvers to the employee', async () => {
    const r = await submit('arjun', { fromDate: day(120), toDate: day(126), reason: 'Surgery and recovery' }, [{}]);
    await request(app).post(`/api/leaves/${r.body.id}/approve`).set(as('rahul')).send({ comment: 'ok' });
    const arjun = (await inbox('arjun')).items.find((i) => i.leaveId === r.body.id);
    expect(arjun).toMatchObject({ kind: 'APPROVED_STEP' });
    expect(arjun.body).toMatch(/head of department/);
    const hod = (await inbox('hod')).items.find((i) => i.leaveId === r.body.id);
    expect(hod).toMatchObject({ kind: 'WAITING' });
    await request(app).post(`/api/leaves/${r.body.id}/approve`).set(as('hod')).send({ comment: 'Approved. Get well soon.' });
    const done = (await inbox('arjun')).items.find((i) => i.kind === 'APPROVED');
    expect(done.title).toBe('Your leave was approved');
    expect(done.body).toMatch(/Get well soon/);
  });

  it('tells the employee about a question and the approver about the reply', async () => {
    const r = await submit('arjun', { fromDate: day(140), toDate: day(141), reason: 'Passport appointment' });
    await request(app).post(`/api/leaves/${r.body.id}/request-info`).set(as('rahul')).send({ comment: 'Which day is the appointment?' });
    const q = (await inbox('arjun')).items.find((i) => i.kind === 'QUESTION');
    expect(q.title).toMatch(/Rahul Mehta has a question/);
    expect(q.body).toMatch(/Which day/);
    await request(app).post(`/api/leaves/${r.body.id}/reply`).set(as('arjun')).field('message', 'The 14th');
    const back = (await inbox('rahul')).items.find((i) => /replied/.test(i.title));
    expect(back.leaveId).toBe(r.body.id);
    await request(app).post(`/api/leaves/${r.body.id}/reject`).set(as('rahul')).send({ comment: 'Clashes with the audit.' });
    const no = (await inbox('arjun')).items.find((i) => i.kind === 'REJECTED');
    expect(no.body).toMatch(/Clashes with the audit/);
  });

  it('tells the manager when a request is cancelled', async () => {
    const r = await submit('arjun', { fromDate: day(150), toDate: day(150), reason: 'Errand' });
    await request(app).post(`/api/leaves/${r.body.id}/cancel`).set(as('arjun')).send({});
    expect((await inbox('rahul')).items.some((i) => i.kind === 'CANCELLED' && i.leaveId === r.body.id)).toBe(true);
  });
});

describe('email notices never go to made-up addresses', () => {
  const sent = [];
  beforeAll(() => {
    process.env.MAILGUN_API_KEY = 'key-test';
    process.env.FROM_EMAIL = 'noreply@mg.example.test';
    process.env.APP_URL = 'https://layover.example.test';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, opts) => {
        sent.push(Object.fromEntries(new URLSearchParams(opts.body)));
        return { ok: true };
      }),
    );
  });
  afterAll(() => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.FROM_EMAIL;
    delete process.env.APP_URL;
    vi.unstubAllGlobals();
  });

  it('recognises made-up domains', () => {
    for (const e of ['a@akasa.demo', 'a@x.test', 'a@example.com', 'a@foo.invalid', 'a@host.local', 'nobody'])
      expect(isDeliverableEmail(e)).toBe(false);
    for (const e of ['a@gmail.com', 'a@akasaair.com', 'a@mail.company.in']) expect(isDeliverableEmail(e)).toBe(true);
    process.env.NO_EMAIL_DOMAINS = 'blocked.org';
    expect(isDeliverableEmail('a@blocked.org')).toBe(false);
    expect(isDeliverableEmail('a@sub.blocked.org')).toBe(false);
    delete process.env.NO_EMAIL_DOMAINS;
  });

  it('sends no email to a demo account, but still shows the notice in the app', async () => {
    const before = sent.length;
    const r = await submit('arjun', { fromDate: day(160), toDate: day(160), reason: 'Quick errand' });
    await request(app).post(`/api/leaves/${r.body.id}/approve`).set(as('rahul')).send({ comment: 'ok' });
    expect(sent.length).toBe(before);
    expect((await inbox('arjun')).items.some((i) => i.kind === 'APPROVED' && i.leaveId === r.body.id)).toBe(true);
  });

  it('emails a real address, unless that person switched emails off', async () => {
    const real = await User.create({ name: 'Real Person', email: 'real.person@gmail.com', role: 'EMPLOYEE', passwordHash: 'x' });
    const before = sent.length;
    await notify(real, { kind: 'APPROVED', title: 'Your leave was approved', body: '10 Nov, 1 leave day.', leaveId: null });
    expect(sent.length).toBe(before + 1);
    expect(sent.at(-1)).toMatchObject({ to: 'real.person@gmail.com', subject: 'Your leave was approved' });
    expect(sent.at(-1).html).toContain('Open in Layover');

    real.emailNotifications = false;
    await real.save();
    await notify(real, { kind: 'APPROVED', title: 'Again', body: 'x' });
    expect(sent.length).toBe(before + 1);
    expect(await Notification.countDocuments({ userId: real._id })).toBe(2); // the app notices are kept either way
  });

  it('lets a person switch email notices on and off', async () => {
    const r = await request(app).patch('/api/preferences').set(as('arjun')).send({ emailNotifications: false });
    expect(r.body.emailNotifications).toBe(false);
    expect((await request(app).get('/api/auth/me').set(as('arjun'))).body.user.emailNotifications).toBe(false);
    expect((await request(app).patch('/api/preferences').set(as('arjun')).send({ emailNotifications: 'no' })).status).toBe(400);
  });
});
