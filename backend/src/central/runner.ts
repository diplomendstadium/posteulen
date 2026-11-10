/**
 * v0.8: sends the letters of control-centre bots (SPEC 10.8, 10.9). A delivery is one letter of
 * a bot to one player – from an event or a spontaneous reply. Due deliveries lie in
 * `central_bot_deliveries`, so nothing is lost on a restart, and the unique pair (event, player)
 * makes sure an event never reaches a player twice. AI calls run outside of any database
 * transaction; the letter starts in one transaction together with marking the player's letters as
 * answered – only then do they count as answered.
 *
 * - Event letter: the planned text is binding; with unanswered letters of the player the AI adds a
 *   short reaction. Without AI (no key, quota used up, error) the unchanged planned letter goes –
 *   a round letter never fails because of an API outage.
 * - Spontaneous reply: only with AI; otherwise the retry rules of the Erklärbär (quota: next day,
 *   error: again in 24 hours).
 * - The bot's own owl: the next letter to a player waits until its instance is back home; loan
 *   owls are new owls each time.
 */
import { BOTS, LETTER, TIME } from '@posteulen/shared/constants.ts';
import type { Language } from '@posteulen/shared/i18n.ts';
import type { Context } from '../context.ts';
import { languageOf } from '../accounts/language.ts';
import { logError } from '../ops/error-log.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { aiModel, loadApiKey, reserveCall, type AiClient, type AiMessage } from '../bots/ai.ts';
import { finishReply } from '../bots/replies.ts';
import {
  centralBotPrompt,
  personalizeInstruction,
  spontaneousInstruction,
  SUMMARY_PROMPT,
} from '../bots/prompts.ts';
import {
  centralBot,
  countStat,
  ensurePlayer,
  eventById,
  eventText,
  mediaOf,
  parchmentFor,
  playerEligible,
  playerRow,
  type CentralBotRow,
  type DeliveryRow,
  type EventRow,
} from './model.ts';
import { checkArchive, ownOwlOut, owlModeOf, startBotFlight } from './flights.ts';

const REPLY_TOKENS = 8000;
const SUMMARY_TOKENS = 4000;

interface ConversationLetter {
  readonly id: string;
  readonly sender_id: string;
  readonly sent_at: number;
  readonly plaintext: string | null;
}

/** Result of asking the AI: a text, or why not. */
type AiResult = { text: string } | { problem: 'no_key' | 'limit' | 'error'; detail: string };

/** The context of the bot's last event that ran (background for replies, SPEC 10.9). */
function lastContext(ctx: Context, botId: string): string {
  return (
    ctx.db.get<{ context: string }>(
      `SELECT context FROM central_bot_events
        WHERE bot_id = ? AND state IN ('running', 'archived') AND context != ''
        ORDER BY due_at DESC LIMIT 1`,
      botId,
    )?.context ?? ''
  );
}

/** Text of the AI as a letter of a bot: letter rules, at most a large parchment. */
export function finishCentral(raw: string): string {
  return finishReply(raw, LETTER.LARGE_MAX_CHARS);
}

export class CentralRunner {
  private running = false;
  private again = false;
  private waiters: (() => void)[] = [];
  private readonly ctx: Context;
  private readonly client: AiClient;

  constructor(ctx: Context, client: AiClient) {
    this.ctx = ctx;
    this.client = client;
  }

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

  /** For tests: resolves when nothing is being processed. */
  idle(): Promise<void> {
    if (!this.running) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private async loop(): Promise<void> {
    for (;;) {
      const now = this.ctx.now();
      const delivery = this.ctx.db.get<DeliveryRow>(
        `SELECT d.* FROM central_bot_deliveries d JOIN central_bots b ON b.id = d.bot_id
          WHERE d.state = 'pending' AND d.not_before <= ? AND b.state = 'active'
          ORDER BY d.not_before, d.created_at, d.id LIMIT 1`,
        now,
      );
      if (!delivery) return;
      try {
        await this.process(delivery);
      } catch (error) {
        // Never loop on the same delivery: try again in an hour.
        this.ctx.db.run(
          'UPDATE central_bot_deliveries SET not_before = ?, attempts = attempts + 1 WHERE id = ?',
          this.ctx.now() + TIME.HOUR,
          delivery.id,
        );
        this.ctx.queue.schedule(
          'cbot_kick',
          `${delivery.bot_id}:${delivery.user_id}`,
          this.ctx.now() + TIME.HOUR,
        );
        logError(
          this.ctx.db,
          {
            component: 'Bots (Kontrollzentrum)',
            severity: 'warning',
            what: 'Ein Bot-Brief konnte nicht losgeschickt werden.',
            cause: error instanceof Error ? error.message : 'Unerwarteter Fehler.',
            action: 'Wird in einer Stunde erneut versucht.',
          },
          this.ctx.now(),
        );
      }
    }
  }

  /** Drops a delivery that can no longer go (player gone, bot removed, nothing to say). */
  private drop(delivery: DeliveryRow): void {
    this.ctx.db.transaction(() => {
      this.ctx.db.run(
        "UPDATE central_bot_deliveries SET state = 'dropped' WHERE id = ? AND state = 'pending'",
        delivery.id,
      );
      if (delivery.event_id) checkArchive(this.ctx, delivery.event_id, this.ctx.now());
    });
  }

  private async process(delivery: DeliveryRow): Promise<void> {
    const ctx = this.ctx;
    const bot = centralBot(ctx, delivery.bot_id);
    if (!bot) return;
    if (!playerEligible(ctx, bot.id, delivery.user_id)) return this.drop(delivery);
    const event = delivery.event_id ? eventById(ctx, delivery.event_id) : undefined;
    if (delivery.event_id && !event) return this.drop(delivery);
    const mode = owlModeOf(bot, event?.owl_mode ?? null);
    const out = mode === 'own' ? ownOwlOut(ctx, bot.id, delivery.user_id) : undefined;
    if (out) {
      // Waits for the bot's owl to be back (its end wakes the runner again).
      ctx.db.run(
        'UPDATE central_bot_deliveries SET not_before = ? WHERE id = ?',
        Math.max(out.ends_at, ctx.now() + TIME.MINUTE),
        delivery.id,
      );
      return;
    }
    const language = languageOf(ctx, delivery.user_id);
    const unanswered = this.unanswered(bot.id, delivery.user_id);
    let text: string | null = null;
    let personalized = false;
    // v0.8.3: a player who has written to the bot knows it – then always the follow-up letter
    // (the AI adapts that one, never the first letter).
    const variant = unanswered.length > 0 ? 'follow' : this.variantFor(bot.id, delivery.user_id);
    if (event) {
      if (event.has_letter === 1) {
        const planned = eventText(event, variant, language);
        text = planned;
        if (unanswered.length > 0) {
          const result = await this.ask(bot, delivery.user_id, language, event.context, {
            planned,
            letters: unanswered,
          });
          if ('text' in result) {
            text = result.text;
            personalized = true;
          } else if (result.problem !== 'limit') {
            this.log(result.detail, 'Der geplante Brief ging unverändert los.');
          }
        }
      }
    } else {
      // Spontaneous reply: only something to say if letters still wait.
      if (unanswered.length === 0) return this.drop(delivery);
      const result = await this.ask(bot, delivery.user_id, language, lastContext(ctx, bot.id), {
        letters: unanswered,
      });
      if (!('text' in result)) return this.postpone(delivery, result);
      text = result.text;
      personalized = true;
    }
    this.start(bot, delivery, event, text, personalized ? unanswered : [], mode, variant);
  }

  private variantFor(botId: string, userId: string): 'first' | 'follow' {
    return playerRow(this.ctx, botId, userId)?.first_started === 1 ? 'follow' : 'first';
  }

  private unanswered(botId: string, userId: string): ConversationLetter[] {
    return this.ctx.db.all<ConversationLetter>(
      `SELECT l.id, l.sender_id, l.sent_at, l.plaintext FROM central_bot_inbox i
         JOIN letters l ON l.id = i.letter_id
        WHERE i.bot_id = ? AND i.user_id = ? AND i.state = 'arrived' AND l.plaintext IS NOT NULL
        ORDER BY l.sent_at, l.id`,
      botId,
      userId,
    );
  }

  private postpone(delivery: DeliveryRow, result: Exclude<AiResult, { text: string }>): void {
    const ctx = this.ctx;
    const now = ctx.now();
    const due =
      result.problem === 'limit'
        ? Date.parse(`${utcDay(now + TIME.DAY)}T00:01:00Z`)
        : now + BOTS.AI_RETRY_HOURS * TIME.HOUR;
    ctx.db.transaction(() => {
      ctx.db.run(
        'UPDATE central_bot_deliveries SET not_before = ?, attempts = attempts + ? WHERE id = ?',
        due,
        result.problem === 'limit' ? 0 : 1,
        delivery.id,
      );
      ctx.queue.schedule('cbot_kick', `${delivery.bot_id}:${delivery.user_id}`, due);
    });
    if (result.problem !== 'limit')
      this.log(result.detail, 'Die Antwort wird in 24 Stunden erneut versucht.');
  }

  private log(cause: string, action: string): void {
    logError(
      this.ctx.db,
      {
        component: 'Bots (KI)',
        severity: 'warning',
        what: 'Ein Brief eines Bots aus dem Kontrollzentrum konnte nicht mit KI angepasst werden.',
        cause,
        action: `${action} Im Adminpanel OpenAI-Key, Modell und „Verbindung testen“ prüfen.`,
      },
      this.ctx.now(),
    );
  }

  /**
   * Asks the AI: a personalised planned letter or a spontaneous reply. Also used by the test
   * function of the control centre (`history` empty, nothing stored).
   */
  async ask(
    bot: Pick<CentralBotRow, 'id' | 'name' | 'character'>,
    userId: string | null,
    language: Language,
    context: string,
    request: {
      planned?: string;
      letters: readonly Pick<ConversationLetter, 'plaintext'>[];
      /** v0.8.3: the test of the control centre brings the bot's previous letter as history. */
      history?: readonly AiMessage[];
    },
  ): Promise<AiResult> {
    const ctx = this.ctx;
    const key = await loadApiKey(ctx);
    if (!key) return { problem: 'no_key', detail: 'Es ist kein (gültiger) OpenAI-Key hinterlegt.' };
    const model = aiModel(ctx.db);
    const memory = userId
      ? await this.memory(bot, userId, key, model)
      : { summary: null, history: [...(request.history ?? [])] };
    if (memory === 'limit') return { problem: 'limit', detail: 'Tageslimit erreicht.' };
    if (!reserveCall(ctx.db, ctx.now(), 'bots'))
      return { problem: 'limit', detail: 'Tageslimit erreicht.' };
    const instruction = request.planned
      ? personalizeInstruction(language, request.planned)
      : spontaneousInstruction(language);
    const letters = request.letters
      .map((letter, index) => `Brief ${index + 1}:\n${letter.plaintext ?? ''}`)
      .join('\n\n');
    const messages: AiMessage[] = [
      { role: 'system', content: centralBotPrompt(language, bot, context) },
      ...(memory.summary
        ? [
            {
              role: 'system' as const,
              content: `Bisheriger Briefwechsel in Kürze: ${memory.summary}`,
            },
          ]
        : []),
      ...memory.history,
      { role: 'system', content: instruction },
      { role: 'user', content: `Noch unbeantwortete Briefe deines Gegenübers:\n\n${letters}` },
    ];
    try {
      const raw = await this.client.complete(key, model, messages, REPLY_TOKENS);
      const text = finishCentral(raw);
      return text === ''
        ? { problem: 'error', detail: 'OpenAI lieferte eine leere Antwort.' }
        : { text };
    } catch (error) {
      const status = (error as { status?: number | null }).status;
      return {
        problem: 'error',
        detail:
          status === 401
            ? 'OpenAI lehnt den Key ab (ungültig oder gesperrt).'
            : status
              ? `OpenAI antwortete mit Status ${status}.`
              : 'OpenAI ist nicht erreichbar oder hat nicht rechtzeitig geantwortet.',
      };
    }
  }

  /**
   * The bot's memory of this player: summary plus the last letters (answered ones; v0.8.3 the
   * last 15, before 6); older letters are folded into the summary (one extra call at most).
   */
  private async memory(
    bot: Pick<CentralBotRow, 'id'>,
    userId: string,
    key: string,
    model: string,
  ): Promise<{ summary: string | null; history: AiMessage[] } | 'limit'> {
    const ctx = this.ctx;
    const chat = ctx.db.get<{ bot_summary: string | null; bot_summarized_until: number | null }>(
      'SELECT bot_summary, bot_summarized_until FROM chats WHERE owner_id = ? AND peer_id = ?',
      userId,
      bot.id,
    );
    let summary = chat?.bot_summary ?? null;
    let history = ctx.db.all<ConversationLetter>(
      `SELECT id, sender_id, sent_at, plaintext FROM letters
        WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
          AND status = 'delivered' AND plaintext IS NOT NULL AND sent_at > ?
          AND id NOT IN (SELECT letter_id FROM central_bot_inbox WHERE state = 'arrived')
        ORDER BY sent_at, id`,
      bot.id,
      userId,
      userId,
      bot.id,
      chat?.bot_summarized_until ?? -1,
    );
    if (history.length > BOTS.CENTRAL_CONTEXT_LETTERS) {
      const older = history.slice(0, history.length - BOTS.CENTRAL_CONTEXT_LETTERS);
      if (!reserveCall(ctx.db, ctx.now(), 'bots')) return 'limit';
      const lines = older.map(
        (item) =>
          `${item.sender_id === bot.id ? 'Brieffigur' : 'Gegenüber'}: ${item.plaintext ?? ''}`,
      );
      summary = await this.client.complete(
        key,
        model,
        [
          { role: 'system', content: SUMMARY_PROMPT },
          {
            role: 'user',
            content: `${summary ? `Bisherige Zusammenfassung:\n${summary}\n\n` : ''}Weitere Briefe:\n${lines.join('\n\n')}`,
          },
        ],
        SUMMARY_TOKENS,
      );
      ctx.db.run(
        'UPDATE chats SET bot_summary = ?, bot_summarized_until = ? WHERE owner_id = ? AND peer_id = ?',
        summary.slice(0, 4000),
        older.at(-1)?.sent_at ?? null,
        userId,
        bot.id,
      );
      history = history.slice(-BOTS.CENTRAL_CONTEXT_LETTERS);
    }
    return {
      summary,
      history: history.map((item) => ({
        role: item.sender_id === bot.id ? ('assistant' as const) : ('user' as const),
        content: item.plaintext ?? '',
      })),
    };
  }

  /** The letter takes off – one transaction with everything it changes. */
  private start(
    bot: CentralBotRow,
    delivery: DeliveryRow,
    event: EventRow | undefined,
    text: string | null,
    answered: readonly ConversationLetter[],
    mode: 'own' | 'loan',
    variant: 'first' | 'follow',
  ): void {
    const ctx = this.ctx;
    ctx.db.transaction(() => {
      const now = ctx.now();
      const fresh = ctx.db.get<DeliveryRow>(
        "SELECT * FROM central_bot_deliveries WHERE id = ? AND state = 'pending'",
        delivery.id,
      );
      const current = centralBot(ctx, bot.id);
      if (!fresh || current?.state !== 'active') return;
      if (!playerEligible(ctx, bot.id, delivery.user_id)) {
        ctx.db.run("UPDATE central_bot_deliveries SET state = 'dropped' WHERE id = ?", delivery.id);
        return;
      }
      if (mode === 'own' && ownOwlOut(ctx, bot.id, delivery.user_id)) return;
      ensurePlayer(ctx, bot.id, delivery.user_id);
      const flight = startBotFlight(ctx, current, delivery.user_id, mode, now);
      let letterId: string | null = null;
      if (text !== null && text.trim() !== '') {
        letterId = randomId();
        const kind = event?.gift_gold ? 'cover_gold' : event?.gift_species ? 'cover_owl' : 'letter';
        const media = event ? mediaOf(event) : [];
        ctx.db.run(
          `INSERT INTO letters (id, sender_id, recipient_id, kind, parchment, sent_at, arrives_at, plaintext,
                                status, owl_name, owl_species, flight_id, media, bot_event_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_flight', ?, ?, ?, ?, ?)`,
          letterId,
          bot.id,
          delivery.user_id,
          kind,
          parchmentFor(text, event?.parchment ?? 'small'),
          now,
          flight.arrivesAt,
          text,
          flight.owlName,
          flight.species,
          flight.flightId,
          media.length > 0 ? JSON.stringify(media) : null,
          event?.id ?? null,
        );
        // From now on the follow-up variant (letters already started count, SPEC 10.8).
        ctx.db.run(
          'UPDATE central_bot_players SET first_started = 1 WHERE bot_id = ? AND user_id = ?',
          bot.id,
          delivery.user_id,
        );
        countStat(ctx, bot.id, 'sent', now, event?.id);
        for (const letter of answered) {
          const marked = ctx.db.run(
            "UPDATE central_bot_inbox SET state = 'answered', answered_by = ? WHERE letter_id = ? AND state = 'arrived'",
            letterId,
            letter.id,
          );
          // A letter to a bot counts as read once the bot has written its reply (SPEC 8.4).
          if (marked.changes === 1)
            ctx.db.run('UPDATE letters SET read = 1 WHERE id = ?', letter.id);
        }
      }
      ctx.db.run(
        `UPDATE central_bot_deliveries SET state = 'started', variant = ?, letter_id = ?, flight_id = ?,
                personalized = ?, started_at = ?, arrives_at = ? WHERE id = ?`,
        letterId ? variant : null,
        letterId,
        flight.flightId,
        answered.length > 0 ? 1 : 0,
        now,
        Math.round(flight.arrivesAt),
        delivery.id,
      );
    });
  }
}
