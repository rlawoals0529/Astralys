# Production Photo centered-framing milestone

10 October 2026 UTC. Private development only; **nothing deployed or made public**.

## Change and behavior

PR [#9](https://github.com/rlawoals0529/Astralys/pull/9) merged at commit `3443a023c5cef2b6d08fcee8e9253c0c6a6b64d2`.

The production Photo editor now offers centered **Original**, **Square 1:1**, **Portrait 4:5**, **Classic 4:3**, and **Widescreen 16:9** framing. Cropping is non-destructive and shares the same bounded `PhotoHistory` stack as rotation and horizontal flipping. Undo, reset, cancellation, and worker-error rollback restore earlier settings. The original `File` is never modified.

A small original pure geometry function computes integer crop bounds in the *currently rotated/flipped* view. The disposable browser image worker applies those coordinates during its existing canvas draw: no source-file decoding in the main thread, no additional full-size decoded intermediate canvas, no change to supported input formats, and no new package or WASM dependency. The preview, the usual PNG/JPEG/WebP exports, and the original one-page image-to-PDF writer use the same framed pixel region. Resize dimensions and aspect-ratio locking update after inspection. On very small sources, integer pixel geometry can only approximate requested ratios. The crop is centered; there is no draggable crop box or arbitrary crop position yet.

The UI explicitly labels this as a centered crop, with a one-step Apply action and Undo/Reset. A responsive panel prevents controls from overflowing the mobile workspace.

## Verification

The initial branch CI run caught a stale **unit test expectation** for reset, which now correctly includes `frame: 'original'`. No production failure or assertion relaxation was involved. The corrected [pull-request run 38029861018](https://github.com/rlawoals0529/Astralys/actions/runs/38029861018) completed successfully across both CI jobs.

| Gate | Result |
| --- | --- |
| `npm run check` | PASS: typecheck, ESLint, **60/60 Vitest tests across four files**, build, dependency audit reporting 0 vulnerabilities, dependency-license allowlist |
| Production Chromium + Firefox | PASS: **34/34 browser cases**, including cropped image pixels and dimensions, PDF page geometry, rotated cropping, undo/reset and cancellation rollback |
| Isolated PhotoCraft validation | PASS: native Rust tests, WASM build, Node verification and **10/10 Chromium/Firefox browser-spike cases** |
| Rust audit | PASS: pinned cargo-audit 0.22.2 against locked PhotoCraft crate graph |
| Repository state | No production dependencies, backend, deployment, third-party assets or public visibility changes |

Browser tests generate a synthetic PNG with red/green/blue vertical bands, center-crop it, download a real PNG and inspect the exported pixels. They also download the corresponding PDF and verify page geometry. Cancellation testing stalls a worker, cancels the crop and checks that controls/preview/undo are restored, then verifies recovery. No personal/user images are committed.

## Boundaries and next step

- This is a **centered** framing workflow, not interactive drag-to-crop. There are no layers, masks, PSD or color-managed compositing; the PhotoCraft/WASM multi-tile experiment remains separate.
- Preview is a sanitized re-encode, so it may differ slightly from a selected lossy export; output can be scaled intentionally by the dimension fields.
- Browser decoder and raster-processing memory cannot be hard-capped by the JavaScript size checks; production remains subject to the existing 20 MiB/16 MP/8192-side inputs, 30-second worker deadline and 64 MiB output bounds.
- Manual assistive-technology review, visual device testing, diverse real-world image fixtures, performance profiling and name/security-reporting gates are still open before a public hosted product. No third-party media resolver or YouTube downloading has been enabled.

**Recommended next product slice:** interactive repositioning of the crop area or a focused preview comparison tool, paired with stronger real-world image/performance/accessibility validation. Do not import the isolated WASM engine until its runtime licensing and security review is complete.
