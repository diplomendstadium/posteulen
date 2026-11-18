/**
 * Pictures of the places (SPEC 9.2.6, 9.11): which scene and which description fit the light
 * and the season at home. Used on top of the place pages (PlaceImage) and in the info text of
 * the start page (AboutText).
 */
import type { LoanTeam, SceneId } from '@posteulen/shared/species.ts';
import { t, fill } from './i18n.svelte.ts';
import { lettersScene, type HomeLight } from './season.ts';

export type Place = 'menagerie' | 'menagerieInside' | 'post' | 'postInside' | 'letters';

export function placeScene(place: Place, light: HomeLight, team: LoanTeam = 'A'): SceneId {
  if (place === 'letters') return lettersScene(light);
  return `${place}${place === 'postInside' ? team : ''}${light.christmas ? 'Xmas' : ''}${light.day ? 'Day' : 'Night'}` as SceneId;
}

export function placeAlt(place: Place, light: HomeLight): string {
  const { day, christmas } = light;
  if (place === 'letters') {
    const view =
      t.letters[
        `desk_${light.season}_${day ? 'day' : 'night'}` as `desk_${typeof light.season}_${'day' | 'night'}`
      ];
    return fill(t.letters.picture, { view });
  }
  if (place === 'menagerieInside') {
    if (christmas) return day ? t.menagerie.insideChristmasDay : t.menagerie.insideChristmasNight;
    return day ? t.menagerie.insideDay : t.menagerie.insideNight;
  }
  if (place === 'postInside') {
    if (christmas) return day ? t.post.insideChristmasDay : t.post.insideChristmasNight;
    return day ? t.post.insideDay : t.post.insideNight;
  }
  if (place === 'menagerie') {
    if (christmas) return day ? t.menagerie.pictureChristmasDay : t.menagerie.pictureChristmasNight;
    return day ? t.menagerie.pictureDay : t.menagerie.pictureNight;
  }
  if (christmas) return day ? t.post.pictureChristmasDay : t.post.pictureChristmasNight;
  return day ? t.post.pictureDay : t.post.pictureNight;
}

/** The description of the group picture (start page). */
export function groupAlt(light: HomeLight): string {
  if (light.christmas)
    return light.day ? t.start.groupAltChristmasDay : t.start.groupAltChristmasNight;
  return light.day ? t.start.groupAlt : t.start.groupAltNight;
}
