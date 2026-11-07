<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../lib/i18n.svelte.ts';
  import {
    enablePush,
    isIos,
    pushSupported,
    sendTest,
    serverStatus,
    waitForConfirmation,
    type PushState,
  } from '../lib/push.ts';
  import { live } from '../lib/live.svelte.ts';
  import Link from './Link.svelte';

  let pushState = $state<PushState>('none');
  let busy = $state(false);
  let failed = $state(false);

  onMount(() => {
    if (!pushSupported()) pushState = 'unavailable';
    else
      void serverStatus()
        .then((result) => {
          pushState = result.state;
          // A test still running (e.g. after a reload) is awaited instead of shown forever.
          if (result.state === 'testing') void run(waitForConfirmation);
        })
        .catch(() => undefined); // offline or aborted by a page change: the status stays open
  });

  const label = $derived(
    {
      confirmed: t.push.stateConfirmed,
      testing: t.push.stateTesting,
      unconfirmed: t.push.stateUnconfirmed,
      none: t.push.stateOff,
      unavailable: t.push.stateUnavailable,
      denied: t.push.stateUnavailable,
    }[pushState],
  );

  async function run(action: () => Promise<PushState>): Promise<void> {
    busy = true;
    failed = false;
    pushState = 'testing';
    pushState = await action().catch(() => 'unavailable' as const);
    failed = pushState !== 'confirmed';
    live.pushState = pushState;
    busy = false;
  }
</script>

<section class="card" aria-labelledby="push-title">
  <h2 id="push-title">{t.push.title}</h2>
  <p>{t.push.intro}</p>
  <p role="status"><strong>Status:</strong> <span data-testid="push-state">{label}</span></p>
  {#if pushState === 'denied'}<p>{t.push.denied}</p>{/if}
  {#if isIos() && pushState === 'unavailable'}<p>{t.push.iosHint}</p>{/if}
  {#if pushSupported()}
    <p class="actions">
      {#if pushState === 'confirmed' || pushState === 'unconfirmed'}
        <button class="button" type="button" disabled={busy} onclick={() => void run(sendTest)}
          >{t.push.test}</button
        >
      {/if}
      {#if pushState !== 'confirmed'}
        <button class="button" type="button" disabled={busy} onclick={() => void run(enablePush)}
          >{t.push.enable}</button
        >
      {/if}
    </p>
  {/if}
  {#if failed}
    <p role="alert"><strong>{t.push.failedTitle}</strong> {t.push.failedHint}</p>
  {/if}
  {#if failed || pushState === 'unavailable' || pushState === 'unconfirmed'}
    <!-- Special cases such as phones without Google services: only in the help (v0.3). -->
    <p class="help-link"><Link href="/hilfe#benachrichtigungen">{t.push.helpLink}</Link></p>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  section > :last-child {
    margin-bottom: 0;
  }

  .help-link :global(a) {
    display: inline-flex;
    align-items: center;
    min-height: 2.75rem;
  }
</style>
