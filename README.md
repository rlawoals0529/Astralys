# Astralys

A local-first creative workspace: start with a file, find a useful next action, keep your work on your device.

**Private development milestone · no deployment · Chromium + Firefox acceptance verified.** Astralys is the selected working name, not a cleared trademark. See [naming review](docs/legal/NAMING.md).

## Implemented

- One file picker/drop target, byte-based PNG/JPEG/WebP detection and relevant actions.
- Dedicated worker for bounded still-image decode, resize and PNG/JPEG/WebP export.
- Metadata-container inspection and pixel re-encoding with removal of EXIF/XMP/comments and other supported ancillary metadata. This is not anonymization; visible information remains.
- Single-page image-to-PDF export in the same worker: JPEG compression, white background, no searchable text. Existing PDFs are not opened.
- Photo workspace: rotate, horizontal flip, choose square/portrait/classic/widescreen crops, and reposition the crop with a drag gesture or keyboard-accessible horizontal/vertical sliders. Crop positions join undo/reset history; preview and image/PDF exports share the same bounded worker geometry, without modifying the original File.
- Cancellation, worker timeouts, URL revocation, malformed/unsupported/oversized-file errors and recovery.
- Local-only Media Link classification. YouTube and all remote fetching remain gated.
- Keyboard-operable controls, focus styles, status announcements and reduced-motion styling.

The production browser pipeline has passed hosted Chromium and Firefox tests, including real downloads, dimensions, metadata removal, cancellation/recovery, keyboard focus and CSP enforcement. The isolated PhotoCraft/WASM spike additionally passed both browsers for bounded RGBA tiles and 512×512 multi-tile compositing, cancellation/restart and WASM memory checks. It is an experiment, not a production Photo feature. See the [verification report](docs/reports/MILESTONE_1.md) for exact revisions, commands and remaining manual accessibility/real-world coverage. This remains a private pre-release milestone.

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

Still PNG/JPEG/WebP only, 20 MiB input, 16 million pixels, 8192 pixels per side, 4096 chunks/segments, one active job and a 30-second deadline. Output limit 64 MiB. A browser without OffscreenCanvas/createImageBitmap gets an explicit error. PNG is lossless but can increase file size; JPEG flattens transparency to white. Re-encoding can change color, orientation or details. No files survive reload; explicit downloads remain on the user's device.

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
- [Resume prompt for a new ChatGPT chat](docs/RESUME_PROMPT.md)

Original code is MIT. Upstream names, marks, assets and dependencies retain their own rights. Stock ffmpeg.wasm core is GPL-licensed; it is not bundled. License review and automated tests do not establish legal approval or security certification.

## Next milestone

With user-repositionable crop framing merged and tested, prioritize a before/after Photo preview and representative real-world image/accessibility/performance checks. The PhotoCraft multi-tile WASM worker remains isolated pending color, licensing and security review. The opt-in REA command is for developer builds only; it does not ship or install a runtime. No backend or remote-media release is approved; keep provider access gated until separate legal/product and SSRF reviews pass.
