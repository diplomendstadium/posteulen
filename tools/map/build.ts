/**
 * Erzeugt die Kartendaten aus Natural Earth (SPEC 12.2, 12.3, D-09). Läuft nur auf dem
 * Entwicklungsrechner; die Ergebnisse liegen im Repository:
 *   shared/data/landmask.bin            Land/Wasser-Maske (0,02°) des Europa-Ausschnitts
 *   web/src/lib/map/world.json          v0.7: vereinfachte Ländergeometrie der ganzen Welt und
 *                                       Städte für die Anzeige (Equal Earth, km): im Europa-
 *                                       Ausschnitt fein, außerhalb grob; außerhalb nur Hauptstädte
 *   shared/src/map/timezones-data.ts    v0.7: Zeitzone je 0,1°-Feld des Europa-Ausschnitts (für die
 *                                       Begrüßung nach Tageszeit am fiktiven Wohnort)
 * Aufruf: node tools/map/build.ts (danach: npx prettier --write web/src/lib/map/world.json
 *         shared/src/map/timezones-data.ts)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAP } from '../../shared/src/constants.ts';
import { MASK_BYTES, MASK_HEIGHT, MASK_WIDTH } from '../../shared/src/map/landmask.ts';
import {
  CENTRAL_MERIDIAN,
  project,
  projectRelative,
  relativeLongitude,
} from '../../shared/src/map/projection.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CACHE = path.join(import.meta.dirname, '.cache');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';

/** Natural Earth 5.1.2 (public domain). SHA-256 pinned for reproducibility. */
const SOURCES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'sources.json'), 'utf8'),
) as Record<string, string>;

type Ring = [number, number][];
type Polygon = Ring[];
interface Feature {
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: Polygon }
    | { type: 'MultiPolygon'; coordinates: Polygon[] }
    | null;
}

async function load(name: string): Promise<Feature[]> {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${name}.geojson`);
  if (!fs.existsSync(file)) {
    const response = await fetch(`${BASE}/${name}.geojson`);
    if (!response.ok) throw new Error(`download failed: ${name}`);
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const data = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  const expected = SOURCES[name];
  if (expected === undefined) {
    console.warn(`${name}: SHA-256 ${digest} (noch nicht in sources.json eingetragen)`);
  } else if (expected !== digest) {
    throw new Error(`${name}: Prüfsumme stimmt nicht (${digest})`);
  }
  return (JSON.parse(data.toString('utf8')) as { features: Feature[] }).features;
}

function polygons(feature: Feature): Polygon[] {
  if (!feature.geometry) return [];
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

/** Even-odd scanline fill of rings into the bit mask (set = true) or clear (set = false). */
function rasterize(mask: Uint8Array, rings: Ring[], set: boolean): void {
  const res = MAP.LAND_MASK_RESOLUTION_DEG;
  const crossings: number[][] = Array.from({ length: MASK_HEIGHT }, () => []);
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]!;
      const [x2, y2] = ring[i + 1]!;
      if (y1 === y2) continue;
      const yMin = Math.min(y1, y2);
      const yMax = Math.max(y1, y2);
      const rowStart = Math.max(0, Math.ceil((MAP.NORTH_LAT - yMax) / res - 0.5));
      const rowEnd = Math.min(MASK_HEIGHT - 1, Math.floor((MAP.NORTH_LAT - yMin) / res - 0.5));
      for (let row = rowStart; row <= rowEnd; row++) {
        const lat = MAP.NORTH_LAT - (row + 0.5) * res;
        if (lat < yMin || lat >= yMax) continue;
        const lon = x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1);
        crossings[row]!.push(lon);
      }
    }
  }
  for (let row = 0; row < MASK_HEIGHT; row++) {
    const xs = crossings[row]!.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil((xs[k]! - MAP.WEST_LON) / res - 0.5));
      const to = Math.min(MASK_WIDTH - 1, Math.floor((xs[k + 1]! - MAP.WEST_LON) / res - 0.5));
      for (let col = from; col <= to; col++) {
        const index = row * MASK_WIDTH + col;
        if (set) mask[index >> 3]! |= 1 << (index & 7);
        else mask[index >> 3]! &= ~(1 << (index & 7));
      }
    }
  }
}

function ringBox(ring: Ring): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return [minX, minY, maxX, maxY];
}

function intersects(box: [number, number, number, number], margin: number): boolean {
  return !(
    box[2] < MAP.WEST_LON - margin ||
    box[0] > MAP.EAST_LON + margin ||
    box[3] < MAP.SOUTH_LAT - margin ||
    box[1] > MAP.NORTH_LAT + margin
  );
}

/** Sutherland–Hodgman clipping of a ring against a lon/lat rectangle (display only). */
function clipRing(ring: Ring, w: number, s: number, e: number, n: number): Ring {
  const edges: [
    (p: [number, number]) => boolean,
    (a: [number, number], b: [number, number]) => [number, number],
  ][] = [
    [(p) => p[0] >= w, (a, b) => [w, a[1] + ((w - a[0]) * (b[1] - a[1])) / (b[0] - a[0])]],
    [(p) => p[0] <= e, (a, b) => [e, a[1] + ((e - a[0]) * (b[1] - a[1])) / (b[0] - a[0])]],
    [(p) => p[1] >= s, (a, b) => [a[0] + ((s - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), s]],
    [(p) => p[1] <= n, (a, b) => [a[0] + ((n - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), n]],
  ];
  let output: Ring = ring.slice(0, -1);
  for (const [inside, cut] of edges) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i]!;
      const previous = input[(i + input.length - 1) % input.length]!;
      if (inside(current)) {
        if (!inside(previous)) output.push(cut(previous, current));
        output.push(current);
      } else if (inside(previous)) {
        output.push(cut(previous, current));
      }
    }
    if (output.length === 0) break;
  }
  return output;
}

/** Douglas–Peucker simplification in projected kilometres (v0.7: tolerance per point). */
function simplify(
  points: { x: number; y: number; tol: number }[],
): { x: number; y: number; tol: number }[] {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const pa = points[a]!,
      pb = points[b]!;
    const dx = pb.x - pa.x,
      dy = pb.y - pa.y;
    const length = Math.hypot(dx, dy) || 1e-12;
    let maxDistance = 0,
      index = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i]!;
      const distance = Math.abs(dy * p.x - dx * p.y + pb.x * pa.y - pb.y * pa.x) / length;
      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }
    // v0.7: fine inside the European section, coarse elsewhere (the finer end decides).
    const allowed = Math.min(pa.tol, pb.tol);
    if (maxDistance > allowed && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Closed rings are split in two halves; otherwise both ends coincide and nothing is kept. */
function simplifyRing(
  points: { x: number; y: number; tol: number }[],
): { x: number; y: number; tol: number }[] {
  const mid = Math.floor(points.length / 2);
  const first = simplify(points.slice(0, mid + 1));
  const second = simplify(points.slice(mid));
  return [...first, ...second.slice(1)];
}

/** Fine inside the European section (with a generous margin), coarse elsewhere (v0.7). */
const FINE_KM = 1.2;
const COARSE_KM = 15;
/** v0.7: outside the section, islands smaller than this (km²) are left out. */
const MIN_COARSE_AREA_KM2 = 3000;
function toleranceAt(lat: number, lon: number): number {
  return lat >= MAP.SOUTH_LAT - 6 &&
    lat <= MAP.NORTH_LAT + 6 &&
    lon >= MAP.WEST_LON - 12 &&
    lon <= MAP.EAST_LON + 12
    ? FINE_KM
    : COARSE_KM;
}

/** Rings in longitude relative to the central meridian (`[delta, lat]`), see `worldRings`. */
function pathOf(rings: Ring[]): string {
  const parts: string[] = [];
  for (const ring of rings) {
    const projected = simplifyRing(
      ring.map(([delta, lat]) => ({
        ...projectRelative(lat, delta),
        tol: toleranceAt(lat, delta + CENTRAL),
      })),
    );
    if (projected.length < 3) continue;
    const coarse = projected.every((p) => p.tol >= COARSE_KM);
    if (coarse) {
      let area = 0;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i]!;
        const b = projected[(i + 1) % projected.length]!;
        area += a.x * b.y - b.x * a.y;
      }
      if (Math.abs(area) / 2 < MIN_COARSE_AREA_KM2) continue;
    }
    // Whole kilometres are enough outside the section.
    const digits = coarse ? 0 : 1;
    parts.push(
      'M' +
        projected.map((p) => `${p.x.toFixed(digits)} ${(-p.y).toFixed(digits)}`).join('L') +
        'Z',
    );
  }
  return parts.join('');
}

// ── Land/Wasser-Maske ──
const land = await load('ne_10m_land');
const lakes = await load('ne_50m_lakes');
const landRings = land
  .flatMap(polygons)
  .flat()
  .filter((ring) => intersects(ringBox(ring), 1));
const lakeRings = lakes
  .flatMap(polygons)
  .flat()
  .filter((ring) => intersects(ringBox(ring), 1));
const mask = new Uint8Array(MASK_BYTES);
rasterize(mask, landRings, true);
rasterize(mask, lakeRings, false);
fs.writeFileSync(path.join(ROOT, 'shared/data/landmask.bin'), mask);
let landCells = 0;
for (const byte of mask) for (let bit = 0; bit < 8; bit++) landCells += (byte >> bit) & 1;
console.warn(
  `Maske: ${MASK_WIDTH}×${MASK_HEIGHT}, Land ${((100 * landCells) / (MASK_WIDTH * MASK_HEIGHT)).toFixed(1)} %`,
);

// ── Anzeige (v0.7: ganze Welt) ──
const CENTRAL = CENTRAL_MERIDIAN;

/**
 * Rings in longitude relative to the central meridian, cut at the edge of the world (±180°):
 * each ring is unwrapped (no jumps of 360°), then clipped to −180…180 – also shifted by ±360°,
 * so a ring across the edge becomes two pieces. A ring around a pole (Antarctica) is closed
 * along the pole.
 */
function worldRings(rings: Ring[]): Ring[] {
  const out: Ring[] = [];
  for (const ring of rings) {
    if (ring.length < 4) continue;
    const unwrapped: Ring = [];
    let previous: number | undefined;
    for (const [lon, lat] of ring) {
      let delta = relativeLongitude(lon);
      if (previous !== undefined) {
        while (delta - previous > 180) delta -= 360;
        while (previous - delta > 180) delta += 360;
      }
      unwrapped.push([delta, lat]);
      previous = delta;
    }
    const first = unwrapped[0]!;
    const last = unwrapped[unwrapped.length - 1]!;
    if (Math.abs(last[0] - first[0]) > 180) {
      const pole = first[1] < 0 ? -90 : 90;
      unwrapped.push([last[0], pole], [first[0], pole], first);
    }
    for (const shift of [-360, 0, 360]) {
      const shifted = unwrapped.map(([x, y]): [number, number] => [x + shift, y]);
      const box = ringBox(shifted);
      if (box[2] < -180 || box[0] > 180) continue;
      const clipped = clipRing(shifted, -180, -90, 180, 90);
      if (clipped.length >= 3) out.push([...clipped, clipped[0]!]);
    }
  }
  return out;
}

const countries = await load('ne_50m_admin_0_countries');
// Das Vereinigte Königreich erscheint als England, Schottland, Wales und Nordirland (v0.2):
// deren Umrisse stammen aus den „Map Units“ im selben Maßstab.
const mapUnits = await load('ne_50m_admin_0_map_units');
const UK_PARTS = ['ENG', 'SCT', 'WLS', 'NIR'];
const ukParts = mapUnits.filter((unit) => UK_PARTS.includes(String(unit.properties['GU_A3'])));
if (ukParts.length !== UK_PARTS.length) throw new Error('Teile des Vereinigten Königreichs fehlen');
const features: [Feature, string][] = [
  ...countries
    .filter((country) => country.properties['ADM0_A3'] !== 'GBR')
    .map((country): [Feature, string] => [country, String(country.properties['ADM0_A3'])]),
  ...ukParts.map((unit): [Feature, string] => [unit, String(unit.properties['GU_A3'])]),
];
const outCountries = [];
for (const [feature, id] of features) {
  const rings = worldRings(polygons(feature).flat());
  if (rings.length === 0) continue;
  const props = feature.properties;
  const labelLon = Number(props['LABEL_X']);
  const labelLat = Number(props['LABEL_Y']);
  const label =
    Number.isFinite(labelLat) && Number.isFinite(labelLon) ? project(labelLat, labelLon) : null;
  // Fläche in km² (flächentreue Projektion), damit die Anzeige kleine Länder erst beim
  // Hineinzoomen beschriftet.
  let area = 0;
  for (const ring of rings) {
    const pts = ring.map(([delta, lat]) => projectRelative(lat, delta));
    for (let i = 0; i + 1 < pts.length; i++)
      area += pts[i]!.x * pts[i + 1]!.y - pts[i + 1]!.x * pts[i]!.y;
  }
  outCountries.push({
    id,
    area: Math.round(Math.abs(area) / 2),
    name: String(props['NAME_DE'] ?? props['NAME']),
    // v0.4: English name for the English view, only where it differs.
    ...englishName(String(props['NAME_DE'] ?? props['NAME']), props['NAME_EN'] ?? props['NAME']),
    d: pathOf(rings),
    label: label ? [Number(label.x.toFixed(1)), Number((-label.y).toFixed(1))] : null,
  });
}

/** `{ nameEn }` if the English name differs from the German one (v0.4), else nothing. */
function englishName(german: string, english: unknown): { nameEn?: string } {
  const name = typeof english === 'string' ? english.trim() : '';
  return name !== '' && name !== german ? { nameEn: name } : {};
}

const inSection = (lat: number, lon: number): boolean =>
  lat >= MAP.SOUTH_LAT && lat <= MAP.NORTH_LAT && lon >= MAP.WEST_LON && lon <= MAP.EAST_LON;

// ── Städte (v0.2): über 200 000 Einwohner im Ausschnitt, größte zuerst; v0.7: außerhalb des
// Ausschnitts nur Hauptstädte (immer als „groß“, ihre Namen weichen wie alle Städte aus) ──
// Einwohnerzahl ist POP_MAX (Ballungsraum); POP_MIN ist in Natural Earth für viele
// Hauptstädte unbrauchbar (z. B. Paris 11 177).
const places = await load('ne_10m_populated_places');
const seen = new Set<string>();
const outCities = places
  .flatMap((place) => {
    const geometry = place.geometry as unknown as { coordinates: [number, number] } | null;
    if (!geometry) return [];
    const [lon, lat] = geometry.coordinates;
    const population = Number(place.properties['POP_MAX']);
    const inside = inSection(lat, lon);
    const capital = place.properties['FEATURECLA'] === 'Admin-0 capital';
    if (inside ? !(population > MAP.CITY_MIN_POPULATION) : !capital) return [];
    const p = project(lat, lon);
    return [
      {
        name: String(place.properties['NAME_DE'] || place.properties['NAME']),
        ...englishName(
          String(place.properties['NAME_DE'] || place.properties['NAME']),
          place.properties['NAME_EN'] || place.properties['NAME'],
        ),
        population,
        big: !inside || population > MAP.CITY_BIG_POPULATION,
        x: Number(p.x.toFixed(1)),
        y: Number((-p.y).toFixed(1)),
      },
    ];
  })
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name, 'de'))
  .filter((city) => {
    // Names are keys of the display: a later city with the same name is left out.
    if (seen.has(city.name)) {
      console.warn(`Stadt doppelt, ausgelassen: ${city.name}`);
      return false;
    }
    seen.add(city.name);
    return true;
  })
  .map((city) => ({
    name: city.name,
    ...(city.nameEn ? { nameEn: city.nameEn } : {}),
    big: city.big,
    x: city.x,
    y: city.y,
  }));

// Seen: im Ausschnitt alle, weltweit nur die größten (scalerank 0).
const lakePaths = worldRings(
  lakes
    .filter((lake) => {
      const rings = polygons(lake).flat();
      return (
        Number(lake.properties['scalerank']) === 0 ||
        rings.some((ring) => intersects(ringBox(ring), 0))
      );
    })
    .flatMap(polygons)
    .flat(),
);

// Umriss der Welt (Rand der Projektion): oben und unten die Pole als Linien, seitlich ±180°.
const outlinePoints: { x: number; y: number }[] = [];
for (let lat = 90; lat >= -90; lat -= 1) outlinePoints.push(projectRelative(lat, 180));
for (let lat = -90; lat <= 90; lat += 1) outlinePoints.push(projectRelative(lat, -180));
const outline =
  'M' + outlinePoints.map((p) => `${p.x.toFixed(1)} ${(-p.y).toFixed(1)}`).join('L') + 'Z';
const worldX = Math.max(...outlinePoints.map((p) => Math.abs(p.x)));
const worldY = Math.max(...outlinePoints.map((p) => Math.abs(p.y)));

// Europa-Ausschnitt: projizierte Hülle (Registrierung und Umzug bleiben darin, SPEC 12.4).
const corners: { x: number; y: number }[] = [];
for (let i = 0; i <= 20; i++) {
  const t = i / 20;
  corners.push(project(MAP.SOUTH_LAT, MAP.WEST_LON + t * (MAP.EAST_LON - MAP.WEST_LON)));
  corners.push(project(MAP.NORTH_LAT, MAP.WEST_LON + t * (MAP.EAST_LON - MAP.WEST_LON)));
  corners.push(project(MAP.SOUTH_LAT + t * (MAP.NORTH_LAT - MAP.SOUTH_LAT), MAP.WEST_LON));
  corners.push(project(MAP.SOUTH_LAT + t * (MAP.NORTH_LAT - MAP.SOUTH_LAT), MAP.EAST_LON));
}
const minX = Math.min(...corners.map((p) => p.x));
const maxX = Math.max(...corners.map((p) => p.x));
const minY = Math.min(...corners.map((p) => -p.y));
const maxY = Math.max(...corners.map((p) => -p.y));
const output = {
  source: 'Natural Earth 5.1.2 (gemeinfrei)',
  viewBox: [-worldX, -worldY, 2 * worldX, 2 * worldY].map((v) => Number(v.toFixed(1))),
  europe: [minX, minY, maxX - minX, maxY - minY].map((v) => Number(v.toFixed(1))),
  outline,
  countries: outCountries.sort((a, b) => a.name.localeCompare(b.name, 'de')),
  lakes: pathOf(lakePaths),
  cities: outCities,
};
fs.mkdirSync(path.join(ROOT, 'web/src/lib/map'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'web/src/lib/map/world.json'), JSON.stringify(output));
console.warn(
  `Karte: ${outCountries.length} Länder, ${outCities.length} Städte, ${(JSON.stringify(output).length / 1024).toFixed(0)} KiB`,
);

// ── Zeitzonen des Europa-Ausschnitts (v0.7, Begrüßung nach Ortszeit) ──
// Je Land des Ausschnitts genau eine Zeitzone (IANA); Felder auf See nahe der Küste bekommen
// die Zone des nächsten Landfelds (bis 0,5°), damit jeder Wohnort eine Zone hat.
const ZONE_OF: Record<string, string> = {
  ALB: 'Europe/Tirane',
  ALD: 'Europe/Mariehamn',
  AND: 'Europe/Andorra',
  AUT: 'Europe/Vienna',
  BEL: 'Europe/Brussels',
  BGR: 'Europe/Sofia',
  BIH: 'Europe/Sarajevo',
  BLR: 'Europe/Minsk',
  CHE: 'Europe/Zurich',
  CZE: 'Europe/Prague',
  DEU: 'Europe/Berlin',
  DNK: 'Europe/Copenhagen',
  DZA: 'Africa/Algiers',
  ESP: 'Europe/Madrid',
  EST: 'Europe/Tallinn',
  FIN: 'Europe/Helsinki',
  FRA: 'Europe/Paris',
  ENG: 'Europe/London',
  SCT: 'Europe/London',
  WLS: 'Europe/London',
  NIR: 'Europe/London',
  GGY: 'Europe/Guernsey',
  GRC: 'Europe/Athens',
  HRV: 'Europe/Zagreb',
  HUN: 'Europe/Budapest',
  IMN: 'Europe/Isle_of_Man',
  IRL: 'Europe/Dublin',
  ITA: 'Europe/Rome',
  JEY: 'Europe/Jersey',
  KOS: 'Europe/Belgrade',
  LIE: 'Europe/Vaduz',
  LTU: 'Europe/Vilnius',
  LUX: 'Europe/Luxembourg',
  LVA: 'Europe/Riga',
  MAR: 'Africa/Casablanca',
  MCO: 'Europe/Monaco',
  MKD: 'Europe/Skopje',
  MLT: 'Europe/Malta',
  MNE: 'Europe/Podgorica',
  NLD: 'Europe/Amsterdam',
  NOR: 'Europe/Oslo',
  POL: 'Europe/Warsaw',
  PRT: 'Europe/Lisbon',
  ROU: 'Europe/Bucharest',
  RUS: 'Europe/Kaliningrad',
  SMR: 'Europe/San_Marino',
  SRB: 'Europe/Belgrade',
  SVK: 'Europe/Bratislava',
  SVN: 'Europe/Ljubljana',
  SWE: 'Europe/Stockholm',
  TUN: 'Africa/Tunis',
  UKR: 'Europe/Kiev',
  VAT: 'Europe/Vatican',
};
const TZ_RES = 0.1;
const TZ_W = Math.round((MAP.EAST_LON - MAP.WEST_LON) / TZ_RES);
const TZ_H = Math.round((MAP.NORTH_LAT - MAP.SOUTH_LAT) / TZ_RES);
const zones: string[] = [];
const grid = new Int16Array(TZ_W * TZ_H).fill(-1);
for (const [feature, id] of features) {
  const rings = polygons(feature)
    .flat()
    .filter((ring) => intersects(ringBox(ring), 0.5));
  if (rings.length === 0) continue;
  const zone = ZONE_OF[id];
  if (!zone) throw new Error(`Keine Zeitzone für ${id}`);
  if (!zones.includes(zone)) zones.push(zone);
  const index = zones.indexOf(zone);
  for (let row = 0; row < TZ_H; row++) {
    const lat = MAP.NORTH_LAT - (row + 0.5) * TZ_RES;
    const xs: number[] = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i]!;
        const [x2, y2] = ring[i + 1]!;
        if (y1 === y2) continue;
        if (lat < Math.min(y1, y2) || lat >= Math.max(y1, y2)) continue;
        xs.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil((xs[k]! - MAP.WEST_LON) / TZ_RES - 0.5));
      const to = Math.min(TZ_W - 1, Math.floor((xs[k + 1]! - MAP.WEST_LON) / TZ_RES - 0.5));
      for (let col = from; col <= to; col++) grid[row * TZ_W + col] = index;
    }
  }
}
for (let pass = 0; pass < 5; pass++) {
  const before = grid.slice();
  for (let row = 0; row < TZ_H; row++) {
    for (let col = 0; col < TZ_W; col++) {
      if (before[row * TZ_W + col] !== -1) continue;
      for (const [dr, dc] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ] as const) {
        const r = row + dr;
        const c = col + dc;
        if (r < 0 || r >= TZ_H || c < 0 || c >= TZ_W) continue;
        const value = before[r * TZ_W + c]!;
        if (value !== -1) {
          grid[row * TZ_W + col] = value;
          break;
        }
      }
    }
  }
}
// Zeilen als Lauflängen: Zeichen der Zone ('-' = keine) und Länge, z. B. "-12a40b3".
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
if (zones.length > ALPHABET.length) throw new Error('zu viele Zeitzonen');
const rows: string[] = [];
for (let row = 0; row < TZ_H; row++) {
  let text = '';
  let col = 0;
  while (col < TZ_W) {
    const value = grid[row * TZ_W + col]!;
    let end = col;
    while (end < TZ_W && grid[row * TZ_W + end] === value) end++;
    text += (value === -1 ? '-' : ALPHABET[value]) + String(end - col);
    col = end;
  }
  rows.push(text);
}
const tzSource = `/**
 * Generated by tools/map/build.ts from Natural Earth 5.1.2 (public domain) – do not edit.
 * v0.7: time zone of every ${TZ_RES}° cell of the European map section, row by row from the north,
 * as run lengths: a zone letter (index into ZONES, '-' = none) followed by the number of cells.
 */
export const TZ_RESOLUTION_DEG = ${TZ_RES};
export const TZ_WIDTH = ${TZ_W};
export const TZ_HEIGHT = ${TZ_H};
export const TZ_ALPHABET = '${ALPHABET}';
// prettier-ignore
export const ZONES: readonly string[] = ${JSON.stringify(zones)};
// prettier-ignore
export const ZONE_ROWS: readonly string[] = ${JSON.stringify(rows)};
`;
fs.writeFileSync(path.join(ROOT, 'shared/src/map/timezones-data.ts'), tzSource);
console.warn(
  `Zeitzonen: ${zones.length} Zonen, ${TZ_W}×${TZ_H} Felder, ${(tzSource.length / 1024).toFixed(0)} KiB`,
);
