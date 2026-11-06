import {
  OWL_IMAGES,
  OWL_PLACEHOLDER,
  SCENES,
  type OwlImageFiles,
} from '../generated/owl-images/manifest.ts';
import type { OwlImageKind, SceneId } from '@posteulen/shared/species.ts';

export function owlImage(
  speciesId: string,
  kind: OwlImageKind,
): { files: OwlImageFiles; placeholder: boolean } {
  const files = OWL_IMAGES[speciesId]?.[kind];
  return files ? { files, placeholder: false } : { files: OWL_PLACEHOLDER, placeholder: true };
}

/** Pictures without a species (empty perch, group picture); the placeholder if missing. */
export function sceneImage(id: SceneId): {
  files: Readonly<Record<string, string>>;
  placeholder: boolean;
} {
  const files = SCENES[id];
  return files
    ? { files, placeholder: false }
    : { files: { s160: OWL_PLACEHOLDER.s160, s480: OWL_PLACEHOLDER.s480 }, placeholder: true };
}
