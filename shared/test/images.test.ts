import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageKindsOf, SCENE_IMAGES, SPECIES, owlImageFileName } from '../src/species.ts';

const IMAGES = path.resolve(import.meta.dirname, '../../images');

describe('owl images (SPEC 9.2.6, Anhang B)', () => {
  it('has all images for every species (13, the phoenix 12) and the scenes under the exact file names', () => {
    const files = new Set(fs.readdirSync(IMAGES));
    const expected = [
      ...SPECIES.flatMap((species) =>
        imageKindsOf(species).map((kind) => owlImageFileName(species.imageName, kind.suffix)),
      ),
      ...SCENE_IMAGES.map((scene) => scene.file),
    ];
    expect(expected.filter((file) => !files.has(file))).toEqual([]);
    expect(files.size).toBe(expected.length);
  });
});
