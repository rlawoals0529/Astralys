# Release-quality evidence checklist (private development)

This is a manual verification protocol, **not** a release authorization. Run on a local build only. Preserve the source files and record browser, OS, device, and build SHA for each finding. Do not upload personal images or metadata to public issues or CI artifacts.

## Real-image fidelity matrix

Test at least one image for each case: phone JPEG with EXIF orientation, JPEG with embedded ICC profile, transparent PNG, transparent WebP, high-contrast text/screenshot, low-light photograph, and near-limit large raster. Prefer synthetic or permission-cleared samples for shareable evidence.

For each image:

- [ ] Confirm input dimensions, orientation, and visible colors against a trusted local viewer.
- [ ] Export at original dimensions and at a smaller preset; record dimensions, visible orientation, color shifts, file size and format.
- [ ] Inspect exported metadata locally; confirm expected EXIF/XMP stripping, and explicitly note that visible content is not anonymized.
- [ ] Test crop, rotate, flip, tonal controls, undo/reset, and compare preview against the downloaded image.
- [ ] Test a fully opaque redaction and inspect actual downloaded pixels; never treat a preview overlay as sufficient.
- [ ] Verify cancellation, malformed-file rejection, and recovery after failure.

## Accessibility and touch

- [ ] Test at 320px, 390px, 768px and desktop widths with browser zoom at 200% and 400% where applicable.
- [ ] Navigate every action by keyboard alone, including crop repositioning, file picker, batch controls, export, and error recovery.
- [ ] Check focus visibility, accessible labels, status announcements, reduced-motion behavior, and logical focus order.
- [ ] Test touch targets and horizontal overflow on actual iOS Safari and Android Chrome devices where available.
- [ ] Perform a manual screen-reader pass (VoiceOver/NVDA/TalkBack) and record any unsupported combinations.

## Memory and lifecycle

- [ ] Record browser and OS process memory before and after 20 sequential exports, 8-image batch, multi-page PDF, repeated cancellation, and switching tools.
- [ ] Confirm object URLs, workers, previews and retained outputs are released when no longer needed.
- [ ] Exercise oversized inputs and verify pre-decode rejection without a process crash; record recovery steps.
- [ ] Check the result size against configured limits and report peak memory separately from estimated decoded RGBA memory.

## Release gate

- [ ] CI on the exact release candidate SHA passes (web, PhotoCraft spike, memory harness).
- [ ] Screenshot artifacts inspected at every configured viewport.
- [ ] No unresolved high-severity privacy, security, accessibility, or data-loss issue.
- [ ] Third-party license and trademark reviews complete.
- [ ] Release issue #8 and explicit owner approval recorded **before** any public deployment, DNS, visibility change or remote-upload feature.

Document evidence and outstanding gaps; do not claim manual device, screen-reader, or real-photo verification from synthetic CI results.
