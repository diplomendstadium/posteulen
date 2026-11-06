<script lang="ts">
  /** Writing a letter (SPEC 8.4): parchment, text with counter, recipients, preview, send. */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { countCodePoints } from '@posteulen/shared/names.ts';
  import { LETTER } from '@posteulen/shared/constants.ts';
  import { maxChars, sanitizeLetterText, type Parchment } from '@posteulen/shared/text-rules.ts';
  import ErrorText from './ErrorText.svelte';
  import OwlChoice from './OwlChoice.svelte';
  import { KeyMismatchError, prepare, sendPrepared, sendToBot } from '../lib/letters.ts';
  import { previewFlights, type OwlChoice as Choice } from '../lib/owls.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let {
    peerId,
    onsent,
    bot = false,
  }: { peerId: string; onsent: () => void; bot?: boolean } = $props();

  let parchment = $state<Parchment>('small');
  let text = $state('');
  let smileyHint = $state(false);
  // svelte-ignore state_referenced_locally
  let recipients = $state<string[]>([peerId]);
  let extra = $state('');
  /** Owls ready for this letter with the server's preview (SPEC 8.4 step 4). */
  let prepared = $state<Choice[] | null>(null);
  let owlId = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let sentNotice = $state(false);

  const count = $derived(countCodePoints(text));
  const max = $derived(maxChars(parchment));
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ??
    live.bots.find((b) => b.userId === id)?.name ??
    de.letters.unknown;
  const candidates = $derived(
    live.contacts.filter((c) => c.active && !c.keyWarning && !recipients.includes(c.userId)),
  );

  function input(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement;
    const clean = sanitizeLetterText(target.value);
    if (clean.removedEmoji) smileyHint = true;
    if (clean.text !== target.value) target.value = clean.text;
    text = clean.text;
    prepared = null;
  }

  function move(index: number, delta: number): void {
    const next = [...recipients];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(index + delta, 0, item);
    recipients = next;
    prepared = null;
  }

  async function showPreview(): Promise<void> {
    error = null;
    if (text.trim() === '') return void (error = de.letters.empty);
    if (count > max) return void (error = de.letters.tooLong);
    busy = true;
    try {
      prepared = await previewFlights(recipients);
      owlId = prepared.find((choice) => !choice.offer)?.id ?? null;
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }

  async function send(): Promise<void> {
    if (!prepared || !owlId || busy || !status.online) return;
    busy = true;
    error = null;
    try {
      // Bots: plain text, one recipient (SPEC 10.1); people: end-to-end encrypted (5.8).
      const result = bot
        ? await sendToBot(peerId, owlId, parchment, text)
        : await sendPrepared(await prepare(recipients, parchment, owlId), parchment, text);
      showOwlImage(
        result.owl.species,
        'departure',
        fill(de.owls.departs, { name: result.owl.name }),
      );
      void refreshTopics('profile');
      text = '';
      prepared = null;
      recipients = [peerId];
      sentNotice = true;
      onsent();
    } catch (caught) {
      error =
        caught instanceof KeyMismatchError
          ? fill(de.contacts.keyWarningLong, { name: nameOf(caught.message) })
          : errorMessage(caught);
      prepared = null;
    } finally {
      busy = false;
    }
  }
</script>

<section class="card compose" aria-labelledby="compose-title">
  <h2 id="compose-title">{de.letters.compose}</h2>
  <fieldset>
    <legend>{de.letters.parchment}</legend>
    <label class="option"
      ><input
        type="radio"
        name="parchment"
        value="small"
        bind:group={parchment}
        onchange={() => (prepared = null)}
      />
      {de.letters.smallOption}</label
    >
    <label class="option"
      ><input
        type="radio"
        name="parchment"
        value="large"
        bind:group={parchment}
        onchange={() => (prepared = null)}
      />
      {de.letters.largeOption}</label
    >
  </fieldset>

  <label for="letter-text">{de.letters.text}</label>
  <textarea id="letter-text" rows="6" value={text} oninput={input} aria-describedby="letter-count"
  ></textarea>
  <p id="letter-count" class:over={count > max} class="counter">
    {fill(de.letters.counter, { count, max: max.toLocaleString('de-DE') })}
  </p>
  {#if smileyHint}<p class="notice" role="status">
      <span aria-hidden="true">✒</span><span>{de.letters.noSmileys}</span>
    </p>{/if}

  {#if !bot}
    <fieldset>
      <legend>{de.letters.recipients}</legend>
      <ol class="recipients">
        {#each recipients as id, index (id)}
          <li>
            <span class="name">{nameOf(id)}</span>
            {#if recipients.length > 1}
              <button
                type="button"
                class="button secondary small"
                aria-label={de.letters.up}
                disabled={index === 0}
                onclick={() => move(index, -1)}>↑</button
              >
              <button
                type="button"
                class="button secondary small"
                aria-label={de.letters.down}
                disabled={index === recipients.length - 1}
                onclick={() => move(index, 1)}>↓</button
              >
              <button
                type="button"
                class="button secondary small"
                aria-label={de.letters.removeRecipient}
                onclick={() => {
                  recipients = recipients.filter((r) => r !== id);
                  prepared = null;
                }}>✕</button
              >
            {/if}
          </li>
        {/each}
      </ol>
      {#if recipients.length < LETTER.MAX_RECIPIENTS && candidates.length > 0}
        <label for="extra">{de.letters.addRecipient}</label>
        <select
          id="extra"
          bind:value={extra}
          onchange={() => {
            if (extra) {
              recipients = [...recipients, extra];
              extra = '';
              prepared = null;
            }
          }}
        >
          <option value="">{de.letters.choose}</option>
          {#each candidates as contact (contact.userId)}<option value={contact.userId}
              >{contact.name}</option
            >{/each}
        </select>
      {/if}
    </fieldset>
  {/if}

  <ErrorText message={error} />
  {#if prepared}
    <OwlChoice choices={prepared} bind:selected={owlId} name="letter-owl" />
    <button
      class="button"
      type="button"
      disabled={busy || !status.online || !owlId}
      onclick={() => void send()}>{de.letters.send}</button
    >
  {:else}
    <button
      class="button"
      type="button"
      disabled={busy || !status.online}
      onclick={() => void showPreview()}>{de.letters.preview}</button
    >
  {/if}
  {#if sentNotice}<p class="notice" role="status">
      <span aria-hidden="true">🦉</span><span>{de.letters.sent}</span>
    </p>{/if}
</section>

<style>
  .compose {
    margin-top: 1.5rem;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 1rem;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    min-height: 2.75rem;
  }

  .option input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  textarea {
    width: 100%;
    font: inherit;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--line);
    border-radius: 0.5rem;
    background: var(--paper);
    color: var(--ink);
  }

  .counter {
    margin: 0.25rem 0 1rem;
    color: var(--ink-soft);
  }

  .counter.over {
    color: var(--seal);
    font-weight: 700;
  }

  .recipients {
    padding-left: 1.5rem;
  }

  .recipients li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .recipients .name {
    flex: 1;
  }

  .small {
    padding: 0;
    width: 2.75rem;
  }

  select {
    min-height: 2.75rem;
    font: inherit;
    width: 100%;
  }
</style>
