import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Static host policy is checked without contacting Cloudflare or deploying.
const server = readFileSync(new URL('../scripts/serve.mjs', import.meta.url), 'utf8');
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const wrangler = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8');

function policy(name: string): string {
 const line = headers.split(/\r?\n/).find(line => line.trimStart().startsWith(name + ':'));
 expect(line, 'missing host header ' + name).toBeDefined();
 return line!.trim().slice(name.length + 1).trim();
}

describe('Cloudflare static preview contract', () => {
 it('requires a static-only distribution without backend bindings', () => {
  expect(wrangler).toMatch(/^\[assets\]$/m);
  expect(wrangler).toMatch(/^directory = "\.\/dist"$/m);
  expect(wrangler).not.toMatch(/^\s*(main|route|routes|account_id|workers_dev|run_worker_first)\s*=/m);
  expect(wrangler).not.toMatch(/\[(?:vars|env\.|durable_objects|r2_buckets|kv_namespaces|d1_databases)/);
 });
 it('does not allow remote connections, framing, or inline scripts', () => {
  const csp = policy('Content-Security-Policy');
  for (const directive of ["default-src 'none'", "script-src 'self'", "worker-src 'self'", "connect-src 'none'", "frame-ancestors 'none'"]) {
   expect(csp).toContain(directive);
  }
  expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:\/\//);
 });
 it('mirrors security policy in local production preview and disallows exposing _headers', () => {
  for (const name of ['X-Content-Type-Options','Referrer-Policy','Permissions-Policy','Cross-Origin-Opener-Policy']) {
   expect(policy(name)).not.toBe('');
   expect(server).toContain("'" + name + "'");
  }
  expect(server).toContain("path==='/_headers'");
  expect(server).toContain("['GET','HEAD']");
 });
});
