<script lang="ts">
  import { t, fill } from './lib/i18n.svelte.ts';
  import { checkPassword } from '@posteulen/shared/names.ts';
  import { changePassword } from './lib/auth.ts';
  import { message } from './lib/messages.ts';

  let { current = '', ondone }: { current?: string; ondone: () => void } = $props();

  let currentPassword = $state('');
  let next = $state('');
  let repeat = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const lengthError = checkPassword(next);
    error =
      lengthError === 'too_short'
        ? t.register.tooShort
        : lengthError === 'too_long'
          ? t.register.tooLong
          : next !== repeat
            ? t.register.mismatch
            : null;
    if (error) return;
    busy = true;
    try {
      const outcome = await changePassword(current || currentPassword, next);
      if (outcome === 'ok') {
        currentPassword = next = repeat = '';
        ondone();
      } else if (outcome === 'wrong') error = t.admin.wrong;
      else error = fill(t.start.wait, { seconds: outcome.wait });
    } catch (caught) {
      error = message(caught);
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={submit} novalidate>
  {#if !current}
    <label for="admin-current">{t.admin.currentPassword}</label>
    <input
      id="admin-current"
      type="password"
      autocomplete="current-password"
      bind:value={currentPassword}
    />
  {/if}
  <label for="admin-new">{t.admin.newPassword}</label>
  <input id="admin-new" type="password" autocomplete="new-password" bind:value={next} />
  <label for="admin-repeat">{t.admin.newPasswordRepeat}</label>
  <input id="admin-repeat" type="password" autocomplete="new-password" bind:value={repeat} />
  {#if error}<p class="error" role="alert">⚠ {error}</p>{/if}
  <p><button class="button" type="submit" disabled={busy}>{t.admin.save}</button></p>
</form>

<style>
  label {
    margin-top: 0.75rem;
  }

  .error {
    color: var(--seal);
    font-weight: 700;
  }
</style>
