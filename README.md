# Astralys

A local-first creative workspace: start with a file, find a useful next action, keep your work on your device.

**Private development milestone · no deployment · Chromium + Firefox acceptance verified.** Astralys is the selected working name, not a cleared trademark. See [naming review](docs/legal/NAMING.md).

## Implemented

- One file picker/drop target, byte-based PNG/JPEG/WebP detection and relevant actions.
- Dedicated worker for bounded still-image decode, resize and PNG/JPEG/WebP export.
- Metadata-container inspection and pixel re-encoding with removal of EXIF/XMP/comments and other supported ancillary metadata. This is not anonymization; visible information remains.
- Single-page image-to-PDF export in the same worker: JPEG compression, white background, no searchable text. Existing PDFs are not opened.
- **Multi-page image-to-PDF:** Combine 2–8 still PNG/JPEG/WebP images into a single ordered, image-only PDF using sequential disposable image workers and a separate bounded PDF composer worker. Up to 48 MiB combined input, 32 MiB prepared JPEG pages and 64 MiB output. Explicit download only; existing PDF documents are not opened or merged.
- Photo workspace: rotate, horizontal flip, square/portrait/classic/widescreen crop presets and drag/keyboard crop positioning. A local, side-by-side Before/After comparison retains the first sanitized preview and displays the current edit; crop positions remain undoable. Image/PDF exports use bounded worker geometry without modifying the original File.
- **Batch conversion:** Select 1–8 still images (48 MiB combined input) and convert to PNG/JPEG/WebP sequentially in disposable workers. Results and errors are per file, total retained output is capped at 64 MiB, and each download is an explicit click; no archives or bulk auto-downloads.
- **Smart export sizing:** Keep edited native dimensions, choose a longest-edge limit (2048 / 1600 / 1200 / 800 px), or enter custom dimensions. Automatic presets never enlarge or crop the current image; batch conversion supports the same longest-edge caps. The worker requests high-quality canvas resampling for resized exports.
- **Light and color:** Bounded brightness, contrast, and saturation controls in Photo Studio, included in undo/reset and actual pixel exports. Tonal editing requires at most 4 million output pixels to bound raster processing memory.
- **Opaque redaction:** Mark a region with pointer selection or accessible percentage fields. Up to 10 fully opaque black rectangles are rasterized into preview and downloaded image/PDF pixels (not reversible drawing overlays); the original file remains unchanged. Review exported images for sensitive content outside your selections.
- Cancellation, worker timeouts, URL revocation, malformed/unsupported/oversized-file errors and recovery.
- Local-only Media Link classification. YouTube and all remote fetching remain gated.
- Keyboard-operable controls, focus styles, status announcements and reduced-motion styling.

The production browser pipeline is verified in hosted Chromium and Firefox tests, including real downloads, dimensions, metadata removal, cancellation/recovery, keyboard focus and CSP enforcement. The isolated PhotoCraft/WASM spike additionally passed both browsers for bounded RGBA tiles and 512×512 multi-tile compositing, cancellation/restart and WASM memory checks. It is an experiment, not a production Photo feature. See the [verification report](docs/reports/MILESTONE_1.md) for exact revisions, commands and remaining manual accessibility/real-world coverage. This remains a private pre-release milestone.

## Static-host readiness (not deployed)

Astralys has a static-only `wrangler.toml` for **Cloudflare Workers Static Assets**, with the browser doing all conversion, edits and image export. `npm run check` validates the compiled `dist` bundle, checks copied security headers and rejects accidental inclusion of sensitive/local source artifacts; no Wrangler dependency or automatic deployment is enabled. **Private GitHub visibility does not protect a publicly deployed URL.** Publication requires release issue #8 and separate authorization.

See the [Cloudflare preparation guide](docs/deployment/CLOUDFLARE_STATIC.md). The local verification server also refuses to expose `/_headers` or hidden/source-map paths.

## Run locally

```sh
npm ci --ignore-scripts
npm run dev
```

Node 24.19.0 and exact dependencies are pinned. For production-output verification:

```sh
npm run check
npx playwright install chromium firefox
npm run test:browser
```

`npm run preview` serves the built output at `http://127.0.0.1:4173` with strict security headers. It is a local verification server, not a deployed production backend. `public/_headers` records equivalent static-host headers.

### Optional REA static inspection (developer-only)

REA is **not** part of the production app and is not automatically installed. After reviewing the [external tool and license notes](docs/development/REFERENCE_TOOLS.md), a developer may separately install a trusted, pinned REA CLI (e.g. `npm install --global rea-agents@6.3.0`) and explicitly inspect Astralys's own compiled JavaScript:

```sh
npm run build
npm run dev:rea -- --accept-static-analysis
```

The command checks the local `dist` directory before invoking REA's static analyzer, and prints potentially sensitive evidence to the terminal. The repository's tests use a mock REA executable; no real REA installation or scanning is performed in CI.

## Limits

Still PNG/JPEG/WebP only, 20 MiB per input, 16 million pixels, 8192 pixels per side, 4096 chunks/segments, one job at a time per editing or batch queue and a 30-second deadline per job. Output limit 64 MiB for individual exports or retained batch results; batch selection is capped at eight files and 48 MiB input. Tonal edits are capped at 4 million output pixels. A browser without OffscreenCanvas/createImageBitmap gets an explicit error. PNG is lossless but can increase file size; JPEG flattens transparency to white. Re-encoding can change color, orientation or details. Resize requests use browser canvas resampling; the high-quality hint is not a guarantee of uniform interpolation across browsers. JPEG/WebP quality is encoder-dependent; files are not guaranteed to become smaller. EXIF orientation and embedded ICC profiles are not retained by sanitized exports. No files survive reload; explicit downloads remain on the user's device.

No SVG rendering, existing-PDF modification, archives, audio/video conversion, remote fetcher, telemetry, login, persistence, DRM/access-control bypass or unreviewed WASM modules. Category surfaces explain planned capabilities; they do not claim to process those files.

## Architecture and compliance

TypeScript/Vite native DOM UI → typed action/file logic → disposable image worker → Blob download. Browser app has no production npm dependencies. PhotoCraft is **not** the runtime Photo editor: an isolated Rust/WASM spike uses its pinned color crate for scalar, fixed-size RGBA tile and bounded 512×512 multi-tile image compositing. No WASM ships in the browser production bundle. See [spike](spikes/photocraft/README.md).

- [Architecture](docs/architecture/DECISIONS.md)
- [Threat model and backend gates](docs/security/THREAT_MODEL.md)
- [Upstream audit](docs/legal/UPSTREAM_AUDIT.md), [license matrix](docs/legal/THIRD_PARTY_LICENSES.md)
- [Media policy](docs/legal/MEDIA_POLICY.md), [third-party notices](THIRD_PARTY_NOTICES.md)
- [Baseline verification](docs/reports/MILESTONE_1.md), [image-to-PDF extension](docs/reports/IMAGE_PDF.md), [RGBA tile spike](docs/reports/PHOTO_RGBA.md), [multi-tile verification](docs/reports/PHOTO_MULTITILE.md), [production Photo framing](docs/reports/PHOTO_FRAMING.md)
- [PhotoCraft and REA research/reference boundary](docs/development/REFERENCE_TOOLS.md) — optional, guarded REA static inspection of local `dist` after explicit opt-in; not bundled
- [Verified crop repositioning and REA developer bridge](docs/reports/PHOTO_REPOSITION_REA.md)
- [Prioritized product roadmap](docs/product/ROADMAP.md)
- [Before/after Photo comparison verification](docs/reports/PHOTO_COMPARE.md)
- [Export presets and fidelity verification](docs/reports/EXPORT_FIDELITY.md)
- [Photo fidelity, memory and accessibility QA protocol](docs/quality/PHOTO_QA_PROTOCOL.md) — manual real-photo/AT/process-memory checks still open
- [Automated worker, Blob cleanup and keyboard-accessibility evidence](docs/reports/QUALITY_LIFECYCLE.md)
- [Cloudflare Workers static hosting readiness](docs/deployment/CLOUDFLARE_STATIC.md) — offline preflight only; no deployment or Cloudflare account access
- [Batch conversion, tone and opaque redaction verification](docs/reports/BATCH_TONE_REDACTION.md)
- [Multi-page image-only PDF verification](docs/reports/MULTIPAGE_PDF.md)
- [Resume prompt for a new ChatGPT chat](docs/RESUME_PROMPT.md)

Original code is MIT. Upstream names, marks, assets and dependencies retain their own rights. Stock ffmpeg.wasm core is GPL-licensed; it is not bundled. License review and automated tests do not establish legal approval or security certification.

## Next milestone

With export presets and synthetic fidelity evidence already merged, prioritize representative real-photo and EXIF/ICC testing, manual accessibility/touch checks, worker/process memory profiling and final release gating. Cloudflare static-host configuration is preparation only; no publish, credentials or domains. The PhotoCraft multi-tile WASM worker remains isolated pending color, licensing and security review. The opt-in REA command is for developer builds only; it does not ship or install a runtime. No backend or remote-media release is approved; keep provider access gated until separate legal/product and SSRF reviews pass.
