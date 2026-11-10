<script lang="ts">
  /**
   * v0.8: world map of the control centre: bot owls on their way, homes of bots as diamonds;
   * tapping chooses a place (home or move of a bot).
   * v0.8.3: the map of the game itself (MapView) with its controls – drag to pan, mouse wheel,
   * two fingers, keyboard and the buttons; in the language of the panel.
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
        <circle
          class={`owl ${owl.state}`}
          cx={p.x}
          cy={p.y}
          r={6 * scale}
          stroke-width={1.5 * scale}
          ><title
            >{owl.botName}: {owl.owl} – {t.centre[`owl_${owl.state}`]}{owl.sleeping
              ? `, ${t.centre.owlSleeping}`
              : ''}</title
          ></circle
        >
      {/each}
      {#if marker}
        {@const p = toSvg(marker.lat, marker.lon)}
        <circle class="marker" cx={p.x} cy={p.y} r={11 * scale} stroke-width={3 * scale} />
      {/if}
    {/snippet}
  </MapView>
</div>

<style>
  .bot-map {
    margin-block: 0.5rem;
    max-width: 48rem;
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
</style>
