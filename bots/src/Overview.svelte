<script lang="ts">
  /** v0.8: all bots with statistics, creating a bot, the map of bot owls, export/import. */
  import { onMount } from 'svelte';
  import { api } from '../../admin/src/lib/api.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, t } from '../../admin/src/lib/i18n.svelte.ts';
  import BotMap from './BotMap.svelte';
  import ImportExport from './ImportExport.svelte';
  import type { BotView, MapHome, MapOwl } from './lib/types.ts';

  let { onopen }: { onopen: (id: string) => void } = $props();

  let bots = $state<BotView[] | null>(null);
  let owls = $state<MapOwl[]>([]);
  let homes = $state<MapHome[]>([]);
  let name = $state('');
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function load(): Promise<void> {
    try {
      bots = (await api<{ bots: BotView[] }>('GET', '/api/bots')).bots;
      const map = await api<{ owls: MapOwl[]; homes: MapHome[] }>('GET', '/api/owls');
      owls = map.owls;
      homes = map.homes;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const wanted = name.trim();
    if (wanted === '' || busy) return;
    // Creating and activating are confirmed separately (SPEC 10.6).
    if (!confirm(fill(t.centre.createConfirm, { name: wanted }))) return;
    busy = true;
    error = null;
    try {
      const { id } = await api<{ id: string }>('POST', '/api/bots', { name: wanted });
      name = '';
      onopen(id);
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const line = (numbers: BotView['stats']['total']) => fill(t.centre.statsLine, { ...numbers });
</script>

<section class="card">
  <h1>{t.centre.overviewTitle}</h1>
  <p>{t.centre.overviewIntro}</p>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  <form onsubmit={(event) => void create(event)}>
    <label for="new-bot">{t.centre.newName}</label>
    <input id="new-bot" type="text" maxlength="20" bind:value={name} />
    <button class="button" type="submit" disabled={busy || name.trim() === ''}
      >{t.centre.create}</button
    >
  </form>
</section>

{#if bots === null}
  <p class="card">{t.centre.loading}</p>
{:else if bots.length === 0}
  <p class="card">{t.centre.none}</p>
{:else}
  <ul class="bots">
    {#each bots as bot (bot.id)}
      <li class="card" data-testid="bot-row">
        <h2>
          {bot.name} <span class={`state ${bot.state}`}>{t.centre[`state_${bot.state}`]}</span>
        </h2>
        <p><strong>{t.centre.statsTotal}:</strong> {line(bot.stats.total)}</p>
        <p><strong>{t.centre.statsRecent}:</strong> {line(bot.stats.recent)}</p>
        <p>{fill(t.centre.plannedCount, { count: bot.planned })}</p>
        <button class="button" type="button" onclick={() => onopen(bot.id)}
          >{t.centre.open}<span class="visually-hidden">: {bot.name}</span></button
        >
      </li>
    {/each}
  </ul>
{/if}

<section class="card">
  <h2>{t.centre.mapTitle}</h2>
  <p>{t.centre.mapIntro}</p>
  {#if owls.length === 0}<p>{t.centre.mapNone}</p>{/if}
  <BotMap {owls} {homes} />
</section>

<ImportExport bots={bots ?? []} ondone={() => void load()} />

<style>
  .bots {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .state {
    font-size: 0.9rem;
    font-family: var(--font-body);
    padding: 0.1rem 0.5rem;
    border-radius: 1rem;
    border: 1px solid currentColor;
  }

  section {
    margin: 1.5rem 0;
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
