<script lang="ts">
  /** OpenAI settings (SPEC 13 item 5): write-only key, model, daily limit, connection test. */
  import { onMount } from 'svelte';
  import { t, fill } from './lib/i18n.svelte.ts';
  import { locale } from './lib/i18n.svelte.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Info {
    keySince: number | null;
    model: string;
    dailyLimit: number;
    usedToday: number;
    /** v0.8: own quota of the control-centre bots. */
    botsDailyLimit: number;
    botsUsedToday: number;
  }

  let info = $state<Info | null>(null);
  let key = $state('');
  let model = $state('');
  let limit = $state(200);
  let botsLimit = $state(500);
  let models = $state<string[]>([]);
  let result = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const date = (ms: number): string =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );
  const errorTexts = t.errors as Record<string, string>;

  async function load(): Promise<void> {
    try {
      info = await api<Info>('GET', '/api/openai');
      model = info.model;
      limit = info.dailyLimit;
      botsLimit = info.botsDailyLimit;
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
      result = t.admin.modeSaved;
    });
  };

  const deleteKey = () =>
    run(async () => {
      if (!confirm(t.admin.openaiDeleteConfirm)) return;
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
      await api('PUT', '/api/openai/settings', {
        model: model.trim(),
        dailyLimit: limit,
        botsDailyLimit: botsLimit,
      });
      await load();
      result = t.admin.modeSaved;
    });
  };

  const test = () =>
    run(async () => {
      const outcome = await api<{ ok: boolean; code?: string }>('POST', '/api/openai/test', {});
      result = outcome.ok
        ? t.admin.openaiTestOk
        : (errorTexts[outcome.code ?? ''] ?? t.errors.internal);
    });
</script>

<section class="card" aria-labelledby="openai-title">
  <h2 id="openai-title">{t.admin.openaiTitle}</h2>
  <p>{t.admin.openaiIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if result}<p role="status" data-testid="openai-result">{result}</p>{/if}
  {#if info}
    <p>
      {info.keySince === null
        ? t.admin.openaiNoKey
        : fill(t.admin.openaiKeySince, { date: date(info.keySince) })}
    </p>
    <form onsubmit={(event) => void saveKey(event)}>
      <label for="openai-key">{t.admin.openaiKey}</label>
      <input id="openai-key" type="password" autocomplete="off" bind:value={key} required />
      <button class="button" type="submit" disabled={busy}>{t.admin.openaiSaveKey}</button>
      {#if info.keySince !== null}
        <button
          class="button secondary"
          type="button"
          disabled={busy}
          onclick={() => void deleteKey()}>{t.admin.openaiDeleteKey}</button
        >
      {/if}
    </form>
    <form onsubmit={(event) => void saveSettings(event)}>
      <label for="openai-model">{t.admin.openaiModel}</label>
      <input id="openai-model" type="text" list="openai-models" bind:value={model} required />
      <datalist id="openai-models">
        {#each models as id (id)}<option value={id}></option>{/each}
      </datalist>
      <button
        class="button secondary"
        type="button"
        disabled={busy || info.keySince === null}
        onclick={() => void loadModels()}>{t.admin.openaiLoadModels}</button
      >
      <label for="openai-limit">{t.admin.openaiLimitExplainer}</label>
      <input
        id="openai-limit"
        type="number"
        min="0"
        max="100000"
        step="1"
        bind:value={limit}
        required
      />
      <p>{fill(t.admin.openaiUsed, { used: info.usedToday, limit: info.dailyLimit })}</p>
      <label for="openai-bots-limit">{t.admin.openaiBotsLimit}</label>
      <input
        id="openai-bots-limit"
        type="number"
        min="0"
        max="100000"
        step="1"
        bind:value={botsLimit}
        required
      />
      <p>
        {fill(t.admin.openaiBotsUsed, { used: info.botsUsedToday, limit: info.botsDailyLimit })}
      </p>
      <button class="button" type="submit" disabled={busy}>{t.admin.openaiSave}</button>
      <button class="button secondary" type="button" disabled={busy} onclick={() => void test()}
        >{t.admin.openaiTest}</button
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
