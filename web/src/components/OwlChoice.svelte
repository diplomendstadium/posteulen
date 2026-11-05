<script lang="ts">
  /**
   * Owl selection with the server-computed preview (SPEC 8.4 step 4): energy, speed,
   * arrival per recipient, return home.
   */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
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

  const species = (id: string) => SPECIES.find((s) => s.id === id);
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ?? de.letters.unknown;
</script>

<fieldset class="choices">
  <legend>{de.letters.chooseOwl}</legend>
  {#if choices.length === 0}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.letters.noOwl}</span></p>
  {/if}
  {#each choices as choice (choice.id)}
    <label class="choice" class:chosen={selected === choice.id}>
      <input type="radio" {name} value={choice.id} bind:group={selected} />
      <span class="picture"><OwlPicture speciesId={choice.species} alt="" /></span>
      <span class="text">
        <strong>
          {fill(de.letters.owlOption, {
            owl: choice.name,
            species: species(choice.species)?.name ?? choice.species,
            energy: choice.energy,
            max: choice.maxEnergy,
            speed: Math.round(owlSpeedKmh(species(choice.species)?.speedFactor ?? 1)),
          })}
        </strong>
        {#if choice.kind === 'stand_in'}<span class="hint">{de.letters.standIn}</span>{/if}
        {#each choice.arrivals as arrival (arrival.recipientId)}
          <span
            >{fill(de.letters.arrival, {
              name: nameOf(arrival.recipientId),
              time: dateTime(arrival.at),
            })}</span
          >
        {/each}
        <span>
          {choice.returnsAt === null
            ? de.letters.noReturn
            : fill(de.letters.returnsAt, { time: dateTime(choice.returnsAt) })}
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
</style>
