<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { SPECIES } from '@posteulen/shared/species.ts';
  import Compose from '../components/Compose.svelte';
  import LetterText from '../components/LetterText.svelte';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { loadConversation, type ShownLetter } from '../lib/letters.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { account } from '../lib/auth.svelte.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { vault } from '../lib/vault.svelte.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { formatGold } from '@posteulen/shared/game/gold.ts';

  let { peerId }: { peerId: string } = $props();

  let letters = $state<ShownLetter[]>([]);
  let loading = $state(true);

  const chat = $derived(live.chats.find((c) => c.peerId === peerId));
  const contact = $derived(live.contacts.find((c) => c.userId === peerId));
  const bot = $derived(live.bots.find((b) => b.userId === peerId));
  const name = $derived(contact?.name ?? bot?.name ?? chat?.name ?? de.letters.unknown);
  const writableFrom = $derived(
    bot?.writableFrom !== null && bot?.writableFrom !== undefined && bot.writableFrom > Date.now()
      ? bot.writableFrom
      : null,
  );
  const speciesName = (id: string): string => SPECIES.find((s) => s.id === id)?.name ?? id;
  /** Letters in handwriting unless the user prefers the plain font (settings, v0.2). */
  const print = $derived(account.profile?.lettersPrint ?? false);
  const retention = $derived(
    fill(de.letters.retentionHint, {
      period:
        (account.profile?.letterRetentionDays ?? 365) >= 365
          ? de.letters.retentionYear
          : fill(de.letters.retentionDays, { days: account.profile?.letterRetentionDays ?? 365 }),
    }),
  );

  async function load(): Promise<void> {
    try {
      letters = await loadConversation(peerId);
      loading = false;
      // A letter counts as read once it is shown in the visible conversation (SPEC 8.4).
      const unread = letters
        .filter((l) => l.role === 'recipient' && l.status === 'delivered' && !l.read)
        .map((l) => l.id);
      if (unread.length > 0 && document.visibilityState === 'visible')
        await api('POST', '/api/letters/read', { ids: unread });
      const unseen = letters.filter(
        (l) => l.role === 'recipient' && l.status === 'delivered' && !l.arrivalSeen,
      );
      if (unseen.length > 0) {
        // Arrival image of the owl that landed last (SPEC 9.2.6), once per delivery.
        const latest = unseen.reduce((a, b) => (b.arrivesAt > a.arrivesAt ? b : a));
        showOwlImage(
          latest.owl.species,
          latest.kind === 'cover_chick' ? 'chick' : 'arrival',
          fill(de.owls.arrives, { name: latest.owl.name }),
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
      return fill(de.letters.coverGold, { amount: `${formatGold(letter.coverGold ?? 0)} Gold` });
    if (letter.kind === 'cover_owl') return fill(de.letters.coverOwl, { owl: letter.owl.name });
    if (letter.kind === 'cover_chick') return fill(de.letters.coverChick, { owl: letter.owl.name });
    return null;
  }

  function statusText(letter: ShownLetter): string {
    if (letter.status === 'returned') return de.letters.returned;
    if (letter.status === 'in_flight')
      return fill(de.letters.inFlight, { time: dateTime(letter.arrivesAt) });
    return letter.read ? de.letters.read : de.letters.delivered;
  }

  async function deleteChat(): Promise<void> {
    if (!confirm(de.letters.deleteConfirm)) return;
    await api('DELETE', `/api/chats/${peerId}`);
    navigate('/app/briefe');
  }
</script>

<p class="partner">
  <span class="name">{name}</span>
  {#if bot}<span class="bot-label"><span aria-hidden="true">🤖</span> {de.bots.label}</span>{/if}
</p>
{#if bot}
  <p class="notice bot-notice" data-testid="bot-notice">
    <span aria-hidden="true">🔓</span><span>{de.bots.notice}</span>
  </p>
  <p class="hint crisis">{de.bots.crisis}</p>
{/if}
{#if contact?.keyWarning}
  <p class="warning" role="alert">
    <span aria-hidden="true">⚠</span><span>{fill(de.contacts.keyWarningLong, { name })}</span>
  </p>
{/if}
{#if !contact && !bot && !loading}<p class="notice">
    <span aria-hidden="true">ℹ</span><span>{de.letters.notContact}</span>
  </p>{/if}

<p class="hint retention">{retention}</p>

<ol class="letters" class:print aria-live="polite">
  {#each letters as letter (letter.id)}
    <li class="scroll" class:mine={letter.role === 'sender'}>
      {#if coverText(letter)}<p class="cover">{coverText(letter)}</p>{/if}
      <p class="meta">
        {dateTime(letter.sentAt)} · {letter.parchment === 'large'
          ? de.letters.large
          : de.letters.small}
        {#if letter.role === 'recipient'}
          · {fill(de.letters.from, {
            owl: letter.owl.name,
            species: speciesName(letter.owl.species),
          })}{/if}
      </p>
      {#if letter.text !== null}
        <LetterText text={letter.text} />
      {:else}
        <p class="invalid">
          <span aria-hidden="true">⚠</span> <strong>{de.letters.invalid}</strong> – {de.letters
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
                : letter.read
                  ? '✔✔'
                  : '✔'}</span
          >
          {statusText(letter)}
        </p>
      {/if}
    </li>
  {/each}
</ol>

{#if contact && contact.active && !contact.keyWarning}
  <Compose {peerId} onsent={() => void load()} />
{:else if bot}
  {#if writableFrom !== null}
    <p class="notice">
      <span aria-hidden="true">⏳</span><span
        >{fill(de.bots.writableFrom, { time: dateTime(writableFrom) })}</span
      >
    </p>
  {:else}
    <p class="hint">{de.bots.replyHint}</p>
    <Compose
      {peerId}
      bot
      onsent={() => {
        void load();
        void refreshTopics('contacts');
      }}
    />
  {/if}
{/if}

<p class="danger">
  <button class="button secondary" type="button" onclick={() => void deleteChat()}
    >{de.letters.deleteChat}</button
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

  /* Letters as scrolls (v0.2): a sheet of paper between two rolled ends. The text itself
     stands on a plain colour (SPEC 14: never on textures). */
  .letters {
    list-style: none;
    padding: 0.75rem 0.75rem 0;
    display: grid;
    gap: 2.25rem;
  }

  .scroll {
    position: relative;
    width: min(100%, 34rem);
    padding: 1.1rem 1.4rem 1rem;
    background: var(--paper);
    border-inline: 1px solid #d8c39a;
    box-shadow:
      inset 0.6rem 0 0.6rem -0.6rem rgb(138 106 63 / 0.35),
      inset -0.6rem 0 0.6rem -0.6rem rgb(138 106 63 / 0.35),
      var(--shadow);
    font-family: var(--font-hand-other);
    font-size: 1.4rem;
    line-height: 1.35;
    transform: rotate(-0.4deg);
  }

  .scroll.mine {
    margin-left: auto;
    background: #fbf3e2;
    font-family: var(--font-hand-own);
    font-size: 1.15rem;
    line-height: 1.5;
    transform: rotate(0.4deg);
  }

  /* The rolled ends, slightly wider than the sheet. */
  .scroll::before,
  .scroll::after {
    content: '';
    position: absolute;
    left: -0.7rem;
    right: -0.7rem;
    height: 1.1rem;
    border-radius: 0.55rem;
    background: linear-gradient(to bottom, #c9a46a, #f1dfb6 40%, #e2c690 65%, #a9834d);
    box-shadow: 0 1px 2px rgb(43 29 14 / 0.3);
  }

  .scroll::before {
    top: -0.6rem;
  }

  .scroll::after {
    bottom: -0.6rem;
  }

  .print .scroll,
  .print .scroll.mine {
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
    .scroll,
    .scroll.mine {
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
    border: 2px solid var(--seal);
    border-radius: 0.5rem;
    font-weight: 700;
  }

  .danger {
    margin-top: 2rem;
  }
</style>
