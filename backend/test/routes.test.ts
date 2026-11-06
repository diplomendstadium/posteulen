/**
 * Route inventory from the source code (security review, SPEC 6 and 17.3): every endpoint that
 * is not explicitly public requires its session, and endpoints without payload reject any body.
 * New endpoints are covered automatically.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { ADMIN_ORIGIN, Agent, person, testApp, USER_ORIGIN, type TestApp } from './auth-helpers.ts';

interface Route {
  readonly api: 'user' | 'admin';
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly url: string;
  readonly protectedRoute: boolean;
  readonly emptyBody: boolean;
}

const SOURCE = path.resolve(import.meta.dirname, '../src');
const ADMIN_FILES = new Set(['admin/admin-routes.ts', 'admin/operations.ts']);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'dev' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

function inventory(): Route[] {
  const routes: Route[] = [];
  for (const file of sourceFiles(SOURCE)) {
    const relative = path.relative(SOURCE, file);
    const text = fs.readFileSync(file, 'utf8');
    const pattern = /app\.(get|post|put|patch|delete)\(\s*'([^']+)'\s*,\s*(\{[^}]*\})?/g;
    for (const match of text.matchAll(pattern)) {
      const options = match[3] ?? '';
      routes.push({
        api: ADMIN_FILES.has(relative) ? 'admin' : 'user',
        method: match[1]!.toUpperCase() as Route['method'],
        url: match[2]!,
        protectedRoute: options.includes('preHandler'),
        emptyBody: options.includes('emptyBody'),
      });
    }
  }
  return routes;
}

const ROUTES = inventory();
const PUBLIC = [
  'admin GET /api/altcha/challenge',
  'admin GET /api/session',
  'admin POST /api/login/finish',
  'admin POST /api/login/start',
  'user GET /api/altcha/challenge',
  'user GET /api/health',
  'user GET /api/registration',
  'user GET /api/session',
  'user GET /api/version',
  'user POST /api/login/finish',
  'user POST /api/login/start',
  'user POST /api/push/ack',
  'user POST /api/register/finish',
  'user POST /api/register/start',
];

const concrete = (url: string): string =>
  url
    .replace(/:id\b/g, url.startsWith('/api/errors') ? '1' : 'AAAAAAAAAAAAAAAAAAAAAA')
    .replace(/:(peer|contactId)\b/g, 'AAAAAAAAAAAAAAAAAAAAAA');
const label = (route: Route): string => `${route.api} ${route.method} ${route.url}`;

let app: TestApp;
beforeAll(async () => {
  app = await testApp();
  for (const limit of Object.values(app.ctx.limits)) limit.hit = () => 0;
});
afterAll(async () => {
  await app.close();
});

async function adminAgent(): Promise<Agent> {
  const password = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
  const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
  await client.ready();
  const start = client.startLogin(password);
  const first = await admin.json<{ attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    { startLoginRequest: start.request },
  );
  const result = client.finishLogin(password, start.state, first.body.loginResponse)!;
  await admin.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  app.db.run('UPDATE admin SET must_change_password = 0');
  return admin;
}

describe('Routen-Inventar (SPEC 6, 17.3)', () => {
  it('findet alle Endpunkte; öffentlich sind nur Anmeldung, Registrierung und Technik', () => {
    expect(ROUTES.length).toBeGreaterThan(90);
    expect(
      ROUTES.filter((route) => !route.protectedRoute)
        .map(label)
        .sort(),
    ).toEqual(PUBLIC);
  });

  it.each(ROUTES.filter((route) => route.protectedRoute).map((route) => [label(route), route]))(
    '%s → 401 ohne Sitzung',
    async (_name, route) => {
      const agent = new Agent(
        route.api === 'user' ? app.userApi : app.adminApi,
        route.api === 'user' ? USER_ORIGIN : ADMIN_ORIGIN,
      );
      const response = await agent.request(
        route.method as 'GET',
        concrete(route.url),
        route.method === 'GET' || route.method === 'DELETE' ? undefined : {},
      );
      expect(response.statusCode).toBe(401);
    },
  );

  it('Endpunkte ohne Nutzdaten lehnen unbekannte Felder ab, akzeptieren aber {}', async () => {
    const someone = await person(app, 'Leerkörper');
    const admin = await adminAgent();
    const empty = ROUTES.filter((route) => route.emptyBody);
    expect(empty.length).toBeGreaterThanOrEqual(18);
    for (const route of empty) {
      if (route.url.endsWith('/logout')) continue; // would end the session for the next checks
      const agent = route.api === 'user' ? someone.agent : admin;
      const response = await agent.request(route.method as 'POST', concrete(route.url), {
        unbekannt: 1,
      });
      expect(response.statusCode, label(route)).toBe(400);
      expect(response.json(), label(route)).toEqual({ code: 'bad_request' });
      const array = await agent.request(route.method as 'POST', concrete(route.url), []);
      expect(array.statusCode, label(route)).toBe(400);
    }
    // `{}` passes the check and reaches the handler (here: unknown owl → 404).
    const fine = await someone.agent.request('POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/pet', {});
    expect(fine.statusCode).toBe(404);
  });

  it('Fehlerprotokoll-IDs nur als Dezimalzahl', async () => {
    const admin = await adminAgent();
    for (const id of ['1e2', '-1', '0', '01', 'abc', '9'.repeat(16)]) {
      const response = await admin.request('DELETE', `/api/errors/${id}`);
      expect(response.statusCode, id).toBe(400);
    }
    expect((await admin.request('DELETE', '/api/errors/123456')).statusCode).toBe(404);
  });
});
