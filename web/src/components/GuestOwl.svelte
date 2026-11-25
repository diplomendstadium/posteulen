<script lang="ts">
  /**
   * v0.7: an owl of someone else that rests here for a while (SPEC 8.5): clearly marked as a
   * guest, with its energy and motivation. The host may care for it (and pays for biscuit and
   * snack) and can hand it a reply to its holder – then it takes off at once.
   * v0.8.3: owls of bots are cared for too, free of charge and without showing their motivation
   * (it is raised up to 120 % at most, a higher one stays as it is).
   */
  import { t, fill, speciesName, i18n } from '../lib/i18n.svelte.ts';
  import { speciesSnack } from '@posteulen/shared/texts/species.ts';
  import { motivationFactor, motivationShare } from '@posteulen/shared/game/motivation.ts';
  import OwlPicture from './OwlPicture.svelte';
  import GaugeBar from './GaugeBar.svelte';
  import { navigate } from '../lib/router.svelte.ts';
  import { replyWith } from '../lib/reply.svelte.ts';
  import ErrorText from './ErrorText.svelte';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { refreshTopics } from '../lib/live.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import type { GuestOwl } from '../lib/owls.ts';
  import { careCost } from '../lib/purse.ts';
  import { GOLD } from '@posteulen/shared/constants.ts';
  import { homeLight } from '../lib/season.ts';

  let { guest, onchanged }: { guest: GuestOwl; onchanged: () => void } = $props();

  let busy = $state(false);
  let error = $state<string | null>(null);

  const holder = $derived(guest.holderName ?? t.letters.unknown);
  const snack = $derived(speciesSnack(guest.species, i18n.lang));

  async function care(
    kind: 'water' | 'pet' | 'feed' | 'snack',
    image: 'drinking' | 'petting' | 'feeding' | 'snack',
    caption: string,
  ): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await api('POST', `/api/owls/${guest.id}/${kind}`, {});
      showOwlImage(guest.species, image, caption);
      if (kind === 'feed' || kind === 'snack') void refreshTopics('profile');
      onchanged();
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  /** v1.3.1: free for bot owls, otherwise from the pouch or with gold (SPEC 9.1.6). */
  const cost = (kind: 'feed' | 'snack'): string =>
    guest.bot ? t.owls.free : careCost(kind, kind === 'feed' ? GOLD.FEED_PRICE : GOLD.SNACK_PRICE);
  const feedText = $derived(fill(t.owls.feed, { price: cost('feed') }));

  function snackButton(): string {
    const text = fill(t.owls.snack, { snack, price: cost('snack') });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /** v0.8.2: the owl takes off at once – to its next recipient or home. */
  async function sendOn(): Promise<void> {
    if (busy || !confirm(fill(t.owls.guestSendOnConfirm, { name: guest.name }))) return;
    busy = true;
    error = null;
    try {
      await api('POST', `/api/guests/${guest.id}/send-on`, {});
      // v1.4: without a letter it flies off free – its freedom picture (SPEC 8.4, 9.2.6).
      showOwlImage(
        guest.species,
        homeLight().day ? 'free' : 'freeNight',
        fill(t.owls.guestFlewOn, { name: guest.name }),
      );
      onchanged();
      void refreshTopics('owls');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<li class="card owl guest" data-testid="guest-owl">
  <div class="picture">
    <OwlPicture speciesId={guest.species} alt={`${guest.name}, ${speciesName(guest.species)}`} />
  </div>
  <div class="facts">
    <p class="banner" role="note">
      <span aria-hidden="true">🛖</span>
      <span
        ><strong>{t.owls.guestBanner}</strong>
        {fill(t.owls.guestUntil, { time: dateTime(guest.restUntil) })}</span
      >
    </p>
    <h3 class="name">{guest.name}</h3>
    <p class="species">
      {speciesName(guest.species)} · {guest.sex === 'f' ? t.owls.female : t.owls.male} ·
      {fill(guest.loan ? t.owls.guestLoanOf : t.owls.guestOf, { name: holder })}
    </p>
    <p class="energy">
      <span>{fill(t.owls.energy, { energy: guest.energy, max: guest.maxEnergy })}</span>
      <GaugeBar share={guest.maxEnergy > 0 ? guest.energy / guest.maxEnergy : 0} />
    </p>
    {#if !guest.bot}
      <p class="energy">
        <span
          >{fill(t.owls.motivation, {
            value: Math.round(motivationFactor(guest.motivation) * 100),
          })}</span
        >
        <GaugeBar share={motivationShare(guest.motivation)} />
      </p>
    {/if}
    <p class="hint">
      {fill(guest.moreStops ? t.owls.guestHintOnward : t.owls.guestHint, { name: holder })}
    </p>
    <ErrorText message={error} />
    <!-- v1.4: only what can be pressed right now (SPEC 8.5). -->
    <div class="actions owl-actions">
      {#if !guest.wateredToday}
        <button
          class="button secondary"
          type="button"
          disabled={busy || !status.online}
          onclick={() =>
            void care('water', 'drinking', fill(t.owls.drinking, { name: guest.name }))}
          >{t.owls.water}</button
        >
      {/if}
      <button
        class="button secondary"
        type="button"
        disabled={busy || !status.online}
        onclick={() => void care('pet', 'petting', fill(t.owls.petting, { name: guest.name }))}
        >{t.owls.pet}</button
      >
      {#if guest.feedable}
        <button
          class="button secondary"
          type="button"
          disabled={busy || !status.online}
          onclick={() => void care('feed', 'feeding', fill(t.owls.feeding, { name: guest.name }))}
          >{feedText}</button
        >
      {/if}
      {#if guest.snackable}
        <button
          class="button secondary"
          type="button"
          disabled={busy || !status.online}
          onclick={() =>
            void care('snack', 'snack', fill(t.owls.snacking, { name: guest.name, snack }))}
          >{snackButton()}</button
        >
      {/if}
      {#if guest.holderName !== null}
        <!-- v0.7.1: opens the chat with exactly this owl chosen. -->
        <button
          class="button"
          type="button"
          onclick={() => {
            replyWith.peerId = guest.holderId;
            replyWith.owlId = guest.id;
            navigate(`/app/briefe/${guest.holderId}`);
          }}>{fill(t.owls.guestReply, { name: holder })}</button
        >
      {/if}
      <!-- v0.8.2: send the visiting owl on early, without a letter (confirmed first). -->
      <button
        class="button secondary"
        type="button"
        disabled={busy || !status.online}
        onclick={() => void sendOn()}>{t.owls.guestSendOn}</button
      >
    </div>
  </div>
</li>

<style>
  .owl {
    display: grid;
    grid-template-columns: minmax(6rem, 10rem) 1fr;
    gap: 1rem;
    align-items: start;
  }

  .guest {
    border: 3px dashed var(--wood);
  }

  .banner {
    display: flex;
    gap: 0.5rem;
    margin: 0 0 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--parchment-deep);
    border-radius: 0.5rem;
  }

  .name {
    margin: 0;
  }

  .species,
  .hint {
    color: var(--ink-soft);
  }

  .energy {
    display: grid;
    gap: 0.25rem;
    margin: 0.25rem 0;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  @media (max-width: 30rem) {
    .owl {
      grid-template-columns: 1fr;
    }

    .picture {
      --owl-size: 12rem;
    }
  }
</style>
