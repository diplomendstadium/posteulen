import net from 'node:net';

/**
 * Key for IP-based limits (SPEC 5.10): IPv4 as is, IPv6 per /64 prefix, IPv4-mapped IPv6 as
 * IPv4. Only ever kept in memory.
 */
export function ipKey(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  if (net.isIPv4(ip)) return ip;
  if (!net.isIPv6(ip)) return 'unknown';
  const [head = '', tail = ''] = ip.split('::');
  const headParts = head === '' ? [] : head.split(':');
  const tailParts = tail === '' ? [] : tail.split(':');
  const missing = ip.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  const groups = [...headParts, ...Array<string>(missing).fill('0'), ...tailParts];
  return `${groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`;
}

/** All requests through the onion service share this key (v0.9, SPEC 5.10, 16.5). */
export const TOR_CLIENT_KEY = 'tor';

/**
 * Key of the client for IP-based limits. v0.9: over Tor the server sees no addresses of its own
 * visitors (only the local Tor listener), so all of them count together as one client – rather
 * block all Tor users for a short while than weaken the protection of the server.
 */
export function clientKey(request: { readonly ip: string; readonly viaTor?: boolean }): string {
  return request.viaTor === true ? TOR_CLIENT_KEY : ipKey(request.ip);
}
