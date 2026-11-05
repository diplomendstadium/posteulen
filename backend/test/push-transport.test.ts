import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkEndpointUrl,
  isPublicAddress,
  postToAddress,
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

describe('HTTPS connection to the checked address (regression: Node asks lookup with all: true)', () => {
  const fixtures = path.resolve(import.meta.dirname, 'fixtures');
  const key = fs.readFileSync(path.join(fixtures, 'push-test-key.pem'));
  const cert = fs.readFileSync(path.join(fixtures, 'push-test-cert.pem'));

  async function withServer(
    handler: http.RequestListener,
    run: (port: number) => Promise<void>,
  ): Promise<void> {
    const server = https.createServer({ key, cert }, handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      await run((server.address() as { port: number }).port);
    } finally {
      server.close();
    }
  }

  it('connects, sends SNI/Host of the push service and returns the status', async () => {
    let seen: { host: string | undefined; body: string } = { host: undefined, body: '' };
    await withServer(
      (req, res) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
          seen = { host: req.headers.host, body };
          res.writeHead(201).end();
        });
      },
      async (port) => {
        const result = await postToAddress({
          url: new URL('https://push.test/send/abc'),
          target: { address: '127.0.0.1', family: 4 },
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream', TTL: 60 },
          body: Buffer.from('verschlüsselt'),
          testOnly: { port, ca: cert },
        });
        expect(result).toEqual({ status: 201 });
      },
    );
    expect(seen.host).toMatch(/^push\.test(:\d+)?$/);
    expect(seen.body).toBe('verschlüsselt');
  });

  it('does not follow redirects and limits the response size', async () => {
    await withServer(
      (_req, res) =>
        res.writeHead(301, { location: 'https://127.0.0.1/' }).end('x'.repeat(100_000)),
      async (port) => {
        const result = await postToAddress({
          url: new URL('https://push.test/x'),
          target: { address: '127.0.0.1', family: 4 },
          method: 'POST',
          headers: {},
          body: null,
          testOnly: { port, ca: cert },
        });
        expect(result).toEqual({ status: 301 });
      },
    );
  });

  it('rejects a certificate that does not match the push service name', async () => {
    await withServer(
      (_req, res) => res.writeHead(201).end(),
      async (port) => {
        const result = await postToAddress({
          url: new URL('https://other.test/x'),
          target: { address: '127.0.0.1', family: 4 },
          method: 'POST',
          headers: {},
          body: null,
          testOnly: { port, ca: cert },
        });
        expect('error' in result).toBe(true);
      },
    );
  });
});
