<script lang="ts">
  import { onMount } from 'svelte';
  import { de } from '@posteulen/shared/texts/de.ts';
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
      confirmed: de.push.stateConfirmed,
      testing: de.push.stateTesting,
      unconfirmed: de.push.stateUnconfirmed,
      none: de.push.stateOff,
      unavailable: de.push.stateUnavailable,
      denied: de.push.stateUnavailable,
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
  <h2 id="push-title">{de.push.title}</h2>
  <p role="status"><strong>Status:</strong> <span data-testid="push-state">{label}</span></p>
  {#if pushState === 'denied'}<p>{de.push.denied}</p>{/if}
  {#if isIos() && pushState === 'unavailable'}<p>{de.push.iosHint}</p>{/if}
  {#if pushSupported()}
    <p class="actions">
      {#if pushState === 'confirmed' || pushState === 'unconfirmed'}
        <button class="button" type="button" disabled={busy} onclick={() => void run(sendTest)}
          >{de.push.test}</button
        >
      {/if}
      {#if pushState !== 'confirmed'}
        <button class="button" type="button" disabled={busy} onclick={() => void run(enablePush)}
          >{de.push.enable}</button
        >
      {/if}
    </p>
  {/if}
  {#if failed || pushState === 'unavailable' || pushState === 'unconfirmed'}
    <details open={failed}>
      <summary>{failed ? de.push.failedTitle : de.push.degoogledTitle}</summary>
      <h3>{de.push.degoogledTitle}</h3>
      <p>{de.push.degoogled1}</p>
      <p>{de.push.degoogled2}</p>
      <p>{de.push.degoogled3}</p>
      <p>{de.push.degoogled4}</p>
    </details>
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

  summary {
    cursor: pointer;
    font-weight: 700;
    min-height: 2.75rem;
    display: flex;
    align-items: center;
  }

  h3 {
    font-size: 1.05rem;
  }
</style>
