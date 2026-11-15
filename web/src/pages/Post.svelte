<script lang="ts">
  /**
   * v0.10: the owl post office (SPEC 8.6): the picture of the place by day or night at the
   * player's home, the intro, (v0.10.1) the borrowed owls with the same controls as in the owl
   * overview if there are any, then the loan owls of the day with price and carrying capacity.
   */
  import { t, fill, speciesName, decimal, goldText, locale } from '../lib/i18n.svelte.ts';
  import { OWL } from '@posteulen/shared/constants.ts';
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  import { speciesById } from '@posteulen/shared/game/owls.ts';
  import { canAfford } from '@posteulen/shared/game/gold.ts';
  import OwlPicture from '../components/OwlPicture.svelte';
  import OwlCards from '../components/OwlCards.svelte';
  import PlaceImage from '../components/PlaceImage.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import { account } from '../lib/auth.svelte.ts';
  import { borrow, listOwls, menagerie, type Offer, type Owl } from '../lib/owls.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let error = $state<string | null>(null);
  let busy = $state(false);
  let offer = $state<Offer | null>(null);
  let loanDone = $state<string | null>(null);
  let owls = $state<Owl[]>([]);

  async function load(): Promise<void> {
    try {
      const [list, today] = await Promise.all([listOwls(), menagerie()]);
      owls = list.owls;
      offer = today;
    } catch {
      // Loaded again with the next update.
    }
  }

  $effect(() => {
    void live.owlsVersion;
    void load();
  });

  /** Borrowed owls that already have their name (loan owls always have one). */
  const borrowed = $derived(owls.filter((owl) => owl.kind === 'loan' && owl.name !== null));
  const gold = $derived(account.profile?.gold ?? 0);
  const number = (value: number): string => value.toLocaleString(locale());

  function stats(speciesId: string): string {
    const species = speciesById(speciesId);
    if (!species) return '';
    return fill(t.menagerie.stats, {
      energy: number(species.maxEnergy),
      speed: decimal(owlSpeedKmh(species.speedFactor), 1),
      recovery: decimal(OWL.REGEN_SHARE_PER_HOUR * 100 * species.recoveryFactor, 1),
    });
  }

  async function loan(item: Offer['offer'][number]): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    loanDone = null;
    try {
      await borrow(item.species);
      await load();
      loanDone = fill(t.post.loanDone, { name: item.name });
      await refreshTopics('profile');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  function replace(updated: Owl): void {
    owls = owls.map((owl) => (owl.id === updated.id ? updated : owl));
  }
</script>

<PlaceImage place="post" />

<p class="card intro">{t.post.intro}</p>
<ErrorText message={error} />

{#if borrowed.length > 0}
  <!-- v0.10.1: the borrowed owls first (only if there are any), then the offer. -->
  <section aria-labelledby="borrowed-title">
    <h2 id="borrowed-title" class="plate">{t.post.borrowedTitle}</h2>
    <OwlCards
      owls={borrowed}
      onchange={replace}
      onreload={() => void load()}
      onremove={(id) => (owls = owls.filter((other) => other.id !== id))}
    />
  </section>
{/if}

<section aria-labelledby="loan-title">
  <div class="card section-head">
    <h2 id="loan-title">{t.post.loanTitle}</h2>
    <p>{t.post.loanIntro}</p>
    {#if offer}
      <p>{fill(t.post.loanCount, { count: offer.loans, max: offer.maxLoans })}</p>
    {/if}
  </div>
  {#if offer}
    {#if offer.offer.length === 0}
      <p class="notice"><span aria-hidden="true">ℹ</span><span>{t.post.allDone}</span></p>
    {/if}
    <ul class="species">
      {#each offer.offer as item (item.species)}
        <li class="card" data-testid="loan-offer">
          <OwlPicture
            speciesId={item.species}
            alt={`${item.name}, ${speciesName(item.species)}`}
            size={480}
          />
          <h3 class="name">{item.name}</h3>
          <p class="species-name">{speciesName(item.species)}</p>
          <!-- v0.10: the technical data as in the Menagerie, with the carrying capacity. -->
          <p class="stats" data-testid="loan-stats">
            {stats(item.species)} · {t.owls[`cargo_${item.cargo}`]}
          </p>
          <p class="price">{fill(t.post.loanPrice, { price: goldText(item.price) })}</p>
          <button
            class="button"
            type="button"
            disabled={busy ||
              item.loaned ||
              offer.loans >= offer.maxLoans ||
              !status.online ||
              !canAfford(gold, item.price)}
            onclick={() => void loan(item)}
            >{item.loaned
              ? t.post.loaned
              : fill(t.post.loan, {
                  name: item.name,
                  species: speciesName(item.species),
                  sex: item.sex === 'f' ? t.owls.female : t.owls.male,
                })}</button
          >
        </li>
      {/each}
    </ul>
  {/if}
  {#if loanDone}<p class="notice" role="status">
      <span aria-hidden="true">🦉</span><span>{loanDone}</span>
    </p>{/if}
</section>

<style>
  .species {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
    gap: 1rem;
  }

  .species li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    --owl-size: 100%;
  }

  h3 {
    margin: 0.25rem 0 0;
    hyphens: auto;
    overflow-wrap: anywhere;
  }

  /* Buttons line up at the bottom of each row of cards. */
  .species li .button {
    margin-top: auto;
  }

  .intro {
    margin: 0 0 1rem;
  }

  .section-head {
    margin-bottom: 1rem;
  }

  .section-head > :last-child {
    margin-bottom: 0;
  }

  .species-name,
  .stats {
    margin: 0;
    color: var(--ink-soft);
  }

  .price {
    margin: 0;
    font-weight: 700;
  }

  section + section {
    margin-top: 1.5rem;
  }
</style>
