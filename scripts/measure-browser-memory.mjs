/**
 * Local-only Chromium/Firefox process-memory sampler.
 *
 * Launch with `npm run build && npm run preview` in another terminal.
 * Run `node scripts/measure-browser-memory.mjs` after Playwright browsers are installed.
 * No input files, traces, or telemetry leave this machine.
 */
import { chromium, firefox, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { setInterval as every } from 'node:timers';

const baseURL = process.env.ASTRALYS_BASE_URL ?? 'http://127.0.0.1:4173';
const previewURL = new URL(baseURL);
if (previewURL.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(previewURL.hostname) || previewURL.username || previewURL.password) {
  throw new Error('ASTRALYS_BASE_URL must be an HTTP loopback preview; remote workloads are not allowed.');
}
const iterations = Number(process.env.ASTRALYS_MEMORY_RUNS ?? 5);
const sampleIntervalMs = 100;
const browserNames = (process.env.ASTRALYS_MEMORY_BROWSERS ?? 'chromium,firefox').split(',').map(x => x.trim());
if (browserNames.length === 0 || browserNames.some(x => !['chromium', 'firefox'].includes(x))) {
  throw new Error('ASTRALYS_MEMORY_BROWSERS must contain chromium and/or firefox');
}
if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 30) {
  throw new Error('ASTRALYS_MEMORY_RUNS must be an integer between 1 and 30');
}
if (process.platform !== 'linux') {
  throw new Error('Process RSS sampling currently requires Linux /proc; do not interpret heap-only results as RSS.');
}

function findBrowserRoot(browserName, beforePids) {
  const candidates = readdirSync('/proc').filter(x => /^\d+$/.test(x)).map(Number).filter(pid => !beforePids.has(pid));
  const matches = candidates.filter(pid => {
    try {
      const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ');
      return browserName === 'chromium' ? /chrome-headless-shell|chrome-linux/.test(command) && /--remote-debugging-pipe/.test(command) : /firefox/.test(command) && /-juggler-pipe/.test(command);
    } catch { return false; }
  });
  if (matches.length !== 1) throw new Error(`Expected exactly one new ${browserName} browser process, found ${matches.length}`);
  return matches[0];
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
    const data = readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = data.match(/^VmRSS:\s+(\d+) kB$/m);
    return match ? Number(match[1]) * 1024 : 0;
  } catch {
    return 0; // Process exited between discovery and sampling.
  }
}

function totalRss(root) {
  return [...descendants(root)].reduce((sum, pid) => sum + rssBytes(pid), 0);
}

function sampleProcessTree(pid) {
  let peak = 0;
  let samples = 0;
  const collect = () => { peak = Math.max(peak, totalRss(pid)); samples++; };
  collect();
  const timer = every(collect, sampleIntervalMs);
  return {stop() { clearInterval(timer); collect(); return {peakRssBytes: peak, samples, intervalMs: sampleIntervalMs}; }};
}

const results = [];
for (const browserName of browserNames) {
for (let run = 1; run <= iterations; run++) {
  const beforePids = new Set(readdirSync('/proc').filter(x => /^\d+$/.test(x)).map(Number));
  const browser = await ({chromium, firefox})[browserName].launch({ headless: true });
  let sampling;
  try {
    const browserPid = findBrowserRoot(browserName, beforePids);
    const page = await browser.newPage();
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      const tracker = { active: 0, started: 0, maxConcurrent: 0, created: 0, revoked: 0, live: new Set() };
      window.Worker = class extends NativeWorker {
        released = false;
        constructor(...args) { super(...args); tracker.active++; tracker.started++; tracker.maxConcurrent = Math.max(tracker.maxConcurrent, tracker.active); }
        terminate() { if (!this.released) { this.released = true; tracker.active--; } super.terminate(); }
      };
      URL.createObjectURL = value => { const url = create(value); tracker.created++; tracker.live.add(url); return url; };
      URL.revokeObjectURL = url => { tracker.revoked++; tracker.live.delete(url); revoke(url); };
      window.__memoryResources = tracker;
    });
    const resources = () => page.evaluate(() => {
      const t = window.__memoryResources;
      return { active: t.active, started: t.started, maxConcurrent: t.maxConcurrent, created: t.created, revoked: t.revoked, live: t.live.size };
    });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const baseline = totalRss(browserPid);
    const started = performance.now();
    sampling = sampleProcessTree(browserPid);
    const fixture = await page.evaluate(async () => {
      const image = document.createElement('canvas');
      image.width = 2048;
      image.height = 2048;
      const context = image.getContext('2d');
      if (!context) throw new Error('2D canvas unavailable');
      context.fillStyle = '#356ac7';
      context.fillRect(0, 0, image.width, image.height);
      const blob = await new Promise(resolve => image.toBlob(resolve, 'image/png'));
      if (!blob || blob.size === 0) throw new Error('PNG fixture encode failed');
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page.locator('#file-input').setInputFiles({name:'memory-fixture.png',mimeType:'image/png',buffer:Buffer.from(fixture)});
    await page.locator('#workspace').waitFor({state:'visible'});
    await expect(page.locator('#cancel')).toBeHidden();
    await page.locator('#width').fill('1024');
    const repeatedExports = [];
    for (let exportNumber = 1; exportNumber <= 20; exportNumber++) {
      const previous = await page.locator('#download').getAttribute('href');
      await page.getByRole('button',{name:'Create image',exact:true}).click();
      await expect(page.locator('#download')).toBeVisible();
      await expect(page.locator('#download')).not.toHaveAttribute('href', previous ?? '');
      await expect(page.locator('#cancel')).toBeHidden();
      const state = await resources();
      assert.equal(state.active, 0, 'Export must terminate its worker');
      assert.equal(state.live, 3, 'Only original preview, current preview and output URLs may remain');
      repeatedExports.push({ exportNumber, rssBytes: totalRss(browserPid), resources: state });
    }
    await page.getByRole('button',{name:'Create PDF',exact:true}).click();
    await page.getByRole('link',{name:'Download PDF'}).waitFor({state:'visible'});
    const afterExport = totalRss(browserPid);
    const pages = Array.from({length: 8}, (_, i) => ({name: `page-${i+1}.png`, mimeType: 'image/png', buffer: Buffer.from(fixture)}));
    await page.getByRole('button',{name:'Clear file'}).click();
    const afterSingleClear = await resources();
    assert.equal(afterSingleClear.active, 0); assert.equal(afterSingleClear.live, 0);
    await page.locator('#batch-files').setInputFiles(pages);
    await page.locator('#batch-size').selectOption('long-1200');
    await page.locator('#batch-start').click();
    await expect(page.locator('#batch-status')).toContainText('8 ready, 0 failed', {timeout: 120_000});
    const batchResources = await resources();
    assert.equal(batchResources.active, 0); assert.equal(batchResources.live, 8);
    const afterBatch = totalRss(browserPid);
    await page.locator('#batch-clear').click();
    const batchCleared = await resources();
    assert.equal(batchCleared.active, 0); assert.equal(batchCleared.live, 0);
    const afterBatchClear = totalRss(browserPid);
    await page.locator('#pdf-page-files').setInputFiles(pages);
    await page.locator('#pdf-compose').click();
    await page.locator('#pdf-download').waitFor({state:'visible', timeout: 120_000});
    const afterMultipagePdf = totalRss(browserPid);
    await page.locator('#pdf-clear').click();
    await page.locator('#pdf-result').waitFor({state:'hidden'});
    await page.locator('#pdf-page-files').setInputFiles(pages);
    // Dispatch start + cancel in the same task. The async worker cannot finish
    // before cancellation; no arbitrary sleep or race with a fast fixture.
    await page.evaluate(() => {
      document.querySelector('#pdf-compose').click();
      const cancel = document.querySelector('#pdf-cancel');
      if (cancel.hidden) throw new Error('PDF job did not enter a cancellable state');
      cancel.click();
    });
    await expect(page.locator('#pdf-status')).toContainText('PDF composition cancelled');
    await page.locator('#pdf-cancel').waitFor({state:'hidden'});
    await page.locator('#pdf-result').waitFor({state:'hidden'});
    const cancelled = await resources();
    assert.equal(cancelled.active, 0); assert.equal(cancelled.live, 0);
    const afterCancellation = totalRss(browserPid);
    await page.locator('#pdf-page-files').setInputFiles(pages);
    await page.locator('#pdf-compose').click();
    await page.locator('#pdf-download').waitFor({state:'visible',timeout:120_000});
    const afterCancellationRecovery = totalRss(browserPid);
    await page.locator('#pdf-clear').click();
    await page.locator('#workspace').waitFor({state:'hidden'});
    const cleared = await resources();
    assert.equal(cleared.active, 0); assert.equal(cleared.live, 0);
    assert.equal(cleared.created, cleared.revoked);
    assert.equal(cleared.maxConcurrent, 1, 'These workloads must remain sequential');
    const afterClear = totalRss(browserPid);
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = totalRss(browserPid);
    const sampled = sampling.stop();
    sampling = undefined;
    results.push({
      run, browserName, browserVersion: browser.version(), baselineRssBytes: baseline, ...sampled,
      fixture: { width: 2048, height: 2048, encodedBytes: fixture.length, synthetic: true },
      repeatedExports, afterBatchRssBytes: afterBatch, afterBatchClearRssBytes: afterBatchClear,
      lifecycle: { afterSingleClear, batchResources, batchCleared, cancelled, cleared },
      afterExportRssBytes: afterExport, afterMultipagePdfRssBytes: afterMultipagePdf, afterCancellationRssBytes: afterCancellation, afterCancellationRecoveryRssBytes: afterCancellationRecovery, afterClearRssBytes: afterClear, afterReloadRssBytes: afterReload,
      elapsedMs: Math.round(performance.now() - started),
      note: '20 sequential image exports, single PDF, eight-image batch, eight-page PDF, immediate cancellation and recovery. Resource counts are observable page objects; summed process RSS double-counts shared pages and is not a hard memory ceiling or leak proof.'
    });
  } finally {
    sampling?.stop();
    await browser.close();
  }
}
}
console.log(JSON.stringify({ commit: process.env.GITHUB_SHA ?? 'local', platform: process.platform, results }, null, 2));
