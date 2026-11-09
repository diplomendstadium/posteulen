<script lang="ts">
  /** v0.8: one bot – three tabs: planned events, past events, settings (SPEC 10.12). */
  import { onMount } from 'svelte';
  import { api, download } from '../../admin/src/lib/api.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, t } from '../../admin/src/lib/i18n.svelte.ts';
  import BotSettingsForm from './BotSettingsForm.svelte';
  import PlannedEvents from './PlannedEvents.svelte';
  import PastEvents from './PastEvents.svelte';
  import type { BotView, EventView } from './lib/types.ts';

  let { id, onback }: { id: string; onback: () => void } = $props();

  let bot = $state<BotView | null>(null);
  let planned = $state<EventView[]>([]);
  let past = $state<EventView[]>([]);
  let tab = $state<'planned' | 'past' | 'settings'>('planned');
  let error = $state<string | null>(null);
  let busy = $state(false);
  let deleteName = $state('');

  async function load(): Promise<void> {
    try {
      bot = await api<BotView>('GET', `/api/bots/${id}`);
      const events = await api<{ planned: EventView[]; past: EventView[] }>(
        'GET',
        `/api/bots/${id}/events`,
      );
      planned = events.planned;
      past = events.past.toReversed();
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
    error = null;
    try {
      await work();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const setState = (state: 'active' | 'paused') =>
    run(async () => {
      if (!bot) return;
      const question = state === 'active' ? t.centre.activateConfirm : t.centre.pauseConfirm;
      if (!confirm(fill(question, { name: bot.name }))) return;
      bot = await api<BotView>('POST', `/api/bots/${id}/state`, { state });
    });

  const remove = (event: SubmitEvent) => {
    event.preventDefault();
    return run(async () => {
      await api('POST', `/api/bots/${id}/delete`, { name: deleteName });
      onback();
    });
  };

  const problems = $derived(
    bot?.problems.map((key) => (t.centre as Record<string, string>)[`problem_${key}`] ?? key) ?? [],
  );
</script>

<p><button class="button secondary" type="button" onclick={onback}>{t.centre.back}</button></p>
{#if bot}
  <section class="card head">
    {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
    <h1>{bot.name} <span class="state">{t.centre[`state_${bot.state}`]}</span></h1>
    {#if problems.length > 0}
      <p class="hint">{fill(t.centre.problems, { list: problems.join(', ') })}</p>
    {/if}
    <p class="actions">
      {#if bot.state !== 'active'}
        <button
          class="button"
          type="button"
          disabled={busy || problems.length > 0}
          onclick={() => void setState('active')}
          >{bot.state === 'paused' ? t.centre.resume : t.centre.activate}</button
        >
      {:else}
        <button
          class="button secondary"
          type="button"
          disabled={busy}
          onclick={() => void setState('paused')}>{t.centre.pause}</button
        >
      {/if}
      <button
        class="button secondary"
        type="button"
        disabled={busy}
        onclick={() => void run(() => download(`/api/bots/${id}/export`, {}, 'posteulen-bot.zip'))}
        >{t.centre.exportBot}</button
      >
    </p>
  </section>

  <div class="tabs" role="tablist">
    {#each ['planned', 'past', 'settings'] as const as name (name)}
      <button
        role="tab"
        type="button"
        class="tab"
        aria-selected={tab === name}
        onclick={() => (tab = name)}
        >{name === 'planned'
          ? t.centre.tabPlanned
          : name === 'past'
            ? t.centre.tabPast
            : t.centre.tabSettings}</button
      >
    {/each}
  </div>

  <div role="tabpanel">
    {#if tab === 'planned'}
      <PlannedEvents {bot} events={planned} onchanged={() => void load()} />
    {:else if tab === 'past'}
      <PastEvents events={past} />
    {:else}
      <BotSettingsForm {bot} onsaved={(fresh) => (bot = fresh)} />
      <section class="card danger-zone">
        <h2>{t.centre.deleteTitle}</h2>
        <p>{t.centre.deleteIntro}</p>
        <form onsubmit={(event) => void remove(event)}>
          <label for="delete-name">{t.centre.deleteName}</label>
          <input id="delete-name" type="text" bind:value={deleteName} autocomplete="off" />
          <button class="button danger" type="submit" disabled={busy || deleteName.trim() === ''}
            >{t.centre.delete}</button
          >
        </form>
      </section>
    {/if}
  </div>
{:else}
  {#if error}<p class="error card" role="alert">⚠ {error}</p>{/if}
  <p class="card">{t.centre.loading}</p>
{/if}

<style>
  .state {
    font-size: 1rem;
    font-family: var(--font-body);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .tabs {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    margin: 1.5rem 0 1rem;
    border-bottom: 2px solid var(--wood-dark);
  }

  .tab {
    font: inherit;
    min-height: 2.75rem;
    padding: 0.5rem 1rem;
    border: 2px solid var(--wood-dark);
    border-bottom: none;
    background: var(--paper);
    color: var(--ink);
    border-radius: 0.5rem 0.5rem 0 0;
    cursor: pointer;
  }

  .tab[aria-selected='true'] {
    background: var(--wood-dark);
    color: var(--on-wood);
    font-weight: 700;
  }

  .danger-zone {
    margin-top: 2rem;
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

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
