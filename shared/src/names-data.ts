/** SPEC Anhang D: names for loan owls and random chick names (German view). */
// prettier-ignore
export const OWL_NAMES: readonly string[] = [
  'Momo', 'Keks', 'Pino', 'Flauschi', 'Nori', 'Puschel', 'Tofu', 'Krümel', 'Miso', 'Knöpfchen',
  'Flöckchen', 'Pips', 'Mochi', 'Wuschel', 'Kiki', 'Fussel', 'Bubu', 'Schnuffel', 'Pünktchen', 'Taps',
  'Nyx', 'Rune', 'Nebel', 'Echo', 'Onyx', 'Schatten', 'Mondlicht', 'Nox', 'Salem', 'Merlin',
  'Dämmer', 'Mystic', 'Orion', 'Cosmo', 'Nova', 'Auri', 'Kismet', 'Lumi', 'Zora', 'Vesper',
  'Moos', 'Flocke', 'Ahorn', 'Wolke', 'Feder', 'Klee', 'Sturm', 'Kiesel', 'Frost', 'Funke',
  'Tau', 'Asche', 'Regen', 'Herbst', 'Flieder', 'Tanne', 'Wind', 'Farn', 'Schnee', 'Glimmer',
  'Rio', 'Kim', 'Mika', 'Lou', 'Juno', 'Niko', 'Toni', 'Sam', 'Robin', 'Alex',
  'Yuki', 'Nalu', 'Quinn', 'Sky', 'Ari', 'Neo', 'Jona', 'Remy', 'Eli', 'Lio',
  'Huhu', 'Schuhu', 'Kuckuck', 'Professor', 'Brille', 'Knick', 'Flatter', 'Wupp', 'Glubsch', 'Schnabel',
  'Plüsch', 'Knarz', 'Wölkchen', 'Murmel', 'Pompom', 'Knuff', 'Zwirbel', 'Quatsch', 'Knurps',
  // v0.3.2: old-fashioned, historical and mythological first names (D-130).
  'Hermes', 'Arnold', 'Dougal', 'Bathilda', 'Ariana', 'Kendra', 'Hestia', 'Phineas', 'Arcturus', 'Ruppert',
  'Walburga', 'Septimus', 'Septima', 'Aurora', 'Wilhelmina', 'Silvanus', 'Cuthbert', 'Galatea', 'Rolanda', 'Irma',
  'Garrick', 'Ambrosius', 'Rosmerta', 'Dilys', 'Armando', 'Everard', 'Perenelle', 'Hepzibah', 'Merope', 'Wendelin',
  'Gunhilda',
];

/**
 * v0.4: the same list for the English view – German words translated, international names
 * kept. Same length and order as OWL_NAMES (SPEC Anhang D).
 */
// prettier-ignore
export const OWL_NAMES_EN: readonly string[] = [
  'Momo', 'Cookie', 'Pino', 'Fluffy', 'Nori', 'Tuft', 'Tofu', 'Crumble', 'Miso', 'Button',
  'Snowdrop', 'Pips', 'Mochi', 'Scruffy', 'Kiki', 'Fluff', 'Bubu', 'Snuffles', 'Dotty', 'Tippy',
  'Nyx', 'Rune', 'Mist', 'Echo', 'Onyx', 'Shadow', 'Moonlight', 'Nox', 'Salem', 'Merlin',
  'Dusk', 'Mystic', 'Orion', 'Cosmo', 'Nova', 'Auri', 'Kismet', 'Lumi', 'Zora', 'Vesper',
  'Moss', 'Flake', 'Maple', 'Cloud', 'Feather', 'Clover', 'Storm', 'Pebble', 'Frost', 'Spark',
  'Dew', 'Ash', 'Rain', 'Autumn', 'Lilac', 'Fir', 'Breeze', 'Fern', 'Snow', 'Glimmer',
  'Rio', 'Kim', 'Mika', 'Lou', 'Juno', 'Niko', 'Toni', 'Sam', 'Robin', 'Alex',
  'Yuki', 'Nalu', 'Quinn', 'Sky', 'Ari', 'Neo', 'Jona', 'Remy', 'Eli', 'Lio',
  'Hoot', 'Hooty', 'Cuckoo', 'Professor', 'Specs', 'Nibbles', 'Flutter', 'Whoosh', 'Goggles', 'Beaky',
  'Plush', 'Creaky', 'Cloudlet', 'Marble', 'Pompom', 'Snuggles', 'Twirl', 'Fiddlesticks', 'Pipsqueak',
  'Hermes', 'Arnold', 'Dougal', 'Bathilda', 'Ariana', 'Kendra', 'Hestia', 'Phineas', 'Arcturus', 'Ruppert',
  'Walburga', 'Septimus', 'Septima', 'Aurora', 'Wilhelmina', 'Silvanus', 'Cuthbert', 'Galatea', 'Rolanda', 'Irma',
  'Garrick', 'Ambrosius', 'Rosmerta', 'Dilys', 'Armando', 'Everard', 'Perenelle', 'Hepzibah', 'Merope', 'Wendelin',
  'Gunhilda',
];

/** Names for loan owls and chicks in the language of the account (v0.4). */
export function owlNames(language: 'de' | 'en'): readonly string[] {
  return language === 'en' ? OWL_NAMES_EN : OWL_NAMES;
}

/** SPEC Anhang E: first names for the uncle bot. */
// prettier-ignore
export const UNCLE_NAMES: readonly string[] = [
  'Alexander', 'Maximilian', 'Lukas', 'Leon', 'Paul', 'Felix', 'Jonas', 'Noah', 'David', 'Daniel',
  'Thomas', 'Michael', 'Andreas', 'Martin', 'Stefan', 'Peter', 'Christian', 'Sebastian', 'Julian', 'Florian',
  'Simon', 'Benjamin', 'Samuel', 'Gabriel', 'Oliver', 'William', 'James', 'George', 'Jack', 'Harry',
  'Louis', 'Arthur', 'Hugo', 'Lucas', 'Matteo', 'Marco', 'Luca', 'Giovanni', 'Antonio', 'Francesco',
  'Lorenzo', 'Alessandro', 'Carlos', 'Miguel', 'Javier', 'Diego', 'Pablo', 'Jan', 'Erik', 'Adam',
];

/** SPEC Anhang E: first names for the aunt bot. */
// prettier-ignore
export const AUNT_NAMES: readonly string[] = [
  'Emma', 'Sophia', 'Sofia', 'Emilia', 'Mia', 'Anna', 'Hannah', 'Lina', 'Lena', 'Laura',
  'Julia', 'Sarah', 'Marie', 'Maria', 'Sophie', 'Charlotte', 'Clara', 'Ella', 'Mila', 'Isabella',
  'Olivia', 'Amelia', 'Emily', 'Alice', 'Grace', 'Lily', 'Lucy', 'Victoria', 'Elizabeth', 'Catherine',
  'Louise', 'Camille', 'Chloé', 'Manon', 'Léa', 'Giulia', 'Chiara', 'Francesca', 'Alessia', 'Valentina',
  'Martina', 'Elena', 'Lucia', 'Carmen', 'Paula', 'Alba', 'Sara', 'Nora', 'Eva',
];
