/**
 * Version 1.5.0 (backend and rules): the looks of chicks (SPEC 9.2.6), a mealworm and petting for
 * chicks (9.3, 9.9), the chick to give away in the profile and a reminder every day (8.5, 9.9),
 * and the milestones of letters between people (11.1).
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GOLD, OWL, TIME } from '@posteulen/shared/constants.ts';
import { utcDay } from '../src/security/ids.ts';
import { checkLetterMilestone, initLetterMilestones } from '../src/messages/milestones.ts';
import {
  withoutBots,
  advanceTo,
  buyOwl,
  couple,
  HAMBURG,
  person,
  setGold,
  testApp,
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
  await couple(anna, ben);
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

function setRandom(value: number | (() => number)): void {
  (app.ctx as { random: () => number }).random = typeof value === 'number' ? () => value : value;
}

interface OwlView {
  id: string;
  name: string | null;
  isChick: boolean;
  energy: number;
  feedable: boolean;
  snackable: boolean;
  chickLook: number;
  clutchId: string | null;
}

interface ClutchView {
  id: string;
  species: string;
  giftAll: boolean;
  deadline: number;
  chicks: number;
  look: number;
  due: boolean;
  recipients: boolean;
}

async function owls(who: Person) {
  return (
    await who.agent.json<{ owls: OwlView[]; clutches: { id: string; giftDeadline: number }[] }>(
      'GET',
      '/api/owls',
    )
  ).body;
}

async function profileClutch(who: Person): Promise<ClutchView | null> {
  const result = await who.agent.json<{ profile: { clutch: ClutchView | null } }>(
    'GET',
    '/api/sync',
  );
  return result.body.profile.clutch;
}

async function systemMessages(who: Person) {
  return (
    await who.agent.json<{
      messages: {
        type: string;
        params: Record<string, string | number>;
        arrivalImage: string | null;
      }[];
    }>('GET', '/api/system-messages')
  ).body.messages;
}

function gold(who: Person): number {
  return app.db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', who.id)?.gold ?? 0;
}

/** A Waldkauz mother of Anna lays eggs and hatches `count` chicks. */
async function brood(count: 1 | 2 | 3): Promise<{ hatchAt: number }> {
  setGold(app, anna, 500);
  const mother = await buyOwl(app, anna, 'waldkauz', 'Mama');
  app.db.run("UPDATE owls SET sex = 'f' WHERE id = ?", mother);
  await anna.agent.json('POST', `/api/owls/${mother}/menagerie`, {});
  setRandom(0);
  advanceTo(app, app.clock.now + 7 * TIME.DAY);
  const hatchAt = app.clock.now + 7 * TIME.DAY;
  setRandom([0, 0.5, 0.9][count - 1]!);
  advanceTo(app, hatchAt);
  return { hatchAt };
}

describe('the looks of chicks (SPEC 9.2.6)', () => {
  it('three chicks of a species take the standard, second and third chick picture', async () => {
    await brood(3);
    const chicks = (await owls(anna)).owls.filter((owl) => owl.isChick);
    expect(chicks.map((chick) => chick.chickLook).sort()).toEqual([0, 1, 2]);
  });

  it('a chick given away gets the rarest chick look of its new owner and shows it on arrival', async () => {
    // Ben already has a Waldkauz chick with the standard look.
    setGold(app, ben, 500);
    const own = await buyOwl(app, ben, 'waldkauz', 'Kauz');
    app.db.run('UPDATE owls SET is_chick = 1, chick_look = 0 WHERE id = ?', own);
    await brood(2);
    const list = await owls(anna);
    const clutch = list.clutches[0]!;
    const chick = list.owls.find((owl) => owl.isChick && owl.chickLook === 0)!;
    await anna.agent.json('POST', `/api/owls/${chick.id}/name`, { name: 'Flaum' });
    const prepared = await anna.agent.json<{ token: string }>(
      'POST',
      `/api/clutches/${clutch.id}/gift/prepare`,
      { chickId: chick.id, recipient: ben.id, withCover: false },
    );
    await anna.agent.json('POST', `/api/clutches/${clutch.id}/gift/send`, {
      token: prepared.body.token,
    });
    const flight = app.db.get<{ ends_at: number }>(
      "SELECT ends_at FROM flights WHERE state = 'active'",
    );
    advanceTo(app, flight!.ends_at);
    const arrived = (await owls(ben)).owls.find((owl) => owl.id === chick.id);
    expect(arrived).toMatchObject({ isChick: true, chickLook: 1 });
    const message = (await systemMessages(ben)).find((m) => m.type === 'chick_gift_received');
    expect(message?.arrivalImage).toBe('waldkauz:chick:1');
  });

  it('the migration hands out the chick looks of existing chicks in turn', async () => {
    await brood(3);
    app.db.run('UPDATE owls SET chick_look = 0');
    const sql = fs.readFileSync(
      path.resolve(import.meta.dirname, '../migrations/0029_v150.sql'),
      'utf8',
    );
    const update = sql.slice(
      sql.indexOf('UPDATE owls'),
      sql.indexOf(';', sql.indexOf('UPDATE owls')),
    );
    app.db.exec(update);
    const looks = app.db
      .all<{ chick_look: number }>('SELECT chick_look FROM owls WHERE is_chick = 1')
      .map((row) => row.chick_look)
      .sort();
    expect(looks).toEqual([0, 1, 2]);
  });
});

describe('a mealworm and petting for chicks (SPEC 9.3, 9.9)', () => {
  it('a chick gets a mealworm once a day for 0.1 gold, is petted as often as wanted, nothing else', async () => {
    await brood(1);
    const chick = (await owls(anna)).owls.find((owl) => owl.isChick)!;
    expect(chick).toMatchObject({ feedable: true, snackable: false });
    // The pouch is not used for mealworms.
    app.db.run('UPDATE users SET bag_biscuits = 5, bag_treats = 5 WHERE id = ?', anna.id);
    for (const kind of ['water', 'snack'])
      expect((await anna.agent.json('POST', `/api/owls/${chick.id}/${kind}`)).body).toMatchObject({
        code: 'owl_chick_care',
      });
    const before = gold(anna);
    const fed = await anna.agent.json<{ owl: OwlView }>('POST', `/api/owls/${chick.id}/feed`);
    expect(fed.status).toBe(200);
    expect(fed.body.owl).toMatchObject({ feedable: false, energy: chick.energy });
    expect(gold(anna)).toBe(before - GOLD.MEALWORM_PRICE);
    expect(app.db.get('SELECT bag_biscuits FROM users WHERE id = ?', anna.id)).toEqual({
      bag_biscuits: 5,
    });
    expect(
      app.db.get<{ type: string }>(
        'SELECT type FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 1',
        anna.id,
      )?.type,
    ).toBe('mealworm');
    expect((await anna.agent.json('POST', `/api/owls/${chick.id}/feed`)).body).toMatchObject({
      code: 'owl_fed_today',
    });
    for (let i = 0; i < 3; i++)
      expect((await anna.agent.json('POST', `/api/owls/${chick.id}/pet`)).status).toBe(200);
    // Mealworm and petting make a cared-for day.
    expect(app.db.get('SELECT day FROM owl_care_days WHERE owl_id = ?', chick.id)).toEqual({
      day: utcDay(app.clock.now),
    });
    // The next day the next mealworm.
    app.clock.now += TIME.DAY;
    expect((await anna.agent.json('POST', `/api/owls/${chick.id}/feed`)).status).toBe(200);
  });

  it('a privileged player feeds mealworms for free', async () => {
    await brood(1);
    const chick = (await owls(anna)).owls.find((owl) => owl.isChick)!;
    app.db.run(
      'INSERT INTO privileged_users (user_id, since_at, until_at) VALUES (?, ?, NULL)',
      anna.id,
      app.clock.now,
    );
    const before = gold(anna);
    expect((await anna.agent.json('POST', `/api/owls/${chick.id}/feed`)).status).toBe(200);
    expect(gold(anna)).toBe(before);
  });
});

describe('the chick to give away (SPEC 8.5, 9.9)', () => {
  it('the profile carries the clutch; the big notice once a day; a reminder every day', async () => {
    const { hatchAt } = await brood(2);
    const clutch = await profileClutch(anna);
    expect(clutch).toMatchObject({
      species: 'waldkauz',
      giftAll: false,
      chicks: 2,
      deadline: hatchAt + OWL.CHICK_GIFT_DEADLINE_HOURS * TIME.HOUR,
      due: true,
      recipients: true,
    });
    expect((await anna.agent.json('POST', `/api/clutches/${clutch!.id}/notice-seen`)).status).toBe(
      200,
    );
    expect(await profileClutch(anna)).toMatchObject({ due: false });
    // Ben cannot mark Anna's clutch.
    app.db.run('UPDATE clutches SET notice_on = NULL');
    await ben.agent.json('POST', `/api/clutches/${clutch!.id}/notice-seen`);
    expect(await profileClutch(anna)).toMatchObject({ due: true });
    await anna.agent.json('POST', `/api/clutches/${clutch!.id}/notice-seen`);
    // The next day it is due again – with a reminder in the system chat.
    advanceTo(app, hatchAt + TIME.DAY);
    expect(await profileClutch(anna)).toMatchObject({ due: true });
    advanceTo(app, hatchAt + 5 * TIME.DAY - 1);
    const reminders = (await systemMessages(anna)).filter((m) => m.type === 'clutch_reminder');
    expect(reminders.map((m) => m.params['days'])).toEqual([4, 3, 2, 1]);
    // After the lot no clutch is left in the profile.
    advanceTo(app, hatchAt + 5 * TIME.DAY);
    expect(await profileClutch(anna)).toBeNull();
  });

  it('without a contact who has room the notice says that all chicks may stay', async () => {
    await anna.agent.json('DELETE', `/api/contacts/${ben.id}`);
    await brood(2);
    expect(await profileClutch(anna)).toMatchObject({ recipients: false });
  });

  it('a single chick needs no notice', async () => {
    await brood(1);
    expect(await profileClutch(anna)).toBeNull();
  });
});

describe('milestones of letters between people (SPEC 11.1)', () => {
  function letters(day: string, count: number): void {
    app.db.run(
      `INSERT INTO stats_daily (day, human_letters) VALUES (?, ?)
       ON CONFLICT (day) DO UPDATE SET human_letters = human_letters + excluded.human_letters`,
      day,
      count,
    );
  }
  const milestones = async (who: Person) =>
    (await systemMessages(who)).filter((m) => m.type === 'letters_milestone');

  it('a fresh installation celebrated nothing; 1,000 letters are celebrated with every account once', async () => {
    expect(app.db.get("SELECT value FROM meta WHERE key = 'letters_milestone'")).toEqual({
      value: '0',
    });
    letters('2026-11-01', 999);
    checkLetterMilestone(app.ctx, app.clock.now);
    advanceTo(app, app.clock.now + 1);
    expect(await milestones(anna)).toEqual([]);
    letters('2026-11-02', 1);
    const pushes = app.pushes.length;
    checkLetterMilestone(app.ctx, app.clock.now);
    advanceTo(app, app.clock.now + 1);
    expect((await milestones(anna)).map((m) => m.params)).toEqual([{ count: 1000 }]);
    expect((await milestones(ben)).map((m) => m.params)).toEqual([{ count: 1000 }]);
    // No push (no pull into the app, SPEC 2.5).
    expect(app.pushes).toHaveLength(pushes);
    checkLetterMilestone(app.ctx, app.clock.now);
    advanceTo(app, app.clock.now + 1);
    expect(await milestones(anna)).toHaveLength(1);
  });

  it('after the update the highest milestone already passed is celebrated once', async () => {
    app.db.run("DELETE FROM meta WHERE key = 'letters_milestone'");
    letters('2026-10-01', 12_345);
    expect(initLetterMilestones(app.ctx)).toBe(2);
    expect((await milestones(anna)).map((m) => m.params)).toEqual([{ count: 10_000 }]);
    expect(initLetterMilestones(app.ctx)).toBe(0);
    letters('2026-10-02', 40_000);
    checkLetterMilestone(app.ctx, app.clock.now);
    advanceTo(app, app.clock.now + 1);
    expect((await milestones(anna)).map((m) => m.params)).toEqual([
      { count: 10_000 },
      { count: 50_000 },
    ]);
  });
});
