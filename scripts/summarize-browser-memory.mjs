/** Summarize local, synthetic browser-process RSS trials without uploading data.
 * Usage: node scripts/summarize-browser-memory.mjs /path/to/astralys-memory.json
 * This is descriptive evidence, not a memory-limit or leak-freedom test.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fields = [
  'baselineRssBytes', 'peakRssBytes', 'afterClearRssBytes',
  'afterReloadRssBytes', 'elapsedMs', 'samples',
];

function summary(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    maximum: sorted.at(-1),
  };
}

export function summarizeBrowserMemory(input) {
  if (!input || !Array.isArray(input.results) || input.results.length === 0) {
    throw new Error('Expected a nonempty results array from the Astralys memory sampler');
  }
  const groups = new Map();
  for (const [index, row] of input.results.entries()) {
    if (!row || !['chromium', 'firefox'].includes(row.browserName) ||
        typeof row.browserVersion !== 'string' || !row.browserVersion ||
        !Number.isSafeInteger(row.run) || row.run < 1) {
      throw new Error(`Invalid browser identity or run number at results[${index}]`);
    }
    for (const field of fields) {
      if (!Number.isSafeInteger(row[field]) || row[field] < 0) {
        throw new Error(`Invalid ${field} at results[${index}]`);
      }
    }
    const key = `${row.browserName}\0${row.browserVersion}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const browsers = [...groups.entries()].map(([key, rows]) => {
    const [browserName, browserVersion] = key.split('\0');
    const metrics = Object.fromEntries(fields.map(field => [field, summary(rows.map(row => row[field]))]));
    const deltas = {
      peakMinusBaselineRssBytes: summary(rows.map(row => row.peakRssBytes - row.baselineRssBytes)),
      afterClearMinusBaselineRssBytes: summary(rows.map(row => row.afterClearRssBytes - row.baselineRssBytes)),
      afterReloadMinusBaselineRssBytes: summary(rows.map(row => row.afterReloadRssBytes - row.baselineRssBytes)),
    };
    return {
      browserName, browserVersion, trials: rows.length,
      sufficientForFiveTrialReview: rows.length >= 5 && new Set(rows.map(row => row.run)).size >= 5,
      metrics, deltas,
    };
  });
  return {
    commit: typeof input.commit === 'string' ? input.commit : 'unknown',
    platform: typeof input.platform === 'string' ? input.platform : 'unknown',
    browsers,
    interpretation: 'Process-tree RSS can double-count shared pages. Sampled peaks miss spikes; browser caches and GC affect after-clear values. Five trials permit descriptive comparison only, not proof of leak freedom or a memory cap.',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/summarize-browser-memory.mjs /path/to/astralys-memory.json');
    const evidence = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(summarizeBrowserMemory(evidence), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
