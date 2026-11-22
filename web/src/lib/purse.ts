/**
 * v1.3.1: what a player can spend (SPEC 9.1.6, 9.1.7): privileged players have unlimited gold,
 * and owl biscuits and treats from the pouch make feeding and treats free.
 */
import { account } from './auth.svelte.ts';
import { goldText, t } from './i18n.svelte.ts';

/** The special status set by the admin is running. */
export function privileged(): boolean {
  const privilege = account.profile?.privileged;
  if (!privilege) return false;
  return privilege.until === null || privilege.until > Date.now();
}

/** The gold that may be spent now – unlimited with the special status. */
export function spendableGold(): number {
  return privileged() ? Number.POSITIVE_INFINITY : (account.profile?.gold ?? 0);
}

/** The pouch: owl biscuits and treats. */
export function bag(): { biscuits: number; treats: number } {
  return account.profile?.bag ?? { biscuits: 0, treats: 0 };
}

/**
 * What a biscuit or a snack costs right now, as the text in brackets on the button: free with
 * the special status, from the pouch while it holds some, otherwise the price.
 */
export function careCost(kind: 'feed' | 'snack', price: number): string {
  if (privileged()) return t.owls.free;
  const pouch = bag();
  if ((kind === 'feed' ? pouch.biscuits : pouch.treats) > 0) return t.owls.fromBag;
  return goldText(price);
}
