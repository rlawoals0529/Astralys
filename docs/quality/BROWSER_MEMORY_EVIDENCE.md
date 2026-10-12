# Browser memory evidence worksheet

Status: one historical synthetic smoke run is recorded below; representative real-image and repeated-trial measurements remain pending.

## Reproducible run

1. Use a local production build (`npm ci --ignore-scripts && npm run check && npm run preview`) and record the exact commit, browser build, OS, RAM, device pixel ratio and viewport.
2. Use rights-cleared local PNG, JPEG and WebP images with documented dimensions, byte sizes, alpha, EXIF orientation and ICC profile. Do not commit private images, profiles containing personal data or browser traces.
3. In both Chromium and Firefox, establish an idle baseline after startup, then run: single native-size export, 2048px export, eight-image batch, eight-page image PDF, repeated cancellation, replacement and clear. Record success/errors, output dimensions and pixel checks, worker cleanup and download behavior.
4. For each case collect at least five fresh-browser runs. Record median and maximum **browser-process memory** using OS/browser process tooling, specifying which processes are included. Sample before, during peak and after clear. Separately record JS heap and estimated RGBA bytes; these are not substitutes for process memory.
5. Observe task responsiveness, long tasks and peak latency; record when native decode, Blob assembly and garbage collection occur where observable. Do not attribute a process delta to a specific allocation without profiling evidence.
6. Repeat at 320px and desktop viewports, with keyboard-only operation. Manual screen-reader and touch-device evaluations must be explicitly marked not run until performed.

## Recording template

| Commit | Browser/version | OS | Input dimensions/bytes | Operation | Run | Baseline RSS | Peak RSS | After-clear RSS | JS heap | Estimated RGBA | Duration | Outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | | | | | |

## Acceptance and follow-up

- Treat the existing 96 MiB raster estimate as an admission heuristic, **not** a process-memory cap.
- Fail any test that changes output pixels, PDF page order, metadata policy, cancellation or resource cleanup.
- Investigate repeated after-clear growth before increasing caps; browser caches/GC can explain transient retention and require controlled repeated trials.
- Compare Chromium and Firefox without assuming identical canvas color management or encoder output.
- No uploads, external telemetry, production deployment or new dependencies are required.

## Opt-in local Chromium and Firefox sampler

With Node 24, locked dependencies and both Playwright browsers installed, run a local production preview (`npm run build && npm run preview`). Run `node scripts/measure-browser-memory.mjs` in another terminal. `ASTRALYS_MEMORY_RUNS=5` selects fresh-browser trials (1–30); `ASTRALYS_MEMORY_BROWSERS=chromium,firefox` selects browsers. `ASTRALYS_BASE_URL` accepts only an HTTP loopback preview, never a remote site. The Linux-only script sums `/proc` RSS for the launcher and descendants via `ps`, samples every 100 ms and prints JSON without uploading it.

Each fresh-browser trial uses an original synthetic 2048×2048 PNG and performs:

1. Twenty sequential 1024px image exports, verifying a new result URL and recording RSS/resource counts after each export.
2. Single-image PDF export and clear.
3. Eight-image batch at a 1200px longest-edge limit and clear.
4. Eight-page PDF, immediate cancellation of a new composition, recovery with another composition, clear and reload.

Observable worker and Blob URL accounting must return to zero after clear. Repeated image exports retain exactly three URLs (original preview, current preview, download); batch retains eight. Workloads require at most one live worker. Cancellation starts and cancels in one JavaScript task, before a worker completion can arrive, then asserts the cancelled status and zero resources. This checks early cancellation, not cancellation at every decoder/composer stage; separate browser regression tests still cover those boundaries.

CI has a dedicated `memory-harness` job with one trial per browser. `npm run check` alone does not execute the harness. A green full workflow includes this smoke workload, but one trial is not evidence of a stable memory plateau. Review exact-head job logs and the `memory-harness-evidence` artifact.

`peakRssBytes` is a sampled maximum, not a guaranteed peak. Summing process RSS can double-count shared pages; it excludes non-descendant processes, GPU/driver allocations outside that tree, and spikes between samples. Resource instrumentation counts application-owned wrappers/URLs, not native allocation reclamation or GC. Do not infer leak freedom from after-clear RSS, and do not compare instrumented measurements with uninstrumented runs as equivalent. No memory limits are raised by this harness. Real-camera/ICC samples, five-trial distributions, actual mobile devices and screen-reader evaluation remain pending.

## First automated smoke run (2026-10-11)

GitHub Actions [run 38180203501](https://github.com/rlawoals0529/Astralys/actions/runs/38180203501), commit `cc24980`, executed **one iteration per browser** on Linux. These are summed browser-process-tree RSS values, not tab heap or device memory limits:

| Browser | Baseline RSS | Sampled peak RSS | After reload RSS | Samples |
| --- | ---: | ---: | ---: | ---: |
| Chromium 151 | 459.1 MiB | 582.7 MiB | 549.9 MiB | 36 |
| Firefox 153 | 719.0 MiB | 850.0 MiB | 819.5 MiB | 38 |

The smoke run passed, including a PDF cancellation attempt and subsequent composition. One iteration cannot establish a regression threshold, leak, stable plateau, or deterministic cancellation. Run at least five fresh-browser iterations per browser before drawing comparative conclusions. The full JSON is retained as the `memory-harness-evidence` CI artifact (subject to GitHub retention).
