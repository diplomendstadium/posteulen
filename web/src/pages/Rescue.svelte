<script lang="ts">
  /**
   * v1.3: the owl rescue centre (SPEC 8.13). At the entrance (`/app/rettungsstation`) the
   * picture of the place for the season and light at home, the welcome and a door; inside
   * (`/app/rettungsstation/innen`) the own sick owls on top, then one wild sick owl. Five
   * interactions – medicine, biscuit, snack, stroking, water – each counted once a day; the
   * progress bar moves at once. At 100 % an own owl goes home; a wild one flies off or stays.
   */
  import { t, fill, speciesName, i18n } from '../lib/i18n.svelte.ts';
  import { RESCUE_ACTIONS } from '@posteulen/shared/game/rescue.ts';
  import BagNotice from '../components/BagNotice.svelte';
  import { careCost } from '../lib/purse.ts';
  import { owlDisplayName } from '@posteulen/shared/game/badges.ts';
  import { speciesSnack } from '@posteulen/shared/texts/species.ts';
  import PlaceImage from '../components/PlaceImage.svelte';
  import PlaceDoor from '../components/PlaceDoor.svelte';
  import OwlPicture from '../components/OwlPicture.svelte';
  import GaugeBar from '../components/GaugeBar.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import {
    getRescue,
    releaseWild,
    rescueCare,
    type RescueAction,
    type RescueOwl,
  } from '../lib/owls.ts';
  import { route } from '../lib/router.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { queueOwlImage, showOwlImage } from '../lib/overlay.svelte.ts';
  import { homeLight, standardKind } from '../lib/season.ts';
  import { status } from '../lib/status.svelte.ts';

  const INSIDE = '/app/rettungsstation/innen';
  const inside = $derived(route.path === INSIDE);

  let own = $state<RescueOwl[]>([]);
  let wild = $state<RescueOwl[]>([]);
  let prices = $state({ feed: 1, snack: 2 });
  let loaded = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function load(): Promise<void> {
    try {
      const result = await getRescue();
      own = result.own;
      wild = result.wild;
      prices = result.prices;
      loaded = true;
    } catch (caught) {
      error = errorMessage(caught);
    }
  }

  $effect(() => {
    if (!inside) return;
    void live.owlsVersion;
    void load();
  });

  const nameOf = (owl: RescueOwl): string => owlDisplayName(owl.name, owl.badge);

  /** v1.3.1: the free ones first – water, stroking, medicine – then biscuit and snack. */
  const ACTIONS = RESCUE_ACTIONS;

  /** The picture shown after each interaction (SPEC 9.2.6, 8.13). */
  const PICTURE = {
    medicine: 'medicine',
    feed: 'feeding',
    snack: 'snack',
    pet: 'petting',
    water: 'drinking',
  } as const;

  function label(owl: RescueOwl, action: RescueAction): string {
    switch (action) {
      case 'medicine':
        return t.rescue.medicine;
      case 'feed':
        return fill(t.rescue.feed, { price: careCost('feed', prices.feed) });
      case 'snack': {
        const text = fill(t.rescue.snack, {
          snack: speciesSnack(owl.species, i18n.lang),
          price: careCost('snack', prices.snack),
        });
        return text.charAt(0).toUpperCase() + text.slice(1);
      }
      case 'pet':
        return t.rescue.pet;
      case 'water':
        return t.rescue.water;
    }
  }

  function caption(owl: RescueOwl, action: RescueAction): string {
    const name = nameOf(owl);
    switch (action) {
      case 'medicine':
        return fill(t.rescue.medicineCaption, { name });
      case 'feed':
        return fill(t.owls.feeding, { name });
      case 'snack':
        return fill(t.owls.snacking, { name, snack: speciesSnack(owl.species, i18n.lang) });
      case 'pet':
        return fill(t.owls.petting, { name });
      case 'water':
        return fill(t.owls.drinking, { name });
    }
  }

  const homeKind = (): 'homeDay' | 'homeNight' => (homeLight().day ? 'homeDay' : 'homeNight');

  async function care(who: 'own' | 'wild', owl: RescueOwl, action: RescueAction): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const result = await rescueCare(who, owl.id, action);
      // The bar moves at once.
      const update = (list: RescueOwl[]) =>
        list.map((entry) =>
          entry.id === owl.id
            ? {
                ...entry,
                progress: result.progress,
                healed: result.healed,
                today: { ...entry.today, [action]: true },
              }
            : entry,
        );
      if (who === 'own') own = update(own);
      else wild = update(wild);
      showOwlImage(owl.species, PICTURE[action], caption(owl, action));
      if (result.healed) {
        const name = nameOf(owl);
        queueOwlImage(() => ({
          species: owl.species,
          kind: standardKind('healthy', homeLight()),
          caption: fill(t.rescue.healed, { name }),
        }));
        if (who === 'own') {
          queueOwlImage(() => ({
            species: owl.species,
            kind: homeKind(),
            caption: fill(t.rescue.goHome, { name }),
          }));
          own = own.filter((entry) => entry.id !== owl.id);
          void refreshTopics('owls');
        }
      }
      if (action === 'feed' || action === 'snack') void refreshTopics('profile');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  async function findOut(owl: RescueOwl): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      const result = await releaseWild(owl.id);
      const name = owl.name;
      if (result.stays) {
        showOwlImage(owl.species, homeKind(), fill(t.rescue.stays, { name }));
        void refreshTopics('owls');
      } else {
        showOwlImage(
          owl.species,
          homeLight().day ? 'flyingDay' : 'flyingNight',
          fill(t.rescue.freedom, { name }),
        );
      }
      await load();
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

{#snippet card(who: 'own' | 'wild', owl: RescueOwl)}
  <li class="card owl" data-testid={`rescue-${who}`}>
    <OwlPicture
      wide
      speciesId={owl.species}
      kind={owl.healed ? 'normal' : 'sick'}
      alt={owl.healed
        ? `${nameOf(owl)}, ${speciesName(owl.species)}`
        : fill(t.rescue.sickAlt, { name: nameOf(owl) })}
    />
    <h3 class="name">{nameOf(owl)}</h3>
    <p class="species">
      {speciesName(owl.species)} · {owl.sex === 'f' ? t.owls.female : t.owls.male}
    </p>
    <p class="progress" data-testid="rescue-progress">
      <span>{fill(t.rescue.progress, { progress: owl.progress })}</span>
      <GaugeBar share={owl.progress / 100} />
    </p>
    {#if owl.healed}
      <p class="notice" role="status">
        <span aria-hidden="true">💚</span><span
          >{fill(t.rescue.healedHint, { name: owl.name })}</span
        >
      </p>
      <div class="owl-actions">
        <button
          class="button"
          type="button"
          disabled={busy || !status.online}
          onclick={() => void findOut(owl)}>{fill(t.rescue.findOut, { name: owl.name })}</button
        >
      </div>
    {:else}
      <div class="actions owl-actions">
        {#each ACTIONS as action (action)}
          <!-- v1.4: help already counted today is left out (stroking always stays, SPEC 8.13). -->
          {#if action === 'pet' || !owl.today[action]}
            <button
              class="button secondary"
              type="button"
              data-action={action}
              disabled={busy || !status.online}
              onclick={() => void care(who, owl, action)}>{label(owl, action)}</button
            >
          {/if}
        {/each}
      </div>
    {/if}
  </li>
{/snippet}

<BagNotice />
{#if !inside}
  <!-- The entrance – picture, the door right below it (v1.4.2, as in post office and Menagerie)
       and the intro. -->
  <PlaceImage place="rescue" />
  <PlaceDoor href={INSIDE} label={t.rescue.enter} icons={['⚕', '🦉']} />
  <p class="card intro">{t.rescue.intro}</p>
{:else}
  <PlaceImage place="rescueInside" />
  <section class="card intro">
    <p>{t.rescue.inside}</p>
    <p>{t.rescue.insideOwn}</p>
    <p class="hint">{t.rescue.rules}</p>
  </section>
  <ErrorText message={error} />
  {#if loaded}
    {#if own.length > 0}
      <section aria-labelledby="rescue-own">
        <h2 id="rescue-own" class="plate">{t.rescue.ownTitle}</h2>
        <ul class="owls">
          {#each own as owl (owl.id)}{@render card('own', owl)}{/each}
        </ul>
      </section>
    {/if}
    <section aria-labelledby="rescue-wild">
      <h2 id="rescue-wild" class="plate">{t.rescue.wildTitle}</h2>
      <ul class="owls">
        {#each wild as owl (owl.id)}{@render card('wild', owl)}{/each}
      </ul>
    </section>
  {:else}
    <p class="loading" role="status">…</p>
  {/if}
{/if}

<style>
  .intro p {
    margin: 0 0 0.75rem;
  }

  /* v1.3.1: room between the intro and the plates below, as in the post office. */
  .intro {
    margin: 0 0 1rem;
  }

  .intro p:last-child {
    margin-bottom: 0;
  }

  .owls {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    gap: 1rem;
  }

  .owl {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }

  .name {
    margin: 0.25rem 0 0;
    overflow-wrap: anywhere;
  }

  .species,
  .progress {
    margin: 0;
    color: var(--ink-soft);
  }

  .progress {
    display: grid;
    gap: 0.25rem;
  }

  .loading {
    text-align: center;
  }
</style>
