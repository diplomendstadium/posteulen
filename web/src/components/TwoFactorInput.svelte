<script lang="ts">
  /** v1.4.3: a code of the second factor – six digits of the app or a backup code (SPEC 5.11). */
  import { autofocus as focus } from '@posteulen/shared/autofocus.ts';
  import { t } from '../lib/i18n.svelte.ts';

  let {
    id,
    value = $bindable(''),
    autofocus = false,
  }: { id: string; value?: string; autofocus?: boolean } = $props();
</script>

<div class="field">
  <label for={id}>{t.twoFactor.code}</label>
  {#if autofocus}
    <input
      {id}
      type="text"
      bind:value
      autocomplete="one-time-code"
      autocapitalize="characters"
      spellcheck="false"
      maxlength="32"
      aria-describedby={`${id}-hint`}
      use:focus
    />
  {:else}
    <input
      {id}
      type="text"
      bind:value
      autocomplete="one-time-code"
      autocapitalize="characters"
      spellcheck="false"
      maxlength="32"
      aria-describedby={`${id}-hint`}
    />
  {/if}
  <p class="hint" id={`${id}-hint`}>{t.twoFactor.codeHint}</p>
</div>

<style>
  .field {
    margin-bottom: 1rem;
  }

  input {
    width: 100%;
    max-width: 16rem;
    font-family: monospace;
    letter-spacing: 0.1em;
  }

  .hint {
    margin: 0.25rem 0 0;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }
</style>
