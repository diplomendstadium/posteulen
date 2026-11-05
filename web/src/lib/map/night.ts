/**
 * Night areas for the map (SPEC 12.1): where the sun is at −6° or lower. Computed in the
 * browser from the sun position on a 0.5° grid, merged into runs per row.
 */
import { isDay } from '@posteulen/shared/game/sun.ts';

export interface NightRun {
  readonly lat0: number;
  readonly lat1: number;
  readonly lon0: number;
  readonly lon1: number;
}

/** Slightly larger than the map section so the frame is covered. */
const AREA = { south: 33, north: 64, west: -16, east: 30 } as const;

export function nightRuns(at: number, step = 0.5): NightRun[] {
  const runs: NightRun[] = [];
  for (let lat0 = AREA.south; lat0 < AREA.north; lat0 += step) {
    let start: number | null = null;
    for (let lon0 = AREA.west; lon0 <= AREA.east; lon0 += step) {
      const night = lon0 < AREA.east && !isDay(at, lat0 + step / 2, lon0 + step / 2);
      if (night && start === null) start = lon0;
      if (!night && start !== null) {
        runs.push({ lat0, lat1: lat0 + step, lon0: start, lon1: lon0 });
        start = null;
      }
    }
  }
  return runs;
}
