<script lang="ts">
  /**
   * Own owls (SPEC 8.5): picture, name, species, sex, energy, state and actions. v0.5: energy
   * and motivation bars, speed and recovery of the species, water and favourite snack.
   */
  import { t, fill, speciesName, goldText, decimal, i18n } from '../lib/i18n.svelte.ts';
  import { OWL } from '@posteulen/shared/constants.ts';
  import { speciesById } from '@posteulen/shared/game/owls.ts';
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  import {
    motivationFactor,
    motivationPercent,
    motivationShare,
  } from '@posteulen/shared/game/motivation.ts';
  import { speciesSnack } from '@posteulen/shared/texts/species.ts';
  import GaugeBar from '../components/GaugeBar.svelte';
  import { isDay } from '@posteulen/shared/game/sun.ts';
  import { OWL_NAP_AFTER_CARE_MS, OWL_NAP_SHARE } from '@posteulen/shared/constants.ts';
  import { account } from '../lib/auth.svelte.ts';
  import type { OwlImageKind } from '@posteulen/shared/species.ts';
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
    snackOwl,
    treatOwl,
    waterOwl,
    type Clutch,
    type GuestOwl,
    type Owl,
  } from '../lib/owls.ts';
  import GuestOwlCard from '../components/GuestOwl.svelte';
  import { dateTime, duration } from '../lib/format.ts';
  import { menagerieWage, speciesPrice } from '@posteulen/shared/game/chance.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let owls = $state<Owl[]>([]);
  /** v0.7: owls of others resting here. */
  let guests = $state<GuestOwl[]>([]);
  let clutches = $state<Clutch[]>([]);
  let loaded = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  let renaming = $state<string | null>(null);
  let gifting = $state<string | null>(null);
  let releasing = $state<Owl | null>(null);
  let released = $state<string | null>(null);
  let newName = $state('');

  const unnamed = $derived(owls.find((owl) => owl.name === null));

  async function load(): Promise<void> {
    try {
      const result = await listOwls();
      owls = result.owls;
      guests = result.guests ?? [];
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
      showOwlImage(owl.species, 'petting', fill(t.owls.petting, { name: owl.name ?? '' }));
    });

  const water = (owl: Owl) =>
    act(async () => {
      replace((await waterOwl(owl.id)).owl);
      showOwlImage(owl.species, 'drinking', fill(t.owls.drinking, { name: owl.name ?? '' }));
    });

  const snack = (owl: Owl) =>
    act(async () => {
      replace((await snackOwl(owl.id)).owl);
      showOwlImage(
        owl.species,
        'snack',
        fill(t.owls.snacking, { name: owl.name ?? '', snack: snackOf(owl) }),
      );
      void refreshTopics('profile');
    });

  const snackOf = (owl: Owl): string => speciesSnack(owl.species, i18n.lang);
  /** "Getrocknete Mango geben (0,2 Gold)": the button starts with a capital letter (v0.6). */
  function snackButton(owl: Owl): string {
    const text = fill(t.owls.snack, { snack: snackOf(owl) });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** Speed (km/h) and recovery (% per hour) of the species, as on the Menagerie (v0.5). */
  function speedOf(owl: Owl): string {
    return decimal(owlSpeedKmh(speciesById(owl.species)?.speedFactor ?? 1), 1);
  }
  function recoveryOf(owl: Owl): string {
    const factor = speciesById(owl.species)?.recoveryFactor ?? 1;
    return decimal(OWL.REGEN_SHARE_PER_HOUR * 100 * factor, 1);
  }
  /** "+10 %" or "−20 %" behind the values while the motivation is not 1.0. */
  function effectOf(owl: Owl): string {
    const percent = motivationPercent(owl.motivation);
    // Begins with a no-break space: it stands right behind the value.
    return `\u00a0${percent > 0 ? '+' : '−'}${Math.abs(percent)}\u00a0%`;
  }

  const feed = (owl: Owl) =>
    act(async () => {
      replace((await feedOwl(owl.id)).owl);
      showOwlImage(owl.species, 'feeding', fill(t.owls.feeding, { name: owl.name ?? '' }));
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
      const wage = goldText(menagerieWage(speciesPrice(owl.species)));
      if (!confirm(fill(t.owls.menagerieConfirm, { name: owl.name ?? '', amount: wage }))) return;
      replace((await lendToMenagerie(owl.id)).owl);
    });

  /**
   * Picture of the owl card: in flight by day or night where the owl is right now, grumpy when
   * ill (v0.3). An owl in the menagerie shows its empty perch instead (OwlPicture `perch`).
   */
  /**
   * v0.5.1: a healthy adult owl at home naps by day – each time the overview is opened, every
   * owl rolls once (50 %) whether it is asleep. Never within ten minutes after the last
   * interaction, never at night (dark at the owner's home: sun 6° or more below the horizon).
   */
  // Plain Map on purpose: the roll is fixed bookkeeping while rendering, not reactive state
  // (writing state while rendering is not allowed).
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const naps = new Map<string, boolean>();
  function napping(owl: Owl): boolean {
    if (owl.isChick || !['home', 'brooding'].includes(owl.state)) return false;
    const home = account.profile?.home;
    const now = Date.now();
    if (!home || !isDay(now, home.lat, home.lon)) return false;
    if (owl.caredAt !== null && now - owl.caredAt < OWL_NAP_AFTER_CARE_MS) return false;
    let asleep = naps.get(owl.id);
    if (asleep === undefined) {
      asleep = Math.random() < OWL_NAP_SHARE;
      naps.set(owl.id, asleep);
    }
    return asleep;
  }

  function pictureKind(owl: Owl): OwlImageKind {
    // v0.7: resting at a recipient: the normal picture.
    if (owl.state === 'flying' && owl.absence?.resting) return 'normal';
    if (owl.state === 'flying' && owl.absence) {
      // v0.5.1: asleep on the way, by day or at night where it is right now.
      if (owl.absence.sleeping) return owl.absence.daylight ? 'sleepDay' : 'sleepNight';
      return owl.absence.daylight ? 'flyingDay' : 'flyingNight';
    }
    if (owl.isChick) return 'chick';
    // v0.7: a brooding owl sits on its eggs.
    if (owl.state === 'brooding') return 'brooding';
    if (['sick', 'self_care', 'vet'].includes(owl.state)) return 'grumpy';
    return napping(owl) ? 'napHome' : 'normal';
  }

  function pictureAlt(owl: Owl): string {
    const name = owl.name ?? '';
    const species = speciesName(owl.species);
    if (owl.state === 'menagerie') return fill(t.owls.perchAlt, { name });
    if (owl.state === 'flying' && owl.absence) {
      const text = owl.absence.sleeping
        ? owl.absence.daylight
          ? t.owls.sleepDayAlt
          : t.owls.sleepNightAlt
        : owl.absence.daylight
          ? t.owls.flyingDayAlt
          : t.owls.flyingNightAlt;
      return `${fill(text, { name })}, ${species}`;
    }
    if (pictureKind(owl) === 'napHome') return `${fill(t.owls.napAlt, { name })}, ${species}`;
    if (pictureKind(owl) === 'brooding') return `${fill(t.owls.broodingAlt, { name })}, ${species}`;
    return `${name}, ${species}`;
  }

  /** Loan owls above the own ones, each under its own heading (v0.3). */
  const named = $derived(owls.filter((owl) => owl.name !== null));
  const groups = $derived(
    [
      { id: 'loan-owls', title: t.owls.loanGroup, list: named.filter((o) => o.kind === 'loan') },
      { id: 'own-owls', title: t.owls.ownGroup, list: named.filter((o) => o.kind !== 'loan') },
    ].filter((group) => group.list.length > 0),
  );

  function stateText(owl: Owl): string {
    const until = owl.stateUntil === null ? '' : dateTime(owl.stateUntil);
    switch (owl.state) {
      case 'sick':
        return t.owls.stateSick;
      case 'self_care':
        return fill(t.owls.stateSelfCare, { until });
      case 'vet':
        return fill(t.owls.stateVet, { until });
      case 'brooding':
        return fill(t.owls.stateBrooding, { until });
      case 'menagerie':
        return fill(t.owls.stateMenagerie, { until });
      case 'flying':
        return absenceText(owl);
    }
    if (owl.kind === 'loan' && owl.loanExpiresAt !== null)
      return fill(t.owls.loanUntil, { until: dateTime(owl.loanExpiresAt) });
    if (owl.isChick && owl.adultAt !== null)
      return fill(t.owls.chick, { until: dateTime(owl.adultAt) });
    return t.owls.stateHome;
  }

  function absenceText(owl: Owl): string {
    const absence = owl.absence;
    if (!absence) return t.owls.stateFlying;
    const names = absence.recipients.map((name) => name ?? t.letters.unknown).join(t.owls.and);
    // v0.7: resting at a recipient right now.
    const resting = absence.resting
      ? fill(t.owls.restingAt, {
          name: absence.resting.name ?? t.letters.unknown,
          until: dateTime(absence.resting.until),
        })
      : null;
    // v0.7: a sleeping owl is not "flying" a letter right now.
    const what =
      absence.recipients.length === 0
        ? absence.sleeping
          ? t.owls.sleepingHome
          : t.owls.flyingHome
        : absence.sleeping
          ? fill(t.owls.sleepingTo, { names })
          : fill(
              absence.purpose === 'gold'
                ? t.owls.flyingGold
                : absence.purpose === 'gift'
                  ? t.owls.flyingGift
                  : t.owls.flyingLetter,
              { names },
            );
    const doing = resting ?? what;
    if (absence.returnsAt === null) return doing;
    // v0.7.2: under an hour in minutes.
    return `${doing} ${fill(t.owls.backIn, { duration: duration(absence.returnsAt - Date.now()) })}`;
  }
</script>

<ErrorText message={error} />

{#if unnamed}
  <section class="card naming" aria-labelledby="naming-title">
    <h2 id="naming-title">
      {unnamed.isChick
        ? t.owls.chickNameTitle
        : fill(t.owls.nameTitle, { species: speciesName(unnamed.species) })}
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
        <p class="sex" data-testid="naming-sex">
          {fill(t.owls.nameSex, {
            sex: unnamed.sex === 'f' ? t.owls.female : t.owls.male,
          })}
        </p>
        <label for="owl-name">{t.owls.nameLabel}</label>
        <input id="owl-name" bind:value={newName} maxlength="40" autocomplete="off" required />
        <p class="hint">{t.owls.nameHint}</p>
        <button class="button" type="submit" disabled={busy || !status.online}>{t.owls.save}</button
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

{#if loaded && owls.length > 0}
  <p class="hint plate motivation-hint">{t.owls.motivationHint}</p>
{/if}

{#if loaded && owls.length === 0 && guests.length === 0}
  <p class="notice">
    <span aria-hidden="true">ℹ</span><span>{t.owls.none}</span>
  </p>
  <p><Link href="/app/menagerie" class="button">{t.owls.toMenagerie}</Link></p>
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
        {speciesName(owl.species)} · {owl.sex === 'f' ? t.owls.female : t.owls.male}
      </p>
      <p class="energy">
        <span>{fill(t.owls.energy, { energy: owl.energy, max: owl.maxEnergy })}</span>
        <GaugeBar share={owl.maxEnergy > 0 ? owl.energy / owl.maxEnergy : 0} />
      </p>
      <p class="energy" data-testid="owl-motivation">
        <span
          >{fill(t.owls.motivation, {
            value: Math.round(motivationFactor(owl.motivation) * 100),
          })}</span
        >
        <GaugeBar share={motivationShare(owl.motivation)} />
      </p>
      <p class="values">
        <span
          >{fill(t.owls.speed, {
            speed: speedOf(owl),
          })}{#if motivationPercent(owl.motivation) !== 0}<span
              class="effect"
              class:up={motivationPercent(owl.motivation) > 0}
              class:down={motivationPercent(owl.motivation) < 0}>{effectOf(owl)}</span
            >{/if}</span
        >
        <span
          >{fill(t.owls.recovery, {
            recovery: recoveryOf(owl),
          })}{#if motivationPercent(owl.motivation) !== 0}<span
              class="effect"
              class:up={motivationPercent(owl.motivation) > 0}
              class:down={motivationPercent(owl.motivation) < 0}>{effectOf(owl)}</span
            >{/if}</span
        >
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
            disabled={busy || owl.wateredToday || !status.online}
            onclick={() => void water(owl)}
            >{owl.wateredToday ? t.owls.wateredToday : t.owls.water}</button
          >
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void pet(owl)}>{t.owls.pet}</button
          >
          <button
            class="button secondary"
            type="button"
            disabled={busy || owl.fedToday || !status.online}
            onclick={() => void feed(owl)}>{owl.fedToday ? t.owls.fedToday : t.owls.feed}</button
          >
          <button
            class="button secondary"
            type="button"
            disabled={busy || owl.snackedToday || !status.online}
            onclick={() => void snack(owl)}
            >{owl.snackedToday ? t.owls.snackedToday : snackButton(owl)}</button
          >
        {/if}
        {#if owl.actions.treat}
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void treat(owl, 'self')}>{t.owls.treatSelf}</button
          >
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void treat(owl, 'vet')}>{t.owls.treatVet}</button
          >
        {/if}
        {#if owl.actions.menagerie}
          <button
            class="button secondary"
            type="button"
            disabled={busy || !status.online}
            onclick={() => void menagerie(owl)}>{t.owls.menagerie}</button
          >
        {/if}
        {#if owl.actions.rename}
          <button
            class="button secondary"
            type="button"
            onclick={() => {
              renaming = renaming === owl.id ? null : owl.id;
              newName = owl.name ?? '';
            }}>{t.owls.rename}</button
          >
        {:else if owl.kind === 'own'}
          <p class="hint">{t.owls.renameBlocked}</p>
        {/if}
        {#if owl.actions.gift}
          <button
            class="button secondary"
            type="button"
            onclick={() => (gifting = gifting === owl.id ? null : owl.id)}>{t.owls.gift}</button
          >
        {/if}
        {#if owl.actions.release}
          <button
            class="button danger"
            type="button"
            disabled={busy || !status.online}
            onclick={() => (releasing = owl)}>{t.owls.release}</button
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
            >{fill(t.owls.renameTitle, { name: owl.name ?? '' })}</label
          >
          <input
            id={`rename-${owl.id}`}
            bind:value={newName}
            maxlength="40"
            autocomplete="off"
            required
          />
          <p class="hint">{t.owls.nameHint}</p>
          <button class="button" type="submit" disabled={busy || !status.online}
            >{t.owls.save}</button
          >
          <button class="button secondary" type="button" onclick={() => (renaming = null)}
            >{t.owls.cancel}</button
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

{#if guests.length > 0}
  <!-- v0.7: visiting owls first – they only rest here for a while. -->
  <section aria-labelledby="guest-owls">
    <h2 id="guest-owls" class="group plate">{t.owls.guestGroup}</h2>
    <ul class="owls">
      {#each guests as guest (guest.id)}
        <GuestOwlCard {guest} onchanged={() => void load()} />
      {/each}
    </ul>
  </section>
{/if}

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
      released = fill(t.owls.releaseDone, { name: gone.name ?? '' });
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

  .values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin: 0.25rem 0 0.5rem;
  }

  /* +10 % in green, −20 % in red; the sign makes it readable in greyscale too (14). */
  .effect {
    font-weight: 700;
  }

  .effect.up {
    color: #1d6b2a;
  }

  .effect.down {
    color: #a3221b;
  }

  .motivation-hint {
    margin: 0 0 1rem;
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
