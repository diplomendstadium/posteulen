/**
 * v1.2: the atlas layer of the map background (SPEC 12.1) – hand-drawn symbols for mountains,
 * hills, forests, heaths, wetlands and deserts, and the names of landscapes, waters, rivers and
 * lakes, shown and hidden by zoom so that the map is neither empty nor crowded. The data come
 * from tools/map/atlas.ts (web/src/lib/map/atlas.json); this module only decides what is drawn
 * for a view. Pure functions, coordinates in SVG units (km, y downwards); `scale` is km per
 * screen pixel.
 */
import type { Box } from './labels.ts';

export type AreaKind =
  'mountains' | 'hills' | 'forest' | 'forestHills' | 'heath' | 'wetland' | 'desert';

export type LabelClass =
  'ocean' | 'sea' | 'bay' | 'river' | 'lake' | 'range' | 'region' | 'forest' | 'island';

/** An area filled with symbols: an ellipse `e` or polygon rings `p` (flat x, y lists). */
export interface AtlasArea {
  readonly k: AreaKind;
  /** Bounding box: min x, min y, max x, max y. */
  readonly b: readonly [number, number, number, number];
  /** Finest grid cell in km (dense inside the European section, coarse elsewhere). */
  readonly c: number;
  /** Share of conifers among the trees (0 … 1). */
  readonly f?: number;
  /** Ellipse: centre x, centre y, radius x, radius y, rotation (radians, clockwise). */
  readonly e?: readonly [number, number, number, number, number];
  readonly p?: readonly (readonly number[])[];
}

export interface AtlasLabel {
  readonly de: string;
  /** English name where it differs. */
  readonly en?: string;
  readonly x: number;
  readonly y: number;
  /** Shown from this scale on (km per pixel) – the smaller, the later. */
  readonly s: number;
  readonly c: LabelClass;
  /** Size step: 0 large, 1 medium, 2 small. */
  readonly r: 0 | 1 | 2;
  /** Rotation in degrees (clockwise), e.g. along a river or a mountain range. */
  readonly a?: number;
}

export interface AtlasRiver {
  /** Shown from this scale on (km per pixel). */
  readonly s: number;
  /** Stroke width in pixels. */
  readonly w: number;
  readonly d: string;
}

export interface AtlasData {
  /** Land borders between countries. */
  readonly borders: string;
  /** Lakes of the European section in detail (the world's large lakes are in world.json). */
  readonly lakes: string;
  readonly rivers: readonly AtlasRiver[];
  readonly areas: readonly AtlasArea[];
  readonly labels: readonly AtlasLabel[];
}

/** Size of a symbol in screen pixels. */
export const GLYPH_PX: Readonly<Record<AreaKind, number>> = {
  mountains: 15,
  hills: 13,
  forest: 9,
  forestHills: 10,
  heath: 9,
  wetland: 12,
  desert: 5,
};

/** Distance between symbols relative to their size. */
const SPACING = 1.45;
/** Coarsest level of the symbol grid (cells of 2^20 finest cells never occur). */
const MAX_LEVEL = 20;
/** Coarsest level that scatters its points further (beyond it the grid stays this loose). */
const JITTER_LEVEL = 12;
/** Cells generated per area and level at most; beyond that only those in view (not cached). */
const CACHE_CELLS = 60_000;

/**
 * Size of a symbol in screen pixels at a scale: on the whole world (more than 15 km per pixel)
 * smaller and closer together, so that the great ranges and deserts still show as such.
 */
export function glyphPx(kind: AreaKind, scale: number): number {
  return GLYPH_PX[kind] * (scale > 15 ? 0.7 : 1);
}

function spacingAt(scale: number): number {
  return scale > 15 ? 1.15 : SPACING;
}

/** Level of the symbol grid for an area at a scale: cell size ≥ symbol distance on screen. */
export function levelFor(area: Pick<AtlasArea, 'k' | 'c'>, scale: number): number {
  const need = glyphPx(area.k, scale) * spacingAt(scale) * scale;
  return Math.max(0, Math.min(MAX_LEVEL, Math.ceil(Math.log2(need / area.c))));
}

/** Deterministic hash of three integers to [0, 1). */
export function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) ^ Math.imul(c + 0x165667b1, 0x9e3779b1);
  h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function trailingZeros(n: number): number {
  if (n === 0) return MAX_LEVEL;
  let count = 0;
  let value = Math.abs(n);
  while ((value & 1) === 0 && count < MAX_LEVEL) {
    value >>>= 1;
    count++;
  }
  return count;
}

/** Even-odd test against rings given as flat x, y lists. */
export function insideRings(rings: readonly (readonly number[])[], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i] ?? 0,
        yi = ring[i + 1] ?? 0,
        xj = ring[j] ?? 0,
        yj = ring[j + 1] ?? 0;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Whether a point lies in the area; the edge of an ellipse is frayed a little (`wobble`). */
export function insideArea(area: AtlasArea, x: number, y: number, wobble: number): boolean {
  if (area.e) {
    const [cx, cy, rx, ry, rot] = area.e;
    const cos = Math.cos(rot),
      sin = Math.sin(rot);
    const dx = x - cx,
      dy = y - cy;
    const u = (dx * cos + dy * sin) / rx;
    const v = (-dx * sin + dy * cos) / ry;
    return u * u + v * v <= 0.8 + 0.35 * wobble;
  }
  return area.p ? insideRings(area.p, x, y) : false;
}

/**
 * Symbol positions of an area at a level of the grid, with a variant value per symbol
 * (x, y, v, …). Each point belongs to the coarsest level whose grid contains it, so the symbols
 * of coarse levels stay in place when zooming in and finer ones join them.
 */
export function areaPoints(
  area: AtlasArea,
  index: number,
  level: number,
  window?: Box,
): Float32Array {
  const [minX, minY, maxX, maxY] = area.b;
  const left = Math.max(minX, window?.left ?? -Infinity);
  const right = Math.min(maxX, window?.right ?? Infinity);
  const top = Math.max(minY, window?.top ?? -Infinity);
  const bottom = Math.min(maxY, window?.bottom ?? Infinity);
  const out: number[] = [];
  if (left > right || top > bottom) return new Float32Array(0);
  // Each point belongs to exactly one level `own` (the trailing zeros of its finest cell, at
  // most JITTER_LEVEL) and is scattered by up to 0.42 of that level's cell. Walking the grid of
  // every level from `level` up finds each point however far it was scattered, so a point is the
  // same at every zoom.
  const first = Math.min(level, JITTER_LEVEL);
  for (let own = first; own <= JITTER_LEVEL; own++) {
    const cell = area.c * 2 ** own;
    const step = 2 ** own;
    const spread = 0.42 * cell;
    for (let gx = Math.floor(left / cell) - 1; gx <= Math.ceil(right / cell) + 1; gx++) {
      for (let gy = Math.floor(top / cell) - 1; gy <= Math.ceil(bottom / cell) + 1; gy++) {
        const fx = gx * step,
          fy = gy * step;
        const real = Math.min(trailingZeros(fx), trailingZeros(fy));
        // Each point once (in the walk of its own level), none finer than asked.
        if (Math.min(real, JITTER_LEVEL) !== own || real < level) continue;
        const x = (fx + 0.5) * area.c + (hash01(index, fx, fy) * 2 - 1) * spread;
        const y = (fy + 0.5) * area.c + (hash01(fy, index, fx) * 2 - 1) * spread;
        if (x < left || x > right || y < top || y > bottom) continue;
        const variant = hash01(fx, fy, index + 7);
        if (insideArea(area, x, y, variant)) out.push(x, y, variant);
      }
    }
  }
  return new Float32Array(out);
}

/** Cache of the symbol positions per area and level (the data never change at runtime). */
export class GlyphCache {
  readonly #cache = new Map<number, Float32Array>();

  points(area: AtlasArea, index: number, level: number, view: Box): Float32Array {
    const key = index * 32 + level;
    const cached = this.#cache.get(key);
    if (cached) return cached;
    const cell = area.c * 2 ** level;
    const cells = ((area.b[2] - area.b[0]) / cell + 2) * ((area.b[3] - area.b[1]) / cell + 2);
    if (cells > CACHE_CELLS) return areaPoints(area, index, level, view);
    const points = areaPoints(area, index, level);
    this.#cache.set(key, points);
    return points;
  }
}

type Segment = readonly (string | number)[];

/** Symbols in unit coordinates (1 = symbol size, y downwards, origin at the foot). */
const SHAPES = {
  treeFill: [['M', -0.3, -0.52], ['A', 0.3, 0.3, -0.52], ['A', 0.3, -0.3, -0.52], ['Z']],
  treeLine: [
    ['M', 0, -0.24],
    ['L', 0, 0.08],
  ],
  firFill: [['M', 0, -0.95], ['L', 0.27, -0.14], ['L', -0.27, -0.14], ['Z']],
  firLine: [
    ['M', 0, -0.14],
    ['L', 0, 0.08],
  ],
  peakFill: [
    ['M', -0.52, 0.12],
    ['L', -0.1, -0.6],
    ['L', 0.04, -0.4],
    ['L', 0.15, -0.52],
    ['L', 0.52, 0.12],
  ],
  peakLine: [
    ['M', 0.03, -0.3],
    ['L', 0.12, 0.1],
    ['M', 0.15, -0.36],
    ['L', 0.25, 0.1],
    ['M', 0.27, -0.22],
    ['L', 0.37, 0.1],
  ],
  hillLine: [
    ['M', -0.5, 0.1],
    ['Q', 0, -0.62, 0.5, 0.1],
    ['M', 0.08, -0.16],
    ['L', 0.17, 0.07],
    ['M', 0.22, -0.08],
    ['L', 0.29, 0.07],
  ],
  heathLine: [
    ['M', -0.18, 0.08],
    ['L', -0.32, -0.2],
    ['M', -0.04, 0.08],
    ['L', -0.06, -0.3],
    ['M', 0.1, 0.08],
    ['L', 0.22, -0.2],
  ],
  marshLine: [
    ['M', -0.45, 0.08],
    ['L', 0.45, 0.08],
    ['M', -0.2, 0.08],
    ['L', -0.26, -0.2],
    ['M', 0, 0.08],
    ['L', 0, -0.3],
    ['M', 0.2, 0.08],
    ['L', 0.26, -0.2],
  ],
  dot: [
    ['M', 0, 0],
    ['L', 0, 0.001],
  ],
} satisfies Record<string, readonly Segment[]>;

export type GlyphLayer = keyof typeof SHAPES;

function draw(
  out: string[],
  shape: readonly Segment[],
  x: number,
  y: number,
  size: number,
  digits: number,
): void {
  const fx = (value: number) => (x + value * size).toFixed(digits);
  const fy = (value: number) => (y + value * size).toFixed(digits);
  for (const segment of shape) {
    const [command, ...rest] = segment as [string, ...number[]];
    const v = (index: number): number => rest[index] ?? 0;
    switch (command) {
      case 'M':
      case 'L':
        out.push(`${command}${fx(v(0))} ${fy(v(1))}`);
        break;
      case 'Q':
        out.push(`Q${fx(v(0))} ${fy(v(1))} ${fx(v(2))} ${fy(v(3))}`);
        break;
      case 'A': {
        // Half circle of radius v[0] to the point (v[1], v[2]).
        const r = (v(0) * size).toFixed(digits);
        out.push(`A${r} ${r} 0 1 1 ${fx(v(1))} ${fy(v(2))}`);
        break;
      }
      default:
        out.push('Z');
    }
  }
}

/**
 * The symbols of all areas in view as one path per layer (few DOM nodes, also when zoomed out).
 */
export function glyphPaths(
  data: Pick<AtlasData, 'areas'>,
  cache: GlyphCache,
  view: Box,
  scale: number,
): Record<GlyphLayer, string> {
  const layers = Object.fromEntries(
    Object.keys(SHAPES).map((key) => [key, [] as string[]]),
  ) as Record<GlyphLayer, string[]>;
  const digits = scale < 0.05 ? 3 : scale < 0.5 ? 2 : scale < 5 ? 1 : 0;
  const margin = 20 * scale;
  const window = {
    left: view.left - margin,
    right: view.right + margin,
    top: view.top - margin,
    bottom: view.bottom + margin,
  };
  data.areas.forEach((area, index) => {
    const [minX, minY, maxX, maxY] = area.b;
    if (maxX < window.left || minX > window.right || maxY < window.top || minY > window.bottom)
      return;
    const size = glyphPx(area.k, scale) * scale;
    // Areas smaller than a few symbols stay empty (the name says enough).
    if (Math.max(maxX - minX, maxY - minY) < size * 1.2) return;
    const points = cache.points(area, index, levelFor(area, scale), window);
    for (let i = 0; i < points.length; i += 3) {
      const x = points[i] ?? 0,
        y = points[i + 1] ?? 0,
        v = points[i + 2] ?? 0;
      if (x < window.left || x > window.right || y < window.top || y > window.bottom) continue;
      switch (area.k) {
        case 'mountains':
          draw(layers.peakFill, SHAPES.peakFill, x, y, size * (0.85 + 0.3 * v), digits);
          draw(layers.peakLine, SHAPES.peakLine, x, y, size * (0.85 + 0.3 * v), digits);
          break;
        case 'hills':
          draw(layers.hillLine, SHAPES.hillLine, x, y, size * (0.85 + 0.3 * v), digits);
          break;
        case 'forest':
        case 'forestHills':
          if (area.k === 'forestHills' && v > 0.6) {
            draw(layers.hillLine, SHAPES.hillLine, x, y, size * 1.2, digits);
          } else if (v * 0.999 < (area.f ?? 0)) {
            draw(layers.firFill, SHAPES.firFill, x, y, size, digits);
            draw(layers.firLine, SHAPES.firLine, x, y, size, digits);
          } else {
            draw(layers.treeFill, SHAPES.treeFill, x, y, size, digits);
            draw(layers.treeLine, SHAPES.treeLine, x, y, size, digits);
          }
          break;
        case 'heath':
          draw(layers.heathLine, SHAPES.heathLine, x, y, size, digits);
          break;
        case 'wetland':
          draw(layers.marshLine, SHAPES.marshLine, x, y, size, digits);
          break;
        default:
          draw(layers.dot, SHAPES.dot, x, y, size, digits);
      }
    }
  });
  return Object.fromEntries(
    Object.entries(layers).map(([key, parts]) => [key, parts.join('')]),
  ) as Record<GlyphLayer, string>;
}

/** Font size (screen pixels) per class and size step. */
const FONT: Readonly<Record<LabelClass, readonly [number, number, number]>> = {
  ocean: [12.5, 12.5, 12],
  sea: [14, 12.5, 11.5],
  bay: [12, 11.5, 11],
  river: [12, 11.5, 11],
  lake: [12, 11.5, 11],
  range: [14, 12.5, 11.5],
  region: [13.5, 12.5, 11.5],
  forest: [12.5, 12, 11.5],
  island: [12, 11.5, 11],
};

/** Upper-case, widely spaced names: oceans and the largest ranges and regions. */
export function spaced(label: Pick<AtlasLabel, 'c' | 'r'>): boolean {
  return label.c === 'ocean' || (label.r === 0 && (label.c === 'range' || label.c === 'region'));
}

export interface PlacedAtlasLabel {
  readonly key: number;
  readonly lines: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly fontSize: number;
  readonly c: LabelClass;
  readonly spaced: boolean;
  readonly a: number;
  /** Space taken on the map (for the names placed after it). */
  readonly box: Box;
}

/** Long names of areas break into two lines (rivers and rotated names stay on one). */
export function splitName(text: string, label: Pick<AtlasLabel, 'c' | 'a'>): string[] {
  if (Array.from(text).length <= 15 || label.c === 'river' || (label.a ?? 0) !== 0) return [text];
  const middle = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (
      (text[i] === ' ' || text[i] === '-') &&
      (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))
    )
      best = i;
  }
  if (best < 0) return [text];
  return text[best] === '-'
    ? [text.slice(0, best + 1), text.slice(best + 1)]
    : [text.slice(0, best), text.slice(best + 1)];
}

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Names of the atlas layer for a view: only those whose scale has come, largest first, none
 * overlapping another one or anything in `occupied` (country and city names, markers, the zoom
 * buttons). A river is named again only at a good distance (on the screen).
 */
export function placeAtlasLabels(
  labels: readonly AtlasLabel[],
  view: Box,
  scale: number,
  language: 'de' | 'en',
  occupied: readonly Box[],
  only: (label: AtlasLabel) => boolean = () => true,
): PlacedAtlasLabel[] {
  const taken: Box[] = [...occupied];
  const placed: PlacedAtlasLabel[] = [];
  const rivers = new Map<string, { x: number; y: number }[]>();
  const candidates = labels
    .map((label, key) => ({ label, key }))
    .filter(
      ({ label }) =>
        only(label) &&
        scale <= label.s &&
        label.x >= view.left &&
        label.x <= view.right &&
        label.y >= view.top &&
        label.y <= view.bottom,
    )
    .sort((a, b) => b.label.s - a.label.s || a.label.r - b.label.r);
  for (const { label, key } of candidates) {
    const text = language === 'en' && label.en ? label.en : label.de;
    const fontSize = FONT[label.c][label.r] * scale;
    const isSpaced = spaced(label);
    const lines = splitName(isSpaced ? text.toUpperCase() : text, label);
    const perChar = isSpaced ? 0.86 : 0.5;
    const width = Math.max(...lines.map((line) => Array.from(line).length)) * fontSize * perChar;
    const height = fontSize * 1.15 * lines.length;
    const angle = ((label.a ?? 0) * Math.PI) / 180;
    // Box of the (possibly rotated) name around its anchor, plus a little air.
    const halfW = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
    const halfH = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
    const pad = fontSize * 0.25;
    const box = {
      left: label.x - halfW - pad,
      right: label.x + halfW + pad,
      top: label.y - halfH - pad,
      bottom: label.y + halfH + pad,
    };
    // Wholly inside the view (no names cut off at the edge) and clear of everything else.
    if (
      box.left < view.left ||
      box.right > view.right ||
      box.top < view.top ||
      box.bottom > view.bottom
    )
      continue;
    if (taken.some((other) => overlaps(box, other))) continue;
    if (label.c === 'river') {
      const before = rivers.get(text) ?? [];
      if (before.some((p) => Math.hypot(p.x - label.x, p.y - label.y) < 320 * scale)) continue;
      before.push({ x: label.x, y: label.y });
      rivers.set(text, before);
    }
    taken.push(box);
    placed.push({
      key,
      lines,
      x: label.x,
      y: label.y,
      fontSize,
      c: label.c,
      spaced: isSpaced,
      a: label.a ?? 0,
      box,
    });
  }
  return placed;
}
