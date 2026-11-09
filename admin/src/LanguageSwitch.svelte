<script lang="ts">
  /** v0.8: German or English for the admin panel and the bots control centre. */
  import { panel, setPanelLanguage, t } from './lib/i18n.svelte.ts';
</script>

<button
  class="button secondary"
  type="button"
  lang={panel.lang === 'de' ? 'en' : 'de'}
  onclick={() => setPanelLanguage(panel.lang === 'de' ? 'en' : 'de')}
  >{t.admin.switchLanguage}</button
>
