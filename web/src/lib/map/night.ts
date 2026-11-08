/**
 * Night areas for the map (SPEC 12.1): where the sun is at −6° or lower. Computed in the
 * browser from the sun position, merged into runs per row: on a 0.5° grid around the European
 * section, v0.7 on a 1° grid for the rest of the world (the two areas do not overlap).
 */
import { isDay } from '@posteulen/shared/game/sun.ts';

export interface NightRun {
  readonly lat0: number;
  readonly lat1: number;
  readonly lon0: number;
  readonly lon1: number;
}

/** Slightly larger than the map section so the frame is covered (whole degrees). */
const AREA = { south: 30, north: 68, west: -32, east: 46 } as const;

function inArea(lat0: number, lat1: number, lon0: number, lon1: number): boolean {
  return lat0 >= AREA.south && lat1 <= AREA.north && lon0 >= AREA.west && lon1 <= AREA.east;
}

function runs(
  at: number,
  step: number,
  bounds: { south: number; north: number; west: number; east: number },
  skip: (lat0: number, lon0: number) => boolean,
  out: NightRun[],
): void {
  for (let lat0 = bounds.south; lat0 < bounds.north; lat0 += step) {
    let start: number | null = null;
    for (let lon0 = bounds.west; lon0 <= bounds.east; lon0 += step) {
      const night =
        lon0 < bounds.east && !skip(lat0, lon0) && !isDay(at, lat0 + step / 2, lon0 + step / 2);
      if (night && start === null) start = lon0;
      if (!night && start !== null) {
        out.push({ lat0, lat1: lat0 + step, lon0: start, lon1: lon0 });
        start = null;
      }
    }
  }
}

export function nightRuns(at: number, step = 0.5, world = true): NightRun[] {
  const out: NightRun[] = [];
  runs(at, step, AREA, () => false, out);
  if (world) {
    // The rest of the world, coarser; cells of the European area are left out.
    const coarse = 1;
    runs(
      at,
      coarse,
      { south: -90, north: 90, west: -170, east: 190 },
      (lat0, lon0) => inArea(lat0, lat0 + coarse, lon0, lon0 + coarse),
      out,
    );
  }
  return out;
}
