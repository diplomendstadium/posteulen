<script lang="ts">
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  /**
   * Menagerie (SPEC 8.7). v1.2.1: at the entrance (`/app/menagerie`) only the picture of the
   * place by day or night at home, the intro and a large button to go in, as at the post office;
   * inside (`/app/menagerie/innen`) its own picture, then all species for sale by price, each
   * with picture, values, carrying capacity (v0.10) and a description (v0.3).
   */
  import { t, fill, i18n, speciesName, locale, goldText, decimal } from '../lib/i18n.svelte.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import { speciesDescription } from '@posteulen/shared/texts/species.ts';
  import { canAfford, priceTenths } from '@posteulen/shared/game/gold.ts';
  import OwlPicture from '../components/OwlPicture.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import { spendableGold } from '../lib/purse.ts';
  import PlaceImage from '../components/PlaceImage.svelte';
  import { buyOwl, listOwls } from '../lib/owls.ts';
  import { OWL } from '@posteulen/shared/constants.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { refreshTopics } from '../lib/live.svelte.ts';
  import { navigate, route } from '../lib/router.svelte.ts';
  import PlaceDoor from '../components/PlaceDoor.svelte';

  /** v1.2.1: the address of the inside of the Menagerie. */
  const INSIDE = '/app/menagerie/innen';
  const inside = $derived(route.path === INSIDE);
  import { status } from '../lib/status.svelte.ts';

  let error = $state<string | null>(null);
  let busy = $state(false);
  let canBuy = $state(true);

  $effect(() => {
    if (!inside) return;
    void listOwls()
      .then((result) => (canBuy = result.canBuy))
      .catch(() => undefined);
  });

  /** Cheapest first; equal prices by name. */
  const forSale = SPECIES.filter((species) => !species.notForSale)
    .map((species) => ({ ...species, name: speciesName(species.id) }))
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name, i18n.lang));

  // v1.3.1: unlimited with the special status (SPEC 9.1.7).
  const gold = $derived(spendableGold());
  const number = (value: number): string => value.toLocaleString(locale());

  async function buy(speciesId: string, name: string, price: number): Promise<void> {
    if (busy) return;
    // v0.7.1: a purchase is confirmed first, so that nobody buys an owl by mistake.
    if (!confirm(fill(t.menagerie.buyConfirm, { species: name, price: goldText(price) }))) return;
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

{#if !inside}
  <!-- The entrance – picture, the door right below it (v1.4) and the intro. -->
  <PlaceImage place="menagerie" />
  <PlaceDoor href={INSIDE} label={t.menagerie.enter} icons={['🪶', '🦉']} />
  <p class="card intro">{t.menagerie.intro}</p>
{:else}
  <PlaceImage place="menagerieInside" />
  <ErrorText message={error} />
  {#if !canBuy}<p class="notice">
      <span aria-hidden="true">ℹ</span><span>{t.menagerie.limit}</span>
    </p>{/if}

  <section aria-labelledby="buy-title">
    <h2 id="buy-title" class="plate">{t.menagerie.buyTitle}</h2>
    <ul class="species for-sale">
      {#each forSale as species (species.id)}
        <li class="card">
          <OwlPicture speciesId={species.id} alt={species.name} size={480} />
          <h3>{species.name}</h3>
          <p class="price">
            {fill(t.menagerie.price, { price: goldText(priceTenths(species.price)) })}
          </p>
          <p class="stats">
            {fill(t.menagerie.stats, {
              energy: number(species.maxEnergy),
              // v0.5: absolute values of the species instead of factors.
              speed: decimal(owlSpeedKmh(species.speedFactor), 1),
              recovery: decimal(OWL.REGEN_SHARE_PER_HOUR * 100 * species.recoveryFactor, 1),
            })} · {t.owls[`cargo_${species.cargo}`]}
          </p>
          {#if species.mythical}<p class="hint">{t.menagerie.mythical}</p>{/if}
          {#if speciesDescription(species.id, i18n.lang)}<p class="description">
              {speciesDescription(species.id, i18n.lang)}
            </p>{/if}
          <div class="owl-actions">
            <button
              class="button"
              type="button"
              disabled={busy ||
                !canBuy ||
                !status.online ||
                !canAfford(gold, priceTenths(species.price))}
              onclick={() => void buy(species.id, species.name, priceTenths(species.price))}
              >{fill(t.menagerie.buy, { species: species.name })}</button
            >
          </div>
        </li>
      {/each}
    </ul>
  </section>
{/if}

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

  .price {
    margin: 0;
    font-weight: 700;
  }

  .stats {
    margin: 0;
    color: var(--ink-soft);
  }

  .hint {
    color: var(--ink-soft);
    font-style: italic;
  }
</style>
