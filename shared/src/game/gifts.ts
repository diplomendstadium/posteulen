/**
 * Giving gold or owls away (SPEC 9.1.4, 9.2.7, 9.10): makes it harder to move gold and owls from
 * extra accounts to a main account. Pure rules over a day log of the last 14 days.
 */
import { GIFTS, GLOBE } from '../constants.ts';

/** One UTC day of an account in the log: active, a letter to / from a person. */
export interface ActivityDay {
  readonly day: string;
  readonly active: boolean;
  readonly sentHuman: boolean;
  readonly receivedHuman: boolean;
}

/** The 14 UTC days ending with `today` (oldest first). */
export function giftWindow(today: string): string[] {
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: GIFTS.WINDOW_DAYS }, (_, index) =>
    new Date(end - (GIFTS.WINDOW_DAYS - 1 - index) * 86_400_000).toISOString().slice(0, 10),
  );
}

export type GiftBlock = 'recent_gift' | 'inactive' | 'few_received' | 'few_sent';

/**
 * Why this player may not give gold or an owl right now, or null. Gold transfers and owl gifts
 * count together; the chick a player must give away is exempt and does not count.
 */
export function giftBlock(input: {
  readonly today: string;
  /** UTC day of the last gift of gold or an owl (null: none). */
  readonly lastGiftDay: string | null;
  readonly days: readonly ActivityDay[];
}): GiftBlock | null {
  const window = new Set(giftWindow(input.today));
  if (input.lastGiftDay !== null && window.has(input.lastGiftDay)) return 'recent_gift';
  const inWindow = input.days.filter((entry) => window.has(entry.day));
  const count = (pick: (entry: ActivityDay) => boolean): number =>
    new Set(inWindow.filter(pick).map((entry) => entry.day)).size;
  if (count((entry) => entry.active) < GIFTS.MIN_ACTIVE_DAYS) return 'inactive';
  if (count((entry) => entry.receivedHuman) < GIFTS.MIN_RECEIVED_DAYS) return 'few_received';
  if (count((entry) => entry.sentHuman) < GIFTS.MIN_SENT_DAYS) return 'few_sent';
  return null;
}

/** 🌍 after the name of an owl that has flown more than the Earth's circumference (9.2.1). */
export function isGlobetrotter(km: number): boolean {
  return km > GLOBE.KM;
}

/** The name as shown everywhere: with 🌍 for a globetrotter. */
export function owlDisplayName(name: string, globetrotter: boolean): string {
  return globetrotter ? `${name} ${GLOBE.BADGE}` : name;
}
