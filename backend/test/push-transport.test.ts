import { describe, expect, it } from 'vitest';
import {
  checkEndpointUrl,
  isPublicAddress,
  resolvePublic,
  sendPush,
} from '../src/push/transport.ts';

describe('SSRF protection for push endpoints (SPEC 11.3)', () => {
  it.each([
    ['10.1.2.3', false],
    ['172.16.0.1', false],
    ['192.168.1.1', false],
    ['127.0.0.1', false],
    ['169.254.169.254', false],
    ['100.64.0.1', false],
    ['0.0.0.0', false],
    ['224.0.0.1', false],
    ['::1', false],
    ['fe80::1', false],
    ['fd00::1', false],
    ['::ffff:10.0.0.1', false],
    ['64:ff9b::a00:1', false],
    ['2001:db8::1', false],
    ['8.8.8.8', true],
    ['2a00:1450:4001:80b::200a', true],
    ['kaputt', false],
  ])('%s → public: %s', (address, expected) => {
    expect(isPublicAddress(address)).toBe(expected);
  });

  it('accepts only HTTPS on 443 with a host name', () => {
    expect(checkEndpointUrl('https://fcm.googleapis.com/fcm/send/abc').hostname).toBe(
      'fcm.googleapis.com',
    );
    for (const bad of [
      'http://a.example/x',
      'https://a.example:444/x',
      'https://1.2.3.4/x',
      'https://[2001:db8::1]/x',
      'https://u:p@a.example/',
      'https://intranet/x',
      'nonsense',
    ]) {
      expect(() => checkEndpointUrl(bad), bad).toThrow();
    }
  });

  it('rejects host names that resolve to any private address (DNS rebinding)', async () => {
    await expect(
      resolvePublic('evil.example', async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ]),
    ).rejects.toThrow('private');
    await expect(resolvePublic('empty.example', async () => [])).rejects.toThrow();
    expect(
      await resolvePublic('ok.example', async () => [{ address: '8.8.4.4', family: 4 }]),
    ).toEqual({ address: '8.8.4.4', family: 4 });
  });

  it('does not connect when the check fails', async () => {
    const result = await sendPush(
      {
        endpoint: 'https://push.example/x',
        p256dh:
          'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
      'x',
      {
        subject: 'mailto:a@example.org',
        publicKey:
          'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        privateKey: 'tBHItJI5svbpez7KI4CCXgtBHItJI5svbpez7KI4CCX',
      },
      async () => [{ address: '192.168.0.1', family: 4 }],
    );
    expect(result).toEqual({ error: 'private address' });
  });
});
