<script lang="ts">
  let {
    id,
    label,
    value = $bindable(''),
    autocomplete,
    hint,
  }: {
    id: string;
    label: string;
    value?: string;
    autocomplete: 'current-password' | 'new-password';
    hint?: string;
  } = $props();
</script>

<div class="field">
  <label for={id}>{label}</label>
  <input
    {id}
    type="password"
    bind:value
    {autocomplete}
    maxlength="1024"
    aria-describedby={hint ? `${id}-hint` : undefined}
  />
  {#if hint}<p class="hint" id={`${id}-hint`}>{hint}</p>{/if}
</div>

<style>
  .field {
    margin-bottom: 1rem;
  }

  .hint {
    margin: 0.25rem 0 0;
    color: var(--ink-soft);
    font-size: 0.95rem;
  }
</style>
