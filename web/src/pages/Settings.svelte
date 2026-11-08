<script lang="ts">
  import { t, fill } from '../lib/i18n.svelte.ts';
  import { checkPassword } from '@posteulen/shared/names.ts';
  import ErrorText from '../components/ErrorText.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import PushSettings from '../components/PushSettings.svelte';
  import AccountSettings from '../components/AccountSettings.svelte';
  import LetterSettings from '../components/LetterSettings.svelte';
  import LanguageSettings from '../components/LanguageSettings.svelte';
  import VoucherRedeem from '../components/VoucherRedeem.svelte';
  import { changePassword, logout } from '../lib/auth.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { navigate } from '../lib/router.svelte.ts';
  import { status } from '../lib/status.svelte.ts';

  let oldPassword = $state('');
  let newPassword = $state('');
  let repeat = $state('');
  let busy = $state<string | null>(null);
  let error = $state<string | null>(null);
  let done = $state(false);

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy || !status.online) return;
    done = false;
    const lengthError = checkPassword(newPassword);
    error =
      lengthError === 'too_short'
        ? t.register.tooShort
        : lengthError === 'too_long'
          ? t.register.tooLong
          : newPassword !== repeat
            ? t.register.mismatch
            : null;
    if (error) return;
    busy = t.settings.stepOld;
    try {
      const outcome = await changePassword(oldPassword, newPassword, (step) => {
        busy = step === 'old' ? t.settings.stepOld : t.settings.stepNew;
      });
      if (outcome === 'ok') {
        done = true;
        oldPassword = newPassword = repeat = '';
      } else if (outcome === 'wrong') error = t.settings.wrongOld;
      else error = fill(t.start.wait, { seconds: outcome.wait });
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = null;
    }
  }

  async function signOut(): Promise<void> {
    await logout();
    navigate('/', true);
  }
</script>

<PushSettings />

<LetterSettings />

<LanguageSettings />

<VoucherRedeem />

<section class="card" aria-labelledby="pw-title">
  <h2 id="pw-title">{t.settings.passwordTitle}</h2>
  <form onsubmit={submit} novalidate>
    <PasswordInput
      id="old-password"
      label={t.settings.oldPassword}
      autocomplete="current-password"
      bind:value={oldPassword}
    />
    <PasswordInput
      id="new-password"
      label={t.settings.newPassword}
      autocomplete="new-password"
      hint={t.register.passwordHint}
      bind:value={newPassword}
    />
    <PasswordInput
      id="new-repeat"
      label={t.settings.newPasswordRepeat}
      autocomplete="new-password"
      bind:value={repeat}
    />
    <ErrorText message={error} />
    {#if done}<p class="notice" role="status">
        <span aria-hidden="true">✔</span><span>{t.settings.changed}</span>
      </p>{/if}
    <button class="button" type="submit" disabled={busy !== null || !status.online}
      >{t.settings.change}</button
    >
    {#if busy}<p class="notice" role="status">
        <span aria-hidden="true">⏳</span><span>{busy}</span>
      </p>{/if}
  </form>
</section>

<AccountSettings />

<section class="card" aria-labelledby="logout-title">
  <h2 id="logout-title">{t.settings.logoutTitle}</h2>
  <p>{t.settings.logoutHint}</p>
  <button class="button secondary" type="button" onclick={() => void signOut()}
    >{t.settings.logout}</button
  >
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }
</style>
