import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { parseISODate, todayISO } from '@lms/shared';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-validation-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');
const { LeaveRequest } = await import('../src/models/LeaveRequest.js');

let mongod;
let app;
const tokens = {};
const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` });
const nonSunday = (t) => (new Date(t).getUTCDay() === 0 ? t + 86400000 : t);
const day = (n) => new Date(nonSunday(parseISODate(todayISO()) + n * 86400000)).toISOString().slice(0, 10);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedIfEmpty();
  app = createApp();
  for (const [k, email] of Object.entries({ arjun: 'arjun.sharma@akasa.demo', rahul: 'rahul.mehta@akasa.demo' })) {
    tokens[k] = (await request(app).post('/api/auth/login').send({ email, password: DEMO_PASSWORD })).body.token;
  }
  await LeaveRequest.deleteMany({});
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const file = (from, to) =>
  request(app).post('/api/leaves').set(as('arjun')).field('fromDate', from).field('toDate', to).field('reason', 'Personal work');

describe('inputs the server checks itself', () => {
  it('a cancel comment must be text of at most 1000 characters', async () => {
    const r = await file(day(30), day(30));
    expect(r.status).toBe(201);
    const huge = await request(app)
      .post(`/api/leaves/${r.body.id}/cancel`)
      .set(as('arjun'))
      .send({ comment: 'x'.repeat(1001) });
    expect(huge.status).toBe(400);
    expect(huge.body.error.fields.comment).toMatch(/under 1000 characters/);
    const notText = await request(app)
      .post(`/api/leaves/${r.body.id}/cancel`)
      .set(as('arjun'))
      .send({ comment: { a: 1 } });
    expect(notText.status).toBe(400);
    const ok = await request(app).post(`/api/leaves/${r.body.id}/cancel`).set(as('arjun')).send({ comment: 'Plans changed' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('CANCELLED');
  });

  it('an approval comment over 1000 characters gets a friendly message', async () => {
    const r = await file(day(40), day(40));
    const a = await request(app)
      .post(`/api/leaves/${r.body.id}/approve`)
      .set(as('rahul'))
      .send({ comment: 'x'.repeat(1001) });
    expect(a.status).toBe(400);
    expect(a.body.error.fields.comment).toMatch(/under 1000 characters/);
  });

  it('a reply cannot attach documents to short leave', async () => {
    const r = await file(day(50), day(50));
    const q = await request(app).post(`/api/leaves/${r.body.id}/request-info`).set(as('rahul')).send({ comment: 'Which day exactly?' });
    expect(q.status).toBe(200);
    const withDoc = await request(app)
      .post(`/api/leaves/${r.body.id}/reply`)
      .set(as('arjun'))
      .field('message', 'Here it is')
      .attach('documents', Buffer.from('%PDF-1.4\n%%EOF\n'), 'note.pdf');
    expect(withDoc.status).toBe(400);
    expect(withDoc.body.error.fields.documents).toMatch(/only accepted for leave longer than 3 days/);
    const plain = await request(app).post(`/api/leaves/${r.body.id}/reply`).set(as('arjun')).field('message', 'The whole day');
    expect(plain.status).toBe(200);
  });

  it('marking notices as read ignores ids that are not real ids instead of failing', async () => {
    const r = await request(app)
      .post('/api/notifications/read')
      .set(as('rahul'))
      .send({ ids: ['not-an-id', 42] });
    expect(r.status).toBe(200);
    expect(r.body.updated).toBe(0);
  });
});
