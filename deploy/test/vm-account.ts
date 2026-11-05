/**
 * Test account in the VM (SPEC 17.6: accounts can still log in after updates). Runs with the
 * code of the installed release and talks HTTPS to the local Caddy like a browser would.
 *   node vm-account.ts register <name> <password>
 *   node vm-account.ts login <name> <password>
 *   node vm-account.ts letters-setup <name> <password>   second account, coupling, one letter
 *   node vm-account.ts letters-check <name> <password> [--delivered]
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
import type { IdentityKeys } from '../../shared/src/crypto/keypackage.ts';

const BASE = process.env['POSTEULEN_TEST_BASE'] ?? 'https://posteulen.test';
const STATE = process.env['POSTEULEN_TEST_STATE'] ?? '/root/vmtest-account.json';
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

const [command, name, password, flag] = process.argv.slice(2);
if (!command || !name || !password)
  throw new Error('usage: vm-account.ts <command> <name> <password>');
await client.ready();

const SECOND = { name: 'Vm Zweiteule', password: 'noch ein langes Passwort fuer die VM' };
const LETTER_TEXT = 'Brief aus der VM: bleibt nach jedem Update lesbar.';

async function loginAs(
  userName: string,
  userPassword: string,
): Promise<{ userId: string; identity: IdentityKeys }> {
  cookie = '';
  const start = client.startLogin(userPassword);
  const first = await call<{ status: string; attemptId: string; loginResponse: string }>(
    'POST',
    '/api/login/start',
    {
      name: userName,
      startLoginRequest: start.request,
    },
  );
  if (first.status !== 'ok') throw new Error(`login start: ${first.status}`);
  const result = client.finishLogin(userPassword, start.state, first.loginResponse);
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
  return { userId: done.userId, identity: unlocked.identity };
}

async function registerAs(userName: string, userPassword: string): Promise<string> {
  cookie = '';
  const start = client.startRegistration(userPassword);
  const first = await call<{ reservationId: string; userId: string; registrationResponse: string }>(
    'POST',
    '/api/register/start',
    {
      name: userName,
      altcha: await captcha(),
      registrationRequest: start.request,
    },
  );
  const finish = client.finishRegistration(userPassword, start.state, first.registrationResponse);
  const { keyPackage, account } = await createAccountKeys(first.userId, finish.exportKey);
  await call('POST', '/api/register/finish', {
    reservationId: first.reservationId,
    registrationRecord: finish.record,
    ed25519Public: toBase64Url(account.identity.ed25519Public),
    x25519Public: toBase64Url(account.identity.x25519Public),
    keyPackage,
    home: { lat: 48.14, lon: 11.58 },
  });
  return first.userId;
}

interface Item {
  id: string;
  senderId: string;
  recipientId: string;
  kind: 'letter';
  parchment: 'small';
  status: string;
  role: 'sender' | 'recipient';
  ciphertext: string;
  wrap: string;
}

if (command === 'letters-setup') {
  const { sealLetter } = await import('../../shared/src/crypto/letter.ts');
  const secondId = await registerAs(SECOND.name, SECOND.password);
  await call('POST', '/api/contacts/requests', { name, label: 'x'.repeat(60) });
  const first = await loginAs(name, password);
  await call('POST', '/api/contacts/requests', { name: SECOND.name, label: 'x'.repeat(60) });
  const prepared = await call<{
    token: string;
    letters: { letterId: string; sentAt: number }[];
    keys: { x25519: string }[];
  }>('POST', '/api/letters/prepare', { recipients: [secondId], parchment: 'small' });
  const letter = prepared.letters[0];
  const key = prepared.keys[0];
  if (!letter || !key) throw new Error('prepare');
  const sealed = await sealLetter(
    {
      letterId: letter.letterId,
      senderId: first.userId,
      recipientId: secondId,
      sentAt: letter.sentAt,
      kind: 'letter',
      parchment: 'small',
    },
    LETTER_TEXT,
    {
      senderEd25519Secret: first.identity.ed25519Secret,
      senderX25519Public: first.identity.x25519Public,
      recipientX25519Public: fromBase64Url(key.x25519),
    },
  );
  await call('POST', '/api/letters/send', {
    token: prepared.token,
    items: [
      {
        letterId: letter.letterId,
        ciphertext: toBase64Url(sealed.ciphertext),
        wrapRecipient: toBase64Url(sealed.wrapRecipient),
        wrapSender: toBase64Url(sealed.wrapSender),
      },
    ],
  });
  console.log('Brief verschickt');
} else if (command === 'letters-check') {
  const { openLetter } = await import('../../shared/src/crypto/letter.ts');
  const open = async (
    me: { userId: string; identity: IdentityKeys },
    peer: string,
    signer: Uint8Array,
  ): Promise<string | null> => {
    const { letters } = await call<{ letters: Item[] }>('GET', `/api/chats/${peer}/letters`);
    const item = letters[0];
    if (!item) return null;
    const result = await openLetter({
      server: {
        letterId: item.id,
        senderId: item.senderId,
        recipientId: item.recipientId,
        kind: item.kind,
        parchment: item.parchment,
      },
      role: item.role,
      ownUserId: me.userId,
      ownX25519Secret: me.identity.x25519Secret,
      ownX25519Public: me.identity.x25519Public,
      senderEd25519Publics: [signer],
      ciphertext: fromBase64Url(item.ciphertext),
      wrap: fromBase64Url(item.wrap),
    });
    if (!result.ok || result.text !== LETTER_TEXT)
      throw new Error(`Brief nicht lesbar (${result.ok ? 'Text' : result.reason})`);
    return item.status;
  };
  const firstId = (JSON.parse(fs.readFileSync(STATE, 'utf8')) as { userId: string }).userId;
  const second = await loginAs(SECOND.name, SECOND.password);
  const firstKeys = await call<{ ed25519: string }>('GET', `/api/contacts/${firstId}/keys`);
  const received = await open(second, firstId, fromBase64Url(firstKeys.ed25519));
  if (flag === '--delivered' && received !== 'delivered')
    throw new Error('Brief noch nicht zugestellt');
  const first = await loginAs(name, password);
  const status = await open(first, second.userId, first.identity.ed25519Public);
  console.log(`Absender liest den Brief (${status}); Empfänger: ${received ?? 'noch unterwegs'}`);
} else if (command === 'register') {
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
