/**
 * Version 0.8.2: letters sorted by the time the viewer learned of them, no read receipts for the
 * sender, unreadable letters reported with their technical reason, the visiting owl announced
 * (system message and push) and sent on early, contact names without stray spaces, the link
 * setting and the admin's timed banners.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as client from '@posteulen/shared/crypto/opaque-client.ts';
import { toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sealLetter, type LetterMeta } from '@posteulen/shared/crypto/letter.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import { utcDay } from '../src/security/ids.ts';
import { setInitialAdminPassword } from '../src/admin/admin-auth.ts';
import {
  ADMIN_ORIGIN,
  Agent,
  advanceTo,
  buyOwl,
  couple,
  HAMBURG,
  person,
  setGold,
  testApp,
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
  await couple(anna, ben);
});
afterEach(async () => {
  await app.close();
});

interface Prepared {
  token: string;
  letters: { recipientId: string; letterId: string; sentAt: number }[];
}

async function send(from: Person, to: Person, owlId: string, rest = 0) {
  const prepared = await from.agent.json<Prepared>('POST', '/api/letters/prepare', {
    recipients: [to.id],
    parchment: 'small',
    owlId,
    ...(rest > 0 ? { rest } : {}),
  });
  expect(prepared.status, JSON.stringify(prepared.body)).toBe(200);
  const letter = prepared.body.letters[0]!;
  const meta: LetterMeta = {
    letterId: letter.letterId,
    senderId: from.id,
    recipientId: to.id,
    sentAt: letter.sentAt,
    kind: 'letter',
    parchment: 'small',
  };
  const sealed = await sealLetter(meta, 'Hallo!', {
    senderEd25519Secret: from.identity.ed25519Secret,
    senderX25519Public: from.identity.x25519Public,
    recipientX25519Public: to.identity.x25519Public,
  });
  return from.agent.json<{ letters: { id: string; arrivesAt: number }[] }>(
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
}

async function owl(who: Person, name: string): Promise<string> {
  setGold(app, who, 500);
  const id = await buyOwl(app, who, 'waldkauz', name);
  app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', id);
  return id;
}

async function letters(who: Person, peer: Person) {
  return (
    await who.agent.json<{
      letters: { id: string; role: string; read: boolean; sentAt: number; arrivesAt: number }[];
    }>('GET', `/api/chats/${peer.id}/letters`)
  ).body.letters;
}

describe('the conversation (v0.8.2)', () => {
  it('own letters by sending time, received letters by arrival; the sender never sees "read"', async () => {
    const annaOwl = await owl(anna, 'Waldi');
    const benOwl = await owl(ben, 'Kauz');
    // Anna writes first, but her letter takes hours; meanwhile Ben writes later and his letter
    // arrives … and Anna's arrives at Ben's after Ben wrote his.
    const fromAnna = await send(anna, ben, annaOwl);
    app.clock.now += 30 * TIME.MINUTE;
    const fromBen = await send(ben, anna, benOwl);
    const annaArrives = fromAnna.body.letters[0]!.arrivesAt;
    advanceTo(app, Math.max(annaArrives, fromBen.body.letters[0]!.arrivesAt) + TIME.MINUTE);
    // For Ben: his own letter (sent at +30 min) comes before Anna's (arrived later).
    expect((await letters(ben, anna)).map((l) => l.role)).toEqual(['sender', 'recipient']);
    // Ben reads Anna's letter – Anna learns nothing about it.
    await ben.agent.json('POST', '/api/letters/read', { ids: [fromAnna.body.letters[0]!.id] });
    const annaView = await letters(anna, ben);
    expect(annaView.find((l) => l.role === 'sender')?.read).toBe(false);
  });

  it('an unreadable letter is reported with its technical reason (admin error log)', async () => {
    const annaOwl = await owl(anna, 'Waldi');
    const sent = await send(anna, ben, annaOwl);
    advanceTo(app, sent.body.letters[0]!.arrivesAt + TIME.MINUTE);
    const report = await ben.agent.json('POST', '/api/letters/unreadable', {
      ids: [sent.body.letters[0]!.id],
      reason: 'signature',
    });
    expect(report.status).toBe(200);
    const log = app.db.all<{ what: string; cause: string }>('SELECT what, cause FROM error_log');
    expect(log).toContainEqual(
      expect.objectContaining({
        what: 'Ein Gerät konnte einen empfangenen Brief nicht anzeigen.',
        cause: expect.stringContaining('Ed25519-Signatur'),
      }),
    );
    expect(JSON.stringify(log)).not.toContain(anna.id);
    expect(
      (
        await ben.agent.json('POST', '/api/letters/unreadable', {
          ids: [sent.body.letters[0]!.id],
          reason: 'x',
        })
      ).status,
    ).toBe(400);
  });
});

describe('visiting owls (v0.8.2)', () => {
  it('announce themselves (push; v0.8.5 no system message) and can be sent on early', async () => {
    const annaOwl = await owl(anna, 'Waldi');
    const sent = await send(anna, ben, annaOwl, 24);
    advanceTo(app, sent.body.letters[0]!.arrivesAt + TIME.MINUTE);
    expect(
      app.db.all(
        "SELECT 1 FROM system_messages WHERE user_id = ? AND type = 'owl_resting'",
        ben.id,
      ),
    ).toHaveLength(0);
    expect(
      app.db.all("SELECT 1 FROM notifications WHERE user_id = ? AND type = 'owl_resting'", ben.id),
    ).toHaveLength(1);
    const guests = await ben.agent.json<{ guests: { id: string }[] }>('GET', '/api/owls');
    const guest = guests.body.guests[0]!;
    // Only the host can send it on, and only while it rests there.
    expect((await anna.agent.json('POST', `/api/guests/${guest.id}/send-on`, {})).status).toBe(404);
    expect((await ben.agent.json('POST', `/api/guests/${guest.id}/send-on`, {})).status).toBe(200);
    expect((await ben.agent.json<{ guests: unknown[] }>('GET', '/api/owls')).body.guests).toEqual(
      [],
    );
    const flight = app.db.get<{ route: string }>(
      "SELECT route FROM flights WHERE owl_id = ? AND state = 'active'",
      annaOwl,
    )!;
    expect(
      (JSON.parse(flight.route) as { type: string; status: string }[]).map((s) => s.status),
    ).toEqual(['done', 'pending']);
    expect((await ben.agent.json('POST', `/api/guests/${guest.id}/send-on`, {})).status).toBe(404);
  });
});

describe('small things (v0.8.2)', () => {
  it('a contact name with a trailing space finds the person', async () => {
    const carla = await person(app, 'Carla');
    const request = await carla.agent.json('POST', '/api/contacts/requests', {
      name: 'Anna ',
      label: 'x'.repeat(60),
    });
    expect(request.status).toBe(200);
    await anna.agent.json('POST', '/api/contacts/requests', {
      name: ' Carla',
      label: 'x'.repeat(60),
    });
    const contacts = await anna.agent.json<{ contacts: { name: string }[] }>(
      'GET',
      '/api/contacts',
    );
    expect(contacts.body.contacts.map((c) => c.name)).toContain('Carla');
  });

  it('links in letters can be switched off (account setting)', async () => {
    const changed = await anna.agent.json<{ profile: { linksClickable: boolean } }>(
      'PATCH',
      '/api/account/letters',
      { retentionDays: 365, print: false, links: false },
    );
    expect(changed.body.profile.linksClickable).toBe(false);
    const kept = await anna.agent.json<{ profile: { linksClickable: boolean } }>(
      'PATCH',
      '/api/account/letters',
      { retentionDays: 365, print: true },
    );
    expect(kept.body.profile.linksClickable).toBe(false);
  });
});

describe('timed banners of the admin (v0.8.2)', () => {
  it('run for all accounts (also new ones) from start to end, in their language', async () => {
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
    const now = app.clock.now;
    expect(
      (
        await admin.json('POST', '/api/banners', {
          textDe: 'Wartung',
          textEn: '',
          startsAt: now,
          endsAt: now + 100 * TIME.DAY,
        })
      ).body,
    ).toMatchObject({ code: 'banner_period' });
    expect(
      (
        await admin.json('POST', '/api/banners', {
          textDe: 'Wartung 🦉',
          textEn: '',
          startsAt: now,
          endsAt: now + TIME.DAY,
        })
      ).body,
    ).toMatchObject({ code: 'banner_invalid' });
    const created = await admin.json('POST', '/api/banners', {
      textDe: 'Heute Abend kurze Wartung.',
      textEn: 'Short maintenance tonight.',
      startsAt: now + TIME.HOUR,
      endsAt: now + TIME.DAY,
    });
    expect(created.status).toBe(200);
    const banners = async (who: Person) =>
      (await who.agent.json<{ banners: { text: string }[] }>('GET', '/api/banners')).body.banners;
    expect(await banners(anna)).toEqual([]);
    app.clock.now += 2 * TIME.HOUR;
    const dora = await person(app, 'Dora', HAMBURG, 'en');
    expect((await banners(anna)).map((b) => b.text)).toEqual(['Heute Abend kurze Wartung.']);
    expect((await banners(dora)).map((b) => b.text)).toEqual(['Short maintenance tonight.']);
    advanceTo(app, now + 2 * TIME.DAY);
    expect(await banners(anna)).toEqual([]);
    // The daily clean-up after the end removes it.
    const day = now + 3 * TIME.DAY;
    app.db.run("DELETE FROM scheduled_events WHERE type = 'daily:inactivity'");
    app.db.run("DELETE FROM daily_job_runs WHERE job = 'inactivity' AND day = ?", utcDay(day));
    app.ctx.queue.schedule('daily:inactivity', 'inactivity', day);
    advanceTo(app, day);
    expect(app.db.all('SELECT 1 FROM banners')).toEqual([]);
  });
});
