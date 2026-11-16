/**
 * Version 1.0.0: the security review (SPEC Anhang F). Every gap that was closed has a test here
 * that fails without the fix:
 * - no hidden read receipt (whether the recipient has seen the arrival of a letter),
 * - made-up reports of unreadable letters leave no trace in the admin's error log,
 * - a login that started before a password change cannot finish after it (accounts and panels),
 * - over Tor nobody can lock everybody else out: no shared waiting time (captcha instead) and the
 *   budget for expensive actions per account,
 * - the server scripts: no older version as an update, nothing done as root below the data
 *   directory of the service.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter } from '@posteulen/shared/crypto/letter.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import { listenTor } from '../src/http/server.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import { accountClientKey, TOR_CLIENT_KEY } from '../src/security/ip.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  advanceTo,
  buyOwl,
  couple,
  HAMBURG,
  login,
  ONION,
  person,
  register,
  setGold,
  testApp,
  TorAgent,
  USER_ORIGIN,
  withoutBots,
  type Person,
  type SentPush,
  type TestApp,
} from './auth-helpers.ts';

const PASSWORD = 'ein sehr langes Passwort';
const ROOT = path.resolve(import.meta.dirname, '../..');

let app: TestApp & { pushes: SentPush[] };

afterEach(async () => {
  await app.close();
});

async function send(from: Person, to: Person, owlId: string) {
  const prepared = await from.agent.json<{
    token: string;
    letters: { recipientId: string; letterId: string; sentAt: number }[];
  }>('POST', '/api/letters/prepare', { recipients: [to.id], parchment: 'small', owlId });
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  const letter = prepared.body.letters[0]!;
  const sealed = await sealLetter(
    {
      letterId: letter.letterId,
      senderId: from.id,
      recipientId: to.id,
      sentAt: letter.sentAt,
      kind: 'letter',
      parchment: 'small',
    },
    'Hallo!',
    {
      senderEd25519Secret: from.identity.ed25519Secret,
      senderX25519Public: from.identity.x25519Public,
      recipientX25519Public: to.identity.x25519Public,
    },
  );
  const sent = await from.agent.json<{ letters: { id: string; arrivesAt: number }[] }>(
    'POST',
    '/api/letters/send',
    {
      token: prepared.body.token,
      items: [
        {
          letterId: letter.letterId,
          ciphertext: toBase64Url(sealed.ciphertext),
          wrapRecipient: toBase64Url(sealed.wrapRecipient),
          wrapSender: toBase64Url(sealed.wrapSender),
        },
      ],
    },
  );
  expect(sent.status).toBe(200);
  return sent.body.letters[0]!;
}

async function arrivalSeen(who: Person, peer: Person): Promise<boolean[]> {
  const { body } = await who.agent.json<{ letters: { arrivalSeen: boolean }[] }>(
    'GET',
    `/api/chats/${peer.id}/letters`,
  );
  return body.letters.map((letter) => letter.arrivalSeen);
}

describe('letters between people (v1.0)', () => {
  let anna: Person;
  let ben: Person;
  let letter: { id: string; arrivesAt: number };

  beforeEach(async () => {
    app = await testApp();
    anna = await person(app, 'Anna');
    ben = await person(app, 'Ben', HAMBURG);
    withoutBots(app);
    await couple(anna, ben);
    setGold(app, anna, 500);
    const owl = await buyOwl(app, anna, 'waldkauz', 'Waldi');
    app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', owl);
    letter = await send(anna, ben, owl);
    advanceTo(app, letter.arrivesAt + TIME.MINUTE);
  });

  it('the sender never learns whether the recipient has seen the arrival (no read receipt)', async () => {
    expect(await arrivalSeen(ben, anna)).toEqual([false]);
    const before = await arrivalSeen(anna, ben);
    await ben.agent.json('POST', '/api/letters/arrival-seen', { ids: [letter.id] });
    expect(await arrivalSeen(ben, anna)).toEqual([true]);
    // For the sender nothing changes when the recipient opens the conversation.
    expect(await arrivalSeen(anna, ben)).toEqual(before);
  });

  it('a made-up report of an unreadable letter leaves no trace in the error log', async () => {
    const count = () => app.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM error_log')?.n ?? 0;
    const before = count();
    // Not a letter at all, an own letter, and a letter already read: nothing is logged.
    for (const ids of [['AAAAAAAAAAAAAAAAAAAAAA'], [letter.id]]) {
      const report = await anna.agent.json('POST', '/api/letters/unreadable', {
        ids,
        reason: 'signature',
      });
      expect(report.status).toBe(200);
    }
    expect(count()).toBe(before);
    // The real recipient reports the unread letter once – that is logged, a repetition is not.
    await ben.agent.json('POST', '/api/letters/unreadable', { ids: [letter.id], reason: 'key' });
    expect(count()).toBe(before + 1);
    app.clock.now += 2 * TIME.HOUR;
    await ben.agent.json('POST', '/api/letters/unreadable', { ids: [letter.id], reason: 'key' });
    expect(count()).toBe(before + 1);
  });
});

describe('a login started before a password change (v1.0)', () => {
  beforeEach(async () => {
    app = await testApp();
  });

  it('cannot finish after it – accounts', async () => {
    const agent = new Agent(app.userApi, USER_ORIGIN);
    await register(agent, 'Paul', PASSWORD);
    await register(new Agent(app.userApi, USER_ORIGIN), 'Paula', 'ein anderes langes Passwort');
    const start = client.startLogin(PASSWORD);
    const first = await agent.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/login/start',
      { name: 'Paul', startLoginRequest: start.request },
    );
    const finish = client.finishLogin(PASSWORD, start.state, first.body.loginResponse)!;
    // Meanwhile the password record changes (as a password change does).
    app.db.run(
      "UPDATE users SET opaque_record = (SELECT opaque_record FROM users WHERE name_display = 'Paula') WHERE name_display = 'Paul'",
    );
    const second = await agent.json('POST', '/api/login/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: finish.finishRequest,
    });
    expect(second.status).toBe(401);
    // Only the session of the registration exists – the login opened none.
    expect(app.db.all('SELECT 1 FROM sessions')).toHaveLength(2);
  });

  it('cannot finish after it – admin panel', async () => {
    const initial = await setInitialAdminPassword(app.db, app.secrets.opaqueServerSetup);
    const admin = new Agent(app.adminApi, ADMIN_ORIGIN);
    const start = client.startLogin(initial);
    const first = await admin.json<{ attemptId: string; loginResponse: string }>(
      'POST',
      '/api/login/start',
      { startLoginRequest: start.request },
    );
    expect(first.status).toBe(200);
    const finish = client.finishLogin(initial, start.state, first.body.loginResponse)!;
    app.db.run("UPDATE admin SET opaque_record = opaque_record || 'A' WHERE id = 1");
    const second = await admin.json('POST', '/api/login/finish', {
      attemptId: first.body.attemptId,
      finishLoginRequest: finish.finishRequest,
    });
    expect(second.status).toBe(401);
    expect(app.db.get('SELECT 1 FROM admin_sessions')).toBeUndefined();
  });
});

describe('Tor: nobody locks everybody out (v1.0, SPEC 5.10)', () => {
  let torPort: number;

  beforeEach(async () => {
    app = await testApp({ env: { POSTEULEN_ONION: ONION } });
    torPort = await listenTor(app.userApi, '127.0.0.1', 0);
    await client.ready();
  });

  it('every login over Tor needs the captcha', async () => {
    await register(new Agent(app.userApi, USER_ORIGIN), 'Anna', PASSWORD);
    const tor = new TorAgent(app, torPort);
    const without = await login(tor, 'Anna', PASSWORD);
    expect(without.body['status']).toBe('captcha_required');
    expect((await login(tor, 'Anna', PASSWORD, true)).status).toBe(200);
    // In the clearnet the first attempts need none.
    const web = new Agent(app.userApi, USER_ORIGIN);
    expect((await login(web, 'Anna', PASSWORD)).status).toBe(200);
  });

  it('many failed logins over Tor neither make other Tor visitors wait nor use up their budget', async () => {
    await register(new Agent(app.userApi, USER_ORIGIN), 'Anna', PASSWORD);
    const attacker = new TorAgent(app, torPort);
    // Far more than the waiting time per address (from 20 failures) and than the budget for
    // expensive requests (30 a minute) would allow in the clearnet.
    for (let i = 0; i < 40; i++) {
      const attempt = await login(attacker, `Niemand ${i}`, 'falsches langes Passwort', true);
      expect(attempt.step, `attempt ${i}`).toBe('client');
    }
    const anna = new TorAgent(app, torPort);
    expect((await login(anna, 'Anna', PASSWORD, true)).status).toBe(200);

    // The same from one address in the clearnet: the budget for expensive requests is used up.
    const web = new Agent(app.userApi, USER_ORIGIN, '203.0.113.77');
    let limited = false;
    for (let i = 0; i < 40 && !limited; i++) {
      const start = client.startLogin('falsches langes Passwort');
      const response = await web.json('POST', '/api/login/start', {
        name: `Keiner ${i}`,
        startLoginRequest: start.request,
      });
      limited = response.status === 429 || response.body['status'] !== 'ok';
    }
    expect(limited).toBe(true);
  });

  it('the waiting time per name protects against guessing over Tor as before', async () => {
    await register(new Agent(app.userApi, USER_ORIGIN), 'Anna', PASSWORD);
    const tor = new TorAgent(app, torPort);
    let waiting = false;
    for (let i = 0; i < 8 && !waiting; i++) {
      const attempt = await login(tor, 'Anna', 'falsches langes Passwort', true);
      waiting = attempt.body['status'] === 'wait';
    }
    expect(waiting).toBe(true);
    expect((await login(tor, 'Anna', PASSWORD, true)).body['status']).toBe('wait');
  });

  it('expensive actions of signed-in accounts count per account over Tor, per address in the clearnet', async () => {
    expect(accountClientKey({ ip: '203.0.113.9', viaTor: true }, 'abc')).toBe(
      `${TOR_CLIENT_KEY}:abc`,
    );
    expect(accountClientKey({ ip: '203.0.113.9', viaTor: false }, 'abc')).toBe('203.0.113.9');
    await register(new Agent(app.userApi, USER_ORIGIN), 'Anna', PASSWORD);
    await register(new Agent(app.userApi, USER_ORIGIN), 'Ben', PASSWORD);
    const anna = new TorAgent(app, torPort);
    const ben = new TorAgent(app, torPort);
    expect((await login(anna, 'Anna', PASSWORD, true)).status).toBe(200);
    expect((await login(ben, 'Ben', PASSWORD, true)).status).toBe(200);
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++) {
      statuses.push((await anna.request('POST', '/api/letters/prepare', {})).statusCode);
    }
    expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true);
    expect(statuses[31]).toBe(429);
    // Ben is not affected by Anna's requests.
    expect((await ben.request('POST', '/api/letters/prepare', {})).statusCode).toBe(400);
  });
});

describe('server scripts (v1.0, SPEC 16.3)', () => {
  beforeEach(async () => {
    app = await testApp();
  });

  const older = (a: string, b: string): boolean => {
    try {
      execFileSync('bash', [
        '-c',
        'source "$0/deploy/lib.sh"; version_older "$1" "$2"',
        ROOT,
        a,
        b,
      ]);
      return true;
    } catch {
      return false;
    }
  };

  it('version_older follows semantic versioning', () => {
    expect(older('0.10.1', '1.0.0')).toBe(true);
    expect(older('0.9.0', '0.10.0')).toBe(true);
    expect(older('1.0.0-stufe.6', '1.0.0')).toBe(true);
    expect(older('1.0.0-vmtest.2', '1.0.0-vmtest.10')).toBe(true);
    expect(older('1.0.0', '1.0.0')).toBe(false);
    expect(older('1.0.0', '0.10.1')).toBe(false);
    expect(older('1.0.0', '1.0.0-stufe.6')).toBe(false);
    expect(older('1.0.1', '1.0.0-stufe.3')).toBe(false);
  });

  it('posteulen-update refuses older versions unless asked to', () => {
    const script = fs.readFileSync(path.join(ROOT, 'deploy/posteulen-update'), 'utf8');
    expect(script).toContain('--allow-downgrade');
    expect(script).toMatch(/version_older "\$target_version" "\$current_version"/);
    // The signature is checked first, the release is unpacked only after both checks.
    expect(script.indexOf('verify_release_tag')).toBeLessThan(script.indexOf('version_older'));
    expect(script.indexOf('version_older')).toBeLessThan(
      script.indexOf('git -C "$PE_REPO" archive'),
    );
  });

  it('root touches nothing below the data directory of the service', () => {
    const backup = fs.readFileSync(path.join(ROOT, 'deploy/backup.sh'), 'utf8');
    const update = fs.readFileSync(path.join(ROOT, 'deploy/update.sh'), 'utf8');
    for (const line of [...backup.split('\n'), ...update.split('\n')]) {
      if (line.trimStart().startsWith('#')) continue;
      // Creating, moving, owning or deleting inside $PE_DATA / $PE_SNAPSHOTS: only as the service.
      if (
        /\b(chown|install|mv|rm|find)\b.*\$(PE_DATA|PE_SNAPSHOTS|plain|snapshot|tmp)\b/.test(line)
      ) {
        if (/install -m 0600 -o root -g root "\$tmp\/bots\.zip"/.test(line)) continue; // reads only
        expect(line, line).toContain('runuser -u "$PE_USER"');
      }
    }
    const code = backup
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('#'))
      .join('\n');
    expect(code).not.toMatch(/\bchown\b/);
  });
});
