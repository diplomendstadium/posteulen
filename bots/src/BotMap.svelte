<script lang="ts">
  /**
   * v0.8: world map of the control centre (Equal Earth, the data of the game map): bot owls on
   * their way, homes of bots as diamonds; tapping chooses a place (home or move of a bot).
   */
  import { onMount } from 'svelte';
  import { project, unproject } from '@posteulen/shared/map/projection.ts';
  import { t } from '../../admin/src/lib/i18n.svelte.ts';
  import type { MapHome, MapOwl } from './lib/types.ts';

  let {
    owls = [],
    homes = [],
    marker = null,
    onpick,
  }: {
    owls?: readonly MapOwl[];
    homes?: readonly MapHome[];
    marker?: { lat: number; lon: number } | null;
    onpick?: (place: { lat: number; lon: number }) => void;
  } = $props();

  interface World {
    viewBox: [number, number, number, number];
    outline: string;
    countries: { id: string; d: string }[];
  }
  let world = $state<World | null>(null);
  let svg = $state<SVGSVGElement | null>(null);
  let zoom = $state(1);
  let centre = $state<{ x: number; y: number } | null>(null);

  onMount(() => {
    void import('../../web/src/lib/map/world.json').then((module) => {
      world = (module.default ?? module) as unknown as World;
    });
  });

  const view = $derived.by(() => {
    if (!world) return '0 0 1 1';
    const [x, y, w, h] = world.viewBox;
    const cx = centre?.x ?? x + w / 2;
    const cy = centre?.y ?? y + h / 2;
    const vw = w / zoom;
    const vh = h / zoom;
    return `${cx - vw / 2} ${cy - vh / 2} ${vw} ${vh}`;
  });

  const at = (lat: number, lon: number) => {
    const p = project(lat, lon);
    return { x: p.x, y: -p.y };
  };
  const size = $derived(world ? world.viewBox[2] / 160 / zoom : 100);

  function pick(event: MouseEvent): void {
    if (!onpick || !svg) return;
    const matrix = svg.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const place = unproject(point.x, -point.y);
    onpick({ lat: Math.round(place.lat * 100) / 100, lon: Math.round(place.lon * 100) / 100 });
  }

  function zoomBy(factor: number): void {
    zoom = Math.min(40, Math.max(1, zoom * factor));
    if (marker && zoom > 1) centre = at(marker.lat, marker.lon);
  }
</script>

<div class="map">
  <p class="zoom">
    <button class="button secondary" type="button" onclick={() => zoomBy(2)}
      >{t.centre.zoomIn}</button
    >
    <button class="button secondary" type="button" onclick={() => zoomBy(0.5)}
      >{t.centre.zoomOut}</button
    >
    <button
      class="button secondary"
      type="button"
      onclick={() => {
        zoom = 1;
        centre = null;
      }}>{t.centre.mapReset}</button
    >
  </p>
  {#if world}
    {#if onpick}
      <button class="pick" type="button" aria-label={t.centre.homeHint} onclick={pick}>
        <svg bind:this={svg} viewBox={view} role="img" aria-label={t.centre.mapLabel}>
          <path class="sea" d={world.outline} />
          {#each world.countries as country (country.id)}
            <path class="land" d={country.d} />
          {/each}
          {#each homes as home (home.id)}
            {@const p = at(home.lat, home.lon)}
            <rect
              class="home"
              x={p.x - size / 2}
              y={p.y - size / 2}
              width={size}
              height={size}
              transform={`rotate(45 ${p.x} ${p.y})`}><title>{home.name}</title></rect
            >
          {/each}
          {#each owls as owl, index (index)}
            {@const p = at(owl.lat, owl.lon)}
            <circle class={`owl ${owl.state}`} cx={p.x} cy={p.y} r={size / 1.6}
              ><title
                >{owl.botName}: {owl.owl} – {t.centre[`owl_${owl.state}`]}{owl.sleeping
                  ? `, ${t.centre.owlSleeping}`
                  : ''}</title
              ></circle
            >
          {/each}
          {#if marker}
            {@const p = at(marker.lat, marker.lon)}
            <circle class="marker" cx={p.x} cy={p.y} r={size} />
          {/if}
        </svg>
      </button>
    {:else}
      <svg bind:this={svg} viewBox={view} role="img" aria-label={t.centre.mapLabel}>
        <path class="sea" d={world.outline} />
        {#each world.countries as country (country.id)}
          <path class="land" d={country.d} />
        {/each}
        {#each homes as home (home.id)}
          {@const p = at(home.lat, home.lon)}
          <rect
            class="home"
            x={p.x - size / 2}
            y={p.y - size / 2}
            width={size}
            height={size}
            transform={`rotate(45 ${p.x} ${p.y})`}><title>{home.name}</title></rect
          >
        {/each}
        {#each owls as owl, index (index)}
          {@const p = at(owl.lat, owl.lon)}
          <circle class={`owl ${owl.state}`} cx={p.x} cy={p.y} r={size / 1.6}
            ><title
              >{owl.botName}: {owl.owl} – {t.centre[`owl_${owl.state}`]}{owl.sleeping
                ? `, ${t.centre.owlSleeping}`
                : ''}</title
            ></circle
          >
        {/each}
        {#if marker}
          {@const p = at(marker.lat, marker.lon)}
          <circle class="marker" cx={p.x} cy={p.y} r={size} />
        {/if}
      </svg>
    {/if}
  {:else}
    <p>{t.centre.loading}</p>
  {/if}
</div>

<style>
  .pick {
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    background: none;
    cursor: crosshair;
  }

  .map svg {
    width: 100%;
    height: auto;
    aspect-ratio: 2 / 1;
    background: var(--paper);
    border: 2px solid var(--wood-dark);
    border-radius: 0.5rem;
  }

  .sea {
    fill: #c9dbe4;
  }

  .land {
    fill: #efe2c2;
    stroke: #8a6d3b;
    stroke-width: 0.6;
    vector-effect: non-scaling-stroke;
  }

  .home {
    fill: var(--wood-dark);
  }

  .owl.flying {
    fill: #1f5f8b;
  }

  .owl.resting {
    fill: #2e7d32;
  }

  .owl.returning {
    fill: #9c4f00;
  }

  .marker {
    fill: none;
    stroke: var(--seal);
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
  }

  .zoom {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
</style>
