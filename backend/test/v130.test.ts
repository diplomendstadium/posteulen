/**
 * Version 1.3.0 (server side): account binding of web app requests (SPEC 5.5).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  couple,
  HAMBURG,
  person,
  testApp,
  USER_ORIGIN,
  withoutBots,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

let app: TestApp & { pushes: SentPush[] };
let anna: Person;
let ben: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  ben = await person(app, 'Ben', HAMBURG);
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

/** A request with Ben's cookie that expects a certain account (header or SSE query). */
function asBen(method: 'GET' | 'POST', url: string, expected: string | null, body?: unknown) {
  const headers: Record<string, string> = {
    origin: USER_ORIGIN,
    'x-posteulen': '1',
    cookie: ben.agent.cookie ?? '',
  };
  if (expected) headers['x-posteulen-account'] = expected;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return ben.agent.api.inject({
    method,
    url,
    headers,
    remoteAddress: ben.agent.ip,
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
}

describe('account binding (SPEC 5.5)', () => {
  it('a request of account A arriving with the cookie of B is refused without effect', async () => {
    await couple(anna, ben);
    // Anna's old tab reports a key warning – but the cookie belongs to Ben by now.
    const refused = await asBen('POST', `/api/contacts/${anna.id}/key-warning`, anna.id, {});
    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({ code: 'account_mismatch' });
    const contacts = await ben.agent.json<{ contacts: { keyWarning: boolean }[] }>(
      'GET',
      '/api/contacts',
    );
    expect(contacts.body.contacts[0]?.keyWarning).toBe(false);
  });

  it('a stale logout of A does not end the session of B', async () => {
    const refused = await asBen('POST', '/api/logout', anna.id, {});
    expect(refused.statusCode).toBe(409);
    expect((await ben.agent.json('GET', '/api/sync')).status).toBe(200);
  });

  it('the expected account is accepted, and requests without one still work', async () => {
    expect((await asBen('GET', '/api/sync', ben.id)).statusCode).toBe(200);
    expect((await asBen('GET', '/api/sync', null)).statusCode).toBe(200);
  });

  it('the live connection checks the account in its query', async () => {
    const refused = await asBen('GET', `/api/events?account=${anna.id}`, null);
    expect(refused.statusCode).toBe(409);
  });

  it('a refused request does not count as activity', async () => {
    app.db.run("UPDATE users SET last_active_date = '2000-01-01' WHERE id = ?", ben.id);
    await asBen('GET', '/api/sync', anna.id);
    const row = app.db.get<{ last_active_date: string }>(
      'SELECT last_active_date FROM users WHERE id = ?',
      ben.id,
    );
    expect(row?.last_active_date).toBe('2000-01-01');
  });
});
