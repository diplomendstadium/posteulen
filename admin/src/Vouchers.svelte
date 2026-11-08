<script lang="ts">
  /**
   * v0.7: vouchers for gold or an owl (SPEC 13): once redeemable, 90 days valid. The code is
   * shown only once; the server keeps its HMAC and the last four characters.
   */
  import { onMount } from 'svelte';
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { VOUCHER } from '@posteulen/shared/constants.ts';
  import { SPECIES, speciesName } from '@posteulen/shared/species.ts';
  import { api } from './lib/api.ts';
  import { message } from './lib/messages.ts';

  interface Voucher {
    id: string;
    hint: string;
    kind: 'gold' | 'owl';
    gold: number | null;
    species: string | null;
    expiresAt: number;
    redeemed: boolean;
  }

  let vouchers = $state<Voucher[]>([]);
  let kind = $state<'gold' | 'owl'>('gold');
  let gold = $state('5');
  let species = $state('random');
  let fresh = $state<{ code: string; expiresAt: number } | null>(null);
  let error = $state<string | null>(null);

  const time = (ms: number): string =>
    new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(ms),
    );
  const goldText = (tenths: number): string =>
    `${(tenths / 10).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} Gold`;
  const contentOf = (voucher: Voucher): string =>
    voucher.kind === 'gold'
      ? goldText(voucher.gold ?? 0)
      : voucher.species === 'random'
        ? de.admin.voucherRandom
        : speciesName(voucher.species ?? '');

  async function load(): Promise<void> {
    try {
      vouchers = (await api<{ vouchers: Voucher[] }>('GET', '/api/vouchers')).vouchers;
    } catch (caught) {
      error = message(caught);
    }
  }

  onMount(() => {
    void load();
  });

  async function create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    error = null;
    const tenths = Math.round(Number(gold.replace(',', '.')) * 10);
    if (kind === 'gold' && !(tenths >= VOUCHER.GOLD_MIN && tenths <= VOUCHER.GOLD_MAX)) {
      error = de.admin.voucherGoldRange;
      return;
    }
    try {
      fresh = await api<{ code: string; expiresAt: number }>(
        'POST',
        '/api/vouchers',
        kind === 'gold' ? { kind, gold: tenths } : { kind, species },
      );
      await load();
    } catch (caught) {
      error = message(caught);
    }
  }

  async function revoke(id: string): Promise<void> {
    await api('DELETE', `/api/vouchers/${id}`).catch(
      (caught: unknown) => (error = message(caught)),
    );
    await load();
  }
</script>

<section class="card" aria-labelledby="voucher-title">
  <h2 id="voucher-title">{de.admin.vouchersTitle}</h2>
  <p>{de.admin.vouchersIntro}</p>
  <form onsubmit={create}>
    <fieldset>
      <legend>{de.admin.voucherKind}</legend>
      <label><input type="radio" value="gold" bind:group={kind} /> {de.admin.voucherGold}</label>
      <label><input type="radio" value="owl" bind:group={kind} /> {de.admin.voucherOwl}</label>
    </fieldset>
    {#if kind === 'gold'}
      <label for="voucher-gold">{de.admin.voucherAmount}</label>
      <input id="voucher-gold" type="text" inputmode="decimal" bind:value={gold} />
    {:else}
      <label for="voucher-species">{de.admin.voucherSpecies}</label>
      <select id="voucher-species" bind:value={species}>
        <option value="random">{de.admin.voucherRandom}</option>
        {#each SPECIES as entry (entry.id)}<option value={entry.id}>{entry.name}</option>{/each}
      </select>
    {/if}
    <p><button class="button" type="submit">{de.admin.voucherCreate}</button></p>
  </form>
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  {#if fresh}
    <p class="code" role="status">
      {fill(de.admin.voucherNew, { code: fresh.code, until: time(fresh.expiresAt) })}
    </p>
  {/if}
  {#if vouchers.length === 0}
    <p>{de.admin.vouchersNone}</p>
  {:else}
    <ul class="list">
      {#each vouchers as voucher (voucher.id)}
        <li>
          <span
            >{fill(voucher.redeemed ? de.admin.voucherHintRedeemed : de.admin.voucherHint, {
              hint: voucher.hint,
              what: contentOf(voucher),
              until: time(voucher.expiresAt),
            })}</span
          >
          {#if !voucher.redeemed}
            <button class="button secondary" type="button" onclick={() => void revoke(voucher.id)}
              >{de.admin.inviteRevoke}</button
            >
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  /* Same spacing as the other boxes of the admin panel (v0.7.1: it was missing). */
  section {
    margin-bottom: 1.5rem;
  }

  fieldset {
    border: none;
    padding: 0;
    margin: 0 0 0.75rem;
  }

  fieldset label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-right: 1rem;
    min-height: 2.75rem;
  }

  .list {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .code {
    font-family: monospace;
    font-size: 1.1rem;
    font-weight: 700;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
