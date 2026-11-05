import path from 'node:path';
import { solveChallenge, type Challenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import {
  createAccountKeys,
  unlockAccount,
  type KeyPackage,
} from '@posteulen/shared/crypto/keypackage.ts';
import { fromBase64Url, toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { createApp, type App } from '../src/app.ts';
import { loadConfig } from '../src/config.ts';
import { createSecretsFileIfMissing } from '../src/secrets.ts';
import { setRegistrationMode } from '../src/admin/settings.ts';
import { tempDir } from './helpers.ts';

export const USER_ORIGIN = 'https://posteulen.test';
export const ADMIN_ORIGIN = 'https://admin.posteulen.test';
export const BERLIN = { lat: 52.52, lon: 13.405 };
export const HAMBURG = { lat: 53.55, lon: 9.99 };
export const PARIS = { lat: 48.86, lon: 2.35 };

export interface TestApp extends App {
  clock: { now: number };
}

export interface SentPush {
  readonly endpoint: string;
  readonly payload: string;
}

/** Deterministic random numbers in [0, 1) (SPEC 17.2: fixed randomness). */
export function seededRandom(seed = 1): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export async function testApp(
  options: { pushStatus?: number; random?: () => number } = {},
): Promise<TestApp & { pushes: SentPush[] }> {
  const pushes: SentPush[] = [];
  const dir = tempDir();
  const secretsFile = path.join(dir, 'secrets.json');
  await createSecretsFileIfMissing(secretsFile);
  const clock = { now: Date.UTC(2026, 10, 5, 12) };
  const app = await createApp(
    loadConfig({
      POSTEULEN_ENV: 'test',
      POSTEULEN_DATA_DIR: path.join(dir, 'data'),
      POSTEULEN_SECRETS_FILE: secretsFile,
      POSTEULEN_DOMAIN: 'posteulen.test',
    }),
    {
      now: () => clock.now,
      altchaMaxCounter: 20,
      random: options.random ?? seededRandom(),
      pushSender: async (subscription, payload) => {
        pushes.push({ endpoint: subscription.endpoint, payload });
        return { status: options.pushStatus ?? 201 };
      },
    },
  );
  setRegistrationMode(app.db, 'open');
  return Object.assign(app, { clock, pushes });
}

let nextIp = 1;

/** A tiny cookie-aware client for one origin; each agent gets its own IP unless given. */
export class Agent {
  cookie: string | undefined;
  readonly api: FastifyInstance;
  readonly origin: string;
  readonly ip: string;

  constructor(api: FastifyInstance, origin: string, ip = `198.51.100.${nextIp++ % 250}`) {
    this.api = api;
    this.origin = origin;
    this.ip = ip;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<LightMyRequestResponse> {
    const headers: Record<string, string> = { origin: this.origin, 'x-posteulen': '1' };
    if (this.cookie) headers['cookie'] = this.cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await this.api.inject({
      method,
      url,
      headers,
      remoteAddress: this.ip,
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    const setCookie = response.headers['set-cookie'];
    for (const value of Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []) {
      const pair = value.split(';')[0] ?? '';
      this.cookie = pair.endsWith('=') ? undefined : pair;
    }
    return response;
  }

  async json<T = Record<string, unknown>>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    body?: unknown,
  ): Promise<{ status: number; body: T }> {
    const response = await this.request(method, url, body);
    return { status: response.statusCode, body: response.json<T>() };
  }

  async altcha(): Promise<unknown> {
    const challenge = (await this.json<Challenge>('GET', '/api/altcha/challenge')).body;
    const solution = await solveChallenge({ challenge, deriveKey });
    if (!solution) throw new Error('captcha not solved');
    return { challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } };
  }
}

export interface Registered {
  readonly userId: string;
  readonly keyPackage: KeyPackage;
  readonly ed25519Public: Uint8Array;
  readonly x25519Public: Uint8Array;
}

export async function register(
  agent: Agent,
  name: string,
  password: string,
  options: { inviteCode?: string; home?: { lat: number; lon: number } } = {},
): Promise<{ status: number; body: Record<string, unknown>; account?: Registered }> {
  await client.ready();
  const start = client.startRegistration(password);
  const first = await agent.json<{
    reservationId: string;
    userId: string;
    registrationResponse: string;
  }>('POST', '/api/register/start', {
    name,
    altcha: await agent.altcha(),
    registrationRequest: start.request,
    ...(options.inviteCode ? { inviteCode: options.inviteCode } : {}),
  });
  if (first.status !== 200)
    return { status: first.status, body: first.body as unknown as Record<string, unknown> };
  const finish = client.finishRegistration(password, start.state, first.body.registrationResponse);
  const { keyPackage, account } = await createAccountKeys(first.body.userId, finish.exportKey);
  const second = await agent.json('POST', '/api/register/finish', {
    reservationId: first.body.reservationId,
    registrationRecord: finish.record,
    ed25519Public: toBase64Url(account.identity.ed25519Public),
    x25519Public: toBase64Url(account.identity.x25519Public),
    keyPackage,
    home: options.home ?? BERLIN,
  });
  return {
    status: second.status,
    body: second.body,
    account: {
      userId: first.body.userId,
      keyPackage,
      ed25519Public: account.identity.ed25519Public,
      x25519Public: account.identity.x25519Public,
    },
  };
}

export interface LoginResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
  readonly step: 'start' | 'client' | 'finish';
  readonly exportKey?: Uint8Array;
}

export async function login(
  agent: Agent,
  name: string,
  password: string,
  withCaptcha = false,
): Promise<LoginResult> {
  await client.ready();
  const start = client.startLogin(password);
  const first = await agent.json<{ status: string; attemptId?: string; loginResponse?: string }>(
    'POST',
    '/api/login/start',
    {
      name,
      startLoginRequest: start.request,
      ...(withCaptcha ? { altcha: await agent.altcha() } : {}),
    },
  );
  if (first.status !== 200 || first.body.status !== 'ok') {
    return { status: first.status, body: first.body, step: 'start' };
  }
  const result = client.finishLogin(password, start.state, first.body.loginResponse!);
  if (!result) return { status: 0, body: first.body, step: 'client' };
  const second = await agent.json('POST', '/api/login/finish', {
    attemptId: first.body.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  return { status: second.status, body: second.body, step: 'finish', exportKey: result.exportKey };
}

export async function unlockFromLogin(result: LoginResult) {
  const body = result.body as {
    userId: string;
    keyPackage: KeyPackage;
    ed25519Public: string;
    x25519Public: string;
  };
  return unlockAccount(body.userId, body.keyPackage, result.exportKey!, {
    ed25519: fromBase64Url(body.ed25519Public),
    x25519: fromBase64Url(body.x25519Public),
  });
}

/** A registered and logged-in user with its keys (for letter tests). */
export interface Person {
  readonly agent: Agent;
  readonly name: string;
  readonly id: string;
  readonly identity: import('@posteulen/shared/crypto/keypackage.ts').IdentityKeys;
}

export async function person(
  app: TestApp,
  name: string,
  home: { lat: number; lon: number } = BERLIN,
): Promise<Person> {
  const agent = new Agent(app.userApi, USER_ORIGIN);
  const password = 'ein sehr langes Passwort';
  await register(agent, name, password, { home });
  const result = await login(agent, name, password);
  const unlocked = await unlockFromLogin(result);
  return { agent, name, id: String(result.body['userId']), identity: unlocked.identity };
}

export async function couple(a: Person, b: Person): Promise<void> {
  await a.agent.json('POST', '/api/contacts/requests', { name: b.name, label: 'x'.repeat(60) });
  await b.agent.json('POST', '/api/contacts/requests', { name: a.name, label: 'x'.repeat(60) });
}

/** Gives a person gold directly in the database (test set-up only). */
export function setGold(app: TestApp, who: Person, tenths: number): void {
  app.db.run('UPDATE users SET gold = ? WHERE id = ?', tenths, who.id);
}

/** Buys and names an owl of the given species; returns its ID. */
export async function buyOwl(
  app: TestApp,
  who: Person,
  species = 'waldkauz',
  name = 'Waldi',
): Promise<string> {
  const bought = await who.agent.json<{ owl: { id: string } }>('POST', '/api/owls/buy', {
    species,
  });
  if (bought.status !== 200) throw new Error(`buy failed: ${JSON.stringify(bought.body)}`);
  await who.agent.json('POST', `/api/owls/${bought.body.owl.id}/name`, { name });
  return bought.body.owl.id;
}

/** Advances the test clock to `at` (if later) and runs all due events. */
export function advanceTo(app: TestApp, at: number): number {
  app.clock.now = Math.max(app.clock.now, at);
  return app.ctx.queue.runDue();
}

/** Borrows a loan owl of today's offer (one per species, at most three, SPEC 9.6). */
export async function borrowOwl(who: Person): Promise<string> {
  const menagerie = await who.agent.json<{ offer: { species: string; loaned: boolean }[] }>(
    'GET',
    '/api/menagerie',
  );
  const free = menagerie.body.offer.find((item) => !item.loaned);
  if (!free) throw new Error('no free loan species');
  const loaned = await who.agent.json<{ owl: { id: string } }>('POST', '/api/menagerie/loan', {
    species: free.species,
  });
  if (loaned.status !== 200) throw new Error(`loan failed: ${JSON.stringify(loaned.body)}`);
  return loaned.body.owl.id;
}

/** A syntactically valid ID that belongs to no owl. */
export const NO_OWL = 'AAAAAAAAAAAAAAAAAAAAAA';
