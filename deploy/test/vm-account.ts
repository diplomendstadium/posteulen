/**
 * Test account in the VM (SPEC 17.6: accounts can still log in after updates). Runs with the
 * code of the installed release and talks HTTPS to the local Caddy like a browser would.
 *   node vm-account.ts register <name> <password>
 *   node vm-account.ts login <name> <password>
 */
import fs from 'node:fs';
import { solveChallenge, type Challenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/sha';
import * as client from '../../shared/src/crypto/opaque-client.ts';
import {
  createAccountKeys,
  unlockAccount,
  type KeyPackage,
} from '../../shared/src/crypto/keypackage.ts';
import { fromBase64Url, toBase64Url } from '../../shared/src/crypto/encoding.ts';

const BASE = 'https://posteulen.test';
const STATE = '/root/vmtest-account.json';
let cookie = '';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      origin: BASE,
      'x-posteulen': '1',
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0] ?? '';
  const data = (await response.json()) as T;
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function captcha(): Promise<unknown> {
  const challenge = await call<Challenge>('GET', '/api/altcha/challenge');
  const solution = await solveChallenge({ challenge, deriveKey });
  if (!solution) throw new Error('captcha');
  return { challenge, solution: { counter: solution.counter, derivedKey: solution.derivedKey } };
}

const [command, name, password] = process.argv.slice(2);
if (!command || !name || !password)
  throw new Error('usage: vm-account.ts register|login <name> <password>');
await client.ready();

if (command === 'register') {
  const start = client.startRegistration(password);
  const first = await call<{ reservationId: string; userId: string; registrationResponse: string }>(
    'POST',
    '/api/register/start',
    {
      name,
      altcha: await captcha(),
      registrationRequest: start.request,
    },
  );
  const finish = client.finishRegistration(password, start.state, first.registrationResponse);
  const { keyPackage, account } = await createAccountKeys(first.userId, finish.exportKey);
  await call('POST', '/api/register/finish', {
    reservationId: first.reservationId,
    registrationRecord: finish.record,
    ed25519Public: toBase64Url(account.identity.ed25519Public),
    x25519Public: toBase64Url(account.identity.x25519Public),
    keyPackage,
    home: { lat: 52.52, lon: 13.4 },
  });
  fs.writeFileSync(
    STATE,
    JSON.stringify({
      userId: first.userId,
      ed25519Public: toBase64Url(account.identity.ed25519Public),
    }),
  );
  console.log(`registriert: ${first.userId}`);
} else if (command === 'login') {
  const start = client.startLogin(password);
  const first = await call<{ status: string; attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    {
      name,
      startLoginRequest: start.request,
    },
  );
  if (first.status !== 'ok') throw new Error(`login start: ${first.status}`);
  const result = client.finishLogin(password, start.state, first.loginResponse);
  if (!result) throw new Error('falsches Passwort');
  const done = await call<{
    userId: string;
    keyPackage: KeyPackage;
    ed25519Public: string;
    x25519Public: string;
  }>('POST', '/api/login/finish', {
    attemptId: first.attemptId,
    finishLoginRequest: result.finishRequest,
  });
  const unlocked = await unlockAccount(done.userId, done.keyPackage, result.exportKey, {
    ed25519: fromBase64Url(done.ed25519Public),
    x25519: fromBase64Url(done.x25519Public),
  });
  const saved = JSON.parse(fs.readFileSync(STATE, 'utf8')) as {
    userId: string;
    ed25519Public: string;
  };
  if (
    saved.userId !== done.userId ||
    saved.ed25519Public !== toBase64Url(unlocked.identity.ed25519Public)
  ) {
    throw new Error('Schlüssel stimmen nicht mit der Registrierung überein');
  }
  console.log('Anmeldung und Schlüssel ok');
}
