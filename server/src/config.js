import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');

/** Read lazily so tests can change env vars before first use. */
export const config = {
  get port() {
    return Number(process.env.PORT ?? 4000);
  },
  get jwtSecret() {
    return process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN ?? '8h';
  },
  /** If empty, an embedded MongoDB is started (persisted under dataDir). */
  get mongoUri() {
    return process.env.MONGODB_URI || '';
  },
  get dataDir() {
    return process.env.DATA_DIR ?? path.join(root, 'data');
  },
  get clientDist() {
    return path.join(root, 'client', 'dist');
  },
  get seedOnStart() {
    return process.env.SEED !== 'false';
  },
};
