import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OWL_IMAGE_KINDS, SPECIES, owlImageFileName } from '../src/species.ts';

const IMAGES = path.resolve(import.meta.dirname, '../../images');

describe('owl images (SPEC 9.2.6, Anhang B)', () => {
  it('has all seven images for every species under the exact file names', () => {
    const files = new Set(fs.readdirSync(IMAGES));
    const missing = SPECIES.flatMap((species) =>
      OWL_IMAGE_KINDS.map((kind) => owlImageFileName(species.imageName, kind.suffix)),
    ).filter((file) => !files.has(file));
    expect(missing).toEqual([]);
    expect(files.size).toBe(SPECIES.length * OWL_IMAGE_KINDS.length);
  });
});
