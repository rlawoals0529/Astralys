# Astralys — product roadmap and release priorities

10 October 2026. A living, evidence-first roadmap for the **local-first browser creative toolbox**, not a promise that every listed format or feature exists. User value, trust, and a clear workflow take priority over broad but unfinished category buttons.

## Product thesis

Open a file once, get the next useful action in context, adjust locally, compare, export and leave no trace in Astralys after closing. Compete on immediacy, privacy, transparent limits, dependable conversions and visual polish rather than claiming parity with professional native suites.

## Prioritized work

| Order | Milestone | Why users benefit | Gates and deliberate limits |
| --- | --- | --- | --- |
| Complete · PR #11 | **Before/after preview in Photo Studio** | See framing/rotation edits next to a reference without uploading or reloading the file | Preserve a sanitized re-encoded original preview in memory; revoke it at file/session end; keyboard/mobile UI; real Chromium and Firefox tests |
| Complete · PR #12 | **Batch image conversion** | Process several PNG/JPEG/WebP files with one choice of target format and export strategy | Eight-file queue with per-file failures, input/output aggregate limits, explicit separate download links; no ZIP package or automatic downloads |
| Complete · PR #12 | **Light/contrast/color adjustments** | More useful everyday Photo editing than rotations alone | CPU raster math preserves alpha with explicit 4 MP limit and preview/export parity; color/ICC fidelity and real-world memory profiling still open |
| Complete · PR #13 | **Export presets and fidelity evidence** | Native/custom output sizes and no-upscale limits for single and batch exports | Pure geometry tests, browser output-byte checks and synthetic photo-like alpha/JPEG comparison; real photographs, ICC and RSS profiling remain open |
| Complete · PR #12 | **Permanent opaque pixel redaction** | Hide visible information that metadata stripping cannot remove | Opaque black rectangles normalized to final cropped output, rasterized before encoding; verify downloaded pixels, avoid claiming that unmarked visible content is anonymized |
| Complete · PRs #15–16 | **Offline static-host checks and automated resource/accessibility regression** | Preflight built Cloudflare static bundle without deployment; assert workers/Blob URLs released on clear, keyboard alternatives and 320px layout | CI tests are synthetic and page-local; manual screen readers, real devices, camera photos and process RSS remain open |
| Implemented · pending verification | **Pre-decode raster admission for images and PDF pages** | Reject oversize jobs before creating a full decoded bitmap | Plan from inspected headers, then verify decoded dimensions; synthetic cross-browser tests and 96 MiB RGBA estimate |
| Complete · PR #20 | **Decoded raster memory admission and early bitmap release** | Reduce likely peak browser memory per image without changing local privacy | 96 MiB RGBA estimate, dimensions mismatch check, immediate bitmap close after drawing; true process RSS measurements still open |
| Next | **Real-world image and manual accessibility QA** | Validate user experience across camera photos, EXIF/ICC, keyboard, touch and screen readers | Approved user-owned images only; record color fidelity caveats and process memory before public preview |
| Ready · PR #15 | **Static hosting readiness (Cloudflare)** | Prepare an asset-only deployment model without creating a server-side file-processing backend | Offline Vite asset guard, strict `_headers`/CSP, no Worker script, no deploy, no public URL until issue #8 and permission |
| Ready · PR #17 | **Multiple image pages to PDF** | Useful multi-page scans without uploading | Memory-bounded image pagination and PDF correctness; different problem from opening, editing or merging arbitrary PDFs |
| Research | **Layered editing / compositing** | Foundation for PhotoCraft-inspired powerful editing | Separate source/asset/license provenance, alpha and ICC decisions, WASM/browser-process profiling, new trust boundaries and load tests |
| Research | **Local audio/video conversion** | Broader format toolbox | Codec licenses/binary distribution, memory, duration/size limits, local file permissions and streaming architecture |
| Gated | **Remote media links / YouTube** | Only rights-compliant authorized workflows | Provider terms and copyright analysis, explicit permissions, separate SSRF-safe backend review; **currently disabled** |

## Design and quality principles

- **Honest surfaces:** do not place actionable controls on unsupported categories; explain what is not implemented.
- **Visible outcomes:** the preview, exported file and download format must agree; never claim full anonymization or lossless output without the actual evidence.
- **Privacy by default:** no uploaded images, remote requests, telemetry, accounts, auto-saving, or silent downloads. Local image previews must use sanitized, scoped blob URLs, and all should be revoked on replacement, clear and pagehide.
- **Performance:** no heavyweight native binaries or extra decoded megapixel buffers without measurements; expensive operations run in disposable workers with cancellation and resource limits.
- **Accessibility and mobile:** keyboard controls, proper names/states, focus, contrast, touch and responsive layouts; browser automation is necessary but not a substitute for manual assistive-technology testing.
- **Evidence before launch:** every major slice needs verified Chromium/Firefox results, failure-path tests, truthful docs and a clean release state.

## Publication gates

[Issue #8](https://github.com/rlawoals0529/Astralys/issues/8) remains the source-code publication gate: repository history/secret review, name review, notices/license provenance, security disclosure channel and GitHub visibility settings. A live hosted demo has additional requirements (manual accessibility, diverse real-image tests, process memory metrics, deployment security and product support). A successful isolated Rust/WASM PhotoCraft spike is not equivalent to production image editing integration.

## Research boundaries

PhotoCraft source is an architectural reference and the existing small, audited color/WASM experiment stays isolated. REA is a separately installed, opt-in development CLI for Astralys's own compiled JavaScript; it is neither an end-user image feature nor a production package.
