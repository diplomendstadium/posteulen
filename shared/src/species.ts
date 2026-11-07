/** Owl species, SPEC Anhang B (17 species with images for v0.1). Prices in whole gold, energy in points. */
export interface Species {
  readonly id: string;
  /** German display name. */
  readonly name: string;
  /** English display name (v0.4). */
  readonly nameEn: string;
  /** Base name of the image files (SPEC Anhang B). */
  readonly imageName: string;
  readonly price: number;
  readonly maxEnergy: number;
  readonly speedFactor: number;
  readonly recoveryFactor: number;
}

// prettier-ignore
export const SPECIES: readonly Species[] = [
  { id: 'bartkauz', name: 'Bartkauz', nameEn: 'Great Grey Owl', imageName: 'Bartkauz', price: 19, maxEnergy: 760, speedFactor: 0.9, recoveryFactor: 0.85 },
  { id: 'brillenkauz', name: 'Brillenkauz', nameEn: 'Spectacled Owl', imageName: 'Brillenkauz', price: 34, maxEnergy: 640, speedFactor: 1.15, recoveryFactor: 1.15 },
  { id: 'elfenkauz', name: 'Elfenkauz', nameEn: 'Elf Owl', imageName: 'Elfenkauz', price: 40, maxEnergy: 100, speedFactor: 1.65, recoveryFactor: 2.0 },
  { id: 'haubenkauz', name: 'Haubenkauz', nameEn: 'Crested Owl', imageName: 'Haubenkauz', price: 48, maxEnergy: 540, speedFactor: 1.2, recoveryFactor: 1.2 },
  { id: 'kanincheneule', name: 'Kanincheneule', nameEn: 'Burrowing Owl', imageName: 'Kanincheneule', price: 29, maxEnergy: 350, speedFactor: 1.7, recoveryFactor: 1.7 },
  { id: 'maehnenkauz', name: 'Mähnenkauz', nameEn: 'Maned Owl', imageName: 'Maehnenkauz', price: 49, maxEnergy: 330, speedFactor: 1.1, recoveryFactor: 1.5 },
  { id: 'maskeneule', name: 'Maskeneule', nameEn: 'Oriental Bay Owl', imageName: 'Maskeneule', price: 45, maxEnergy: 340, speedFactor: 1.35, recoveryFactor: 1.5 },
  { id: 'milchuhu', name: 'Milchuhu', nameEn: 'Verreaux\'s Eagle-Owl', imageName: 'Milchuhu', price: 35, maxEnergy: 1080, speedFactor: 0.9, recoveryFactor: 0.6 },
  { id: 'riesenfischuhu', name: 'Riesenfischuhu', nameEn: 'Blakiston\'s Fish Owl', imageName: 'Riesenfischuhu', price: 50, maxEnergy: 1200, speedFactor: 0.7, recoveryFactor: 0.5 },
  { id: 'riesenkauz', name: 'Riesenkauz', nameEn: 'Powerful Owl', imageName: 'Riesenkauz', price: 44, maxEnergy: 900, speedFactor: 1.8, recoveryFactor: 0.9 },
  { id: 'schleiereule', name: 'Schleiereule', nameEn: 'Barn Owl', imageName: 'Schleiereule', price: 7, maxEnergy: 380, speedFactor: 1.45, recoveryFactor: 1.5 },
  { id: 'schneeeule', name: 'Schneeeule', nameEn: 'Snowy Owl', imageName: 'Schneeeule', price: 24, maxEnergy: 990, speedFactor: 1.75, recoveryFactor: 0.85 },
  { id: 'sperbereule', name: 'Sperbereule', nameEn: 'Northern Hawk Owl', imageName: 'Sperbereule', price: 22, maxEnergy: 440, speedFactor: 2.0, recoveryFactor: 1.4 },
  { id: 'sumpfohreule', name: 'Sumpfohreule', nameEn: 'Short-eared Owl', imageName: 'Sumpfohreule', price: 16, maxEnergy: 430, speedFactor: 1.35, recoveryFactor: 1.4 },
  { id: 'suedliche-weissgesichtseule', name: 'Südliche Weißgesichtseule', nameEn: 'Southern White-faced Owl', imageName: 'Suedliche-Weissgesichtseule', price: 32, maxEnergy: 300, speedFactor: 1.3, recoveryFactor: 1.65 },
  { id: 'waldkauz', name: 'Waldkauz', nameEn: 'Tawny Owl', imageName: 'Waldkauz', price: 6, maxEnergy: 540, speedFactor: 1.1, recoveryFactor: 1.25 },
  { id: 'waldohreule', name: 'Waldohreule', nameEn: 'Long-eared Owl', imageName: 'Waldohreule', price: 8, maxEnergy: 410, speedFactor: 1.35, recoveryFactor: 1.45 },
];

/**
 * The eleven image kinds per species (SPEC 9.2.6, Anhang B). Empty suffix = normal image.
 * v0.3: in flight by day/night (owl list) and back home by day/night (system message).
 */
export const OWL_IMAGE_KINDS = [
  { kind: 'normal', suffix: '' },
  { kind: 'departure', suffix: 'Abflug' },
  { kind: 'arrival', suffix: 'Ankunft' },
  { kind: 'feeding', suffix: 'Fuettern' },
  { kind: 'petting', suffix: 'Streicheln' },
  { kind: 'grumpy', suffix: 'Grummelig' },
  { kind: 'chick', suffix: 'Kueken' },
  { kind: 'flyingDay', suffix: 'Tagflug' },
  { kind: 'flyingNight', suffix: 'Nachtflug' },
  { kind: 'homeDay', suffix: 'Heimkehr-Tag' },
  { kind: 'homeNight', suffix: 'Heimkehr-Nacht' },
] as const;

/** Pictures without a species (SPEC Anhang B): empty perch and the group picture. */
export const SCENE_IMAGES = [
  { id: 'perch', file: 'Leere-Stange.png', sizes: [160, 480] },
  { id: 'group', file: 'Gruppenbild.png', sizes: [480, 960] },
] as const;

export type SceneId = (typeof SCENE_IMAGES)[number]['id'];

/** Display name of a species in the given language. */
export function speciesName(id: string, language: 'de' | 'en' = 'de'): string {
  const species = SPECIES.find((candidate) => candidate.id === id);
  if (!species) return id;
  return language === 'en' ? species.nameEn : species.name;
}

export type OwlImageKind = (typeof OWL_IMAGE_KINDS)[number]['kind'];

/** Expected file name of an original image, e.g. `Waldkauz-Abflug.png`. */
export function owlImageFileName(imageName: string, suffix: string): string {
  return suffix === '' ? `${imageName}.png` : `${imageName}-${suffix}.png`;
}
