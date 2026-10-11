# Astralys: worker utilization, uploads and memory boundaries

Status: **implemented local-memory safety improvements; cloud upload architecture is a design only.** 10 October 2026. The app remains private and undeployed. No remote upload route, R2 bucket, credentials, user accounts, server-side image processor or Cloudflare Worker handler has been created.

## Where workers add value

| Layer | Current or proposed job | Resource and privacy decision |
| --- | --- | --- |
| Cloudflare Workers **Static Assets** | Serve Vite `dist/` bundles, security headers and static URLs | Prefer asset routing without invoking a Worker script for every request; static hosting does not receive user files |
| Browser **Web Worker** (existing) | Sniff/validate, decode, orient/crop, tone/redact, encode and strip image metadata | Disposable worker, 30-second deadline, 1 active image job; no image bytes transmitted |
| Cloudflare API Worker (**not implemented**) | Authenticate, validate an upload intent, issue limited R2 presigned operations, quota enforcement | Small JSON/control plane only. Never read/decode a large file into a Worker array buffer |
| Cloudflare R2 (**not implemented**) | Optional, explicitly user-authorized temporary file storage | Direct browser-to-R2 stream/multipart; separate privacy policy, CORS, lifecycle/expiry, quotas and security review |
| Cloudflare Queues/Containers (**not implemented**) | Only if a future opt-in server conversion feature cannot run locally | Do not silently replace local image work with server execution. Review codec licenses and cost/abuse gates first |

Cloudflare Workers currently enforce **128 MB per isolate**, with Free-plan request CPU 10 ms and Paid CPU up to five minutes. Request bodies are limited by the Cloudflare account plan (Free/Pro 100 MB, Business 200 MB, Enterprise higher per account). The server-side memory limit is not the memory available to a **browser** Web Worker. Browser memory varies by device, browser, decoder and GPU; it is not reliably inferable from `navigator.deviceMemory`.

Documentation verified 10 October 2026:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/r2/objects/upload-objects/
- https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/
- https://developers.cloudflare.com/r2/buckets/cors/
- https://developers.cloudflare.com/r2/buckets/object-lifecycles/

## Implemented: bounded local memory and worker lifetimes

1. Every decoded image is validated by byte signatures and container inspection before the worker calls `createImageBitmap`. The decoded bitmap dimensions must match the inspected header. Both file and output dimensions retain the 16-million-pixel / 8192-side limits; each file is limited to 20 MiB, with 64 MiB maximum encoded output.
2. Use `File.slice(0, size, inspectedMime)` for worker decoding instead of constructing a second Blob from a full `Uint8Array` copy. The temporary `arrayBuffer` is scoped to validation and no longer deliberately kept alive through raster drawing/encoding. Browser internals can still retain bytes.
3. Before allocating a destination `OffscreenCanvas`, estimate simultaneous decoded RGBA bytes: `4 × source pixels + 4 × output pixels + (tonal? 4 × output pixels : 0)`. Reject estimates above **96 MiB** with an actionable smaller-size error. Tone output remains capped at 4 million pixels. This is **not a guarantee of 96 MiB process RSS**: compressed bytes, preview/export blobs, GPU and codec allocations, browser caches and JS runtime overhead are excluded.
4. Close the source `ImageBitmap` immediately after drawing to the canvas, before allocating tonal scratch bytes or encoding. Any earlier failure still closes it in `finally`.
5. Keep expensive operations sequential rather than maximizing browser concurrency. Each `JobRunner` creates a disposable browser Web Worker, terminates on completion/failure/cancel/30-second timeout, and the Photo-vs-batch interlock prevents simultaneous active processing. Up to eight batch files queue sequentially with individual failure isolation, 48 MiB aggregate input and 64 MiB retained results.
6. New output links are user-initiated only. Preview/output Blob URLs are revoked on replacement, clear and pagehide. File data is neither persisted nor uploaded by the app.

**Consequence:** a valid near-16MP image can still be **previewed**, and downsampled exports can succeed, but a near-16MP **native-size export may now be refused** when its decoded source+destination working-set estimate exceeds 96 MiB. Users should select 2048/1600/1200/800-pixel presets. This is intentional safety prioritization over maximum advertised export dimensions.

## Optional future uploads, if users explicitly opt in

**Do not implement or enable by default.** A simple file chosen from a local picker is *not* a network upload; existing Astralys tools must continue working offline after static assets load.

### Proposed minimal flow

1. User explicitly chooses a cloud operation, understands what leaves the device, and authenticates. Distinguish public conversion URLs from a private temporary storage feature. Enforce clear retention/deletion guarantees rather than vague `metadata removed` claims.
2. A Cloudflare control-plane Worker accepts only a bounded JSON intent (declared MIME, length, purpose). Authenticate owner/session, rate-limit, enforce quotas/bytes per account, validate billing and prevent abuse. Generate cryptographically random object keys scoped to that user/job; never use supplied filenames or URLs as keys or fetch remote URLs on the user's behalf.
3. For small/medium files, return a short-lived **presigned PUT** scoped to a single R2 object key, method and exact content type. The browser sends `File` directly to R2 with `fetch`, no `File.arrayBuffer()` copy in the API Worker. For large files, use **R2 multipart upload** with `File.slice(start,end)` of 5–8 MiB chunks, retries only for failed parts, small bounded concurrency (e.g. 2 in-flight chunks), a short-lived per-part signature/authorization and server-tracked upload identity. Browser and Cloudflare Worker never buffer the entire image/video.
4. Configure R2 CORS for the exact app origin and required methods/headers; presigned URLs are bearer capabilities, so never log or expose them. Restrict content-type with signed headers but **do not rely on the self-declared MIME as verification**. Note: presigned PUT alone does not reliably enforce an overall content-length quota; verify object size/checksum and actual content after upload, then delete or quarantine mismatches before making anything available.
5. Only mark the upload ready after the server has confirmed ownership, size, type/magic bytes, checksum and quota. Keep R2 private; avoid public bucket exposure and cross-user enumeration. Stream reads to downstream processing, with separate codec/container isolation if added.
6. On abort or disconnect, explicitly abort multipart uploads. Configure R2 object expiration and incomplete-upload lifecycle rules, cleanup orphaned objects, provide deletion controls and monitor storage/operation cost. R2 multipart non-final parts must meet the R2 minimum (5 MiB) and use uniform sizes. By default, incomplete multipart uploads are automatically aborted after seven days; tighten this as appropriate.
7. Model separate failure states: request/auth failure, 413/size cap, presign expiry, CORS error, quota, partial upload timeout, checksum/type rejection, cancellation and cleanup failures. Never claim a completed upload until the server verifies the final object.

### Scale without accidental cost

For static-only traffic, maximize **cacheable edge assets** and avoid unnecessary invocation of a billed API Worker. For optional uploaded files, optimize **object transfers** and **short stateless control-plane calls**, not concurrent image decoders within a 128 MB Worker. Where a future processing job exceeds browser/R2 limits, queue it and use a separately reviewed compute environment; pushing bigger buffers into the same isolate is not a scaling strategy.

## Quality gates still open

- Chromium/Firefox worker regression suite, fidelity fixtures and malformed-file tests are automated; synthetic `RGBA` budget unit tests are not browser-process peak RSS measurements.
- Run representative actual-camera photos (rights-cleared), EXIF-orientation and ICC variants with manual visual review.
- Measure process memory with Chrome Task Manager or Firefox `about:processes` on desktop; compare repeated small/large jobs, cancellation, clear and pagehide. Document peak and steady state, OS/browser, processor and run-to-run variance.
- Manual NVDA/VoiceOver, touch and 200%-zoom checks remain open. Do not claim production readiness or launch from synthetic CI evidence alone.

Publication and any optional network upload deployment remain separately gated by [issue #8](https://github.com/rlawoals0529/Astralys/issues/8) plus explicit product/deployment authorization.
