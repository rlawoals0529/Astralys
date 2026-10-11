import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const headers=readFileSync(new URL('../public/_headers',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

describe('static-host security contract',()=>{
 test('response headers protect every static asset including compiled image workers',()=>{
   expect(headers).toMatch(/^\/\*$/m);
   for(const [header,pattern] of [
     ['Content-Security-Policy',/default-src 'none';.*img-src 'self' blob:;.*worker-src 'self';.*connect-src 'none'/],
     ['X-Content-Type-Options',/nosniff/],
     ['Referrer-Policy',/no-referrer/],
     ['Permissions-Policy',/camera=\(\), microphone=\(\), geolocation=\(\)/],
     ['Cross-Origin-Opener-Policy',/same-origin/]
   ] as const){
     const line=headers.split('\n').find(line=>line.trim().startsWith(header+':'));
     expect(line,header).toBeDefined();
     expect(line).toMatch(pattern);
   }
   expect(headers).not.toMatch(/unsafe-inline|unsafe-eval|connect-src\s+\*/);
 });
 test('document CSP keeps scripts local and does not permit remote file processing',()=>{
   expect(html).toContain('http-equiv="Content-Security-Policy"');
   expect(html).toContain("worker-src 'self'");
   expect(html).toContain("default-src 'none'");
   expect(html).toContain("img-src 'self' blob:");
   expect(html).not.toContain("unsafe-eval");
 });
});
