/**
 * Erzeugt die Atlas-Ebene des Kartenhintergrunds (v1.2, SPEC 12.1) aus Natural Earth 5.1.2
 * (gemeinfrei) und der handkuratierten Liste in atlas-features.ts. Läuft nur auf dem
 * Entwicklungsrechner; das Ergebnis liegt im Repository: web/src/lib/map/atlas.json
 *   - Landesgrenzen (gestrichelt), Flüsse (je nach Zoom), Seen des Europa-Ausschnitts im Detail
 *   - Flächen mit Symbolen: Gebirge, Mittelgebirge, Wälder, Heiden, Feuchtgebiete, Wüsten
 *   - Namen: Ozeane, Meere, Buchten, Flüsse, Seen, Gebirge und Landschaften
 * Im Europa-Ausschnitt fein und dicht, außerhalb grob und nur das Große.
 * Aufruf: node tools/map/atlas.ts (danach: npx prettier --write web/src/lib/map/atlas.json)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAP } from '../../shared/src/constants.ts';
import { projectRelative, relativeLongitude } from '../../shared/src/map/projection.ts';
import type {
  AreaKind,
  AtlasArea,
  AtlasData,
  AtlasLabel,
  AtlasRiver,
  LabelClass,
} from '../../shared/src/map/atlas.ts';
import {
  HAND_FEATURES,
  NE_OVERRIDES,
  RIVER_NAMES,
  OCEANS,
  RIVER_Z,
  type AtlasKind,
} from './atlas-features.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CACHE = path.join(import.meta.dirname, '.cache');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const SOURCES = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'sources.json'), 'utf8'),
) as Record<string, string>;

type Position = [number, number];
interface Feature {
  properties: Record<string, unknown>;
  geometry:
    | { type: 'Polygon'; coordinates: Position[][] }
    | { type: 'MultiPolygon'; coordinates: Position[][][] }
    | { type: 'LineString'; coordinates: Position[] }
    | { type: 'MultiLineString'; coordinates: Position[][] }
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

const prop = (feature: Feature, key: string): unknown =>
  feature.properties[key] ?? feature.properties[key.toUpperCase()];
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Inside the European section (with a margin): fine geometry and dense details. */
function inSection(lat: number, lon: number, margin = 0): boolean {
  return (
    lat >= MAP.SOUTH_LAT - margin &&
    lat <= MAP.NORTH_LAT + margin &&
    lon >= MAP.WEST_LON - margin &&
    lon <= MAP.EAST_LON + margin
  );
}

/** Web-map zoom level → largest scale (km per pixel) at which a thing is shown. */
const scaleOfZoom = (z: number): number => Number((150 / 2 ** z).toFixed(3));

/** SVG point (y downwards) of a geographic position. */
function svg(lat: number, lon: number): { x: number; y: number } {
  const p = projectRelative(lat, relativeLongitude(lon));
  return { x: p.x, y: -p.y };
}

/** Splits a line where it crosses the edge of the world (relative longitude jumps). */
function splitAtEdge(line: Position[]): Position[][] {
  const parts: Position[][] = [];
  let current: Position[] = [];
  let previous: number | null = null;
  for (const point of line) {
    const delta = relativeLongitude(point[0]);
    if (previous !== null && Math.abs(delta - previous) > 180) {
      if (current.length > 1) parts.push(current);
      current = [];
    }
    current.push(point);
    previous = delta;
  }
  if (current.length > 1) parts.push(current);
  return parts;
}

/** Douglas–Peucker in projected kilometres. */
function simplify(
  points: { x: number; y: number }[],
  tolerance: number,
): { x: number; y: number }[] {
  if (points.length < 3) return points;
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
    let best = 0,
      index = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i]!;
      const distance = Math.abs(dy * p.x - dx * p.y + pb.x * pa.y - pb.y * pa.x) / length;
      if (distance > best) {
        best = distance;
        index = i;
      }
    }
    if (best > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

function lineString(points: { x: number; y: number }[], digits: number): string {
  return 'M' + points.map((p) => `${p.x.toFixed(digits)} ${p.y.toFixed(digits)}`).join('L');
}

function lines(feature: Feature): Position[][] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  return [];
}

function polygons(feature: Feature): Position[][][] {
  const g = feature.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}

function crossesEdge(feature: Feature): boolean {
  return polygons(feature).some((polygon) => polygon.some((ring) => splitAtEdge(ring).length > 1));
}

function centroidLonLat(feature: Feature): [number, number] {
  let sx = 0,
    sy = 0,
    n = 0;
  for (const polygon of polygons(feature))
    for (const [lon, lat] of polygon[0] ?? []) {
      sx += lon;
      sy += lat;
      n++;
    }
  for (const line of lines(feature))
    for (const [lon, lat] of line) {
      sx += lon;
      sy += lat;
      n++;
    }
  return n === 0 ? [0, 0] : [sx / n, sy / n];
}

/** Projected, simplified rings as flat lists (outer ring first). */
function projectRings(polygon: Position[][], tolerance: number): number[][] {
  const out: number[][] = [];
  for (const ring of polygon) {
    // Closed rings in two halves (both ends of a ring coincide, see build.ts).
    const projected = ring.map(([lon, lat]) => svg(lat, lon));
    const middle = Math.floor(projected.length / 2);
    const points = [
      ...simplify(projected.slice(0, middle + 1), tolerance),
      ...simplify(projected.slice(middle), tolerance).slice(1),
    ];
    if (points.length < 4) continue;
    out.push(points.flatMap((p) => [Number(p.x.toFixed(1)), Number(p.y.toFixed(1))]));
  }
  return out;
}

function ringPath(ring: number[]): string {
  const pairs: string[] = [];
  for (let i = 0; i < ring.length; i += 2) pairs.push(`${ring[i]} ${ring[i + 1]}`);
  return `M${pairs.join('L')}Z`;
}

function boxOf(rings: number[][]): [number, number, number, number] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i += 2) {
      minX = Math.min(minX, ring[i]!);
      maxX = Math.max(maxX, ring[i]!);
      minY = Math.min(minY, ring[i + 1]!);
      maxY = Math.max(maxY, ring[i + 1]!);
    }
  return [minX, minY, maxX, maxY].map((v) => Number(v.toFixed(1))) as [
    number,
    number,
    number,
    number,
  ];
}

function insideRings(rings: number[][], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i]!,
        yi = ring[i + 1]!,
        xj = ring[j]!,
        yj = ring[j + 1]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

function edgeDistance(rings: number[][], x: number, y: number): number {
  let best = Infinity;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const ax = ring[j]!,
        ay = ring[j + 1]!,
        bx = ring[i]!,
        by = ring[i + 1]!;
      const dx = bx - ax,
        dy = by - ay;
      const t = Math.max(
        0,
        Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
      );
      best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
    }
  return best;
}

/** The point inside the polygons farthest from their edges (grid search, refined twice). */
function labelPoint(polys: number[][][]): { x: number; y: number; room: number } {
  let best = { x: 0, y: 0, room: -1 };
  for (const rings of polys) {
    let [minX, minY, maxX, maxY] = boxOf(rings);
    for (let round = 0; round < 3; round++) {
      const steps = 24;
      const sx = (maxX - minX) / steps,
        sy = (maxY - minY) / steps;
      let local = { x: 0, y: 0, room: -1 };
      for (let i = 0; i <= steps; i++)
        for (let j = 0; j <= steps; j++) {
          const x = minX + i * sx,
            y = minY + j * sy;
          if (!insideRings(rings, x, y)) continue;
          const room = edgeDistance(rings, x, y);
          if (room > local.room) local = { x, y, room };
        }
      if (local.room < 0) break;
      if (local.room > best.room) best = local;
      [minX, maxX, minY, maxY] = [
        local.x - sx * 2,
        local.x + sx * 2,
        local.y - sy * 2,
        local.y + sy * 2,
      ];
    }
  }
  if (best.room < 0) {
    const [minX, minY, maxX, maxY] = boxOf(polys[0] ?? []);
    best = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, room: 0 };
  }
  return best;
}

/** Main direction of an elongated area (degrees, clockwise, readable) or 0. */
function axisAngle(rings: number[][]): number {
  let n = 0,
    mx = 0,
    my = 0;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i += 2) {
      mx += ring[i]!;
      my += ring[i + 1]!;
      n++;
    }
  if (n < 3) return 0;
  mx /= n;
  my /= n;
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const ring of rings)
    for (let i = 0; i < ring.length; i += 2) {
      const dx = ring[i]! - mx,
        dy = ring[i + 1]! - my;
      sxx += dx * dx;
      syy += dy * dy;
      sxy += dx * dy;
    }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const spread = Math.sqrt((sxx - syy) ** 2 + 4 * sxy * sxy);
  const major = (sxx + syy + spread) / 2,
    minor = (sxx + syy - spread) / 2;
  if (major < 6 * Math.max(minor, 1e-9)) return 0;
  let degrees = (angle * 180) / Math.PI;
  if (degrees > 90) degrees -= 180;
  if (degrees < -90) degrees += 180;
  return Math.round(degrees);
}

const labels: AtlasLabel[] = [];
const areas: AtlasArea[] = [];

function addLabel(label: AtlasLabel): void {
  // Areas that vanish when simplified (tiny lakes, narrow straits) get no name.
  if (!Number.isFinite(label.x) || !Number.isFinite(label.y)) return;
  const entry: AtlasLabel = {
    ...label,
    x: Number(label.x.toFixed(1)),
    y: Number(label.y.toFixed(1)),
  };
  if (entry.en === entry.de) delete (entry as { en?: string }).en;
  if (!entry.a) delete (entry as { a?: number }).a;
  labels.push(entry);
}

function classOfKind(kind: AtlasKind): LabelClass {
  if (kind === 'forest') return 'forest';
  if (kind === 'region' || kind === 'heath' || kind === 'wetland' || kind === 'desert')
    return 'region';
  return 'range';
}

/** Share of conifers by latitude: the north is dark with firs, the tropics broad-leaved. */
function coniferShare(lat: number): number {
  const a = Math.abs(lat);
  return a >= 56 ? 0.85 : a >= 46 ? 0.45 : a >= 30 ? 0.2 : 0;
}

// ── Landesgrenzen ────────────────────────────────────────────────────────────

const borderParts: string[] = [];
for (const feature of await load('ne_50m_admin_0_boundary_lines_land')) {
  for (const line of lines(feature))
    for (const part of splitAtEdge(line)) {
      const [lon, lat] = part[0]!;
      const fine = inSection(lat, lon, 4);
      const points = simplify(
        part.map(([plon, plat]) => svg(plat, plon)),
        fine ? 1.2 : 12,
      );
      if (points.length > 1) borderParts.push(lineString(points, fine ? 1 : 0));
    }
}

// ── Flüsse ───────────────────────────────────────────────────────────────────

const riverGroups = new Map<string, { s: number; w: number; parts: string[] }>();
const riverLabels: {
  name: { de: string; en: string };
  x: number;
  y: number;
  a: number;
  s: number;
  r: 0 | 1 | 2;
}[] = [];

function riverName(feature: Feature): { de: string; en: string } | null {
  const raw = text(prop(feature, 'name'));
  if (!raw) return null;
  const de = text(prop(feature, 'name_de'));
  const en = text(prop(feature, 'name_en'));
  const known = RIVER_NAMES[raw] ?? (en ? RIVER_NAMES[en] : undefined);
  if (known) return known;
  return { de: de ?? raw, en: en ?? raw };
}

function addRiver(feature: Feature, europe: boolean): void {
  const rank = num(prop(feature, 'scalerank'), 10);
  const minZoom = num(prop(feature, 'min_zoom'), rank * 0.8);
  const name = riverName(feature);
  for (const line of lines(feature))
    for (const part of splitAtEdge(line)) {
      const [lon, lat] = part[Math.floor(part.length / 2)]!;
      const fine = inSection(lat, lon, 3);
      if (!fine && (europe || rank > 6)) continue;
      const points = simplify(
        part.map(([plon, plat]) => svg(plat, plon)),
        fine ? 0.7 : 6,
      );
      if (points.length < 2) continue;
      const width = rank <= 3 ? 1.6 : rank <= 6 ? 1.25 : rank <= 9 ? 0.95 : 0.75;
      // Lines a little before their names; the small rivers of the section only when zoomed in.
      const zoom = Math.max(1.5, minZoom - 0.6);
      const s = scaleOfZoom(Math.round(zoom * 2) / 2);
      const key = `${s}|${width}`;
      const group = riverGroups.get(key) ?? { s, w: width, parts: [] };
      group.parts.push(lineString(points, fine ? 1 : 0));
      riverGroups.set(key, group);
      if (!name) continue;
      // Name candidates along the line: every 220 km on long rivers, the middle of short ones.
      let length = 0;
      const along = [0];
      for (let i = 1; i < points.length; i++) {
        length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
        along.push(length);
      }
      if (length < (fine ? 25 : 250)) continue;
      const spacing = fine ? 120 : 600;
      const count = Math.max(1, Math.floor(length / spacing));
      for (let k = 0; k < count; k++) {
        const at = (length * (k + 0.5)) / count;
        const i = Math.max(
          1,
          along.findIndex((value) => value >= at),
        );
        const from = points[Math.max(0, i - 3)]!,
          to = points[Math.min(points.length - 1, i + 2)]!;
        let angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        const p = points[i]!;
        const zOverride = RIVER_Z[name.de];
        const labelZoom = zOverride ?? Math.max(3, num(prop(feature, 'min_label'), minZoom + 0.5));
        riverLabels.push({
          name,
          x: p.x,
          y: p.y,
          a: Math.round(angle),
          s: scaleOfZoom(fine ? labelZoom : labelZoom - 0.3),
          r: rank <= 3 ? 0 : rank <= 7 ? 1 : 2,
        });
      }
    }
}

for (const feature of await load('ne_10m_rivers_lake_centerlines')) addRiver(feature, false);
for (const feature of await load('ne_10m_rivers_europe')) addRiver(feature, true);
// Several pieces of the same river close together: keep one name per 60 km.
const keptRivers: typeof riverLabels = [];
for (const label of riverLabels.sort((a, b) => b.s - a.s)) {
  if (
    keptRivers.some(
      (other) =>
        other.name.de === label.name.de && Math.hypot(other.x - label.x, other.y - label.y) < 60,
    )
  )
    continue;
  keptRivers.push(label);
  addLabel({
    de: label.name.de,
    en: label.name.en,
    x: label.x,
    y: label.y,
    s: label.s,
    c: 'river',
    r: label.r,
    a: label.a,
  });
}

// ── Seen (Europa im Detail, Namen weltweit) ──────────────────────────────────

const lakeParts: string[] = [];
const lakeNames = new Set<string>();
for (const source of ['ne_10m_lakes', 'ne_10m_lakes_europe']) {
  for (const feature of await load(source)) {
    if (crossesEdge(feature)) continue;
    const [lon, lat] = centroidLonLat(feature);
    const fine = inSection(lat, lon, 2);
    const rank = num(prop(feature, 'scalerank'), 10);
    const polys = polygons(feature).map((polygon) => projectRings(polygon, fine ? 0.4 : 5));
    if (fine) for (const rings of polys) for (const ring of rings) lakeParts.push(ringPath(ring));
    const name = text(prop(feature, 'name_de')) ?? text(prop(feature, 'name'));
    if (!name || (!fine && rank > 3) || lakeNames.has(name)) continue;
    let en = text(prop(feature, 'label')) ?? text(prop(feature, 'name')) ?? name;
    if (
      en &&
      !/lake|lago|lac |lough|loch|see\b|meer|järvi|sjön|vatn|ozero|nuur|reservoir|sea/i.test(en) &&
      source === 'ne_10m_lakes'
    )
      en = `Lake ${en}`;
    const place = labelPoint(polys.filter((rings) => rings.length > 0));
    if (place.room < 0) continue;
    lakeNames.add(name);
    const zoom = num(prop(feature, 'min_label'), rank);
    addLabel({
      de: name,
      en,
      x: place.x,
      y: place.y,
      s: scaleOfZoom(fine ? Math.max(4.8, zoom) : zoom),
      c: 'lake',
      r: rank <= 2 ? 0 : rank <= 5 ? 1 : 2,
    });
  }
}

// ── Meere und Ozeane ─────────────────────────────────────────────────────────

for (const feature of await load('ne_10m_geography_marine_polys')) {
  const name = text(prop(feature, 'name'));
  if (!name || crossesEdge(feature)) continue;
  const kind = String(prop(feature, 'featurecla') ?? '').toLowerCase();
  // The oceans are named by hand (the Pacific crosses the edge of the world).
  if (kind === 'ocean') continue;
  const rank = num(prop(feature, 'scalerank'), 6);
  const [lon, lat] = centroidLonLat(feature);
  const fine = inSection(lat, lon, 4);
  if (!fine && rank > 4 && kind !== 'ocean') continue;
  const polys = polygons(feature).map((polygon) => projectRings(polygon, fine ? 2 : 10));
  const place = labelPoint(polys.filter((rings) => rings.length > 0));
  const c: LabelClass = kind === 'ocean' ? 'ocean' : kind === 'sea' ? 'sea' : 'bay';
  const zoom = num(prop(feature, 'min_label'), rank);
  addLabel({
    de: text(prop(feature, 'name_de')) ?? name,
    en: text(prop(feature, 'name_en')) ?? name,
    x: place.x,
    y: place.y,
    s: scaleOfZoom(c === 'ocean' ? Math.min(zoom, 1.4) : fine ? zoom - 0.6 : zoom),
    c,
    r: rank <= 1 ? 0 : rank <= 3 ? 1 : 2,
  });
}

for (const ocean of OCEANS)
  for (const [lat, lon, first] of ocean.at) {
    const p = svg(lat, lon);
    addLabel({
      de: ocean.de,
      en: ocean.en,
      x: p.x,
      y: p.y,
      s: scaleOfZoom(first ? 0 : 2.4),
      c: 'ocean',
      r: first ? 0 : 1,
    });
  }

// ── Gebirge, Wüsten und Landschaften (Natural Earth) ─────────────────────────

const REGION_CLASSES: Record<string, AtlasKind> = {
  'range/mtn': 'mountains',
  desert: 'desert',
  wetlands: 'wetland',
  plateau: 'region',
  plain: 'region',
  basin: 'region',
  lowland: 'region',
  tundra: 'region',
  delta: 'region',
  valley: 'region',
  foothills: 'region',
  'pen/cape': 'region',
  peninsula: 'region',
  geoarea: 'region',
  coast: 'region',
  'island group': 'region',
  island: 'region',
};

for (const feature of await load('ne_10m_geography_regions_polys')) {
  const name = text(prop(feature, 'name'));
  const cls = String(prop(feature, 'featurecla') ?? '').toLowerCase();
  let kind = REGION_CLASSES[cls];
  if (!name || !kind || crossesEdge(feature)) continue;
  const override = NE_OVERRIDES[name];
  if (override?.skip) continue;
  if (override?.kind) kind = override.kind;
  const rank = num(prop(feature, 'scalerank'), 6);
  const [lon, lat] = centroidLonLat(feature);
  const fine = inSection(lat, lon, 2);
  if (!fine && rank > 4) continue;
  const tolerance = fine ? 2 : 12;
  const polys = polygons(feature)
    .map((polygon) => projectRings(polygon, tolerance))
    .filter((rings) => rings.length > 0);
  if (polys.length === 0) continue;
  const isIsland = cls === 'island' || cls === 'island group';
  if (kind !== 'region') {
    for (const rings of polys)
      areas.push({
        k: kind as AreaKind,
        b: boxOf(rings),
        c: fine ? 3 : 16,
        ...(kind === 'forest' || kind === 'forestHills' ? { f: coniferShare(lat) } : {}),
        p: rings,
      });
  }
  const largest = polys.reduce((a, b) => (b[0]!.length > a[0]!.length ? b : a));
  const place = labelPoint([largest]);
  // The greatest ranges, deserts and plateaus are named already on the whole world.
  const zoom = override?.z ?? (rank <= 1 ? 0.6 : num(prop(feature, 'min_label'), rank));
  addLabel({
    de: override?.de ?? text(prop(feature, 'name_de')) ?? name,
    en: override?.en ?? text(prop(feature, 'name_en')) ?? name,
    x: place.x,
    y: place.y,
    s: scaleOfZoom(fine ? zoom + (isIsland ? 0.8 : 0.2) : zoom + (isIsland ? 0.8 : 0)),
    c: isIsland ? 'island' : classOfKind(kind),
    r: rank <= 2 ? 0 : rank <= 4 ? 1 : 2,
    a: kind === 'mountains' || kind === 'hills' ? axisAngle(largest) : 0,
  });
}

// ── Handkuratierte Landschaften ──────────────────────────────────────────────

for (const feature of HAND_FEATURES) {
  const [lat, lon] = feature.at;
  const centre = svg(lat, lon);
  const fine = inSection(lat, lon, 2);
  const rot = ((feature.rot ?? 0) * Math.PI) / 180;
  if (feature.size && feature.kind !== 'region') {
    const [rx, ry] = feature.size;
    const reach = Math.max(rx, ry);
    areas.push({
      k: feature.kind as AreaKind,
      b: [centre.x - reach, centre.y - reach, centre.x + reach, centre.y + reach].map((v) =>
        Number(v.toFixed(1)),
      ) as [number, number, number, number],
      c: fine ? 2.5 : 16,
      ...(feature.kind === 'forest' || feature.kind === 'forestHills'
        ? { f: coniferShare(lat) }
        : {}),
      e: [Number(centre.x.toFixed(1)), Number(centre.y.toFixed(1)), rx, ry, Number(rot.toFixed(3))],
    });
  }
  const elongated = feature.size
    ? Math.max(...feature.size) / Math.min(...feature.size) >= 2.5
    : false;
  // Elongated areas carry their name along the long axis.
  let angle = 0;
  if (elongated && feature.size) {
    const [rx, ry] = feature.size;
    angle = (feature.rot ?? 0) + (ry > rx ? 90 : 0);
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
  }
  addLabel({
    de: feature.de,
    en: feature.en ?? feature.de,
    x: centre.x,
    y: centre.y,
    s: scaleOfZoom(feature.z),
    c: classOfKind(feature.kind),
    r: feature.z <= 4.6 ? 0 : feature.z <= 6 ? 1 : 2,
    a: Math.round(angle),
  });
}

// ── Ausgabe ──────────────────────────────────────────────────────────────────

const rivers: AtlasRiver[] = [...riverGroups.values()]
  .sort((a, b) => b.s - a.s || b.w - a.w)
  .map((group) => ({ s: group.s, w: group.w, d: group.parts.join('') }));

const output: AtlasData & { source: string } = {
  source:
    'Natural Earth 5.1.2 (gemeinfrei) und handkuratierte Landschaften (tools/map/atlas-features.ts)',
  borders: borderParts.join(''),
  lakes: lakeParts.join(''),
  rivers,
  areas,
  labels,
};
const OUT = path.join(ROOT, 'web/src/lib/map/atlas.json');
fs.writeFileSync(OUT, JSON.stringify(output));
console.log(
  `${path.relative(ROOT, OUT)}: ${fs.statSync(OUT).size} Bytes, ${areas.length} Flächen, ${labels.length} Namen, ${rivers.length} Flussgruppen`,
);
