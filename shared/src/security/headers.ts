/**
 * Security headers (SPEC 6). Single source for Caddy (generated Caddyfile), the API and the
 * local preview server, so that tests check exactly what production sends.
 */

export const CSP_APP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "require-trusted-types-for 'script'",
  'trusted-types svelte-trusted-html posteulen-sw',
].join('; ');

/** The API never returns HTML, so it may load nothing at all. */
export const CSP_API = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'autoplay=()',
  'browsing-topics=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

export const HSTS = 'max-age=63072000; includeSubDomains';

export interface HeaderOptions {
  /** HSTS only over real HTTPS (never on localhost previews). */
  readonly hsts: boolean;
}

/** Headers for every response (static files and API). */
export function commonHeaders(options: HeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  };
  if (options.hsts) headers['Strict-Transport-Security'] = HSTS;
  return headers;
}

export function appHeaders(options: HeaderOptions): Record<string, string> {
  return { ...commonHeaders(options), 'Content-Security-Policy': CSP_APP };
}

export function apiHeaders(options: HeaderOptions): Record<string, string> {
  return {
    ...commonHeaders(options),
    'Content-Security-Policy': CSP_API,
    'Cache-Control': 'no-store',
  };
}

/** Cache rules for static files: hashed assets forever, entry points always revalidated. */
export const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
export const CACHE_REVALIDATE = 'no-cache';

/** Header every state-changing API request must carry (CSRF defence in depth, SPEC 6). */
export const REQUIRED_REQUEST_HEADER = { name: 'x-posteulen', value: '1' } as const;

/** Response header carrying the server version (client update detection, SPEC 16.3). */
export const VERSION_HEADER = 'x-posteulen-version';
