# Export sizing and image fidelity — implementation and verification

10 October 2026 UTC. [PR #13](https://github.com/rlawoals0529/Astralys/pull/13), squash merge `329ef041d50def180c1d3d060f0b3929c8a7b153`.

## Product behavior

**Single-image size presets:** Native edited size, longest-edge caps **2048, 1600, 1200 and 800 pixels**, and Custom. These are **fit-inside** limits, not forced exact dimensions: they preserve the current oriented/cropped aspect ratio, never enlarge a small input, and never crop an additional region. Native manual dimension edits (including disabling aspect lock) switch to Custom. A crop/rotate/undo operation updates the preset dimensions from the latest oriented crop; custom dimensions reset to the new edited-native size, matching the existing edit pipeline. Size help text is keyboard-accessible and announced via a polite status region.

**Batch size presets:** the same original/long-edge caps apply per selected still image, using the original photo state and existing safe worker. The worker validates requested preset values against a **closed enumeration** and refuses contradictory explicit width/height and preset values. Existing limits still apply (eight files, 48 MiB combined input, 64 MiB retained results; one disposable worker at a time). There are no remote providers, automatic downloads or archives.

**Resampling:** Canvas2D receives `imageSmoothingEnabled=true` and `imageSmoothingQuality='high'` for all worker drawing. This is a browser-controlled hint: it is not Lanczos, an ICC-managed photographic workflow, or a guarantee of identical output across Chromium and Firefox. PNG preserves transparency; JPEG re-encoding flattens transparent source regions against white. JPEG/WebP quality is browser-encoder-dependent and smaller files are not promised. Metadata scrub of freshly re-encoded output is unchanged.

## Verification scope

Production static/unit/build, npm security and license checks plus Chromium/Firefox browser acceptance test exact values are tracked in [Actions CI run 38076478760](https://github.com/rlawoals0529/Astralys/actions/runs/38076478760).

**Verified feature CI:** [run 38076478760](https://github.com/rlawoals0529/Astralys/actions/runs/38076478760) finished **success** in both jobs: **74/74** Vitest checks across six files; **60/60** Chromium/Firefox app browser cases; 10/10 isolated PhotoCraft browser tests, three native Rust tests, WASM assertions, TypeScript, ESLint, production build, license checks, npm audit zero findings and pinned Rust dependency audit passed. The automated synthetic fixture recorded timings and sampled pixels; its measurements are not a cross-browser image-quality standard.

New pure unit tests check original-size preservation, supported edge limits, never-upscale behavior, exact landscape/portrait dimensions and rejection of malformed input. New browser tests inspect *downloaded* PNG and WebP bytes after automatic sizing, including a tiny image that must remain unchanged and a rotated/cropped source that must update its calculated preset dimensions.

A deterministic, synthetic 640×400 gradient with fine opaque colored details and an intentionally transparent corner is re-encoded to lossless PNG and resized JPEG. The acceptance test checks image signature, dimensions, metadata removal, a white JPEG corner, and non-flat scene color. It attaches a JSON evidence record with bytes, sampled pixels and elapsed time. This is **synthetic regression evidence**, not proof of photographic color fidelity, real-image ICC profile preservation, EXIF orientation support, process RSS guarantees or pixel-perfect equivalence between browser engines.

## Separate quality gates

Before external release, test **user-owned or rights-cleared representative real photos**: landscape, low-light, skin tones, detailed texture, transparency, embedded ICC color profiles, and EXIF rotation. Compare visually and numerically in two browser engines, preserve a reproducible audit trail without checking in private photos. Test user-keyboard control of presets, screen-reader interpretation of help/status, mobile touch layouts and browser process memory for repeated medium/large edits. Use `docs/quality/PHOTO_QA_PROTOCOL.md` for the manual workflow. See [release gate #8](https://github.com/rlawoals0529/Astralys/issues/8) and the [roadmap](../product/ROADMAP.md).

No new runtime library, external media permission, file persistence, telemetry, live deployment or repository-visibility change is in scope.
