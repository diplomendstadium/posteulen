<script lang="ts">
  /**
   * v0.7.2: remove all bots of the account for good, the Erklärbär included (SPEC 8.10, 10.1);
   * v0.8: also every bot of the control centre created later never writes. A single bot is
   * removed in its chat.
   */
  import ErrorText from './ErrorText.svelte';
  import { api } from '../lib/api.ts';
  import { t } from '../lib/i18n.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { live, refreshTopics } from '../lib/live.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let busy = $state(false);
  let error = $state<string | null>(null);
  let done = $state(false);

  async function removeAll(): Promise<void> {
    if (busy || !status.online || !confirm(t.bots.removeAllConfirm)) return;
    busy = true;
    error = null;
    try {
      await api('POST', '/api/bots/remove-all', {});
      done = true;
      await refreshTopics('contacts', 'chats', 'map');
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<section class="card" aria-labelledby="bots-settings-title" data-testid="bot-settings">
  <h2 id="bots-settings-title">{t.bots.removeAllTitle}</h2>
  {#if live.botsDisabled || done}
    <p>{t.bots.removedAll}</p>
  {:else}
    <p>{t.bots.removeAllIntro}</p>
    <ErrorText message={error} />
    <button
      class="button secondary"
      type="button"
      disabled={busy || !status.online}
      onclick={() => void removeAll()}>{t.bots.removeAll}</button
    >
  {/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }
</style>
