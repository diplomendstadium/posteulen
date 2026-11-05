/**
 * Local production-like preview (not used on servers): serves the built web/ and admin/
 * with the same security headers Caddy sends, and forwards /api to the two API listeners.
 * Web: http://localhost:8080, admin: http://localhost:8081.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  appHeaders,
  CACHE_IMMUTABLE,
  CACHE_REVALIDATE,
} from '@posteulen/shared/security/headers.ts';
import { createApp, listen, startWorkers } from '../app.ts';
import { loadConfig } from '../config.ts';
import { createSecretsFileIfMissing } from '../secrets.ts';
import { adminExists, setInitialAdminPassword } from '../admin/admin-auth.ts';
import { setRegistrationMode, type RegistrationMode } from '../admin/settings.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const WEB_PORT = Number(process.env['POSTEULEN_PREVIEW_WEB_PORT'] ?? 8080);
const ADMIN_PORT = Number(process.env['POSTEULEN_PREVIEW_ADMIN_PORT'] ?? 8081);
const DATA_DIR = path.resolve(process.env['POSTEULEN_DATA_DIR'] ?? path.join(ROOT, 'data'));

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.bin': 'application/octet-stream',
};

function staticServer(distDir: string, apiPort: number): http.Server {
  const headers = appHeaders({ hsts: false });
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      const upstream = http.request(
        {
          host: '127.0.0.1',
          port: apiPort,
          method: req.method,
          path: req.url,
          headers: { ...req.headers, 'x-forwarded-for': '127.0.0.1' },
        },
        (response) => {
          res.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(res);
        },
      );
      upstream.on('error', () => {
        res.writeHead(502).end();
      });
      req.pipe(upstream);
      return;
    }
    let file = path.join(distDir, path.normalize(decodeURIComponent(url.pathname)));
    if (!file.startsWith(distDir)) {
      res.writeHead(400).end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(distDir, 'index.html');
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': url.pathname.startsWith('/assets/') ? CACHE_IMMUTABLE : CACHE_REVALIDATE,
    });
    fs.createReadStream(file).pipe(res);
  });
}

for (const dist of ['web/dist', 'admin/dist']) {
  if (!fs.existsSync(path.join(ROOT, dist, 'index.html'))) {
    console.error(`${dist} fehlt – bitte zuerst „npm run build“ ausführen.`);
    process.exit(1);
  }
}

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const secretsFile = path.join(DATA_DIR, 'secrets.json');
await createSecretsFileIfMissing(secretsFile);
const config = loadConfig({
  POSTEULEN_USER_PORT: process.env['POSTEULEN_USER_PORT'] ?? '3001',
  POSTEULEN_ADMIN_PORT: process.env['POSTEULEN_ADMIN_PORT'] ?? '3002',
  ...process.env,
  POSTEULEN_ENV: 'development',
  POSTEULEN_DATA_DIR: DATA_DIR,
  POSTEULEN_SECRETS_FILE: secretsFile,
  POSTEULEN_USER_ORIGIN: `http://localhost:${WEB_PORT}`,
  POSTEULEN_ADMIN_ORIGIN: `http://localhost:${ADMIN_PORT}`,
  POSTEULEN_LOG_LEVEL: process.env['POSTEULEN_LOG_LEVEL'] ?? 'warn',
});
const relaxed = process.env['POSTEULEN_PREVIEW_RELAXED_LIMITS'] === '1';
if (relaxed && config.env !== 'development') throw new Error('relaxed limits only in development');
// Automated local tests only: flights run this many times faster (energy rules unchanged).
const timeScale = Number(process.env['POSTEULEN_PREVIEW_FLIGHT_TIME_SCALE'] ?? 1);
const app = await createApp(config, {
  relaxedLimits: relaxed,
  flightTimeScale: Number.isFinite(timeScale) && timeScale >= 1 ? timeScale : 1,
});
// Local convenience only: an admin with a one-time password (written to the data folder)
// and, if requested, an initial registration mode.
if (!adminExists(app.db)) {
  const password = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
  fs.writeFileSync(path.join(DATA_DIR, 'admin-erstpasswort.txt'), `${password}\n`, { mode: 0o600 });
  console.warn(`Admin-Erstpasswort (lokal): ${password}`);
}
const mode = process.env['POSTEULEN_PREVIEW_REGISTRATION'];
if (mode === 'open' || mode === 'invite' || mode === 'closed') {
  setRegistrationMode(app.db, mode as RegistrationMode);
}
await listen(app);
startWorkers(app);
const web = staticServer(path.join(ROOT, 'web/dist'), config.userPort).listen(
  WEB_PORT,
  '127.0.0.1',
);
const admin = staticServer(path.join(ROOT, 'admin/dist'), config.adminPort).listen(
  ADMIN_PORT,
  '127.0.0.1',
);
console.warn(
  `PostEulen läuft lokal:\n  App:         http://localhost:${WEB_PORT}\n  Verwaltung:  http://localhost:${ADMIN_PORT}\n  Daten:       ${DATA_DIR}\nBeenden mit Strg+C.`,
);

const stop = (): void => {
  web.close();
  admin.close();
  void app.close().finally(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
