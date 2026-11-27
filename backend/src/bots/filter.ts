/**
 * v1.4.3: safety step before the AI writes for a bot (SPEC 10.5). Every letter of a player to a
 * bot (Erklärbär and control-centre bots) first goes alone, without any context, to the AI with
 * the request to remove all sentences and paragraphs about drugs, sexuality or violence – not to
 * answer or change it. The result is stored once per letter (`letters.ai_text`, empty when
 * nothing is left) and is the only version of the letter any later AI call sees: reply, history
 * and summary. The player keeps seeing their own letter. Each filtering is one call of the daily
 * quota of the bot's pool.
 */
import { countCodePoints } from '@posteulen/shared/names.ts';
import type { Context } from '../context.ts';
import { AiError, reserveCall, type AiClient, type AiPool } from './ai.ts';
import { FILTER_EMPTY, FILTER_PROMPT } from './prompts.ts';

/** Room for a large parchment plus the hidden reasoning of reasoning models. */
const FILTER_TOKENS = 8000;
/** The filter only removes: an answer clearly longer than the letter is not a filtered letter. */
const FILTER_SLACK_CHARS = 20;

/** The cleaned text, `'limit'` when the quota is used up, or why the AI failed. */
export type Filtered = string | 'limit' | { error: string };

export interface FilterLetter {
  readonly id?: string;
  readonly plaintext: string | null;
  readonly ai_text?: string | null;
}

/** Readable cause of a failed AI call for the error log (never the key). */
export function aiProblem(error: unknown): string {
  const status = (error as { status?: number | null } | null)?.status ?? null;
  if (error instanceof AiError && error.message === 'filter answer too long')
    return 'Der Vorfilter lieferte statt des bereinigten Briefs einen längeren Text.';
  return status === 401
    ? 'OpenAI lehnt den Key ab (ungültig oder gesperrt).'
    : status
      ? `OpenAI antwortete mit Status ${status}.`
      : 'OpenAI ist nicht erreichbar oder hat nicht rechtzeitig geantwortet.';
}

/** One call of the filter for a text; throws `AiError` if the answer is no filtered letter. */
export async function filterText(
  client: AiClient,
  key: string,
  model: string,
  text: string,
): Promise<string> {
  if (text.trim() === '') return '';
  const raw = await client.complete(
    key,
    model,
    [
      { role: 'system', content: FILTER_PROMPT },
      { role: 'user', content: text },
    ],
    FILTER_TOKENS,
  );
  const out = raw.trim();
  if (out.replaceAll(FILTER_EMPTY, '').trim() === '') return '';
  if (countCodePoints(out) > countCodePoints(text.trim()) + FILTER_SLACK_CHARS)
    throw new AiError('filter answer too long', null);
  return out;
}

/**
 * The version of a letter the AI may see. Stored letters are filtered once and remembered; a
 * letter without ID (the test of the control centre) is filtered without storing anything.
 */
export async function aiTextOf(
  ctx: Context,
  client: AiClient,
  key: string,
  model: string,
  letter: FilterLetter,
  pool: AiPool,
): Promise<Filtered> {
  if (letter.ai_text !== undefined && letter.ai_text !== null) return letter.ai_text;
  if (letter.id !== undefined) {
    const stored = ctx.db.get<{ ai_text: string | null }>(
      'SELECT ai_text FROM letters WHERE id = ?',
      letter.id,
    );
    if (stored?.ai_text !== undefined && stored.ai_text !== null) return stored.ai_text;
  }
  if (!reserveCall(ctx.db, ctx.now(), pool)) return 'limit';
  let text: string;
  try {
    text = await filterText(client, key, model, letter.plaintext ?? '');
  } catch (error) {
    return { error: aiProblem(error) };
  }
  if (letter.id !== undefined)
    ctx.db.run('UPDATE letters SET ai_text = ? WHERE id = ?', text, letter.id);
  return text;
}
