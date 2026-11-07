/**
 * Gold arithmetic (SPEC 9.1). All amounts are integers in tenths, so there are no rounding
 * errors; every paid action needs full cover and a non-negative balance.
 */
import { GOLD, TIME } from '../constants.ts';

export function canAfford(balance: number, cost: number): boolean {
  return balance >= 0 && balance >= cost;
}

/** Species price (whole gold) in tenths. */
export function priceTenths(price: number): number {
  return Math.round(price * 10);
}

/** "12,3" – German decimal comma, always one decimal; "12.3" in the English view (v0.4). */
export function formatGold(tenths: number, separator: ',' | '.' = ','): string {
  const sign = tenths < 0 ? '-' : '';
  const abs = Math.abs(tenths);
  return `${sign}${Math.floor(abs / 10)}${separator}${abs % 10}`;
}

/**
 * Daily wage of an account at `at` (v0.4, 9.1.1): GOLD.DAILY on the day of registration
 * (UTC day `createdOn`, YYYY-MM-DD) and the following days up to GOLD.DAILY_HIGH_DAYS in total,
 * GOLD.DAILY_LATER afterwards. The server's daily job uses the same rule.
 */
export function dailyWage(createdOn: string, at: number): number {
  const highSince = new Date(at - GOLD.DAILY_HIGH_DAYS * TIME.DAY).toISOString().slice(0, 10);
  return createdOn > highSince ? GOLD.DAILY : GOLD.DAILY_LATER;
}

/** Parses "1,5", "1.5" or "2" into tenths; undefined for anything else. */
export function parseGold(text: string): number | undefined {
  const match = /^\s*(\d{1,4})(?:[.,](\d))?\s*$/.exec(text);
  if (!match) return undefined;
  return Number(match[1]) * 10 + Number(match[2] ?? '0');
}

export type TransferProblem = 'transfer_amount' | 'transfer_remaining' | 'gold_insufficient';

/** Transfer rules (9.1.4): 0.1–20.0 gold, balance afterwards still greater than 10.0. */
export function transferProblem(balance: number, amount: number): TransferProblem | null {
  if (!Number.isInteger(amount) || amount < GOLD.TRANSFER_MIN || amount > GOLD.TRANSFER_MAX) {
    return 'transfer_amount';
  }
  if (!canAfford(balance, amount)) return 'gold_insufficient';
  if (balance - amount <= GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE) return 'transfer_remaining';
  return null;
}

/** Largest amount that may be sent right now (0 if none). */
export function maxTransfer(balance: number): number {
  return Math.max(
    0,
    Math.min(GOLD.TRANSFER_MAX, balance - GOLD.TRANSFER_MIN_REMAINING_EXCLUSIVE - 1),
  );
}
