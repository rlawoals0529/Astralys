# Cloudflare Workers utilization, opt-in uploads and memory plan

Reviewed **10 October 2026** against Cloudflare's published documentation. **Design and locally tested client-side memory improvement only**. Astralys has **no active upload UI, upload signer, R2 bucket, Worker API endpoint or cloud data path**; the public-hosting and remote-provider gates stay closed.

## Architecture: use the right kind of worker

| Path | Runtime | What happens | Billing and memory |
| --- | --- | --- | --- |
| Site, app modules, dedicated worker JavaScript | Cloudflare Workers Static Assets | Static `dist` assets on Cloudflare's edge; `wrangler.toml` already points to `./dist` | Static-asset requests currently free/unlimited; avoid `run_worker_first` for static traffic |
| Default image conversion / Photo / PDF | **Browser Web Workers**, not Cloudflare Workers | Decode, crop, edit, JPEG/PNG/WebP re-encode, multi-page PDF preparation where supported; client chooses explicit downloads | Local device CPU/RAM and bandwidth; no image file uploads |
| **Future opt-in** upload authorization | **Separate Cloudflare API Worker**, under a dedicated API route/hostname | Strict auth, quotas, content metadata validation, random private object key, short-lived presigned R2 PUT permission; tiny JSON response | Billed invocation, 128 MB isolate RAM limit; no binary body reads |
| **Future opt-in** file transfer | **Browser directly to R2 S3 endpoint** | User explicitly sends `File` as the `fetch(..., {method:'PUT', body:file, signal})` body, matching a signed `Content-Type`; no `File.arrayBuffer()` before transfer | R2 object write/storage/network costs; no intermediary Worker file buffer |
| Future server processing, only if genuinely needed | Separate queued service, **not a broad Worker `fetch` handler** | Process immutable validated objects from private R2 with a separately licensed, capacity-tested compute engine | Explicit quotas, object retention, cost and source-rights gates; no generic YouTube fetcher |

### Why not upload through Cloudflare Workers?

Cloudflare Workers currently enforces **128 MB RAM per isolate**, including heap and WASM. Large `request.arrayBuffer()`, `request.formData()` or image/video decoding can consume this rapidly, especially under concurrency. A direct R2 PUT avoids routing image bytes through the API Worker's JavaScript memory. If a future streaming proxy cannot be avoided, use Web Streams with backpressure, restrict request size before consumption, cancel on disconnect, and **never** buffer entire uploads; account-plan request-body limits still apply.

Static assets should not invoke a Worker script first. Keep `assets.run_worker_first=false` (default) and the asset-only Wrangler config. If using a separate Worker for `/api/*`, route **only** that path to its Worker and explicitly apply security headers to API responses; the static `_headers` rules do not automatically cover dynamic Worker responses.

## Upload authorization threat model — not implemented

1. **Privacy mode is local-only by default.** Cloud upload requires a separate, clearly labeled workflow, explicit consent for each operation, a clear explanation of retention, and a persistent choice to stay local. Do not quietly add an upload fallback when local conversion fails.
2. API request `POST /v1/uploads/authorize`: accept **small bounded JSON**, never `multipart/form-data`. Validate authenticated identity or another enforceable abuse-resistant authorization method, per-account/day cost quota, count and bytes, fixed MIME allowlist, and intention to use a supported operation. Rate-limit by user/session and IP as appropriate; Origin/CORS or a CAPTCHA alone **is not authentication**. Never accept a user-supplied R2 object key, bucket, callback URL, or remote source URL.
3. Server generates an unguessable object key under `temp/<account-scope>/<random-id>`, a short-lived (**60–120 s**) presigned **PUT** URL to the **R2 S3 API hostname**, with exact `Content-Type` bound to the signature. R2 does not currently support presigned HTML-form `POST` uploads. The URL is a bearer credential until expiration: avoid telemetry/logging/links that leak it. Credentials reside only in the service secret manager, never in source, client bundles or the response.
4. R2 bucket is **private** with no public dev URL or custom domain. Restrict CORS to the authorized Astralys origin and only PUT / required Content-Type headers; CORS is a browser boundary, **not an auth or abuse prevention control**. Server quotas and a private bucket still matter.
5. **Size enforcement:** pre-authorize at most 20 MiB per uploaded still image initially, independently of the browser's 20-MiB per-file cap. Client-reported size/type is untrusted: signed Content-Type is not content-signature validation, and an ordinary presigned PUT **does not itself guarantee a hard maximum byte count or one-time use**. Enforce actual `HEAD` size and checksum/type validation after upload **before** granting processing/retrieval; delete immediately on mismatch, reject repeated authorization, and apply additional per-key/user R2 quotas and budget alerts. For a hard pre-transfer cap, add a server-verified upload control with proven enforcement rather than implying that Content-Type or CORS guarantees a size ceiling.
6. User can abort browser upload via `AbortController`; the upload-capability URL may remain usable until expiry. Cancellation is not proof that the remote object was deleted. Expose a **server-validated delete/abort** operation and verify object removal.
7. Apply an R2 lifecycle expiration (e.g. **1 day** on `temp/`), and a sweep for incomplete sessions/orphans; object deletion is **eventual**, generally within 24 hours of expiration, **not immediate or exactly 24 hours from upload**. Bucket multipart-abort retention is configured separately. Keep lifecycle retention, records, DPA and user disclosures consistent.
8. Future larger uploads: client must stream chunks directly to R2 via **reviewed multipart S3 operations**, cap part size and simultaneous uploads (start at one or two), and explicitly abort abandoned multipart uploads. This needs additional authorization, cost and storage limits; do not ship it as a side effect of supporting 20-MiB images.
9. End-to-end file secrecy is **not** provided by HTTPS or R2 encryption at rest. If a product requires that property, design audited client-side encryption/key handling and evaluate its impact on server processing; do not claim uploaded content is as private as local-only mode.

## Browser memory budget and process isolation

Current safety controls: 20 MiB encoded input, 16 megapixels and max 8192 px/side, 30-second **disposable** image Worker timeout, 64 MiB encoded output, 4-MP tonal pixel-data limit, sequential batch of up to eight files/48 MiB input/64 MiB retained output, abort/clear, Blob URL revocation and pagehide cleanup. Source files are passed to a disposable Worker and are not stored by Astralys.

**Memory costs are not equal to encoded file size.** A 16-million-pixel bitmap is approximately **61 MiB** at 4 bytes/pixel; a similarly sized OffscreenCanvas may require roughly another 61 MiB, before encoded buffers/decoder caches. A 4-million-pixel `getImageData` buffer alone is about **15.3 MiB**. Multiple simultaneous decoders would significantly raise peak browser memory. The browser and OS may allocate additional native memory outside the JS heap.

### Implemented improvement: avoid a second full source Blob allocation

Previously the image worker read `file.arrayBuffer()` for magic-byte inspection and then created `new Blob([bytes])` from the full encoded Uint8Array before decoding. The new path scopes the inspection read in `inspectSource(file)` and passes `file.slice(0, file.size, detectedMime)` directly to `createImageBitmap`. `File.slice` creates a Blob view rather than intentionally copying the entire encoded byte buffer in application JavaScript; it preserves the **detected** MIME even when a filename/declared MIME is wrong. This reduces application-controlled duplicate encoded data and lets the inspection buffer become eligible for GC earlier. It **does not** guarantee zero browser-internal copies or measured peak RAM reduction.

Do not try unlimited concurrency to 'maximize' performance. Existing user actions serialize image work; the separate background PDF composer (when merged) must remain bounded, abortable and protect combined prepared JPEG/output memory. Continue tracking actual worker starts/terminations and live Blob URLs in Chromium/Firefox test evidence. Add real-browser process RSS and representative photo fixtures before claiming hard RAM budgets or a 128 MB-browser ceiling.

Potential follow-ups, ordered by benefit: stream large encoded output only if benchmarked and correctness/audit validated; introduce tiered image-size previews on low-memory devices rather than immediately allocating full output; reuse existing original-preview buffers only if memory/complexity measurements justify it; decide whether a universal 16-MP export cap remains appropriate from real device data.

## Offline delivery gates

- Verified source format and metadata handling, worker timeout and output pixels with real Chromium/Firefox tests.
- No calls to an external storage API, network permission addition (`connect-src` remains disabled), server runtime package, upload credentials, R2 bucket or deploy until review and authorization.
- Simulated upload protocol and negative abuse tests **before** enabling any endpoint, including wrong MIME, oversized actual R2 object, expired/reused URL, abort, CORS and capacity limits.
- [Quality protocol](../quality/PHOTO_QA_PROTOCOL.md): real, rights-cleared photos, keyboard, touch, screen reader and browser-process memory remain human QA gates.
- Public repo/site issue [#8](https://github.com/rlawoals0529/Astralys/issues/8) still applies.

## Current Cloudflare references

- [Workers Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/): static-asset requests versus billed invocations
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/): 128 MB per-isolate memory
- [Cloudflare Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/): backpressure-oriented streaming
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/): PUT signed bearer links and no signed HTML POST
- [R2 browser CORS](https://developers.cloudflare.com/r2/buckets/cors/): explicitly scoped origin, method and headers
- [R2 lifecycle rules](https://developers.cloudflare.com/r2/buckets/object-lifecycles/): eventual deletion and multipart cleanup
