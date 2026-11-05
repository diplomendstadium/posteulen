import {
  OWL_IMAGES,
  OWL_PLACEHOLDER,
  type OwlImageFiles,
} from '../generated/owl-images/manifest.ts';
import type { OwlImageKind } from '@posteulen/shared/species.ts';

export function owlImage(
  speciesId: string,
  kind: OwlImageKind,
): { files: OwlImageFiles; placeholder: boolean } {
  const files = OWL_IMAGES[speciesId]?.[kind];
  return files ? { files, placeholder: false } : { files: OWL_PLACEHOLDER, placeholder: true };
}
