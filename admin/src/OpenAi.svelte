<script lang="ts">
  /** OpenAI settings (SPEC 13 item 5): write-only key, model, daily limit, connection test. */
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Info {
    keySince: number | null;
    model: string;
    dailyLimit: number;
    usedToday: number;
  }

  let info = $state<Info | null>(null);
  let key = $state('');
  let model = $state('');
  let limit = $state(200);
  let models = $state<string[]>([]);
  let result = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const date = (ms: number): string =>
    new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );
  const errorTexts = de.errors as Record<string, string>;

  async function load(): Promise<void> {
    try {
      info = await api<Info>('GET', '/api/openai');
      model = info.model;
      limit = info.dailyLimit;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function run(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    error = result = null;
    try {
      await work();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const saveKey = (event: SubmitEvent) => {
    event.preventDefault();
    return run(async () => {
      await api('PUT', '/api/openai/key', { key: key.trim() });
      key = '';
      await load();
      result = de.admin.modeSaved;
    });
  };

  const deleteKey = () =>
    run(async () => {
      if (!confirm(de.admin.openaiDeleteConfirm)) return;
      await api('DELETE', '/api/openai/key');
      await load();
    });

  const loadModels = () =>
    run(async () => {
      models = (await api<{ models: string[] }>('GET', '/api/openai/models')).models;
    });

  const saveSettings = (event: SubmitEvent) => {
    event.preventDefault();
    return run(async () => {
      await api('PUT', '/api/openai/settings', { model: model.trim(), dailyLimit: limit });
      await load();
      result = de.admin.modeSaved;
    });
  };

  const test = () =>
    run(async () => {
      const outcome = await api<{ ok: boolean; code?: string }>('POST', '/api/openai/test', {});
      result = outcome.ok
        ? de.admin.openaiTestOk
        : (errorTexts[outcome.code ?? ''] ?? de.errors.internal);
    });
</script>

<section class="card" aria-labelledby="openai-title">
  <h2 id="openai-title">{de.admin.openaiTitle}</h2>
  <p>{de.admin.openaiIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if result}<p role="status" data-testid="openai-result">{result}</p>{/if}
  {#if info}
    <p>
      {info.keySince === null
        ? de.admin.openaiNoKey
        : fill(de.admin.openaiKeySince, { date: date(info.keySince) })}
    </p>
    <form onsubmit={(event) => void saveKey(event)}>
      <label for="openai-key">{de.admin.openaiKey}</label>
      <input id="openai-key" type="password" autocomplete="off" bind:value={key} required />
      <button class="button" type="submit" disabled={busy}>{de.admin.openaiSaveKey}</button>
      {#if info.keySince !== null}
        <button
          class="button secondary"
          type="button"
          disabled={busy}
          onclick={() => void deleteKey()}>{de.admin.openaiDeleteKey}</button
        >
      {/if}
    </form>
    <form onsubmit={(event) => void saveSettings(event)}>
      <label for="openai-model">{de.admin.openaiModel}</label>
      <input id="openai-model" type="text" list="openai-models" bind:value={model} required />
      <datalist id="openai-models">
        {#each models as id (id)}<option value={id}></option>{/each}
      </datalist>
      <button
        class="button secondary"
        type="button"
        disabled={busy || info.keySince === null}
        onclick={() => void loadModels()}>{de.admin.openaiLoadModels}</button
      >
      <label for="openai-limit">{de.admin.openaiLimit}</label>
      <input
        id="openai-limit"
        type="number"
        min="0"
        max="100000"
        step="1"
        bind:value={limit}
        required
      />
      <p>{fill(de.admin.openaiUsed, { used: info.usedToday, limit: info.dailyLimit })}</p>
      <button class="button" type="submit" disabled={busy}>{de.admin.openaiSave}</button>
      <button class="button secondary" type="button" disabled={busy} onclick={() => void test()}
        >{de.admin.openaiTest}</button
      >
    </form>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  form {
    margin-bottom: 1rem;
  }

  input {
    display: block;
    width: 100%;
    max-width: 30rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
  }
</style>
