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

## Repeatable fidelity evidence record

For each sample, copy the following fields into a private local test log. Never commit private photos, original EXIF GPS data, or screenshots that disclose personal information.

| Field | Value |
| --- | --- |
| Build commit SHA | |
| Sample identifier and permission/source | |
| Input SHA-256, bytes, MIME and decoded dimensions | |
| EXIF orientation (1–8 or absent) | |
| ICC profile name / hash (or absent) | |
| Browser, version, OS, device | |
| Viewer used for reference and its color-management settings | |
| Export format, dimensions and adjustment settings | |
| Export SHA-256, bytes, MIME and dimensions | |
| Expected versus observed orientation | |
| Expected versus observed color/alpha behavior | |
| EXIF/XMP/ICC metadata present in output | |
| Pixel comparison method and tolerance, if applicable | |
| Outcome, reproducible steps and issue link | |

**Orientation:** use a permission-cleared asymmetric photograph with an explicit EXIF orientation value. Test portrait and landscape display, original-size export, crop/rotate interaction, and final downloaded pixels. Record whether the browser decoder already applied orientation; do not infer correct output from width/height alone.

**Color management:** compare an embedded-profile JPEG against a trusted color-managed viewer under matching display settings. Record profile bytes/hash, color space, rendering intent if available, and any observable color shift. Do not claim that metadata removal preserves color appearance unless actual decoded output has been checked. For reproducible automated tests, use appropriately licensed, small, valid ICC samples rather than arbitrary invalid profile bytes.

**Transparency:** compare actual downloaded PNG/WebP pixels at a translucent sample point as well as a fully transparent point; distinguish unassociated RGB changes in zero-alpha pixels from visible compositing differences. For JPEG, verify the documented flattening background.

**Automation boundaries:** structural metadata tests and synthetic RGBA browser tests are useful regressions but do not substitute for real-device, color-managed display, EXIF-orientation, or process-RSS evidence. Record each category independently and leave unperformed items unchecked.

## Automated versus manual evidence ledger

| Capability | Automated coverage | Remaining verification |
| --- | --- | --- |
| PNG metadata sanitization | Structural container removal and idempotence; pending PR #40 checks byte-identical IDAT preservation | Real embedded-profile image color appearance |
| PNG hostile chunk handling | Pending PR #39 checks chunk CRC rejection and a CRC-valid dimension-bomb fixture | Confirm exact-head Chromium/Firefox CI before merge |
| JPEG EXIF orientation privacy | Pending PR #41 checks removal of a synthetic Orientation=6 APP1 block without altering scan bytes | Browser-decoded orientation and actual downloaded pixel orientation for real photos |
| Memory and object URL lifecycle | Browser export lifecycle and bounded input tests | Process RSS/peak memory on supported devices and repeated 20-export/batch/PDF runs |
| Accessibility | Browser viewport and workflow coverage | Keyboard, screen-reader, zoom and real touch-device audit |

This ledger is a planning snapshot, not a passing-test assertion: a pending PR does not count as merged or verified evidence. Update each row against actual CI and manual observations, with build SHAs, before any release claim.
