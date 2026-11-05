<script lang="ts">
  import { de } from '@posteulen/shared/texts/de.ts';
  import { applyUpdate, status } from '../lib/status.svelte.ts';
</script>

{#if !status.online}
  <div class="banner offline" role="status">
    <span aria-hidden="true">⚠</span>
    <span>{de.app.offline}</span>
  </div>
{/if}
{#if status.updateReady}
  <div class="banner" role="status">
    <span aria-hidden="true">↻</span>
    <span>{de.app.updateAvailable}</span>
    <button class="button" type="button" onclick={() => void applyUpdate()}>{de.app.reload}</button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--wood-dark);
    color: var(--on-wood);
    font-weight: 700;
  }

  .offline {
    background: var(--seal);
  }
</style>
