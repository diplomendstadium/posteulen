<script lang="ts">
  import type { Snippet } from 'svelte';
  import { linkHandler, route } from '../lib/router.svelte.ts';

  let {
    href,
    children,
    class: className = '',
  }: { href: string; children: Snippet; class?: string } = $props();
</script>

<a
  {href}
  class={className}
  aria-current={route.path === href ? 'page' : undefined}
  onclick={linkHandler}>{@render children()}</a
>
