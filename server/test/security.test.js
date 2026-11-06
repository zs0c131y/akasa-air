import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.LEAVE_ALLOWANCE_DAYS = '1000';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-sec-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');

let mongod;
let app;
const EMAIL = 'arjun.sharma@akasa.demo';
const login = (email = EMAIL, password = DEMO_PASSWORD, a = app) => request(a).post('/api/auth/login').send({ email, password });
const cookiesOf = (res) => res.headers['set-cookie'].map((c) => c.split(';')[0]);

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

describe('sessions', () => {
  it('sets httpOnly cookies and works without a Bearer token', async () => {
    const r = await login();
    expect(r.status).toBe(200);
    const raw = r.headers['set-cookie'].join('\n');
    expect(raw).toMatch(/lms_access=.*HttpOnly/s);
    expect(raw).toMatch(/lms_refresh=.*HttpOnly/s);
    expect(raw).toMatch(/SameSite=Lax/);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookiesOf(r));
    expect(me.body.user.email).toBe(EMAIL);
  });
  it('blocks cookie-authenticated writes without the CSRF header', async () => {
    const cookies = cookiesOf(await login());
    const blocked = await request(app).post('/api/leaves/obligations-test/cancel').set('Cookie', cookies).send({});
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CSRF_BLOCKED');
    const allowed = await request(app)
      .post('/api/leaves/000000000000000000000000/cancel')
      .set('Cookie', cookies)
      .set('X-Requested-With', 'lms')
      .send({});
    expect(allowed.status).toBe(404); // got past CSRF; the request simply does not exist
  });
  it('rotates refresh tokens and revokes everything if an old one is replayed', async () => {
    const first = await login();
    const oldRefresh = cookiesOf(first).find((c) => c.startsWith('lms_refresh='));
    const second = await request(app).post('/api/auth/refresh').set('Cookie', [oldRefresh]);
    expect(second.status).toBe(200);
    const newRefresh = cookiesOf(second).find((c) => c.startsWith('lms_refresh='));
    expect(newRefresh).not.toBe(oldRefresh);
    const replay = await request(app).post('/api/auth/refresh').set('Cookie', [oldRefresh]);
    expect(replay.status).toBe(401);
    const afterTheft = await request(app).post('/api/auth/refresh').set('Cookie', [newRefresh]);
    expect(afterTheft.status).toBe(401);
  });
  it('logout revokes the refresh token', async () => {
    const r = await login();
    const cookies = cookiesOf(r);
    await request(app).post('/api/auth/logout').set('Cookie', cookies).send({});
    const again = await request(app)
      .post('/api/auth/refresh')
      .set(
        'Cookie',
        cookies.filter((c) => c.startsWith('lms_refresh=')),
      );
    expect(again.status).toBe(401);
  });
});

describe('hardening', () => {
  it('locks an account after repeated wrong passwords, even for the right password', async () => {
    const email = 'kavya.reddy@akasa.demo';
    for (let i = 0; i < 5; i++) expect((await login(email, 'wrong-password')).status).toBe(401);
    const locked = await login(email);
    expect(locked.status).toBe(423);
    expect(locked.body.error.message).toMatch(/Try again in/);
  });
  it('rejects NoSQL operator injection in body and query', async () => {
    const body = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(body.status).toBe(400);
    const token = (await login('priya.nair@akasa.demo')).body.token;
    const q = await request(app).get('/api/leaves?scope=all&status[$ne]=APPROVED').set('Authorization', `Bearer ${token}`);
    expect(q.status).toBe(400);
  });
  it('sends security headers and hides the framework', async () => {
    const r = await request(app).get('/health');
    expect(r.headers['content-security-policy']).toMatch(/script-src 'self'/);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
    expect(r.headers['x-request-id']).toBeTruthy();
  });
  it('allows only same-origin or listed CORS origins', async () => {
    const evil = await request(app).get('/api/auth/me').set('Origin', 'https://evil.example');
    expect(evil.status).toBe(403);
    expect(evil.body.error.code).toBe('CORS_BLOCKED');
    process.env.CORS_ORIGINS = 'https://app.example';
    const ok = await request(app).get('/api/auth/me').set('Origin', 'https://app.example');
    expect(ok.status).toBe(401); // allowed through; just not signed in
    expect(ok.headers['access-control-allow-origin']).toBe('https://app.example');
    delete process.env.CORS_ORIGINS;
  });
  it('rate-limits sign-in attempts', async () => {
    process.env.LOGIN_RATE_MAX = '2';
    const fresh = createApp();
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await login('meera.joshi@akasa.demo', DEMO_PASSWORD, fresh)).status);
    delete process.env.LOGIN_RATE_MAX;
    expect(codes).toEqual([200, 200, 429]);
  });
});
