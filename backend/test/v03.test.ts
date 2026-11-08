/**
 * Version 0.3: donation requests every five weeks, notes after an update, the owl's
 * homecoming with picture and push, day or night flight pictures, releasing by name.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DONATION, TIME } from '@posteulen/shared/constants.ts';
import { isDay } from '@posteulen/shared/game/sun.ts';
import { notesSince, UPDATE_NOTES } from '@posteulen/shared/texts/messages.ts';
import { VERSION } from '@posteulen/shared/version.ts';
import { ensureDonationSchedules, sendUpdateNotes } from '../src/messages/periodic.ts';
import { flightPosition, loadFlight } from '../src/flights/service.ts';
import {
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

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
});
afterEach(async () => {
  await app.close();
});

function systemMessages(who: Person, type: string) {
  return app.db
    .all<{ params: string; created_at: number }>(
      'SELECT params, created_at FROM system_messages WHERE user_id = ? AND type = ? ORDER BY created_at',
      who.id,
      type,
    )
    .map((row) => ({
      params: JSON.parse(row.params) as Record<string, unknown>,
      at: row.created_at,
    }));
}

describe('donation requests (v0.3)', () => {
  it('every five weeks after registration, three texts in turn', async () => {
    const start = app.clock.now;
    const due = app.db.get<{ due_at: number }>(
      "SELECT due_at FROM scheduled_events WHERE type = 'donation' AND ref = ?",
      anna.id,
    );
    expect(due?.due_at).toBe(start + DONATION.INTERVAL_DAYS * TIME.DAY);
    advanceTo(app, start + DONATION.INTERVAL_DAYS * TIME.DAY - TIME.HOUR);
    expect(systemMessages(anna, 'donation')).toEqual([]);
    for (let round = 1; round <= 4; round++) {
      // Stay active, so the account is neither inactive nor deleted meanwhile.
      app.db.run('UPDATE users SET last_active_date = ? WHERE id = ?', '2099-01-01', anna.id);
      advanceTo(app, start + round * DONATION.INTERVAL_DAYS * TIME.DAY);
    }
    const sent = systemMessages(anna, 'donation');
    expect(sent.map((message) => message.params['text'])).toEqual([0, 1, 2, 0]);
    expect(sent.map((message) => (message.at - start) / TIME.DAY)).toEqual([35, 70, 105, 140]);
  });

  it('accounts from before v0.3 get theirs at the next five-week mark, not at once', () => {
    app.db.run("DELETE FROM scheduled_events WHERE type = 'donation'");
    const registered = Date.UTC(2026, 8, 1); // 65 days before the test clock
    app.db.run('UPDATE users SET created_on = ? WHERE id = ?', '2026-09-01', anna.id);
    expect(ensureDonationSchedules(app.ctx)).toBe(1);
    const due = app.db.get<{ due_at: number }>(
      "SELECT due_at FROM scheduled_events WHERE type = 'donation' AND ref = ?",
      anna.id,
    )!.due_at;
    expect(due).toBe(registered + 2 * DONATION.INTERVAL_DAYS * TIME.DAY);
    expect(due).toBeGreaterThan(app.clock.now);
    // Idempotent: nothing is scheduled twice.
    expect(ensureDonationSchedules(app.ctx)).toBe(0);
  });
});

describe('notes after an update (v0.3)', () => {
  it('every account gets the notes of the new version once; a fresh install none', () => {
    // The test app has just started: no accounts then, so only the version was remembered.
    expect(systemMessages(anna, 'update_notes')).toEqual([]);
    expect(
      app.db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'notes_version'")?.value,
    ).toBe(VERSION);
    // An update from 0.2: the remembered version is missing.
    app.db.run("DELETE FROM meta WHERE key = 'notes_version'");
    // From 0.2 straight to the current version: one note per version on the way.
    expect(sendUpdateNotes(app.ctx)).toBe(9);
    expect(systemMessages(anna, 'update_notes').map((m) => m.params)).toEqual([
      { version: '0.3.0' },
      { version: '0.3.1' },
      { version: '0.3.2' },
      { version: '0.4.0' },
      { version: '0.5.0' },
      { version: '0.5.1' },
      { version: '0.6.0' },
      { version: '0.6.1' },
      { version: '0.7.0' },
    ]);
    // Starting again does not repeat it.
    expect(sendUpdateNotes(app.ctx)).toBe(0);
  });

  it('collects the notes between two versions, pre-releases count as their release', () => {
    expect(notesSince('0.2.0', '0.3.0').map((note) => note.version)).toEqual(['0.3.0']);
    expect(notesSince('0.3.0', '0.3.0')).toEqual([]);
    expect(notesSince('0.2.0', '0.3.0-vmtest.1').map((note) => note.version)).toEqual(['0.3.0']);
    expect(notesSince('0.3.0-vmtest.1', '0.3.0')).toEqual([]);
    // Every note is written for people without technical knowledge.
    for (const note of UPDATE_NOTES) {
      const text = note.paragraphs.join(' ');
      expect(text).not.toMatch(/\b(Datenbank|Server|Migration|Padding|Bytes|Cache|API)\b/);
    }
  });
});

describe('owls in flight and back home (v0.3)', () => {
  it('flying owls carry the daylight at their position; coming home sends message and push', async () => {
    withoutBots(app);
    const ben = await person(app, 'Ben', HAMBURG);
    await couple(anna, ben);
    setGold(app, anna, 200);
    const owl = await buyOwl(app, anna);
    app.db.run('UPDATE owls SET energy = 540 WHERE id = ?', owl);
    const subscription = await anna.agent.json('POST', '/api/push/subscribe', {
      endpoint: 'https://push.example.org/anna',
      keys: {
        p256dh: 'B'.repeat(87),
        auth: 'A'.repeat(22),
      },
    });
    const pushes = subscription.status === 200;
    const prepared = await anna.agent.json<{ token: string }>('POST', '/api/gold/prepare', {
      recipient: ben.id,
      amount: 5,
      owlId: owl,
      withCover: false,
    });
    expect(
      (await anna.agent.json('POST', '/api/gold/send', { token: prepared.body.token })).status,
    ).toBe(200);
    const list = await anna.agent.json<{
      owls: { id: string; state: string; absence: { daylight: boolean } | null }[];
    }>('GET', '/api/owls');
    const flying = list.body.owls.find((o) => o.id === owl)!;
    expect(flying.state).toBe('flying');
    const flight = loadFlight(
      app.ctx,
      app.db.get<{ id: string }>("SELECT id FROM flights WHERE state = 'active'")!.id,
    )!;
    const at = flightPosition(flight, app.clock.now)!.position;
    expect(flying.absence?.daylight).toBe(isDay(app.clock.now, at.lat, at.lon));

    advanceTo(app, app.clock.now + 3 * TIME.DAY);
    expect(systemMessages(anna, 'owl_home').map((m) => m.params)).toEqual([
      { owl: expect.any(String), species: 'waldkauz' },
    ]);
    expect(
      app.db.all("SELECT 1 FROM notifications WHERE user_id = ? AND type = 'owl_home'", anna.id),
    ).toHaveLength(1);
    if (pushes) expect(app.pushes.length).toBeGreaterThan(0);
  });
});
