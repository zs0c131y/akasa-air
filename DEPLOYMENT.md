# Deployment (Railway or any container host)

1. Create a free MongoDB Atlas cluster. Under Network Access allow the host (for Railway use `0.0.0.0/0`, since its IPs change). Copy the connection string.
2. In Railway, open the service, then **Variables**, and add:

| Variable | Value |
|---|---|
| `MONGODB_URI` | your Atlas connection string (**required**: the app refuses to start without it on a host) |
| `JWT_SECRET` | a long random string (**required**) |
| `COOKIE_SECURE` | leave unset (cookies are `Secure` over HTTPS) |
| `SEED` | `true` for the first deploy so demo data is created, then `false` |
| `CORS_ORIGINS` | optional; only if another website must call the API |

`PORT` is provided by Railway; `TRUST_PROXY` defaults to 1 on Railway.
3. Deploy. The health check path is `/health`.

## Smoke test
Open the public URL, sign in with a demo button, apply for leave, approve it as the manager, open the audit log as the HOD.

## Troubleshooting
- *"MONGODB_URI is not set"* in the logs: add the variable and redeploy.
- *Could not connect to any servers*: Atlas Network Access does not allow the host IP.
- Signed out on every request: the site must be served over HTTPS (secure cookies).
- The embedded MongoDB is for local use only; it cannot run on Alpine images.
