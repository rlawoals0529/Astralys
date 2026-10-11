/**
 * Local-only Chromium/Firefox process-memory sampler.
 *
 * Launch with `npm run build && npm run preview` in another terminal.
 * Run `node scripts/measure-browser-memory.mjs` after Playwright browsers are installed.
 * No input files, traces, or telemetry leave this machine.
 */
import { chromium, firefox } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setInterval as every } from 'node:timers';

const baseURL = process.env.ASTRALYS_BASE_URL ?? 'http://127.0.0.1:4173';
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
  const browser = await ({chromium, firefox})[browserName].launch({ headless: true });
  let sampling;
  try {
    const page = await browser.newPage();
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const baseline = totalRss(browser.process().pid);
    const started = performance.now();
    sampling = sampleProcessTree(browser.process().pid);
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
    await page.locator('#width').fill('1024');
    await page.getByRole('button',{name:'Create image'}).click();
    await page.locator('#download').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Create PDF',exact:true}).click();
    await page.getByRole('link',{name:'Download PDF'}).waitFor({state:'visible'});
    const afterExport = totalRss(browser.process().pid);
    const pages = Array.from({length: 8}, (_, i) => ({name: `page-${i+1}.png`, mimeType: 'image/png', buffer: Buffer.from(fixture)}));
    await page.locator('#pdf-page-files').setInputFiles(pages);
    await page.locator('#pdf-compose').click();
    await page.locator('#pdf-download').waitFor({state:'visible', timeout: 120_000});
    const afterMultipagePdf = totalRss(browser.process().pid);
    await page.locator('#pdf-clear').click();
    await page.locator('#pdf-result').waitFor({state:'hidden'});
    await page.locator('#pdf-page-files').setInputFiles(pages);
    await page.locator('#pdf-compose').click();
    await page.locator('#pdf-cancel').waitFor({state:'visible'});
    await page.locator('#pdf-cancel').click();
    await page.locator('#pdf-cancel').waitFor({state:'hidden'});
    await page.locator('#pdf-result').waitFor({state:'hidden'});
    const afterCancellation = totalRss(browser.process().pid);
    await page.locator('#pdf-page-files').setInputFiles(pages);
    await page.locator('#pdf-compose').click();
    await page.locator('#pdf-download').waitFor({state:'visible',timeout:120_000});
    const afterCancellationRecovery = totalRss(browser.process().pid);
    await page.locator('#pdf-clear').click();
    await page.getByRole('button',{name:'Clear file'}).click();
    await page.locator('#workspace').waitFor({state:'hidden'});
    const afterClear = totalRss(browser.process().pid);
    await page.reload({ waitUntil: 'networkidle' });
    const afterReload = totalRss(browser.process().pid);
    const sampled = sampling.stop();
    sampling = undefined;
    results.push({
      run, browserName, browserVersion: browser.version(), baselineRssBytes: baseline, ...sampled,
      afterExportRssBytes: afterExport, afterMultipagePdfRssBytes: afterMultipagePdf, afterCancellationRssBytes: afterCancellation, afterCancellationRecoveryRssBytes: afterCancellationRecovery, afterClearRssBytes: afterClear, afterReloadRssBytes: afterReload,
      elapsedMs: Math.round(performance.now() - started),
      note: 'Local image, PDF, eight-page PDF and PDF cancellation attempt (may race completion); sampled peak is not a hard memory ceiling.'
    });
  } finally {
    sampling?.stop();
    await browser.close();
  }
}
}
console.log(JSON.stringify({ commit: process.env.GITHUB_SHA ?? 'local', platform: process.platform, results }, null, 2));
