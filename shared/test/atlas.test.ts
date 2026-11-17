import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  areaPoints,
  GlyphCache,
  glyphPaths,
  glyphPx,
  hash01,
  insideArea,
  insideRings,
  levelFor,
  overlaps,
  placeAtlasLabels,
  spaced,
  splitName,
  type AtlasArea,
  type AtlasData,
  type AtlasLabel,
} from '../src/map/atlas.ts';

const ATLAS = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, '../../web/src/lib/map/atlas.json'), 'utf8'),
) as AtlasData;

const VIEW = { left: -1000, top: -1000, right: 1000, bottom: 1000 };
const ellipse = (k: AtlasArea['k'], extra: Partial<AtlasArea> = {}): AtlasArea => ({
  k,
  b: [-100, -50, 100, 50],
  c: 2.5,
  e: [0, 0, 100, 50, 0],
  ...extra,
});

describe('atlas symbols (SPEC 12.1, v1.2)', () => {
  it('chooses a coarser grid the farther the map is zoomed out', () => {
    const area = ellipse('forest');
    expect(levelFor(area, 0.1)).toBe(0);
    expect(levelFor(area, 2)).toBeGreaterThan(levelFor(area, 0.5));
    expect(levelFor(area, 1e9)).toBe(20);
    // On the whole world the symbols are smaller.
    expect(glyphPx('mountains', 20)).toBeLessThan(glyphPx('mountains', 2));
  });

  it('hashes deterministically into [0, 1)', () => {
    const values = Array.from({ length: 200 }, (_, i) => hash01(i, i * 7, 3));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(hash01(1, 2, 3)).toBe(hash01(1, 2, 3));
    expect(new Set(values).size).toBeGreaterThan(190);
  });

  it('tests points against rings, ellipses and empty areas', () => {
    const square = [[0, 0, 10, 0, 10, 10, 0, 10]];
    expect(insideRings(square, 5, 5)).toBe(true);
    expect(insideRings(square, 15, 5)).toBe(false);
    // A hole (even-odd).
    expect(insideRings([...square, [4, 4, 6, 4, 6, 6, 4, 6]], 5, 5)).toBe(false);
    const area = ellipse('hills', { e: [0, 0, 100, 50, Math.PI / 2] });
    expect(insideArea(area, 0, 80, 0.5)).toBe(true);
    expect(insideArea(area, 80, 0, 0.5)).toBe(false);
    expect(insideArea({ k: 'desert', b: [0, 0, 10, 10], c: 1, p: square }, 5, 5, 0)).toBe(true);
    expect(insideArea({ k: 'desert', b: [0, 0, 10, 10], c: 1 }, 5, 5, 0)).toBe(false);
  });

  it('keeps the symbols of coarse levels in place when zooming in', () => {
    const area = ellipse('forest');
    const coarse = areaPoints(area, 3, 4);
    const fine = areaPoints(area, 3, 2);
    expect(fine.length).toBeGreaterThan(coarse.length);
    const key = (points: Float32Array, i: number) => `${points[i]},${points[i + 1]}`;
    const fineSet = new Set<string>();
    for (let i = 0; i < fine.length; i += 3) fineSet.add(key(fine, i));
    for (let i = 0; i < coarse.length; i += 3) expect(fineSet.has(key(coarse, i))).toBe(true);
    // Only inside the window, and nothing when the window misses the area.
    const window = { left: 0, top: -50, right: 100, bottom: 50 };
    const half = areaPoints(area, 3, 2, window);
    for (let i = 0; i < half.length; i += 3) expect(half[i]).toBeGreaterThanOrEqual(0);
    expect(areaPoints(area, 3, 2, { left: 500, top: 500, right: 600, bottom: 600 })).toHaveLength(
      0,
    );
  });

  it('caches small areas and computes huge ones only in view', () => {
    const cache = new GlyphCache();
    const area = ellipse('forest');
    const first = cache.points(area, 0, 2, VIEW);
    expect(cache.points(area, 0, 2, VIEW)).toBe(first);
    const huge: AtlasArea = {
      k: 'desert',
      b: [-5000, -5000, 5000, 5000],
      c: 1,
      e: [0, 0, 5000, 5000, 0],
    };
    const window = { left: 0, top: 0, right: 50, bottom: 50 };
    const points = cache.points(huge, 1, 0, window);
    expect(points.length).toBeGreaterThan(0);
    expect(cache.points(huge, 1, 0, window)).not.toBe(points);
  });

  it('draws every kind of symbol into its layers', () => {
    const areas: AtlasArea[] = [
      ellipse('mountains'),
      ellipse('hills'),
      ellipse('forest', { f: 0 }),
      ellipse('forest', { f: 1 }),
      ellipse('forestHills', { f: 0.5 }),
      ellipse('heath'),
      ellipse('wetland'),
      ellipse('desert'),
      // Too small for a symbol at this scale, and one outside the view.
      { k: 'forest', b: [0, 0, 0.5, 0.5], c: 0.1, e: [0, 0, 0.5, 0.5, 0] },
      { k: 'forest', b: [5000, 5000, 5100, 5100], c: 2, e: [5050, 5050, 50, 50, 0] },
    ];
    for (const scale of [0.04, 0.3, 1]) {
      const layers = glyphPaths({ areas }, new GlyphCache(), VIEW, scale);
      for (const layer of [
        'peakFill',
        'peakLine',
        'hillLine',
        'treeFill',
        'treeLine',
        'firFill',
        'firLine',
        'heathLine',
        'marshLine',
        'dot',
      ] as const)
        expect(layers[layer], `${layer} at ${scale}`).toMatch(/^M/);
      expect(layers.treeFill).toContain('A');
      expect(layers.hillLine).toContain('Q');
      expect(layers.firFill).toContain('Z');
    }
    expect(glyphPaths({ areas }, new GlyphCache(), VIEW, 8).dot).not.toBe('');
  });
});

describe('atlas names (SPEC 12.1, v1.2)', () => {
  const label = (extra: Partial<AtlasLabel>): AtlasLabel => ({
    de: 'Harz',
    x: 0,
    y: 0,
    s: 5,
    c: 'range',
    r: 2,
    ...extra,
  });

  it('breaks long names of areas into two lines', () => {
    expect(splitName('Mecklenburgische Seenplatte', { c: 'region' })).toEqual([
      'Mecklenburgische',
      'Seenplatte',
    ]);
    expect(splitName('Böhmisch-Mährische Höhe', { c: 'range' })).toEqual([
      'Böhmisch-',
      'Mährische Höhe',
    ]);
    expect(splitName('Harz', { c: 'range' })).toEqual(['Harz']);
    expect(splitName('Schwarzwaldhochstraße', { c: 'region' })).toEqual(['Schwarzwaldhochstraße']);
    expect(splitName('Mecklenburgische Seenplatte', { c: 'river' })).toHaveLength(1);
    expect(splitName('Mecklenburgische Seenplatte', { c: 'region', a: 30 })).toHaveLength(1);
  });

  it('spaces the names of oceans and of the largest ranges and regions', () => {
    expect(spaced({ c: 'ocean', r: 2 })).toBe(true);
    expect(spaced({ c: 'range', r: 0 })).toBe(true);
    expect(spaced({ c: 'region', r: 0 })).toBe(true);
    expect(spaced({ c: 'range', r: 1 })).toBe(false);
    expect(spaced({ c: 'sea', r: 0 })).toBe(false);
  });

  it('shows names only from their scale on, in the language of the view', () => {
    const labels = [label({ de: 'Schwarzwald', en: 'Black Forest', s: 2 })];
    expect(placeAtlasLabels(labels, VIEW, 3, 'de', [])).toHaveLength(0);
    const [placed] = placeAtlasLabels(labels, VIEW, 1, 'en', []);
    expect(placed?.lines).toEqual(['Black Forest']);
    expect(placeAtlasLabels(labels, VIEW, 1, 'de', [])[0]?.lines).toEqual(['Schwarzwald']);
    const [ocean] = placeAtlasLabels([label({ de: 'Nordsee', c: 'ocean' })], VIEW, 1, 'de', []);
    expect(ocean?.lines).toEqual(['NORDSEE']);
    expect(ocean?.spaced).toBe(true);
  });

  it('places no name over another, over occupied space or across the edge of the view', () => {
    const labels = [
      label({ de: 'Alpen', s: 50, r: 0 }),
      label({ de: 'Harz', x: 2, y: 1 }),
      label({ de: 'Eifel', x: 300, y: 300 }),
      label({ de: 'Rand', x: 995, y: 0 }),
      label({ de: 'Draußen', x: 5000, y: 0 }),
      label({ de: 'Thüringer Wald', x: -300, y: -300, a: 35 }),
    ];
    const placed = placeAtlasLabels(labels, VIEW, 1, 'de', [
      { left: 290, right: 310, top: 290, bottom: 310 },
    ]);
    expect(placed.map((p) => p.lines.join(' '))).toEqual(['ALPEN', 'Thüringer Wald']);
    expect(placed[1]?.a).toBe(35);
    for (const a of placed)
      for (const b of placed) if (a !== b) expect(overlaps(a.box, b.box)).toBe(false);
    // With a filter only the chosen names.
    expect(placeAtlasLabels(labels, VIEW, 1, 'de', [], (l) => l.r === 0)).toHaveLength(1);
  });

  it('names a river again only at a good distance', () => {
    const rivers = [0, 100, 600].map((x) => label({ de: 'Rhein', c: 'river', x, y: 0 }));
    const placed = placeAtlasLabels(rivers, VIEW, 1, 'de', []);
    expect(placed.map((p) => p.x)).toEqual([0, 600]);
  });
});

describe('atlas data (tools/map/atlas.ts)', () => {
  const names = new Set(ATLAS.labels.map((label) => label.de));

  it('names the landscapes, rivers and lakes of Germany the client asked for', () => {
    for (const name of [
      'Mecklenburgische Seenplatte',
      'Lüneburger Heide',
      'Harz',
      'Eifel',
      'Thüringer Wald',
      'Norddeutsches Tiefland',
      'Erzgebirge',
      'Schwarzwald',
      'Schwäbische Alb',
      'Bayerischer Wald',
      'Alpen',
      'Donau',
      'Main',
      'Bodensee',
      'Rhein',
      'Elbe',
      'Weser',
      'Oder',
    ])
      expect(names, name).toContain(name);
  });

  it('names the oceans and the great seas of the world, in German and English', () => {
    for (const name of [
      'Atlantischer Ozean',
      'Pazifischer Ozean',
      'Indischer Ozean',
      'Arktischer Ozean',
      'Südlicher Ozean',
      'Nordsee',
      'Ostsee',
      'Mittelmeer',
      'Schwarzes Meer',
      'Karibisches Meer',
    ])
      expect(names, name).toContain(name);
    const pacific = ATLAS.labels.find((label) => label.de === 'Pazifischer Ozean');
    expect(pacific?.en).toBe('Pacific Ocean');
  });

  it('is much denser in the European section than in the rest of the world', () => {
    // Europe: roughly x −1 800 … 1 300 km, y −7 000 … −4 450 km (SVG units).
    const inEurope = (x: number, y: number) => x > -1900 && x < 1400 && y > -7100 && y < -4400;
    const europe = ATLAS.labels.filter((label) => inEurope(label.x, label.y)).length;
    expect(europe).toBeGreaterThan(ATLAS.labels.length / 4);
    const fine = ATLAS.areas.filter((area) => area.c < 5);
    expect(fine.length).toBeGreaterThan(40);
    expect(ATLAS.rivers.length).toBeGreaterThan(3);
    expect(ATLAS.borders).toMatch(/^M/);
    expect(ATLAS.lakes).toMatch(/^M/);
  });

  it('has valid labels and areas', () => {
    for (const label of ATLAS.labels) {
      expect(label.de.length).toBeGreaterThan(0);
      expect(Number.isFinite(label.x) && Number.isFinite(label.y)).toBe(true);
      expect(label.s).toBeGreaterThan(0);
      expect([0, 1, 2]).toContain(label.r);
    }
    for (const area of ATLAS.areas) {
      expect(area.b[0]).toBeLessThanOrEqual(area.b[2]);
      expect(area.b[1]).toBeLessThanOrEqual(area.b[3]);
      expect(Boolean(area.e) !== Boolean(area.p)).toBe(true);
    }
  });
});
