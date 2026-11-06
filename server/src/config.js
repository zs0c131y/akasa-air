import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');

// Load <repo>/.env if present (real environment variables take precedence).
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  /* no .env file: defaults apply */
}

/** Read lazily so tests can change env vars before first use. */
export const config = {
  get port() {
    return Number(process.env.PORT ?? 4000);
  },
  get jwtSecret() {
    return process.env.JWT_SECRET ?? 'dev-only-secret-change-me';
  },
  get isProd() {
    return process.env.NODE_ENV === 'production' || Boolean(process.env.RAILWAY_ENVIRONMENT);
  },
  /** Short-lived access token; the refresh token (below) renews it. */
  get accessTtl() {
    return process.env.ACCESS_TTL ?? '15m';
  },
  get refreshDays() {
    return Number(process.env.REFRESH_DAYS ?? 7);
  },
  /** Comma-separated extra browser origins allowed to call the API (same-origin is always allowed). */
  get corsOrigins() {
    return (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  },
  /** Number of reverse proxies in front of the app (1 on Railway/Heroku) so req.ip is correct. */
  get trustProxy() {
    return Number(process.env.TRUST_PROXY ?? (process.env.RAILWAY_ENVIRONMENT ? 1 : 0));
  },
  get maxFailedLogins() {
    return Number(process.env.MAX_FAILED_LOGINS ?? 5);
  },
  get lockMinutes() {
    return Number(process.env.LOCK_MINUTES ?? 15);
  },
  get apiRateMax() {
    return Number(process.env.API_RATE_MAX ?? 600);
  },
  get loginRateMax() {
    return Number(process.env.LOGIN_RATE_MAX ?? 60);
  },
  get logRequests() {
    return process.env.NODE_ENV !== 'test';
  },
  /** If empty, an embedded MongoDB is started (persisted under dataDir). */
  get mongoUri() {
    const uri = process.env.MONGODB_URI || '';
    return uri === 'embedded' ? '' : uri; // MONGODB_URI=embedded forces the built-in database
  },
  get dataDir() {
    return process.env.DATA_DIR ?? path.join(root, 'data');
  },
  get clientDist() {
    return path.join(root, 'client', 'dist');
  },
  /** Public address of the app, used in the links inside emails. */
  get appUrl() {
    return (process.env.APP_URL || `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/+$/, '');
  },
  /** Mailgun HTTP API (same variables as the other projects). All three of key, sender and domain are needed to send. */
  get mailgun() {
    const senderEmail = process.env.FROM_EMAIL || '';
    return {
      apiKey: process.env.MAILGUN_API_KEY || '',
      baseUrl: (process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net').replace(/\/+$/, ''),
      senderEmail,
      senderName: process.env.MAILGUN_SENDER_NAME || 'Layover',
      domain: senderEmail.split('@')[1] || '',
    };
  },
  /** Optional comma-separated list of email domains allowed to sign up (empty = any). */
  get allowedEmailDomains() {
    return (process.env.ALLOWED_EMAIL_DOMAINS ?? '').split(',').map((s) => s.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
  },
  get seedOnStart() {
    return process.env.SEED !== 'false';
  },
};
