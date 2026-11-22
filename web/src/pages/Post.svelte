<script lang="ts">
  /**
   * v0.10: the owl post office (SPEC 8.6). v1.2: at the entrance (`/app/postamt`) only the
   * picture of the place by day or night at the player's home, the intro and a large button to
   * go in; inside (`/app/postamt/innen`) the picture of the team of the day, (v0.10.1) the
   * borrowed owls with the same controls as in the owl overview if there are any, then the loan
   * owls of the day with price and carrying capacity.
   */
  import { t, fill, speciesName, decimal, goldText, locale, i18n } from '../lib/i18n.svelte.ts';
  import { loanDescription, loanReady } from '@posteulen/shared/texts/species.ts';
  import { OWL } from '@posteulen/shared/constants.ts';
  import { owlSpeedKmh } from '@posteulen/shared/game/flight.ts';
  import { speciesById } from '@posteulen/shared/game/owls.ts';
  import { canAfford } from '@posteulen/shared/game/gold.ts';
  import OwlPicture from '../components/OwlPicture.svelte';
  import OwlCards from '../components/OwlCards.svelte';
  import PlaceImage from '../components/PlaceImage.svelte';
  import ErrorText from '../components/ErrorText.svelte';
  import BagNotice from '../components/BagNotice.svelte';
  import { spendableGold } from '../lib/purse.ts';
  import { borrow, listOwls, menagerie, type Offer, type Owl } from '../lib/owls.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import { route } from '../lib/router.svelte.ts';
  import PlaceDoor from '../components/PlaceDoor.svelte';
  import { LOAN_TEAMS, type LoanTeam } from '@posteulen/shared/species.ts';

  /** v1.2: the address of the inside of the post office. */
  const INSIDE = '/app/postamt/innen';
  const inside = $derived(route.path === INSIDE);

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
    if (!inside) return;
    void live.owlsVersion;
    void load();
  });

  /**
   * v1.2: the team of the day decides the picture inside. An offer from before v1.1 has no team:
   * the team with most of its species, otherwise team A.
   */
  const team = $derived.by((): LoanTeam => {
    if (offer?.team) return offer.team;
    const species = offer?.offer.map((item) => item.species) ?? [];
    const teams = Object.keys(LOAN_TEAMS) as LoanTeam[];
    const overlap = (name: LoanTeam): number =>
      LOAN_TEAMS[name].filter((id) => species.includes(id)).length;
    return teams.reduce((best, name) => (overlap(name) > overlap(best) ? name : best), 'A');
  });

  /** Borrowed owls that already have their name (loan owls always have one). */
  const borrowed = $derived(owls.filter((owl) => owl.kind === 'loan' && owl.name !== null));
  const gold = $derived(spendableGold());
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

<!-- v1.3.1: owl biscuits and treats in the pouch (SPEC 9.1.6). -->
<BagNotice />
{#if !inside}
  <!-- v1.2: the entrance – picture, intro and the door. -->
  <PlaceImage place="post" />
  <p class="card intro">{t.post.intro}</p>
  <PlaceDoor href={INSIDE} label={t.post.enter} icons={['📯', '🦉']} />
{:else}
  {#if offer}<PlaceImage place="postInside" {team} />{/if}
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
      <!-- v1.2.4: a welcome and who is ready to travel right now. -->
      <p data-testid="loan-welcome">
        {t.post.loanWelcome}
        {#if offer}{loanReady(
            offer.offer.filter((item) => !item.loaned).map((item) => item.species),
            (id) => speciesName(id),
            i18n.lang,
          )}{/if}
      </p>
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
            <!-- v1.3: the sex is shown before borrowing, like on the owl cards (SPEC 8.6). -->
            <p class="species-name">
              {speciesName(item.species)} · {item.sex === 'f' ? t.owls.female : t.owls.male}
            </p>
            <!-- v0.10: the technical data as in the Menagerie, with the carrying capacity. -->
            <p class="stats" data-testid="loan-stats">
              {stats(item.species)} · {t.owls[`cargo_${item.cargo}`]}
            </p>
            <p class="price">{fill(t.post.loanPrice, { price: goldText(item.price) })}</p>
            {#if loanDescription(item.species, i18n.lang)}<p class="description">
                {loanDescription(item.species, i18n.lang)}
              </p>{/if}
            <div class="owl-actions">
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
            </div>
          </li>
        {/each}
      </ul>
    {/if}
    {#if loanDone}<p class="notice" role="status">
        <span aria-hidden="true">🦉</span><span>{loanDone}</span>
      </p>{/if}
  </section>
{/if}

<style>
  .species {
    list-style: none;
    padding: 0;
    display: grid;
    /* v1.2.4: wider cards with room for the description, like the Menagerie. */
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
    gap: 1rem;
  }

  .description {
    margin: 0.25rem 0 0.5rem;
    line-height: 1.55;
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
