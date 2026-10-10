import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const command = fileURLToPath(new URL('../scripts/rea-inspect.mjs', import.meta.url));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'astralys-rea-test-'));
  mkdirSync(join(root, 'dist', 'assets'), {recursive: true});
  writeFileSync(join(root, 'package.json'), JSON.stringify({name:'astralys'}));
  writeFileSync(join(root, 'dist', 'index.html'), '<title>Astralys</title>');
  writeFileSync(join(root, 'dist', 'assets', 'app.js'), 'console.log("fixture")');
  const capture = join(root, 'rea-args.json');
  const fakeBin = join(root, 'rea-mock');
  writeFileSync(fakeBin,
    '#!/usr/bin/env node\n' +
    'require("node:fs").writeFileSync(process.env.ASTRALYS_REA_CAPTURE,JSON.stringify(process.argv.slice(2)))\n');
  chmodSync(fakeBin, 0o700);
  const env = {...process.env, ASTRALYS_REA_BIN:fakeBin, ASTRALYS_REA_CAPTURE:capture};
  const run = (...args: string[]) => spawnSync(process.execPath, [command,...args], {
    cwd:root,env,encoding:'utf8',timeout:5000
  });
  return {root,capture,run};
}

it('requires explicit consent and never starts a REA process implicitly', () => {
  const f=fixture();
  try {
    const result=f.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Opt-in required');
    expect(()=>readFileSync(f.capture)).toThrow();
  } finally {rmSync(f.root,{force:true,recursive:true});}
});

it('inspects only the known local built directory with no shell and no installer', () => {
  const f=fixture();
  try {
    const result=f.run('--accept-static-analysis');
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(f.capture,'utf8'))).toEqual([
      'analyze-javascript-application',resolve(f.root,'dist'),'--json'
    ]);
    expect(result.stderr).toContain('source and application structure');
  } finally {rmSync(f.root,{force:true,recursive:true});}
});

it('rejects missing build artifacts and symlinked dist directories before running REA', () => {
  const f=fixture();
  try {
    rmSync(join(f.root,'dist'),{recursive:true,force:true});
    let result=f.run('--accept-static-analysis');
    expect(result.status).toBe(1);
    expect(()=>readFileSync(f.capture)).toThrow();
    const outside=mkdtempSync(join(tmpdir(),'astralys-rea-outside-'));
    try {
      mkdirSync(join(outside,'assets'));
      writeFileSync(join(outside,'index.html'),'fixture');
      writeFileSync(join(outside,'assets','app.js'),'fixture');
      symlinkSync(outside,join(f.root,'dist'),'dir');
      result=f.run('--accept-static-analysis');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('dist must be a real directory');
      expect(()=>readFileSync(f.capture)).toThrow();
    } finally {rmSync(outside,{force:true,recursive:true});}
  } finally {rmSync(f.root,{force:true,recursive:true});}
});

it('refuses to inspect another project root', () => {
  const f=fixture();
  try {
    writeFileSync(join(f.root,'package.json'),JSON.stringify({name:'unrelated'}));
    const result=f.run('--accept-static-analysis');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Astralys repository root');
    expect(()=>readFileSync(f.capture)).toThrow();
  } finally {rmSync(f.root,{force:true,recursive:true});}
});
