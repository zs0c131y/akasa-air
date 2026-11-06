import express, { Router } from 'express';
import swaggerUi from 'swagger-ui-dist';
import { buildOpenApi } from '../openapi.js';

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Layover API</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
    <link rel="icon" href="/favicon.svg" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/api/docs/init.js"></script>
  </body>
</html>`;

const INIT = `window.ui = SwaggerUIBundle({
  url: '/api/docs.json',
  dom_id: '#swagger-ui',
  deepLinking: true,
  persistAuthorization: true,
  tryItOutEnabled: false,
  requestInterceptor: (req) => { req.headers['X-Requested-With'] = 'lms'; return req; },
});`;

/** The API documentation: the OpenAPI description (/api/docs.json) and a page to browse and try it (/api/docs). */
export function createDocsRouter() {
  const router = Router();
  const spec = buildOpenApi();

  // The page needs a little more than the app's strict policy (styles are applied by the Swagger UI script). Still same-origin only.
  router.use((_req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'",
    );
    next();
  });
  router.get('/docs.json', (_req, res) => res.json(spec));
  router.get('/docs', (_req, res) => res.type('html').send(PAGE));
  router.get('/docs/init.js', (_req, res) => res.type('js').send(INIT));
  router.use('/docs/assets', express.static(swaggerUi.getAbsoluteFSPath(), { index: false, maxAge: '1d' }));
  return router;
}
