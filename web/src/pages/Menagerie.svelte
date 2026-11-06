<script lang="ts">
  /**
   * Menagerie (SPEC 8.7): the loan owls of the day on top, then all 17 species for sale by
   * price, each with picture, values and a description (v0.3).
   */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import { SPECIES_DESCRIPTIONS } from '@posteulen/shared/texts/species.ts';
  import { canAfford, formatGold, priceTenths } from '@posteulen/shared/game/gold.ts';
  import OwlPicture from '../components/OwlPicture.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import { account } from '../lib/auth.svelte.ts';
  import { borrow, buyOwl, listOwls, menagerie, type Offer } from '../lib/owls.ts';
  import { GOLD } from '@posteulen/shared/constants.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { refreshTopics } from '../lib/live.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let error = $state<string | null>(null);
  let busy = $state(false);
  let canBuy = $state(true);
  let offer = $state<Offer | null>(null);
  let loanDone = $state<string | null>(null);

  $effect(() => {
    void listOwls()
      .then((result) => (canBuy = result.canBuy))
      .catch(() => undefined);
    void menagerie()
      .then((result) => (offer = result))
      .catch(() => undefined);
  });

  const speciesName = (id: string): string => SPECIES.find((s) => s.id === id)?.name ?? id;
  /** Cheapest first; equal prices by name. */
  const forSale = [...SPECIES].sort(
    (a, b) => a.price - b.price || a.name.localeCompare(b.name, 'de'),
  );

  async function loan(item: Offer['offer'][number]): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    loanDone = null;
    try {
      await borrow(item.species);
      offer = await menagerie();
      loanDone = fill(de.menagerie.loanDone, { name: item.name });
      await refreshTopics('profile');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  const gold = $derived(account.profile?.gold ?? 0);
  const number = (value: number): string => value.toLocaleString('de-DE');

  async function buy(speciesId: string): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await buyOwl(speciesId);
      await refreshTopics('profile');
      // Naming is a mandatory dialog right after buying (SPEC 9.2.3).
      navigate('/app/eulen');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<p class="card intro">{de.menagerie.intro}</p>
<ErrorText message={error} />
{#if !canBuy}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.menagerie.limit}</span>
  </p>{/if}

<section aria-labelledby="loan-title">
  <div class="card section-head">
    <h2 id="loan-title">{de.menagerie.loanTitle}</h2>
    <p>{de.menagerie.loanIntro}</p>
    {#if offer}
      <p>{fill(de.menagerie.loanCount, { count: offer.loans, max: offer.maxLoans })}</p>
    {/if}
  </div>
  {#if offer}
    <ul class="species">
      {#each offer.offer as item (item.species)}
        <li class="card" data-testid="loan-offer">
          <OwlPicture
            speciesId={item.species}
            alt={`${item.name}, ${speciesName(item.species)}`}
            size={480}
          />
          <h3 class="name" lang="de">{item.name}</h3>
          <p class="stats">{speciesName(item.species)}</p>
          <button
            class="button"
            type="button"
            disabled={busy ||
              item.loaned ||
              offer.loans >= offer.maxLoans ||
              !status.online ||
              !canAfford(gold, GOLD.LOAN_PRICE)}
            onclick={() => void loan(item)}
            >{item.loaned
              ? de.menagerie.loaned
              : fill(de.menagerie.loan, {
                  name: item.name,
                  species: speciesName(item.species),
                  sex: item.sex === 'f' ? de.owls.female : de.owls.male,
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

<section aria-labelledby="buy-title">
  <h2 id="buy-title" class="plate">{de.menagerie.buyTitle}</h2>
  <ul class="species for-sale">
    {#each forSale as species (species.id)}
      <li class="card">
        <OwlPicture speciesId={species.id} alt={species.name} size={480} />
        <h3 lang="de">{species.name}</h3>
        <p class="price">
          {fill(de.menagerie.price, { price: `${formatGold(priceTenths(species.price))} Gold` })}
        </p>
        <p class="stats">
          {fill(de.menagerie.stats, {
            energy: number(species.maxEnergy),
            speed: number(species.speedFactor),
            recovery: number(species.recoveryFactor),
          })}
        </p>
        {#if SPECIES_DESCRIPTIONS[species.id]}<p class="description">
            {SPECIES_DESCRIPTIONS[species.id]}
          </p>{/if}
        <button
          class="button"
          type="button"
          disabled={busy ||
            !canBuy ||
            !status.online ||
            !canAfford(gold, priceTenths(species.price))}
          onclick={() => void buy(species.id)}
          >{fill(de.menagerie.buy, { species: species.name })}</button
        >
      </li>
    {/each}
  </ul>
</section>

<style>
  .species {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
    gap: 1rem;
  }

  /* With a description the cards get wider, so the text has room and the picture stays big. */
  .species.for-sale {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
  }

  .species li {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    --owl-size: 100%;
  }

  /* Long names such as "Südliche Weißgesichtseule" break with a hyphen instead of
     overflowing the card (v0.3); as a last resort anywhere. */
  h3 {
    margin: 0.25rem 0 0;
    hyphens: auto;
    overflow-wrap: anywhere;
  }

  .description {
    margin: 0.25rem 0 0.5rem;
    line-height: 1.55;
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

  .price {
    margin: 0;
    font-weight: 700;
  }

  .stats {
    margin: 0;
    color: var(--ink-soft);
  }
</style>
