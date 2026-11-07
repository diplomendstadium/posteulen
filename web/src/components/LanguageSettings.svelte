<script lang="ts">
  /**
   * Preferred language of the account (v0.4). Applies at once; the flag in the top right
   * corner does the same.
   */
  import { LANGUAGES, type Language } from '@posteulen/shared/i18n.ts';
  import ErrorText from './ErrorText.svelte';
  import { api } from '../lib/api.ts';
  import { account, type Profile } from '../lib/auth.svelte.ts';
  import { i18n, setLanguage, t } from '../lib/i18n.svelte.ts';
  import { errorMessage } from '../lib/messages.ts';
  import { status } from '../lib/status.svelte.ts';

  let busy = $state(false);
  let error = $state<string | null>(null);

  async function choose(language: Language): Promise<void> {
    if (busy || language === i18n.lang) return;
    busy = true;
    error = null;
    try {
      const result = await api<{ profile: Profile }>('PATCH', '/api/account/language', {
        language,
      });
      account.profile = result.profile;
      setLanguage(language);
    } catch (caught) {
      error = errorMessage(caught);
    } finally {
      busy = false;
    }
  }
</script>

<section class="card" aria-labelledby="language-title">
  <h2 id="language-title">{t.language.title}</h2>
  <p>{t.language.intro}</p>
  <fieldset>
    <legend>{t.language.legend}</legend>
    {#each LANGUAGES as language (language)}
      <label class="option" lang={language}
        ><input
          type="radio"
          name="language"
          value={language}
          checked={i18n.lang === language}
          disabled={busy || !status.online}
          onchange={() => void choose(language)}
        />
        {t.language[language]}</label
      >
    {/each}
  </fieldset>
  <ErrorText message={error} />
</section>

<style>
  fieldset {
    border: none;
    padding: 0;
    margin: 0;
  }

  legend {
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .option {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    min-height: 2.75rem;
    font-weight: 400;
    margin: 0.25rem 0;
  }

  .option input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  section {
    margin-bottom: 1.5rem;
  }
</style>
