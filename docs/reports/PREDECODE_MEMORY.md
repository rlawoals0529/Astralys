# Pre-decode raster admission: reject costly jobs before image decoding

11 October 2026. Merged PDF-aware implementation on a private feature branch; fresh CI and merge are still required. No publication, deployment, provider fetching or upload endpoint.

## Problem and improvement

The [previous raster-budget milestone](RASTER_BUDGET.md) computed a conservative 96 MiB decoded RGBA estimate, but the image worker was still calling `createImageBitmap()` **before** making that admission decision. Thus an unsafe native-resolution export of a 16-megapixel input could fully decode a large bitmap, discover that source + canvas + tone scratch exceeded the budget, then discard it.

A new pure, typed `planRaster()` in `src/core/image-plan.ts` validates source image header dimensions, existing Photo state, crop/rotate geometry, optional closed-enum long-edge preset, requested output size, 4-million-pixel tonal-output cap and the existing 96 MiB RGBA estimate. The dedicated worker runs this **after structurally inspecting source bytes but before `createImageBitmap()`**. It still checks the decoded bitmap dimensions against validated header dimensions before any drawing, as the input is untrusted. No accepted-output pixels, codec, MIME, permission, source limits or downloaded bytes should change.

### What this does not do

- `inspectSource()` still reads up to the existing 20 MiB encoded input limit into an ArrayBuffer for structural validation. The browser's decoder, compositor, GPU and garbage collector allocate outside the `rasterBudget()` estimate. **This is not a 96 MiB total process-memory ceiling.**
- The existing 4 MP tonal-output cap, 16 MP per input, 8192-pixel side, 64 MiB encoded export, worker timeout and sequential batch queues remain unchanged.
- No server-side Cloudflare Worker, R2 upload authorization, remote conversion, storage or telemetry was added. Astralys stays local-only by default; the [future opt-in upload design](../architecture/CLOUDFLARE_UPLOAD_MEMORY.md) remains unimplemented.
- [Multi-image PDF PR #17](https://github.com/rlawoals0529/Astralys/pull/17) is now merged as `f83f7a65865cc732962799351dc7944f05b62190`. The updated pre-decode planner explicitly supports its `pdf-page` mode with bounded longest-edge fits, preserving the PDF composer and release limits.

## Regression evidence to verify

- Pure unit cases for large native source rejection, smaller preset recovery, image preview geometry, rotated and cropped square, single-page PDF dimensions, tone scratch, malformed presets and source dimension validation.
- Chromium and Firefox browser case loads an actual structurally valid 4000×4000 synthetic still PNG, checks that the native export fails with the memory error, then selects the existing 800-pixel longest-edge preset, exports a real downloadable PNG, verifies decoded dimensions and empty metadata, and clears the source.
- Production TypeScript, ESLint, Vite, npm audit, license inventory, strict Cloudflare Static Assets offline check, existing resource lifecycle tests, isolated PhotoCraft native/WASM/browser tests and pinned Rust audit remain required gates.

Future improvement after actual process-memory profiling: consider a bounded input probe instead of a whole encoded `arrayBuffer()`, plus streamed output when measured costs justify complexity. Do not weaken the structural file validation or accidentally change supported output fidelity.
