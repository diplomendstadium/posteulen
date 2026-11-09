/**
 * v0.8: erzeugt die grobe Land/Wasser-Maske der ganzen Welt (0,1°) aus Natural Earth
 * (`ne_10m_land`, gleiche Quelle und Prüfsumme wie tools/map/build.ts) – für Wohnorte von
 * Bots außerhalb Europas und Schlafpausen ihrer Eulen dort (SPEC 12.3). Ergebnis:
 *   shared/data/worldmask.bin
 * Aufruf: node tools/map/worldmask.ts
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAP } from '../../shared/src/constants.ts';
import {
  WORLD_MASK_BYTES,
  WORLD_MASK_HEIGHT,
  WORLD_MASK_WIDTH,
} from '../../shared/src/map/landmask.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CACHE = path.join(import.meta.dirname, '.cache');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const SOURCES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'sources.json'), 'utf8'),
) as Record<string, string>;

type Ring = [number, number][];
interface Feature {
  geometry:
    | { type: 'Polygon'; coordinates: Ring[] }
    | { type: 'MultiPolygon'; coordinates: Ring[][] }
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
  if (SOURCES[name] !== digest) throw new Error(`${name}: Prüfsumme stimmt nicht (${digest})`);
  return (JSON.parse(data.toString('utf8')) as { features: Feature[] }).features;
}

const res = MAP.WORLD_MASK_RESOLUTION_DEG;
const rings: Ring[] = (await load('ne_10m_land')).flatMap((feature) =>
  !feature.geometry
    ? []
    : feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates
      : feature.geometry.coordinates.flat(),
);

// Even-odd scanline fill: a cell is land when its centre lies inside the land polygons.
const crossings: number[][] = Array.from({ length: WORLD_MASK_HEIGHT }, () => []);
for (const ring of rings) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    if (y1 === y2) continue;
    const yMin = Math.min(y1, y2);
    const yMax = Math.max(y1, y2);
    const rowStart = Math.max(0, Math.ceil((90 - yMax) / res - 0.5));
    const rowEnd = Math.min(WORLD_MASK_HEIGHT - 1, Math.floor((90 - yMin) / res - 0.5));
    for (let row = rowStart; row <= rowEnd; row++) {
      const lat = 90 - (row + 0.5) * res;
      if (lat < yMin || lat >= yMax) continue;
      crossings[row]!.push(x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
}
const mask = new Uint8Array(WORLD_MASK_BYTES);
let landCells = 0;
for (let row = 0; row < WORLD_MASK_HEIGHT; row++) {
  const xs = crossings[row]!.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const from = Math.max(0, Math.ceil((xs[k]! + 180) / res - 0.5));
    const to = Math.min(WORLD_MASK_WIDTH - 1, Math.floor((xs[k + 1]! + 180) / res - 0.5));
    for (let col = from; col <= to; col++) {
      const index = row * WORLD_MASK_WIDTH + col;
      if (!(mask[index >> 3]! & (1 << (index & 7)))) landCells++;
      mask[index >> 3]! |= 1 << (index & 7);
    }
  }
}
fs.writeFileSync(path.join(ROOT, 'shared/data/worldmask.bin'), mask);
console.warn(
  `Weltmaske: ${WORLD_MASK_WIDTH}×${WORLD_MASK_HEIGHT}, Land ${((100 * landCells) / (WORLD_MASK_WIDTH * WORLD_MASK_HEIGHT)).toFixed(1)} %`,
);
