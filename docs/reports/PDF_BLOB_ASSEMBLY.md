# Multi-page PDF output memory: section-based Blob assembly

Date: 11 October 2026. Scope: production image-only PDF composer worker, **not** Cloudflare server-side processing or deployment.

## Problem and bounded change

Previously the PDF composer kept up to **32 MiB of prepared JPEG pages**, decoded those to worker-owned Uint8Arrays, assembled a second full-size `Uint8Array` with every page and PDF header/xref, and then created a Blob from the entire array. That creates a predictable whole-output JS allocation just before Blob creation, on top of the JPEG arrays and already retained input Blobs.

The updated `imagePagesPdfParts` returns validated, ordered PDF header/object/xref byte sections referencing the already-loaded JPEG Uint8Arrays **without first flattening them**. The PDF worker uses `new Blob(parts)` directly. The existing `imagePagesPdf` compatibility API still flattens those sections where a contiguous Uint8Array is needed for deterministic byte-level tests; it is no longer used by the production multi-page composer.

Key guarantees retained:
- 2–8 pages; <=48 MiB source files overall; <=32 MiB prepared JPEG; <=64 MiB PDF; 30-second worker deadline and cancellation; no user-supplied PDF parsing
- strict sanitized baseline JPEG validator, exact stream lengths and xref byte offsets, input page order and image-only output
- local browser processing, explicit download, no persistence, telemetry, remote requests, external libraries or server-side Cloudflare Worker

This change avoids **one explicit full-PDF JavaScript Uint8Array allocation**. The browser's Blob implementation may still copy byte sections; retaining prepared JPEG Blobs and temporary ArrayBuffers still consumes memory. It is **not** evidence of lower resident-set memory or a particular peak RAM number. Worker lifetime and Blob URL cleanup continue to bound retained results.

## Automated verification

Unit tests compare the exact PDF bytes emitted by direct multi-part Blob construction against the existing contiguous writer, assert that JPEG sections reuse the original page byte views, preserve exact xref offsets and reject malformed pages. The full Chromium/Firefox end-to-end PDF tests remain mandatory, including actual downloaded image streams, cancellation and mobile layout.

**CI verdict pending** at creation; add actual run and test counts after successful completion. Manual browser-process memory profiling with multi-page photographic inputs remains open under `docs/quality/PHOTO_QA_PROTOCOL.md`.

## Cloudflare and uploads boundary

Cloudflare Workers Static Assets remains a delivery layer, not a processing server. Cloudflare's server-side Worker isolate is currently documented at **128 MB**; moving native image decode to it would reintroduce memory pressure and networked media bytes. An eventual opt-in large-file transfer should use a distinct authenticated short-lived authorization endpoint with per-user quotas and direct private R2 presigned upload/multipart transport; it **must not** be represented as a deployed feature. See `docs/architecture/CLOUDFLARE_UPLOAD_MEMORY.md` and publication issue #8.
