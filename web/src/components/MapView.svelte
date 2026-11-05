<script lang="ts">
  /**
   * Political map of Western Europe (SPEC 12) in parchment style. Zoom and pan with mouse,
   * touch and buttons; tapping reports the geographic position. No tile server, no foreign
   * hosts (SPEC 12.2).
   */
  import type { Snippet } from 'svelte';
  import { de } from '@posteulen/shared/texts/de.ts';
  import { project, unproject } from '@posteulen/shared/map/projection.ts';
  import { MAP_DATA } from '../lib/map/map-data.ts';

  let {
    onpick,
    markers,
    label = de.map.label,
  }: {
    onpick?: (position: { lat: number; lon: number }) => void;
    markers?: Snippet<[(lat: number, lon: number) => { x: number; y: number }, number]>;
    label?: string;
  } = $props();

  const full = MAP_DATA.viewBox;
  let view = $state({ x: full[0], y: full[1], w: full[2], h: full[3] });
  let svg: SVGSVGElement | undefined = $state();
  const scale = $derived(view.w / full[2]);
  const labelMinArea = $derived(25_000 * scale * scale);

  const toSvg = (lat: number, lon: number) => {
    const p = project(lat, lon);
    return { x: p.x, y: -p.y };
  };

  function clamp(next: { x: number; y: number; w: number; h: number }) {
    const w = Math.min(full[2], Math.max(full[2] / 40, next.w));
    const h = (w / full[2]) * full[3];
    const x = Math.min(full[0] + full[2] - w, Math.max(full[0], next.x));
    const y = Math.min(full[1] + full[3] - h, Math.max(full[1], next.y));
    view = { x, y, w, h };
  }

  function zoom(factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2) {
    const w = view.w * factor;
    const h = view.h * factor;
    clamp({ x: cx - ((cx - view.x) * w) / view.w, y: cy - ((cy - view.y) * h) / view.h, w, h });
  }

  function svgPoint(clientX: number, clientY: number) {
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  // Plain Map on purpose: pointer positions are bookkeeping, not rendered state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const pointers = new Map<number, { x: number; y: number }>();

  function twoPointers(): [{ x: number; y: number }, { x: number; y: number }] | null {
    const [a, b] = [...pointers.values()];
    return a && b ? [a, b] : null;
  }
  let dragDistance = 0;
  let pinchStart = 0;

  function pointerdown(event: PointerEvent) {
    svg?.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dragDistance = 0;
    const pair = twoPointers();
    if (pointers.size === 2 && pair)
      pinchStart = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
  }

  function pointermove(event: PointerEvent) {
    const previous = pointers.get(event.pointerId);
    if (!previous || !svg) return;
    const rect = svg.getBoundingClientRect();
    if (pointers.size === 2) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pair = twoPointers();
      if (!pair) return;
      const [a, b] = pair;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0 && distance > 0) {
        const center = svgPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (center) zoom(pinchStart / distance, center.x, center.y);
        pinchStart = distance;
      }
      dragDistance = Infinity;
      return;
    }
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    dragDistance += Math.hypot(dx, dy);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (dragDistance > 6) {
      clamp({
        ...view,
        x: view.x - (dx * view.w) / rect.width,
        y: view.y - (dy * view.h) / rect.height,
      });
    }
  }

  function pointerup(event: PointerEvent) {
    const wasTap = pointers.size === 1 && dragDistance <= 6;
    pointers.delete(event.pointerId);
    if (wasTap && onpick) {
      const point = svgPoint(event.clientX, event.clientY);
      if (point) onpick(unproject(point.x, -point.y));
    }
  }

  function wheel(event: WheelEvent) {
    event.preventDefault();
    const point = svgPoint(event.clientX, event.clientY);
    zoom(event.deltaY > 0 ? 1.25 : 0.8, point?.x, point?.y);
  }

  function keydown(event: KeyboardEvent) {
    const step = view.w / 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      clamp({ ...view, x: view.x + move[0], y: view.y + move[1] });
    } else if (event.key === '+' || event.key === '=') zoom(0.8);
    else if (event.key === '-') zoom(1.25);
    else if ((event.key === 'Enter' || event.key === ' ') && onpick) {
      event.preventDefault();
      onpick(unproject(view.x + view.w / 2, -(view.y + view.h / 2)));
    }
  }
</script>

<div class="map">
  <!-- The map is an interactive widget (role "application") with full keyboard support:
       arrows pan, +/− zoom, Enter picks the centre. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svg}
    viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
    role="application"
    aria-label={label}
    tabindex="0"
    onpointerdown={pointerdown}
    onpointermove={pointermove}
    onpointerup={pointerup}
    onpointercancel={(event) => pointers.delete(event.pointerId)}
    onwheel={wheel}
    onkeydown={keydown}
  >
    <rect class="water" x={full[0]} y={full[1]} width={full[2]} height={full[3]} />
    {#each MAP_DATA.countries as country (country.id)}
      <path class="country" d={country.d} stroke-width={1.2 * scale} />
    {/each}
    <path class="lake" d={MAP_DATA.lakes} />
    {#each MAP_DATA.countries as country (country.id)}
      {#if country.label && country.area >= labelMinArea}
        <text class="label" x={country.label[0]} y={country.label[1]} font-size={34 * scale}
          >{country.name}</text
        >
      {/if}
    {/each}
    {@render markers?.(toSvg, scale)}
  </svg>
  <div class="controls">
    <button
      type="button"
      class="button secondary"
      aria-label={de.map.zoomIn}
      onclick={() => zoom(0.7)}>+</button
    >
    <button
      type="button"
      class="button secondary"
      aria-label={de.map.zoomOut}
      onclick={() => zoom(1 / 0.7)}>−</button
    >
    <button
      type="button"
      class="button secondary"
      aria-label={de.map.reset}
      onclick={() => clamp({ x: full[0], y: full[1], w: full[2], h: full[3] })}>⤢</button
    >
  </div>
</div>

<style>
  .map {
    position: relative;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 3128 / 2916;
    max-height: 70vh;
    border: 2px solid var(--line);
    border-radius: var(--radius);
    background: #b9cfd9;
    touch-action: none;
    cursor: crosshair;
  }

  .water,
  .lake {
    fill: #b9cfd9;
  }

  .country {
    fill: #f2e6c9;
    stroke: #8a6a3f;
    stroke-linejoin: round;
  }

  .label {
    fill: var(--ink-soft);
    font-family: var(--font-body);
    text-anchor: middle;
    pointer-events: none;
  }

  .controls {
    position: absolute;
    right: 0.5rem;
    top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .controls .button {
    background: var(--paper);
    padding: 0;
    width: 2.75rem;
    font-size: 1.25rem;
  }
</style>
