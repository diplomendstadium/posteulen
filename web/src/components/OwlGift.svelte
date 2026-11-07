<script lang="ts">
  /** Give an owl to a contact, optionally with a cover letter (SPEC 9.2.7). */
  import { t, fill } from '../lib/i18n.svelte.ts';
  import CoverInput from './CoverInput.svelte';
  import ErrorText from './ErrorText.svelte';
  import { giftOwl, type Owl } from '../lib/owls.ts';
  import { KeyMismatchError } from '../lib/letters.ts';
  import { live } from '../lib/live.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import { time } from '../lib/format.ts';

  let { owl, ondone }: { owl: Owl; ondone: () => void } = $props();

  let recipient = $state('');
  let cover = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state<string | null>(null);
  const contacts = $derived(live.contacts.filter((c) => c.active && !c.keyWarning));
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ?? t.letters.unknown;

  async function send(): Promise<void> {
    if (!recipient || busy) return;
    busy = true;
    error = null;
    try {
      const result = await giftOwl(owl.id, recipient, cover);
      showOwlImage(owl.species, 'departure', fill(t.owls.departs, { name: owl.name ?? '' }));
      done = `${fill(t.owls.giftSent, { name: owl.name ?? '', recipient: nameOf(recipient) })} ${fill(
        t.owls.giftArrival,
        { name: nameOf(recipient), time: time(result.arrivesAt) },
      )}`;
      setTimeout(ondone, 1500);
    } catch (caught) {
      error =
        caught instanceof KeyMismatchError
          ? fill(t.contacts.keyWarningLong, { name: nameOf(caught.message) })
          : errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<form
  class="gift"
  onsubmit={(event) => {
    event.preventDefault();
    void send();
  }}
>
  <h3 class="name">{fill(t.owls.giftTitle, { name: owl.name ?? '' })}</h3>
  <p>{t.owls.giftIntro}</p>
  <label for={`gift-to-${owl.id}`}>{t.owls.giftTo}</label>
  <select id={`gift-to-${owl.id}`} bind:value={recipient} required>
    <option value="">{t.letters.choose}</option>
    {#each contacts as contact (contact.userId)}<option value={contact.userId}
        >{contact.name}</option
      >{/each}
  </select>
  <CoverInput bind:value={cover} id={`gift-cover-${owl.id}`} />
  <ErrorText message={error} />
  {#if done}<p class="notice" role="status">
      <span aria-hidden="true">🦉</span><span>{done}</span>
    </p>{/if}
  <button
    class="button"
    type="submit"
    disabled={busy || !recipient || !status.online || done !== null}>{t.owls.giftSend}</button
  >
</form>

<style>
  .gift {
    margin-top: 1rem;
    padding: 1rem;
    border: 2px dashed var(--wood);
    border-radius: 0.5rem;
  }

  h3 {
    margin-top: 0;
  }

  select {
    width: 100%;
    margin-bottom: 0.75rem;
  }
</style>
