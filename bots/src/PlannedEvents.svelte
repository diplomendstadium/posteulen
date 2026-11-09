<script lang="ts">
  /** v0.8: planning – the form, below it the planned events in order (SPEC 10.12). */
  import { api, download } from '../../admin/src/lib/api.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, speciesName, t } from '../../admin/src/lib/i18n.svelte.ts';
  import EventForm from './EventForm.svelte';
  import { dateTime, gold } from './lib/format.ts';
  import type { BotView, EventView } from './lib/types.ts';

  let {
    bot,
    events,
    onchanged,
  }: { bot: BotView; events: readonly EventView[]; onchanged: () => void } = $props();

  let editing = $state<EventView | 'new' | null>(null);
  let selected = $state<string[]>([]);
  let error = $state<string | null>(null);

  function summary(event: EventView): string {
    const parts: string[] = [];
    if (event.move) parts.push(t.centre.summaryMove);
    if (event.letter) parts.push(t.centre.summaryLetter);
    if (event.gift && 'gold' in event.gift)
      parts.push(fill(t.centre.summaryGold, { amount: gold(event.gift.gold) }));
    if (event.gift && 'species' in event.gift)
      parts.push(fill(t.centre.summaryOwl, { species: speciesName(event.gift.species) }));
    return parts.join(' · ');
  }

  async function remove(event: EventView): Promise<void> {
    if (!confirm(t.centre.deleteEventConfirm)) return;
    try {
      await api('DELETE', `/api/bots/${bot.id}/events/${event.id}`);
      onchanged();
    } catch (caught) {
      error = message(caught);
    }
  }
</script>

{#if editing === null}
  <p>
    <button class="button" type="button" onclick={() => (editing = 'new')}
      >{t.centre.eventNew}</button
    >
  </p>
{:else}
  {#key editing}
    <EventForm
      {bot}
      event={editing === 'new' ? null : editing}
      ondone={() => {
        editing = null;
        onchanged();
      }}
    />
  {/key}
{/if}

<h2 class="plate">{t.centre.plannedTitle}</h2>
{#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
{#if events.length === 0}
  <p class="card">{t.centre.plannedNone}</p>
{:else}
  <ul class="events">
    {#each events as event (event.id)}
      <li class="card" data-testid="planned-event">
        <h3>{dateTime(event.dueAt)}</h3>
        <p>{summary(event)}</p>
        {#if event.letter}<p class="excerpt">{event.letter.texts.de.follow.slice(0, 160)}</p>{/if}
        <p class="actions">
          <label class="choice"
            ><input type="checkbox" value={event.id} bind:group={selected} />
            {t.centre.select}</label
          >
          <button class="button secondary" type="button" onclick={() => (editing = event)}
            >{t.centre.edit}</button
          >
          <button class="button danger" type="button" onclick={() => void remove(event)}
            >{t.centre.deleteEvent}</button
          >
        </p>
      </li>
    {/each}
  </ul>
  {#if selected.length > 0}
    <button
      class="button secondary"
      type="button"
      onclick={() =>
        void download(
          `/api/bots/${bot.id}/export`,
          { eventIds: selected },
          'posteulen-events.zip',
        ).catch((caught: unknown) => (error = message(caught)))}>{t.centre.exportSelected}</button
    >
  {/if}
{/if}

<style>
  .events {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .excerpt {
    white-space: pre-wrap;
    opacity: 0.85;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .choice {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
