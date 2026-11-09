<script lang="ts">
  /** v0.8: export of all bots and import of an export file with a preview first (SPEC Anhang S). */
  import { apiRaw, download } from '../../admin/src/lib/api.ts';
  import { message } from '../../admin/src/lib/messages.ts';
  import { fill, t } from '../../admin/src/lib/i18n.svelte.ts';
  import type { BotView } from './lib/types.ts';

  let { bots, ondone }: { bots: readonly BotView[]; ondone: () => void } = $props();

  interface Plan {
    bots: {
      id: string;
      name: string;
      action: 'new' | 'merge' | 'conflict';
      conflict?: string;
      events: { action: 'planned' | 'past' | 'skip' }[];
    }[];
  }

  let file = $state<File | null>(null);
  let target = $state('');
  let plan = $state<Plan | null>(null);
  let done = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  const query = () => (target ? `?target=${encodeURIComponent(target)}` : '');

  async function run(work: () => Promise<void>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    try {
      await work();
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }

  const preview = () =>
    run(async () => {
      if (!file) return;
      done = false;
      plan = await apiRaw<Plan>(`/api/import/preview${query()}`, 'application/zip', file);
    });

  const apply = () =>
    run(async () => {
      if (!file) return;
      plan = await apiRaw<Plan>(`/api/import${query()}`, 'application/zip', file);
      done = true;
      ondone();
    });

  const count = (bot: Plan['bots'][number], action: string) =>
    bot.events.filter((event) => event.action === action).length;
</script>

<section class="card">
  <h2>{t.centre.importTitle}</h2>
  <p>{t.centre.importIntro}</p>
  <p>
    <button
      class="button secondary"
      type="button"
      disabled={busy}
      onclick={() => void run(() => download('/api/export', {}, 'posteulen-bots.zip'))}
      >{t.centre.exportAll}</button
    >
  </p>
  <label for="import-file">{t.centre.importFile}</label>
  <input
    id="import-file"
    type="file"
    accept=".zip,application/zip"
    onchange={(event) => {
      file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
      plan = null;
      done = false;
    }}
  />
  <label for="import-target">{t.centre.importTarget}</label>
  <select id="import-target" bind:value={target}>
    <option value="">{t.centre.importTargetNone}</option>
    {#each bots as bot (bot.id)}<option value={bot.id}>{bot.name}</option>{/each}
  </select>
  <p class="actions">
    <button
      class="button secondary"
      type="button"
      disabled={busy || !file}
      onclick={() => void preview()}>{t.centre.importPreview}</button
    >
    {#if plan && !done}
      <button class="button" type="button" disabled={busy} onclick={() => void apply()}
        >{t.centre.importApply}</button
      >
    {/if}
  </p>
  {#if plan}
    {#if done}<p role="status">{t.centre.importDone}</p>{/if}
    <ul data-testid="import-plan">
      {#each plan.bots as bot (bot.id)}
        <li>
          {fill(t.centre[`importBot_${bot.action}`], {
            name: bot.name,
            reason: bot.conflict
              ? ((t.centre as Record<string, string>)[`conflict_${bot.conflict}`] ?? bot.conflict)
              : '',
          })}
          – {fill(t.centre.importEvents, {
            planned: count(bot, 'planned'),
            past: count(bot, 'past'),
            skip: count(bot, 'skip'),
          })}
        </li>
      {/each}
    </ul>
  {/if}
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
</section>

<style>
  input,
  select {
    display: block;
    width: 100%;
    max-width: 30rem;
    min-height: 2.75rem;
    font: inherit;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
