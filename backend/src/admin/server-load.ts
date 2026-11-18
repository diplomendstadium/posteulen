/**
 * v1.2.1: the server dashboard of the admin panel (SPEC 13 item 13) – rough values, cheap to get.
 *
 * - CPU and RAM: `posteulen-stats.timer` (its own unit, so the main service stays hardened with
 *   `ProcSubset=pid`) appends a line every 10 minutes to `server-load` in the data directory:
 *   `<unix seconds> <cpu total> <cpu idle> <ram total kB> <ram available kB>`. CPU counters are
 *   cumulative over all cores since boot; the average load is the busy share of all counter
 *   increases within the last 7 days (a reboot resets the counters – that pair is skipped). RAM
 *   is the mean of the used share (total minus available) of all measurements.
 * - Disk: the partition of the data directory right now, counted like `df` (used of used plus
 *   available to normal users).
 *
 * Without measurements (local preview, a fresh server) CPU and RAM are `null`.
 */
import fs from 'node:fs';
import { SERVER_LOAD, TIME } from '@posteulen/shared/constants.ts';

export interface LoadSample {
  /** Milliseconds. */
  readonly at: number;
  readonly cpuTotal: number;
  readonly cpuIdle: number;
  readonly memTotal: number;
  readonly memAvailable: number;
}

export interface ServerLoad {
  /** Average CPU load in per cent over the window, `null` without two usable measurements. */
  readonly cpu: number | null;
  /** Average RAM use in per cent over the window, `null` without measurements. */
  readonly ram: number | null;
  /** Used share of the partition with the game data in per cent, `null` if unknown. */
  readonly disk: number | null;
  /** First measurement in the window (ms) – before 7 days of measurements the average is shorter. */
  readonly since: number | null;
  /** Latest measurement (ms). */
  readonly measuredAt: number | null;
}

/** Lines of the measurement file; anything malformed is skipped. */
export function parseSamples(text: string): LoadSample[] {
  const samples: LoadSample[] = [];
  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 5 || !parts.every((part) => /^\d{1,20}$/.test(part))) continue;
    const [at, cpuTotal, cpuIdle, memTotal, memAvailable] = parts.map(Number) as [
      number,
      number,
      number,
      number,
      number,
    ];
    if (![at, cpuTotal, cpuIdle, memTotal, memAvailable].every(Number.isSafeInteger)) continue;
    // Unix seconds in the file, milliseconds everywhere else.
    samples.push({ at: at * 1000, cpuTotal, cpuIdle, memTotal, memAvailable });
  }
  return samples.sort((a, b) => a.at - b.at);
}

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** CPU and RAM averages of the measurements within the window ending at `now`. */
export function averageLoad(
  samples: readonly LoadSample[],
  now: number,
): Pick<ServerLoad, 'cpu' | 'ram' | 'since' | 'measuredAt'> {
  const from = now - SERVER_LOAD.WINDOW_DAYS * TIME.DAY;
  const recent = samples.filter((sample) => sample.at >= from && sample.at <= now);
  let busy = 0;
  let total = 0;
  for (let index = 1; index < recent.length; index++) {
    const before = recent[index - 1];
    const after = recent[index];
    if (!before || !after) continue;
    const deltaTotal = after.cpuTotal - before.cpuTotal;
    const deltaIdle = after.cpuIdle - before.cpuIdle;
    // A reboot in between resets the counters: that interval is skipped.
    if (deltaTotal <= 0 || deltaIdle < 0 || deltaIdle > deltaTotal) continue;
    busy += deltaTotal - deltaIdle;
    total += deltaTotal;
  }
  const memory = recent.filter((sample) => sample.memTotal > 0);
  const ram =
    memory.length === 0
      ? null
      : memory.reduce(
          (sum, sample) =>
            sum +
            (sample.memTotal - Math.min(sample.memAvailable, sample.memTotal)) / sample.memTotal,
          0,
        ) / memory.length;
  return {
    cpu: total > 0 ? clampPercent((busy / total) * 100) : null,
    ram: ram === null ? null : clampPercent(ram * 100),
    since: recent[0]?.at ?? null,
    measuredAt: recent.at(-1)?.at ?? null,
  };
}

/** Used share of a partition like `df`: used / (used + available to normal users). */
export function diskPercent(stats: {
  readonly blocks: number;
  readonly bfree: number;
  readonly bavail: number;
}): number | null {
  const used = stats.blocks - stats.bfree;
  const usable = used + stats.bavail;
  return usable > 0 && used >= 0 ? clampPercent((used / usable) * 100) : null;
}

function readSamples(file: string): LoadSample[] {
  try {
    const handle = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(handle).size;
      const length = Math.min(size, SERVER_LOAD.MAX_FILE_BYTES);
      const buffer = Buffer.alloc(length);
      // The newest lines are at the end.
      fs.readSync(handle, buffer, 0, length, size - length);
      return parseSamples(buffer.toString('utf8'));
    } finally {
      fs.closeSync(handle);
    }
  } catch {
    // No measurements yet (local preview, timer not run yet).
    return [];
  }
}

function readDisk(dataDir: string): number | null {
  try {
    return diskPercent(fs.statfsSync(dataDir));
  } catch {
    return null;
  }
}

export function serverLoad(file: string, dataDir: string, now: number): ServerLoad {
  return { ...averageLoad(readSamples(file), now), disk: readDisk(dataDir) };
}
