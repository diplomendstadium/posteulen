/** Which letters of a loaded chat may be reported as unreadable (SPEC 8.4, 5.5). */

export interface ReportableLetter {
  readonly id: string;
  readonly role: 'sender' | 'recipient';
  readonly status: 'in_flight' | 'delivered' | 'returned';
  readonly read: boolean;
  readonly text: string | null;
  readonly failure?: string;
}

/**
 * Only failures of the letter itself, found with the complete key bindings of the current
 * account context – never "keys still loading" (`keys_pending`, or the whole chat while the
 * vault is not synchronised), never letters that do not belong to this chat or account
 * (`foreign`). Grouped by reason for the admin's error log.
 */
export function reportableFailures(conversation: {
  readonly letters: readonly ReportableLetter[];
  readonly keysPending: boolean;
}): Map<string, string[]> {
  const reasons = new Map<string, string[]>();
  if (conversation.keysPending) return reasons;
  for (const letter of conversation.letters) {
    if (letter.role !== 'recipient' || letter.status !== 'delivered' || letter.read) continue;
    if (letter.text !== null) continue;
    const reason = letter.failure ?? 'missing';
    if (reason === 'keys_pending' || reason === 'foreign') continue;
    reasons.set(reason, [...(reasons.get(reason) ?? []), letter.id]);
  }
  return reasons;
}
