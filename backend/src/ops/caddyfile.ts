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
  readonly localDir: string;
  readonly userPort: number;
  readonly adminPort: number;
}

const DOMAIN_PATTERN = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const PATH_PATTERN = /^\/[A-Za-z0-9._/-]+$/;

function quote(value: string): string {
  if (/["\\\n\r]/.test(value)) throw new Error('invalid header value');
  return `"${value}"`;
}

function headerBlock(headers: Record<string, string>, indent: string): string {
  return Object.entries(headers)
    .map(([name, value]) => `${indent}${name} ${quote(value)}`)
    .join('\n');
}

function site(
  host: string,
  root: string,
  port: number,
  options: CaddyfileOptions,
  extraImport: string | undefined,
): string {
  const tls = options.testMode ? '\ttls internal\n' : '';
  const imports = extraImport ? `\timport ${extraImport}\n` : '';
  return `${host} {
${tls}${imports}	encode zstd gzip

	header {
		-Server
${headerBlock(commonHeaders({ hsts: true }), '\t\t')}
	}

	handle /api/* {
		reverse_proxy 127.0.0.1:${port}
	}

	handle {
		root * ${root}
		header {
${headerBlock({ 'Content-Security-Policy': appHeaders({ hsts: true })['Content-Security-Policy'] ?? '' }, '\t\t\t')}
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
 * Generates the Caddyfile (SPEC 16.2): both hosts, automatic HTTPS, no access log, error log
 * without IP addresses or headers (SPEC 2.2), security headers from the shared definition.
 * Local adjustments live in `localDir` and are only imported, never written (SPEC 16.3).
 */
export function generateCaddyfile(options: CaddyfileOptions): string {
  if (!DOMAIN_PATTERN.test(options.domain)) throw new Error('invalid domain');
  for (const p of [options.webRoot, options.adminRoot, options.localDir]) {
    if (!PATH_PATTERN.test(p)) throw new Error(`invalid path: ${p}`);
  }
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
  return [
    global,
    site(options.domain, options.webRoot, options.userPort, options, undefined),
    site(
      `admin.${options.domain}`,
      options.adminRoot,
      options.adminPort,
      options,
      `${options.localDir}/admin-*.caddy`,
    ),
  ].join('\n');
}
