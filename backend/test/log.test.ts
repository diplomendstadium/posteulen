import { Writable } from 'node:stream';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { loggerOptions } from '../src/log.ts';

describe('logging (SPEC 2.2, 6, D-21)', () => {
  it('never writes IP addresses, headers, bodies or secrets', async () => {
    const lines: string[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(chunk.toString());
        callback();
      },
    });
    const options = loggerOptions('info');
    if (typeof options !== 'object') throw new Error('expected logger options');
    const app = Fastify({ logger: { ...options, stream } });
    app.get('/x', async (request) => {
      request.log.info(
        { ip: request.ip, headers: request.headers, body: 'Brieftext', password: 'geheim', ok: 1 },
        'handled',
      );
      request.log.info({ nested: { ip: '203.0.113.9', token: 'abc' } }, 'nested');
      return {};
    });
    await app.inject({
      method: 'GET',
      url: '/x',
      remoteAddress: '203.0.113.9',
      headers: { 'user-agent': 'Spion/1.0', cookie: '__Host-pe_session=abc' },
    });
    await app.close();
    const output = lines.join('');
    expect(output).toContain('handled');
    expect(output).toContain('"ok":1');
    for (const forbidden of [
      '203.0.113.9',
      'Spion',
      '__Host-pe_session',
      'Brieftext',
      'geheim',
      'abc',
    ]) {
      expect(output).not.toContain(forbidden);
    }
  });
});
