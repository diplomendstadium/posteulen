<script lang="ts">
  /**
   * v1.4: while holiday mode is on, a banner at the top of the app says so (SPEC 8.10, 9.12) –
   * with the end and a link to the settings, where it can be ended early.
   */
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { dateTime } from '../lib/format.ts';
  import Link from './Link.svelte';

  const vacation = $derived(account.profile?.vacation ?? null);
</script>

{#if vacation?.active}
  <div class="banner" role="status" data-testid="vacation-banner">
    <span aria-hidden="true">🏝</span>
    <span
      >{fill(t.vacation.banner, { until: dateTime(vacation.endsAt) })}
      <Link href="/app/einstellungen">{t.vacation.bannerLink}</Link></span
    >
  </div>
{/if}

<style>
  .banner {
    margin: 0;
    padding: 0.5rem 1rem;
    background: var(--parchment-deep);
    border-top: 1px solid var(--wood);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    flex-wrap: wrap;
  }
</style>
