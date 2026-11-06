import { config } from './config.js';
import { connectDb, disconnectDb } from './db.js';
import { createApp } from './app.js';
import { seedIfEmpty, DEMO_USERS } from './seed.js';

if (!process.env.JWT_SECRET) {
  if (config.isProd) {
    console.error('[config] JWT_SECRET must be set in production. Refusing to start.');
    process.exit(1);
  }
  console.warn('[config] JWT_SECRET not set; using an insecure development default.');
}

await connectDb();
if (config.seedOnStart && (await seedIfEmpty())) console.log('[seed] Demo data created.');

const server = createApp().listen(config.port, () => {
  const url = `http://localhost:${config.port}`;
  console.log(`\nLeave Management System running at ${url}`);
  console.log(`Health: ${url}/health`);
  console.log('\nDemo accounts (use the one-click buttons on the sign-in page):');
  for (const u of DEMO_USERS.filter((x) => ['HOD', 'MANAGER'].includes(x.role) || x.key === 'arjun')) {
    console.log(`  ${u.role.padEnd(8)} ${u.email}`);
  }
});

const shutdown = async () => {
  server.close();
  await disconnectDb();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
