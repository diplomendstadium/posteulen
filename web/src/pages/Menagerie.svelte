<script lang="ts">
  /** Menagerie (SPEC 8.7): all 17 species with picture, price and values; loan owls follow. */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import { canAfford, formatGold, priceTenths } from '@posteulen/shared/game/gold.ts';
  import OwlPicture from '../components/OwlPicture.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import { account } from '../lib/auth.svelte.ts';
  import { buyOwl, listOwls } from '../lib/owls.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { refreshTopics } from '../lib/live.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let error = $state<string | null>(null);
  let busy = $state(false);
  let canBuy = $state(true);

  $effect(() => {
    void listOwls()
      .then((result) => (canBuy = result.canBuy))
      .catch(() => undefined);
  });

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
  <p class="notice"><span aria-hidden="true">ℹ</span><span>{de.menagerie.loanLater}</span></p>
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
