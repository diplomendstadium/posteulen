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
 * - v1.4.3: every letter of the player goes through the safety filter first (`bots/filter.ts`);
 *   the AI only sees the filtered versions. Letters with nothing left count as answered without
 *   a reply; is nothing left at all, a planned letter goes unchanged and a spontaneous reply is
 *   dropped.
 */
import { christmasAt } from '../letters/season.ts';
import { BOTS, LETTER, TIME } from '@posteulen/shared/constants.ts';
import type { Language } from '@posteulen/shared/i18n.ts';
import type { Context } from '../context.ts';
import { languageOf } from '../accounts/language.ts';
import { logError } from '../ops/error-log.ts';
import { randomId, utcDay } from '../security/ids.ts';
import { aiModel, loadApiKey, reserveCall, type AiClient, type AiMessage } from '../bots/ai.ts';
import { finishReply } from '../bots/replies.ts';
import { aiTextOf, filterText, aiProblem } from '../bots/filter.ts';
import {
  carrierText,
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
  /** v1.4.3: the filtered version for the AI (null: not filtered yet). */
  readonly ai_text?: string | null;
  /** v1.3.1: the owl that brought the letter (unanswered letters of the player only). */
  readonly owl_name?: string;
  readonly owl_species?: string;
  readonly owl_sex?: 'f' | 'm' | null;
}

/** v1.3.1: the owls of the player's letters may be mentioned (SPEC 10.5). */
const CARRIER_HINT =
  'Zu jedem Brief steht dabei, mit welcher Eule er bei dir ankam. Wenn es passt, darfst du darauf eingehen (z. B. die Eule grüßen), musst es aber nicht. Erfinde nichts über die Eule.';

/** Result of asking the AI: a text, or why not. */
type AiResult = { text: string } | AiProblem;
type AiProblem = { problem: 'no_key' | 'limit' | 'error'; detail: string };

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
    let answered: readonly ConversationLetter[] = [];
    // v0.8.3: a player who has written to the bot knows it – then always the follow-up letter
    // (the AI adapts that one, never the first letter).
    const variant = unanswered.length > 0 ? 'follow' : this.variantFor(bot.id, delivery.user_id);
    if (event) {
      if (event.has_letter === 1) {
        const planned = eventText(event, variant, language);
        text = planned;
        const filtered = await this.filtered(unanswered);
        if ('problem' in filtered) {
          if (filtered.problem !== 'limit')
            this.log(filtered.detail, 'Der geplante Brief ging unverändert los.');
        } else if (filtered.letters.length > 0) {
          const result = await this.ask(bot, delivery.user_id, language, event.context, {
            planned,
            letters: filtered.letters,
          });
          if ('text' in result) {
            text = result.text;
            personalized = true;
            answered = filtered.letters;
          } else if (result.problem !== 'limit') {
            this.log(result.detail, 'Der geplante Brief ging unverändert los.');
          }
        }
      }
    } else {
      // Spontaneous reply: only something to say if letters still wait.
      if (unanswered.length === 0) return this.drop(delivery);
      const filtered = await this.filtered(unanswered);
      if ('problem' in filtered) return this.postpone(delivery, filtered);
      // v1.4.3: nothing left after the safety filter – no reply (the letters count as answered).
      if (filtered.letters.length === 0) return this.drop(delivery);
      const result = await this.ask(bot, delivery.user_id, language, lastContext(ctx, bot.id), {
        letters: filtered.letters,
      });
      if (!('text' in result)) return this.postpone(delivery, result);
      answered = filtered.letters;
      text = result.text;
      personalized = true;
    }
    this.start(bot, delivery, event, text, personalized ? answered : [], mode, variant);
  }

  /**
   * v1.4.3: the player's unanswered letters in their filtered version (SPEC 10.5). Letters with
   * nothing left count as answered right away; the first problem of the AI stops the step (the
   * versions already filtered stay stored).
   */
  private async filtered(
    letters: readonly ConversationLetter[],
  ): Promise<{ letters: ConversationLetter[] } | AiProblem> {
    if (letters.length === 0) return { letters: [] };
    const ctx = this.ctx;
    const key = await loadApiKey(ctx);
    if (!key) return { problem: 'no_key', detail: 'Es ist kein (gültiger) OpenAI-Key hinterlegt.' };
    const model = aiModel(ctx.db);
    const kept: ConversationLetter[] = [];
    const silent: string[] = [];
    for (const letter of letters) {
      const text = await aiTextOf(ctx, this.client, key, model, letter, 'bots');
      if (text === 'limit') return { problem: 'limit', detail: 'Tageslimit erreicht.' };
      if (typeof text !== 'string') return { problem: 'error', detail: text.error };
      if (text === '') silent.push(letter.id);
      else kept.push({ ...letter, plaintext: text });
    }
    if (silent.length > 0) {
      ctx.db.transaction(() => {
        for (const id of silent) {
          const marked = ctx.db.run(
            "UPDATE central_bot_inbox SET state = 'answered' WHERE letter_id = ? AND state = 'arrived'",
            id,
          );
          if (marked.changes === 1) ctx.db.run('UPDATE letters SET read = 1 WHERE id = ?', id);
        }
      });
    }
    return { letters: kept };
  }

  /** v1.4.3: the safety filter for the test of the control centre (nothing is stored). */
  async filterTest(text: string): Promise<{ text: string } | AiProblem> {
    const ctx = this.ctx;
    const key = await loadApiKey(ctx);
    if (!key) return { problem: 'no_key', detail: 'Es ist kein (gültiger) OpenAI-Key hinterlegt.' };
    if (!reserveCall(ctx.db, ctx.now(), 'bots'))
      return { problem: 'limit', detail: 'Tageslimit erreicht.' };
    try {
      return { text: await filterText(this.client, key, aiModel(ctx.db), text) };
    } catch (error) {
      return { problem: 'error', detail: aiProblem(error) };
    }
  }

  private variantFor(botId: string, userId: string): 'first' | 'follow' {
    return playerRow(this.ctx, botId, userId)?.first_started === 1 ? 'follow' : 'first';
  }

  private unanswered(botId: string, userId: string): ConversationLetter[] {
    return this.ctx.db.all<ConversationLetter>(
      `SELECT l.id, l.sender_id, l.sent_at, l.plaintext, l.ai_text, l.owl_name, l.owl_species, f.owl_sex
         FROM central_bot_inbox i
         JOIN letters l ON l.id = i.letter_id
         LEFT JOIN flights f ON f.id = l.flight_id
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
      letters: readonly Pick<
        ConversationLetter,
        'plaintext' | 'owl_name' | 'owl_species' | 'owl_sex'
      >[];
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
    if ('problem' in memory) return memory;
    if (!reserveCall(ctx.db, ctx.now(), 'bots'))
      return { problem: 'limit', detail: 'Tageslimit erreicht.' };
    const instruction = request.planned
      ? personalizeInstruction(language, request.planned)
      : spontaneousInstruction(language);
    // v1.3.1: each letter with the owl that brought it (the AI may mention it, SPEC 10.5).
    const letters = request.letters
      .map((letter, index) => {
        const owl =
          letter.owl_name && letter.owl_species
            ? ` (kam mit ${carrierText({ name: letter.owl_name, species: letter.owl_species, sex: letter.owl_sex ?? null })})`
            : '';
        return `Brief ${index + 1}${owl}:\n${letter.plaintext ?? ''}`;
      })
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
      ...(request.letters.some((letter) => letter.owl_name)
        ? [{ role: 'system' as const, content: CARRIER_HINT }]
        : []),
      {
        role: 'user',
        content: `Noch unbeantwortete Briefe deines Gegenübers:\n\n${letters}`,
      },
    ];
    try {
      const raw = await this.client.complete(key, model, messages, REPLY_TOKENS);
      const text = finishCentral(raw);
      return text === ''
        ? { problem: 'error', detail: 'OpenAI lieferte eine leere Antwort.' }
        : { text };
    } catch (error) {
      return { problem: 'error', detail: aiProblem(error) };
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
  ): Promise<{ summary: string | null; history: AiMessage[] } | AiProblem> {
    const ctx = this.ctx;
    const chat = ctx.db.get<{ bot_summary: string | null; bot_summarized_until: number | null }>(
      'SELECT bot_summary, bot_summarized_until FROM chats WHERE owner_id = ? AND peer_id = ?',
      userId,
      bot.id,
    );
    let summary = chat?.bot_summary ?? null;
    const raw = ctx.db.all<ConversationLetter>(
      `SELECT id, sender_id, sent_at, plaintext, ai_text FROM letters
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
    // v1.4.3: the player's letters only in their filtered version (empty ones drop out).
    let history: ConversationLetter[] = [];
    for (const item of raw) {
      if (item.sender_id === bot.id) {
        history.push(item);
        continue;
      }
      const text = await aiTextOf(ctx, this.client, key, model, item, 'bots');
      if (text === 'limit') return { problem: 'limit', detail: 'Tageslimit erreicht.' };
      if (typeof text !== 'string') return { problem: 'error', detail: text.error };
      if (text !== '') history.push({ ...item, plaintext: text });
    }
    if (history.length > BOTS.CENTRAL_CONTEXT_LETTERS) {
      const older = history.slice(0, history.length - BOTS.CENTRAL_CONTEXT_LETTERS);
      if (!reserveCall(ctx.db, ctx.now(), 'bots'))
        return { problem: 'limit', detail: 'Tageslimit erreicht.' };
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
                                status, owl_name, owl_species, flight_id, media, bot_event_id, christmas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'in_flight', ?, ?, ?, ?, ?, ?)`,
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
          christmasAt(ctx, bot.id, now),
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
