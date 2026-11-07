<script lang="ts">
  /**
   * Small flag in the top right corner of every screen (v0.4): the British flag switches to
   * English, the German flag back to German. Signed in, the choice is saved in the account.
   */
  import { api } from '../lib/api.ts';
  import { account, type Profile } from '../lib/auth.svelte.ts';
  import { i18n, setLanguage, t } from '../lib/i18n.svelte.ts';

  let { onwood = false }: { onwood?: boolean } = $props();

  async function toggle(): Promise<void> {
    const next = i18n.lang === 'en' ? 'de' : 'en';
    setLanguage(next);
    if (!account.profile) return;
    try {
      const result = await api<{ profile: Profile }>('PATCH', '/api/account/language', {
        language: next,
      });
      account.profile = result.profile;
    } catch {
      // Offline: the view has switched; the account follows with the next change.
    }
  }
</script>

<button
  type="button"
  class="flag"
  class:onwood
  lang={t.language.switchTo}
  aria-label={t.language.switchLabel}
  title={t.language.switchLabel}
  data-testid="language-flag"
  onclick={() => void toggle()}
>
  {#if i18n.lang === 'en'}
    <!-- Germany: black, red, gold -->
    <svg viewBox="0 0 5 3" width="30" height="18" aria-hidden="true" focusable="false">
      <rect width="5" height="1" y="0" fill="#000" />
      <rect width="5" height="1" y="1" fill="#dd0000" />
      <rect width="5" height="1" y="2" fill="#ffce00" />
    </svg>
  {:else}
    <!-- United Kingdom (Union Flag) -->
    <svg viewBox="0 0 60 30" width="30" height="15" aria-hidden="true" focusable="false">
      <clipPath id="flag-uk-all"><path d="M0,0 v30 h60 v-30 z" /></clipPath>
      <clipPath id="flag-uk-quarters"
        ><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath
      >
      <g clip-path="url(#flag-uk-all)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clip-path="url(#flag-uk-quarters)"
          stroke="#c8102e"
          stroke-width="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" stroke-width="6" />
      </g>
    </svg>
  {/if}
</button>

<style>
  .flag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.75rem;
    min-height: 2.75rem;
    padding: 0.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--paper);
    box-shadow: var(--shadow);
    cursor: pointer;
  }

  /* In the wooden top bar: no frame (the touch target keeps its 44 px, SPEC 14). */
  .flag.onwood {
    padding: 0;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  .flag svg {
    display: block;
    border: 1px solid rgb(0 0 0 / 25%);
  }
</style>
