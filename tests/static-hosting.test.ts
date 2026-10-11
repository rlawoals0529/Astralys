import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Cloudflare static-host readiness',()=>{
 const wrangler=readFileSync('wrangler.toml','utf8');
 const headers=readFileSync('public/_headers','utf8');
 it('ships a static-only Wrangler configuration with no server or deployment credentials',()=>{
  expect(wrangler).toMatch(/^name = "astralys"$/m);
  expect(wrangler).toMatch(/^directory = "\.\/dist"$/m);
  expect(wrangler).not.toMatch(/^\s*(main|route|routes|account_id|workers_dev|run_worker_first)\s*=/m);
  expect(wrangler).not.toMatch(/\[vars\]|\[env\.|\[triggers\]|\[durable_objects/);
 });
 it('retains strict static response headers instead of depending on Worker runtime',()=>{
  expect(headers).toContain("Content-Security-Policy: default-src 'none'");
  expect(headers).toContain("worker-src 'self'");
  expect(headers).toContain("connect-src 'none'");
  expect(headers).toContain("frame-ancestors 'none'");
  expect(headers).toContain('X-Content-Type-Options: nosniff');
  expect(headers).toContain('Referrer-Policy: no-referrer');
  expect(headers).toContain('Cross-Origin-Opener-Policy: same-origin');
 });
});
