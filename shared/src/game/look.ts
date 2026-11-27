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
