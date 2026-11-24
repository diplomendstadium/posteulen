<script lang="ts">
  /**
   * v1.3.2: "Über diese Instanz" below "Über PostEulen" at the very bottom of the start page
   * (SPEC 8.1) – a few figures of the admin's statistics: accounts created and existing, active
   * in the last 30 days, letters between people and the owls (with chicks) owned by players.
   * Only counters; the server counts them at most every ten minutes.
   */
  import { onMount } from 'svelte';
  import { t, fill, formatNumber } from '../lib/i18n.svelte.ts';
  import { instanceInfo, type InstanceInfo } from '../lib/instance.ts';

  let stats = $state<InstanceInfo['stats'] | null>(null);

  onMount(() => {
    void instanceInfo().then((info) => (stats = info?.stats ?? null));
  });

  const rows = $derived(
    stats
      ? [
          [t.start.instanceCreated, formatNumber(stats.accountsCreated)],
          [t.start.instanceCurrent, formatNumber(stats.accountsCurrent)],
          [t.start.instanceActive, formatNumber(stats.active30)],
          [
            t.start.instanceLetters,
            fill(t.start.instanceLettersValue, {
              total: stats.letters.total,
              last7: stats.letters.last7,
            }),
          ],
          [t.start.instanceOwls, formatNumber(stats.owls)],
        ]
      : [],
  );
</script>

{#if stats}
  <section class="instance card" aria-labelledby="instance-title" data-testid="instance">
    <h2 id="instance-title">{t.start.instance}</h2>
    <dl>
      {#each rows as [label, value] (label)}
        <div class="row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      {/each}
    </dl>
  </section>
{/if}

<style>
  .instance {
    margin-top: 1.5rem;
  }

  dl {
    display: grid;
    gap: 0.35rem;
    margin: 0;
  }

  /* Label left, value right; on narrow phones a long value moves below its label. */
  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0 1rem;
  }

  dt {
    flex: 1 1 12rem;
    color: var(--ink-soft);
  }

  dd {
    flex: 0 1 auto;
    margin: 0 0 0 auto;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
</style>
