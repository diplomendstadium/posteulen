/** Version 0.7.2: burning a chat with letters on their way, fair sex roll. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomSex } from '@posteulen/shared/game/owls.ts';
import { secureRandom } from '../src/context.ts';
import { TIME } from '@posteulen/shared/constants.ts';
import { advanceTo, PARIS, person, testApp, type Person, type TestApp } from './auth-helpers.ts';

let app: TestApp;
let anna: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
});
afterEach(async () => {
  await app.close();
});

describe('burning a chat while a letter is on its way (v0.7.2)', () => {
  it('the letter still arrives visibly; the unread counter matches what is shown', async () => {
    // v0.8: the Erklärbär's letter of day 1 is on its way (aunt and uncle are gone).
    const paula = await person(app, 'Paula', PARIS);
    anna = paula;
    const aunt = app.db.get<{ id: string }>(
      "SELECT id FROM bots WHERE owner_id = ? AND type = 'explainer'",
      anna.id,
    )!;
    advanceTo(app, app.clock.now + TIME.DAY);
    const flying = app.db.get<{ id: string; arrives_at: number }>(
      "SELECT id, arrives_at FROM letters WHERE sender_id = ? AND status = 'in_flight'",
      aunt.id,
    )!;
    expect(flying).toBeDefined();
    expect((await anna.agent.json('DELETE', `/api/chats/${aunt.id}`)).status).toBe(200);
    advanceTo(app, flying.arrives_at);
    const chats = await anna.agent.json<{ chats: { peerId: string; unread: number }[] }>(
      'GET',
      '/api/chats',
    );
    const letters = await anna.agent.json<{ letters: { id: string }[] }>(
      'GET',
      `/api/chats/${aunt.id}/letters`,
    );
    expect(letters.body.letters.map((letter) => letter.id)).toEqual([flying.id]);
    // The Erklärbär keeps no copies: the burnt day-0 letter is gone for good.
    expect(chats.body.chats.find((chat) => chat.peerId === aunt.id)?.unread).toBe(1);
  });
});

describe('sex of new owls (v0.7.2)', () => {
  it('is female or male with equal chance', () => {
    let female = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) if (randomSex(secureRandom()) === 'f') female++;
    // 4.5 standard deviations: practically never fails by chance.
    expect(Math.abs(female / n - 0.5)).toBeLessThan(0.016);
  });
});
