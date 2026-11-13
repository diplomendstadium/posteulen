<script lang="ts">
  /** v0.8: the archive – events that ran, newest first, with aggregated numbers (SPEC 10.8). */
  import { fill, speciesName, t } from '../../admin/src/lib/i18n.svelte.ts';
  import { dateTime, gold } from './lib/format.ts';
  import EventReach from './EventReach.svelte';
  import type { EventView } from './lib/types.ts';

  let { events }: { events: readonly EventView[] } = $props();
</script>

<h2 class="plate">{t.centre.pastTitle}</h2>
<p class="card">{t.centre.pastRetention}</p>
{#if events.length === 0}
  <p class="card">{t.centre.pastNone}</p>
{:else}
  <ul class="events">
    {#each events as event (event.id)}
      <li class="card" data-testid="past-event">
        <h3>
          {dateTime(event.dueAt)} · {t.centre[
            `pastState_${event.state as 'running' | 'archived' | 'skipped'}`
          ]}
        </h3>
        {#if event.startedAt}<p>
            {fill(t.centre.pastStarted, { time: dateTime(event.startedAt) })}
          </p>{/if}
        {#if event.archivedAt}<p>
            {fill(t.centre.pastArchived, { time: dateTime(event.archivedAt) })}
          </p>{/if}
        <EventReach reach={event.reach} />
        <p>{fill(t.centre.pastNumbers, { ...event.stats })}</p>
        {#if event.move}<p>{t.centre.summaryMove}: {event.move.lat}, {event.move.lon}</p>{/if}
        {#if event.gift && 'gold' in event.gift}<p>
            {fill(t.centre.summaryGold, { amount: gold(event.gift.gold) })}
          </p>{/if}
        {#if event.gift && 'species' in event.gift}<p>
            {fill(t.centre.summaryOwl, { species: speciesName(event.gift.species) })}
          </p>{/if}
        {#if event.letter}
          <details>
            <summary>{t.centre.summaryLetter}</summary>
            <p class="text">
              <strong>{t.centre.textFirstDe}</strong><br />{event.letter.texts.de.first}
            </p>
            <p class="text">
              <strong>{t.centre.textFollowDe}</strong><br />{event.letter.texts.de.follow}
            </p>
            <p class="text">
              <strong>{t.centre.textFirstEn}</strong><br />{event.letter.texts.en.first}
            </p>
            <p class="text">
              <strong>{t.centre.textFollowEn}</strong><br />{event.letter.texts.en.follow}
            </p>
          </details>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .events {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .text {
    white-space: pre-wrap;
  }
</style>
