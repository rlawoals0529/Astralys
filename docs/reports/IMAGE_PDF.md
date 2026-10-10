# Image-to-PDF extension

10 October 2026 UTC. Private development only; nothing deployed.

## Actual scope

Original single-page PDF writer, operating only on fresh worker-encoded JPEG bytes. PNG/JPEG/WebP sources use the existing decoder, bounded geometry, Photo transforms and metadata removal. A PDF action and explicit export button expose the workflow. Downloads use sanitized filenames; the image preview remains an image. A disclosure explains JPEG compression, white transparency, 96 px/in page geometry and absent searchable text. Existing PDF input remains rejected.

No production/development package was added; lockfiles are unchanged. No third-party implementation or assets copied. Specification research, constraints and distribution boundary are recorded in [IMAGE_PDF architecture](../architecture/IMAGE_PDF.md). Original code remains MIT. Existing upstream/legal gates remain open.

## Verification

- `npm run check`: PASS: typecheck, lint, **57 tests / 4 files**, build, npm audit (0 findings), license allowlist (158 locked / 134 installed).
- Independent verifier: Poppler `pdfinfo` 26.05.0 accepted a synthetic 8×4 RGB image output as one PDF 1.4 page, 6×3 pt, no metadata stream, JavaScript, forms or encryption.
- `pdftoppm -png -singlefile -scale-to 80`: PASS, 80×40 raster; center pixel (210,60,121), within 1 channel level of source (210,60,120). This is a generated synthetic fixture, not user data. Verifier tools and generated files are not shipped.
- Browser suite: 30 cases across Chromium and Firefox, including PDF download MIME/header, geometry, sanitized filename, embedded JPEG metadata, repeated PDF export and preview preservation. Initial run 38025449877: PDF export passed in both browsers; 28/30 cases passed, with two Firefox beforeEach navigation timeouts. Traces show HTTP 200 for the document/assets and a rendered app. Follow-up full-suite CI run 38025686922 on commit 463f343 passed both jobs, including 30/30 Chromium/Firefox app cases. The targeted Firefox navigation recovery was accepted only for the documented fully loaded/no-error signature, not for assertion retries.
- Unit checks include xref byte offsets, 20-byte entries, binary stream length, deterministic output, input immutability, malformed JPEG, unsupported components/precision, dimension and output-size bounds.

## Limits and next step

This does not provide a general PDF parser, merge/split, text extraction, signatures, forms or accessible/tagged document creation. JPEG is lossy and browser color behavior may vary. Local decode still depends on browser codec safety. No new remote access or persistence exists.

Hosted verification is complete. The isolated PhotoCraft RGBA tile bridge was subsequently verified through PR #6 (CI 38026518126); it remains outside production. See PHOTO_RGBA.md. Manual accessibility and broader real-world memory testing remain open. The reusable [resume prompt](../RESUME_PROMPT.md) describes current constraints and how a new chat should verify state before acting.

## Browser harness finding

The first PDF run exposed Firefox navigation bookkeeping stalls even with `waitUntil: commit`. The symptom matches upstream https://github.com/microsoft/playwright/issues/42183 (inspected 10 October 2026), but this is a diagnosis by evidence, not a confirmed upstream root cause. Original harness code permits one superseding navigation only after a Firefox navigation TimeoutError, successful document response, exact local URL, complete document/resources, app-ready marker and no page/request errors. It records a report annotation and JSON attachment. Both navigations use bounded 10-second deadlines within the existing 30-second test budget. HTTP success, app readiness and every functional assertion remain required. No whole-test retries, security-header changes or test skipping. No upstream implementation was copied.
