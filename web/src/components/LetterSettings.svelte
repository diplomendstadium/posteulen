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
  let busy = $state(false);
  let error = $state<string | null>(null);
  let saved = $state(false);

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
