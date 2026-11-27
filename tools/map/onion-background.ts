/**
 * Erzeugt den Seitenhintergrund einer Tor-only-Instanz (v1.4.2, SPEC 16.6, 14): lose verstreute
 * Zwiebeln in großen und kleinen Größen, im selben Aquarell auf Büttenpapier wie die Weltkarte
 * (tools/map/background.ts) – gleiche Farben, Filter und Papierfasern, derselbe Bildausschnitt.
 * Die Verteilung ist fest (eigener Zufallsgenerator mit festem Startwert). Läuft nur auf dem
 * Entwicklungsrechner; das Ergebnis liegt im Repository: web/assets/onion-pattern.webp
 * Aufruf: node tools/map/onion-background.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = path.join(ROOT, 'web/assets/onion-pattern.webp');

/** Same size as the world map (6.5 px per degree, 360° × 150°). */
const W = 2340;
const H = 975;
const PARCHMENT = '#f4ead5';

/** Park–Miller generator: the same pattern on every run. */
let seed = 7;
const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** An onion 100 units high around (0, 0): bulb, layers, sprout and roots. */
const BULB =
  'M0,-50 C10,-30 46,-16 46,14 C46,40 26,50 0,50 C-26,50 -46,40 -46,14 C-46,-16 -10,-30 0,-50 Z';
const LINES = [
  'M0,-50 C6,-28 30,-12 30,14 C30,38 15,48 0,50',
  'M0,-50 C-6,-28 -30,-12 -30,14 C-30,38 -15,48 0,50',
  'M0,-50 C2,-26 13,-8 13,14 C13,36 6,47 0,50',
  'M0,-50 C-2,-26 -13,-8 -13,14 C-13,36 -6,47 0,50',
  'M0,-50 C-3,-60 4,-66 -2,-78 M0,-50 C4,-58 10,-62 12,-70',
  'M-7,49 L-11,59 M0,50 L0,61 M7,49 L11,59',
].join(' ');

interface Onion {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly turn: number;
}

/** Adds onions of a size range without overlaps until there are `count` in all. */
function scatter(onions: Onion[], count: number, min: number, max: number, gap: number): void {
  for (let tries = 0; onions.length < count && tries < 20_000; tries++) {
    const size = min + random() * (max - min);
    const x = 60 + random() * (W - 120);
    const y = 70 + random() * (H - 140);
    if (onions.every((o) => Math.hypot(o.x - x, o.y - y) > (o.size + size) * 55 + gap)) {
      onions.push({ x, y, size, turn: -25 + random() * 50 });
    }
  }
}

const onions: Onion[] = [];
scatter(onions, 4, 2.6, 3.4, 30);
scatter(onions, 10, 1.3, 2.0, 30);
scatter(onions, 26, 0.6, 1.0, 25);

const place = (o: Onion): string =>
  `translate(${o.x.toFixed(1)} ${o.y.toFixed(1)}) rotate(${o.turn.toFixed(1)}) scale(${o.size.toFixed(3)})`;
const fills = onions.map((o) => `<path transform="${place(o)}" d="${BULB}"/>`).join('');
const lines = onions
  .map(
    (o) =>
      `<path transform="${place(o)}" d="${LINES}" stroke-width="${(2.4 / o.size).toFixed(2)}"/>`,
  )
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <filter id="mottle" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="11"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.32  0 0 0 0 0.12  0 0 0 -2.2 1.2"/>
  </filter>
  <filter id="blot" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="5" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="14" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="rim">
    <feMorphology operator="erode" radius="4" in="SourceAlpha" result="e"/>
    <feComposite in="SourceGraphic" in2="e" operator="out" result="r"/>
    <feGaussianBlur in="r" stdDeviation="2.2"/>
  </filter>
  <filter id="fibre" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.06 0.22" numOctaves="3" seed="21"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.28  0 0 0 0 0.12  0 0 0 -2.5 1.3"/>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="${PARCHMENT}"/>
<rect width="${W}" height="${H}" filter="url(#mottle)" opacity="0.22"/>
<g filter="url(#blot)">
  <g fill="#8a5e2c" opacity="0.08">${fills}</g>
  <g opacity="0.2" filter="url(#rim)"><g fill="#5a3a1a">${fills}</g></g>
  <g fill="none" stroke="#5a3a1a" stroke-linecap="round" opacity="0.13">${lines}</g>
</g>
<rect width="${W}" height="${H}" filter="url(#fibre)" opacity="0.22"/>
</svg>`;

await sharp(Buffer.from(svg)).webp({ quality: 78, effort: 6 }).toFile(OUT);
console.log(`${path.relative(ROOT, OUT)}: ${W}×${H}, ${fs.statSync(OUT).size} Bytes`);
