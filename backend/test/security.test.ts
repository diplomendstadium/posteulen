import { describe, expect, it } from 'vitest';
import { ipKey } from '../src/security/ip.ts';
import { Ephemeral, LoginGuard, RateLimiter } from '../src/security/limits.ts';

describe('IP keys (SPEC 5.10)', () => {
  it('groups IPv6 per /64 and unwraps IPv4-mapped addresses', () => {
    expect(ipKey('203.0.113.5')).toBe('203.0.113.5');
    expect(ipKey('::ffff:203.0.113.5')).toBe('203.0.113.5');
    expect(ipKey('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1:2::/64');
    expect(ipKey('2001:db8:1:2::9')).toBe(ipKey('2001:db8:1:2:ffff::1'));
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipKey('::1')).toBe('0:0:0:0::/64');
    expect(ipKey('kaputt')).toBe('unknown');
  });
});

describe('limits', () => {
  it('counts per window', () => {
    const limiter = new RateLimiter(2, 1000);
    expect([limiter.hit('a', 0), limiter.hit('a', 10), limiter.hit('a', 20)]).toEqual([0, 0, 980]);
    expect(limiter.hit('b', 20)).toBe(0);
    expect(limiter.hit('a', 1000)).toBe(0);
  });

  it('backs off exponentially up to 15 minutes and forgets after a day', () => {
    const guard = new LoginGuard(5, 3);
    for (let i = 0; i < 4; i++) guard.fail('x', 0);
    expect(guard.captchaRequired('x', 0)).toBe(true);
    expect(guard.waitMs('x', 0)).toBe(0);
    guard.fail('x', 0);
    expect(guard.waitMs('x', 0)).toBe(2000);
    for (let i = 0; i < 20; i++) guard.fail('x', 0);
    expect(guard.waitMs('x', 0)).toBe(15 * 60_000);
    expect(guard.waitMs('x', 25 * 60 * 60 * 1000)).toBe(0);
    guard.reset('x');
    expect(guard.captchaRequired('x', 0)).toBe(false);
  });

  it('expires and caps short-lived values', () => {
    const store = new Ephemeral<number>(2);
    store.set('a', 1, 100, 0);
    expect(store.get('a', 50)).toBe(1);
    expect(store.get('a', 100)).toBeUndefined();
    store.set('b', 2, 100, 0);
    store.set('c', 3, 100, 0);
    store.set('d', 4, 100, 0);
    expect(store.values(0)).toEqual([3, 4]);
    expect(store.take('c', 0)).toBe(3);
    expect(store.take('c', 0)).toBeUndefined();
  });
});
