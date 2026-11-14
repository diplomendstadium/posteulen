import http from 'node:http';
import Fastify, { LogController, type FastifyInstance, type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import { VERSION } from '@posteulen/shared/version.ts';
import {
  apiHeaders,
  REQUIRED_REQUEST_HEADER,
  VERSION_HEADER,
} from '@posteulen/shared/security/headers.ts';
import { SECURITY } from '@posteulen/shared/constants.ts';
import type { Database } from '../db/database.ts';
import { loggerOptions } from '../log.ts';
import { logError } from '../ops/error-log.ts';
import { HttpError } from './errors.ts';

/** v0.8: the bots control centre is a third API of its own (SPEC 10.12). */
export type ApiKind = 'user' | 'admin' | 'bots';

export interface ApiOptions {
  readonly kind: ApiKind;
  /** The only origin this API accepts (SPEC 4.3). */
  readonly origin: string;
  readonly db: Database;
  /** HSTS on API responses (production behind HTTPS). */
  readonly hsts: boolean;
  readonly logLevel?: string | undefined;
  /**
   * v0.9 (user API only): the onion service. The same routes also answer on a second, local
   * listener that only the onion site of Caddy reaches; requests there carry this origin, count
   * as one client for all IP-based limits and are refused while Tor is switched off (SPEC 16.5).
   */
  readonly tor?: { readonly origin: string; readonly enabled: () => boolean } | undefined;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** v0.9: the request came through the onion service (the local Tor listener). */
    viaTor: boolean;
  }
}

/** Marks requests of the Tor listener; set by its server, never derived from headers. */
const VIA_TOR = Symbol('posteulen.viaTor');
type MarkedRequest = http.IncomingMessage & { [VIA_TOR]?: true };

/** The extra Tor listener of a user API (v0.9), started by listenTor(). */
const torServers = new WeakMap<FastifyInstance, http.Server>();

/** Starts the Tor listener of a user API on the loopback interface (v0.9, SPEC 16.5). */
export async function listenTor(app: FastifyInstance, host: string, port: number): Promise<number> {
  const server = torServers.get(app);
  if (!server) throw new Error('this API has no Tor listener');
  // Routes and hooks are compiled only once the instance is ready.
  await app.ready();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host, port }, () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  return typeof address === 'object' && address !== null ? address.port : port;
}

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CLIENT_VERSION_HEADER = 'x-posteulen-client-version';

/** Error codes the clients translate via texts/de.ts (errors.*). */
export type ErrorCode =
  | 'internal'
  | 'not_found'
  | 'bad_request'
  | 'forbidden_origin'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'client_outdated'
  | 'rate_limited'
  | 'tor_disabled';

function mapFastifyError(error: FastifyError): { status: number; code: ErrorCode } {
  switch (error.code) {
    case 'FST_ERR_CTP_BODY_TOO_LARGE':
      return { status: 413, code: 'payload_too_large' };
    case 'FST_ERR_CTP_INVALID_MEDIA_TYPE':
    case 'FST_ERR_CTP_INVALID_CONTENT_LENGTH':
      return { status: 415, code: 'unsupported_media_type' };
    case 'FST_ERR_CTP_EMPTY_JSON_BODY':
    case 'FST_ERR_CTP_INVALID_JSON_BODY':
    case 'FST_ERR_VALIDATION':
      return { status: 400, code: 'bad_request' };
    default:
      if (error.statusCode === 400 && error.code?.startsWith('FST_ERR_CTP')) {
        return { status: 400, code: 'bad_request' };
      }
      return { status: 500, code: 'internal' };
  }
}

/**
 * Builds one API instance (user or admin, D-12). Both share these guarantees:
 * JSON only, size limit, exact Origin check, required header for state-changing requests,
 * Fetch-Metadata check, no internals in errors, security headers on every response.
 */
export function buildApi(options: ApiOptions): FastifyInstance {
  let torServer: http.Server | undefined;
  const app = Fastify({
    // v0.9: one router for both listeners – the clearnet one (Caddy, HTTPS) and, for the user
    // API, the local Tor listener. Requests of the latter are marked by their server.
    serverFactory: (handler) => {
      if (options.tor) {
        torServer = http.createServer((request: MarkedRequest, response) => {
          request[VIA_TOR] = true;
          handler(request, response);
        });
      }
      return http.createServer(handler);
    },
    logger: options.logLevel === undefined ? false : loggerOptions(options.logLevel),
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: SECURITY.MAX_REQUEST_BYTES,
    trustProxy: ['127.0.0.1', '::1'],
    return503OnClosing: true,
    exposeHeadRoutes: false,
    routerOptions: { ignoreTrailingSlash: false, caseSensitive: true },
  });

  // Only JSON request bodies (SPEC 6).
  app.removeContentTypeParser('text/plain');
  void app.register(cookie);

  const headers = apiHeaders({ hsts: options.hsts });
  // Over the onion service there is no HTTPS: no HSTS (browsers ignore it there anyway).
  const torHeaders = apiHeaders({ hsts: false });
  if (torServer) {
    const server = torServer;
    torServers.set(app, server);
    app.addHook('onClose', async () => {
      if (!server.listening) return;
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeAllConnections();
      });
    });
  }
  app.decorateRequest('viaTor', false);

  app.addHook('onRequest', async (request, reply) => {
    const viaTor = options.tor !== undefined && (request.raw as MarkedRequest)[VIA_TOR] === true;
    request.viaTor = viaTor;
    reply.headers(viaTor ? torHeaders : headers);
    reply.header(VERSION_HEADER, VERSION);

    // v0.9: switched off in the admin panel – the root helper stops Tor as well (SPEC 16.5).
    if (viaTor && !options.tor?.enabled()) {
      return reply.code(503).send({ code: 'tor_disabled' });
    }
    const origin = request.headers.origin;
    const site = request.headers['sec-fetch-site'];
    const expectedOrigin = viaTor ? options.tor?.origin : options.origin;
    if (origin !== undefined && origin !== expectedOrigin) {
      return reply.code(403).send({ code: 'forbidden_origin' });
    }
    // Admin and user origins are same-site, so SameSite cookies do not separate them (SPEC 4.3).
    if (site !== undefined && site !== 'same-origin' && site !== 'none') {
      return reply.code(403).send({ code: 'forbidden_origin' });
    }
    if (STATE_CHANGING.has(request.method)) {
      if (origin === undefined) return reply.code(403).send({ code: 'forbidden_origin' });
      if (request.headers[REQUIRED_REQUEST_HEADER.name] !== REQUIRED_REQUEST_HEADER.value) {
        return reply.code(403).send({ code: 'forbidden_origin' });
      }
    }
    const clientVersion = request.headers[CLIENT_VERSION_HEADER];
    if (
      typeof clientVersion === 'string' &&
      clientVersion !== VERSION &&
      request.routeOptions.url !== '/api/health' &&
      request.routeOptions.url !== '/api/version'
    ) {
      return reply.code(409).send({ code: 'client_outdated' });
    }
    return undefined;
  });

  app.setErrorHandler((error: FastifyError | HttpError, request, reply) => {
    reply.headers(request.viaTor ? torHeaders : headers);
    if (error instanceof HttpError) {
      if (error.status === 429 && typeof error.extra['retryAfterSeconds'] === 'number') {
        reply.header('retry-after', String(error.extra['retryAfterSeconds']));
      }
      return reply.code(error.status).send({ code: error.code, ...error.extra });
    }
    const mapped = mapFastifyError(error);
    if (mapped.status >= 500) {
      request.log.error({ err: { code: error.code, message: error.message } }, 'request failed');
      try {
        logError(
          options.db,
          {
            component:
              options.kind === 'user'
                ? 'Nutzer-API'
                : options.kind === 'admin'
                  ? 'Admin-API'
                  : 'Bots-API',
            severity: 'error',
            what: `Unerwarteter Fehler bei ${request.method} ${request.routeOptions.url ?? 'unbekannter Pfad'}`,
            cause: 'Programmfehler oder unerwarteter Zustand der Datenbank.',
            action: 'Mit „journalctl -u posteulen“ die Uhrzeit prüfen und den Fehler melden.',
          },
          Date.now(),
        );
      } catch {
        // The error log must never break the error response.
      }
    }
    return reply.code(mapped.status).send({ code: mapped.code });
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ code: 'not_found' });
  });

  app.get('/api/health', async () => {
    options.db.get('SELECT 1');
    return { status: 'ok', version: VERSION, api: options.kind };
  });

  app.get('/api/version', async () => ({ version: VERSION }));

  return app;
}
