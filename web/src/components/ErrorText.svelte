<script lang="ts">
  let { message }: { message: string | null } = $props();
</script>

{#if message}
  <p class="error" role="alert"><span aria-hidden="true">⚠</span><span>{message}</span></p>
{/if}

<style>
  .error {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--seal);
    border-radius: 0.5rem;
    background: var(--paper);
    color: var(--seal);
    font-weight: 700;
  }
</style>
