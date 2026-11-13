<script module lang="ts">
  /** v0.8.4: letters whose arrival image was already queued in this visit (see load()). */
  // Bookkeeping only, never rendered.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const arrivalsShown = new Set<string>();
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { t, fill, speciesName, goldText } from '../lib/i18n.svelte.ts';
  import Compose from '../components/Compose.svelte';
  import PictureViewer from '../components/PictureViewer.svelte';
  import LetterText from '../components/LetterText.svelte';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { loadConversation, type ShownLetter } from '../lib/letters.ts';
  import { live, markChatRead, refreshTopics } from '../lib/live.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { vault } from '../lib/vault.svelte.ts';
  import { queueOwlImage, showSceneImage } from '../lib/overlay.svelte.ts';
  import { deckleClass } from '../lib/deckle.ts';
  import { scrollToLatest, scrollToLetter } from '../lib/scroll.ts';
  import { clearReplyWith, clearWriteWith, replyWith, writeWith } from '../lib/reply.svelte.ts';

  let { peerId }: { peerId: string } = $props();

  let letters = $state<ShownLetter[]>([]);
  /** v0.8.5: a bot picture shown full screen. */
  let enlarged = $state<{ src: string; alt: string } | null>(null);
  let loading = $state(true);
  let list = $state<HTMLOListElement>();
  /** The first load jumps to the latest letter, a sent letter scrolls to it (v0.4). */
  let jump: 'instant' | 'smooth' | null = 'instant';

  const chat = $derived(live.chats.find((c) => c.peerId === peerId));
  const contact = $derived(live.contacts.find((c) => c.userId === peerId));
  const bot = $derived(live.bots.find((b) => b.userId === peerId));
  const name = $derived(contact?.name ?? bot?.name ?? chat?.name ?? t.letters.unknown);
  const writableFrom = $derived(
    bot?.writableFrom !== null && bot?.writableFrom !== undefined && bot.writableFrom > Date.now()
      ? bot.writableFrom
      : null,
  );
  /** Letters in handwriting unless the user prefers the plain font (settings, v0.2). */
  const print = $derived(account.profile?.lettersPrint ?? false);
  const retention = $derived(
    fill(t.letters.retentionHint, {
      period:
        (account.profile?.letterRetentionDays ?? 365) >= 365
          ? t.letters.retentionYear
          : fill(t.letters.retentionDays, { days: account.profile?.letterRetentionDays ?? 365 }),
    }),
  );

  async function load(): Promise<void> {
    try {
      letters = await loadConversation(peerId);
      loading = false;
      if (jump !== null && letters.length > 0) {
        const smooth = jump === 'smooth';
        jump = null;
        await tick();
        // v0.7: opening a chat starts at the oldest unread letter; without one at the latest.
        const firstUnread = smooth
          ? undefined
          : letters.find((l) => l.role === 'recipient' && l.status === 'delivered' && !l.read);
        if (firstUnread) await scrollToLetter(list, firstUnread.id);
        else await scrollToLatest(list, smooth);
      }
      // A letter counts as read once it is shown in the visible conversation (SPEC 8.4).
      // v0.5: one that could not be verified is reported as unreadable instead.
      const unread = letters.filter(
        (l) => l.role === 'recipient' && l.status === 'delivered' && !l.read,
      );
      if (unread.length > 0 && document.visibilityState === 'visible') {
        const valid = unread.filter((l) => l.text !== null).map((l) => l.id);
        // Only with the contact vault loaded: without the contact's keys nothing can be verified.
        if (valid.length > 0) await api('POST', '/api/letters/read', { ids: valid });
        // v0.8.2: with the technical reason for the admin's error log (one report per reason).
        // Local bookkeeping, not rendered state.
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const reasons = new Map<string, string[]>();
        for (const letter of unread.filter((l) => l.text === null)) {
          const reason = letter.failure ?? 'missing';
          reasons.set(reason, [...(reasons.get(reason) ?? []), letter.id]);
        }
        if (vault.loaded) {
          for (const [reason, ids] of reasons)
            await api('POST', '/api/letters/unreadable', { ids, reason });
        }
        markChatRead(peerId);
      }
      // v0.8.4: each arrival image only once – loads overlap when a chat opens (mount, live
      // update, read receipt), all before the server has confirmed "seen".
      const unseen = letters.filter(
        (l) =>
          l.role === 'recipient' &&
          l.status === 'delivered' &&
          !l.arrivalSeen &&
          !arrivalsShown.has(l.id),
      );
      for (const letter of unseen) arrivalsShown.add(letter.id);
      if (unseen.length > 0) {
        // v0.8.2: the arrival image of every owl that brought a new letter, one after another in
        // the order they landed (SPEC 9.2.6); before, only the last one.
        for (const letter of [...unseen].sort((a, b) => a.arrivesAt - b.arrivesAt)) {
          queueOwlImage(() => ({
            species: letter.owl.species,
            kind: letter.kind === 'cover_chick' ? 'chick' : 'arrival',
            caption: fill(t.owls.arrives, { name: letter.owl.name }),
          }));
        }
        await api('POST', '/api/letters/arrival-seen', { ids: unseen.map((l) => l.id) });
      }
    } catch {
      // Offline or navigated away: the next update (SSE or return to the app) loads again.
    }
  }

  onMount(() => {
    void load();
  });

  $effect(() => {
    void live.chatVersion;
    void vault.loaded;
    void load();
  });

  function coverText(letter: ShownLetter): string | null {
    if (letter.kind === 'cover_gold')
      return fill(t.letters.coverGold, { amount: goldText(letter.coverGold ?? 0) });
    if (letter.kind === 'cover_owl') return fill(t.letters.coverOwl, { owl: letter.owl.name });
    if (letter.kind === 'cover_chick') return fill(t.letters.coverChick, { owl: letter.owl.name });
    return null;
  }

  /**
   * v0.8.3: short letters lie slightly tilted on the table; from this height they stand straight
   * and without the drop shadow – a tilted very long sheet ran out of the window sideways (the
   * page then scrolled sideways and the bars went out of sight), and a filter on a huge layer is
   * expensive.
   */
  const STRAIGHT_FROM_PX = 1200;
  function tilt(sheet: HTMLElement) {
    const update = (): void => {
      sheet.parentElement?.classList.toggle('straight', sheet.offsetHeight > STRAIGHT_FROM_PX);
    };
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    update();
    return { destroy: () => observer.disconnect() };
  }

  function statusText(letter: ShownLetter): string {
    if (letter.status === 'returned') return t.letters.returned;
    if (letter.status === 'in_flight')
      return fill(t.letters.inFlight, { time: dateTime(letter.arrivesAt) });
    // v0.8.2: no read receipts – only "delivered"; a letter the recipient could not read was
    // "lost" by the owl.
    if (letter.unreadable) return t.letters.unreadable;
    return t.letters.delivered;
  }

  /**
   * v0.7.2: bots are not in the address book any more – a single bot is removed in its chat
   * (for good: chat, memory, planned letters and gold go).
   */
  async function removeThisBot(): Promise<void> {
    if (!confirm(fill(t.bots.removeConfirm, { name }))) return;
    await api('DELETE', `/api/contacts/${peerId}`);
    void refreshTopics('contacts', 'chats', 'map');
    navigate('/app/briefe');
  }

  /** v0.7: "Burn all letters" – confirmed first, then the letters go up in the fireplace. */
  async function burnLetters(): Promise<void> {
    if (!confirm(t.letters.deleteConfirm)) return;
    await api('DELETE', `/api/chats/${peerId}`);
    showSceneImage('burn', t.letters.burnCaption, t.letters.burnAlt);
    navigate('/app/briefe');
  }

  /** "Brought by Waldi (tawny owl)", for loan owls and visiting owls with a note (v0.7). */
  function carrierText(letter: ShownLetter): string {
    const species = speciesName(letter.owl.species);
    let what = species;
    if (letter.owl.carrier === 'loan') what = fill(t.letters.carrierLoan, { species });
    else if (letter.owl.carrier === 'own' && letter.role === 'recipient')
      what = fill(t.letters.carrierYours, { species });
    else if (letter.owl.carrier === 'foreign' && letter.role === 'sender')
      what = fill(t.letters.carrierOf, {
        species,
        name: letter.owl.holderName ?? t.letters.unknown,
      });
    return fill(letter.status === 'in_flight' ? t.letters.carriedBy : t.letters.from, {
      owl: letter.owl.name,
      species: what,
    });
  }
</script>

<p class="partner plate">
  <span class="name">{name}</span>
  {#if bot}<span class="bot-label"><span aria-hidden="true">🤖</span> {t.bots.label}</span>{/if}
</p>
{#if bot}
  <p class="notice bot-notice" data-testid="bot-notice">
    <span aria-hidden="true">🔓</span><span>{t.bots.notice}</span>
  </p>
  <p class="hint crisis plate">{t.bots.crisis}</p>
{/if}
{#if contact?.keyWarning}
  <p class="warning" role="alert">
    <span aria-hidden="true">⚠</span><span>{fill(t.contacts.keyWarningLong, { name })}</span>
  </p>
{/if}
{#if !contact && !bot && !loading}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{t.letters.notContact}</span>
  </p>{/if}

<p class="hint retention plate">{retention}</p>

<ol class="letters" class:print aria-live="polite" bind:this={list}>
  {#each letters as letter (letter.id)}
    <li class="letter" class:mine={letter.role === 'sender'} data-letter-id={letter.id}>
      <article class={`sheet ${deckleClass(letter.id)}`} use:tilt>
        {#if coverText(letter)}<p class="cover">{coverText(letter)}</p>{/if}
        <p class="meta">
          {dateTime(letter.sentAt)} · {letter.parchment === 'large'
            ? t.letters.large
            : t.letters.small}
          {#if letter.status !== 'returned'}
            · {carrierText(letter)}{/if}
        </p>
        {#if letter.text !== null}
          <LetterText text={letter.text} />
          {#if letter.media && letter.media.length > 0 && letter.role === 'recipient'}
            <!-- v0.8: pictures of a control-centre bot, below the letter, without file names. -->
            <div class="pictures">
              {#each letter.media as id, index (id)}
                {@const alt = fill(t.bots.pictureAlt, { n: index + 1, name })}
                <!-- v0.8.5: a tap shows the picture full screen. -->
                <button
                  type="button"
                  class="picture"
                  aria-label={`${alt} – ${t.bots.pictureOpen}`}
                  onclick={() => (enlarged = { src: `/api/bot-media/${id}`, alt })}
                >
                  <img src={`/api/bot-media/${id}`} {alt} loading="lazy" />
                </button>
              {/each}
            </div>
          {/if}
        {:else}
          <!-- v0.8.2: technical failures in the language of the game (the admin gets the reason). -->
          <p class="invalid">
            <span aria-hidden="true">💧</span>
            {letter.role === 'sender' ? t.letters.unreadable : t.letters.invalid}
          </p>
        {/if}
        {#if letter.role === 'sender'}
          <p class="status">
            <span aria-hidden="true"
              >{letter.status === 'returned'
                ? '↩'
                : letter.status === 'in_flight'
                  ? '🦉'
                  : letter.unreadable
                    ? '🪶'
                    : '✔'}</span
            >
            {statusText(letter)}
          </p>
        {/if}
      </article>
    </li>
  {/each}
</ol>

{#if contact && contact.active && !contact.keyWarning}
  <Compose
    {peerId}
    guestOwl={replyWith.peerId === peerId ? replyWith.owlId : null}
    presetOwl={writeWith.peerId === peerId ? writeWith.owlId : null}
    presetRecipients={writeWith.peerId === peerId ? writeWith.recipients : null}
    onsent={() => {
      clearReplyWith();
      clearWriteWith();
      jump = 'smooth';
      void load();
    }}
  />
{:else if bot}
  {#if writableFrom !== null}
    <p class="notice">
      <span aria-hidden="true">⏳</span><span
        >{fill(t.bots.writableFrom, { time: dateTime(writableFrom) })}</span
      >
    </p>
  {:else}
    {#if bot.type === 'central' && !bot.playerOwls}
      <p class="notice"><span aria-hidden="true">🦉</span><span>{t.bots.botOwlOnly}</span></p>
    {/if}
    <Compose
      {peerId}
      bot
      guestOnly={bot.type === 'central' && !bot.playerOwls}
      guestOwl={replyWith.peerId === peerId ? replyWith.owlId : null}
      presetOwl={writeWith.peerId === peerId ? writeWith.owlId : null}
      onsent={() => {
        clearReplyWith();
        clearWriteWith();
        jump = 'smooth';
        void load();
        void refreshTopics('contacts');
      }}
    />
  {/if}
{/if}

{#if enlarged}
  <PictureViewer src={enlarged.src} alt={enlarged.alt} onclose={() => (enlarged = null)} />
{/if}

<p class="danger">
  <button class="button secondary" type="button" onclick={() => void burnLetters()}
    >{t.letters.burnAll}</button
  >
  {#if bot}
    <button class="button secondary" type="button" onclick={() => void removeThisBot()}
      >{fill(t.bots.remove, { name })}</button
    >
  {/if}
</p>

<style>
  .pictures {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .pictures .picture {
    padding: 0;
    border: none;
    background: none;
    cursor: zoom-in;
    max-width: 100%;
  }

  .pictures img {
    display: block;
    max-width: 100%;
    max-height: 20rem;
    border-radius: 0.25rem;
  }

  .bot-label {
    display: inline-flex;
    gap: 0.25rem;
    margin-left: 0.5rem;
    padding: 0 0.5rem;
    border: 2px solid var(--wood);
    border-radius: 999px;
    font-weight: 700;
  }

  .crisis {
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .partner {
    font-size: 1.2rem;
  }

  .retention {
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  /* Letters as parchment sheets with a deckle edge (v0.3; v0.3.2: real parchment textures,
     light for letters to the user, dark for their own, no seal). Text stays dark enough on the
     darkest spots of the texture (WCAG AA). */
  .letters {
    list-style: none;
    padding: 0.75rem 0.25rem 0;
    display: grid;
    gap: 2.5rem;
    /* v0.8.3: nothing of a sheet may widen the page. */
    overflow-x: clip;
  }

  .letter {
    position: relative;
    width: min(100%, 36rem);
    filter: drop-shadow(0 2px 3px rgb(43 29 14 / 0.3));
  }

  .letter.mine {
    margin-left: auto;
  }

  .sheet {
    padding: 1.5rem clamp(1rem, 4vw, 2rem) 2.1rem;
    color: var(--ink-other);
    font-family: var(--font-hand-other);
    font-size: 1.05rem;
    line-height: 1.9;
    background: url('../../assets/parchment-light.webp') center / 450px repeat #f3dcb0;
    transform: rotate(-0.4deg);
  }

  .mine .sheet {
    color: var(--ink-own);
    font-family: var(--font-hand-own);
    font-size: 1.5rem;
    line-height: 1.4;
    background: url('../../assets/parchment-dark.webp') center / 450px repeat #d4b47c;
    transform: rotate(0.4deg);
  }

  /* v0.8.3: long letters stand straight, without the expensive shadow filter. */
  .letter:global(.straight) {
    filter: none;
  }

  .letter:global(.straight) .sheet {
    transform: none;
  }

  /* On dark parchment the small print uses the darkest ink as well. */
  .mine .meta,
  .mine .status {
    color: var(--ink);
  }

  .print .sheet,
  .print .mine .sheet {
    font-family: var(--font-body);
    font-size: 1rem;
    line-height: 1.5;
  }

  .meta,
  .status,
  .cover,
  .invalid {
    font-family: var(--font-body);
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet,
    .mine .sheet {
      transform: none;
    }
  }

  .cover {
    margin: 0 0 0.25rem;
    font-weight: 700;
    color: var(--wood-dark);
  }

  .meta,
  .status {
    margin: 0 0 0.25rem;
    font-size: 0.9rem;
    color: var(--ink-soft);
  }

  .status {
    margin: 0.5rem 0 0;
  }

  .invalid,
  .warning {
    color: var(--seal);
  }

  .warning {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--paper);
    border: 2px solid var(--seal);
    border-radius: 0.5rem;
    font-weight: 700;
  }

  /* v0.8.5: space between "Alle Briefe verbrennen" and "[Bot] entfernen", also when wrapped. */
  .danger {
    margin-top: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
</style>
