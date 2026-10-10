# Local batch, tone and redaction — production milestone

10 October 2026 UTC. PR [#12](https://github.com/rlawoals0529/Astralys/pull/12), squash-merged at `99c7371954203d0ba6b1b06ccf8ff94f87686aeb`. Repo remains private and undeployed. No new runtime libraries, media providers, backend or WASM in the production browser bundle.

## Three implemented user workflows

### 1. Sequential batch conversion

Choose up to **eight** still PNG/JPEG/WebP images (maximum **48 MiB combined source bytes** and **20 MiB per image**), select output PNG/JPEG/WebP and explicitly start. Astralys runs one item at a time in its **existing disposable image-worker pipeline**, with the same format sniffing, metadata-stripping re-encode, 16-megapixel/8192-side limits and 30-second deadline per item. It uses the original untouched photo-state snapshot; single-photo crop/tonal/redaction edits are **not silently applied to the batch**.

The interface preserves successes when another item fails, shows readable per-file errors, never downloads files automatically, and produces a separately clicked link for each successful export. The aggregate **64 MiB retained result-blob budget** prevents unlimited URLs/storage. Selecting a different batch, clearing, or leaving the page revokes output URLs; the Cancel action terminates the active worker and retains completed links until cleared. Large files can still consume significant native decoder/process memory despite byte and pixel caps; full browser process profiling remains required.

### 2. Light and color

Photo Studio adds brightness, contrast and saturation controls from -100 to +100, committed to bounded non-destructive undo history on slider change and reset in one checkpoint. The dedicated worker draws the user's crop/orientation first, then adjusts straight-alpha RGBA pixels using explicit per-channel math. The **alpha byte is preserved**. Before-and-after preview, PNG/JPEG/WebP export and single-page image-PDF export all use the same selected parameters.

For non-neutral tone settings, **at most 4 million output pixels** are permitted before calling `getImageData`; larger jobs return an explicit error recommending smaller export dimensions. The color math is deliberately basic RGB contrast/saturation/brightness, **not** ICC-profile color management, HDR editing or a promise of perceptual accuracy on every source.

### 3. Permanent opaque pixel redaction

Photo Studio adds up to **ten** strictly bounded percentage-coordinate rectangles. Users can enter left/top/width/height numerically or turn on pointer-drag selection. Entering drag mode **scrolls the editable preview into view**, and small source previews receive a useful minimum interactive size. The percentage rectangle is mapped to final output pixels (after crop, rotation and optional resize), rounded **outwards** to cover full boundary pixels, and painted as **opaque black pixels before encoding**. This is not an export-time overlay; the output is a newly encoded raster/PDF image with those pixels replaced.

Undo/reset changes the in-memory edit parameters; the original source File is untouched. This is a visual redaction tool, **not comprehensive anonymization**: unmarked faces/text/content remain visible, OCR/sanitized document semantics are out of scope, lossy formats may introduce artifacts at boundaries, and users must examine the downloaded result. The one-page PDF remains an image-only PDF; existing PDFs are not edited.

## Verification

Initial pull-request browser run passed **52 of 54** cases: the two failing cases exposed that a very small preview was not a usable pointer-drag target after the user clicked its below-preview control. The next run exposed the remaining issue: the preview was scrolled *above* the viewport, so synthetic pointer events targeted negative screen coordinates. The production fix now enlarges tiny previews in draw mode **and scrolls the editable preview into view** when armed. The test asserts both a usable width and a nonnegative, visible onscreen rectangle; neither failure was suppressed.

Latest corrected [PR CI run 38074079547](https://github.com/rlawoals0529/Astralys/actions/runs/38074079547) demonstrated:

| Verification gate | Result |
| --- | --- |
| TypeScript, ESLint, Vite build, dependency license checks | **Passed** |
| Vitest unit tests | **71/71** across five files |
| Playwright production Chromium and Firefox | **54/54** (includes malformed batch isolation, explicit downloaded WebP bytes, cancelled batch recovery, tonal alpha/pixel checks, actual opaque redaction PNG pixels, pointer redaction, undo/cancel and mobile width) |
| npm dependency audit | **0 reported vulnerabilities** |
| Isolated PhotoCraft native Rust/WASM/browser tests | **Passed**: 3 native Rust tests, scalar/WASM assertions, 10/10 browser cases |
| Pinned cargo-audit | **Passed**: dependency scan of 16 locked Rust crates, no CI failure |

Both jobs completed with **success** in the exact linked run. Counts were checked against job logs. No real external REA analysis was invoked.

## Engineering and release boundaries

- Threat model remains source-first: files/bytes untrusted, worker isolation, per-job cancellation, no uploads/telemetry/accounts, no default persistence, download explicitly user-initiated.
- A color-correction job may allocate pixel arrays; the 4-million-pixel tone gate limits the new full-frame pixel buffer, but it is **not a browser-process RAM guarantee**. Batch limits cap retained output sizes, not decoded bitmap memory.
- The text around redaction explicitly warns that only selected pixels are replaced, and metadata stripping is not comprehensive privacy protection.
- **Issue #8** continues to gate public source and hosted release: repository history/secrets, naming, legal/notice review, private security disclosure, real photographs, accessibility/manual device checks and memory/ICC profiling.
- Future work: real-photo/EXIF and color fidelity tests, mobile and assistive-tech QA, export preset UX, lossless/private redaction workflows and workload profiling. PhotoCraft WASM remains isolated and optional REA developer tooling remains separate.
