import { describe, expect, it } from 'vitest';
import { dayPart, FALLBACK_ZONE, localTime, zoneAt } from '../src/map/timezone.ts';
import { TZ_HEIGHT, TZ_WIDTH, ZONE_ROWS, ZONES } from '../src/map/timezones-data.ts';

describe('time zone at the (fictional) home (v0.7, SPEC 8.3)', () => {
  it('knows the zone of each country of the section', () => {
    expect(zoneAt(52.52, 13.4)).toBe('Europe/Berlin');
    expect(zoneAt(38.72, -9.14)).toBe('Europe/Lisbon');
    expect(zoneAt(51.5, -0.12)).toBe('Europe/London');
    expect(zoneAt(53.35, -6.26)).toBe('Europe/Dublin');
    expect(zoneAt(37.98, 23.73)).toBe('Europe/Athens');
    expect(zoneAt(36.8, 10.18)).toBe('Africa/Tunis');
    expect(zoneAt(54.7, 20.5)).toBe('Europe/Kaliningrad');
  });

  it('gives coastal homes the zone of the nearest land; the fallback outside', () => {
    // Directly at the coast of Brittany (sea cells near land are filled).
    expect(zoneAt(48.38, -4.79)).toBe('Europe/Paris');
    expect(zoneAt(70, 10)).toBe(FALLBACK_ZONE);
    expect(zoneAt(50, -20)).toBe(FALLBACK_ZONE);
  });

  it('has a complete grid', () => {
    expect(ZONE_ROWS).toHaveLength(TZ_HEIGHT);
    for (const row of ZONE_ROWS) {
      const cells = [...row.matchAll(/[-A-Za-z](\d+)/g)].reduce((sum, m) => sum + Number(m[1]), 0);
      expect(cells).toBe(TZ_WIDTH);
    }
    expect(new Set(ZONES).size).toBe(ZONES.length);
  });

  it('uses the local time with summer time', () => {
    const summer = Date.UTC(2026, 6, 1, 4, 30);
    expect(localTime(summer, 'Europe/Berlin')).toEqual({ hour: 6, minute: 30 });
    expect(localTime(summer, 'Europe/Lisbon')).toEqual({ hour: 5, minute: 30 });
    const winter = Date.UTC(2026, 0, 1, 4, 30);
    expect(localTime(winter, 'Europe/Berlin')).toEqual({ hour: 5, minute: 30 });
    // An unknown zone falls back to the device's time instead of failing.
    const fallback = localTime(winter, 'Nowhere/Never');
    expect(fallback.hour).toBe(new Date(winter).getHours());
  });

  it('greets by the part of the day', () => {
    expect(dayPart(4)).toBe('night');
    expect(dayPart(5)).toBe('morning');
    expect(dayPart(10)).toBe('morning');
    expect(dayPart(11)).toBe('day');
    expect(dayPart(17)).toBe('day');
    expect(dayPart(18)).toBe('evening');
    expect(dayPart(21)).toBe('evening');
    expect(dayPart(22)).toBe('night');
  });
});
