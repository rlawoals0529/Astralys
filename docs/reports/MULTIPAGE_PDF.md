# Multi-page image-only PDF — engineering milestone

11 October 2026 UTC. Rebased against the memory-budgeted worker in current main; verification pending. **Implementation prepared; CI verification pending.** No deployment, new runtime dependency, file upload, telemetry or public release.

## Product

A new optional "Make a multi-page PDF" panel accepts 2–8 still PNG, JPEG or WebP files in their input selection order. Each source becomes one image-only PDF page with a white background, preserved aspect ratio and up-to-2048/1600/1200/800-pixel longest-edge setting. No upscaling, OCR, text, embedded documents, forms, bookmarks or existing PDF input is supported. Output is offered as an explicit download link; nothing downloads automatically.

The selected file bytes are not passed to any remote service. A disposable image worker verifies, decodes, resizes, JPEG-encodes and removes supported metadata from each input in sequence. A **separate disposable composer worker** receives *only internally produced sanitized JPEG Blobs*, validates JPEG markers/baseline RGB properties, dimensions and lack of metadata-bearing segments, and constructs a multi-page PDF with exact page tree, xref offsets and binary stream lengths. No parsing or manipulation of arbitrary PDF files. The existing one-image PDF writer remains unchanged in output structure.

## Boundaries

- 2–8 pages, 20 MiB per file, 48 MiB combined original inputs, image dimensions at most 16 MP/8192 px per side.
- Prepared JPEG page data capped at **32 MiB combined**, resulting PDF capped at **64 MiB**; each sequential image job and the final composing job has a 30-second deadline.
- Any malformed/animated/disallowed source or failed JPEG encode fails the entire composition with a message rather than silently omitting a page. Cancelling terminates the active worker and discards partial state. Replacing selection/clearing/pagehide revokes the output URL.
- Several Blob/ArrayBuffer copies and the native browser decoder can still create memory pressure; these bounds are **not browser process RSS guarantees**.
- Raster output may change color/orientation and is not PDF/A, PDF/UA or accessible searchable text. No full metadata anonymization or exact color profile preservation is claimed.

## Verification planned

Unit: object count /Kids order /Count, exact xref offsets, stream byte identity, determinism and rejection of too many/few pages, wrong JPEG dimensions, corrupted input, metadata segments, and aggregate resource budget.

Chromium/Firefox production browser: download actual two-page image PDF and inspect page tree, dimensions, both stripped internal JPEG streams and user-initiated download name; reject malformed source without offering a partial document, recover with new inputs and handle worker cancellation. Validate 320px mobile layout. Retain all existing single-page PDF regressions.

Standard gates: `npm run check` including offline Cloudflare static-host bundle preflight, native PhotoCraft/WASM/browser suite and pinned Rust cargo audit. Real large camera photos, color/ICC, manual screen readers and process RSS remain unverified.

See [image PDF architecture](../architecture/IMAGE_PDF.md), [threat model](../security/THREAT_MODEL.md), [release issue #8](https://github.com/rlawoals0529/Astralys/issues/8).
