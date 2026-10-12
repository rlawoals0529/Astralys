import { describe, expect, it } from 'vitest';
import { summarizeBrowserMemory } from '../scripts/summarize-browser-memory.mjs';

const trial = (run, browserName = 'chromium', browserVersion = '151') => ({
  run, browserName, browserVersion, baselineRssBytes: 1000,
  peakRssBytes: 1000 + run * 100, afterClearRssBytes: 900 + run * 100,
  afterReloadRssBytes: 800 + run * 100, elapsedMs: 1000 + run,
  samples: 20 + run,
});

describe('browser RSS evidence summary', () => {
  it('computes per-browser median and maximum from five fresh trials', () => {
    const report = summarizeBrowserMemory({ commit: 'test-sha', platform: 'linux', results: Array.from({ length: 5 }, (_, i) => trial(i + 1)) });
    expect(report.browsers[0]).toMatchObject({ browserName: 'chromium', trials: 5, sufficientForFiveTrialReview: true });
    expect(report.browsers[0].metrics.peakRssBytes).toEqual({ median: 1300, maximum: 1500 });
    expect(report.browsers[0].deltas.afterClearMinusBaselineRssBytes).toEqual({ median: 200, maximum: 400 });
  });

  it('separates versions and does not certify one-trial evidence', () => {
    const report = summarizeBrowserMemory({ results: [trial(1), trial(2, 'firefox', '153'), trial(3, 'chromium', '152')] });
    expect(report.browsers).toHaveLength(3);
    expect(report.browsers.every(group => !group.sufficientForFiveTrialReview)).toBe(true);
  });

  it('rejects missing and invalid RSS values', () => {
    expect(() => summarizeBrowserMemory({ results: [{ ...trial(1), peakRssBytes: 'unknown' }] })).toThrow('Invalid peakRssBytes');
    expect(() => summarizeBrowserMemory({ results: [] })).toThrow('nonempty results');
  });
});
