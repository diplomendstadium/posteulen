/**
 * Erzeugt den Seitenhintergrund (v0.3): eine verblasste Weltkarte als Aquarell auf grobem
 * Büttenpapier – heller Farbschleier, dunklerer Trocknungsrand, Papierfasern. Die Grundfarbe
 * der Seite bleibt; Texte stehen immer in Boxen. Läuft nur auf dem Entwicklungsrechner; das
 * Ergebnis liegt im Repository: web/assets/world-map.webp
 * Aufruf: node tools/map/background.ts
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '../..');
const CACHE = path.join(import.meta.dirname, '.cache');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson';
const NAME = 'ne_110m_land';
const OUT = path.join(ROOT, 'web/assets/world-map.webp');

/** Equirectangular, 6.5 px per degree, from 82° N to 68° S. */
const K = 6.5;
const TOP = 82;
const W = Math.round(360 * K);
const H = Math.round(150 * K);
const PARCHMENT = '#f4ead5';

type Ring = [number, number][];
interface Feature {
  geometry:
    { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
}

async function load(): Promise<Feature[]> {
  const sources = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, 'sources.json'), 'utf8'),
  ) as Record<string, string>;
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, `${NAME}.geojson`);
  if (!fs.existsSync(file)) {
    const response = await fetch(`${BASE}/${NAME}.geojson`);
    if (!response.ok) throw new Error(`download failed: ${NAME}`);
    fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const data = fs.readFileSync(file);
  const digest = crypto.createHash('sha256').update(data).digest('hex');
  if (digest !== sources[NAME]) throw new Error(`${NAME}: Prüfsumme stimmt nicht (${digest})`);
  return (JSON.parse(data.toString('utf8')) as { features: Feature[] }).features;
}

function pathData(features: Feature[]): string {
  const point = ([lon, lat]: [number, number]): string =>
    `${((lon + 180) * K).toFixed(1)} ${((TOP - lat) * K).toFixed(1)}`;
  let d = '';
  for (const feature of features) {
    const polygons =
      feature.geometry.type === 'Polygon'
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    for (const polygon of polygons) {
      for (const ring of polygon) {
        if (ring.every(([, lat]) => lat < -60)) continue;
        d += `M${ring.map(point).join('L')}Z`;
      }
    }
  }
  return d;
}

function svg(d: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
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
  <path d="${d}" fill="#8a5e2c" opacity="0.08"/>
  <g opacity="0.2" filter="url(#rim)"><path d="${d}" fill="#5a3a1a"/></g>
</g>
<rect width="${W}" height="${H}" filter="url(#fibre)" opacity="0.22"/>
</svg>`;
}

const features = await load();
await sharp(Buffer.from(svg(pathData(features))))
  .webp({ quality: 78, effort: 6 })
  .toFile(OUT);
console.log(`${path.relative(ROOT, OUT)}: ${W}×${H}, ${fs.statSync(OUT).size} Bytes`);
