import { describe, expect, it } from 'vitest';
import { placeLabels, type LabelRequest } from '../src/map/labels.ts';

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
