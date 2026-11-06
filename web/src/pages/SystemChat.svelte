<script lang="ts">
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { api } from '../lib/api.ts';
  import { dateTime } from '../lib/format.ts';
  import { formatGold } from '@posteulen/shared/game/gold.ts';
  import { DONATION } from '@posteulen/shared/constants.ts';
  import { isDay } from '@posteulen/shared/game/sun.ts';
  import {
    DONATION_TEXTS,
    updateNote,
    type LongMessage,
  } from '@posteulen/shared/texts/messages.ts';
  import OwlPicture from '../components/OwlPicture.svelte';
  import { account } from '../lib/auth.svelte.ts';
  import { live, showSystemArrivals, type SystemMessage as Message } from '../lib/live.svelte.ts';

  let messages = $state<Message[]>([]);

  async function load(): Promise<void> {
    try {
      messages = (await api<{ messages: Message[] }>('GET', '/api/system-messages')).messages;
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

  $effect(() => {
    void live.systemUnread;
    if (live.systemUnread > 0) void load();
  });

  const texts = de.system as Record<string, string>;

  function textOf(message: Message): string {
    const params = { ...message.params };
    if (typeof params['amount'] === 'number')
      params['amount'] = `${formatGold(params['amount'])} Gold`;
    // Returned gold or gift has its own wording (SPEC 9.5, Anhang C).
    const variant = params['cargo']
      ? texts[`${message.type}_${String(params['cargo'])}`]
      : undefined;
    return fill(variant ?? texts[message.type] ?? message.type, params);
  }

  /** Donation requests and update notes are longer messages with a title (v0.3). */
  function longMessage(message: Message): LongMessage | undefined {
    if (message.type === 'donation') return DONATION_TEXTS[Number(message.params['text']) || 0];
    if (message.type === 'update_notes') return updateNote(String(message.params['version'] ?? ''));
    return undefined;
  }

  /** Splits a paragraph at "{link}" so the donation link can be a real link. */
  function linkParts(paragraph: string): string[] {
    return paragraph.split('{link}');
  }

  /**
   * An owl back home sits on the window sill by day or by candlelight – depending on whether
   * it is light at the user's (fictional) home right now, when the message is read (v0.3).
   */
  const daylightAtHome = $derived(
    account.profile ? isDay(Date.now(), account.profile.home.lat, account.profile.home.lon) : true,
  );
</script>

<ul class="messages" aria-live="polite">
  {#each messages as message (message.id)}
    {@const long = longMessage(message)}
    <li class:long={long !== undefined}>
      <span class="when">{dateTime(message.createdAt)}</span>
      {#if long}
        <h2 class="title">{long.title}</h2>
        {#each long.paragraphs as paragraph, index (index)}
          {@const parts = linkParts(paragraph)}
          <p class:item={paragraph.startsWith('• ')}>
            {#each parts as part, partIndex (partIndex)}{#if partIndex > 0}<a
                  href={DONATION.URL}
                  target="_blank"
                  rel="noopener noreferrer">{DONATION.URL.replace('https://', '')}</a
                >{/if}{part}{/each}
          </p>
        {/each}
      {:else}
        {textOf(message)}
        {#if message.type === 'owl_home' && typeof message.params['species'] === 'string'}
          {@const owl = String(message.params['owl'] ?? '')}
          <div class="homecoming">
            <OwlPicture
              speciesId={message.params['species']}
              kind={daylightAtHome ? 'homeDay' : 'homeNight'}
              size={480}
              alt={fill(daylightAtHome ? de.owls.homeDayAlt : de.owls.homeNightAlt, { name: owl })}
            />
          </div>
        {/if}
      {/if}
    </li>
  {/each}
</ul>
<p class="hint plate">{de.letters.noReply}</p>

<style>
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

  .homecoming {
    margin-top: 0.6rem;
    --owl-size: min(100%, 22rem);
  }

  .hint {
    color: var(--ink-soft);
  }
</style>
