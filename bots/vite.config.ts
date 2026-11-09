import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** v0.8: the bots control centre (bots.<domain>, SPEC 10.12). */
export default defineConfig({
  plugins: [svelte()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: false,
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3003' },
  },
});
