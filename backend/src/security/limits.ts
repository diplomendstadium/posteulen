/**
 * In-memory rate limits and login back-off (SPEC 5.10). Nothing here is ever persisted:
 * no permanent locks, IP addresses only in memory.
 */
import { SECURITY } from '@posteulen/shared/constants.ts';

const MAX_ENTRIES = 100_000;

/** Fixed-window counter per key. */
export class RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Counts a hit; returns ms to wait if over the limit, else 0. */
  hit(key: string, now: number): number {
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      if (this.windows.size >= MAX_ENTRIES) this.prune(now);
      entry = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
    }
    entry.count++;
    return entry.count > this.limit ? entry.resetAt - now : 0;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.windows) if (entry.resetAt <= now) this.windows.delete(key);
    if (this.windows.size >= MAX_ENTRIES) this.windows.clear();
  }
}

interface Failures {
  count: number;
  lastAt: number;
}

/**
 * Failed login attempts per key (normalised name or IP). The same counters apply to unknown
 * names, otherwise the behaviour would reveal whether an account exists.
 */
export class LoginGuard {
  private readonly failures = new Map<string, Failures>();
  private readonly backoffFrom: number;
  private readonly captchaFrom: number;
  /** Counters are forgotten after this long without failures. */
  private readonly forgetAfterMs: number;

  constructor(
    backoffFrom: number = SECURITY.LOGIN_BACKOFF_FROM_FAILURE,
    captchaFrom: number = SECURITY.LOGIN_CAPTCHA_FROM_FAILURE,
    forgetAfterMs = 24 * 60 * 60 * 1000,
  ) {
    this.backoffFrom = backoffFrom;
    this.captchaFrom = captchaFrom;
    this.forgetAfterMs = forgetAfterMs;
  }

  private current(key: string, now: number): Failures {
    const entry = this.failures.get(key);
    if (!entry || now - entry.lastAt > this.forgetAfterMs) return { count: 0, lastAt: 0 };
    return entry;
  }

  /** Exponential delay from the configured failure on, capped at 15 minutes. */
  waitMs(key: string, now: number): number {
    const { count, lastAt } = this.current(key, now);
    if (count < this.backoffFrom) return 0;
    const delay = Math.min(
      SECURITY.LOGIN_BACKOFF_MAX_MINUTES * 60_000,
      1000 * 2 ** (count - this.backoffFrom + 1),
    );
    return Math.max(0, lastAt + delay - now);
  }

  captchaRequired(key: string, now: number): boolean {
    return this.current(key, now).count >= this.captchaFrom;
  }

  fail(key: string, now: number): void {
    if (this.failures.size >= MAX_ENTRIES) this.failures.clear();
    const entry = this.current(key, now);
    this.failures.set(key, { count: entry.count + 1, lastAt: now });
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

/** Short-lived values (OPAQUE states, reservations, tokens) with expiry and a size cap. */
export class Ephemeral<T> {
  private readonly items = new Map<string, { value: T; expiresAt: number }>();
  private readonly maxEntries: number;

  constructor(maxEntries = 10_000) {
    this.maxEntries = maxEntries;
  }

  set(key: string, value: T, ttlMs: number, now: number): void {
    if (this.items.size >= this.maxEntries) {
      for (const [k, item] of this.items) if (item.expiresAt <= now) this.items.delete(k);
      if (this.items.size >= this.maxEntries) {
        const oldest = this.items.keys().next().value;
        if (oldest !== undefined) this.items.delete(oldest);
      }
    }
    this.items.set(key, { value, expiresAt: now + ttlMs });
  }

  get(key: string, now: number): T | undefined {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= now) {
      this.items.delete(key);
      return undefined;
    }
    return item.value;
  }

  /** Reads and removes (single use). */
  take(key: string, now: number): T | undefined {
    const value = this.get(key, now);
    this.items.delete(key);
    return value;
  }

  delete(key: string): void {
    this.items.delete(key);
  }

  values(now: number): T[] {
    const out: T[] = [];
    for (const [key, item] of this.items) {
      if (item.expiresAt <= now) this.items.delete(key);
      else out.push(item.value);
    }
    return out;
  }
}
