<script lang="ts">
  /**
   * v0.7: a greeting on the overview, between "Neuigkeiten" and the tiles – gender-neutral,
   * with the user's name and fitting the time of day at their (fictional) home: the time zone
   * of the country there, with summer time (SPEC 8.3).
   */
  import { onMount } from 'svelte';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { dayPart, localTime, zoneAt } from '@posteulen/shared/map/timezone.ts';

  let now = $state(Date.now());

  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });

  const home = $derived(account.profile?.home);
  const time = $derived(home ? localTime(now, zoneAt(home.lat, home.lon)) : null);
  const greeting = $derived.by(() => {
    if (!time) return '';
    const texts = t.greeting as Record<string, string>;
    return fill(texts[dayPart(time.hour)] ?? '', { name: account.profile?.name ?? '' });
  });
  const clock = $derived(
    time ? `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}` : '',
  );
</script>

{#if time}
  <section class="greeting card" data-testid="greeting" aria-labelledby="greeting-title">
    <h2 id="greeting-title">{greeting}</h2>
    <p>{fill(t.greeting.localTime, { time: clock })}</p>
  </section>
{/if}

<style>
  .greeting {
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .greeting h2 {
    margin: 0 0 0.25rem;
    overflow-wrap: anywhere;
  }

  .greeting p {
    margin: 0;
    color: var(--ink-soft);
  }
</style>
