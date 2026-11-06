/**
 * Bot replies (SPEC 10.5): 2 hours after a letter reached a bot, the reply is written by the AI
 * and sent with a bot owl. Context = system prompt + summary + the last 6 letters + the new
 * letter; older letters are folded into the summary (one extra call at most). The network call
 * runs outside of any database transaction; due replies are stored in `bot_jobs`, so nothing
 * is lost on a restart. Daily limit reached: next day. Error: again in 24 hours.
 */
import { BOTS, TIME } from '@posteulen/shared/constants.ts';
import { countCodePoints } from '@posteulen/shared/names.ts';
import { sanitizeLetterText } from '@posteulen/shared/text-rules.ts';
import type { Context } from '../context.ts';
import { logError } from '../ops/error-log.ts';
import { utcDay } from '../security/ids.ts';
import { aiModel, loadApiKey, reserveCall, type AiClient, type AiMessage } from './ai.ts';
import { SUMMARY_PROMPT, SYSTEM_PROMPTS } from './prompts.ts';
import { botById, dispatchBotLetter, type BotRow } from './service.ts';

/**
 * Token budgets. 500 characters of German text need about 200 tokens, but reasoning models
 * (such as the default model) count their hidden reasoning against the same budget – too
 * small a budget gives an empty answer. The length is held by the prompt and `finishReply`.
 */
const REPLY_TOKENS = 4000;
const SUMMARY_TOKENS = 4000;

/** Cleans the AI text with the letter rules and cuts it to 500 characters at a sentence end. */
export function finishReply(raw: string): string {
  const text = sanitizeLetterText(raw)
    .text.replace(/\n{3,}/g, '\n\n')
    .trim();
  const max = BOTS.REPLY_MAX_CHARS;
  if (countCodePoints(text) <= max) return text;
  const head = Array.from(text).slice(0, max).join('');
  const end = Math.max(
    head.lastIndexOf('. '),
    head.lastIndexOf('! '),
    head.lastIndexOf('? '),
    head.lastIndexOf('.\n'),
  );
  if (end >= max / 2) return head.slice(0, end + 1).trim();
  const space = Array.from(text)
    .slice(0, max - 1)
    .join('')
    .lastIndexOf(' ');
  return `${Array.from(text)
    .slice(0, space > 0 ? space : max - 1)
    .join('')
    .trim()}…`;
}

interface Letter {
  readonly id: string;
  readonly sender_id: string;
  readonly sent_at: number;
  readonly plaintext: string | null;
}

type Outcome = 'done' | 'gone' | 'limit' | { error: string };

export class BotReplies {
  private running = false;
  private again = false;
  private waiters: (() => void)[] = [];
  private readonly ctx: Context;
  private readonly client: AiClient;

  constructor(ctx: Context, client: AiClient) {
    this.ctx = ctx;
    this.client = client;
  }

  /** Processes all due replies (called after the queue marked one as due, and at start-up). */
  kick(): void {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    void this.loop().finally(() => {
      this.running = false;
      if (this.again) {
        this.again = false;
        this.kick();
        return;
      }
      const waiters = this.waiters;
      this.waiters = [];
      for (const resolve of waiters) resolve();
    });
  }

  /** For tests: resolves when no reply is being processed. */
  idle(): Promise<void> {
    if (!this.running) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private async loop(): Promise<void> {
    for (;;) {
      const now = this.ctx.now();
      const job = this.ctx.db.get<{ letter_id: string; bot_id: string; attempts: number }>(
        'SELECT letter_id, bot_id, attempts FROM bot_jobs WHERE due_at <= ? ORDER BY due_at LIMIT 1',
        now,
      );
      if (!job) return;
      let outcome: Outcome;
      try {
        outcome = await this.reply(job.letter_id, job.bot_id);
      } catch {
        outcome = { error: 'Unerwarteter Fehler beim Erzeugen der Antwort.' };
      }
      const at = this.ctx.now();
      if (outcome === 'gone') {
        this.ctx.db.run('DELETE FROM bot_jobs WHERE letter_id = ?', job.letter_id);
      } else if (outcome === 'limit') {
        // Daily limit reached: the reply moves to the next day (SPEC 10.5).
        const next = Date.parse(`${utcDay(at + TIME.DAY)}T00:01:00Z`);
        this.postpone(job.letter_id, next, job.attempts);
      } else if (outcome !== 'done') {
        this.postpone(job.letter_id, at + BOTS.AI_RETRY_HOURS * TIME.HOUR, job.attempts + 1);
        logError(
          this.ctx.db,
          {
            component: 'Bots (KI)',
            severity: 'warning',
            what: 'Eine Bot-Antwort konnte nicht erzeugt werden.',
            cause: outcome.error,
            action:
              'Im Adminpanel OpenAI-Key, Modell und „Verbindung testen“ prüfen. Die Antwort wird in 24 Stunden erneut versucht.',
          },
          at,
        );
      }
    }
  }

  private postpone(letterId: string, dueAt: number, attempts: number): void {
    this.ctx.db.transaction(() => {
      this.ctx.db.run(
        'UPDATE bot_jobs SET due_at = ?, attempts = ? WHERE letter_id = ?',
        dueAt,
        attempts,
        letterId,
      );
      // Wakes the worker at the new time (the handler only kicks this runner).
      this.ctx.queue.schedule('bot_reply', letterId, dueAt);
    });
  }

  private async reply(letterId: string, botId: string): Promise<Outcome> {
    const ctx = this.ctx;
    const bot = botById(ctx, botId);
    const letter = ctx.db.get<Letter & { status: string }>(
      'SELECT id, sender_id, sent_at, plaintext, status FROM letters WHERE id = ? AND recipient_id = ?',
      letterId,
      botId,
    );
    if (!bot || !letter || letter.status !== 'delivered' || !letter.plaintext) return 'gone';
    const key = await loadApiKey(ctx);
    if (!key) return { error: 'Es ist kein (gültiger) OpenAI-Key hinterlegt.' };
    const model = aiModel(ctx.db);

    const chat = ctx.db.get<{ bot_summary: string | null; bot_summarized_until: number | null }>(
      'SELECT bot_summary, bot_summarized_until FROM chats WHERE owner_id = ? AND peer_id = ?',
      bot.owner_id,
      bot.id,
    );
    let summary = chat?.bot_summary ?? null;
    let history = this.history(bot, letter, chat?.bot_summarized_until ?? null);
    if (history.length > BOTS.CONTEXT_LETTERS) {
      // Older letters go into the summary: one extra call (SPEC 10.5).
      const older = history.slice(0, history.length - BOTS.CONTEXT_LETTERS);
      if (!reserveCall(ctx.db, ctx.now())) return 'limit';
      summary = await this.client.complete(
        key,
        model,
        this.summaryMessages(bot, summary, older),
        SUMMARY_TOKENS,
      );
      ctx.db.run(
        'UPDATE chats SET bot_summary = ?, bot_summarized_until = ? WHERE owner_id = ? AND peer_id = ?',
        summary.slice(0, 4000),
        older.at(-1)?.sent_at ?? null,
        bot.owner_id,
        bot.id,
      );
      history = history.slice(-BOTS.CONTEXT_LETTERS);
    }
    if (!reserveCall(ctx.db, ctx.now())) return 'limit';
    let raw: string;
    try {
      raw = await this.client.complete(
        key,
        model,
        [
          { role: 'system', content: SYSTEM_PROMPTS[bot.type] },
          ...(summary
            ? [{ role: 'system' as const, content: `Bisheriger Briefwechsel in Kürze: ${summary}` }]
            : []),
          ...history.map((item) => this.asMessage(bot, item)),
          { role: 'user', content: letter.plaintext },
        ],
        REPLY_TOKENS,
      );
    } catch (error) {
      const status = (error as { status?: number | null }).status;
      return {
        error:
          status === 401
            ? 'OpenAI lehnt den Key ab (ungültig oder gesperrt).'
            : status
              ? `OpenAI antwortete mit Status ${status}.`
              : 'OpenAI ist nicht erreichbar oder hat nicht rechtzeitig geantwortet.',
      };
    }
    const text = finishReply(raw);
    if (text === '') return { error: 'OpenAI lieferte eine leere Antwort.' };
    const now = ctx.now();
    const after: (() => void)[] = [];
    ctx.db.transaction(() => {
      if (!botById(ctx, bot.id)) return;
      // A letter to a bot counts as read once the bot has written its reply (SPEC 8.4).
      ctx.db.run('UPDATE letters SET read = 1 WHERE id = ?', letter.id);
      dispatchBotLetter(ctx, bot, text, 0, now);
      ctx.db.run('DELETE FROM bot_jobs WHERE letter_id = ?', letter.id);
      after.push(() => ctx.hub.notify(bot.owner_id, 'chats'));
    });
    for (const work of after) work();
    return 'done';
  }

  /** Letters of the conversation after the summary, before the new letter (oldest first). */
  private history(bot: BotRow, letter: Letter, summarizedUntil: number | null): Letter[] {
    return this.ctx.db.all<Letter>(
      `SELECT id, sender_id, sent_at, plaintext FROM letters
        WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
          AND status = 'delivered' AND plaintext IS NOT NULL AND id != ?
          AND sent_at <= ? AND sent_at > ?
        ORDER BY sent_at, id`,
      bot.owner_id,
      bot.id,
      bot.id,
      bot.owner_id,
      letter.id,
      letter.sent_at,
      summarizedUntil ?? -1,
    );
  }

  private asMessage(bot: BotRow, letter: Letter): AiMessage {
    return {
      role: letter.sender_id === bot.id ? 'assistant' : 'user',
      content: letter.plaintext ?? '',
    };
  }

  private summaryMessages(
    bot: BotRow,
    summary: string | null,
    older: readonly Letter[],
  ): AiMessage[] {
    const lines = older.map(
      (item) =>
        `${item.sender_id === bot.id ? 'Brieffigur' : 'Gegenüber'}: ${item.plaintext ?? ''}`,
    );
    return [
      { role: 'system', content: SUMMARY_PROMPT },
      {
        role: 'user',
        content: `${summary ? `Bisherige Zusammenfassung:\n${summary}\n\n` : ''}Weitere Briefe:\n${lines.join('\n\n')}`,
      },
    ];
  }
}

export function registerReplyHandler(ctx: Context): void {
  ctx.queue.on('bot_reply', (event, tools) => {
    const letter = ctx.db.get<{ recipient_id: string }>(
      'SELECT recipient_id FROM letters WHERE id = ?',
      event.ref,
    );
    if (letter && botById(ctx, letter.recipient_id)) {
      ctx.db.run(
        'INSERT OR IGNORE INTO bot_jobs (letter_id, bot_id, due_at) VALUES (?, ?, ?)',
        event.ref,
        letter.recipient_id,
        event.logicalAt,
      );
    }
    tools.after(() => ctx.botReplies.kick());
  });
}
