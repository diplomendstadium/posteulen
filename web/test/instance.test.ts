/** v1.3.2: the installation hint on the start page names the web address, also via Tor (8.1). */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/status.svelte.ts', () => ({ status: { online: true, updateReady: false } }));

const { installHost } = await import('../src/lib/instance.ts');

describe('installHost', () => {
  it('keeps the address of the page on the web, uses the web address on the onion page', () => {
    expect(installHost('posteulen.de', null)).toBe('posteulen.de');
    expect(installHost('posteulen.de', 'other.example')).toBe('posteulen.de');
    const onion = `${'a'.repeat(56)}.onion`;
    expect(installHost(onion, 'posteulen.de')).toBe('posteulen.de');
    expect(installHost(onion, null)).toBeNull();
  });
});
