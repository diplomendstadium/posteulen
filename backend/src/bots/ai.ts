/**
 * OpenAI connection (SPEC 10.5, D-20): plain `fetch` to a fixed base URL, TLS checked by Node,
 * timeout, no redirects, `store: false`. The API key lies encrypted (XChaCha20-Poly1305) in the
 * database, with a key derived from the secrets file; it is decrypted only for a call, never
 * logged and never sent to a browser.
 */
import { BOTS } from '@posteulen/shared/constants.ts';
import { SERVER_CONTEXTS } from '@posteulen/shared/crypto/contexts.ts';
import { fromBase64Url, toBase64Url } from '@posteulen/shared/crypto/encoding.ts';
import { sodium } from '@posteulen/shared/crypto/sodium.ts';
import type { Context } from '../context.ts';
import type { Database } from '../db/database.ts';
import { deriveServerKey } from '../secrets.ts';
import { utcDay } from '../security/ids.ts';

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const TIMEOUT_MS = 60_000;
const DEFAULT_MODEL = 'gpt-6-luna';

export interface AiMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface AiClient {
  complete(
    key: string,
    model: string,
    messages: readonly AiMessage[],
    maxTokens: number,
  ): Promise<string>;
  listModels(key: string): Promise<string[]>;
}

export class AiError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

async function call(key: string, path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE_URL}${path}`, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        authorization: `Bearer ${key}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new AiError('connection failed', null);
  }
  if (!response.ok) throw new AiError('api error', response.status);
  return response.json();
}

export const openAiClient: AiClient = {
  async complete(key, model, messages, maxTokens) {
    const body = (await call(key, '/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model,
        messages,
        max_completion_tokens: maxTokens,
        // Do not keep the conversation at the provider (SPEC 10.5).
        store: false,
      }),
    })) as { choices?: { message?: { content?: unknown } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim() === '')
      throw new AiError('empty answer', null);
    return content;
  },
  async listModels(key) {
    const body = (await call(key, '/models', { method: 'GET' })) as { data?: { id?: unknown }[] };
    return (body.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === 'string')
      .sort();
  },
};

// ── Settings (SPEC 13 item 5) ──────────────────────────────────────────────────────────────

function setting(db: Database, key: string): string | undefined {
  return db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value;
}

function putSetting(db: Database, key: string, value: string): void {
  db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

async function keyCipher(ctx: Context): Promise<Uint8Array> {
  return deriveServerKey(ctx.secrets, SERVER_CONTEXTS.OPENAI_KEY);
}

export async function storeApiKey(ctx: Context, apiKey: string, now: number): Promise<void> {
  const s = await sodium();
  const nonce = s.randombytes_buf(s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const sealed = s.crypto_aead_xchacha20poly1305_ietf_encrypt(
    new TextEncoder().encode(apiKey),
    new TextEncoder().encode('PostEulen/openai-key'),
    null,
    nonce,
    await keyCipher(ctx),
  );
  const blob = new Uint8Array(nonce.length + sealed.length);
  blob.set(nonce);
  blob.set(sealed, nonce.length);
  putSetting(ctx.db, 'openai_key', toBase64Url(blob));
  putSetting(ctx.db, 'openai_key_since', String(now));
}

export function deleteApiKey(db: Database): void {
  db.run("DELETE FROM settings WHERE key IN ('openai_key', 'openai_key_since')");
}

/** The decrypted key, only for the moment of a call. */
export async function loadApiKey(ctx: Context): Promise<string | null> {
  const stored = setting(ctx.db, 'openai_key');
  if (!stored) return null;
  const s = await sodium();
  const blob = fromBase64Url(stored);
  const nonceBytes = s.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES;
  try {
    const plain = s.crypto_aead_xchacha20poly1305_ietf_decrypt(
      null,
      blob.subarray(nonceBytes),
      new TextEncoder().encode('PostEulen/openai-key'),
      blob.subarray(0, nonceBytes),
      await keyCipher(ctx),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function keySince(db: Database): number | null {
  const value = setting(db, 'openai_key_since');
  return value === undefined ? null : Number(value);
}

export function aiModel(db: Database): string {
  return setting(db, 'openai_model') ?? DEFAULT_MODEL;
}

export function setAiModel(db: Database, model: string): void {
  putSetting(db, 'openai_model', model);
}

/** v0.8: two quotas – the Erklärbär has its own, all control-centre bots share one. */
export type AiPool = 'explainer' | 'bots';

const LIMIT_SETTING: Record<AiPool, string> = {
  explainer: 'ai_daily_limit',
  bots: 'ai_daily_limit_bots',
};

export function aiDailyLimit(db: Database, pool: AiPool = 'explainer'): number {
  const value = Number(setting(db, LIMIT_SETTING[pool]));
  const fallback =
    pool === 'explainer' ? BOTS.AI_DAILY_LIMIT_DEFAULT : BOTS.CENTRAL_AI_DAILY_LIMIT_DEFAULT;
  return Number.isInteger(value) && value >= 0 && setting(db, LIMIT_SETTING[pool]) !== undefined
    ? value
    : fallback;
}

export function setAiDailyLimit(db: Database, limit: number, pool: AiPool = 'explainer'): void {
  putSetting(db, LIMIT_SETTING[pool], String(limit));
}

export function usedToday(db: Database, now: number, pool: AiPool = 'explainer'): number {
  return (
    db.get<{ calls: number }>(
      'SELECT calls FROM ai_usage WHERE day = ? AND pool = ?',
      utcDay(now),
      pool,
    )?.calls ?? 0
  );
}

/** Reserves one call of today's budget of the pool; false if it is used up (SPEC 10.5). */
export function reserveCall(db: Database, now: number, pool: AiPool = 'explainer'): boolean {
  if (usedToday(db, now, pool) >= aiDailyLimit(db, pool)) return false;
  db.run(
    `INSERT INTO ai_usage (day, pool, calls) VALUES (?, ?, 1)
     ON CONFLICT (day, pool) DO UPDATE SET calls = calls + 1`,
    utcDay(now),
    pool,
  );
  return true;
}
