import type { FastifyServerOptions } from 'fastify';

/**
 * Logger options (SPEC 2.2, 6, D-21): no request logging, no IP addresses, no headers,
 * bodies, cookies, names, letters, keys or tokens. Only explicit, curated messages are logged.
 */
export function loggerOptions(level: string): NonNullable<FastifyServerOptions['logger']> {
  return {
    level,
    base: null,
    redact: {
      paths: [
        'req',
        'res',
        'ip',
        'ips',
        'headers',
        'body',
        'cookie',
        'cookies',
        'authorization',
        'password',
        'token',
        'name',
        'text',
        '*.ip',
        '*.headers',
        '*.body',
        '*.password',
        '*.token',
      ],
      remove: true,
    },
    serializers: {
      req: () => ({}),
      res: () => ({}),
    },
  };
}
