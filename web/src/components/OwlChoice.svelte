<script lang="ts">
  import { speciesById } from '@posteulen/shared/game/owls.ts';
  /**
   * Owl selection with the server-computed preview (SPEC 8.4 step 4): energy, speed,
   * arrival per recipient, return home.
   */
  import { t, fill, speciesName } from '../lib/i18n.svelte.ts';
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  import OwlPicture from './OwlPicture.svelte';
  import { dateTime } from '../lib/format.ts';
  import { live } from '../lib/live.svelte.ts';
  import type { OwlChoice } from '../lib/owls.ts';

  let {
    choices,
    selected = $bindable(null),
    name,
  }: { choices: readonly OwlChoice[]; selected: string | null; name: string } = $props();

  const species = (id: string) => speciesById(id);
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ??
    live.bots.find((b) => b.userId === id)?.name ??
    t.letters.unknown;
</script>

<fieldset class="choices">
  <legend>{t.letters.chooseOwl}</legend>
  {#if choices.length === 0}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{t.letters.noOwl}</span></p>
  {:else if choices.every((choice) => choice.offer)}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{t.letters.loanOffers}</span></p>
  {/if}
  {#each choices as choice (choice.id)}
    <label class="choice" class:chosen={selected === choice.id}>
      <input type="radio" {name} value={choice.id} bind:group={selected} />
      <span class="picture"><OwlPicture speciesId={choice.species} alt="" /></span>
      <span class="text">
        <strong>
          {fill(t.letters.owlOption, {
            owl: choice.name,
            species: speciesName(choice.species),
            energy: choice.energy,
            max: choice.maxEnergy,
            speed: Math.round(owlSpeedKmh(species(choice.species)?.speedFactor ?? 1)),
          })}
        </strong>
        {#if choice.offer}<span class="hint offer">{t.letters.loanOfferHint}</span>{/if}
        {#if choice.kind === 'loan'}<span class="hint">{t.letters.loanHint}</span>{/if}
        {#each choice.arrivals as arrival (arrival.recipientId)}
          <span
            >{fill(t.letters.arrival, {
              name: nameOf(arrival.recipientId),
              time: dateTime(arrival.at),
            })}</span
          >
        {/each}
        <span>
          {choice.returnsAt === null
            ? t.letters.noReturn
            : fill(t.letters.returnsAt, { time: dateTime(choice.returnsAt) })}
        </span>
      </span>
    </label>
  {/each}
</fieldset>

<style>
  .choices {
    border: none;
    padding: 0;
    margin: 0 0 1rem;
    display: grid;
    gap: 0.5rem;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .choice {
    display: grid;
    grid-template-columns: auto 4rem 1fr;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--line);
    border-radius: 0.5rem;
    font-weight: 400;
    cursor: pointer;
    --owl-size: 4rem;
  }

  .choice.chosen {
    border-color: var(--wood);
    background: var(--parchment-deep);
  }

  .choice input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  .text {
    display: grid;
    gap: 0.15rem;
  }

  .hint {
    color: var(--ink-soft);
  }

  .offer {
    font-weight: 700;
    color: var(--ink);
  }
</style>
