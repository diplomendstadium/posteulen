import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ADMIN_ORIGIN,
  Agent,
  person,
  setGold,
  testApp,
  USER_ORIGIN,
  type TestApp,
} from './auth-helpers.ts';

let app: TestApp;
beforeAll(async () => {
  app = await testApp();
  app.ctx.limits.expensive.hit = () => 0;
  app.ctx.limits.registration.hit = () => 0;
  app.ctx.limits.admin.hit = () => 0;
  app.ctx.limits.general.hit = () => 0;
});
afterAll(async () => {
  await app.close();
});

const USER_POSTS = [
  '/api/register/start',
  '/api/register/finish',
  '/api/login/start',
  '/api/login/finish',
  '/api/reauth/start',
  '/api/reauth/finish',
  '/api/password/start',
  '/api/password/finish',
  '/api/logout',
];
const ADMIN_POSTS = [
  '/api/login/start',
  '/api/login/finish',
  '/api/reauth/start',
  '/api/password/start',
  '/api/invites',
];

/** Malicious and random bodies never cause a 500 or reach OPAQUE unchecked (SPEC 6, 17.3). */
const bodies = fc.oneof(
  fc.anything(),
  fc.record({
    name: fc.string(),
    startLoginRequest: fc.string(),
    registrationRequest: fc.string({ unit: 'binary' }),
    attemptId: fc.string(),
    finishLoginRequest: fc.base64String(),
    altcha: fc.anything(),
  }),
  fc.constant({ __proto__: { admin: true } }),
  fc.constant({ name: 'x'.repeat(10_000) }),
);

describe('schemas reject malformed input (property-based)', () => {
  it('user API', async () => {
    const agent = new Agent(app.userApi, USER_ORIGIN);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...USER_POSTS), bodies, async (url, body) => {
        const response = await agent.request('POST', url, body === undefined ? null : body);
        expect([400, 401, 403, 409, 410, 413, 415]).toContain(response.statusCode);
      }),
      { numRuns: 300 },
    );
  });

  it('admin API', async () => {
    const agent = new Agent(app.adminApi, ADMIN_ORIGIN);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...ADMIN_POSTS), bodies, async (url, body) => {
        const response = await agent.request('POST', url, body === undefined ? null : body);
        expect([400, 401, 403, 413, 415, 503]).toContain(response.statusCode);
      }),
      { numRuns: 150 },
    );
  });
});

describe('stage-3 endpoints reject malformed input of a logged-in user', () => {
  it('owls, flights, gold', async () => {
    const someone = await person(app, 'Fuzzi');
    setGold(app, someone, 500);
    const owl = await someone.agent.json<{ owl: { id: string } }>('POST', '/api/owls/buy', {
      species: 'waldkauz',
    });
    const id = owl.body.owl.id;
    const posts = [
      '/api/owls/buy',
      `/api/owls/${id}/name`,
      `/api/owls/${id}/gift/prepare`,
      `/api/owls/${id}/gift/send`,
      '/api/flights/preview',
      '/api/gold/prepare',
      '/api/gold/send',
      '/api/letters/prepare',
      '/api/system-messages/arrival-shown',
      '/api/menagerie/loan',
      `/api/owls/${id}/treat`,
      `/api/owls/${id}/menagerie`,
      `/api/clutches/${id}/gift/prepare`,
      `/api/clutches/${id}/gift/send`,
      '/api/account/delete',
      '/api/bot-letters/send',
    ];
    const payloads = fc.oneof(
      bodies,
      fc.record({
        species: fc.oneof(fc.string(), fc.constant('waldkauz')),
        name: fc.string(),
        recipient: fc.string(),
        recipients: fc.array(fc.string()),
        amount: fc.oneof(fc.integer(), fc.double()),
        owlId: fc.oneof(fc.string(), fc.constant(id)),
        withCover: fc.anything(),
        token: fc.string(),
        cover: fc.anything(),
        parchment: fc.string(),
        ids: fc.array(fc.string()),
        kind: fc.oneof(fc.string(), fc.constant('vet'), fc.constant('self')),
        chickId: fc.oneof(fc.string(), fc.constant(id)),
        botId: fc.string(),
        text: fc.string(),
      }),
    );
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...posts), payloads, async (url, body) => {
        const response = await someone.agent.request('POST', url, body === undefined ? null : body);
        expect([200, 400, 403, 404, 410, 413, 415, 429]).toContain(response.statusCode);
      }),
      { numRuns: 300 },
    );
  });
});

describe('every protected endpoint requires its session (SPEC 17.3)', () => {
  const userRoutes: [string, string][] = [
    ['GET', '/api/sync'],
    ['POST', '/api/logout'],
    ['POST', '/api/reauth/start'],
    ['POST', '/api/reauth/finish'],
    ['POST', '/api/password/start'],
    ['POST', '/api/password/finish'],
    ['GET', '/api/owls'],
    ['POST', '/api/owls/buy'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/name'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/feed'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/pet'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/release'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/gift/prepare'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/gift/send'],
    ['POST', '/api/flights/preview'],
    ['GET', '/api/finance'],
    ['POST', '/api/gold/prepare'],
    ['POST', '/api/gold/send'],
    ['GET', '/api/map'],
    ['POST', '/api/system-messages/arrival-shown'],
    ['GET', '/api/menagerie'],
    ['POST', '/api/menagerie/loan'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/treat'],
    ['POST', '/api/owls/AAAAAAAAAAAAAAAAAAAAAA/menagerie'],
    ['POST', '/api/clutches/AAAAAAAAAAAAAAAAAAAAAA/gift/prepare'],
    ['POST', '/api/clutches/AAAAAAAAAAAAAAAAAAAAAA/gift/send'],
    ['PATCH', '/api/account/name'],
    ['PATCH', '/api/account/home'],
    ['POST', '/api/account/delete'],
    ['POST', '/api/bot-letters/send'],
  ];
  const adminRoutes: [string, string][] = [
    ['GET', '/api/me'],
    ['POST', '/api/logout'],
    ['POST', '/api/reauth/start'],
    ['POST', '/api/password/start'],
    ['POST', '/api/password/finish'],
    ['GET', '/api/settings/registration'],
    ['PUT', '/api/settings/registration'],
    ['GET', '/api/invites'],
    ['POST', '/api/invites'],
    ['DELETE', '/api/invites/AAAAAAAAAAAAAAAAAAAAAA'],
    ['GET', '/api/errors'],
    ['PATCH', '/api/errors/1'],
    ['DELETE', '/api/errors/1'],
    ['GET', '/api/stats'],
    ['GET', '/api/settings/inactivity'],
    ['PUT', '/api/settings/inactivity'],
    ['GET', '/api/broadcasts'],
    ['POST', '/api/broadcasts'],
    ['GET', '/api/openai'],
    ['PUT', '/api/openai/key'],
    ['DELETE', '/api/openai/key'],
    ['PUT', '/api/openai/settings'],
    ['GET', '/api/openai/models'],
    ['POST', '/api/openai/test'],
  ];

  it.each(userRoutes)('user %s %s → 401', async (method, url) => {
    const response = await new Agent(app.userApi, USER_ORIGIN).request(
      method as 'GET',
      url,
      method === 'GET' ? undefined : {},
    );
    expect(response.statusCode).toBe(401);
  });

  it.each(adminRoutes)('admin %s %s → 401', async (method, url) => {
    const response = await new Agent(app.adminApi, ADMIN_ORIGIN).request(
      method as 'GET',
      url,
      method === 'GET' || method === 'DELETE' ? undefined : {},
    );
    expect(response.statusCode).toBe(401);
  });

  it('user routes do not exist on the admin API and vice versa', async () => {
    expect(
      (await new Agent(app.adminApi, ADMIN_ORIGIN).request('GET', '/api/sync')).statusCode,
    ).toBe(404);
    expect(
      (await new Agent(app.userApi, USER_ORIGIN).request('GET', '/api/invites')).statusCode,
    ).toBe(404);
  });
});
