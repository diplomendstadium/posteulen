<script lang="ts">
  import { speciesById } from '@posteulen/shared/game/owls.ts';
  /**
   * Owl selection with the server-computed preview (SPEC 8.4 step 4): energy, speed,
   * arrival per recipient, return home.
   */
  import { t, fill, goldText, speciesName } from '../lib/i18n.svelte.ts';
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  import OwlPicture from './OwlPicture.svelte';
  import { dateTime } from '../lib/format.ts';
  import { live } from '../lib/live.svelte.ts';
  import type { OwlChoice } from '../lib/owls.ts';
  import { cargoCovers } from '@posteulen/shared/game/owls.ts';
  import type { Cargo } from '@posteulen/shared/species.ts';

  let {
    choices,
    selected = $bindable(null),
    name,
    need = 'short',
  }: {
    choices: readonly OwlChoice[];
    selected: string | null;
    name: string;
    /** v0.10: what the load needs; owls that cannot carry it cannot be chosen. */
    need?: Cargo;
  } = $props();

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
  {:else if choices.some((choice) => choice.offer) && !choices.some((choice) => !choice.offer && cargoCovers(choice.cargo, need))}
    <p class="notice"><span aria-hidden="true">ℹ</span><span>{t.letters.loanOffers}</span></p>
  {/if}
  {#each choices as choice (choice.id)}
    {@const able = cargoCovers(choice.cargo, need)}
    <label class="choice" class:chosen={selected === choice.id} class:unable={!able}>
      <input type="radio" {name} value={choice.id} bind:group={selected} disabled={!able} />
      <span class="picture"
        ><OwlPicture speciesId={choice.species} second={choice.second === true} alt="" /></span
      >
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
        {#if choice.guest}
          <span class="hint offer"
            >{fill(choice.moreStops ? t.letters.guestHintOnward : t.letters.guestHint, {
              time: dateTime(choice.restUntil ?? Date.now()),
              name: nameOf(choice.arrivals[0]?.recipientId ?? ''),
            })}</span
          >
        {/if}
        {#if !able}<span class="hint">{t.letters.cannotCarryLong}</span>{/if}
        {#if choice.offer}<span class="hint offer"
            >{fill(t.letters.loanOfferHint, { price: goldText(choice.price ?? 0) })}</span
          >{/if}
        {#if choice.kind === 'loan' && !choice.guest}<span class="hint">{t.letters.loanHint}</span
          >{/if}
        {#each choice.arrivals as arrival (arrival.recipientId)}
          <span
            >{fill(t.letters.arrival, {
              name: nameOf(arrival.recipientId),
              time: dateTime(arrival.at),
            })}</span
          >
        {/each}
        <!-- v0.8.2: no "does not fly back" for loan owls – with a reply they do come back. -->
        {#if !choice.guest && choice.returnsAt !== null}
          <span>{fill(t.letters.returnsAt, { time: dateTime(choice.returnsAt) })}</span>
        {/if}
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

  .unable {
    opacity: 0.6;
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
