import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type App } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createSecretsFileIfMissing } from '../src/secrets.ts';
import { VERSION } from '@posteulen/shared/version.ts';
import { tempDir } from './helpers.ts';

const USER = 'https://posteulen.test';
const ADMIN = 'https://admin.posteulen.test';

let app: App;

beforeEach(async () => {
  const dir = tempDir();
  const secretsFile = path.join(dir, 'secrets.json');
  await createSecretsFileIfMissing(secretsFile);
  app = await createApp(
    loadConfig({
      POSTEULEN_ENV: 'test',
      POSTEULEN_DATA_DIR: path.join(dir, 'data'),
      POSTEULEN_SECRETS_FILE: secretsFile,
      POSTEULEN_DOMAIN: 'posteulen.test',
    }),
  );
  // A state-changing test route, only for these tests.
  app.userApi.post('/api/test/echo', async (request) => ({ body: request.body }));
});

afterEach(async () => {
  await app.close();
});

describe('API basics (SPEC 4.3, 6)', () => {
  it('answers health with security headers and version on both APIs', async () => {
    for (const [api, kind] of [
      [app.userApi, 'user'],
      [app.adminApi, 'admin'],
    ] as const) {
      const response = await api.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: 'ok', version: VERSION, api: kind });
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['x-posteulen-version']).toBe(VERSION);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('accepts a state-changing request only from its own origin with the required header', async () => {
    const ok = await app.userApi.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { origin: USER, 'x-posteulen': '1', 'content-type': 'application/json' },
      payload: { a: 1 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ body: { a: 1 } });

    for (const headers of [
      { origin: ADMIN, 'x-posteulen': '1' },
      { origin: 'https://evil.example', 'x-posteulen': '1' },
      { 'x-posteulen': '1' },
      { origin: USER },
      { origin: USER, 'x-posteulen': '1', 'sec-fetch-site': 'same-site' },
      { origin: USER, 'x-posteulen': '1', 'sec-fetch-site': 'cross-site' },
    ]) {
      const response = await app.userApi.inject({
        method: 'POST',
        url: '/api/test/echo',
        headers: { ...headers, 'content-type': 'application/json' },
        payload: { a: 1 },
      });
      expect(response.statusCode, JSON.stringify(headers)).toBe(403);
      expect(response.json()).toEqual({ code: 'forbidden_origin' });
    }
  });

  it('keeps admin and user APIs apart', async () => {
    const response = await app.adminApi.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: USER },
    });
    expect(response.statusCode).toBe(403);
    const notThere = await app.adminApi.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { origin: ADMIN, 'x-posteulen': '1', 'content-type': 'application/json' },
      payload: {},
    });
    expect(notThere.statusCode).toBe(404);
  });

  it('accepts only JSON and limits the request size', async () => {
    const base = { origin: USER, 'x-posteulen': '1' };
    const text = await app.userApi.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { ...base, 'content-type': 'text/plain' },
      payload: 'hi',
    });
    expect(text.statusCode).toBe(415);
    expect(text.json()).toEqual({ code: 'unsupported_media_type' });

    const broken = await app.userApi.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { ...base, 'content-type': 'application/json' },
      payload: '{"a":',
    });
    expect(broken.statusCode).toBe(400);
    expect(broken.json()).toEqual({ code: 'bad_request' });

    const big = await app.userApi.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { ...base, 'content-type': 'application/json' },
      payload: JSON.stringify({ x: 'a'.repeat(70_000) }),
    });
    expect(big.statusCode).toBe(413);
    expect(big.json()).toEqual({ code: 'payload_too_large' });
  });

  it('rejects prototype pollution payloads', async () => {
    const response = await app.userApi.inject({
      method: 'POST',
      url: '/api/test/echo',
      headers: { origin: USER, 'x-posteulen': '1', 'content-type': 'application/json' },
      payload: '{"__proto__":{"x":1}}',
    });
    expect(response.statusCode).toBe(400);
  });

  it('hides internals in errors and answers unknown routes with not_found', async () => {
    app.userApi.get('/api/test/fail', async () => {
      throw new Error('secret internal detail');
    });
    const failed = await app.userApi.inject({ method: 'GET', url: '/api/test/fail' });
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toBe('{"code":"internal"}');
    expect(failed.headers['content-security-policy']).toContain("default-src 'none'");

    const missing = await app.userApi.inject({ method: 'GET', url: '/api/nope' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ code: 'not_found' });
  });

  it('asks outdated clients to reload (SPEC 16.3)', async () => {
    const outdated = await app.userApi.inject({
      method: 'GET',
      url: '/api/nope',
      headers: { 'x-posteulen-client-version': '0.0.1' },
    });
    expect(outdated.statusCode).toBe(409);
    expect(outdated.json()).toEqual({ code: 'client_outdated' });
    const health = await app.userApi.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-posteulen-client-version': '0.0.1' },
    });
    expect(health.statusCode).toBe(200);
  });
});
