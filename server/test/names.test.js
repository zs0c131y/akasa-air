import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-names-'));
const { createApp } = await import('../src/app.js');
const { seedIfEmpty, DEMO_PASSWORD } = await import('../src/seed.js');

let mongod;
let app;
let hod;
const post = (url, body, token) => {
  const r = request(app).post(url);
  return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body);
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await seedIfEmpty();
  app = createApp();
  hod = (await post('/api/auth/login', { email: 'priya.nair@akasa.demo', password: DEMO_PASSWORD })).body.token;
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('names are letters only', () => {
  it('sign-up refuses digits, special characters and short names', async () => {
    const mk = (name, email) => post('/api/auth/signup', { name, email, password: 'Skyline2026' });
    const digits = await mk('Asha 2', 'asha.two@akasa.demo');
    expect(digits.status).toBe(400);
    expect(digits.body.error.fields.name).toMatch(/cannot contain numbers/);
    expect((await mk('As', 'as@akasa.demo')).status).toBe(400);
    expect((await mk('A$ha Menon', 'dollar@akasa.demo')).status).toBe(400);
    expect((await mk('Asha Menon', 'asha.menon@akasa.demo')).status).toBe(201);
  });

  it('holidays and locations refuse them too, including in the CSV import', async () => {
    const hol = await post('/api/holidays', { date: '2031-05-05', name: 'Day 2!' }, hod);
    expect(hol.status).toBe(400);
    expect(hol.body.error.fields.name).toBeTruthy();
    expect((await post('/api/holidays', { date: '2031-05-05', name: 'Founders Day' }, hod)).status).toBe(201);
    expect((await post('/api/locations', { name: 'Pune 2' }, hod)).status).toBe(400);
    expect((await post('/api/locations', { name: 'Pune' }, hod)).status).toBe(201);
    const csv = await post('/api/holidays/import', { csv: '2031-06-06,Fest1val,' }, hod);
    expect(csv.body.summary.errors).toBe(1);
  });
});
