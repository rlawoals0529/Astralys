# Astralys

A local-first creative workspace: start with a file, find a useful next action, keep your work on your device.

**Private development milestone · no deployment · Chromium + Firefox acceptance verified.** Astralys is the selected working name, not a cleared trademark. See [naming review](docs/legal/NAMING.md).

## Implemented

- One file picker/drop target, byte-based PNG/JPEG/WebP detection and relevant actions.
- Dedicated worker for bounded still-image decode, resize and PNG/JPEG/WebP export.
- Metadata-container inspection and pixel re-encoding with removal of EXIF/XMP/comments and other supported ancillary metadata. This is not anonymization; visible information remains.
- Photo foundation: rotate, horizontal flip, undo, reset and export, without modifying the source File.
- Cancellation, worker timeouts, URL revocation, malformed/unsupported/oversized-file errors and recovery.
- Local-only Media Link classification. YouTube and all remote fetching remain gated.
- Keyboard-operable controls, focus styles, status announcements and reduced-motion styling.

The production browser pipeline has passed hosted Chromium and Firefox tests, including real downloads, dimensions, metadata removal, cancellation/recovery, keyboard focus and CSP enforcement. The isolated PhotoCraft WASM spike also passed both browsers. See the [verification report](docs/reports/MILESTONE_1.md) for exact revisions, commands and remaining manual accessibility/real-world coverage. This remains a private pre-release milestone.

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

## Limits

Still PNG/JPEG/WebP only, 20 MiB input, 16 million pixels, 8192 pixels per side, 4096 chunks/segments, one active job and a 30-second deadline. Output limit 64 MiB. A browser without OffscreenCanvas/createImageBitmap gets an explicit error. PNG is lossless but can increase file size; JPEG flattens transparency to white. Re-encoding can change color, orientation or details. No files survive reload; explicit downloads remain on the user's device.

No SVG rendering, PDF modification, archives, audio/video conversion, remote fetcher, telemetry, login, persistence, DRM/access-control bypass or unreviewed WASM modules. Category surfaces explain planned capabilities; they do not claim to process those files.

## Architecture and compliance

TypeScript/Vite native DOM UI → typed action/file logic → disposable image worker → Blob download. Browser app has no production npm dependencies. PhotoCraft is **not** the runtime Photo editor: an isolated Rust/WASM spike consumes its pinned color crate and exposes a bounded blend operation. See [spike](spikes/photocraft/README.md).

- [Architecture](docs/architecture/DECISIONS.md)
- [Threat model and backend gates](docs/security/THREAT_MODEL.md)
- [Upstream audit](docs/legal/UPSTREAM_AUDIT.md), [license matrix](docs/legal/THIRD_PARTY_LICENSES.md)
- [Media policy](docs/legal/MEDIA_POLICY.md), [third-party notices](THIRD_PARTY_NOTICES.md)
- [Verification report](docs/reports/MILESTONE_1.md)

Original code is MIT. Upstream names, marks, assets and dependencies retain their own rights. Stock ffmpeg.wasm core is GPL-licensed; it is not bundled. License review and automated tests do not establish legal approval or security certification.

## Next milestone

Complete assistive-technology and broader real-world image validation. Then choose one PDF workflow and expand the Photo spike to a bounded pixel-buffer/worker interface with measured memory and license inventory. Keep remote media gated until separate legal/product and SSRF reviews pass.
