<script lang="ts">
  /**
   * v1.4.2: free space for the database (SPEC 13 item 14). At or below the barrier players
   * cannot write letters, open registration takes invite codes only and every player sees a
   * banner; above the warning value all is as before. Both values can be changed here.
   */
  import { onMount } from 'svelte';
  import { STORAGE } from '@posteulen/shared/constants.ts';
  import { t, fill, locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Status {
    blockGb: number;
    warnGb: number;
    full: boolean;
    low: boolean;
    freeBytes: number | null;
  }

  let status = $state<Status | null>(null);
  let blockGb = $state<number>(STORAGE.BLOCK_GB);
  let warnGb = $state<number>(STORAGE.WARN_GB);
  let error = $state<string | null>(null);
  let saved = $state(false);

  const gb = (value: number): string =>
    value.toLocaleString(locale(), { maximumFractionDigits: 1 });

  function show(result: Status): void {
    status = result;
    blockGb = result.blockGb;
    warnGb = result.warnGb;
  }

  onMount(() => {
    api<Status>('GET', '/api/settings/storage')
      .then(show)
      .catch((caught: unknown) => (error = message(caught)));
  });

  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = null;
    saved = false;
    try {
      show(await api<Status>('PUT', '/api/settings/storage', { blockGb, warnGb }));
      saved = true;
    } catch (caught) {
      error = message(caught);
    }
  }

  const stateText = $derived.by((): string => {
    if (!status) return '';
    if (status.full) return t.admin.storageStateFull;
    if (status.low) return t.admin.storageStateLow;
    return t.admin.storageStateOk;
  });
</script>

<section class="card" aria-labelledby="storage-title" data-testid="storage">
  <h2 id="storage-title">{t.admin.storageTitle}</h2>
  <p>{t.admin.storageIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if status}
    <p data-testid="storage-state">
      <strong
        >{status.freeBytes === null
          ? t.admin.storageFreeUnknown
          : fill(t.admin.storageFree, { gb: gb(status.freeBytes / 1024 ** 3) })}</strong
      >
      · {stateText}
    </p>
  {/if}
  <form onsubmit={(event) => void save(event)}>
    <label for="storage-block">{t.admin.storageBlock}</label>
    <input
      id="storage-block"
      type="number"
      inputmode="decimal"
      min={STORAGE.MIN_GB}
      max={STORAGE.MAX_GB}
      step="0.5"
      required
      bind:value={blockGb}
    />
    <label for="storage-warn">{t.admin.storageWarn}</label>
    <input
      id="storage-warn"
      type="number"
      inputmode="decimal"
      min={STORAGE.MIN_GB}
      max={STORAGE.MAX_GB}
      step="0.5"
      required
      bind:value={warnGb}
    />
    <button class="button" type="submit">{t.admin.save}</button>
  </form>
  {#if saved}<p role="status">✔ {t.admin.modeSaved}</p>{/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  form {
    display: grid;
    gap: 0.5rem;
    max-width: 20rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
