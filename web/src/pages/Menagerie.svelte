<script lang="ts">
  /** Menagerie (SPEC 8.7): all 17 species with picture, price and values; loan owls follow. */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
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

<p>{de.menagerie.intro}</p>
<ErrorText message={error} />
{#if !canBuy}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.menagerie.limit}</span>
  </p>{/if}

<section aria-labelledby="buy-title">
  <h2 id="buy-title">{de.menagerie.buyTitle}</h2>
  <ul class="species">
    {#each SPECIES as species (species.id)}
      <li class="card">
        <OwlPicture speciesId={species.id} alt={species.name} />
        <h3>{species.name}</h3>
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

<section aria-labelledby="loan-title">
  <h2 id="loan-title">{de.menagerie.loanTitle}</h2>
  <p>{de.menagerie.loanIntro}</p>
  {#if offer}
    <p>{fill(de.menagerie.loanCount, { count: offer.loans, max: offer.maxLoans })}</p>
    <ul class="species">
      {#each offer.offer as item (item.species)}
        <li class="card" data-testid="loan-offer">
          <OwlPicture speciesId={item.species} alt={`${item.name}, ${speciesName(item.species)}`} />
          <h3>{item.name}</h3>
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

<style>
  .species {
    list-style: none;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 1rem;
  }

  .species li {
    display: grid;
    gap: 0.35rem;
    align-content: start;
    --owl-size: 100%;
  }

  h3 {
    margin: 0.25rem 0 0;
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
