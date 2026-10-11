/**
 * Local-only Chromium process-memory sampler.
 *
 * Launch with `npm run build && npm run preview` in another terminal.
 * Run `node scripts/measure-browser-memory.mjs` after Playwright browsers are installed.
 * No input files, traces, or telemetry leave this machine.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const baseURL = process.env.ASTRALYS_BASE_URL ?? 'http://127.0.0.1:4173';
const iterations = Number(process.env.ASTRALYS_MEMORY_RUNS ?? 5);
if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 30) {
  throw new Error('ASTRALYS_MEMORY_RUNS must be an integer between 1 and 30');
}
if (process.platform !== 'linux') {
  throw new Error('Process RSS sampling currently requires Linux /proc; do not interpret heap-only results as RSS.');
}

function descendants(root) {
  const output = new Set([root]);
  const rows = execFileSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' }).trim().split('\n');
  const pairs = rows.map(line => line.trim().split(/\s+/).map(Number));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of pairs) {
      if (output.has(parent) && !output.has(pid)) {
        output.add(pid);
        changed = true;
      }
    }
  }
  return output;
}

function rssBytes(pid) {
  try {
    const data = execFileSync('cat', [`/proc/${pid}/status`], { encoding: 'utf8' });
    const match = data.match(/^VmRSS:\s+(\d+) kB$/m);
    return match ? Number(match[1]) * 1024 : 0;
  } catch {
    return 0; // Process exited between discovery and sampling.
  }
}

function totalRss(root) {
  return [...descendants(root)].reduce((sum, pid) => sum + rssBytes(pid), 0);
}

const results = [];
for (let run = 1; run <= iterations; run++) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const baseline = totalRss(browser.process().pid);
    const started = performance.now();
    await page.evaluate(async () => {
      const image = document.createElement('canvas');
      image.width = 2048;
      image.height = 2048;
      const context = image.getContext('2d');
      if (!context) throw new Error('2D canvas unavailable');
      context.fillRect(0, 0, image.width, image.height);
      const blob = await new Promise(resolve => image.toBlob(resolve, 'image/png'));
      if (!blob || blob.size === 0) throw new Error('PNG encode failed');
    });
    const afterCanvas = totalRss(browser.process().pid);
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = totalRss(browser.process().pid);
    results.push({
      run, browser: browser.version(), baselineRssBytes: baseline,
      afterCanvasRssBytes: afterCanvas, afterReloadRssBytes: afterReload,
      elapsedMs: Math.round(performance.now() - started),
      note: 'Synthetic browser canvas baseline; NOT an Astralys app export or peak RSS.'
    });
  } finally {
    await browser.close();
  }
}
console.log(JSON.stringify({ commit: process.env.GITHUB_SHA ?? 'local', platform: process.platform, results }, null, 2));
