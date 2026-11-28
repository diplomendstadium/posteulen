<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { t, fill, goldText, i18n, speciesName } from '../lib/i18n.svelte.ts';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { DONATION } from '@posteulen/shared/constants.ts';
  import {
    donationText,
    milestoneText,
    updateNote,
    type LongMessage,
  } from '@posteulen/shared/texts/messages.ts';
  import Link from '../components/Link.svelte';
  import { scrollToLatest, scrollToLetter } from '../lib/scroll.ts';
  import { sceneImage } from '../lib/owl-image.ts';
  import { live, showSystemArrivals, type SystemMessage as Message } from '../lib/live.svelte.ts';

  let messages = $state<Message[]>([]);
  let list = $state<HTMLUListElement>();
  /** Opening the system chat shows the latest message (v0.4). */
  let jumped = false;
  /** v1.3.2: like a long conversation – the latest messages first (SPEC 8.4). */
  let showAll = false;
  let older = $state(0);
  let digging = $state(false);

  async function load(): Promise<void> {
    try {
      const result = await api<{ messages: Message[]; older?: number }>(
        'GET',
        `/api/system-messages${showAll ? '?all=1' : ''}`,
      );
      messages = result.messages;
      older = result.older ?? 0;
      if (!jumped && messages.length > 0) {
        jumped = true;
        await tick();
        // v0.7: start at the oldest unread message, without one at the latest.
        const firstUnseen = messages.find((m) => !m.seen);
        if (firstUnseen) await scrollToLetter(list, firstUnseen.id);
        else await scrollToLatest(list);
      }
      // Arrival image of a delivery without a letter, when its message is first shown (9.2.6).
      await showSystemArrivals(messages);
      if (messages.some((m) => !m.seen)) {
        await api('POST', '/api/system-messages/seen', {});
        // The overview and "Neue Post!" follow at once, not only after a reload (v0.3).
        live.systemUnread = 0;
      }
    } catch {
      // Loaded again with the next update.
    }
  }

  onMount(() => {
    void load();
  });

  /** v1.3.2: loads the older messages and keeps the message that was at the top in view. */
  async function digOlder(): Promise<void> {
    if (digging) return;
    const first = messages[0]?.id;
    showAll = true;
    digging = true;
    try {
      await load();
      await tick();
      if (first) await scrollToLetter(list, first);
    } finally {
      digging = false;
    }
  }

  $effect(() => {
    void live.systemUnread;
    if (live.systemUnread > 0) void load();
  });

  const texts = t.system as Record<string, string>;
  /** v0.7: the letters burning in the fireplace, with the notice about deleted letters. */
  const burn = sceneImage('burn');

  function textOf(message: Message): string {
    const params = { ...message.params };
    if (message.type === 'letters_purged') return purgedText(params);
    // v0.7: an owl back with replies (own owl or loan owl).
    if ((message.type === 'owl_home' || message.type === 'loan_back') && params['count']) {
      const one = Number(params['count']) === 1;
      const key =
        message.type === 'owl_home'
          ? one
            ? 'owl_home_letter'
            : 'owl_home_letters'
          : one
            ? 'loan_back_one'
            : 'loan_back';
      return fill(texts[key] ?? message.type, params);
    }
    // v1.3.1: owl biscuits or treats of a bot; the special status (with or without an end).
    if (message.type === 'bag_gift') {
      const kind = params['kind'] === 'treats' ? 'treats' : 'biscuits';
      const one = Number(params['count']) === 1;
      return fill(texts[`bag_gift_${kind}${one ? '_one' : ''}`] ?? message.type, params);
    }
    if (message.type === 'privilege_granted' && typeof params['until'] === 'number') {
      return fill(texts['privilege_granted_until'] ?? message.type, {
        until: dateTime(params['until']),
      });
    }
    if (typeof params['amount'] === 'number') params['amount'] = goldText(params['amount']);
    // v0.8.2: a visiting owl – its species and the end of its rest (local time at home).
    if (message.type === 'owl_resting') {
      if (typeof params['species'] === 'string') params['species'] = speciesName(params['species']);
      if (typeof params['until'] === 'number') params['until'] = dateTime(params['until']);
    }
    // v0.8: an owl given by a bot names its species.
    if (
      (message.type === 'bot_owl_gift' || message.type === 'bot_owl_gift_full') &&
      typeof params['species'] === 'string'
    )
      params['species'] = speciesName(params['species']);
    // v1.4: the end of a holiday (local time at home).
    if (message.type === 'vacation_started' && typeof params['until'] === 'number')
      params['until'] = dateTime(params['until']);
    // v1.5.0: a reminder every day – the days left until the lot (the last one: "tomorrow").
    if (message.type === 'clutch_reminder' && Number(params['days']) > 1) {
      const key = params['cargo'] === 'all' ? 'clutch_reminder_all_days' : 'clutch_reminder_days';
      return fill(texts[key] ?? message.type, params);
    }
    // Returned gold or gift has its own wording (SPEC 9.5, Anhang C).
    const variant = params['cargo']
      ? texts[`${message.type}_${String(params['cargo'])}`]
      : undefined;
    return fill(variant ?? texts[message.type] ?? message.type, params);
  }

  /** v0.7: letters deleted by the deletion period – how many, from which chats. */
  function purgedText(params: Record<string, string | number>): string {
    let names: string[];
    try {
      names = (JSON.parse(String(params['chats'] ?? '[]')) as string[]).map(
        (name) => name || t.letters.unknown,
      );
    } catch {
      names = [];
    }
    const count = Number(params['count']) || 0;
    return fill(
      count === 1 ? (texts['letters_purged_one'] ?? '') : (texts['letters_purged'] ?? ''),
      {
        count,
        chats: [...new Set(names)].join(', '),
      },
    );
  }

  /** Donation requests and update notes are longer messages with a title (v0.3). */
  function longMessage(message: Message): LongMessage | undefined {
    // v0.4: shown in the language of the view.
    if (message.type === 'donation')
      return donationText(Number(message.params['text']) || 0, i18n.lang);
    if (message.type === 'update_notes')
      return updateNote(String(message.params['version'] ?? ''), i18n.lang);
    // v1.5.0: 1,000, 5,000 … letters between people (SPEC 11.1).
    if (message.type === 'letters_milestone')
      return milestoneText(Number(message.params['count']) || 0, i18n.lang);
    return undefined;
  }

  /**
   * Splits a paragraph at "{link}" (the donation link) and – v1.5.0 – "{feedback}" (the message
   * to the admin in the settings), so both can be real links.
   */
  function linkParts(paragraph: string): { text: string; link: 'donation' | 'feedback' | null }[] {
    return paragraph
      .split(/(\{link\}|\{feedback\})/)
      .map((text) =>
        text === '{link}'
          ? { text: '', link: 'donation' }
          : text === '{feedback}'
            ? { text: '', link: 'feedback' }
            : { text, link: null },
      );
  }
</script>

{#if older > 0}
  <p class="older">
    <button
      class="button secondary"
      type="button"
      disabled={digging}
      data-testid="older-letters"
      onclick={() => void digOlder()}>{digging ? t.letters.olderLoading : t.letters.older}</button
    >
  </p>
{/if}

<ul class="messages" aria-live="polite" bind:this={list}>
  {#each messages as message (message.id)}
    {@const long = longMessage(message)}
    <li class:long={long !== undefined} data-letter-id={message.id}>
      <span class="when">{dateTime(message.createdAt)}</span>
      {#if long}
        <h2 class="title">{long.title}</h2>
        {#each long.paragraphs as paragraph, index (index)}
          {@const parts = linkParts(paragraph)}
          <p class:item={paragraph.startsWith('• ')}>
            {#each parts as part, partIndex (partIndex)}{#if part.link === 'donation'}<a
                  href={DONATION.URL}
                  target="_blank"
                  rel="noopener noreferrer">{DONATION.URL.replace('https://', '')}</a
                >{:else if part.link === 'feedback'}<Link href="/app/einstellungen#feedback"
                  >{t.feedback.title}</Link
                >{:else}{part.text}{/if}{/each}
          </p>
        {/each}
      {:else}
        {textOf(message)}
        {#if message.type === 'letters_purged' && !burn.placeholder}
          <img
            class="burn"
            src={burn.files['s480']}
            srcset={`${burn.files['s480']} 480w, ${burn.files['s960']} 960w`}
            sizes="(min-width: 30rem) 22rem, 90vw"
            width="480"
            height="480"
            alt={texts['letters_purged_alt']}
            loading="lazy"
            decoding="async"
          />
        {/if}
      {/if}
    </li>
  {/each}
</ul>
<p class="hint plate">{t.letters.noReply}</p>

<style>
  .older {
    margin: 0 0 1rem;
    text-align: center;
  }

  .messages {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .messages li {
    padding: 0.75rem 1rem;
    background: var(--paper);
    border-left: 4px solid var(--wood);
    border-radius: 0.5rem;
  }

  .when {
    display: block;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .title {
    margin: 0.25rem 0 0.5rem;
    font-size: 1.2rem;
  }

  .long p {
    margin: 0 0 0.6rem;
  }

  .long p.item {
    padding-left: 1rem;
    text-indent: -0.75rem;
  }

  .burn {
    display: block;
    width: min(100%, 22rem);
    height: auto;
    margin-top: 0.6rem;
    border-radius: var(--radius);
  }

  .hint {
    color: var(--ink-soft);
  }
</style>
