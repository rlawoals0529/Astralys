# Decoded raster memory preflight and worker lifecycle

10–11 October 2026. Scope: **browser processing only**, no deployment or remote upload.

## What changed

- A small, pure `rasterBudget` function validates source and destination dimensions and estimates **decoded RGBA** footprint: `4 × sourcePixels + 4 × outputPixels + 4 × outputPixels if tones enabled`. If that estimate exceeds **96 MiB**, the operation is rejected **before constructing the destination OffscreenCanvas** with a smaller-export recovery suggestion. Source/destination are still individually limited to 16 megapixels and 8192 pixels on each side, and the separate tonal output limit is 4 MP.
- The worker checks that decoded bitmap dimensions match the validated input header. The existing `File.slice(..., detectedMime)` source normalization implemented in [PR #18](https://github.com/rlawoals0529/Astralys/pull/18) is preserved rather than replaced.
- After orientation/crop pixels have been drawn, the source `ImageBitmap` is **closed immediately**, before `getImageData`, raster redactions and `convertToBlob` work. The `finally` path still closes it on earlier errors.
- The estimate only covers simultaneously planned **application-visible decoded RGBA arrays**, excluding encoded source/outputs, browser-native/GPU decode overhead, caches and JS heap. **Do not misrepresent it as 96 MiB total process RSS.** Actual process-memory measurements with rights-cleared photos remain open under `docs/quality/PHOTO_QA_PROTOCOL.md`.
- For a near-16-MP source, native-size export may now be rejected; longest-edge 2048/1600/1200/800 presets are the supported fallback. The work stays in a disposable sequential **browser** Worker, not the Cloudflare 128 MB isolate.

## Upload and Cloudflare scope

The separately merged [Cloudflare/R2 architecture](../architecture/CLOUDFLARE_UPLOAD_MEMORY.md) recommends static hosting and a future optional **direct browser-to-R2** pathway with authenticated short-lived presigned PUT URLs and chunked multipart files for larger uploads. Neither this work nor the prior upload-planning PR creates a backend endpoint, R2 bucket, account, deployment or remote upload UI. Browser file selection is still entirely local.

## Verification evidence

- New **pure unit tests** reject 16-MP source + native-size export memory demand, accept smaller downscaled exports, include tone scratch and reject invalid dimensions.
- Added **production Chromium/Firefox** regression: inconsistent declared file MIME versus inspected bytes, local PNG decoding and tonal resized export, actual downloaded bytes and metadata inspection, no outgoing network requests, cleanup on clearing, optional **JS-heap-only** diagnostic attachment. This attachment is not process memory.
- Complete pull-request CI status and exact counts must be confirmed from GitHub Actions after all jobs exit. No code or deployment results should be inferred from this report alone.

## Follow-up

Measure browser process baseline/peak/steady state on real devices, investigate encoded-output copy peaks, and coordinate with the independently developed multi-page PDF worker, which has its **own separate memory boundaries**. No upload-by-default fallback, telemetry, image data persistence or server codec integration is authorized.
