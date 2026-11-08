<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { t, fill, speciesName, goldText } from '../lib/i18n.svelte.ts';
  import Compose from '../components/Compose.svelte';
  import LetterText from '../components/LetterText.svelte';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { loadConversation, type ShownLetter } from '../lib/letters.ts';
  import { live, markChatRead, refreshTopics } from '../lib/live.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { vault } from '../lib/vault.svelte.ts';
  import { showOwlImage, showSceneImage } from '../lib/overlay.svelte.ts';
  import { deckleClass } from '../lib/deckle.ts';
  import { scrollToLatest, scrollToLetter } from '../lib/scroll.ts';
  import { clearReplyWith, replyWith } from '../lib/reply.svelte.ts';

  let { peerId }: { peerId: string } = $props();

  let letters = $state<ShownLetter[]>([]);
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
        const invalid = vault.loaded ? unread.filter((l) => l.text === null).map((l) => l.id) : [];
        if (valid.length > 0) await api('POST', '/api/letters/read', { ids: valid });
        if (invalid.length > 0) await api('POST', '/api/letters/unreadable', { ids: invalid });
        markChatRead(peerId);
      }
      const unseen = letters.filter(
        (l) => l.role === 'recipient' && l.status === 'delivered' && !l.arrivalSeen,
      );
      if (unseen.length > 0) {
        // Arrival image of the owl that landed last (SPEC 9.2.6), once per delivery.
        const latest = unseen.reduce((a, b) => (b.arrivesAt > a.arrivesAt ? b : a));
        showOwlImage(
          latest.owl.species,
          latest.kind === 'cover_chick' ? 'chick' : 'arrival',
          fill(t.owls.arrives, { name: latest.owl.name }),
        );
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

  function statusText(letter: ShownLetter): string {
    if (letter.status === 'returned') return t.letters.returned;
    if (letter.status === 'in_flight')
      return fill(t.letters.inFlight, { time: dateTime(letter.arrivesAt) });
    if (letter.unreadable) return t.letters.unreadable;
    return letter.read ? t.letters.read : t.letters.delivered;
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
      <article class={`sheet ${deckleClass(letter.id)}`}>
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
        {:else}
          <p class="invalid">
            <span aria-hidden="true">⚠</span> <strong>{t.letters.invalid}</strong> – {t.letters
              .invalidLong}
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
                    ? '⚠'
                    : letter.read
                      ? '✔✔'
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
    onsent={() => {
      clearReplyWith();
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
    <Compose
      {peerId}
      bot
      onsent={() => {
        jump = 'smooth';
        void load();
        void refreshTopics('contacts');
      }}
    />
  {/if}
{/if}

<p class="danger">
  <button class="button secondary" type="button" onclick={() => void burnLetters()}
    >{t.letters.burnAll}</button
  >
</p>

<style>
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

  .danger {
    margin-top: 2rem;
  }
</style>
