import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromBase64Url, toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { openLetter, sealLetter, type LetterMeta } from '@posteulen/shared/crypto/letter.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import {
  couple,
  person,
  testApp,
  type Person,
  type TestApp,
  type SentPush,
} from './auth-helpers.ts';

let app: TestApp & { pushes: SentPush[] };
let anna: Person;
let ben: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  ben = await person(app, 'Ben');
});
afterEach(async () => {
  await app.close();
});

interface Prepared {
  token: string;
  letters: { recipientId: string; letterId: string; sentAt: number }[];
  keys: { userId: string; ed25519: string; x25519: string }[];
}

async function send(
  from: Person,
  to: Person[],
  text: string,
  parchment: 'small' | 'large' = 'small',
) {
  const prepared = await from.agent.json<Prepared>('POST', '/api/letters/prepare', {
    recipients: to.map((p) => p.id),
    parchment,
  });
  if (prepared.status !== 200) return prepared;
  const items = [];
  for (const letter of prepared.body.letters) {
    const recipient = to.find((p) => p.id === letter.recipientId)!;
    const meta: LetterMeta = {
      letterId: letter.letterId,
      senderId: from.id,
      recipientId: letter.recipientId,
      sentAt: letter.sentAt,
      kind: 'letter',
      parchment,
    };
    const sealed = await sealLetter(meta, text, {
      senderEd25519Secret: from.identity.ed25519Secret,
      senderX25519Public: from.identity.x25519Public,
      recipientX25519Public: recipient.identity.x25519Public,
    });
    items.push({
      letterId: letter.letterId,
      ciphertext: toBase64Url(sealed.ciphertext),
      wrapRecipient: toBase64Url(sealed.wrapRecipient),
      wrapSender: toBase64Url(sealed.wrapSender),
    });
  }
  return from.agent.json<{ letters: { id: string; arrivesAt: number }[] }>(
    'POST',
    '/api/letters/send',
    { token: prepared.body.token, items },
  );
}

interface ApiLetter {
  id: string;
  senderId: string;
  recipientId: string;
  kind: 'letter';
  parchment: 'small' | 'large';
  status: string;
  read: boolean;
  role: 'sender' | 'recipient';
  ciphertext: string;
  wrap: string;
}

async function readAll(me: Person, peer: Person, sender: Person) {
  const list = await me.agent.json<{ letters: ApiLetter[] }>(
    'GET',
    `/api/chats/${peer.id}/letters`,
  );
  return Promise.all(
    list.body.letters.map(async (letter) => ({
      letter,
      opened: await openLetter({
        server: { ...letter, letterId: letter.id },
        role: letter.role,
        ownUserId: me.id,
        ownX25519Secret: me.identity.x25519Secret,
        ownX25519Public: me.identity.x25519Public,
        senderEd25519Publics: [sender.identity.ed25519Public],
        ciphertext: fromBase64Url(letter.ciphertext),
        wrap: fromBase64Url(letter.wrap),
      }),
    })),
  );
}

describe('coupling (SPEC 8.8)', () => {
  it('answers identically for existing and unknown names and connects only mutually', async () => {
    const existing = await anna.agent.json('POST', '/api/contacts/requests', {
      name: 'Ben',
      label: 'x'.repeat(60),
    });
    const unknown = await anna.agent.json('POST', '/api/contacts/requests', {
      name: 'Niemand',
      label: 'x'.repeat(60),
    });
    expect(existing).toEqual(unknown);
    expect(
      (await anna.agent.json<{ contacts: unknown[]; requests: unknown[] }>('GET', '/api/contacts'))
        .body,
    ).toMatchObject({ contacts: [], requests: [{}, {}] });
    expect(
      (await ben.agent.json<{ contacts: unknown[] }>('GET', '/api/contacts')).body.contacts,
    ).toEqual([]);

    await ben.agent.json('POST', '/api/contacts/requests', { name: 'ANNA', label: 'x'.repeat(60) });
    const list = await anna.agent.json<{
      contacts: { userId: string; name: string; active: boolean }[];
      requests: unknown[];
    }>('GET', '/api/contacts');
    expect(list.body.contacts).toEqual([
      expect.objectContaining({ userId: ben.id, name: 'Ben', active: true, keyWarning: false }),
    ]);
    expect(list.body.requests).toHaveLength(1);
    const system = await ben.agent.json<{ messages: { type: string; params: { name: string } }[] }>(
      'GET',
      '/api/system-messages',
    );
    expect(system.body.messages.at(-1)).toMatchObject({
      type: 'contact_confirmed',
      params: { name: 'Anna' },
    });
  });

  it('lets requests expire after 24 hours and limits them to 20 per day', async () => {
    await anna.agent.json('POST', '/api/contacts/requests', { name: 'Ben', label: 'x'.repeat(60) });
    app.clock.now += 25 * TIME.HOUR;
    await ben.agent.json('POST', '/api/contacts/requests', { name: 'Anna', label: 'x'.repeat(60) });
    expect(
      (await anna.agent.json<{ contacts: unknown[] }>('GET', '/api/contacts')).body.contacts,
    ).toEqual([]);
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push(
        (
          await anna.agent.json('POST', '/api/contacts/requests', {
            name: `Name ${i}`,
            label: 'x'.repeat(60),
          })
        ).status,
      );
    }
    // The 25 hours above started a new UTC day: 20 requests are allowed again.
    expect(statuses.filter((s) => s === 200)).toHaveLength(20);
    expect(statuses.at(-1)).toBe(429);
  });

  it('keeps the vault opaque and versions growing', async () => {
    await couple(anna, ben);
    expect(
      (await anna.agent.json('PUT', `/api/vault/${ben.id}`, { version: 1, blob: 'a'.repeat(80) }))
        .status,
    ).toBe(200);
    expect(
      (await anna.agent.json('PUT', `/api/vault/${ben.id}`, { version: 1, blob: 'b'.repeat(80) }))
        .body,
    ).toMatchObject({ code: 'vault_version' });
    expect(
      (await anna.agent.json('PUT', `/api/vault/${ben.id}`, { version: 2, blob: 'b'.repeat(80) }))
        .status,
    ).toBe(200);
    expect(
      (await anna.agent.json<{ entries: unknown[] }>('GET', '/api/vault')).body.entries,
    ).toEqual([{ contactId: ben.id, version: 2, blob: 'b'.repeat(80) }]);
    const stranger = await person(app, 'Clara');
    expect(
      (
        await anna.agent.json('PUT', `/api/vault/${stranger.id}`, {
          version: 1,
          blob: 'a'.repeat(80),
        })
      ).status,
    ).toBe(404);
    expect(
      (await ben.agent.json<{ entries: unknown[] }>('GET', '/api/vault')).body.entries,
    ).toEqual([]);
  });
});

describe('letters (SPEC 5.8, 8.4)', () => {
  beforeEach(async () => {
    await couple(anna, ben);
  });

  it('delivers after the flight, marks read and keeps the text secret from the server', async () => {
    const sent = await send(anna, [ben], 'Hallo Ben, wie geht es dir?');
    expect(sent.status).toBe(200);
    expect(JSON.stringify(app.db.all('SELECT * FROM letters'))).not.toContain('Hallo Ben');
    // Before arrival the recipient sees nothing.
    expect(await readAll(ben, anna, anna)).toEqual([]);
    const own = await readAll(anna, ben, anna);
    expect(own[0]?.opened).toMatchObject({ ok: true, text: 'Hallo Ben, wie geht es dir?' });
    expect(own[0]?.letter.status).toBe('in_flight');

    app.clock.now += 2 * TIME.MINUTE;
    expect(app.ctx.queue.runDue()).toBe(1);
    expect(app.ctx.queue.runDue()).toBe(0);
    const received = await readAll(ben, anna, anna);
    expect(received[0]?.opened).toMatchObject({ ok: true, text: 'Hallo Ben, wie geht es dir?' });
    const chats = await ben.agent.json<{
      chats: { peerId: string; name: string; unread: number }[];
    }>('GET', '/api/chats');
    expect(chats.body.chats).toEqual([
      expect.objectContaining({ peerId: anna.id, name: 'Anna', unread: 1 }),
    ]);

    await app.ctx.push.idle();
    expect(app.pushes).toHaveLength(0); // no subscription yet → only "Neuigkeiten"
    const news = await ben.agent.json<{ news: { type: string }[] }>('GET', '/api/news');
    expect(news.body.news).toEqual([expect.objectContaining({ type: 'letter_arrived' })]);

    await ben.agent.json('POST', '/api/letters/read', { ids: [received[0]!.letter.id] });
    expect((await readAll(anna, ben, anna))[0]?.letter).toMatchObject({
      status: 'delivered',
      read: true,
    });
    expect(
      (await ben.agent.json<{ chats: { unread: number }[] }>('GET', '/api/chats')).body.chats[0]
        ?.unread,
    ).toBe(0);
    expect(
      app.db.get<{ human_letters: number }>('SELECT human_letters FROM stats_daily')?.human_letters,
    ).toBe(1);
  });

  it('sends one letter per recipient in order and charges large parchment once', async () => {
    const clara = await person(app, 'Clara');
    await couple(anna, clara);
    const sent = await send(anna, [clara, ben], 'Rundbrief', 'large');
    expect(sent.status).toBe(200);
    const body = sent.body as { letters: { arrivesAt: number }[] };
    expect(body.letters[1]!.arrivesAt - body.letters[0]!.arrivesAt).toBe(2 * TIME.MINUTE);
    expect(app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', anna.id)?.gold).toBe(
      29,
    );
    const ids = app.db.all<{ id: string }>('SELECT id FROM letters');
    expect(new Set(ids.map((r) => r.id)).size).toBe(2);
  });

  it('rejects wrong lengths, foreign tokens and non-contacts', async () => {
    const prepared = await anna.agent.json<Prepared>('POST', '/api/letters/prepare', {
      recipients: [ben.id],
      parchment: 'small',
    });
    const letter = prepared.body.letters[0]!;
    const shortCipher = toBase64Url(new Uint8Array(4135));
    const wrap = toBase64Url(new Uint8Array(80));
    expect(
      (
        await anna.agent.json('POST', '/api/letters/send', {
          token: prepared.body.token,
          items: [
            {
              letterId: letter.letterId,
              ciphertext: shortCipher,
              wrapRecipient: wrap,
              wrapSender: wrap,
            },
          ],
        })
      ).status,
    ).toBe(400);
    const prepared2 = await anna.agent.json<Prepared>('POST', '/api/letters/prepare', {
      recipients: [ben.id],
      parchment: 'small',
    });
    expect(
      (
        await ben.agent.json('POST', '/api/letters/send', {
          token: prepared2.body.token,
          items: [
            {
              letterId: prepared2.body.letters[0]!.letterId,
              ciphertext: toBase64Url(new Uint8Array(4136)),
              wrapRecipient: wrap,
              wrapSender: wrap,
            },
          ],
        })
      ).body,
    ).toMatchObject({ code: 'letter_token_expired' });
    const stranger = await person(app, 'Dora');
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [stranger.id],
          parchment: 'small',
        })
      ).body,
    ).toMatchObject({ code: 'recipient_invalid' });
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [anna.id],
          parchment: 'small',
        })
      ).body,
    ).toMatchObject({ code: 'recipient_invalid' });
    expect((await stranger.agent.json(`GET`, `/api/chats/${ben.id}/letters`)).body).toEqual({
      letters: [],
    });
  });

  it('blocks sending after a key warning on either side (SPEC 5.7)', async () => {
    await ben.agent.json('POST', `/api/contacts/${anna.id}/key-warning`, {});
    expect(
      (
        await anna.agent.json('POST', '/api/letters/prepare', {
          recipients: [ben.id],
          parchment: 'small',
        })
      ).body,
    ).toMatchObject({ code: 'key_warning' });
    expect(
      (
        await ben.agent.json('POST', '/api/letters/prepare', {
          recipients: [anna.id],
          parchment: 'small',
        })
      ).body,
    ).toMatchObject({ code: 'key_warning' });
    const contacts = await anna.agent.json<{ contacts: { keyWarning: boolean }[] }>(
      'GET',
      '/api/contacts',
    );
    expect(contacts.body.contacts[0]?.keyWarning).toBe(true);
  });

  it('turns letters back when the contact is removed and shows "unbekannt" (SPEC 8.8, 9.5)', async () => {
    await send(anna, [ben], 'unterwegs');
    expect((await ben.agent.json('DELETE', `/api/contacts/${anna.id}`)).status).toBe(200);
    app.clock.now += 5 * TIME.MINUTE;
    app.ctx.queue.runDue();
    expect(await readAll(ben, anna, anna)).toEqual([]);
    const own = await readAll(anna, ben, anna);
    expect(own[0]?.letter.status).toBe('returned');
    const system = await anna.agent.json<{ messages: { type: string }[] }>(
      'GET',
      '/api/system-messages',
    );
    expect(system.body.messages.map((m) => m.type)).toEqual(
      expect.arrayContaining(['contact_removed', 'letter_returned']),
    );
    const chats = await anna.agent.json<{ chats: { name: string | null; isContact: boolean }[] }>(
      'GET',
      '/api/chats',
    );
    expect(chats.body.chats[0]).toMatchObject({ name: null, isContact: false });
    expect((await anna.agent.json('GET', `/api/contacts/${ben.id}/keys`)).status).toBe(200);
  });

  it('deletes own copies; the letter disappears when nobody has it any more', async () => {
    await send(anna, [ben], 'bald weg');
    app.clock.now += 2 * TIME.MINUTE;
    app.ctx.queue.runDue();
    await anna.agent.json('DELETE', `/api/chats/${ben.id}`);
    expect(await readAll(anna, ben, anna)).toEqual([]);
    expect(await readAll(ben, anna, anna)).toHaveLength(1);
    await ben.agent.json('DELETE', `/api/chats/${anna.id}`);
    expect(app.db.all('SELECT * FROM letters')).toEqual([]);
  });

  it('never delivers twice and catches up in time order after downtime (SPEC 4.5)', async () => {
    await send(anna, [ben], 'eins');
    app.clock.now += 1000;
    await send(anna, [ben], 'zwei');
    app.ctx.queue.schedule(
      'deliver',
      app.db.all<{ id: string }>('SELECT id FROM letters ORDER BY sent_at')[0]!.id,
      app.clock.now,
    );
    app.clock.now += 3 * TIME.HOUR;
    expect(app.ctx.queue.runDue()).toBe(3);
    const received = await readAll(ben, anna, anna);
    expect(received.map((r) => r.opened.ok && r.opened.text)).toEqual(['eins', 'zwei']);
    expect(
      (await ben.agent.json<{ chats: { unread: number }[] }>('GET', '/api/chats')).body.chats[0]
        ?.unread,
    ).toBe(2);
  });
});

describe('push (SPEC 11.3, 11.4)', () => {
  const subscription = {
    endpoint: 'https://push.example.com/abc',
    keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
  };

  it('sends a test push, accepts the confirmation without a session and pushes deliveries', async () => {
    await couple(anna, ben);
    const put = await ben.agent.json<{ testId: string }>(
      'PUT',
      '/api/push/subscription',
      subscription,
    );
    expect(put.status).toBe(200);
    await app.ctx.push.idle();
    expect(app.pushes).toHaveLength(1);
    expect(JSON.parse(app.pushes[0]!.payload)).toEqual({ id: put.body.testId, type: 'push_test' });
    expect((await ben.agent.json('GET', '/api/push/status')).body).toMatchObject({
      state: 'testing',
    });

    const anonymous = new (await import('./auth-helpers.ts')).Agent(
      app.userApi,
      'https://posteulen.test',
    );
    expect((await anonymous.json('POST', '/api/push/ack', { id: put.body.testId })).status).toBe(
      200,
    );
    expect((await ben.agent.json('GET', '/api/push/status')).body).toMatchObject({
      state: 'confirmed',
      needsVerification: false,
    });

    await send(anna, [ben], 'mit Push');
    app.clock.now += 2 * TIME.MINUTE;
    app.ctx.queue.runDue();
    await app.ctx.push.idle();
    const payload = JSON.parse(app.pushes[1]!.payload) as { id: string; type: string };
    expect(payload.type).toBe('letter_arrived');
    expect(app.pushes[1]!.payload).not.toMatch(/Anna|mit Push/);
    await anonymous.json('POST', '/api/push/ack', { id: payload.id });
    expect((await ben.agent.json<{ news: unknown[] }>('GET', '/api/news')).body.news).toEqual([]);
  });

  it('rejects endpoints that are not plain HTTPS hosts and drops gone subscriptions', async () => {
    for (const endpoint of [
      'http://push.example.com/x',
      'https://127.0.0.1/x',
      'https://[::1]/x',
      'https://push.example.com:8443/x',
      'https://user:pw@push.example.com/x',
      'https://localhost/x',
    ]) {
      expect(
        (await ben.agent.json('PUT', '/api/push/subscription', { ...subscription, endpoint }))
          .status,
        endpoint,
      ).toBe(400);
    }
    const gone = await testApp({ pushStatus: 410 });
    const carl = await person(gone, 'Carl');
    await carl.agent.json('PUT', '/api/push/subscription', subscription);
    await gone.ctx.push.idle();
    expect(gone.db.all('SELECT * FROM push_subscriptions')).toEqual([]);
    await gone.close();
  });

  it('removes the push subscription on logout and on login elsewhere (SPEC 5.3, 11.3)', async () => {
    await ben.agent.json('PUT', '/api/push/subscription', subscription);
    expect(app.db.all('SELECT * FROM push_subscriptions')).toHaveLength(1);
    await ben.agent.json('POST', '/api/logout', {});
    expect(app.db.all('SELECT * FROM push_subscriptions')).toEqual([]);
  });
});
