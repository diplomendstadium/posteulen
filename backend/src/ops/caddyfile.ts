import {
  appHeaders,
  CACHE_IMMUTABLE,
  CACHE_REVALIDATE,
  commonHeaders,
} from '@posteulen/shared/security/headers.ts';

export interface CaddyfileOptions {
  readonly domain: string;
  /** Test mode: Caddy's internal CA instead of Let's Encrypt (SPEC 16.2). */
  readonly testMode: boolean;
  readonly webRoot: string;
  readonly adminRoot: string;
  /** v0.8: the bots control centre (bots.<domain>). */
  readonly botsRoot: string;
  readonly localDir: string;
  readonly userPort: number;
  readonly adminPort: number;
  readonly botsPort: number;
  /**
   * v0.9: www.<domain> answers with a permanent redirect (308) to <domain> – only when the
   * scripts found a www record pointing to this server (or in test mode).
   */
  readonly www?: boolean;
  /**
   * v0.9: the onion service (SPEC 16.5). Its site runs on plain http on a loopback listener that
   * only the local Tor service reaches (Tor encrypts the transport), with the API on the Tor
   * listener of the backend. `active`: Tor is switched on – only then does the clearnet site
   * announce the address to the Tor Browser (Onion-Location).
   */
  readonly onion?:
    | {
        readonly host: string;
        readonly listenPort: number;
        readonly apiPort: number;
        readonly active: boolean;
      }
    | undefined;
}

const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PATH_PATTERN = /^\/[A-Za-z0-9._/-]+$/;
const ONION_PATTERN = /^[a-z2-7]{56}\.onion$/;

function quote(value: string): string {
  if (/["\\\n\r]/.test(value)) throw new Error('invalid header value');
  return `"${value}"`;
}

function headerBlock(headers: Record<string, string>, indent: string): string {
  return Object.entries(headers)
    .map(([name, value]) => `${indent}${name} ${quote(value)}`)
    .join('\n');
}

interface SiteOptions {
  /** Site address as Caddy expects it (host, or scheme://host:port). */
  readonly address: string;
  readonly root: string;
  readonly port: number;
  readonly extraImport?: string | undefined;
  /** HTTPS site (HSTS); false only for the onion site. */
  readonly https: boolean;
  /** Extra lines right after the address (tls, bind). */
  readonly preamble?: string;
  /** Extra headers on the pages of the app (v0.9: Onion-Location). */
  readonly pageHeaders?: Record<string, string>;
}

function site(options: SiteOptions): string {
  const imports = options.extraImport ? `\timport ${options.extraImport}\n` : '';
  const pageHeaders = {
    'Content-Security-Policy': appHeaders({ hsts: options.https })['Content-Security-Policy'] ?? '',
    ...options.pageHeaders,
  };
  return `${options.address} {
${options.preamble ?? ''}${imports}	encode zstd gzip

	header {
		-Server
${headerBlock(commonHeaders({ hsts: options.https }), '\t\t')}
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:${options.port}
	}

	handle {
		root * ${options.root}
		header {
${headerBlock(pageHeaders, '\t\t\t')}
		}
		@immutable path /assets/*
		header @immutable Cache-Control ${quote(CACHE_IMMUTABLE)}
		@revalidate not path /assets/*
		header @revalidate Cache-Control ${quote(CACHE_REVALIDATE)}
		try_files {path} /index.html
		file_server
	}
}
`;
}

/**
 * Generates the Caddyfile (SPEC 16.2): all three hosts (v0.8: bots.<domain>), automatic HTTPS, no access log, error log
 * without IP addresses or headers (SPEC 2.2), security headers from the shared definition.
 * v0.9: www.<domain> as a redirect, the onion site on a loopback listener and the Onion-Location
 * header for the Tor Browser (SPEC 16.5).
 * Local adjustments live in `localDir` and are only imported, never written (SPEC 16.3).
 */
export function generateCaddyfile(options: CaddyfileOptions): string {
  if (!DOMAIN_PATTERN.test(options.domain)) throw new Error('invalid domain');
  for (const p of [options.webRoot, options.adminRoot, options.botsRoot, options.localDir]) {
    if (!PATH_PATTERN.test(p)) throw new Error(`invalid path: ${p}`);
  }
  const onion = options.onion;
  if (onion && !ONION_PATTERN.test(onion.host)) throw new Error('invalid onion address');
  const tls = options.testMode ? '\ttls internal\n' : '';
  const global = `# Erzeugt von posteulen-cli caddyfile. Nicht von Hand ändern:
# Eigene Anpassungen gehören nach ${options.localDir}/*.caddy (werden nie überschrieben).
{
${options.testMode ? '\tlocal_certs\n' : ''}	log default {
		output stderr
		exclude http.log.access http.stdlib
		format filter {
			wrap console
			request>remote_ip delete
			request>remote_port delete
			request>client_ip delete
			request>headers delete
			request>tls delete
			msg regexp "(\\d{1,3}\\.){3}\\d{1,3}|[0-9a-fA-F]{0,4}(:[0-9a-fA-F]{0,4}){2,7}" "[entfernt]"
		}
	}
}

import ${options.localDir}/global-*.caddy
`;
  const sites = [
    global,
    site({
      address: options.domain,
      root: options.webRoot,
      port: options.userPort,
      https: true,
      preamble: tls,
      // v0.9: the Tor Browser offers the onion address („.onion verfügbar“) – only while Tor is on.
      ...(onion?.active ? { pageHeaders: { 'Onion-Location': `http://${onion.host}{uri}` } } : {}),
    }),
  ];
  if (options.www) {
    sites.push(`www.${options.domain} {
${tls}	header {
		-Server
${headerBlock(commonHeaders({ hsts: true }), '\t\t')}
	}
	redir https://${options.domain}{uri} 308
}
`);
  }
  sites.push(
    site({
      address: `admin.${options.domain}`,
      root: options.adminRoot,
      port: options.adminPort,
      https: true,
      preamble: tls,
      extraImport: `${options.localDir}/admin-*.caddy`,
    }),
    site({
      address: `bots.${options.domain}`,
      root: options.botsRoot,
      port: options.botsPort,
      https: true,
      preamble: tls,
      extraImport: `${options.localDir}/bots-*.caddy`,
    }),
  );
  if (onion) {
    // Plain http on loopback only: Tor itself encrypts and authenticates the connection to the
    // onion address. No HSTS, no certificate, no Onion-Location.
    sites.push(
      site({
        address: `http://${onion.host}:${onion.listenPort}`,
        root: options.webRoot,
        port: onion.apiPort,
        https: false,
        preamble: '\tbind 127.0.0.1\n',
      }),
    );
  }
  return sites.join('\n');
}
