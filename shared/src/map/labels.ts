/**
 * Label placement for map markers: greedy, without overlaps where possible. Each label tries
 * above, below, right and left of its marker (then further above and below) and takes the first
 * spot that collides neither with labels placed before nor with any marker. Cities (v0.2) come
 * second: their names appear only where they collide with nothing, otherwise they wait until
 * the map is zoomed in further. Pure functions, coordinates in SVG units.
 */
export interface LabelRequest {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  /** Marker radius (half the marker size). */
  readonly radius: number;
  readonly text: string;
  readonly fontSize: number;
}

export interface PlacedLabel {
  readonly key: string;
  /** Text anchor point (`text-anchor: middle`, baseline). */
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Average glyph width of the body font relative to the font size (generous). */
const GLYPH_WIDTH = 0.56;

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function labelBox(x: number, y: number, width: number, fontSize: number): Box {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - fontSize,
    bottom: y + fontSize * 0.3,
  };
}

export function placeLabels(requests: readonly LabelRequest[]): PlacedLabel[] {
  const markers: Box[] = requests.map((request) => ({
    left: request.x - request.radius,
    right: request.x + request.radius,
    top: request.y - request.radius,
    bottom: request.y + request.radius,
  }));
  const placed: Box[] = [];
  return requests.map((request, index) => {
    const width = Array.from(request.text).length * request.fontSize * GLYPH_WIDTH;
    const gap = request.fontSize * 0.25;
    const line = request.fontSize * 1.3;
    const above = request.y - request.radius - gap;
    const below = request.y + request.radius + gap + request.fontSize;
    const side = request.y + request.fontSize * 0.35;
    // Close to the marker first; with many neighbours, stack further out.
    const first: [number, number] = [request.x, above];
    const candidates: readonly [number, number][] = [
      first,
      [request.x, below],
      [request.x + request.radius + gap + width / 2, side],
      [request.x - request.radius - gap - width / 2, side],
      ...[1, 2, 3].flatMap((level): [number, number][] => [
        [request.x, above - level * line],
        [request.x, below + level * line],
      ]),
    ];
    const free = candidates.find(([x, y]) => {
      const box = labelBox(x, y, width, request.fontSize);
      return (
        !placed.some((other) => overlaps(box, other)) &&
        !markers.some((marker, other) => other !== index && overlaps(box, marker))
      );
    });
    const [x, y] = free ?? first;
    placed.push(labelBox(x, y, width, request.fontSize));
    return { key: request.key, x, y };
  });
}

/** Marker and label boxes of placed labels – the space city names must keep clear of. */
export function occupiedBoxes(
  requests: readonly LabelRequest[],
  placed: readonly PlacedLabel[],
): Box[] {
  return requests.flatMap((request, index) => {
    const label = placed[index];
    const width = Array.from(request.text).length * request.fontSize * GLYPH_WIDTH;
    const marker = {
      left: request.x - request.radius,
      right: request.x + request.radius,
      top: request.y - request.radius,
      bottom: request.y + request.radius,
    };
    return label ? [marker, labelBox(label.x, label.y, width, request.fontSize)] : [marker];
  });
}

export interface CityRequest {
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fontSize: number;
  /** Radius of the city dot. */
  readonly radius: number;
}

/**
 * City names in order of importance (largest first): right, left, above or below the dot,
 * wherever they hit neither `blocked` (own places, owls and their names), nor another city
 * name, nor another city dot. Names without room are left out (they appear once there is room).
 */
export function placeCityLabels(
  cities: readonly CityRequest[],
  blocked: readonly Box[],
): PlacedLabel[] {
  const dots: Box[] = cities.map((city) => ({
    left: city.x - city.radius,
    right: city.x + city.radius,
    top: city.y - city.radius,
    bottom: city.y + city.radius,
  }));
  const placed: Box[] = [];
  const result: PlacedLabel[] = [];
  cities.forEach((city, index) => {
    const width = Array.from(city.text).length * city.fontSize * GLYPH_WIDTH;
    const gap = city.fontSize * 0.25;
    const side = city.y + city.fontSize * 0.35;
    const candidates: readonly [number, number][] = [
      [city.x + city.radius + gap + width / 2, side],
      [city.x - city.radius - gap - width / 2, side],
      [city.x, city.y - city.radius - gap],
      [city.x, city.y + city.radius + gap + city.fontSize],
    ];
    const free = candidates.find(([x, y]) => {
      const box = labelBox(x, y, width, city.fontSize);
      return (
        !blocked.some((other) => overlaps(box, other)) &&
        !placed.some((other) => overlaps(box, other)) &&
        !dots.some((dot, other) => other !== index && overlaps(box, dot))
      );
    });
    if (!free) return;
    placed.push(labelBox(free[0], free[1], width, city.fontSize));
    result.push({ key: city.key, x: free[0], y: free[1] });
  });
  return result;
}
