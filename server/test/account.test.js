import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.LEAVE_ALLOWANCE_DAYS = '1000';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-acct-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');

let mongod;
let app;
const post = (url, body, token) => {
  const r = request(app).post(url);
  return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body);
};
const login = (email, password) => post('/api/auth/login', { email, password });
const tokenOf = async (email, password = DEMO_PASSWORD) => (await login(email, password)).body.token;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedIfEmpty();
  app = createApp();
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

const GOOD = { name: 'Asha Menon', email: 'asha.menon@akasa.demo', password: 'Skyline2026' };

describe('sign-up without email set up (account is usable straight away)', () => {
  it('creates an employee with no manager', async () => {
    const r = await post('/api/auth/signup', GOOD);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ ok: true, needsVerification: false });
    const l = await login(GOOD.email, GOOD.password);
    expect(l.status).toBe(200);
    expect(l.body.user).toMatchObject({ role: 'EMPLOYEE', name: 'Asha Menon' });
  });

  it('is friendly about weak passwords, bad emails and duplicates', async () => {
    const weak = await post('/api/auth/signup', { ...GOOD, email: 'x@akasa.demo', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toMatch(/8 characters/);
    const noNumber = await post('/api/auth/signup', { ...GOOD, email: 'y@akasa.demo', password: 'onlyletters' });
    expect(noNumber.body.error.fields.password).toMatch(/letter and one number/);
    const bad = await post('/api/auth/signup', { ...GOOD, email: 'not-an-email' });
    expect(bad.body.error.fields.email).toMatch(/email address/);
    const dup = await post('/api/auth/signup', GOOD);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('cannot apply for leave until the HOD chooses a manager', async () => {
    const token = await tokenOf(GOOD.email, GOOD.password);
    const blocked = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${token}`)
      .field('fromDate', '2027-02-02')
      .field('toDate', '2027-02-03')
      .field('reason', 'Family event');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('NO_MANAGER');

    const hod = await tokenOf('priya.nair@akasa.demo');
    const people = (await request(app).get('/api/people').set('Authorization', `Bearer ${hod}`)).body.items;
    const asha = people.find((p) => p.email === GOOD.email);
    expect(asha.needsSetup).toBe(true);
    expect(people[0].email).toBe(GOOD.email); // people who need setting up come first
    const rahul = people.find((p) => p.name === 'Rahul Mehta');

    // only the HOD can do this, and only to a real manager
    const asEmployee = await request(app)
      .patch(`/api/people/${asha.id}/manager`)
      .set('Authorization', `Bearer ${token}`)
      .send({ managerId: rahul.id });
    expect(asEmployee.status).toBe(403);
    const notManager = await request(app)
      .patch(`/api/people/${asha.id}/manager`)
      .set('Authorization', `Bearer ${hod}`)
      .send({ managerId: asha.id });
    expect(notManager.status).toBe(400);
    const ok = await request(app)
      .patch(`/api/people/${asha.id}/manager`)
      .set('Authorization', `Bearer ${hod}`)
      .send({ managerId: rahul.id });
    expect(ok.status).toBe(200);

    const now = await request(app)
      .post('/api/leaves')
      .set('Authorization', `Bearer ${token}`)
      .field('fromDate', '2027-02-02')
      .field('toDate', '2027-02-03')
      .field('reason', 'Family event');
    expect(now.status).toBe(201);
    const queue = await request(app)
      .get('/api/leaves?scope=queue')
      .set('Authorization', `Bearer ${await tokenOf('rahul.mehta@akasa.demo')}`);
    expect(queue.body.items.some((l) => l.employeeName === 'Asha Menon')).toBe(true);
  });

  it('the HOD can promote someone to manager, and cannot demote a manager who has people', async () => {
    const hod = await tokenOf('priya.nair@akasa.demo');
    const people = (await request(app).get('/api/people').set('Authorization', `Bearer ${hod}`)).body.items;
    const asha = people.find((p) => p.email === GOOD.email);
    const rahul = people.find((p) => p.name === 'Rahul Mehta');
    expect(
      (await request(app).patch(`/api/people/${rahul.id}/role`).set('Authorization', `Bearer ${hod}`).send({ role: 'EMPLOYEE' })).status,
    ).toBe(409);
    const up = await request(app).patch(`/api/people/${asha.id}/role`).set('Authorization', `Bearer ${hod}`).send({ role: 'MANAGER' });
    expect(up.status).toBe(200);
    expect(up.body.role).toBe('MANAGER');
    expect(
      (await request(app).patch(`/api/people/${asha.id}/role`).set('Authorization', `Bearer ${hod}`).send({ role: 'HOD' })).status,
    ).toBe(400);
  });

  it('shows the HOD how many people are waiting', async () => {
    await post('/api/auth/signup', { name: 'Dev Patel', email: 'dev.patel@akasa.demo', password: 'Runway2026' });
    const stats = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${await tokenOf('priya.nair@akasa.demo')}`);
    expect(stats.body.awaitingSetup).toBeGreaterThanOrEqual(1);
    const mgr = await request(app)
      .get('/api/stats')
      .set('Authorization', `Bearer ${await tokenOf('rahul.mehta@akasa.demo')}`);
    expect(mgr.body.awaitingSetup).toBeUndefined();
  });
});

describe('sign-up with email confirmation (Mailgun configured)', () => {
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
  const linkIn = (mail) => /https:\/\/layover\.example\.test\/\S+/.exec(mail.text)[0];

  it('sends a link, blocks sign-in until it is used, and the link works once', async () => {
    const u = { name: 'Nina Rao', email: 'nina.rao@akasa.demo', password: 'Cloudbase77' };
    const r = await post('/api/auth/signup', u);
    expect(r.body.needsVerification).toBe(true);
    const mail = sent.find((m) => m.to === u.email);
    expect(mail.subject).toMatch(/Confirm your email/);
    expect(mail.from).toMatch(/noreply@mg\.example\.test/);
    expect(mail.html).toContain('Confirm my email');

    const early = await login(u.email, u.password);
    expect(early.status).toBe(403);
    expect(early.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    const token = new URL(linkIn(mail)).searchParams.get('token');
    expect((await post('/api/auth/verify-email', { token })).status).toBe(200);
    expect((await login(u.email, u.password)).status).toBe(200);
    const again = await post('/api/auth/verify-email', { token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('LINK_INVALID');
  });

  it('can send the confirmation again without saying whether the address exists', async () => {
    const a = await post('/api/auth/resend-verification', { email: 'nobody@akasa.demo' });
    const b = await post('/api/auth/resend-verification', { email: 'nina.rao@akasa.demo' });
    expect(a.status).toBe(200);
    expect(a.body.message).toBe(b.body.message);
  });
});

describe('forgot and reset password', () => {
  const sent = [];
  const EMAIL = 'arjun.sharma@akasa.demo';
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

  it('answers the same for unknown and known addresses, and only emails the real one', async () => {
    const before = sent.length;
    const ghost = await post('/api/auth/forgot-password', { email: 'ghost@akasa.demo' });
    expect(sent.length).toBe(before);
    const real = await post('/api/auth/forgot-password', { email: EMAIL });
    expect(ghost.status).toBe(200);
    expect(real.body.message).toBe(ghost.body.message);
    expect(sent.at(-1)).toMatchObject({ to: EMAIL });
    expect(sent.at(-1).subject).toMatch(/Reset your Layover password/);
  });

  it('chooses a new password with the link, once, and signs out everywhere else', async () => {
    await post('/api/auth/forgot-password', { email: EMAIL });
    const mail = sent.at(-1);
    const token = new URL(/https:\/\/layover\.example\.test\/\S+/.exec(mail.text)[0]).searchParams.get('token');
    expect((await post('/api/auth/check-reset', { token })).body.valid).toBe(true);

    const old = await login(EMAIL, DEMO_PASSWORD);
    const oldCookies = old.headers['set-cookie'].map((c) => c.split(';')[0]);

    const weak = await post('/api/auth/reset-password', { token, password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBeTruthy();

    expect((await post('/api/auth/reset-password', { token, password: 'Brandnew2027' })).status).toBe(200);
    expect((await login(EMAIL, DEMO_PASSWORD)).status).toBe(401);
    expect((await login(EMAIL, 'Brandnew2027')).status).toBe(200);

    const reused = await post('/api/auth/reset-password', { token, password: 'Another2027x' });
    expect(reused.status).toBe(400);
    expect((await post('/api/auth/check-reset', { token })).body.valid).toBe(false);

    // the session that existed before the reset can no longer renew itself
    const refresh = await request(app).post('/api/auth/refresh').set('Cookie', oldCookies).set('X-Requested-With', 'lms');
    expect(refresh.status).toBe(401);
  });

  it('a reset also clears a lockout', async () => {
    for (let i = 0; i < 5; i += 1) await login('kavya.reddy@akasa.demo', 'wrong-password');
    expect((await login('kavya.reddy@akasa.demo', DEMO_PASSWORD)).status).toBe(423);
    await post('/api/auth/forgot-password', { email: 'kavya.reddy@akasa.demo' });
    const token = new URL(/https:\/\/layover\.example\.test\/\S+/.exec(sent.at(-1).text)[0]).searchParams.get('token');
    await post('/api/auth/reset-password', { token, password: 'Freshstart88' });
    expect((await login('kavya.reddy@akasa.demo', 'Freshstart88')).status).toBe(200);
  });

  it('rejects a made-up link', async () => {
    const r = await post('/api/auth/reset-password', { token: 'a'.repeat(64), password: 'Whatever2027' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('LINK_INVALID');
  });
});

describe('change password', () => {
  it('needs the current password, and keeps this device signed in', async () => {
    const email = 'ananya.iyer@akasa.demo';
    const token = await tokenOf(email);
    const wrong = await post('/api/auth/change-password', { currentPassword: 'nope', newPassword: 'Shiny2027pass' }, token);
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('WRONG_PASSWORD');
    const same = await post('/api/auth/change-password', { currentPassword: DEMO_PASSWORD, newPassword: DEMO_PASSWORD }, token);
    expect(same.status).toBe(400);
    const weak = await post('/api/auth/change-password', { currentPassword: DEMO_PASSWORD, newPassword: 'abc' }, token);
    expect(weak.body.error.fields.newPassword).toBeTruthy();
    const ok = await post('/api/auth/change-password', { currentPassword: DEMO_PASSWORD, newPassword: 'Shiny2027pass' }, token);
    expect(ok.status).toBe(200);
    expect(ok.headers['set-cookie']?.length).toBeGreaterThan(0);
    expect((await login(email, DEMO_PASSWORD)).status).toBe(401);
    expect((await login(email, 'Shiny2027pass')).status).toBe(200);
    expect((await post('/api/auth/change-password', { currentPassword: 'x', newPassword: 'y' })).status).toBe(401);
  });
});

describe('sign-up limited to work email domains', () => {
  it('refuses other domains when ALLOWED_EMAIL_DOMAINS is set', async () => {
    process.env.ALLOWED_EMAIL_DOMAINS = 'akasa.demo, @example.org';
    try {
      const no = await post('/api/auth/signup', { name: 'Out Sider', email: 'out@gmail.com', password: 'Skyline2026' });
      expect(no.status).toBe(400);
      expect(no.body.error.fields.email).toMatch(/work email/);
      expect((await post('/api/auth/signup', { name: 'In Sider', email: 'in@example.org', password: 'Skyline2026' })).status).toBe(201);
    } finally {
      delete process.env.ALLOWED_EMAIL_DOMAINS;
    }
  });
});

describe('mail settings', () => {
  it('accepts MAILGUN_DOMAIN on its own (sender defaults to noreply@ that domain) as well as FROM_EMAIL', async () => {
    const { config } = await import('../src/config.js');
    const { isMailConfigured } = await import('../src/services/mail.js');
    const keep = { k: process.env.MAILGUN_API_KEY, d: process.env.MAILGUN_DOMAIN, f: process.env.FROM_EMAIL };
    try {
      delete process.env.FROM_EMAIL;
      process.env.MAILGUN_API_KEY = 'key-test';
      process.env.MAILGUN_DOMAIN = 'mg.example.test';
      expect(config.mailgun).toMatchObject({ domain: 'mg.example.test', senderEmail: 'noreply@mg.example.test' });
      expect(isMailConfigured()).toBe(true);
      process.env.FROM_EMAIL = 'hello@other.example.test';
      expect(config.mailgun.senderEmail).toBe('hello@other.example.test');
      expect(config.mailgun.domain).toBe('mg.example.test');
      delete process.env.MAILGUN_DOMAIN;
      expect(config.mailgun.domain).toBe('other.example.test');
      delete process.env.MAILGUN_API_KEY;
      expect(isMailConfigured()).toBe(false);
    } finally {
      for (const [n, v] of [
        ['MAILGUN_API_KEY', keep.k],
        ['MAILGUN_DOMAIN', keep.d],
        ['FROM_EMAIL', keep.f],
      ]) {
        if (v === undefined) delete process.env[n];
        else process.env[n] = v;
      }
    }
  });

  it('says so when the confirmation email cannot be sent', async () => {
    process.env.MAILGUN_API_KEY = 'key-test';
    process.env.FROM_EMAIL = 'noreply@mg.example.test';
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: false, status: 401 });
    try {
      const r = await post('/api/auth/signup', { name: 'Tara Nair', email: 'tara.nair@akasa.demo', password: 'Skyline2026' });
      expect(r.status).toBe(201);
      expect(r.body).toMatchObject({ needsVerification: true, emailSent: false });
      expect(r.body.message).toMatch(/could not send the confirmation email/);
      expect((await login('tara.nair@akasa.demo', 'Skyline2026')).status).toBe(403);
    } finally {
      globalThis.fetch = realFetch;
      delete process.env.MAILGUN_API_KEY;
      delete process.env.FROM_EMAIL;
    }
  });
});
