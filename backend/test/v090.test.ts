/**
 * Version 0.9.0: PostEulen in the Tor network (SPEC 16.5) – the same user API on a second, local
 * listener for the onion site (own origin, own cookie without Secure, all Tor visitors as one
 * client for the IP limits, switch in the admin panel), the footer link, www redirect and onion
 * site in the Caddyfile, and the owl statistics of the admin panel.
 */
import fs from 'node:fs';
import type { LightMyRequestResponse } from 'fastify';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listenTor } from '../src/http/server.ts';
import { generateCaddyfile, type CaddyfileOptions } from '../src/ops/caddyfile.ts';
import {
  footerOnionLink,
  reportTorError,
  setTorEnabled,
  setTorStatus,
  torEnabled,
} from '../src/ops/tor.ts';
import { owlsBySpecies } from '../src/admin/operations.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { clientKey, TOR_CLIENT_KEY } from '../src/security/ip.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  buyOwl,
  login,
  person,
  register,
  setGold,
  testApp,
  USER_ORIGIN,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

const ONION = `${'abcdefghijklmnopqrstuvwxyz234567'.repeat(2).slice(0, 56)}.onion`;
const TOR_ORIGIN = `http://${ONION}`;

/**
 * A client of the onion site: real HTTP requests to the Tor listener of the user API (like
 * Caddy's onion site forwards them), with the onion origin and its own cookie.
 */
class TorAgent extends Agent {
  readonly port: number;

  constructor(app: TestApp, port: number) {
    super(app.userApi, TOR_ORIGIN, '127.0.0.1');
    this.port = port;
  }

  override async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
    extra: Record<string, string> = {},
  ): Promise<LightMyRequestResponse> {
    const headers: Record<string, string> = { origin: this.origin, 'x-posteulen': '1', ...extra };
    if (this.cookie) headers['cookie'] = this.cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`http://127.0.0.1:${this.port}${url}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    const cookies = response.headers.getSetCookie();
    for (const value of cookies) {
      const pair = value.split(';')[0] ?? '';
      this.cookie = pair.endsWith('=') ? undefined : pair;
    }
    return {
      statusCode: response.status,
      headers: { ...Object.fromEntries(response.headers), 'set-cookie': cookies },
      body: text,
      json: () => JSON.parse(text) as unknown,
    } as unknown as LightMyRequestResponse;
  }
}

let app: TestApp & { pushes: SentPush[] };
let torPort: number;

beforeEach(async () => {
  app = await testApp({ env: { POSTEULEN_ONION: ONION } });
  // Only the Tor listener needs a real port; the clearnet API is reached through inject().
  torPort = await listenTor(app.userApi, '127.0.0.1', 0);
});
afterEach(async () => {
  await app.close();
});

describe('Tor-Listener (SPEC 16.5)', () => {
  it('beantwortet dieselbe API mit eigener Herkunft und ohne HSTS', async () => {
    const tor = new TorAgent(app, torPort);
    const health = await tor.request('GET', '/api/health');
    expect(health.statusCode).toBe(200);
    expect(health.headers['strict-transport-security']).toBeUndefined();
    expect(health.headers['content-security-policy']).toContain("default-src 'none'");

    // The clearnet origin is wrong on the onion site – and the onion origin on the clearnet.
    const wrong = new TorAgent(app, torPort);
    Object.defineProperty(wrong, 'origin', { value: USER_ORIGIN });
    expect((await wrong.request('POST', '/api/register/start', {})).statusCode).toBe(403);
    expect((await tor.request('POST', '/api/register/start', {})).statusCode).toBe(400);
    const clearnet = new Agent(app.userApi, TOR_ORIGIN);
    expect((await clearnet.request('POST', '/api/register/start', {})).statusCode).toBe(403);
  });

  it('ein Header kann eine Anfrage nicht zur Tor-Anfrage machen', async () => {
    const response = await app.userApi.inject({
      method: 'GET',
      url: '/api/onion',
      headers: { origin: TOR_ORIGIN, 'x-forwarded-for': '127.0.0.1', via: 'tor' },
    });
    // Over the clearnet the onion origin is foreign.
    expect(response.statusCode).toBe(403);
  });

  it('Konto, Sitzung und Spielstand sind dieselben – eine aktive Sitzung für die ganze Instanz', async () => {
    const password = 'ein sehr langes Passwort';
    const web = new Agent(app.userApi, USER_ORIGIN);
    await register(web, 'Anna', password);
    expect((await login(web, 'Anna', password)).status).toBe(200);
    expect(web.cookie?.startsWith('__Host-pe_session=')).toBe(true);
    expect((await web.json('GET', '/api/sync')).status).toBe(200);

    // Logging in over Tor: same account, cookie without __Host-/Secure (plain http onion site).
    const tor = new TorAgent(app, torPort);
    await client.ready();
    const result = await login(tor, 'Anna', password);
    expect(result.status).toBe(200);
    expect(result.body['userId']).toBeDefined();
    expect(tor.cookie?.startsWith('pe_session=')).toBe(true);
    const raw = await tor.request('GET', '/api/sync');
    expect(raw.statusCode).toBe(200);
    // The clearnet session has ended (one active session per account, SPEC 5.5).
    expect((await web.json('GET', '/api/sync')).status).toBe(401);

    // And back: logging in on the clearnet ends the Tor session.
    expect((await login(web, 'Anna', password)).status).toBe(200);
    expect((await tor.request('GET', '/api/sync')).statusCode).toBe(401);
  });

  it('beim Anmelden über Tor ist das Cookie nicht Secure, über das Clearnet schon', async () => {
    const password = 'ein sehr langes Passwort';
    await register(new Agent(app.userApi, USER_ORIGIN), 'Ben', password);
    const tor = new TorAgent(app, torPort);
    await client.ready();
    const start = client.startLogin(password);
    const first = await tor.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/login/start',
      { name: 'Ben', startLoginRequest: start.request },
    );
    const finish = client.finishLogin(password, start.state, first.body.loginResponse)!;
    const response = await tor.request('POST', '/api/login/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: finish.finishRequest,
    });
    const cookie = String((response.headers['set-cookie'] as string[])[0]);
    expect(cookie).toMatch(/^pe_session=/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain('Secure');
  });

  it('alle Tor-Besucher teilen sich die IP-Limits – auch mit wechselnden X-Forwarded-For', async () => {
    expect(clientKey({ ip: '203.0.113.9', viaTor: true })).toBe(TOR_CLIENT_KEY);
    expect(clientKey({ ip: '203.0.113.9', viaTor: false })).toBe('203.0.113.9');
    const tor = new TorAgent(app, torPort);
    const statuses: number[] = [];
    // Registration: 5 per hour and client (SPEC 5.10) – here for all Tor visitors together.
    for (let i = 1; i <= 6; i++) {
      const response = await tor.request(
        'POST',
        '/api/register/start',
        {},
        {
          'x-forwarded-for': `198.51.100.${i}`,
        },
      );
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 5)).toEqual([400, 400, 400, 400, 400]);
    expect(statuses[5]).toBe(429);
    // Clearnet visitors keep their own counters.
    const web = new Agent(app.userApi, USER_ORIGIN);
    expect((await web.request('POST', '/api/register/start', {})).statusCode).toBe(400);
  });

  it('abgeschaltet: Tor-Anfragen 503, normale Seite läuft weiter, Schalter-Datei für den Server', async () => {
    expect(torEnabled(app.db)).toBe(true);
    setTorEnabled(app.ctx, false);
    expect(fs.readFileSync(app.config.torSwitchFile, 'utf8')).toBe('off\n');
    const tor = new TorAgent(app, torPort);
    const response = await tor.request('GET', '/api/health');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: 'tor_disabled' });
    const web = new Agent(app.userApi, USER_ORIGIN);
    expect((await web.request('GET', '/api/health')).statusCode).toBe(200);

    setTorEnabled(app.ctx, true);
    expect(fs.readFileSync(app.config.torSwitchFile, 'utf8')).toBe('on\n');
    expect((await tor.request('GET', '/api/health')).statusCode).toBe(200);
  });
});

describe('Footer-Link „Tor-Netz“ (SPEC 8.1)', () => {
  it('erscheint erst nach erfolgreicher Einrichtung, nicht auf der Onion-Seite, nicht abgeschaltet', async () => {
    const web = new Agent(app.userApi, USER_ORIGIN);
    const tor = new TorAgent(app, torPort);
    const url = async (agent: Agent) =>
      (await agent.json<{ url: string | null }>('GET', '/api/onion')).body.url;

    expect(await url(web)).toBeNull(); // set up, but no successful check yet
    setTorStatus(app.db, 'ok', app.clock.now);
    expect(await url(web)).toBe(`${TOR_ORIGIN}/`);
    expect(await url(tor)).toBeNull();

    setTorEnabled(app.ctx, false);
    expect(await url(web)).toBeNull();
    setTorEnabled(app.ctx, true);
    reportTorError(app.db, app.clock.now, { what: 'Tor fällt aus.', cause: 'Test.', action: '-' });
    expect(await url(web)).toBeNull();
    const logged = app.db.get<{ component: string; severity: string }>(
      "SELECT component, severity FROM error_log WHERE what = 'Tor fällt aus.'",
    );
    expect(logged).toEqual({ component: 'Tor', severity: 'error' });
  });

  it('ohne Onion-Adresse gibt es weder Link noch Tor-Listener', async () => {
    const plain = await testApp();
    try {
      expect(footerOnionLink(plain.ctx, false)).toBeNull();
      await expect(listenTor(plain.userApi, '127.0.0.1', 0)).rejects.toThrow();
      const web = new Agent(plain.userApi, USER_ORIGIN);
      expect((await web.json('GET', '/api/onion')).body).toEqual({ url: null });
    } finally {
      await plain.close();
    }
  });
});

describe('Adminpanel: Tor-Schalter und Eulen-Statistik (SPEC 13)', () => {
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

  it('zeigt Adresse und Zustand und schaltet Tor ab und wieder an', async () => {
    const admin = await adminAgent();
    setTorStatus(app.db, 'ok', app.clock.now);
    const overview = await admin.json('GET', '/api/settings/tor');
    expect(overview.body).toEqual({
      onion: TOR_ORIGIN,
      enabled: true,
      status: 'ok',
      statusAt: app.clock.now,
      message: null,
    });
    const off = await admin.json('PUT', '/api/settings/tor', { enabled: false });
    expect(off.body['enabled']).toBe(false);
    expect(fs.readFileSync(app.config.torSwitchFile, 'utf8')).toBe('off\n');
    expect((await admin.json('PUT', '/api/settings/tor', { enabled: 'nein' })).status).toBe(400);
    expect((await admin.json('PUT', '/api/settings/tor', { enabled: true })).body['enabled']).toBe(
      true,
    );
    // Players cannot reach it.
    const player = await person(app, 'Carla');
    expect((await player.agent.json('GET', '/api/settings/tor')).status).toBe(404);
  });

  it('zählt Eulen der Spieler je Art – ohne Leiheulen und ohne Eulen der Bots', async () => {
    const anna = await person(app, 'Anna');
    setGold(app, anna, 500);
    await buyOwl(app, anna, 'waldkauz', 'Waldi');
    await buyOwl(app, anna, 'waldkauz', 'Wanda');
    await buyOwl(app, anna, 'schleiereule', 'Schleier');
    const owlId = app.db.get<{ id: string }>(
      "SELECT id FROM owls WHERE owner_id = ? AND name = 'Wanda'",
      anna.id,
    )!.id;
    app.db.run('UPDATE owls SET is_chick = 1 WHERE id = ?', owlId);
    // A loan owl and a bot owl do not count.
    app.db.run(
      `INSERT INTO owls (id, owner_id, kind, species, sex, name, energy, energy_at, owned_since, created_at)
       VALUES ('LOANLOANLOANLOANLOAN01', ?, 'loan', 'waldkauz', 'f', 'Leih', 100, 0, '2026-11-05', 0),
              ('BOTBOTBOTBOTBOTBOTBO01', ?, 'bot', 'waldkauz', 'm', 'Bot', 100, 0, '2026-11-05', 0)`,
      anna.id,
      anna.id,
    );
    const stats = owlsBySpecies(app.ctx);
    expect(stats.find((row) => row.species === 'waldkauz')).toEqual({
      species: 'waldkauz',
      count: 2,
      chicks: 1,
    });
    expect(stats.find((row) => row.species === 'schleiereule')?.count).toBe(1);
    expect(stats.find((row) => row.species === 'phoenix')).toEqual({
      species: 'phoenix',
      count: 0,
      chicks: 0,
    });
    const admin = await adminAgent();
    const response = await admin.json<{ owls: { species: string; count: number }[] }>(
      'GET',
      '/api/stats',
    );
    expect(response.body.owls.reduce((sum, row) => sum + row.count, 0)).toBe(3);
  });
});

describe('Caddyfile: www und Onion-Seite (SPEC 16.2, 16.5)', () => {
  const base: CaddyfileOptions = {
    domain: 'posteulen.de',
    testMode: false,
    webRoot: '/opt/posteulen/current/web/dist',
    adminRoot: '/opt/posteulen/current/admin/dist',
    botsRoot: '/opt/posteulen/current/bots/dist',
    localDir: '/etc/posteulen/local',
    userPort: 3001,
    adminPort: 3002,
    botsPort: 3003,
  };

  it('www nur auf Wunsch – als dauerhafte Weiterleitung auf die Domain', () => {
    expect(generateCaddyfile(base)).not.toContain('www.posteulen.de');
    const withWww = generateCaddyfile({ ...base, www: true });
    expect(withWww).toMatch(
      /www\.posteulen\.de \{[^}]*\}[^}]*redir https:\/\/posteulen\.de\{uri\} 308/s,
    );
  });

  it('Onion-Seite nur lokal und ohne HSTS; Onion-Location nur, solange Tor läuft', () => {
    const onion = { host: ONION, listenPort: 3005, apiPort: 3004, active: true };
    const text = generateCaddyfile({ ...base, onion });
    const block = text.slice(text.indexOf(`http://${ONION}:3005 {`));
    expect(block).toContain('bind 127.0.0.1');
    expect(block).toContain('reverse_proxy 127.0.0.1:3004');
    expect(block).not.toContain('Strict-Transport-Security');
    expect(block).not.toContain('Onion-Location');
    expect(block).not.toContain('tls internal');
    const main = text.slice(text.indexOf('posteulen.de {'), text.indexOf('admin.posteulen.de {'));
    expect(main).toContain(`Onion-Location "http://${ONION}{uri}"`);

    const inactive = generateCaddyfile({ ...base, onion: { ...onion, active: false } });
    expect(inactive).not.toContain('Onion-Location');
    expect(inactive).toContain(`http://${ONION}:3005 {`);
  });

  it('lehnt ungültige Onion-Adressen ab', () => {
    const onion = { host: 'beispiel.onion', listenPort: 3005, apiPort: 3004, active: true };
    expect(() => generateCaddyfile({ ...base, onion })).toThrow('invalid onion address');
  });
});
