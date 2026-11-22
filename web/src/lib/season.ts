/**
 * v1.1: light and season at the player's (fictional) home right now (SPEC 9.2.6, 9.11): day or
 * night (sun higher than −6° = day) and whether it is the Christmas season there. v1.2.4:
 * without an account (start page, help) the device counts instead – the sun at the main city
 * of its time zone, Christmas and season by its calendar date.
 */
import { isDay } from '@posteulen/shared/game/sun.ts';
import {
  deskSeason,
  deskSeasonOfDate,
  isChristmas,
  isChristmasDate,
  rescueSeason,
  rescueSeasonOfDate,
  type DeskSeason,
  type LocalDate,
  type RescueSeason,
} from '@posteulen/shared/game/season.ts';
import { devicePlace } from '@posteulen/shared/map/zone-place.ts';
import type { OwlImageKind, SceneId } from '@posteulen/shared/species.ts';
import { account } from './auth.svelte.ts';

export interface HomeLight {
  readonly day: boolean;
  readonly christmas: boolean;
  /** v1.2.1: the season of the desk pictures on the letters page. */
  readonly season: DeskSeason;
  /** v1.3: the season of the rescue centre pictures (with early spring). */
  readonly rescueSeason: RescueSeason;
}

/** The time zone of the device (undefined if the browser does not tell). */
function deviceZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** v1.2.4: light and season by the clock, calendar and time zone of the device. */
export function deviceLight(at: number = Date.now()): HomeLight {
  const now = new Date(at);
  const place = devicePlace(deviceZone(), now.getTimezoneOffset());
  const date: LocalDate = {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
  return {
    day: isDay(at, place.lat, place.lon),
    christmas: isChristmasDate(date),
    season: deskSeasonOfDate(date),
    rescueSeason: rescueSeasonOfDate(date),
  };
}

export function homeLight(at: number = Date.now()): HomeLight {
  const home = account.profile?.home;
  if (!home) return deviceLight(at);
  return {
    day: isDay(at, home.lat, home.lon),
    christmas: isChristmas(at, home.lat, home.lon),
    season: deskSeason(at, home.lat, home.lon),
    rescueSeason: rescueSeason(at, home.lat, home.lon),
  };
}

/**
 * The standard picture of an owl for the light at home: by night the awake owl in the dark, in
 * the Christmas season the Christmas pictures by day, by night and napping. Other kinds (flight,
 * sleep on the way, chick, brooding …) stay as they are. v1.2: a grumpy owl looks grumpy in the
 * dark at night.
 */
export function standardKind(kind: OwlImageKind, light: HomeLight): OwlImageKind {
  if (kind === 'normal') {
    if (light.christmas) return light.day ? 'xmasDay' : 'xmasNight';
    return light.day ? 'normal' : 'night';
  }
  if (kind === 'napHome' && light.christmas) return 'xmasNap';
  if (kind === 'grumpy' && !light.day) return 'grumpyNight';
  // v1.3: a sick owl in the rescue centre at night.
  if (kind === 'sick' && !light.day) return 'sickNight';
  // v1.3.1: brooding on the eggs and healthy again in the dark.
  if (kind === 'brooding' && !light.day) return 'broodingNight';
  if (kind === 'healthy' && !light.day) return 'healthyNight';
  return kind;
}

/** The group picture for the light at home (start page and overview). */
export function groupScene(light: HomeLight): SceneId {
  if (light.christmas) return light.day ? 'groupXmasDay' : 'groupXmasNight';
  return light.day ? 'group' : 'groupNight';
}

/** v1.2.1: the desk picture on top of the letters page for the season and light at home. */
export function lettersScene(light: HomeLight): SceneId {
  const season = light.season.charAt(0).toUpperCase() + light.season.slice(1);
  return `letters${season}${light.day ? 'Day' : 'Night'}` as SceneId;
}

/** v1.3: the rescue centre from outside or inside for the season and light at home. */
export function rescueScene(light: HomeLight, inside: boolean): SceneId {
  const season = light.rescueSeason.charAt(0).toUpperCase() + light.rescueSeason.slice(1);
  return `rescue${inside ? 'Inside' : ''}${season}${light.day ? 'Day' : 'Night'}` as SceneId;
}
