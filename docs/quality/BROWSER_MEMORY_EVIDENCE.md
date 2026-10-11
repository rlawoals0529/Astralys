# Browser memory evidence worksheet

Status: protocol only; **no measurements have been collected**.

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

## Opt-in local Chromium sampler

With Node 24, the project's locked dependencies and Playwright Chromium installed, run a local production preview in one terminal (`npm run build && npm run preview`). In another terminal run `node scripts/measure-browser-memory.mjs`. Set `ASTRALYS_MEMORY_RUNS=5` to change the number of fresh-browser trials (1–30). `ASTRALYS_BASE_URL` can point to a different local preview. The sampler is Linux-only and uses `/proc` plus `ps` to sum the browser launcher and descendant process RSS; it prints JSON to stdout and does not upload data. Its synthetic 2048px PNG fixture is exported through Astralys at 1024px, then cleared and reloaded. `peakRssBytes` is a 100ms-sampled maximum, not a guaranteed peak. This script does **not** replace diverse real-image, Firefox, PDF, cancellation, or manual accessibility evaluation. Results are not collected or certified merely by committing the script.
