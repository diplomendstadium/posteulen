<script lang="ts">
  /**
   * Map (SPEC 12.1): own home, contacts, own owls on the way, day and night. Positions and
   * the night areas are recomputed every 10 minutes from the flight plans – no server request.
   */
  import { onDestroy } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { MAP, TIME } from '@posteulen/shared/constants.ts';
  import { positionAt } from '@posteulen/shared/game/flight.ts';
  import MapView from '../components/MapView.svelte';
  import { mapInfo, type MapFlight, type MapInfo } from '../lib/owls.ts';
  import { dateTime, time } from '../lib/format.ts';
  import { live } from '../lib/live.svelte.ts';

  let info = $state<MapInfo | null>(null);
  let now = $state(Date.now());

  async function load(): Promise<void> {
    try {
      info = await mapInfo();
      now = Date.now();
    } catch {
      // Loaded again with the next update.
    }
  }

  $effect(() => {
    void live.mapVersion;
    void load();
  });

  const timer = setInterval(() => {
    if (document.visibilityState === 'visible') now = Date.now();
  }, MAP.CLIENT_REFRESH_MINUTES * TIME.MINUTE);
  onDestroy(() => clearInterval(timer));

  const owls = $derived(
    (info?.flights ?? []).map((flight) => ({ flight, at: positionAt(flight.segments, now) })),
  );

  const purposeText = (flight: MapFlight): string =>
    flight.purpose === 'gold'
      ? de.map.purposeGold
      : flight.purpose === 'gift'
        ? de.map.purposeGift
        : de.map.purposeLetter;

  function whereText(flight: MapFlight, phase: string | undefined): string {
    const next = flight.stops.find((stop) => stop.status === 'pending');
    const parts: string[] = [];
    if (phase === 'sleep') parts.push(de.map.sleeping);
    if (next?.type === 'deliver') {
      parts.push(
        fill(de.map.nextStop, {
          name: next.name ?? de.letters.unknown,
          time: dateTime(next.arrivesAt),
        }),
      );
    } else if (next) {
      parts.push(fill(de.map.homeAt, { time: dateTime(next.arrivesAt) }));
    }
    return parts.join(', ');
  }
</script>

<MapView nightAt={now}>
  {#snippet markers(toSvg, scale)}
    {#if info}
      {#each info.contacts as contact (contact.id)}
        {@const p = toSvg(contact.lat, contact.lon)}
        <g class="contact">
          <circle cx={p.x} cy={p.y} r={9 * scale} stroke-width={3 * scale} />
          <text x={p.x} y={p.y - 16 * scale} font-size={26 * scale}
            >{contact.name ?? de.letters.unknown}</text
          >
        </g>
      {/each}
      {@const home = toSvg(info.home.lat, info.home.lon)}
      <g class="home">
        <rect
          x={home.x - 11 * scale}
          y={home.y - 11 * scale}
          width={22 * scale}
          height={22 * scale}
          stroke-width={3 * scale}
        />
        <text x={home.x} y={home.y - 18 * scale} font-size={26 * scale}>{de.map.legendHome}</text>
      </g>
      {#each owls as { flight, at } (flight.id)}
        {#if at}
          {@const p = toSvg(at.position.lat, at.position.lon)}
          <g class="owl" data-testid="map-owl">
            <circle cx={p.x} cy={p.y} r={13 * scale} stroke-width={3 * scale} />
            <text class="owl-glyph" x={p.x} y={p.y + 7 * scale} font-size={20 * scale}>🦉</text>
            <text x={p.x} y={p.y + 36 * scale} font-size={24 * scale}>{flight.owl.name}</text>
          </g>
        {/if}
      {/each}
    {/if}
  {/snippet}
</MapView>

<ul class="legend">
  <li><span class="key home-key" aria-hidden="true"></span>{de.map.legendHome}</li>
  <li><span class="key contact-key" aria-hidden="true"></span>{de.map.legendContact}</li>
  <li><span class="key owl-key" aria-hidden="true"></span>{de.map.legendOwl}</li>
  <li><span class="key night-key" aria-hidden="true"></span>{de.map.legendNight}</li>
</ul>

<section aria-labelledby="flights-title">
  <h2 id="flights-title">{de.map.flightsTitle}</h2>
  {#if owls.length === 0}
    <p>{de.map.flightsNone}</p>
  {:else}
    <ul class="flights">
      {#each owls as { flight, at } (flight.id)}
        <li>
          {fill(de.map.flightLine, {
            owl: flight.owl.name,
            purpose: purposeText(flight),
            where: whereText(flight, at?.phase),
          })}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="hint">{fill(de.map.updated, { time: time(now) })}</p>
</section>

<style>
  .contact circle {
    fill: var(--paper);
    stroke: var(--wood-dark);
  }

  .home rect {
    fill: var(--seal);
    stroke: var(--paper);
  }

  .owl circle {
    fill: var(--wood);
    stroke: var(--paper);
  }

  text {
    text-anchor: middle;
    fill: var(--ink);
    font-family: var(--font-body);
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 0.25em;
    pointer-events: none;
  }

  .owl-glyph {
    stroke: none;
  }

  .legend {
    list-style: none;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    margin: 0.75rem 0;
  }

  .legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .key {
    display: inline-block;
    width: 1rem;
    height: 1rem;
    border: 2px solid var(--wood-dark);
  }

  .home-key {
    background: var(--seal);
  }

  .contact-key {
    border-radius: 50%;
    background: var(--paper);
  }

  .owl-key {
    border-radius: 50%;
    background: var(--wood);
  }

  .night-key {
    background: rgb(25 30 70 / 28%);
  }

  .hint {
    color: var(--ink-soft);
  }
</style>
