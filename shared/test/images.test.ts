import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OWL_IMAGE_KINDS, SCENE_IMAGES, SPECIES, owlImageFileName } from '../src/species.ts';

const IMAGES = path.resolve(import.meta.dirname, '../../images');

describe('owl images (SPEC 9.2.6, Anhang B)', () => {
  it('has all eleven images for every species and the scenes under the exact file names', () => {
    const files = new Set(fs.readdirSync(IMAGES));
    const expected = [
      ...SPECIES.flatMap((species) =>
        OWL_IMAGE_KINDS.map((kind) => owlImageFileName(species.imageName, kind.suffix)),
      ),
      ...SCENE_IMAGES.map((scene) => scene.file),
    ];
    expect(expected.filter((file) => !files.has(file))).toEqual([]);
    expect(files.size).toBe(SPECIES.length * OWL_IMAGE_KINDS.length + SCENE_IMAGES.length);
  });
});
