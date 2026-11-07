/**
 * Sending Web Push with SSRF protection (SPEC 11.3, D-06): web-push only builds the request
 * (VAPID, RFC 8291 encryption); the connection goes to exactly the checked address, HTTPS on
 * port 443, no redirects, timeout, limited response size.
 */
import dns from 'node:dns/promises';
import https from 'node:https';
import net from 'node:net';
import webpush from 'web-push';

/** Address ranges that must never be contacted (private, loopback, link-local, reserved …). */
const BLOCKED_V4: readonly (readonly [string, number])[] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];
const BLOCKED_V6: readonly (readonly [string, number])[] = [
  // Unspecified, loopback and the deprecated IPv4-compatible addresses (::a.b.c.d, v0.6.1).
  ['::', 96],
  ['::ffff:0:0', 96],
  // IPv4-translated (RFC 6145, v0.6.1).
  ['::ffff:0:0:0', 96],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  // Documentation (RFC 9637) and SRv6 SIDs (RFC 9602), both not globally reachable (v0.6.1).
  ['3fff::', 20],
  ['5f00::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['fec0::', 10],
  ['ff00::', 8],
];

function ipv4ToBigInt(address: string): bigint {
  return address.split('.').reduce((acc, part) => (acc << 8n) | BigInt(Number(part)), 0n);
}

function ipv6ToBigInt(address: string): bigint {
  let text = address.toLowerCase();
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (v4?.[1]) {
    const n = ipv4ToBigInt(v4[1]);
    text = `${text.slice(0, -v4[1].length)}${(n >> 16n).toString(16)}:${(n & 0xffffn).toString(16)}`;
  }
  const [head = '', tail = ''] = text.split('::');
  const headParts = head === '' ? [] : head.split(':');
  const tailParts = tail === '' ? [] : tail.split(':');
  const missing = text.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  const groups = [...headParts, ...Array<string>(missing).fill('0'), ...tailParts];
  return groups.reduce((acc, group) => (acc << 16n) | BigInt(parseInt(group, 16)), 0n);
}

function inRange(value: bigint, network: bigint, prefix: number, bits: number): boolean {
  const shift = BigInt(bits - prefix);
  return value >> shift === network >> shift;
}

/** Explicit prefix comparison (node's BlockList misjudged public IPv4 in tests, D-55). */
export function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const value = ipv4ToBigInt(address);
    return !BLOCKED_V4.some(([network, prefix]) =>
      inRange(value, ipv4ToBigInt(network), prefix, 32),
    );
  }
  if (net.isIPv6(address)) {
    const value = ipv6ToBigInt(address);
    return !BLOCKED_V6.some(([network, prefix]) =>
      inRange(value, ipv6ToBigInt(network), prefix, 128),
    );
  }
  return false;
}

export class EndpointError extends Error {}

/** Static checks of a subscription endpoint before storing it. */
export function checkEndpointUrl(endpoint: string): URL {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new EndpointError('invalid url');
  }
  if (url.protocol !== 'https:' || (url.port !== '' && url.port !== '443'))
    throw new EndpointError('https on 443 only');
  if (url.username || url.password) throw new EndpointError('no credentials in url');
  if (net.isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new EndpointError('ip literal');
  if (!/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.'))
    throw new EndpointError('hostname');
  return url;
}

export type Resolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultResolver: Resolver = (hostname) => dns.lookup(hostname, { all: true, verbatim: true });

/** Resolves once; every address must be public, the first one is used (no DNS rebinding). */
export async function resolvePublic(
  hostname: string,
  resolver: Resolver = defaultResolver,
): Promise<{ address: string; family: number }> {
  const addresses = await resolver(hostname);
  if (addresses.length === 0) throw new EndpointError('no address');
  for (const entry of addresses)
    if (!isPublicAddress(entry.address)) throw new EndpointError('private address');
  const first = addresses[0];
  if (!first) throw new EndpointError('no address');
  return first;
}

export interface Subscription {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
}

export interface Vapid {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
}

export type SendResult = { readonly status: number } | { readonly error: string };

const MAX_RESPONSE_BYTES = 4096;
const TIMEOUT_MS = 10_000;

export async function sendPush(
  subscription: Subscription,
  payload: string,
  vapid: Vapid,
  resolver: Resolver = defaultResolver,
): Promise<SendResult> {
  let url: URL;
  let target: { address: string; family: number };
  try {
    url = checkEndpointUrl(subscription.endpoint);
    target = await resolvePublic(url.hostname, resolver);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'endpoint' };
  }
  const details = webpush.generateRequestDetails(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    payload,
    { vapidDetails: vapid, TTL: 24 * 60 * 60, urgency: 'normal', contentEncoding: 'aes128gcm' },
  );
  return postToAddress({
    url,
    target,
    method: details.method,
    headers: details.headers as Record<string, string | number>,
    body: details.body ?? null,
  });
}

export interface PostRequest {
  readonly url: URL;
  /** The already checked address; the connection goes exactly there. */
  readonly target: { readonly address: string; readonly family: number };
  readonly method: string;
  readonly headers: Record<string, string | number>;
  readonly body: Buffer | string | null;
  /** Only for tests: port and trust anchor of a local TLS server. */
  readonly testOnly?: { readonly port: number; readonly ca: string | Buffer };
}

/**
 * One HTTPS request to a fixed address (D-06): SNI and Host are the push service's name, no
 * second DNS lookup, no redirects (https.request never follows them), timeout, size limit.
 */
export function postToAddress(request: PostRequest): Promise<SendResult> {
  const { url, target } = request;
  return new Promise<SendResult>((resolve) => {
    let settled = false;
    const finish = (result: SendResult): void => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    const outgoing = https.request(
      {
        method: request.method,
        host: url.hostname,
        servername: url.hostname,
        port: request.testOnly?.port ?? 443,
        path: `${url.pathname}${url.search}`,
        headers: request.headers,
        timeout: TIMEOUT_MS,
        ...(request.testOnly ? { ca: request.testOnly.ca } : {}),
        // Connect exactly to the checked address. Node asks with { all: true } (happy
        // eyeballs) and then expects a list – answering the old way fails every request.
        lookup: (_hostname, options, callback) => {
          if (options.all) {
            (
              callback as unknown as (
                error: null,
                addresses: { address: string; family: number }[],
              ) => void
            )(null, [{ address: target.address, family: target.family }]);
          } else {
            callback(null, target.address, target.family);
          }
        },
      },
      (response) => {
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) response.destroy();
        });
        response.on('end', () => finish({ status: response.statusCode ?? 0 }));
        response.on('close', () => finish({ status: response.statusCode ?? 0 }));
        response.on('error', () => finish({ error: 'response' }));
      },
    );
    outgoing.on('timeout', () => outgoing.destroy(new Error('timeout')));
    outgoing.on('error', (error) => finish({ error: error.message }));
    if (request.body) outgoing.write(request.body);
    outgoing.end();
  });
}
