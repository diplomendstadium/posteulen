<script lang="ts">
  /** Optional cover letter: small parchment, free (SPEC 9.1.4, 9.2.7). */
  import { de, fill } from '@posteulen/shared/texts/de.ts';
  import { countCodePoints } from '@posteulen/shared/names.ts';
  import { maxChars, sanitizeLetterText } from '@posteulen/shared/text-rules.ts';

  let { value = $bindable(null), id }: { value: string | null; id: string } = $props();

  let enabled = $state(false);
  let text = $state('');
  const max = maxChars('small');
  const count = $derived(countCodePoints(text));

  $effect(() => {
    value = enabled && text.trim() !== '' && count <= max ? text : null;
  });

  function input(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement;
    const clean = sanitizeLetterText(target.value);
    if (clean.text !== target.value) target.value = clean.text;
    text = clean.text;
  }
</script>

<label class="check"><input type="checkbox" bind:checked={enabled} /> {de.owls.withCover}</label>
{#if enabled}
  <label for={id}>{de.owls.coverText}</label>
  <textarea {id} rows="4" value={text} oninput={input} aria-describedby={`${id}-count`}></textarea>
  <p id={`${id}-count`} class="counter" class:over={count > max}>
    {fill(de.letters.counter, { count, max })}
  </p>
{/if}

<style>
  .check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    min-height: 2.75rem;
  }

  .check input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: var(--wood);
  }

  textarea {
    width: 100%;
  }

  .counter {
    margin: 0.25rem 0 1rem;
    color: var(--ink-soft);
  }

  .counter.over {
    color: var(--seal);
    font-weight: 700;
  }
</style>
