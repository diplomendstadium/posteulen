<script lang="ts">
  /** One chick of two or three must be given away within 24 hours (SPEC 9.9). */
  import { t, fill } from '../lib/i18n.svelte.ts';
  import CoverInput from './CoverInput.svelte';
  import ErrorText from './ErrorText.svelte';
  import { giftChick, type Clutch, type Owl } from '../lib/owls.ts';
  import { KeyMismatchError } from '../lib/letters.ts';
  import { live } from '../lib/live.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { showOwlImage } from '../lib/overlay.svelte.ts';
  import { status } from '../lib/status.svelte.ts';
  import { dateTime } from '../lib/format.ts';

  let { clutch, chicks, ondone }: { clutch: Clutch; chicks: readonly Owl[]; ondone: () => void } =
    $props();

  let chickId = $state('');
  let recipient = $state('');
  let cover = $state<string | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  const contacts = $derived(live.contacts.filter((c) => c.active && !c.keyWarning));
  const chosen = $derived(chicks.find((chick) => chick.id === chickId));
  const nameOf = (id: string): string =>
    live.contacts.find((c) => c.userId === id)?.name ?? t.letters.unknown;

  async function send(): Promise<void> {
    if (!chosen || !recipient || busy) return;
    if (chosen.name === null) return void (error = t.owls.clutchNameFirst);
    busy = true;
    error = null;
    try {
      await giftChick(clutch.id, chosen.id, recipient, cover);
      showOwlImage(chosen.species, 'chick', fill(t.owls.departs, { name: chosen.name }));
      ondone();
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

<section class="card clutch" aria-labelledby={`clutch-${clutch.id}`}>
  <h2 id={`clutch-${clutch.id}`}>{t.owls.clutchTitle}</h2>
  <p>{fill(t.owls.clutchIntro, { until: dateTime(clutch.giftDeadline) })}</p>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void send();
    }}
  >
    <label for={`clutch-chick-${clutch.id}`}>{t.owls.clutchChick}</label>
    <select id={`clutch-chick-${clutch.id}`} bind:value={chickId} required>
      <option value="">{t.letters.choose}</option>
      {#each chicks as chick (chick.id)}
        <option value={chick.id}>{chick.name ?? t.owls.unnamed}</option>
      {/each}
    </select>
    <label for={`clutch-to-${clutch.id}`}>{t.owls.giftTo}</label>
    <select id={`clutch-to-${clutch.id}`} bind:value={recipient} required>
      <option value="">{t.letters.choose}</option>
      {#each contacts as contact (contact.userId)}<option value={contact.userId}
          >{contact.name}</option
        >{/each}
    </select>
    <CoverInput bind:value={cover} id={`clutch-cover-${clutch.id}`} />
    <ErrorText message={error} />
    <button class="button" type="submit" disabled={busy || !chickId || !recipient || !status.online}
      >{t.owls.giftSend}</button
    >
  </form>
</section>

<style>
  .clutch {
    margin-bottom: 1.5rem;
    border: 3px solid var(--wood);
  }

  select {
    width: 100%;
    max-width: 24rem;
    margin-bottom: 0.75rem;
  }
</style>
