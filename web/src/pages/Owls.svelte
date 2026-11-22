<script lang="ts">
  /**
   * Own owls (SPEC 8.5): picture, name, species, sex, energy, state and actions. v0.5: energy
   * and motivation bars, speed and recovery of the species, water and favourite snack.
   * v0.10: the cards live in OwlCards (shared with the post office).
   */
  import { t, fill, speciesName, i18n } from '../lib/i18n.svelte.ts';
  import { overviewOrder } from '@posteulen/shared/game/owls.ts';
  import { MAP, TIME } from '@posteulen/shared/constants.ts';
  import Link from '../components/Link.svelte';
  import OwlPicture from '../components/OwlPicture.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import ChickGift from '../components/ChickGift.svelte';
  import OwlCards from '../components/OwlCards.svelte';
  import BagNotice from '../components/BagNotice.svelte';
  import { listOwls, nameOwl, type Clutch, type GuestOwl, type Owl } from '../lib/owls.ts';
  import GuestOwlCard from '../components/GuestOwl.svelte';
  import { errorMessage } from '../lib/messages.ts';
  import { live } from '../lib/live.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  const OWLS_REFRESH_MS = MAP.CLIENT_REFRESH_MINUTES * TIME.MINUTE;

  let owls = $state<Owl[]>([]);
  /** v0.7: owls of others resting here. */
  let guests = $state<GuestOwl[]>([]);
  let clutches = $state<Clutch[]>([]);
  let loaded = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
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

  /**
   * v0.8.5: the server works out the flight phase and daylight when the list is fetched. While
   * the overview stays open with owls on their way, it is fetched again every five minutes (as
   * the map recalculates) – so a day flight turns into a nap without any new event.
   */
  const flying = $derived(owls.some((owl) => owl.state === 'flying'));
  $effect(() => {
    if (!flying) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, OWLS_REFRESH_MS);
    return () => clearInterval(timer);
  });

  function replace(updated: Owl): void {
    owls = owls.map((owl) => (owl.id === updated.id ? updated : owl));
  }

  /** The mandatory name right after buying or hatching (9.2.3). */
  async function saveName(owl: Owl): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      replace((await nameOwl(owl.id, newName.trim())).owl);
      newName = '';
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  /**
   * v1.2.1: own and loan owls together – on top the owls ready for post (fullest energy first),
   * below the ones on their way or busy (expected back soonest first).
   */
  const named = $derived(owls.filter((owl) => owl.name !== null));
  const groups = $derived.by(() => {
    const { ready, busy } = overviewOrder(named, (a, b) => a.localeCompare(b, i18n.lang));
    return [
      { id: 'ready-owls', title: t.owls.readyGroup, list: ready },
      { id: 'busy-owls', title: t.owls.busyGroup, list: busy },
    ].filter((group) => group.list.length > 0);
  });
</script>

<!-- v1.3.1: owl biscuits and treats in the pouch (SPEC 9.1.6). -->
<BagNotice />
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

{#if loaded && owls.length === 0 && guests.length === 0}
  <p class="notice">
    <span aria-hidden="true">ℹ</span><span>{t.owls.none}</span>
  </p>
  <p><Link href="/app/menagerie" class="button">{t.owls.toMenagerie}</Link></p>
{/if}

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
    <OwlCards
      owls={group.list}
      markLoans
      onchange={replace}
      onreload={() => void load()}
      onremove={(id) => (owls = owls.filter((other) => other.id !== id))}
    />
  </section>
{/each}

<!-- v0.8.5: the explanation of motivation, care and sickness at the end of the page. -->
{#if loaded && owls.length > 0}
  <p class="hint plate motivation-hint">{t.owls.motivationHint}</p>
{/if}

<style>
  .owls {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 1rem;
  }

  .group {
    margin: 1.5rem 0 0.75rem;
  }

  .motivation-hint {
    margin: 1.5rem 0 1rem;
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
</style>
