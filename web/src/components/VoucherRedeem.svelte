<script lang="ts">
  /**
   * v0.7: redeem a voucher (SPEC 8.10): gold is credited at once, an owl moves in at once and
   * waits for its name in the owl overview.
   */
  import ErrorText from './ErrorText.svelte';
  import Link from './Link.svelte';
  import { api } from '../lib/api.ts';
  import { t, fill, goldText, speciesName } from '../lib/i18n.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { refreshTopics } from '../lib/live.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let code = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state<{ kind: 'gold'; amount: number } | { kind: 'owl'; species: string } | null>(
    null,
  );

  async function redeem(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online || code.trim() === '') return;
    busy = true;
    error = null;
    done = null;
    try {
      done = await api('POST', '/api/vouchers/redeem', { code: code.trim() });
      code = '';
      void refreshTopics('profile', 'finance', 'owls');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<section class="card" aria-labelledby="voucher-title">
  <h2 id="voucher-title">{t.settings.voucherTitle}</h2>
  <p>{t.settings.voucherIntro}</p>
  <form onsubmit={redeem}>
    <label for="voucher-code">{t.settings.voucherCode}</label>
    <input
      id="voucher-code"
      type="text"
      bind:value={code}
      maxlength="40"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
    />
    <ErrorText message={error} />
    <button class="button" type="submit" disabled={busy || !status.online}
      >{t.settings.voucherRedeem}</button
    >
  </form>
  {#if done}
    <p class="notice" role="status">
      <span aria-hidden="true">🎁</span>
      <span>
        {done.kind === 'gold'
          ? fill(t.settings.voucherGold, { amount: goldText(done.amount) })
          : fill(t.settings.voucherOwl, { species: speciesName(done.species) })}
        {#if done.kind === 'owl'}<Link href="/app/eulen">{t.settings.voucherToOwls}</Link>{/if}
      </span>
    </p>
  {/if}
</section>

<style>
  /* Same spacing as the other boxes of the settings (v0.7.1: it was missing). */
  section {
    margin-bottom: 1.5rem;
  }
</style>
