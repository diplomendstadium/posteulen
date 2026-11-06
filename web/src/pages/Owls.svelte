<script lang="ts">
  /** Own owls (SPEC 8.5): picture, name, species, sex, energy, state and actions. */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES, type OwlImageKind } from '@posteulen/shared/species.ts';
  import { TIME } from '@posteulen/shared/constants.ts';
  import Link from '../components/Link.svelte';
  import OwlPicture from '../components/OwlPicture.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import OwlGift from '../components/OwlGift.svelte';
  import ChickGift from '../components/ChickGift.svelte';
  import ReleaseDialog from '../components/ReleaseDialog.svelte';
  import {
    feedOwl,
    lendToMenagerie,
    listOwls,
    nameOwl,
    petOwl,
    treatOwl,
    type Clutch,
    type Owl,
  } from '../lib/owls.ts';
  import { dateTime } from '../lib/format.ts';
  import { formatGold } from '@posteulen/shared/game/gold.ts';
  import { menagerieWage, speciesPrice } from '@posteulen/shared/game/chance.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let owls = $state<Owl[]>([]);
  let clutches = $state<Clutch[]>([]);
  let loaded = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let renaming = $state<string | null>(null);
  let gifting = $state<string | null>(null);
  let releasing = $state<Owl | null>(null);
  let released = $state<string | null>(null);
  let newName = $state('');

  const speciesName = (id: string): string => SPECIES.find((s) => s.id === id)?.name ?? id;
  const unnamed = $derived(owls.find((owl) => owl.name === null));

  async function load(): Promise<void> {
    try {
      const result = await listOwls();
      owls = result.owls;
      clutches = result.clutches;
      loaded = true;
    } catch {
      // Loaded again with the next update.
    }
  }

  $effect(() => {
    void live.owlsVersion;
    void load();
  });

  function replace(updated: Owl): void {
    owls = owls.map((owl) => (owl.id === updated.id ? updated : owl));
  }

  async function act(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await work();
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  const pet = (owl: Owl) =>
    act(async () => {
      replace((await petOwl(owl.id)).owl);
      showOwlImage(owl.species, 'petting', fill(de.owls.petting, { name: owl.name ?? '' }));
    });

  const feed = (owl: Owl) =>
    act(async () => {
      replace((await feedOwl(owl.id)).owl);
      showOwlImage(owl.species, 'feeding', fill(de.owls.feeding, { name: owl.name ?? '' }));
      void refreshTopics('profile');
    });

  const saveName = (owl: Owl) =>
    act(async () => {
      replace((await nameOwl(owl.id, newName.trim())).owl);
      renaming = null;
      newName = '';
    });

  const treat = (owl: Owl, kind: 'self' | 'vet') =>
    act(async () => {
      replace((await treatOwl(owl.id, kind)).owl);
      void refreshTopics('profile');
    });

  const menagerie = (owl: Owl) =>
    act(async () => {
      const wage = `${formatGold(menagerieWage(speciesPrice(owl.species)))} Gold`;
      if (!confirm(fill(de.owls.menagerieConfirm, { name: owl.name ?? '', amount: wage }))) return;
      replace((await lendToMenagerie(owl.id)).owl);
    });

  /**
   * Picture of the owl card: in flight by day or night where the owl is right now, grumpy when
   * ill (v0.3). An owl in the menagerie shows its empty perch instead (OwlPicture `perch`).
   */
  function pictureKind(owl: Owl): OwlImageKind {
    if (owl.state === 'flying' && owl.absence)
      return owl.absence.daylight ? 'flyingDay' : 'flyingNight';
    if (owl.isChick) return 'chick';
    return ['sick', 'self_care', 'vet'].includes(owl.state) ? 'grumpy' : 'normal';
  }

  function pictureAlt(owl: Owl): string {
    const name = owl.name ?? '';
    if (owl.state === 'menagerie') return fill(de.owls.perchAlt, { name });
    if (owl.state === 'flying' && owl.absence)
      return `${fill(owl.absence.daylight ? de.owls.flyingDayAlt : de.owls.flyingNightAlt, { name })}, ${speciesName(owl.species)}`;
    return `${name}, ${speciesName(owl.species)}`;
  }

  /** Loan owls above the own ones, each under its own heading (v0.3). */
  const named = $derived(owls.filter((owl) => owl.name !== null));
  const groups = $derived(
    [
      { id: 'loan-owls', title: de.owls.loanGroup, list: named.filter((o) => o.kind === 'loan') },
      { id: 'own-owls', title: de.owls.ownGroup, list: named.filter((o) => o.kind !== 'loan') },
    ].filter((group) => group.list.length > 0),
  );

  function stateText(owl: Owl): string {
    const until = owl.stateUntil === null ? '' : dateTime(owl.stateUntil);
    switch (owl.state) {
      case 'sick':
        return de.owls.stateSick;
      case 'self_care':
        return fill(de.owls.stateSelfCare, { until });
      case 'vet':
        return fill(de.owls.stateVet, { until });
      case 'brooding':
        return fill(de.owls.stateBrooding, { until });
      case 'menagerie':
        return fill(de.owls.stateMenagerie, { until });
      case 'flying':
        return absenceText(owl);
    }
    if (owl.kind === 'loan' && owl.loanExpiresAt !== null)
      return fill(de.owls.loanUntil, { until: dateTime(owl.loanExpiresAt) });
    if (owl.isChick && owl.adultAt !== null)
      return fill(de.owls.chick, { until: dateTime(owl.adultAt) });
    return de.owls.stateHome;
  }

  function absenceText(owl: Owl): string {
    const absence = owl.absence;
    if (!absence) return de.owls.stateFlying;
    const names = absence.recipients.map((name) => name ?? de.letters.unknown).join(de.owls.and);
    const what =
      absence.recipients.length === 0
        ? de.owls.flyingHome
        : fill(
            absence.purpose === 'gold'
              ? de.owls.flyingGold
              : absence.purpose === 'gift'
                ? de.owls.flyingGift
                : de.owls.flyingLetter,
            { names },
          );
    if (absence.returnsAt === null) return what;
    const hours = Math.max(1, Math.ceil((absence.returnsAt - Date.now()) / TIME.HOUR));
    return `${what} ${fill(de.owls.backIn, { hours })}`;
  }
</script>

<ErrorText message={error} />

{#if unnamed}
  <section class="card naming" aria-labelledby="naming-title">
    <h2 id="naming-title">
      {unnamed.isChick
        ? de.owls.chickNameTitle
        : fill(de.owls.nameTitle, { species: speciesName(unnamed.species) })}
    </h2>
    <div class="naming-body">
      <OwlPicture
        speciesId={unnamed.species}
        kind={unnamed.isChick ? 'chick' : 'normal'}
        alt={speciesName(unnamed.species)}
      />
      <form
        onsubmit={(event) => {
          event.preventDefault();
          void saveName(unnamed);
        }}
      >
        <label for="owl-name">{de.owls.nameLabel}</label>
        <input id="owl-name" bind:value={newName} maxlength="40" autocomplete="off" required />
        <p class="hint">{de.owls.nameHint}</p>
        <button class="button" type="submit" disabled={busy || !status.online}
          >{de.owls.save}</button
        >
      </form>
    </div>
  </section>
{/if}

{#each clutches as clutch (clutch.id)}
  <ChickGift
    {clutch}
    chicks={owls.filter((owl) => owl.clutchId === clutch.id && owl.isChick && owl.state === 'home')}
    ondone={() => void load()}
  />
{/each}

{#if loaded && owls.length === 0}
  <p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.owls.none}</span>
  </p>
  <p><Link href="/app/menagerie" class="button">{de.owls.toMenagerie}</Link></p>
{/if}

{#snippet owlCard(owl: Owl)}
  <li class="card owl" data-testid="owl-card">
    <div class="picture">
      <OwlPicture
        speciesId={owl.species}
        kind={pictureKind(owl)}
        perch={owl.state === 'menagerie'}
        alt={pictureAlt(owl)}
      />
    </div>
    <div class="facts">
      <h3 class="name">{owl.name}</h3>
      <p class="species">
        {speciesName(owl.species)} · {owl.sex === 'f' ? de.owls.female : de.owls.male}
      </p>
      <p class="energy">
        <span>{fill(de.owls.energy, { energy: owl.energy, max: owl.maxEnergy })}</span>
        <meter min="0" max={owl.maxEnergy} value={owl.energy} aria-hidden="true"></meter>
      </p>
      <p class="state" class:away={owl.state !== 'home'}>
        <span aria-hidden="true"
          >{owl.state === 'home' ? '⌂' : owl.state === 'flying' ? '🦉' : 'ℹ'}</span
        >
        {stateText(owl)}
      </p>
      <div class="actions">
        {#if owl.actions.care}
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void pet(owl)}>{de.owls.pet}</button
          >
          <button
            class="button secondary"
            type="button"
            disabled={busy || owl.fedToday || !status.online}
            onclick={() => void feed(owl)}>{owl.fedToday ? de.owls.fedToday : de.owls.feed}</button
          >
        {/if}
        {#if owl.actions.treat}
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void treat(owl, 'self')}>{de.owls.treatSelf}</button
          >
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void treat(owl, 'vet')}>{de.owls.treatVet}</button
          >
        {/if}
        {#if owl.actions.menagerie}
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void menagerie(owl)}>{de.owls.menagerie}</button
          >
        {/if}
        {#if owl.actions.rename}
          <button
            class="button secondary"
            type="button"
            onclick={() => {
              renaming = renaming === owl.id ? null : owl.id;
              newName = owl.name ?? '';
            }}>{de.owls.rename}</button
          >
        {:else if owl.kind === 'own'}
          <p class="hint">{de.owls.renameBlocked}</p>
        {/if}
        {#if owl.actions.gift}
          <button
            class="button secondary"
            type="button"
            onclick={() => (gifting = gifting === owl.id ? null : owl.id)}>{de.owls.gift}</button
          >
        {/if}
        {#if owl.actions.release}
          <button
            class="button danger"
            type="button"
            disabled={busy || !status.online}
            onclick={() => (releasing = owl)}>{de.owls.release}</button
          >
        {/if}
      </div>
      {#if renaming === owl.id}
        <form
          class="rename"
          onsubmit={(event) => {
            event.preventDefault();
            void saveName(owl);
          }}
        >
          <label for={`rename-${owl.id}`}
            >{fill(de.owls.renameTitle, { name: owl.name ?? '' })}</label
          >
          <input
            id={`rename-${owl.id}`}
            bind:value={newName}
            maxlength="40"
            autocomplete="off"
            required
          />
          <p class="hint">{de.owls.nameHint}</p>
          <button class="button" type="submit" disabled={busy || !status.online}
            >{de.owls.save}</button
          >
          <button class="button secondary" type="button" onclick={() => (renaming = null)}
            >{de.owls.cancel}</button
          >
        </form>
      {/if}
      {#if gifting === owl.id}
        <OwlGift
          {owl}
          ondone={() => {
            gifting = null;
            void load();
          }}
        />
      {/if}
    </div>
  </li>
{/snippet}

{#if released}<p class="notice" role="status">
    <span aria-hidden="true">🕊</span><span>{released}</span>
  </p>{/if}

{#each groups as group (group.id)}
  <section aria-labelledby={group.id}>
    <h2 id={group.id} class="group plate">{group.title}</h2>
    <ul class="owls">
      {#each group.list as owl (owl.id)}
        {@render owlCard(owl)}
      {/each}
    </ul>
  </section>
{/each}

{#if releasing}
  <ReleaseDialog
    owl={releasing}
    onclose={() => (releasing = null)}
    onreleased={() => {
      const gone = releasing;
      releasing = null;
      if (!gone) return;
      owls = owls.filter((other) => other.id !== gone.id);
      released = fill(de.owls.releaseDone, { name: gone.name ?? '' });
    }}
  />
{/if}

<style>
  .owls {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .owl {
    display: grid;
    grid-template-columns: minmax(6rem, 10rem) 1fr;
    gap: 1rem;
    align-items: start;
  }

  @media (max-width: 30rem) {
    .owl {
      grid-template-columns: 1fr;
    }

    .picture {
      --owl-size: 12rem;
    }
  }

  .name {
    margin: 0;
  }

  .group {
    margin: 1.5rem 0 0.75rem;
  }

  .species {
    margin: 0.25rem 0;
    color: var(--ink-soft);
  }

  .energy {
    display: grid;
    gap: 0.25rem;
    margin: 0.5rem 0;
  }

  meter {
    width: 100%;
    max-width: 16rem;
    height: 1rem;
  }

  .state.away {
    font-style: italic;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .hint {
    color: var(--ink-soft);
    margin: 0.25rem 0;
  }

  .naming {
    margin-bottom: 1.5rem;
    border: 3px solid var(--wood);
  }

  .naming-body {
    display: grid;
    grid-template-columns: minmax(6rem, 10rem) 1fr;
    gap: 1rem;
  }

  input {
    min-height: 2.75rem;
    font: inherit;
    width: 100%;
    max-width: 24rem;
    padding: 0 0.75rem;
  }

  .rename {
    margin-top: 1rem;
  }
</style>
