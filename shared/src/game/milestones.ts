/**
 * v1.5.0: milestones of the letters between people on an instance (SPEC 11.1, Anhang C) –
 * 1,000, 5,000, 10,000, 50,000, 100,000 and 1,000,000, after that every further 500,000.
 */
import { LETTER_MILESTONES } from '../constants.ts';

/** The first milestone above `after` (0: the very first one). */
export function nextMilestone(after: number): number {
  const fixed = LETTER_MILESTONES.FIRST.find((mark) => mark > after);
  if (fixed !== undefined) return fixed;
  const last = LETTER_MILESTONES.FIRST.at(-1) ?? 0;
  const steps = Math.floor((after - last) / LETTER_MILESTONES.EVERY_AFTER) + 1;
  return last + steps * LETTER_MILESTONES.EVERY_AFTER;
}

/** The highest milestone reached with `total` letters, or null below the first one. */
export function reachedMilestone(total: number): number | null {
  let reached: number | null = null;
  for (let mark = nextMilestone(0); mark <= total; mark = nextMilestone(mark)) reached = mark;
  return reached;
}
