<script lang="ts">
  /**
   * v0.8: world map of the control centre: bot owls on their way, homes of bots as diamonds;
   * tapping chooses a place (home or move of a bot).
   * v0.8.3: the map of the game itself (MapView) with its controls – drag to pan, mouse wheel,
   * two fingers, keyboard and the buttons; in the language of the panel.
   * v0.8.5: like the maps of the players it fits into the window (the page scrolls past it),
   * and a legend explains the markers – told apart by shape as well as colour (SPEC 14).
   */
  import MapView from '../../web/src/components/MapView.svelte';
  import { panel, t } from '../../admin/src/lib/i18n.svelte.ts';
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

  /** A picked place is rounded to hundredths of a degree (as stored, SPEC 10.6). */
  function picked(place: { lat: number; lon: number }): void {
    onpick?.({ lat: Math.round(place.lat * 100) / 100, lon: Math.round(place.lon * 100) / 100 });
  }

  /**
   * v0.8.5: flying out a circle, resting a square, flying back a triangle – readable in
   * greyscale too.
   */
  function shape(state: MapOwl['state'], x: number, y: number, r: number): string {
    if (state === 'resting') return `M${x - r},${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
    if (state === 'returning')
      return `M${x},${y - 1.2 * r}L${x + 1.15 * r},${y + 0.85 * r}L${x - 1.15 * r},${y + 0.85 * r}Z`;
    return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
  }

  /** Opens on the chosen place, if there is one (otherwise the whole world; fitted once). */
  const fit = $derived(marker ? [marker] : null);
</script>

<div class="bot-map">
  <MapView
    lang={panel.lang}
    texts={t.map}
    wide
    label={onpick ? `${t.centre.mapLabel} – ${t.centre.homeHint}` : t.centre.mapLabel}
    {...onpick ? { onpick: picked } : {}}
    {fit}
  >
    {#snippet markers(toSvg, scale)}
      {#each homes as home (home.id)}
        {@const p = toSvg(home.lat, home.lon)}
        {@const size = 10 * scale}
        <rect
          class="home"
          x={p.x - size / 2}
          y={p.y - size / 2}
          width={size}
          height={size}
          stroke-width={1.5 * scale}
          transform={`rotate(45 ${p.x} ${p.y})`}><title>{home.name}</title></rect
        >
      {/each}
      {#each owls as owl, index (index)}
        {@const p = toSvg(owl.lat, owl.lon)}
        {@const r = 7 * scale}
        <path
          class={`owl ${owl.state}`}
          d={shape(owl.state, p.x, p.y, r)}
          stroke-width={1.5 * scale}
          ><title
            >{owl.botName}: {owl.owl} – {t.centre[`owl_${owl.state}`]}{owl.sleeping
              ? `, ${t.centre.owlSleeping}`
              : ''}</title
          ></path
        >
      {/each}
      {#if marker}
        {@const p = toSvg(marker.lat, marker.lon)}
        <circle class="marker" cx={p.x} cy={p.y} r={11 * scale} stroke-width={3 * scale} />
      {/if}
    {/snippet}
  </MapView>
  <ul class="legend" aria-label={t.centre.legendTitle}>
    {#if onpick}
      <li><span class="key marker-key" aria-hidden="true"></span>{t.centre.legendPicked}</li>
    {:else}
      <li><span class="key home-key" aria-hidden="true"></span>{t.centre.legendHome}</li>
      <li><span class="key flying-key" aria-hidden="true"></span>{t.centre.legendFlying}</li>
      <li><span class="key resting-key" aria-hidden="true"></span>{t.centre.legendResting}</li>
      <li>
        <span class="key returning-key" aria-hidden="true"></span>{t.centre.legendReturning}
      </li>
    {/if}
  </ul>
</div>

<style>
  .bot-map {
    margin-block: 0.5rem;
  }

  .home {
    fill: var(--wood-dark);
    stroke: var(--paper);
  }

  .owl {
    stroke: var(--paper);
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
  }

  .legend {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    padding: 0;
    margin: 0.75rem 0 0;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .key {
    display: inline-block;
    flex: none;
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--paper);
    outline: 1px solid var(--line);
  }

  .home-key {
    width: 0.8rem;
    height: 0.8rem;
    margin: 0.1rem;
    background: var(--wood-dark);
    transform: rotate(45deg);
  }

  .flying-key {
    border-radius: 50%;
    background: #1f5f8b;
  }

  .resting-key {
    background: #2e7d32;
  }

  .returning-key {
    border: none;
    outline: none;
    background: #9c4f00;
    clip-path: polygon(50% 0, 100% 100%, 0 100%);
  }

  .marker-key {
    border: 3px solid var(--seal);
    outline: none;
    border-radius: 50%;
    background: none;
  }
</style>
