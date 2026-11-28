/**
 * The second look of owls (SPEC 9.2.6): if a player owns several owls of the same species, every
 * second one shows the second pictures of its species. An owl gets its look when it moves in
 * (bought, given, hatched, rescued, from a voucher or a bot) and keeps it while it stays with
 * the same owner. It takes the look that is rarer among the owner's other owls of its species;
 * mythical species have no second look.
 */
export type OwlLook = 0 | 1;

export function lookFor(input: {
  /** Other own owls of the same species with the standard look. */
  readonly standard: number;
  /** Other own owls of the same species with the second look. */
  readonly second: number;
  readonly mythical: boolean;
}): OwlLook {
  if (input.mythical) return 0;
  return input.second < input.standard ? 1 : 0;
}

/**
 * v1.5.0: the look of a chick (SPEC 9.2.6, 9.9) – standard chick, second or third chick picture.
 * Like the second look of adult owls: a chick gets the look that is rarest among the owner's
 * other chicks of its species when it moves in (hatched, arrived as a gift) and keeps it while it
 * stays; on a tie the lower one. Grown up, it shows its look as an adult owl (`lookFor`).
 */
export type ChickLook = 0 | 1 | 2;

export const CHICK_LOOKS: readonly ChickLook[] = [0, 1, 2];

export function chickLookFor(
  /** Other chicks of the same species with the standard, second and third chick picture. */
  counts: readonly [number, number, number],
): ChickLook {
  let best: ChickLook = 0;
  for (const look of CHICK_LOOKS) if (counts[look] < counts[best]) best = look;
  return best;
}

/** v1.5.0: a chick look from a stored or transmitted value (anything else: the standard one). */
export function asChickLook(value: unknown): ChickLook {
  return value === 1 || value === 2 ? value : 0;
}
