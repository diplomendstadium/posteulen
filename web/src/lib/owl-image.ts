import {
  OWL_IMAGES,
  OWL_PLACEHOLDER,
  SCENES,
  type OwlImageFiles,
} from '../generated/owl-images/manifest.ts';
import type { OwlImageKind, SceneId } from '@posteulen/shared/species.ts';

/**
 * v1.1: pictures that may be missing for a species fall back to their ordinary counterpart
 * (Christmas nap → nap at home, Christmas by day/night → night → normal) instead of the
 * placeholder.
 */
const FALLBACK: Partial<Record<OwlImageKind, OwlImageKind>> = {
  xmasNap: 'napHome',
  xmasDay: 'normal',
  xmasNight: 'night',
  night: 'normal',
  // v1.2: grumpy at night → the grumpy picture by day (the phoenix has none at night).
  grumpyNight: 'grumpy',
  // v1.3: pictures of the rescue centre – the ordinary counterpart if one is missing.
  sickNight: 'sick',
  sick: 'grumpy',
  medicine: 'feeding',
  healthy: 'normal',
  // v1.3.1: by night – the picture by day if one is missing.
  broodingNight: 'brooding',
  healthyNight: 'healthy',
  // v1.4: bored and flying off into freedom – by day if the night picture is missing.
  boredNight: 'bored',
  bored: 'grumpy',
  freeNight: 'free',
  free: 'flyingDay',
  // v1.4.2: the second look – by day if the night picture is missing, else the standard one.
  secondNight: 'second',
  second: 'normal',
};

export function owlImage(
  speciesId: string,
  kind: OwlImageKind,
): { files: OwlImageFiles; placeholder: boolean } {
  for (let current: OwlImageKind | undefined = kind; current; current = FALLBACK[current]) {
    const files = OWL_IMAGES[speciesId]?.[current];
    if (files) return { files, placeholder: false };
  }
  return { files: OWL_PLACEHOLDER, placeholder: true };
}

const SCENE_FALLBACK: Partial<Record<SceneId, SceneId>> = {
  groupNight: 'group',
  groupXmasDay: 'group',
  groupXmasNight: 'groupNight',
  menagerieXmasDay: 'menagerieDay',
  menagerieXmasNight: 'menagerieNight',
  postXmasDay: 'postDay',
  postXmasNight: 'postNight',
  // v1.2: inside the post office – a missing Christmas picture falls back to the ordinary one.
  postInsideAXmasDay: 'postInsideADay',
  postInsideAXmasNight: 'postInsideANight',
  postInsideBXmasDay: 'postInsideBDay',
  postInsideBXmasNight: 'postInsideBNight',
  postInsideCXmasDay: 'postInsideCDay',
  postInsideCXmasNight: 'postInsideCNight',
  postInsideDXmasDay: 'postInsideDDay',
  postInsideDXmasNight: 'postInsideDNight',
  // v1.2.1: inside the Menagerie likewise.
  menagerieInsideXmasDay: 'menagerieInsideDay',
  menagerieInsideXmasNight: 'menagerieInsideNight',
};

/** Pictures without a species (empty perch, group picture); the placeholder if missing. */
export function sceneImage(id: SceneId): {
  files: Readonly<Record<string, string>>;
  placeholder: boolean;
} {
  // v1.1: a missing season or night picture falls back to the ordinary one.
  const files = SCENES[id] ?? SCENES[SCENE_FALLBACK[id] ?? id];
  return files
    ? { files, placeholder: false }
    : { files: { s160: OWL_PLACEHOLDER.s160, s480: OWL_PLACEHOLDER.s480 }, placeholder: true };
}
