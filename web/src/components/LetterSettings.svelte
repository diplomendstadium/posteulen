<script lang="ts">
  /**
   * Letter settings (v0.2): how long one's own letters and system messages are kept, and
   * handwriting or plain font for letters.
   */
  import { LETTER } from '@posteulen/shared/constants.ts';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import ErrorText from './ErrorText.svelte';
  import { account, changeLetterSettings } from '../lib/auth.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { status } from '../lib/status.svelte.ts';

  const labels: Record<number, string> = {
    30: t.settings.retention30,
    90: t.settings.retention90,
    180: t.settings.retention180,
    365: t.settings.retention365,
  };

  let retentionDays = $state(account.profile?.letterRetentionDays ?? LETTER.RETENTION_MAX_DAYS);
  let print = $state(account.profile?.lettersPrint ?? false);
  /** v0.8.2: links in letters clickable – a switch that takes effect at once. */
  let links = $state(account.profile?.linksClickable ?? true);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let saved = $state(false);

  async function toggleLinks(): Promise<void> {
    if (busy || !status.online) return;
    busy = true;
    error = null;
    try {
      await changeLetterSettings({
        retentionDays: account.profile?.letterRetentionDays ?? LETTER.RETENTION_MAX_DAYS,
        print: account.profile?.lettersPrint ?? false,
        links,
      });
    } catch (caught) {
      links = !links;
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online) return;
    const before = account.profile?.letterRetentionDays ?? LETTER.RETENTION_MAX_DAYS;
    if (
      retentionDays < before &&
      !confirm(fill(t.settings.retentionConfirm, { days: retentionDays }))
    )
      return;
    busy = true;
    error = null;
    saved = false;
    try {
      await changeLetterSettings({ retentionDays, print });
      saved = true;
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<section class="card" aria-labelledby="letters-title">
  <h2 id="letters-title">{t.settings.lettersTitle}</h2>
  <form onsubmit={save} novalidate>
    <p>{t.settings.retentionIntro}</p>
    <fieldset>
      <legend>{t.settings.retentionLegend}</legend>
      {#each LETTER.RETENTION_CHOICES as days (days)}
        <label class="option"
          ><input
            type="radio"
            name="retention"
            value={days}
            bind:group={retentionDays}
            onchange={() => (saved = false)}
          />
          {labels[days]}</label
        >
      {/each}
    </fieldset>
    <label class="option"
      ><input type="checkbox" bind:checked={print} onchange={() => (saved = false)} />
      {t.settings.printLabel}</label
    >
    <p class="hint">{t.settings.printHint}</p>
    <label class="option switch-row"
      ><input
        type="checkbox"
        role="switch"
        class="switch"
        bind:checked={links}
        disabled={busy || !status.online}
        onchange={() => void toggleLinks()}
      />
      {t.settings.linksLabel}</label
    >
    <p class="hint">{t.settings.linksHint}</p>
    <ErrorText message={error} />
    {#if saved}<p class="notice" role="status">
        <span aria-hidden="true">✔</span><span>{t.settings.lettersSaved}</span>
      </p>{/if}
    <button class="button" type="submit" disabled={busy || !status.online}
      >{t.settings.lettersSave}</button
    >
  </form>
</section>

<style>
  /* v0.8.2: a switch (slider) for "links clickable" (".option" too, so ".option input" with its
     checkbox size does not win). */
  .option .switch {
    appearance: none;
    width: 2.75rem;
    height: 1.5rem;
    border-radius: 999px;
    background: var(--ink-soft);
    position: relative;
    cursor: pointer;
    flex: none;
    transition: background 0.15s;
  }

  .option .switch::after {
    content: '';
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--paper);
    transition: transform 0.15s;
  }

  .option .switch:checked {
    background: var(--wood-dark);
  }

  .option .switch:checked::after {
    transform: translateX(1.25rem);
  }

  .option .switch:focus-visible {
    outline: 3px solid var(--focus, #1d4ed8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .option .switch,
    .option .switch::after {
      transition: none;
    }
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 1rem;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .option {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
    font-weight: 400;
    margin: 0.25rem 0;
  }

  .option input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  .hint {
    color: var(--ink-soft);
    margin-top: 0;
  }

  section {
    margin-bottom: 1.5rem;
  }
</style>
