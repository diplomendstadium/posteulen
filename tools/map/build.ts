/**
 * Erzeugt die Kartendaten aus Natural Earth (SPEC 12.2, 12.3, D-09). Läuft nur auf dem
 * Entwicklungsrechner; die Ergebnisse liegen im Repository:
 *   shared/data/landmask.bin       Land/Wasser-Maske (0,02°)
 *   web/src/lib/map/europe.json    vereinfachte Ländergeometrie und Städte für die Anzeige (LAEA, km)
 * Aufruf: node tools/map/build.ts
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAP } from '../../shared/src/constants.ts';
import { MASK_BYTES, MASK_HEIGHT, MASK_WIDTH } from '../../shared/src/map/landmask.ts';
import { project } from '../../shared/src/map/projection.ts';

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

/** Douglas–Peucker simplification in projected kilometres. */
function simplify(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
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
    if (maxDistance > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Closed rings are split in two halves; otherwise both ends coincide and nothing is kept. */
function simplifyRing(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  const mid = Math.floor(points.length / 2);
  const first = simplify(points.slice(0, mid + 1), tolerance);
  const second = simplify(points.slice(mid), tolerance);
  return [...first, ...second.slice(1)];
}

function pathOf(rings: Ring[], tolerance: number): string {
  const parts: string[] = [];
  for (const ring of rings) {
    const projected = simplifyRing(
      ring.map(([lon, lat]) => project(lat, lon)),
      tolerance,
    );
    if (projected.length < 3) continue;
    parts.push(
      'M' + projected.map((p) => `${p.x.toFixed(1)} ${(-p.y).toFixed(1)}`).join('L') + 'Z',
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

// ── Anzeige: Länder und Seen ──
// Großzügiger Rand, damit der Zuschnitt außerhalb des sichtbaren Bereichs liegt.
const margin = 12;
const [w, s, e, n] = [
  MAP.WEST_LON - margin,
  MAP.SOUTH_LAT - 6,
  MAP.EAST_LON + margin,
  MAP.NORTH_LAT + 6,
];
const countries = await load('ne_50m_admin_0_countries');
// Das Vereinigte Königreich erscheint als England, Schottland, Wales und Nordirland (v0.2):
// deren Umrisse stammen aus den „Map Units“ im selben Maßstab.
const mapUnits = await load('ne_50m_admin_0_map_units');
const UK_PARTS = ['ENG', 'SCT', 'WLS', 'NIR'];
const ukParts = mapUnits.filter((unit) => UK_PARTS.includes(String(unit.properties['GU_A3'])));
if (ukParts.length !== UK_PARTS.length) throw new Error('Teile des Vereinigten Königreichs fehlen');
const tolerance = 1.2;
const outCountries = [];
for (const [feature, id] of [
  ...countries
    .filter((country) => country.properties['ADM0_A3'] !== 'GBR')
    .map((country): [Feature, string] => [country, String(country.properties['ADM0_A3'])]),
  ...ukParts.map((unit): [Feature, string] => [unit, String(unit.properties['GU_A3'])]),
]) {
  const rings = polygons(feature)
    .flat()
    .filter((ring) => intersects(ringBox(ring), margin))
    .map((ring) => clipRing(ring, w, s, e, n))
    .filter((ring) => ring.length >= 3)
    .map((ring) => [...ring, ring[0]!] as Ring);
  if (rings.length === 0) continue;
  const props = feature.properties;
  const labelLon = Number(props['LABEL_X']);
  const labelLat = Number(props['LABEL_Y']);
  const label =
    labelLat >= MAP.SOUTH_LAT &&
    labelLat <= MAP.NORTH_LAT &&
    labelLon >= MAP.WEST_LON &&
    labelLon <= MAP.EAST_LON
      ? project(labelLat, labelLon)
      : null;
  // Fläche in km² (flächentreue Projektion), damit die Anzeige kleine Länder erst beim
  // Hineinzoomen beschriftet. Ringe nach RFC 7946: außen gegen, Löcher im Uhrzeigersinn.
  let area = 0;
  for (const polygon of polygons(feature)) {
    for (const ring of polygon) {
      const pts = ring.map(([lon, lat]) => project(lat, lon));
      for (let i = 0; i + 1 < pts.length; i++)
        area += pts[i]!.x * pts[i + 1]!.y - pts[i + 1]!.x * pts[i]!.y;
    }
  }
  outCountries.push({
    id,
    area: Math.round(Math.abs(area) / 2),
    name: String(props['NAME_DE'] ?? props['NAME']),
    d: pathOf(rings, tolerance),
    label: label ? [Number(label.x.toFixed(1)), Number((-label.y).toFixed(1))] : null,
  });
}

// ── Städte (v0.2): über 200 000 Einwohner im Ausschnitt, größte zuerst ──
// Einwohnerzahl ist POP_MAX (Ballungsraum); POP_MIN ist in Natural Earth für viele
// Hauptstädte unbrauchbar (z. B. Paris 11 177).
const places = await load('ne_10m_populated_places');
const outCities = places
  .flatMap((place) => {
    const geometry = place.geometry as unknown as { coordinates: [number, number] } | null;
    if (!geometry) return [];
    const [lon, lat] = geometry.coordinates;
    const population = Number(place.properties['POP_MAX']);
    if (
      !(population > MAP.CITY_MIN_POPULATION) ||
      lat < MAP.SOUTH_LAT ||
      lat > MAP.NORTH_LAT ||
      lon < MAP.WEST_LON ||
      lon > MAP.EAST_LON
    )
      return [];
    const p = project(lat, lon);
    return [
      {
        name: String(place.properties['NAME_DE'] || place.properties['NAME']),
        population,
        x: Number(p.x.toFixed(1)),
        y: Number((-p.y).toFixed(1)),
      },
    ];
  })
  .sort((a, b) => b.population - a.population || a.name.localeCompare(b.name, 'de'))
  .map((city) => ({
    name: city.name,
    big: city.population > MAP.CITY_BIG_POPULATION,
    x: city.x,
    y: city.y,
  }));
if (new Set(outCities.map((city) => city.name)).size !== outCities.length)
  throw new Error('Städtenamen sind nicht eindeutig');

const lakePaths = lakes
  .flatMap(polygons)
  .flat()
  .filter((ring) => intersects(ringBox(ring), 0))
  .map((ring) => clipRing(ring, w, s, e, n))
  .filter((ring) => ring.length >= 3)
  .map((ring) => [...ring, ring[0]!] as Ring);

// Sichtbarer Ausschnitt: projizierte Hülle des Ausschnitts.
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
  viewBox: [minX, minY, maxX - minX, maxY - minY].map((v) => Number(v.toFixed(1))),
  countries: outCountries.sort((a, b) => a.name.localeCompare(b.name, 'de')),
  lakes: pathOf(lakePaths, tolerance),
  cities: outCities,
};
fs.mkdirSync(path.join(ROOT, 'web/src/lib/map'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'web/src/lib/map/europe.json'), JSON.stringify(output));
console.warn(
  `Karte: ${outCountries.length} Länder, ${outCities.length} Städte, ${(JSON.stringify(output).length / 1024).toFixed(0)} KiB`,
);
