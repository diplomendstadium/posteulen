/**
 * v1.1: light and season at the player's (fictional) home right now (SPEC 9.2.6, 9.11): day or
 * night (sun higher than −6° = day) and whether it is the Christmas season there. Without an
 * account (start page) the fictional home Berlin counts.
 */
import { isDay } from '@posteulen/shared/game/sun.ts';
import { deskSeason, isChristmas, type DeskSeason } from '@posteulen/shared/game/season.ts';
import type { OwlImageKind, SceneId } from '@posteulen/shared/species.ts';
import { account } from './auth.svelte.ts';

/** The fictional home for visitors who are not signed in. */
export const BERLIN = { lat: 52.52, lon: 13.4 } as const;

export interface HomeLight {
  readonly day: boolean;
  readonly christmas: boolean;
  /** v1.2.1: the season of the desk pictures on the letters page. */
  readonly season: DeskSeason;
}

export function homeLight(at: number = Date.now()): HomeLight {
  const home = account.profile?.home ?? BERLIN;
  return {
    day: isDay(at, home.lat, home.lon),
    christmas: isChristmas(at, home.lat, home.lon),
    season: deskSeason(at, home.lat, home.lon),
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
