<script lang="ts">
  /**
   * v0.7.1: a short message to the admin (SPEC 8.10) – for technical problems or ideas. Not
   * encrypted: it lies readable on the server, without the sender's name. One per calendar day
   * (UTC); the next one is possible from midnight UTC, shown in the time at home.
   */
  import { FEEDBACK, TIME } from '@posteulen/shared/constants.ts';
  import { countCodePoints } from '@posteulen/shared/names.ts';
  import { sanitizeLetterText } from '@posteulen/shared/text-rules.ts';
  import ErrorText from './ErrorText.svelte';
  import { api } from '../lib/api.ts';
  import { account, type Profile } from '../lib/auth.svelte.ts';
  import { dateTime } from '../lib/format.ts';
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { status } from '../lib/status.svelte.ts';

  let text = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let sent = $state(false);

  const count = $derived(countCodePoints(text));
  const blocked = $derived(account.profile?.feedbackSentToday === true);
  /** Next UTC midnight. */
  const nextAt = $derived(Math.floor(Date.now() / TIME.DAY + 1) * TIME.DAY);

  function input(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement;
    const clean = sanitizeLetterText(target.value).text;
    if (clean !== target.value) target.value = clean;
    text = clean;
  }

  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online || blocked) return;
    error = null;
    if (text.trim() === '') return void (error = t.feedback.empty);
    if (count > FEEDBACK.MAX_CHARS) return void (error = t.feedback.tooLong);
    busy = true;
    try {
      const result = await api<{ profile: Profile }>('POST', '/api/feedback', { text });
      account.profile = result.profile;
      text = '';
      sent = true;
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<section class="card" aria-labelledby="feedback-title" data-testid="feedback">
  <h2 id="feedback-title">{t.feedback.title}</h2>
  <p>{t.feedback.intro}</p>
  <p class="notice"><span aria-hidden="true">🔓</span><span>{t.feedback.notEncrypted}</span></p>
  {#if sent}
    <p class="notice" role="status">
      <span aria-hidden="true">✔</span><span>{t.feedback.sent}</span>
    </p>
  {/if}
  {#if blocked}
    <p class="hint">{fill(t.feedback.blocked, { time: dateTime(nextAt) })}</p>
  {:else}
    <form onsubmit={send}>
      <label for="feedback-text">{t.feedback.label}</label>
      <textarea
        id="feedback-text"
        rows="4"
        value={text}
        oninput={input}
        aria-describedby="feedback-count"></textarea>
      <p id="feedback-count" class="counter" class:over={count > FEEDBACK.MAX_CHARS}>
        {fill(t.feedback.counter, { count, max: FEEDBACK.MAX_CHARS })}
      </p>
      <ErrorText message={error} />
      <button class="button" type="submit" disabled={busy || !status.online}
        >{t.feedback.send}</button
      >
    </form>
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
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

  .hint {
    color: var(--ink-soft);
  }
</style>
