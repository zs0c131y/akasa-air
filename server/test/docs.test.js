import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-docs-'));
const { createApp } = await import('../src/app.js');
const { buildOpenApi } = await import('../src/openapi.js');

let mongod;
let app;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  app = createApp();
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

/** Every route the app registers, read from the route files, as "METHOD /path/{param}". */
function routesInSource() {
  const dir = path.resolve(import.meta.dirname, '../src/routes');
  const prefix = {
    authRouter: '/auth',
    leavesRouter: '/leaves',
    holidaysRouter: '/holidays',
    locationsRouter: '/locations',
    peopleRouter: '/people',
    balanceRouter: '/balance',
    allowancesRouter: '/allowances',
    notificationsRouter: '/notifications',
    preferencesRouter: '/preferences',
    auditRouter: '/audit',
    statsRouter: '/stats',
  };
  const found = new Set();
  const add = (method, router, p) => {
    if (!(router in prefix)) return;
    const tail = p === '/' ? '' : p.replace(/:(\w+)/g, '{$1}');
    found.add(`${method.toUpperCase()} ${prefix[router]}${tail}`);
  };
  for (const file of fs.readdirSync(dir)) {
    if (file === 'docs.js') continue;
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of src.matchAll(/(\w+Router)\.(get|post|put|patch|delete)\(\s*'([^']*)'/g)) add(m[2], m[1], m[3]);
    for (const m of src.matchAll(/decision\(\s*'([^']*)'/g)) add('post', 'leavesRouter', m[1]);
  }
  return found;
}

describe('API documentation', () => {
  it('describes every route the app has, and nothing it does not', () => {
    const spec = buildOpenApi();
    const described = new Set();
    for (const [p, ops] of Object.entries(spec.paths)) for (const method of Object.keys(ops)) described.add(`${method.toUpperCase()} ${p}`);
    const real = routesInSource();
    expect([...real].filter((r) => !described.has(r))).toEqual([]);
    expect([...described].filter((r) => !real.has(r))).toEqual([]);
  });

  it('is a well-formed OpenAPI document where every operation says what it returns', () => {
    const spec = buildOpenApi();
    expect(spec.openapi).toMatch(/^3\.0/);
    for (const [p, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        expect(op.summary, `${method} ${p} needs a summary`).toBeTruthy();
        expect(Object.keys(op.responses).length, `${method} ${p} needs responses`).toBeGreaterThan(0);
      }
    }
    const refs = JSON.stringify(spec).match(/#\/components\/schemas\/(\w+)/g) ?? [];
    for (const r of refs) expect(spec.components.schemas[r.split('/').pop()], r).toBeTruthy();
  });

  it('is served as JSON and as a page that loads its own script and styles', async () => {
    const json = await request(app).get('/api/docs.json');
    expect(json.status).toBe(200);
    expect(json.body.info.title).toBe('Layover API');
    const page = await request(app).get('/api/docs');
    expect(page.status).toBe(200);
    expect(page.text).toContain('/api/docs/assets/swagger-ui-bundle.js');
    expect(page.headers['content-security-policy']).toContain("script-src 'self'");
    expect((await request(app).get('/api/docs/init.js')).text).toContain('/api/docs.json');
    expect((await request(app).get('/api/docs/assets/swagger-ui.css')).status).toBe(200);
    expect((await request(app).get('/api/docs/assets/swagger-ui-bundle.js')).status).toBe(200);
  });

  it('does not loosen the policy for the rest of the API', async () => {
    const r = await request(app).get('/health');
    expect(r.headers['content-security-policy']).toContain("style-src 'self'");
    expect(r.headers['content-security-policy']).not.toContain('unsafe-inline');
  });
});
