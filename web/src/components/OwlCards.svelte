<script lang="ts">
  /**
   * Cards of own and loan owls with all their actions (SPEC 8.5): picture, values, state, care,
   * Menagerie, renaming, gifts, release, "Brief schreiben" and (v0.10) "Gold verschicken". v1.3:
   * a sick owl is in the rescue centre (empty perch, link there); 🌍 after the name. v0.10: one component for the owl overview and the post office, which shows the
   * borrowed owls with the very same controls.
   */
  import { t, fill, speciesName, goldText, decimal, i18n } from '../lib/i18n.svelte.ts';
  import {
    GOLD,
    OWL,
    OWL_NAP_AFTER_CARE_MS,
    OWL_NAP_SHARE,
    MOTIVATION,
  } from '@posteulen/shared/constants.ts';
  import { cargoCovers, speciesById } from '@posteulen/shared/game/owls.ts';
  import { owlDisplayName } from '@posteulen/shared/game/badges.ts';
  import Link from './Link.svelte';
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  import { maxTransfer } from '@posteulen/shared/game/gold.ts';
  import {
    motivationFactor,
    motivationPercent,
    motivationShare,
  } from '@posteulen/shared/game/motivation.ts';
  import { speciesSnack } from '@posteulen/shared/texts/species.ts';
  import { isDay } from '@posteulen/shared/game/sun.ts';
  import type { OwlImageKind } from '@posteulen/shared/species.ts';
  import GaugeBar from './GaugeBar.svelte';
  import OwlPicture from './OwlPicture.svelte';
  import ErrorText from './ErrorText.svelte';
  import OwlGift from './OwlGift.svelte';
  import ReleaseDialog from './ReleaseDialog.svelte';
  import WriteDialog from './WriteDialog.svelte';
  import GoldDialog from './GoldDialog.svelte';
  import { account } from '../lib/auth.svelte.ts';
  import { careCost, privileged, spendableGold } from '../lib/purse.ts';
  import {
    feedOwl,
    lendToPostOffice,
    nameOwl,
    petOwl,
    snackOwl,
    waterOwl,
    type Owl,
  } from '../lib/owls.ts';
  import { dateTime, duration } from '../lib/format.ts';
  import { menagerieWage, speciesPrice } from '@posteulen/shared/game/chance.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let {
    owls,
    onchange,
    onreload,
    onremove,
    markLoans = false,
  }: {
    owls: readonly Owl[];
    /** v1.2.1: "(Leiheule)" behind the names of loan owls (owl overview). */
    markLoans?: boolean;
    /** An owl came back changed from the server. */
    onchange: (owl: Owl) => void;
    /** The whole list should be fetched again (e.g. after a gift). */
    onreload: () => void;
    /** An owl is gone (released). */
    onremove: (id: string) => void;
  } = $props();

  let error = $state<string | null>(null);
  let busy = $state(false);
  let renaming = $state<string | null>(null);
  let gifting = $state<string | null>(null);
  let releasing = $state<Owl | null>(null);
  /** v0.8.5: "Brief schreiben" with this owl – choosing the recipients. */
  let writing = $state<Owl | null>(null);
  /** v0.10: "Gold verschicken" with this owl. */
  let sendingGold = $state<Owl | null>(null);
  let released = $state<string | null>(null);
  let newName = $state('');

  /**
   * v0.10: gold can go with this owl right now – ready, carries gold, enough gold for a
   * transfer (more than 10.1) and at least one contact to send it to.
   */
  const goldPossible = $derived(
    maxTransfer(spendableGold()) > 0 &&
      live.contacts.some((contact) => contact.active && !contact.keyWarning),
  );
  const canSendGold = (owl: Owl): boolean =>
    goldPossible && owl.ready && cargoCovers(owl.cargo, 'gold');
  /**
   * Gold and owls can only be given by active players, once in two weeks (SPEC 9.1.5). v1.4:
   * while not allowed, the buttons are left out, and one note above the cards says why.
   */
  const giftAllowed = $derived(account.profile?.canGift ?? true);
  const giftBlocked = $derived(
    !giftAllowed && owls.some((owl) => owl.actions.gift || canSendGold(owl)),
  );

  /**
   * v1.4: only buttons that can be pressed right now stand under an owl (SPEC 8.5) – what does not
   * come into question is left out, so the cards stay small. Off only while offline.
   */
  const shows = (owl: Owl) => ({
    write: owl.ready,
    gold: canSendGold(owl) && giftAllowed,
    // v1.5.0: a chick knows only petting and its mealworm once a day (SPEC 9.3, 9.9).
    water: owl.actions.care && !owl.isChick && !owl.wateredToday,
    pet: owl.actions.care,
    feed: owl.actions.care && !owl.isChick && owl.feedable,
    mealworm: owl.actions.care && owl.isChick && owl.feedable,
    snack: owl.actions.care && !owl.isChick && owl.snackable,
    lend: owl.actions.menagerie,
    rename: owl.actions.rename,
    gift: owl.actions.gift && giftAllowed,
    release: owl.actions.release,
  });
  const hasActions = (owl: Owl): boolean => Object.values(shows(owl)).some(Boolean);
  /** v1.3: the name as shown everywhere – with 🌍 after more than 40 030 km (SPEC 9.2.1). */
  const label = (owl: Owl): string => owlDisplayName(owl.name ?? '', owl.badge);

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
      onchange((await petOwl(owl.id)).owl);
      showOwlImage(
        owl.species,
        owl.isChick ? 'chickPetting' : 'petting',
        fill(t.owls.petting, { name: owl.name ?? '' }),
      );
    });

  /** v1.5.0: a mealworm for a chick – 0.1 gold, once a day (SPEC 9.3, 9.9). */
  const mealworm = (owl: Owl) =>
    act(async () => {
      onchange((await feedOwl(owl.id)).owl);
      showOwlImage(
        owl.species,
        'chickFeeding',
        fill(t.owls.mealwormEating, { name: owl.name ?? '' }),
      );
      void refreshTopics('profile');
    });

  const water = (owl: Owl) =>
    act(async () => {
      onchange((await waterOwl(owl.id)).owl);
      showOwlImage(owl.species, 'drinking', fill(t.owls.drinking, { name: owl.name ?? '' }));
    });

  const snack = (owl: Owl) =>
    act(async () => {
      onchange((await snackOwl(owl.id)).owl);
      showOwlImage(
        owl.species,
        'snack',
        fill(t.owls.snacking, { name: owl.name ?? '', snack: snackOf(owl) }),
      );
      void refreshTopics('profile');
    });

  const feed = (owl: Owl) =>
    act(async () => {
      onchange((await feedOwl(owl.id)).owl);
      showOwlImage(owl.species, 'feeding', fill(t.owls.feeding, { name: owl.name ?? '' }));
      void refreshTopics('profile');
    });

  const snackOf = (owl: Owl): string => speciesSnack(owl.species, i18n.lang);
  /** "Getrocknete Mango geben (0,2 Gold)": the button starts with a capital letter (v0.6). */
  function snackButton(owl: Owl): string {
    const text = fill(t.owls.snack, {
      snack: snackOf(owl),
      price: careCost('snack', GOLD.SNACK_PRICE),
    });
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

  const saveName = (owl: Owl) =>
    act(async () => {
      onchange((await nameOwl(owl.id, newName.trim())).owl);
      renaming = null;
      newName = '';
    });

  const menagerie = (owl: Owl) =>
    act(async () => {
      const wage = goldText(menagerieWage(speciesPrice(owl.species)));
      if (!confirm(fill(t.owls.lendConfirm, { name: owl.name ?? '', amount: wage }))) return;
      onchange((await lendToPostOffice(owl.id)).owl);
    });

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

  /**
   * v0.8.5: resting at a recipient, the owl is not here – its empty perch is shown (as in the
   * menagerie; until v0.8.4 the normal picture).
   */
  const restingAway = (owl: Owl): boolean => owl.state === 'flying' && !!owl.absence?.resting;

  /** v1.4: on holiday and at the care station on Inchlonaig – not here, the empty perch. */
  const onIsland = (owl: Owl): boolean =>
    owl.state === 'vacation' && owl.vacation?.phase === 'island';

  /**
   * v1.4: a bored owl shows its bored picture whatever it would show otherwise – until it flies
   * off with a letter (SPEC 9.2.9); on a flight or on holiday the picture of the flight or the perch.
   */
  const boredHere = (owl: Owl): boolean =>
    owl.bored && owl.state !== 'flying' && owl.state !== 'vacation';

  /** The empty perch: lent to the post office, in the rescue centre, resting away, on the island. */
  const perch = (owl: Owl): boolean =>
    !boredHere(owl) &&
    (owl.state === 'menagerie' || owl.state === 'sick' || restingAway(owl) || onIsland(owl));

  /** v0.10: an owl at its lowest motivation (80 %) looks grumpy at home. */
  const grumpy = (owl: Owl): boolean => owl.motivation <= MOTIVATION.MIN;

  /**
   * Picture of the owl card: in flight by day or night where the owl is right now, grumpy when
   * ill (v0.3) and – v0.10 – at home with a motivation of 80 %. An owl in the menagerie shows its
   * empty perch instead (OwlPicture `perch`).
   */
  function pictureKind(owl: Owl): OwlImageKind {
    if (boredHere(owl)) return 'bored';
    // v1.4: on the way to the island or back home, by day or at night where it is right now.
    if (owl.state === 'vacation' && owl.vacation)
      return owl.vacation.daylight ? 'flyingDay' : 'flyingNight';
    if (owl.state === 'flying' && owl.absence) {
      // v0.5.1: asleep on the way, by day or at night where it is right now.
      if (owl.absence.sleeping) return owl.absence.daylight ? 'sleepDay' : 'sleepNight';
      return owl.absence.daylight ? 'flyingDay' : 'flyingNight';
    }
    if (owl.isChick) return 'chick';
    // v0.7: a brooding owl sits on its eggs.
    if (owl.state === 'brooding') return 'brooding';
    if (owl.state === 'home' && grumpy(owl)) return 'grumpy';
    return napping(owl) ? 'napHome' : 'normal';
  }

  /** v1.4.2: short descriptions (at most about four words, SPEC 14). */
  function pictureAlt(owl: Owl): string {
    const name = owl.name ?? '';
    if (boredHere(owl)) return fill(t.owls.boredAlt, { name });
    if (onIsland(owl)) return fill(t.owls.perchVacationAlt, { name });
    if (owl.state === 'vacation')
      return fill(owl.vacation?.daylight === false ? t.owls.flyingNightAlt : t.owls.flyingDayAlt, {
        name,
      });
    if (owl.state === 'menagerie') return fill(t.owls.perchAlt, { name });
    if (owl.state === 'sick') return fill(t.owls.perchRescueAlt, { name });
    if (restingAway(owl)) return fill(t.owls.perchRestingAlt, { name });
    if (owl.state === 'flying' && owl.absence) {
      const text = owl.absence.sleeping
        ? owl.absence.daylight
          ? t.owls.sleepDayAlt
          : t.owls.sleepNightAlt
        : owl.absence.daylight
          ? t.owls.flyingDayAlt
          : t.owls.flyingNightAlt;
      return fill(text, { name });
    }
    const kind = pictureKind(owl);
    if (kind === 'napHome') return fill(t.owls.napAlt, { name });
    if (kind === 'brooding') return fill(t.owls.broodingAlt, { name });
    if (kind === 'grumpy' && owl.state === 'home') return fill(t.owls.grumpyAlt, { name });
    return `${name}, ${speciesName(owl.species)}`;
  }

  function stateText(owl: Owl): string {
    const until = owl.stateUntil === null ? '' : dateTime(owl.stateUntil);
    switch (owl.state) {
      case 'sick':
        return fill(t.owls.stateRescue, { progress: owl.rescue?.progress ?? 0 });
      case 'brooding':
        return fill(t.owls.stateBrooding, { until });
      case 'menagerie':
        return fill(t.owls.stateMenagerie, { until });
      case 'flying':
        return absenceText(owl);
      case 'vacation':
        return vacationText(owl);
    }
    if (owl.kind === 'loan' && owl.loanExpiresAt !== null)
      return fill(t.owls.loanUntil, { until: dateTime(owl.loanExpiresAt) });
    if (owl.isChick && owl.adultAt !== null)
      return fill(t.owls.chick, { until: dateTime(owl.adultAt) });
    return t.owls.stateHome;
  }

  /** v1.4: where the owl is on its holiday and when it is back (SPEC 9.12). */
  function vacationText(owl: Owl): string {
    const trip = owl.vacation;
    if (!trip) return t.owls.vacationIsland;
    const back = dateTime(trip.returnsAt);
    if (trip.phase === 'back') return fill(t.owls.vacationBack, { time: back });
    if (trip.phase === 'island')
      return fill(t.owls.vacationStay, { leaves: dateTime(trip.backAt), time: back });
    return trip.islandAt === null
      ? fill(t.owls.vacationOutTurn, { time: back })
      : fill(t.owls.vacationOut, { arrives: dateTime(trip.islandAt), time: back });
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
    // v1.1: the next stop with its time, as on the map ("Deine Eulen unterwegs").
    const next = absence.nextStop
      ? ` ${fill(t.owls.nextStop, {
          name: absence.nextStop.name ?? t.letters.unknown,
          time: dateTime(absence.nextStop.arrivesAt),
        })}`
      : '';
    if (absence.returnsAt === null) return `${doing}${next}`;
    // v0.7.2: under an hour in minutes; v1.1 with the time.
    return `${doing}${next} ${fill(t.owls.backAt, {
      duration: duration(absence.returnsAt - Date.now()),
      time: dateTime(absence.returnsAt),
    })}`;
  }
</script>

<ErrorText message={error} />

{#if giftBlocked}
  <!-- v1.4: once above the cards instead of under every card (SPEC 9.1.5, 8.5). -->
  <p class="notice" data-testid="gift-rule">
    <span aria-hidden="true">ℹ</span><span>{t.owls.giftRule}</span>
  </p>
{/if}

{#if released}<p class="notice" role="status">
    <span aria-hidden="true">🕊</span><span>{released}</span>
  </p>{/if}

<ul class="owls">
  {#each owls as owl (owl.id)}
    <li class="card owl" data-testid="owl-card">
      <div class="picture">
        <OwlPicture
          wide
          speciesId={owl.species}
          kind={pictureKind(owl)}
          second={owl.second}
          chickLook={owl.chickLook}
          perch={perch(owl)}
          alt={pictureAlt(owl)}
        />
      </div>
      <div class="facts">
        <h3 class="name">
          <!-- v1.2.2: the space stands before the block – Svelte drops it at the start of one. -->
          {label(owl)}
          {#if markLoans && owl.kind === 'loan'}<span class="loan-mark">{t.owls.loanMark}</span
            >{/if}
        </h3>
        <p class="species">
          {speciesName(owl.species)} · {owl.sex === 'f' ? t.owls.female : t.owls.male}
          <!-- v1.2.4: kilometres flown in all, own owls only. -->
          {#if owl.kind === 'own' && owl.km !== null}· {fill(t.owls.kmFlown, {
              km: owl.km,
            })}{/if}
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
        <!-- v0.10: what the owl can carry; v0.10.1 not while it is on its way (also resting). -->
        {#if owl.state !== 'flying'}
          <p class="cargo" data-testid="owl-cargo">{t.owls[`cargo_${owl.cargo}`]}</p>
        {/if}
        <p class="state" class:away={owl.state !== 'home'}>
          <span aria-hidden="true"
            >{owl.state === 'home' ? '⌂' : owl.state === 'flying' ? '🦉' : 'ℹ'}</span
          >
          {stateText(owl)}
        </p>
        {#if owl.state === 'sick'}
          <!-- v1.3: cared for in the rescue centre only (SPEC 8.13). -->
          <p class="rescue-link owl-actions">
            <Link href="/app/rettungsstation" class="button secondary">{t.owls.toRescue}</Link>
          </p>
        {/if}
        {#if hasActions(owl)}
          {@const show = shows(owl)}
          <!-- v1.4: only what can be pressed right now (SPEC 8.5); off only while offline. -->
          <div class="actions owl-actions">
            {#if show.write}
              <!-- v0.8.5: write a letter with exactly this owl. -->
              <button
                class="button"
                type="button"
                disabled={!status.online}
                onclick={() => (writing = owl)}>{t.owls.write}</button
              >
            {/if}
            {#if show.gold}
              <!-- v0.10: gold with exactly this owl (before: on the finance page). -->
              <button
                class="button"
                type="button"
                disabled={!status.online}
                onclick={() => (sendingGold = owl)}>{t.owls.sendGold}</button
              >
            {/if}
            {#if show.water}
              <button
                class="button secondary"
                type="button"
                disabled={busy || !status.online}
                onclick={() => void water(owl)}>{t.owls.water}</button
              >
            {/if}
            {#if show.pet}
              <button
                class="button secondary"
                type="button"
                disabled={busy || !status.online}
                onclick={() => void pet(owl)}>{t.owls.pet}</button
              >
            {/if}
            {#if show.feed}
              <!-- v0.10: again and again while the energy is not full (each time paid). -->
              <button
                class="button secondary"
                type="button"
                disabled={busy || !status.online}
                onclick={() => void feed(owl)}
                >{fill(t.owls.feed, { price: careCost('feed', GOLD.FEED_PRICE) })}</button
              >
            {/if}
            {#if show.mealworm}
              <!-- v1.5.0: a chick gets a mealworm once a day, always for gold (SPEC 9.9). -->
              <button
                class="button secondary"
                type="button"
                disabled={busy || !status.online}
                onclick={() => void mealworm(owl)}
                >{fill(t.owls.mealworm, {
                  price: privileged() ? t.owls.free : goldText(GOLD.MEALWORM_PRICE),
                })}</button
              >
            {/if}
            {#if show.snack}
              <button
                class="button secondary"
                type="button"
                disabled={busy || !status.online}
                onclick={() => void snack(owl)}>{snackButton(owl)}</button
              >
            {/if}
            {#if show.lend}
              <!-- v1.4: to the post office, once per owl and quarter (SPEC 9.7). -->
              <button
                class="button secondary"
                type="button"
                disabled={busy || !status.online}
                onclick={() => void menagerie(owl)}>{t.owls.lend}</button
              >
            {/if}
            {#if show.rename}
              <button
                class="button secondary"
                type="button"
                onclick={() => {
                  renaming = renaming === owl.id ? null : owl.id;
                  newName = owl.name ?? '';
                }}>{t.owls.rename}</button
              >
            {/if}
            {#if show.gift}
              <button
                class="button secondary"
                type="button"
                onclick={() => (gifting = gifting === owl.id ? null : owl.id)}>{t.owls.gift}</button
              >
            {/if}
            {#if show.release}
              <button
                class="button danger"
                type="button"
                disabled={busy || !status.online}
                onclick={() => (releasing = owl)}>{t.owls.release}</button
              >
            {/if}
          </div>
        {/if}
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
              onreload();
            }}
          />
        {/if}
      </div>
    </li>
  {/each}
</ul>

{#if writing}
  <WriteDialog owl={writing} onclose={() => (writing = null)} />
{/if}

{#if sendingGold}
  <GoldDialog owl={sendingGold} onclose={() => (sendingGold = null)} onsent={onreload} />
{/if}

{#if releasing}
  <ReleaseDialog
    owl={releasing}
    onclose={() => (releasing = null)}
    onreleased={() => {
      const gone = releasing;
      releasing = null;
      if (!gone) return;
      onremove(gone.id);
      released = fill(t.owls.releaseDone, { name: gone.name ?? '' });
    }}
  />
{/if}

<style>
  /*
   * v1.1: the pictures are the focus – across the whole card, values and buttons below. On
   * phones one card per row, from 48 rem two side by side.
   */
  .owls {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  @media (min-width: 48rem) {
    .owls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
    }
  }

  .owl {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .name {
    margin: 0;
  }

  /* v1.2.1: the hint behind the name of a loan owl, a little quieter than the name. */
  .loan-mark {
    font-size: 0.8em;
    font-weight: 400;
    color: var(--ink-soft);
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

  .cargo {
    margin: 0 0 0.5rem;
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

  .state.away {
    font-style: italic;
  }

  .hint {
    color: var(--ink-soft);
    margin: 0.25rem 0;
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
