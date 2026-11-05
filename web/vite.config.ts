import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VERSION } from '@posteulen/shared/version.ts';
import { de } from '@posteulen/shared/texts/de.ts';

/**
 * Injects the list of app-shell files and a build id into the service worker (D-08).
 * Owl images are deliberately excluded: they are loaded on demand (SPEC 9.2.6).
 */
function serviceWorkerManifest(): Plugin {
  return {
    name: 'posteulen-sw-manifest',
    apply: 'build',
    generateBundle(_options, bundle) {
      const shell = Object.keys(bundle)
        .filter((file) => file !== 'sw.js')
        .filter(
          (file) => /\.(js|css|html|webmanifest|woff2)$/.test(file) || file.startsWith('icons/'),
        )
        .filter((file) => !file.includes('owl-'))
        .sort();
      const publicFiles = listFiles(path.resolve(import.meta.dirname, 'public')).filter(
        (file) => !path.basename(file).startsWith('.'),
      );
      const files = ['/', ...[...shell, ...publicFiles].sort().map((file) => `/${file}`)];
      const buildId = `${VERSION}-${hash(files.join('|'))}`;
      const sw = bundle['sw.js'];
      if (!sw || sw.type !== 'chunk') throw new Error('sw.js missing in bundle');
      if (!sw.code.includes('__POSTEULEN_SHELL__') || !sw.code.includes('__POSTEULEN_BUILD__')) {
        throw new Error('service worker placeholders missing');
      }
      if (/^\s*import[\s{]/m.test(sw.code))
        throw new Error('service worker must not import chunks');
      sw.code = sw.code
        .replace('__POSTEULEN_SHELL__', JSON.stringify(files).slice(1, -1))
        .replace('__POSTEULEN_BUILD__', buildId);
    },
  };
}

function listFiles(dir: string, prefix = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listFiles(path.join(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`],
    );
}

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export default defineConfig({
  plugins: [svelte(), serviceWorkerManifest()],
  define: {
    __POSTEULEN_VERSION__: JSON.stringify(VERSION),
    __POSTEULEN_PUSH_TEXTS__: JSON.stringify({
      testBody: de.push.testBody,
      letterBody: de.push.letterBody,
      goldBody: de.push.goldBody,
      giftBody: de.push.giftBody,
      chickBody: de.push.chickBody,
      eggsBody: de.push.eggsBody,
      hatchedBody: de.push.hatchedBody,
      deletionBody: de.push.deletionBody,
      broadcastBody: de.push.broadcastBody,
      newsBody: de.push.newsBody,
    }),
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
    sourcemap: false,
    rolldownOptions: {
      input: { main: 'index.html', sw: 'src/sw.ts' },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
