import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from './config.js';

let memoryServer = null;

/** Connects to MONGODB_URI, or starts an embedded MongoDB with persisted data when unset. */
export async function connectDb() {
  let uri = config.mongoUri;
  if (!uri && (config.isProd || fs.existsSync('/etc/alpine-release'))) {
    // Hosted/containerised runs must use a real database: the embedded one has no build for Alpine
    // and would lose data on redeploy anyway.
    console.error(
      '\n[db] MONGODB_URI is not set. Add it to the environment variables of your host (for example a MongoDB Atlas connection string) and redeploy.\n',
    );
    process.exit(1);
  }
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.join(config.dataDir, 'mongo');
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({ instance: { dbPath, storageEngine: 'wiredTiger' } });
    uri = memoryServer.getUri();
    console.log(`[db] Using embedded MongoDB (data in ${dbPath})`);
  } else {
    console.log('[db] Using MONGODB_URI');
  }
  await mongoose.connect(uri, { dbName: 'leave_management' });
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function disconnectDb() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop({ doCleanup: false });
}
