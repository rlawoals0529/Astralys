# Photo fidelity, memory and accessibility acceptance protocol

Status: **Manual work remains open.** This is a reproducible test procedure, not evidence that real-device or assistive-technology checks were run.

## Test environment and privacy

- Test privately on a current Chromium and Firefox build, on desktop and touch devices. Record browser versions, OS, CPU/RAM, any accessibility extensions and viewport. Do not collect user identifiers, source files, private metadata or upload media to an external service.
- Prepare **rights-cleared or self-generated** source photos off-repository. Keep confidential originals local; commit only synthetic fixtures and nonsensitive numerical reports. Review color/profile metadata before archiving any artifacts.
- Representative inputs: large detailed landscape, portrait skin tones, low light/high noise, EXIF 90° rotated camera JPEG, embedded sRGB vs Display P3 profile, transparent PNG with soft alpha edges, and source near the 16-megapixel limit. JPEG/WebP decoder and export support varies by browser.
- Keep test sequences reproducible and separate source visual expectations from lossless pixel equivalence. Current metadata-stripped exports **do not preserve all embedded color profiles or orientation hints**.

## Fidelity and sizing

1. Inspect source dimensions and compare original sanitized preview to the raw image in a known color-managed viewer. Record differences without claiming chromatic equivalence.
2. Choose original, long-edge 2048/1600/1200/800 and Custom; verify no automatic enlargement, aspect preservation, correct dimensions after rotation and crops, and intentional custom stretching only when the aspect checkbox is off.
3. Export PNG and verify dimensions, alpha at corners, absence of original EXIF/XMP metadata containers, and intended pixel transforms. For JPEG/WebP, inspect lossy detail and color shifts with stated encoder quality; verify JPEG backgrounds become white.
4. Export a redacted image and a single-image PDF; open the actual downloads and verify blacked-out content is absent from resulting raster pixels. Confirm unmarked text and faces remain visible—no whole-image anonymization claim.
5. Repeat selections across a malformed input and oversized input; ensure meaningful errors, no leftover download link, worker termination and correct recovery. Check input not overwritten.
6. Compare selected outputs side by side at 100% zoom and downsampled display size. Document halos, chroma bleed, transparency fringing, aliasing, and artifacts only with evidence.

## Performance and cleanup

1. Start from a fresh browser process and measure baseline memory using Chrome's Task Manager (Shift+Esc) or Firefox `about:processes`; record browser-specific caveats.
2. Run an original-size preview, high-resolution resize, toned crop, PNG export and batch of eight medium images. Record processing durations and **browser process peak/steady memory** if supported by the browser. The synthetic CI evidence gives time and file size, **not browser process RSS**.
3. Clear downloads, replace files, cancel a deliberately long-running task and navigate away. Observe whether memory stabilizes; blob URLs must be revoked and workers terminated. Browser allocators can retain memory temporarily, so report distributions and repeated-run trends rather than interpreting any single RSS sample.
4. Check the no-upscale and 4-megapixel tone limits. Record whether the 20 MiB file, 16 MP image and 64 MiB output caps reject attempts before unexpected allocation. Avoid allocating huge dummy files just to force crashes.
5. Note CPU throttling, mobile memory pressure and any crash or unresponsive interaction. Do not set performance thresholds until empirical baselines exist.

## Accessibility and interaction

1. From the first page entry, use **keyboard only**: tab to upload, select size preset with Arrow keys, toggle aspect lock, edit Custom dimensions, select output format/quality, start and download. Check the live preset description and focus order. No trapped focus after upload or export.
2. Run screen readers (NVDA with Firefox, VoiceOver with Safari where available) and check form labels, result status, the before/after groups, per-file errors, and selected crop/redaction controls. Percentage fields must provide a complete alternative to pointer-only gestures.
3. Check 320, 390, 768, 1280 and 1920 px viewports. Use touch for crop and redaction; verify the image is visible when redaction selection is armed. Check screen zoom 200% and system reduced-motion preference.
4. Confirm that file errors and download completion are announced clearly without stealing focus unexpectedly. Check WCAG contrast in controls and hover/focus/disabled states.
5. File issues for any observed failure. Do not mark the public preview gate complete from browser automation alone.

## Reporting template

For each manual session record: date, commit SHA, OS/browser/version, source category (no personally identifying filenames), output mode, pixel dimensions, processing time, browser process baseline/peak/after-clear memory (if measurable), observed color/alpha differences, screenshots only if rights-safe, keyboard/screen-reader findings, and pass/fail with links to follow-up issues.

**Release policy:** This protocol is not a substitute for the repository privacy, naming and legal gates listed in [issue #8](https://github.com/rlawoals0529/Astralys/issues/8).
