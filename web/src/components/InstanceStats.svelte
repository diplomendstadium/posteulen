<script lang="ts">
  /**
   * v1.3.2: "Über diese Instanz" below "Über PostEulen" at the very bottom of the start page
   * (SPEC 8.1) – a few figures of the admin's statistics: accounts created and existing, active
   * in the last 30 days, letters between people and the owls (with chicks) owned by players.
   * Only counters; the server counts them at most every ten minutes. v1.4: below them the six
   * addresses of the instance – start page, admin panel and bots control centre, on the web and
   * in the Tor network (the onion addresses only while Tor runs).
   */
  import { onMount } from 'svelte';
  import { t, fill, formatNumber } from '../lib/i18n.svelte.ts';
  import { instanceInfo, type InstanceInfo } from '../lib/instance.ts';

  let stats = $state<InstanceInfo['stats'] | null>(null);
  let links = $state<InstanceInfo['links'] | null>(null);

  onMount(() => {
    void instanceInfo().then((info) => {
      stats = info?.stats ?? null;
      links = info?.links ?? null;
    });
  });

  const addresses = $derived(
    links
      ? (
          [
            [t.start.instanceWeb, links.web],
            [t.start.instanceWebOnion, links.webOnion],
            [t.start.instanceAdmin, links.admin],
            [t.start.instanceAdminOnion, links.adminOnion],
            [t.start.instanceBots, links.bots],
            [t.start.instanceBotsOnion, links.botsOnion],
          ] as const
        ).filter((entry): entry is readonly [string, string] => entry[1] !== null)
      : [],
  );

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
    {#if addresses.length > 0}
      <h3 class="addresses-title">{t.start.instanceAddresses}</h3>
      <dl data-testid="instance-links">
        {#each addresses as [label, href] (label)}
          <div class="row">
            <dt>{label}</dt>
            <dd class="address"><a {href} rel="noreferrer">{href}</a></dd>
          </div>
        {/each}
      </dl>
    {/if}
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

  .addresses-title {
    margin: 1rem 0 0.5rem;
    font-size: 1.05rem;
  }

  /* Onion addresses are long: they break anywhere rather than widen the box. */
  .address {
    overflow-wrap: anywhere;
    font-weight: 400;
    min-width: 0;
  }

  dd {
    flex: 0 1 auto;
    margin: 0 0 0 auto;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
  }
</style>
