import { describe, expect, it } from 'vitest';
import {
  occupiedBoxes,
  placeCityLabels,
  placeLabels,
  type CityRequest,
  type LabelRequest,
} from '../src/map/labels.ts';

const label = (key: string, x: number, y: number, text = 'Name'): LabelRequest => ({
  key,
  x,
  y,
  radius: 10,
  text,
  fontSize: 20,
});

describe('placeLabels (Karte)', () => {
  it('setzt einzelne Beschriftungen über den Marker', () => {
    expect(placeLabels([label('a', 100, 100)])).toEqual([{ key: 'a', x: 100, y: 85 }]);
  });

  it('nahe Marker: Beschriftungen überlappen sich nicht', () => {
    const requests = [
      label('a', 100, 100, 'Dein Wohnort'),
      label('b', 104, 102, 'Eule Waldi'),
      label('c', 98, 99, 'Tante Alessia (Bot)'),
      label('d', 101, 101, 'Erklärbär (Bot)'),
    ];
    const placed = placeLabels(requests);
    expect(placed.map((p) => p.key)).toEqual(['a', 'b', 'c', 'd']);
    const boxes = placed.map((p, i) => {
      const width = Array.from(requests[i]!.text).length * 20 * 0.56;
      return { left: p.x - width / 2, right: p.x + width / 2, top: p.y - 20, bottom: p.y + 6 };
    });
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i]!, boxes[j]!];
        const overlap =
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlap, `${i}/${j}`).toBe(false);
      }
  });

  it('nimmt den Platz über dem Marker, wenn nichts frei ist', () => {
    const crowd = Array.from({ length: 13 }, (_, i) => label(String(i), 100 + i, 100));
    const placed = placeLabels(crowd);
    expect(placed[12]).toEqual({ key: '12', x: 112, y: 85 });
  });

  it('weit entfernte Marker beeinflussen sich nicht', () => {
    const placed = placeLabels([label('a', 0, 0), label('b', 1000, 1000)]);
    expect(placed).toEqual([
      { key: 'a', x: 0, y: -15 },
      { key: 'b', x: 1000, y: 985 },
    ]);
  });
});

describe('placeCityLabels (Karte, v0.2)', () => {
  const city = (key: string, x: number, y: number, text = 'Stadt'): CityRequest => ({
    key,
    x,
    y,
    text,
    fontSize: 10,
    radius: 2,
  });

  it('puts the name right of the dot when there is room', () => {
    const [placed] = placeCityLabels([city('a', 0, 0)], []);
    expect(placed?.key).toBe('a');
    expect(placed!.x).toBeGreaterThan(0);
  });

  it('leaves out names that would hit own places, owls or their names', () => {
    const own: LabelRequest[] = [
      { key: 'home', x: 0, y: 0, radius: 10, text: 'Zuhause', fontSize: 10 },
    ];
    const blocked = occupiedBoxes(own, placeLabels(own));
    expect(blocked).toHaveLength(2);
    // A city right under the home marker: every spot around its dot collides.
    expect(placeCityLabels([city('a', 0, 0)], blocked)).toEqual([]);
    expect(placeCityLabels([city('b', 500, 500)], blocked)).toHaveLength(1);
  });

  it('bigger cities win; crowded smaller ones wait for more zoom', () => {
    // Three cities on top of each other: the first two take right and left, the third waits.
    const crowd = [city('gross', 0, 0, 'Großstadt'), city('mittel', 1, 0), city('klein', 2, 0)];
    expect(placeCityLabels(crowd, []).map((label) => label.key)).toEqual(['gross', 'mittel']);
    // Zoomed in, the same cities are further apart on the screen: all names fit.
    const zoomed = [city('gross', 0, 0, 'Großstadt'), city('mittel', 0, 60), city('klein', 0, 120)];
    expect(placeCityLabels(zoomed, []).map((label) => label.key)).toEqual([
      'gross',
      'mittel',
      'klein',
    ]);
  });
});
