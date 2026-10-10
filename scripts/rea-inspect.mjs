#!/usr/bin/env node
/**
 * Optional developer-only bridge to the separately installed REA CLI.
 * Never called by build, CI, production browser code or npm lifecycle hooks.
 */
import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

function fail(message) {
  console.error('Astralys REA: ' + message);
  process.exitCode = 1;
}

if (process.argv.length !== 3 || process.argv[2] !== '--accept-static-analysis') {
  fail('Opt-in required. After reviewing docs/development/REFERENCE_TOOLS.md, run npm run dev:rea -- --accept-static-analysis. No installation or analysis has occurred.');
} else {
  const root = process.cwd();
  const target = resolve(root, 'dist');
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    if (pkg.name !== 'astralys') throw new Error('Run this command from the Astralys repository root.');
    if (!lstatSync(target).isDirectory()) throw new Error('dist must be a real directory, not a symlink.');
    if (!lstatSync(join(target, 'index.html')).isFile()) throw new Error('Missing dist/index.html.');
    const assets = join(target, 'assets');
    if (!lstatSync(assets).isDirectory()) throw new Error('Missing regular dist/assets directory.');
    if (!readdirSync(assets).some(name => name.endsWith('.js') && lstatSync(join(assets, name)).isFile())) {
      throw new Error('No built JavaScript found in dist/assets.');
    }
    const executable = process.env.ASTRALYS_REA_BIN || 'rea';
    console.error('Astralys REA: analyzing only this local production build using a separately installed REA CLI.');
    console.error('Evidence can include source and application structure. Do not share the raw output publicly.');
    const result = spawnSync(executable, ['analyze-javascript-application', target, '--json'], {
      cwd: root, stdio: 'inherit', shell: false, timeout: 120_000
    });
    if (result.error) {
      throw new Error(result.error.code === 'ENOENT'
        ? 'REA is not installed. Review its upstream package before optionally installing a pinned version. No auto-install performed.'
        : 'REA failed to launch: ' + result.error.message);
    }
    if (result.signal) throw new Error('REA ended with signal ' + result.signal + ' (or reached the 120-second limit).');
    if (result.status !== 0) throw new Error('REA returned exit status ' + result.status + '. Review the CLI diagnostics.');
  } catch (error) {
    fail(error instanceof Error ? error.message : 'Unable to inspect the local build.');
  }
}
