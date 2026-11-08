/** Version 0.7.1: messages to the admin (SPEC 8.10, 13). */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIME } from '@posteulen/shared/constants.ts';
import { listFeedback, pruneFeedback } from '../src/admin/feedback.ts';
import { person, testApp, withoutBots, type Person, type TestApp } from './auth-helpers.ts';

let app: TestApp;
let anna: Person;

beforeEach(async () => {
  app = await testApp();
  anna = await person(app, 'Anna');
  withoutBots(app);
});
afterEach(async () => {
  await app.close();
});

const send = (text: string) =>
  anna.agent.json<{ profile: { feedbackSentToday: boolean } }>('POST', '/api/feedback', { text });

describe('messages to the admin (v0.7.1)', () => {
  it('stores one message per UTC day, without the sender', async () => {
    const first = await send('Die Karte lädt bei mir langsam.');
    expect(first.status).toBe(200);
    expect(first.body.profile.feedbackSentToday).toBe(true);
    expect((await send('Noch etwas')).body).toEqual({ code: 'feedback_daily' });
    const stored = listFeedback(app.ctx, app.clock.now);
    expect(stored).toEqual([expect.objectContaining({ text: 'Die Karte lädt bei mir langsam.' })]);
    expect(JSON.stringify(app.db.all('SELECT * FROM feedback'))).not.toContain(anna.id);
    // The next UTC day (the test clock starts at 12:00 UTC): possible again.
    app.clock.now += 12 * TIME.HOUR;
    expect((await send('Und noch eine Idee.')).status).toBe(200);
  });

  it('checks length and the text rules like letters', async () => {
    expect((await send('x'.repeat(301))).body).toEqual({ code: 'feedback_too_long' });
    expect((await send('   ')).body).toEqual({ code: 'feedback_empty' });
    expect((await send('Hallo 🦉')).body).toEqual({ code: 'feedback_invalid' });
    expect((await send('x'.repeat(300))).status).toBe(200);
  });

  it('deletes messages after 90 days', async () => {
    await send('Alt');
    pruneFeedback(app.ctx, app.clock.now + 90 * TIME.DAY - 1);
    expect(listFeedback(app.ctx, app.clock.now)).toHaveLength(1);
    pruneFeedback(app.ctx, app.clock.now + 90 * TIME.DAY + 1);
    expect(app.db.all('SELECT * FROM feedback')).toEqual([]);
  });
});
