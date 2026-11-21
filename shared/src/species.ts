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
  /**
   * v0.5: a mythical creature (the phoenix): never offered as a loan owl, lays no eggs, is never
   * lent to the Menagerie, never carries bot letters and has no chick picture.
   */
  readonly mythical?: true;
  /** v0.8.4: not for sale in the Menagerie (v0.10: no species is any more). */
  readonly notForSale?: true;
  /** v0.8.4: a special species bots may use anyway (own bot owl, gift of an event). */
  readonly forBots?: true;
  /**
   * v0.10: what the owl can carry (SPEC 9.2.1): `short` only the short parchment, `long` short
   * and long parchment, `gold` both parchments and gold. Applies to the owls of players (own,
   * loan and visiting owls), not to the owls of bots.
   */
  readonly cargo: Cargo;
}

/** v0.10: carrying capacity of a species, from small to large. */
export type Cargo = 'short' | 'long' | 'gold';

// prettier-ignore
export const SPECIES: readonly Species[] = [
  { id: 'bartkauz', name: 'Bartkauz', nameEn: 'Great Grey Owl', imageName: 'Bartkauz', price: 12, maxEnergy: 760, speedFactor: 0.9, recoveryFactor: 0.85, cargo: 'gold' },
  { id: 'brillenkauz', name: 'Brillenkauz', nameEn: 'Spectacled Owl', imageName: 'Brillenkauz', price: 34, maxEnergy: 640, speedFactor: 1.15, recoveryFactor: 1.15, cargo: 'gold' },
  { id: 'elfenkauz', name: 'Elfenkauz', nameEn: 'Elf Owl', imageName: 'Elfenkauz', price: 40, maxEnergy: 100, speedFactor: 1.65, recoveryFactor: 2.0, cargo: 'short' },
  { id: 'haubenkauz', name: 'Haubenkauz', nameEn: 'Crested Owl', imageName: 'Haubenkauz', price: 48, maxEnergy: 540, speedFactor: 1.2, recoveryFactor: 1.2, cargo: 'long' },
  { id: 'kanincheneule', name: 'Kanincheneule', nameEn: 'Burrowing Owl', imageName: 'Kanincheneule', price: 29, maxEnergy: 350, speedFactor: 1.7, recoveryFactor: 1.7, cargo: 'short' },
  { id: 'maehnenkauz', name: 'Mähnenkauz', nameEn: 'Maned Owl', imageName: 'Maehnenkauz', price: 49, maxEnergy: 330, speedFactor: 1.1, recoveryFactor: 1.5, cargo: 'short' },
  { id: 'maskeneule', name: 'Maskeneule', nameEn: 'Oriental Bay Owl', imageName: 'Maskeneule', price: 45, maxEnergy: 340, speedFactor: 1.35, recoveryFactor: 1.5, cargo: 'long' },
  { id: 'milchuhu', name: 'Milchuhu', nameEn: 'Verreaux\'s Eagle-Owl', imageName: 'Milchuhu', price: 35, maxEnergy: 1080, speedFactor: 0.9, recoveryFactor: 0.6, cargo: 'gold' },
  { id: 'riesenfischuhu', name: 'Riesenfischuhu', nameEn: 'Blakiston\'s Fish Owl', imageName: 'Riesenfischuhu', price: 50, maxEnergy: 1200, speedFactor: 0.7, recoveryFactor: 0.5, cargo: 'gold' },
  { id: 'riesenkauz', name: 'Riesenkauz', nameEn: 'Powerful Owl', imageName: 'Riesenkauz', price: 44, maxEnergy: 900, speedFactor: 1.8, recoveryFactor: 0.9, cargo: 'gold' },
  { id: 'schleiereule', name: 'Schleiereule', nameEn: 'Barn Owl', imageName: 'Schleiereule', price: 7, maxEnergy: 380, speedFactor: 1.3, recoveryFactor: 1.3, cargo: 'short' },
  { id: 'schneeeule', name: 'Schneeeule', nameEn: 'Snowy Owl', imageName: 'Schneeeule', price: 24, maxEnergy: 990, speedFactor: 1.75, recoveryFactor: 0.85, cargo: 'gold' },
  { id: 'sperbereule', name: 'Sperbereule', nameEn: 'Northern Hawk Owl', imageName: 'Sperbereule', price: 22, maxEnergy: 440, speedFactor: 2.0, recoveryFactor: 1.2, cargo: 'gold' },
  { id: 'sumpfohreule', name: 'Sumpfohreule', nameEn: 'Short-eared Owl', imageName: 'Sumpfohreule', price: 10, maxEnergy: 430, speedFactor: 1.35, recoveryFactor: 1.4, cargo: 'long' },
  { id: 'suedliche-weissgesichtseule', name: 'Südliche Weißgesichtseule', nameEn: 'Southern White-faced Owl', imageName: 'Suedliche-Weissgesichtseule', price: 32, maxEnergy: 300, speedFactor: 1.3, recoveryFactor: 1.65, cargo: 'short' },
  { id: 'waldkauz', name: 'Waldkauz', nameEn: 'Tawny Owl', imageName: 'Waldkauz', price: 6, maxEnergy: 430, speedFactor: 1, recoveryFactor: 0.9, cargo: 'long' },
  { id: 'phoenix', name: 'Phönix', nameEn: 'Phoenix', imageName: 'Phoenix', price: 150, maxEnergy: 2000, speedFactor: 4, recoveryFactor: 2, mythical: true, cargo: 'gold' },
  { id: 'virginiauhu', name: 'Virginiauhu', nameEn: 'Great Horned Owl', imageName: 'Virginiauhu', price: 68, maxEnergy: 1300, speedFactor: 2.6, recoveryFactor: 2, cargo: 'gold' },
  { id: 'waldohreule', name: 'Waldohreule', nameEn: 'Long-eared Owl', imageName: 'Waldohreule', price: 8, maxEnergy: 410, speedFactor: 1.35, recoveryFactor: 1.45, cargo: 'short' },
  // v1.1: 47 km/h, 30 %/h; 36 km/h, 19 %/h (25 km/h and 10 %/h × factor).
  { id: 'ostkreischeule', name: 'Ostkreischeule', nameEn: 'Eastern Screech Owl', imageName: 'Ostkreischeule', price: 47, maxEnergy: 299, speedFactor: 1.88, recoveryFactor: 3.0, cargo: 'short' },
  { id: 'zypernzwergohreule', name: 'Zypern-Zwergohreule', nameEn: 'Cyprus Scops Owl', imageName: 'Zypernzwergohreule', price: 15, maxEnergy: 130, speedFactor: 1.44, recoveryFactor: 1.9, cargo: 'short' },
];

/** The cheapest species to buy (tip in the help, v0.6). */
export const CHEAPEST_SPECIES: Species = SPECIES.reduce((a, b) => (b.price < a.price ? b : a));

/**
 * The image kinds per species (SPEC 9.2.6, Anhang B). Empty suffix = normal image.
 * v0.3: in flight by day/night (owl list) and back home by day/night (system message).
 * v0.5: drinking water and the favourite treat (13 kinds; the phoenix has no chick picture).
 * v0.5.1: asleep on the way at night / by day, and a nap at home by day (16 kinds).
 * v0.7: brooding on its eggs (17 kinds; the phoenix lays no eggs and has 15).
 * v1.1: awake at night (shown instead of the normal picture while it is dark at the viewer's
 * home) and the three Christmas pictures by day, by night and napping.
 * v1.2: grumpy at night (shown instead of the grumpy picture while it is dark at the viewer's
 * home; 22 kinds, phoenix 20).
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
  { kind: 'drinking', suffix: 'Trinken' },
  { kind: 'snack', suffix: 'Leckerli' },
  { kind: 'sleepNight', suffix: 'Nachtpause' },
  { kind: 'sleepDay', suffix: 'Tagschlaf-Unterwegs' },
  { kind: 'napHome', suffix: 'Tagschlaf-Zuhause' },
  { kind: 'brooding', suffix: 'Brueten' },
  { kind: 'night', suffix: 'Nacht' },
  { kind: 'xmasDay', suffix: 'Weihnachten-Tag' },
  { kind: 'xmasNight', suffix: 'Weihnachten-Nacht' },
  { kind: 'xmasNap', suffix: 'Weihnachten-Schlaf' },
  { kind: 'grumpyNight', suffix: 'Grummelig-Nacht' },
  // v1.3: the rescue centre (SPEC 8.13) – sick by day and by night, getting medicine, healthy
  // again (26 kinds; the phoenix never falls ill and has 20).
  { kind: 'sick', suffix: 'Krank' },
  { kind: 'sickNight', suffix: 'Krank-Nacht' },
  { kind: 'medicine', suffix: 'Medizin' },
  { kind: 'healthy', suffix: 'Gesund' },
] as const;

/** Picture kinds a mythical species does not have: no eggs, no chicks, never sick. */
const NOT_MYTHICAL: readonly string[] = [
  'chick',
  'brooding',
  'sick',
  'sickNight',
  'medicine',
  'healthy',
];

/** The image kinds a species has (no chick or brooding picture for mythical species). */
export function imageKindsOf(species: Pick<Species, 'mythical'>): readonly OwlImageKindEntry[] {
  return species.mythical
    ? OWL_IMAGE_KINDS.filter((entry) => !NOT_MYTHICAL.includes(entry.kind))
    : OWL_IMAGE_KINDS;
}

type OwlImageKindEntry = (typeof OWL_IMAGE_KINDS)[number];

/**
 * Pictures without a species (SPEC Anhang B): empty perch, the group picture and (v0.7) the
 * letters burning in the fireplace.
 */
export const SCENE_IMAGES = [
  { id: 'perch', file: 'Leere-Stange.png', sizes: [160, 480, 960] },
  { id: 'group', file: 'Gruppenbild.png', sizes: [480, 960] },
  { id: 'burn', file: 'Verbrennen.png', sizes: [480, 960] },
  // v0.10: pictures of the places on top of Menagerie and post office, by day and by night.
  { id: 'menagerieDay', file: 'Menagerie-Tag.png', sizes: [480, 960] },
  { id: 'menagerieNight', file: 'Menagerie-Nacht.png', sizes: [480, 960] },
  { id: 'postDay', file: 'Postamt-Tag.png', sizes: [480, 960] },
  { id: 'postNight', file: 'Postamt-Nacht.png', sizes: [480, 960] },
  // v1.1: the group picture by night, Christmas pictures of the group and the places (SPEC
  // 9.2.6) and the picture on top of the letters page.
  { id: 'groupNight', file: 'Gruppenbild-Nacht.png', sizes: [480, 960] },
  { id: 'groupXmasDay', file: 'Gruppenbild-Weihnachten-Tag.png', sizes: [480, 960] },
  { id: 'groupXmasNight', file: 'Gruppenbild-Weihnachten-Nacht.png', sizes: [480, 960] },
  { id: 'menagerieXmasDay', file: 'Menagerie-Weihnachten-Tag.png', sizes: [480, 960] },
  { id: 'menagerieXmasNight', file: 'Menagerie-Weihnachten-Nacht.png', sizes: [480, 960] },
  { id: 'postXmasDay', file: 'Postamt-Weihnachten-Tag.png', sizes: [480, 960] },
  { id: 'postXmasNight', file: 'Postamt-Weihnachten-Nacht.png', sizes: [480, 960] },
  // v1.2: inside the post office – one picture per team of the day, by day and by night, and in
  // the Christmas season (SPEC 8.6, 9.6).
  ...(['A', 'B', 'C', 'D'] as const).flatMap(
    (team) =>
      [
        { id: `postInside${team}Day`, file: `Postamt-Team-${team}-Tag.png`, sizes: [480, 960] },
        { id: `postInside${team}Night`, file: `Postamt-Team-${team}-Nacht.png`, sizes: [480, 960] },
        {
          id: `postInside${team}XmasDay`,
          file: `Postamt-Team-${team}-Weihnachten-Tag.png`,
          sizes: [480, 960],
        },
        {
          id: `postInside${team}XmasNight`,
          file: `Postamt-Team-${team}-Weihnachten-Nacht.png`,
          sizes: [480, 960],
        },
      ] as const,
  ),
  // v1.2.1: inside the Menagerie, by day and by night and in the Christmas season (SPEC 8.7).
  { id: 'menagerieInsideDay', file: 'Menagerie-Innen-Tag.png', sizes: [480, 960] },
  { id: 'menagerieInsideNight', file: 'Menagerie-Innen-Nacht.png', sizes: [480, 960] },
  { id: 'menagerieInsideXmasDay', file: 'Menagerie-Innen-Weihnachten-Tag.png', sizes: [480, 960] },
  {
    id: 'menagerieInsideXmasNight',
    file: 'Menagerie-Innen-Weihnachten-Nacht.png',
    sizes: [480, 960],
  },
  // v1.2.1: the desk on top of the letters page – one picture per season (DeskSeason), by day
  // and by night (SPEC 9.11).
  ...(
    [
      ['Christmas', 'Weihnachten'],
      ['Winter', 'Winter'],
      ['Spring', 'Fruehling'],
      ['Summer', 'Sommer'],
      ['Autumn', 'Herbst'],
      ['November', 'November'],
    ] as const
  ).flatMap(
    ([season, file]) =>
      [
        { id: `letters${season}Day`, file: `Schreibtisch-${file}-Tag.png`, sizes: [480, 960] },
        { id: `letters${season}Night`, file: `Schreibtisch-${file}-Nacht.png`, sizes: [480, 960] },
      ] as const,
  ),
  // v1.3: the rescue centre from outside and inside – one picture per season (RescueSeason: the
  // desk seasons plus early spring), by day and by night (SPEC 8.13, 9.11).
  ...(
    [
      ['Christmas', 'Weihnachten'],
      ['Winter', 'Winter'],
      ['EarlySpring', 'Vorfruehling'],
      ['Spring', 'Fruehling'],
      ['Summer', 'Sommer'],
      ['Autumn', 'Herbst'],
      ['November', 'November'],
    ] as const
  ).flatMap(
    ([season, file]) =>
      [
        { id: `rescue${season}Day`, file: `Rettungsstation-${file}-Tag.png`, sizes: [480, 960] },
        {
          id: `rescue${season}Night`,
          file: `Rettungsstation-${file}-Nacht.png`,
          sizes: [480, 960],
        },
        {
          id: `rescueInside${season}Day`,
          file: `Rettungsstation-Innen-${file}-Tag.png`,
          sizes: [480, 960],
        },
        {
          id: `rescueInside${season}Night`,
          file: `Rettungsstation-Innen-${file}-Nacht.png`,
          sizes: [480, 960],
        },
      ] as const,
  ),
] as const;

/**
 * v1.1: the four teams of the post office (SPEC 9.6). Each account gets one whole team as its
 * loan offer of a day, never the team of its day before. A new species joins the smallest team
 * (drawn by lot between equally small ones) unless the client decides otherwise. v1.2.4: in
 * the order of the welcome text of the post office (the offer is shown in this order).
 */
export const LOAN_TEAMS: Readonly<Record<'A' | 'B' | 'C' | 'D', readonly string[]>> = {
  A: ['sperbereule', 'ostkreischeule', 'waldkauz', 'suedliche-weissgesichtseule', 'riesenfischuhu'],
  B: ['zypernzwergohreule', 'maehnenkauz', 'sumpfohreule', 'brillenkauz', 'schneeeule'],
  C: ['riesenkauz', 'kanincheneule', 'milchuhu', 'schleiereule', 'maskeneule'],
  D: ['waldohreule', 'elfenkauz', 'bartkauz', 'haubenkauz', 'virginiauhu'],
};

export type LoanTeam = keyof typeof LOAN_TEAMS;

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
