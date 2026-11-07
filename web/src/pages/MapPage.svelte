<script lang="ts">
  /**
   * Map (SPEC 12.1): own home, contacts, own owls on the way with the path flown so far and
   * their overnight stops (v0.3), day and night. Positions, paths and the night areas are
   * recomputed every 5 minutes from the flight plans – no server request.
   */
  import { onDestroy } from 'svelte';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { MAP, TIME } from '@posteulen/shared/constants.ts';
  import { positionAt, segmentsUntil } from '@posteulen/shared/game/flight.ts';
  import { distanceKm, interpolate, type Point } from '@posteulen/shared/game/geo.ts';
  import { occupiedBoxes, placeLabels, type LabelRequest } from '@posteulen/shared/map/labels.ts';
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

  /**
   * The part of each flight that lies behind the owl (v0.3): a path along the great circles
   * and the places where it slept. The route still ahead is never drawn.
   */
  const tracks = $derived(
    owls.map(({ flight }) => {
      const points: Point[] = [];
      const sleeps: Point[] = [];
      for (const segment of segmentsUntil(flight.segments, now)) {
        if (segment.kind === 'sleep') {
          sleeps.push(segment.at);
          continue;
        }
        if (segment.kind !== 'fly') continue;
        const steps = Math.max(1, Math.ceil(distanceKm(segment.from, segment.to) / 40));
        for (let i = points.length === 0 ? 0 : 1; i <= steps; i++)
          points.push(interpolate(segment.from, segment.to, i / steps));
      }
      return { id: flight.id, points, sleeps };
    }),
  );

  type ToSvg = (lat: number, lon: number) => { x: number; y: number };

  /** Sizes in screen pixels (v0.2: readable on phones); `scale` converts to SVG units. */
  const SIZE = {
    home: 10,
    contact: 9,
    bot: 11,
    owl: 14,
    font: 16,
    owlFont: 15,
    glyph: 19,
    track: 2,
    zzz: 13,
  };

  /** Everything the user knows: the map opens just wide enough to show it all (v0.2). */
  const fit = $derived(
    info
      ? [
          info.home,
          ...info.contacts.map((contact) => ({ lat: contact.lat, lon: contact.lon })),
          ...owls.flatMap(({ at }) => (at ? [at.position] : [])),
        ]
      : null,
  );

  /** Marker positions and non-overlapping label positions for the current zoom. */
  function layout(map: MapInfo, toSvg: ToSvg, scale: number) {
    const home = toSvg(map.home.lat, map.home.lon);
    const flying = owls.flatMap(({ flight, at }) =>
      at ? [{ flight, p: toSvg(at.position.lat, at.position.lon) }] : [],
    );
    const contacts = map.contacts.map((contact) => ({
      contact,
      p: toSvg(contact.lat, contact.lon),
      text: `${contact.name ?? t.letters.unknown}${contact.bot ? ` (${t.bots.label})` : ''}`,
    }));
    const requests: LabelRequest[] = [
      {
        key: 'home',
        x: home.x,
        y: home.y,
        radius: SIZE.home * scale,
        text: t.map.legendHome,
        fontSize: SIZE.font * scale,
      },
      ...flying.map(({ flight, p }) => ({
        key: `owl-${flight.id}`,
        x: p.x,
        y: p.y,
        radius: SIZE.owl * scale,
        text: flight.owl.name,
        fontSize: SIZE.owlFont * scale,
      })),
      ...contacts.map(({ contact, p, text }) => ({
        key: `contact-${contact.id}`,
        x: p.x,
        y: p.y,
        radius: SIZE.bot * scale,
        text,
        fontSize: SIZE.font * scale,
      })),
    ];
    const placed = placeLabels(requests);
    const labels = new Map(placed.map((label) => [label.key, label]));
    const at = (key: string) => labels.get(key) ?? { x: 0, y: 0 };
    return {
      home,
      homeLabel: at('home'),
      flying,
      contacts,
      at,
      occupied: occupiedBoxes(requests, placed),
    };
  }

  const purposeText = (flight: MapFlight): string =>
    flight.purpose === 'gold'
      ? t.map.purposeGold
      : flight.purpose === 'gift'
        ? t.map.purposeGift
        : t.map.purposeLetter;

  function whereText(flight: MapFlight, phase: string | undefined): string {
    const next = flight.stops.find((stop) => stop.status === 'pending');
    const parts: string[] = [];
    if (phase === 'sleep') parts.push(t.map.sleeping);
    if (next?.type === 'deliver') {
      parts.push(
        fill(t.map.nextStop, {
          name: next.name ?? t.letters.unknown,
          time: dateTime(next.arrivesAt),
        }),
      );
    } else if (next) {
      parts.push(fill(t.map.homeAt, { time: dateTime(next.arrivesAt) }));
    }
    return parts.join(', ');
  }
</script>

<MapView
  nightAt={now}
  {fit}
  occupied={(toSvg, scale) => (info ? layout(info, toSvg, scale).occupied : [])}
>
  {#snippet markers(toSvg, scale)}
    {#if info}
      {@const view = layout(info, toSvg, scale)}
      <g class="tracks" data-testid="map-tracks" aria-hidden="true">
        {#each tracks as track (track.id)}
          {#if track.points.length > 1}
            <polyline
              class="track"
              points={track.points
                .map((point) => {
                  const q = toSvg(point.lat, point.lon);
                  return `${q.x},${q.y}`;
                })
                .join(' ')}
              stroke-width={SIZE.track * scale}
            />
          {/if}
          {#each track.sleeps as sleep, index (index)}
            {@const q = toSvg(sleep.lat, sleep.lon)}
            <text class="zzz" x={q.x} y={q.y - 4 * scale} font-size={SIZE.zzz * scale}>Zzz</text>
          {/each}
        {/each}
      </g>
      {#each view.contacts as { contact, p, text } (contact.id)}
        {@const label = view.at(`contact-${contact.id}`)}
        <g class="contact" class:bot={contact.bot}>
          {#if contact.bot}
            <!-- Bots: a diamond, distinguishable from people without colour (SPEC 14). -->
            <polygon
              points={`${p.x},${p.y - SIZE.bot * scale} ${p.x + SIZE.bot * scale},${p.y} ${p.x},${p.y + SIZE.bot * scale} ${p.x - SIZE.bot * scale},${p.y}`}
              stroke-width={2.5 * scale}
            />
          {:else}
            <circle cx={p.x} cy={p.y} r={SIZE.contact * scale} stroke-width={2.5 * scale} />
          {/if}
          <text x={label.x} y={label.y} font-size={SIZE.font * scale}>{text}</text>
        </g>
      {/each}
      <g class="home">
        <rect
          x={view.home.x - SIZE.home * scale}
          y={view.home.y - SIZE.home * scale}
          width={2 * SIZE.home * scale}
          height={2 * SIZE.home * scale}
          stroke-width={2 * scale}
        />
        <text x={view.homeLabel.x} y={view.homeLabel.y} font-size={SIZE.font * scale}
          >{t.map.legendHome}</text
        >
      </g>
      {#each view.flying as { flight, p } (flight.id)}
        {@const label = view.at(`owl-${flight.id}`)}
        <g class="owl" data-testid="map-owl">
          <circle cx={p.x} cy={p.y} r={SIZE.owl * scale} stroke-width={2.5 * scale} />
          <text
            class="owl-glyph"
            x={p.x}
            y={p.y + 0.36 * SIZE.glyph * scale}
            font-size={SIZE.glyph * scale}>🦉</text
          >
          <text x={label.x} y={label.y} font-size={SIZE.owlFont * scale}>{flight.owl.name}</text>
        </g>
      {/each}
    {/if}
  {/snippet}
</MapView>

<ul class="legend card">
  <li><span class="key home-key" aria-hidden="true"></span>{t.map.legendHome}</li>
  <li><span class="key contact-key" aria-hidden="true"></span>{t.map.legendContact}</li>
  <li><span class="key bot-key" aria-hidden="true"></span>{t.map.legendBot}</li>
  <li><span class="key owl-key" aria-hidden="true"></span>{t.map.legendOwl}</li>
  <li><span class="key track-key" aria-hidden="true"></span>{t.map.legendTrack}</li>
  <li><span class="zzz-key" aria-hidden="true">Zzz</span>{t.map.legendSleep}</li>
  <li><span class="key night-key" aria-hidden="true"></span>{t.map.legendNight}</li>
</ul>

<section class="card" aria-labelledby="flights-title">
  <h2 id="flights-title">{t.map.flightsTitle}</h2>
  {#if owls.length === 0}
    <p>{t.map.flightsNone}</p>
  {:else}
    <ul class="flights">
      {#each owls as { flight, at } (flight.id)}
        <li>
          {fill(t.map.flightLine, {
            owl: flight.owl.name,
            purpose: purposeText(flight),
            where: whereText(flight, at?.phase),
          })}
        </li>
      {/each}
    </ul>
  {/if}
  <p class="hint">
    {fill(t.map.updated, { time: time(now), minutes: MAP.CLIENT_REFRESH_MINUTES })}
  </p>
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
    padding: 0.75rem 1rem;
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

  /* Path flown so far: thin dark brown line; Zzz where the owl slept (v0.3). */
  .track {
    fill: none;
    stroke: var(--wood-dark);
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .zzz {
    font-style: italic;
    font-weight: 700;
    fill: var(--wood-dark);
  }

  .track-key {
    height: 0;
    border-width: 2px 0 0;
    width: 1.5rem;
  }

  .zzz-key {
    font-style: italic;
    font-weight: 700;
    color: var(--wood-dark);
  }

  .hint {
    color: var(--ink-soft);
  }
</style>
