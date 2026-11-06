<script lang="ts">
  /**
   * Map (SPEC 12.1): own home, contacts, own owls on the way, day and night. Positions and
   * the night areas are recomputed every 10 minutes from the flight plans – no server request.
   */
  import { onDestroy } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { MAP, TIME } from '@posteulen/shared/constants.ts';
  import { positionAt } from '@posteulen/shared/game/flight.ts';
  import { placeLabels, type LabelRequest } from '@posteulen/shared/map/labels.ts';
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

  type ToSvg = (lat: number, lon: number) => { x: number; y: number };

  /** Marker positions and non-overlapping label positions for the current zoom. */
  function layout(map: MapInfo, toSvg: ToSvg, scale: number) {
    const home = toSvg(map.home.lat, map.home.lon);
    const flying = owls.flatMap(({ flight, at }) =>
      at ? [{ flight, p: toSvg(at.position.lat, at.position.lon) }] : [],
    );
    const contacts = map.contacts.map((contact) => ({
      contact,
      p: toSvg(contact.lat, contact.lon),
      text: `${contact.name ?? de.letters.unknown}${contact.bot ? ` (${de.bots.label})` : ''}`,
    }));
    const requests: LabelRequest[] = [
      {
        key: 'home',
        x: home.x,
        y: home.y,
        radius: 18 * scale,
        text: de.map.legendHome,
        fontSize: 46 * scale,
      },
      ...flying.map(({ flight, p }) => ({
        key: `owl-${flight.id}`,
        x: p.x,
        y: p.y,
        radius: 24 * scale,
        text: flight.owl.name,
        fontSize: 42 * scale,
      })),
      ...contacts.map(({ contact, p, text }) => ({
        key: `contact-${contact.id}`,
        x: p.x,
        y: p.y,
        radius: 18 * scale,
        text,
        fontSize: 46 * scale,
      })),
    ];
    const labels = new Map(placeLabels(requests).map((label) => [label.key, label]));
    const at = (key: string) => labels.get(key) ?? { x: 0, y: 0 };
    return { home, homeLabel: at('home'), flying, contacts, at };
  }

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
      {@const view = layout(info, toSvg, scale)}
      {#each view.contacts as { contact, p, text } (contact.id)}
        {@const label = view.at(`contact-${contact.id}`)}
        <g class="contact" class:bot={contact.bot}>
          {#if contact.bot}
            <!-- Bots: a diamond, distinguishable from people without colour (SPEC 14). -->
            <polygon
              points={`${p.x},${p.y - 20 * scale} ${p.x + 20 * scale},${p.y} ${p.x},${p.y + 20 * scale} ${p.x - 20 * scale},${p.y}`}
              stroke-width={4 * scale}
            />
          {:else}
            <circle cx={p.x} cy={p.y} r={16 * scale} stroke-width={4 * scale} />
          {/if}
          <text x={label.x} y={label.y} font-size={46 * scale}>{text}</text>
        </g>
      {/each}
      <g class="home">
        <rect
          x={view.home.x - 18 * scale}
          y={view.home.y - 18 * scale}
          width={36 * scale}
          height={36 * scale}
          stroke-width={3 * scale}
        />
        <text x={view.homeLabel.x} y={view.homeLabel.y} font-size={46 * scale}
          >{de.map.legendHome}</text
        >
      </g>
      {#each view.flying as { flight, p } (flight.id)}
        {@const label = view.at(`owl-${flight.id}`)}
        <g class="owl" data-testid="map-owl">
          <circle cx={p.x} cy={p.y} r={24 * scale} stroke-width={4 * scale} />
          <text class="owl-glyph" x={p.x} y={p.y + 13 * scale} font-size={36 * scale}>🦉</text>
          <text x={label.x} y={label.y} font-size={42 * scale}>{flight.owl.name}</text>
        </g>
      {/each}
    {/if}
  {/snippet}
</MapView>

<ul class="legend">
  <li><span class="key home-key" aria-hidden="true"></span>{de.map.legendHome}</li>
  <li><span class="key contact-key" aria-hidden="true"></span>{de.map.legendContact}</li>
  <li><span class="key bot-key" aria-hidden="true"></span>{de.map.legendBot}</li>
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
  .contact.bot polygon {
    fill: var(--parchment-deep);
    stroke: var(--wood-dark);
  }

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

  .bot-key {
    width: 0.8rem;
    height: 0.8rem;
    margin: 0 0.1rem;
    transform: rotate(45deg);
    background: var(--parchment-deep);
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
