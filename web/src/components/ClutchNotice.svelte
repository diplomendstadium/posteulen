<script lang="ts">
  /**
   * v1.5.0: a chick to give away is hard to miss (SPEC 8.5, 9.9) – while a clutch is open, a
   * banner at the top of every page of the app, and once a day (UTC day) a big notice with the
   * picture of the chick, the time left and a button to the gift on "Meine Eulen". Once the
   * notice is closed, the server remembers it for today; the banner stays until the chick is on
   * its way.
   */
  import { TIME } from '@posteulen/shared/constants.ts';
  import { t, fill, speciesName } from '../lib/i18n.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { navigate, route } from '../lib/router.svelte.ts';
  import Link from './Link.svelte';
  import OwlPicture from './OwlPicture.svelte';

  const OWLS = '/app/eulen';

  const clutch = $derived(account.profile?.clutch ?? null);
  let dialog = $state<HTMLDialogElement | null>(null);
  /** Clutch and UTC day whose notice was already opened in this tab. */
  let shownFor = $state<string | null>(null);
  /** The clutch of the notice on screen. */
  let showing = $state<string | null>(null);

  $effect(() => {
    if (!clutch?.due) return;
    const key = `${clutch.id}:${new Date().toISOString().slice(0, 10)}`;
    if (shownFor === key) return;
    shownFor = key;
    showing = clutch.id;
  });

  /** Closed (any way): seen for today – only then, so a notice nobody saw comes again. */
  function closed(): void {
    const id = showing;
    showing = null;
    if (!id) return;
    void api('POST', `/api/clutches/${encodeURIComponent(id)}/notice-seen`).catch(() => {
      // Shown again with the next start – better twice than never.
    });
  }

  $effect(() => {
    if (showing !== null && dialog && !dialog.open) dialog.showModal();
  });

  function left(deadline: number): string {
    const ms = deadline - Date.now();
    if (ms >= 2 * TIME.DAY) return fill(t.clutchNotice.days, { days: Math.floor(ms / TIME.DAY) });
    if (ms >= TIME.DAY) return t.clutchNotice.day;
    if (ms >= 2 * TIME.HOUR)
      return fill(t.clutchNotice.hours, { hours: Math.floor(ms / TIME.HOUR) });
    return t.clutchNotice.hour;
  }

  function toOwls(): void {
    dialog?.close();
    navigate(OWLS);
  }
</script>

{#if clutch}
  <div class="banner" role="status" data-testid="clutch-banner">
    <span aria-hidden="true">🐣</span>
    <span
      >{fill(clutch.giftAll ? t.clutchNotice.bannerAll : t.clutchNotice.banner, {
        until: dateTime(clutch.deadline),
      })}
      {#if route.path !== OWLS}<Link href={OWLS}>{t.clutchNotice.bannerLink}</Link>{/if}</span
    >
  </div>
{/if}

{#if showing !== null && clutch}
  <dialog
    bind:this={dialog}
    aria-labelledby="clutch-notice-title"
    data-testid="clutch-notice"
    onclose={closed}
  >
    <h2 id="clutch-notice-title">
      {clutch.giftAll ? t.clutchNotice.titleAll : t.clutchNotice.title}
    </h2>
    <div class="picture">
      <OwlPicture
        speciesId={clutch.species}
        kind="chick"
        chickLook={clutch.look}
        size={480}
        alt={`${speciesName(clutch.species)}, ${t.clutchNotice.alt}`}
      />
    </div>
    <p>
      {clutch.giftAll
        ? t.clutchNotice.textAll
        : fill(t.clutchNotice.text, { count: clutch.chicks })}
    </p>
    <p class="left">
      {fill(t.clutchNotice.left, {
        until: dateTime(clutch.deadline),
        left: left(clutch.deadline),
      })}
    </p>
    <p>{clutch.recipients ? t.clutchNotice.lot : t.clutchNotice.noRecipients}</p>
    <div class="buttons">
      <button class="button" type="button" onclick={toOwls}>{t.clutchNotice.go}</button>
      <button class="button secondary" type="button" onclick={() => dialog?.close()}
        >{t.clutchNotice.later}</button
      >
    </div>
  </dialog>
{/if}

<style>
  .banner {
    margin: 0;
    padding: 0.5rem 1rem;
    background: var(--seal);
    color: var(--on-wood);
    font-weight: 700;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    flex-wrap: wrap;
  }

  .banner :global(a) {
    color: inherit;
  }

  dialog {
    width: min(100% - 2rem, 30rem);
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem 1.25rem 1rem;
    border: 3px solid var(--seal);
    border-radius: var(--radius);
    background: var(--paper);
    color: var(--ink);
  }

  dialog::backdrop {
    background: rgb(43 29 14 / 0.55);
  }

  h2 {
    font-size: 1.35rem;
    color: var(--seal);
    margin-top: 0;
  }

  .picture {
    --owl-size: 100%;
    max-width: 16rem;
    margin: 0 auto 0.75rem;
  }

  .left {
    font-weight: 700;
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
