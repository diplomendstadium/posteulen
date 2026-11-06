<script lang="ts">
  /**
   * Releasing an owl (v0.3): the user types the exact name, then confirms a second time.
   * The server checks the name again.
   */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import ErrorText from './ErrorText.svelte';
  import { releaseOwl, type Owl } from '../lib/owls.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { status } from '../lib/status.svelte.ts';

  let { owl, onclose, onreleased }: { owl: Owl; onclose: () => void; onreleased: () => void } =
    $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let typed = $state('');
  let step = $state<'name' | 'sure'>('name');
  let busy = $state(false);
  let error = $state<string | null>(null);

  const name = $derived(owl.name ?? '');
  const matches = $derived(typed.normalize('NFC') === name.normalize('NFC') && name !== '');

  $effect(() => {
    if (dialog && !dialog.open) dialog.showModal();
  });

  async function release(): Promise<void> {
    if (busy || !matches) return;
    busy = true;
    error = null;
    try {
      await releaseOwl(owl.id, typed);
      dialog?.close();
      onreleased();
    } catch (caught) {
      error = errorMessage(caught);
      step = 'name';
    } finally {
      busy = false;
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="release-title" {onclose}>
  <h2 id="release-title">{fill(de.owls.releaseTitle, { name })}</h2>
  <p>{de.owls.releaseIntro}</p>
  <ErrorText message={error} />
  {#if step === 'name'}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        if (matches) step = 'sure';
      }}
    >
      <label for="release-name">{fill(de.owls.releaseNameLabel, { name })}</label>
      <input
        id="release-name"
        bind:value={typed}
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        required
      />
      <div class="buttons">
        <button class="button" type="submit" disabled={!matches}>{de.owls.releaseNext}</button>
        <button class="button secondary" type="button" onclick={() => dialog?.close()}
          >{de.owls.cancel}</button
        >
      </div>
    </form>
  {:else}
    <p class="sure" role="alert">
      <span aria-hidden="true">⚠</span><span>{fill(de.owls.releaseSure, { name })}</span>
    </p>
    <div class="buttons">
      <button
        class="button danger"
        type="button"
        disabled={busy || !status.online}
        onclick={() => void release()}>{fill(de.owls.releaseFinal, { name })}</button
      >
      <button class="button secondary" type="button" onclick={() => dialog?.close()}
        >{de.owls.cancel}</button
      >
    </div>
  {/if}
</dialog>

<style>
  dialog {
    width: min(100% - 2rem, 30rem);
    padding: 1.25rem 1.25rem 1rem;
    border: 3px solid var(--wood);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
  }

  dialog::backdrop {
    background: rgb(43 29 14 / 0.55);
  }

  h2 {
    font-size: 1.25rem;
  }

  label {
    display: block;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  input {
    min-height: 2.75rem;
    font: inherit;
    width: 100%;
    padding: 0 0.75rem;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .sure {
    display: flex;
    gap: 0.5rem;
    font-weight: 700;
    color: var(--seal);
  }
</style>
