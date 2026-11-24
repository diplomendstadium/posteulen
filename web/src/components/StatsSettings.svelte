<script lang="ts">
  /**
   * v1.3: statistics of the account (SPEC 8.10) – between notifications and gold. Letters sent
   * and received, days since the account was created, active days (absolute and in per cent),
   * kilometres of own and loan owls between people, and all interactions with owls by kind.
   */
  import { onMount } from 'svelte';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { api } from '../lib/api.ts';
  import { date } from '../lib/format.ts';

  interface Stats {
    readonly lettersSent: number;
    readonly lettersReceived: number;
    readonly daysSinceCreated: number;
    readonly activeDays: number;
    readonly activePercent: number;
    readonly km: number;
    readonly interactions: {
      readonly medicine: number;
      readonly water: number;
      readonly pet: number;
      readonly feed: number;
      readonly snack: number;
    };
    readonly countedSince: string | null;
  }

  let stats = $state<Stats | null>(null);

  onMount(() => {
    void api<{ stats: Stats }>('GET', '/api/account/stats')
      .then((result) => (stats = result.stats))
      .catch(() => undefined);
  });

  const rows = $derived(
    stats
      ? [
          [t.stats.lettersSent, fill(t.stats.count, { count: stats.lettersSent })],
          [t.stats.lettersReceived, fill(t.stats.count, { count: stats.lettersReceived })],
          [t.stats.days, fill(t.stats.count, { count: stats.daysSinceCreated })],
          [
            t.stats.activeDays,
            fill(t.stats.activeValue, { count: stats.activeDays, percent: stats.activePercent }),
          ],
          [t.stats.km, fill(t.stats.kmValue, { km: stats.km })],
        ]
      : [],
  );

  const interactions = $derived<{ label: string; count: number }[]>(
    stats
      ? [
          { label: t.stats.water, count: stats.interactions.water },
          { label: t.stats.pet, count: stats.interactions.pet },
          { label: t.stats.feed, count: stats.interactions.feed },
          { label: t.stats.snack, count: stats.interactions.snack },
          { label: t.stats.medicine, count: stats.interactions.medicine },
        ]
      : [],
  );
</script>

<section class="card" aria-labelledby="stats-title" data-testid="stats">
  <h2 id="stats-title">{t.stats.title}</h2>
  {#if stats}
    <dl class="values">
      {#each rows as [label, value] (label)}
        <dt>{label}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
    <h3>{t.stats.interactionsTitle}</h3>
    <dl class="values">
      {#each interactions as item (item.label)}
        <dt>{item.label}</dt>
        <dd>{fill(t.stats.count, { count: item.count })}</dd>
      {/each}
    </dl>
    {#if stats.countedSince}<p class="hint">
        {fill(t.stats.countedSince, { date: date(Date.parse(`${stats.countedSince}T12:00:00Z`)) })}
      </p>{/if}
  {:else}
    <p class="hint" role="status">…</p>
  {/if}
</section>

<style>
  /* v1.3.2: the gap to "Gold und Buchungen" below, like every card of the settings. */
  section {
    margin-bottom: 1.5rem;
  }

  .values {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.25rem 1rem;
    margin: 0 0 1rem;
  }

  dt {
    color: var(--ink-soft);
  }

  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }

  h3 {
    margin: 0.5rem 0;
    font-size: 1.05rem;
  }
</style>
