import { describe, expect, it } from 'vitest';
import { de, fill } from '../src/texts/de.ts';
import { apiHeaders, appHeaders, CSP_APP, commonHeaders } from '../src/security/headers.ts';

describe('texts', () => {
  it('fills placeholders and keeps unknown ones visible', () => {
    expect(fill(de.header.goldAmount, { amount: '3,0' })).toBe('3,0 Gold');
    expect(fill('{a} {b}', { a: 1 })).toBe('1 {b}');
  });

  it('has a German text for every API error code', () => {
    for (const code of [
      'internal',
      'not_found',
      'bad_request',
      'forbidden_origin',
      'unsupported_media_type',
      'payload_too_large',
      'client_outdated',
      'rate_limited',
    ]) {
      expect(de.errors).toHaveProperty(code);
    }
  });
});

describe('security headers (SPEC 6)', () => {
  it('contains the CSP of SPEC 6 plus Trusted Types', () => {
    for (const directive of [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
      "require-trusted-types-for 'script'",
    ]) {
      expect(CSP_APP).toContain(directive);
    }
    expect(CSP_APP).not.toContain('unsafe-inline');
    expect(CSP_APP).not.toMatch(/https?:/);
  });

  it('adds HSTS only when requested', () => {
    expect(commonHeaders({ hsts: false })).not.toHaveProperty('Strict-Transport-Security');
    expect(commonHeaders({ hsts: true })['Strict-Transport-Security']).toContain(
      'includeSubDomains',
    );
  });

  it('sets the required headers', () => {
    const headers = appHeaders({ hsts: true });
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('no-referrer');
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headers['Cross-Origin-Resource-Policy']).toBe('same-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
    expect(apiHeaders({ hsts: false })['Cache-Control']).toBe('no-store');
  });
});
