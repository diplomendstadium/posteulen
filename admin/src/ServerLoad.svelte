<script lang="ts">
  /**
   * v1.2.1: the server dashboard at the very top of the admin panel (SPEC 13 item 13) – three rings
   * whose coloured bar runs once around at 100 %, from green at 0 % to red: average CPU and RAM
   * load of the last 7 days and the disk with the game data right now. Rough values, measured
   * every 10 minutes by posteulen-stats.timer.
   */
  import { onMount } from 'svelte';
  import { t, fill, locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';
  import { SERVER_LOAD, TIME } from '@posteulen/shared/constants.ts';
  import LoadRing from './LoadRing.svelte';

  interface Load {
    cpu: number | null;
    ram: number | null;
    disk: number | null;
    since: number | null;
    measuredAt: number | null;
  }

  let load = $state<Load | null>(null);
  let error = $state<string | null>(null);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );
  const percent = (value: number): string => `${Math.round(value).toLocaleString(locale())} %`;

  onMount(() => {
    api<Load>('GET', '/api/server-load')
      .then((result) => (load = result))
      .catch((caught: unknown) => (error = message(caught)));
  });

  /** Measured for clearly less than 7 days: the averages cover a shorter time. */
  const short = $derived(
    load !== null &&
      load.since !== null &&
      load.measuredAt !== null &&
      load.measuredAt - load.since < SERVER_LOAD.WINDOW_DAYS * TIME.DAY - TIME.HOUR,
  );

  const gauges = $derived(
    load
      ? [
          { id: 'cpu', label: t.admin.serverCpu, period: t.admin.serverAverage, value: load.cpu },
          { id: 'ram', label: t.admin.serverRam, period: t.admin.serverAverage, value: load.ram },
          { id: 'disk', label: t.admin.serverDisk, period: t.admin.serverNow, value: load.disk },
        ]
      : [],
  );
</script>

<section class="card" aria-labelledby="server-title" data-testid="server-load">
  <h2 id="server-title">{t.admin.serverTitle}</h2>
  <p>{t.admin.serverIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if load}
    <ul class="gauges">
      {#each gauges as gauge (gauge.id)}
        <li>
          <LoadRing
            id={gauge.id}
            label={gauge.label}
            period={gauge.period}
            value={gauge.value}
            text={gauge.value === null ? t.admin.serverNone : percent(gauge.value)}
          />
        </li>
      {/each}
    </ul>
    {#if load.measuredAt === null}
      <p class="hint">{t.admin.serverMissing}</p>
    {:else}
      <p class="hint">
        {fill(t.admin.serverMeasured, { time: time(load.measuredAt) })}
        {#if short && load.since !== null}
          {fill(t.admin.serverSince, { since: time(load.since) })}{/if}
      </p>
    {/if}
  {/if}
</section>

<style>
  .gauges {
    list-style: none;
    margin: 1rem 0 0.5rem;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.25rem 2rem;
  }

  .hint {
    margin: 0.5rem 0 0;
    font-size: 0.9rem;
    color: var(--ink-soft);
    text-align: center;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
