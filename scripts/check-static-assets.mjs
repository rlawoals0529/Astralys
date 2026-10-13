// Validate the production bundle before anybody considers static hosting.
// Does not invoke Wrangler, talk to Cloudflare, or deploy anything.
import assert from 'node:assert/strict';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
const root=resolve('dist');
const real=await realpath(root);
assert.equal(real,root,'dist must not be a symlink');
const config=await readFile('wrangler.toml','utf8');
assert.match(config,/^name\s*=\s*"astralys"\s*$/m);
assert.match(config,/^directory\s*=\s*"\.\/dist"\s*$/m);
assert.match(config,/^previews\s*=\s*\{\s*\}\s*$/m,'Static previews must inherit settings without extra resources');
assert.doesNotMatch(config,/^\s*(main|route|routes|account_id|workers_dev|run_worker_first)\s*=/m,'No Worker code, account binding or live route permitted');
const index=await readFile(join(root,'index.html'),'utf8');
assert.match(index,/id="main"/);
assert.match(index,/assets\/[^"' ]+\.js/);
assert.doesNotMatch(index,/(?:<script[^>]*src=["']\/src\/|__VITE_API_TOKEN__)/,'No source development entry or secret placeholders');
const headers=await readFile(join(root,'_headers'),'utf8');
const policy=headers.split('\n').find(line=>line.includes('Content-Security-Policy:'));
assert(policy,'Static host must ship response CSP');
for(const part of ["default-src 'none'","script-src 'self'","worker-src 'self'","connect-src 'none'","frame-ancestors 'none'"]) assert(policy.includes(part),'Missing CSP directive: '+part);
for(const line of ['X-Content-Type-Options: nosniff','Referrer-Policy: no-referrer','Cross-Origin-Opener-Policy: same-origin'])assert(headers.includes(line),'Missing security header '+line);
let bytes=0,js=0,files=0;
async function walk(folder) {
 for(const entry of await readdir(folder,{withFileTypes:true})) {
  const path=join(folder,entry.name);
  const stat=await lstat(path);
  assert(!stat.isSymbolicLink(),'No symlinks may be published in dist');
  if(entry.isDirectory()){await walk(path);continue;}
  assert(entry.isFile(),'Unexpected non-file distribution entry');
  const local=path.slice(root.length+sep.length);
  assert(!/(^|\/)(?:\.env(?:\.|$)|\.git|node_modules|\.npmrc|wrangler\.toml|AGENTS\.md|Cargo\.lock|package-lock\.json)(?:\/|$)/.test(local),'Private/development artifact found: '+local);
  assert(!/\.(?:map|pem|key|db|sqlite)$/i.test(local),'Disallowed public asset: '+local);
  files++;bytes+=stat.size;if(local.endsWith('.js'))js++;
 }
}
await walk(root);
assert(js>=2,'Expected separate bundled UI and image-worker JavaScript assets');
assert(files<=50,'Unexpectedly large static file count');
assert(bytes<10*1024*1024,'Unexpectedly large static upload');
console.log(`Verified static-host bundle: ${files} files, ${bytes} bytes, ${js} JS assets; headers + CSP present. No deployment performed.`);
