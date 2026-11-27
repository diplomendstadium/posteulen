<script lang="ts">
  /**
   * v1.4.3: switching the second factor on and off (SPEC 5.11). On: password → QR code and key →
   * first code of the app → ten backup codes, shown only once. Off: password and a code of the
   * app or a backup code.
   */
  import { t, fill } from '../lib/i18n.svelte.ts';
  import ErrorText from './ErrorText.svelte';
  import PasswordInput from './PasswordInput.svelte';
  import QrCode from './QrCode.svelte';
  import TwoFactorInput from './TwoFactorInput.svelte';
  import {
    account,
    disableTwoFactor,
    enableTwoFactor,
    startTwoFactor,
  } from '../lib/auth.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { status } from '../lib/status.svelte.ts';

  const tf = $derived(account.profile?.twoFactor ?? { active: false, backupLeft: 0 });

  let password = $state('');
  let code = $state('');
  let setup = $state<{ secret: string; uri: string } | null>(null);
  let backupCodes = $state<string[] | null>(null);
  let busy = $state<string | null>(null);
  let error = $state<string | null>(null);
  let done = $state<string | null>(null);
  let copied = $state(false);

  const statusText = $derived(
    !tf.active
      ? t.twoFactor.off
      : tf.backupLeft === 0
        ? t.twoFactor.onNone
        : tf.backupLeft === 1
          ? t.twoFactor.onOne
          : fill(t.twoFactor.on, { count: tf.backupLeft }),
  );

  async function run(step: string, work: () => Promise<void>): Promise<void> {
    if (busy || !status.online) return;
    error = null;
    done = null;
    busy = step;
    try {
      await work();
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = null;
    }
  }

  const outcomeError = (outcome: 'wrong' | 'code' | { wait: number }): string =>
    outcome === 'wrong'
      ? t.settings.wrongOld
      : outcome === 'code'
        ? t.twoFactor.wrong
        : fill(t.start.wait, { seconds: outcome.wait });

  const start = () =>
    run(t.twoFactor.stepPassword, async () => {
      const result = await startTwoFactor(password);
      if (typeof result === 'string' || 'wait' in result) {
        error = outcomeError(result);
        return;
      }
      password = '';
      code = '';
      setup = result;
    });

  const confirm = () =>
    run(t.twoFactor.stepCode, async () => {
      backupCodes = await enableTwoFactor(code);
      setup = null;
      code = '';
      done = t.twoFactor.enabled;
    });

  const disable = () =>
    run(t.twoFactor.stepPassword, async () => {
      const outcome = await disableTwoFactor(password, code);
      if (outcome !== 'ok') {
        error = outcomeError(outcome);
        return;
      }
      password = '';
      code = '';
      done = t.twoFactor.disabled;
    });

  async function copy(): Promise<void> {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      copied = true;
    } catch {
      copied = false;
    }
  }
</script>

<section class="card" aria-labelledby="two-factor-title" data-testid="two-factor">
  <h2 id="two-factor-title">{t.twoFactor.title}</h2>
  <p>{t.twoFactor.intro}</p>
  <p class="notice"><span aria-hidden="true">⚠</span><span>{t.twoFactor.warning}</span></p>
  <p data-testid="two-factor-state"><strong>{statusText}</strong></p>

  {#if backupCodes}
    <div class="codes" data-testid="backup-codes">
      <h3>{t.twoFactor.codesTitle}</h3>
      <p>{t.twoFactor.codes}</p>
      <ol>
        {#each backupCodes as item (item)}<li><code>{item}</code></li>{/each}
      </ol>
      <div class="actions">
        <button class="button secondary" type="button" onclick={() => void copy()}
          >{t.twoFactor.codesCopy}</button
        >
        <button
          class="button"
          type="button"
          onclick={() => {
            backupCodes = null;
            copied = false;
          }}>{t.twoFactor.codesDone}</button
        >
      </div>
      {#if copied}<p role="status">✔ {t.twoFactor.codesCopied}</p>{/if}
    </div>
  {:else if setup}
    <p>{t.twoFactor.scan}</p>
    <QrCode text={setup.uri} label={t.twoFactor.qrAlt} />
    <p>
      {t.twoFactor.secret}:
      <code class="secret" data-testid="two-factor-secret">{setup.secret}</code>
    </p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
      novalidate
    >
      <TwoFactorInput id="two-factor-confirm" bind:value={code} autofocus />
      <ErrorText message={error} />
      <div class="actions">
        <button class="button" type="submit" disabled={busy !== null || code.trim() === ''}
          >{t.twoFactor.confirm}</button
        >
        <button
          class="button secondary"
          type="button"
          onclick={() => {
            setup = null;
            code = '';
            error = null;
          }}>{t.twoFactor.cancel}</button
        >
      </div>
    </form>
  {:else if tf.active}
    <p>{t.twoFactor.disableIntro}</p>
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void disable();
      }}
      novalidate
    >
      <PasswordInput
        id="two-factor-off-password"
        label={t.twoFactor.password}
        autocomplete="current-password"
        bind:value={password}
      />
      <TwoFactorInput id="two-factor-off-code" bind:value={code} />
      <ErrorText message={error} />
      <button
        class="button secondary"
        type="submit"
        disabled={busy !== null || !password || code.trim() === '' || !status.online}
        >{t.twoFactor.disable}</button
      >
    </form>
  {:else}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        void start();
      }}
      novalidate
    >
      <PasswordInput
        id="two-factor-password"
        label={t.twoFactor.password}
        autocomplete="current-password"
        bind:value={password}
      />
      <ErrorText message={error} />
      <button class="button" type="submit" disabled={busy !== null || !password || !status.online}
        >{t.twoFactor.start}</button
      >
    </form>
  {/if}
  {#if busy}<p class="notice" role="status">
      <span aria-hidden="true">⏳</span><span>{busy}</span>
    </p>{/if}
  {#if done}<p class="notice" role="status">
      <span aria-hidden="true">✔</span><span>{done}</span>
    </p>{/if}
</section>

<style>
  section {
    margin-bottom: 1.5rem;
  }

  .codes ol {
    columns: 2;
    column-gap: 2rem;
    padding-left: 1.75rem;
    max-width: 24rem;
  }

  .codes code,
  .secret {
    font-family: monospace;
    font-size: 1.05rem;
    letter-spacing: 0.05em;
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  @media (max-width: 22rem) {
    .codes ol {
      columns: 1;
    }
  }
</style>
