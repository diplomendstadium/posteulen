/**
 * Gold bookings (SPEC 9.1): every change of a balance happens here, atomically inside the
 * caller's transaction, with full cover for debits. Only the last 20 transactions per user
 * are kept (9.1.3).
 */
import { GOLD } from '@posteulen/shared/constants.ts';
import type { Database } from '../db/database.ts';
import { HttpError } from '../http/errors.ts';

export type TransactionType =
  | 'daily'
  | 'owl_purchase'
  | 'feed'
  | 'large_parchment'
  | 'transfer_out'
  | 'transfer_in'
  | 'transfer_refund';

function record(
  db: Database,
  userId: string,
  type: TransactionType,
  amount: number,
  at: number,
  counterpartId: string | null,
): void {
  db.run(
    'INSERT INTO transactions (user_id, at, type, amount, counterpart_id) VALUES (?, ?, ?, ?, ?)',
    userId,
    at,
    type,
    amount,
    counterpartId,
  );
  db.run(
    `DELETE FROM transactions WHERE user_id = ? AND id NOT IN
       (SELECT id FROM transactions WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT ?)`,
    userId,
    userId,
    GOLD.TRANSACTIONS_KEPT,
  );
}

/** Takes `amount` tenths, only with full cover and a non-negative balance; else 400. */
export function debit(
  db: Database,
  userId: string,
  type: TransactionType,
  amount: number,
  at: number,
  counterpartId: string | null = null,
): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('invalid debit');
  const charged = db.run(
    'UPDATE users SET gold = gold - ? WHERE id = ? AND gold >= ? AND gold >= 0',
    amount,
    userId,
    amount,
  );
  if (charged.changes !== 1) throw new HttpError(400, 'gold_insufficient');
  record(db, userId, type, -amount, at, counterpartId);
}

export function credit(
  db: Database,
  userId: string,
  type: TransactionType,
  amount: number,
  at: number,
  counterpartId: string | null = null,
): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('invalid credit');
  const updated = db.run('UPDATE users SET gold = gold + ? WHERE id = ?', amount, userId);
  if (updated.changes === 1) record(db, userId, type, amount, at, counterpartId);
}

export function balance(db: Database, userId: string): number {
  return db.get<{ gold: number }>('SELECT gold FROM users WHERE id = ?', userId)?.gold ?? 0;
}
