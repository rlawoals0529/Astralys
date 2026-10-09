# Astralys — milestone 1 engineering report

Reviewed and built 9 October 2026. **Local implementation and audit foundation are complete; repository creation and browser acceptance remain blocked/pending. Nothing is deployed or public.** This is an engineering compliance review, not legal approval or a security certification.

## Project and repository

- Selected name: **Astralys**, per user instruction. Public naming clearance remains unresolved: exact-name GitHub repositories, Astralys LLC software usage and SWGT Astralys exist.
- Git repository: local `main`. No GitHub repository has been created, so there is no verified repository URL or GitHub visibility setting to report.
- Intended target, pending creation: `rlawoals0529/Astralys`, **private**.
- Implementation commit: `155a64f` (includes local image app, legal records, Rust spike, tests and CI). Earlier commits: `ee2c5db` audit/threat model; `355ba52` local image workspace. Later report-only commit is identified in the handoff archive's HANDOFF.txt.
- The connected GitHub tool does not expose repository creation. Browser fallback requires user approval under the browser-tool instructions. No existing repository was modified to work around that limitation.
- No subagents, hosting setup, domain purchase, paid service, package publishing, store publishing or deployment.

## Architecture

TypeScript with native DOM and Vite; zero production npm dependencies. File → header inspector/suggested actions → disposable worker → browser decoder/OffscreenCanvas → metadata-filtered Blob → explicit download. Metadata values and filenames never become executable markup. Ordinary image processing has no network path. UI files live in memory, with no default IndexedDB, OPFS, localStorage, account or telemetry.

An isolated Rust/WASM crate imports PhotoCraft's pinned color math. Its output is not shipped in the application. A future remote pipeline is designed as an allowlisted network broker plus isolated ephemeral compute service; no server fetching or transcoding code exists.

## Implemented behavior, and limits of verification

| Surface | Implemented | Verification |
| --- | --- | --- |
| Input and navigation | Single-file picker/drop, byte detection, mismatch warning, contextual actions, category capability descriptions | Domain tests pass; browser workflow pending |
| Images | PNG/JPEG/WebP encode, resize, quality control, explicit JPEG white background | Worker code and production build complete; native browser codec behavior not yet end-to-end verified |
| Metadata | Safe container inspection, re-encode, PNG ancillary / JPEG APP metadata / WebP EXIF-XMP-ICC removal | Synthetic structural tests pass, including metadata markers; real exports pending browser test |
| Photo | Rotate 90°, horizontal flip, bounded undo, reset original, rollback pending edits on cancel/error | History/rollback tests pass; visual operation and export pending browser verification |
| Lifecycle | Size/pixel limits, one worker, deadline/cancel, stale-result protection, Blob URL release, clear/recovery | Worker controller and URL tests pass; lifecycle browser cases written |
| Media Link | HTTPS parsing and local provider classification; all fetching disabled | Provider tests pass; no resolver implementation or network fetch path |
| PDF and other categories | Clear capability/roadmap surface only | No fake conversion/output; no PDF parser or editing implemented |
| PhotoCraft spike | Pinned `photocraft-color` / `photocraft-cms`, original scalar ABI for multiply/screen | 2 native tests, WASM release build, 4 Node WASM assertions pass; browser-worker checks written, unrun |

Limits: 20 MiB input, 16 million pixels, 8192 pixels per dimension, 4096 chunks/segments, 30-second deadline, 64 MiB encoded output. Animated PNG/WebP and SVG are rejected. Metadata removal is not anonymization; visible content remains. Color/orientation/details may change during browser re-encoding. Reload loses the in-memory session. User downloads persist under the browser/OS.

## Upstream evaluation

All revisions below were inspected through root licenses, NOTICE, asset/brand notices, manifests and README. PhotoCraft received additional browser/core architecture review. This is not a whole-tree provenance, patent or vulnerability audit.

| Upstream | Exact inspected commit | Decision |
| --- | --- | --- |
| https://github.com/storytold/photocraft | 2515fa7cee624cf232c873ba283aa0359ec159d7 | Consume a small pinned color crate in an isolated spike; do not import full egui/web app |
| https://github.com/storytold/vectorcraft | 008b5e6d6cd6f3e569cc4fcfcd17e6099cf60bb2 | Architectural reference, future vector engine candidate |
| https://github.com/storytold/filmcraft | 5231852443363f001c3f6b396dd9b1e6461ae2be | Reference; defer codecs, patents and timeline integration |
| https://github.com/storytold/lightcraft | c435d143de921e8dc724245065500bc191f91102 | Reference; exclude model weights and optional AI features |
| https://github.com/storytold/pdfcraft | a6bc63a497954af87c1cd5a2a1e72e928a11c039 | PrintCraft redirected here; reference, not a V1 dependency |
| https://github.com/storytold/effectcraft | cae67546dd8db672706698a3ad897b758b0339f3 | Reference; no effects editor integration |
| https://github.com/storytold/designcraft | 14e677b24216396e398823ff034d9882322362d1 | Reference; no publishing editor integration |

Root code licenses are MIT OR Apache-2.0, with exceptions and third-party material. MIT requires retaining copyright/permission notices. Apache also has NOTICE/change obligations and an express patent grant/termination clause. Neither is a trademark license or proof of independent codec patent clearance. ArtCraft marks/app branding are excluded; all application UI, iconography, sample art and copy are original.

Important separate obligations: OFL-1.1 fonts; Lucide ISC and some Feather MIT icons; SCOWL dictionary terms; PdfCraft/VectorCraft BSD CMap and font notices; Unicode data; optional egui font licenses. LightCraft's segmentation port is Apache-only, SAM weights separately non-OSI, optional RawNIND weights GPL-3.0. None of those model/font/icon assets are selected for Astralys. Full attribution matrices and preserved notices are in docs/legal and THIRD_PARTY_NOTICES.md.

Original Astralys code is MIT. The spike selects the MIT option for dual-licensed upstream code, preserving both license texts and NOTICE; its transitive Unicode-ident code also needs Unicode-3.0. No upstream files were modified. No full editor, fonts, app artwork or generated WASM is committed to the application distribution.

## Media and distribution conclusions

- **A:** local-file conversion is the initial supported product route. Users still need relevant rights to the file.
- **B:** authorized remote sources need both rights to the content and a permitted retrieval method/provider policy.
- **C:** platform-restricted sources, including YouTube, need separate platform and legal analysis. Content ownership or a checkbox does not settle platform restrictions.
- YouTube remains gated; no official API download, extractor, cookie import, authentication handling, DRM/paywall bypass or access-control evasion is implemented. Prefer a permitted owner export followed by local-file processing.
- Sources: https://www.youtube.com/static?template=terms ; https://developers.google.com/youtube/terms/api-services-terms-of-service ; https://developers.google.com/youtube/terms/developer-policies . These are recorded as retrieved policy evidence, not a blanket legal conclusion for all jurisdictions.
- FFmpeg baseline is LGPL-2.1-or-later; enabled GPL components change obligations; nonfree builds can be unredistributable. Static WASM distribution needs corresponding-source/relinking and full binary-specific review.
- ffmpeg.wasm's wrapper is MIT, but the inspected stock core package is GPL-2.0-or-later. Do not treat that core as MIT.
- yt-dlp source/wheel is Unlicense; its README distinguishes GPLv3+ PyInstaller executables and other MIT/ISC bundled releases. A permissive extractor license does not grant platform/content rights.
- No FFmpeg/yt-dlp processing package is added to Astralys. Playwright fetched a test-support FFmpeg executable into its external cache; it is neither committed nor part of the app/source handoff.
- pdf-lib (MIT) and fflate (MIT) are evaluated candidates only. Neither is installed.

## Security findings and residual risks

Implemented boundaries include text-only metadata rendering, no SVG/PDF embedding, byte-based detection, predecode dimension checks, bounded chunk lists, worker deadlines/termination, stale-result protection, output-name sanitization and URL cleanup. Static-host CSP denies remote connections, inline executable scripts, objects and framing. No secrets or user files are needed.

JS cannot hard-cap native decoder allocations or guarantee safety against browser codec vulnerabilities. Metadata filtering is not malware scanning or forensic erasure. The full backend threat model specifies SSRF/DNS rebinding/private-network/redirect defenses, argv-only subprocess invocation, non-root resource-limited jobs, egress restrictions and cleanup. None is claimed implemented because no backend exists. Archive traversal/bomb protections are prerequisites, not shipped features. SECURITY.md explicitly leaves verification of a private disclosure channel as a public-release gate.

## Verification — exact status

| Command/check | Result |
| --- | --- |
| `npm ci --ignore-scripts` | PASS, clean install: 134 packages |
| `npm run typecheck` | PASS, TypeScript 6.0.2 |
| `npm run lint` | PASS |
| `npm test` | PASS: 3 files, 47 tests |
| `npm run build` | PASS: 9 modules; worker ~6.88 kB, app JS ~12.53 kB, CSS ~10.85 kB before gzip |
| `npm run audit` | PASS: 0 reported vulnerabilities at review time |
| `npm run licenses` | PASS reviewed allowlist: 158 lockfile packages, 134 installed; optional platform entries are metadata-only |
| `cargo test --manifest-path spikes/photocraft/Cargo.toml` | PASS: 2 tests; 0 failures |
| `cargo build --manifest-path spikes/photocraft/Cargo.toml --target wasm32-unknown-unknown --release` | PASS, Rust 1.99.0; generated scalar WASM 187 bytes |
| `node spikes/photocraft/verify.mjs` | PASS: 4 ABI assertions; zero WASM imports |
| `cargo audit --file spikes/photocraft/Cargo.lock --deny warnings` | PASS, exit 0; 16 dependencies scanned, database loaded 1296 advisories, no findings emitted |
| `npx playwright test --list` | PASS discovery: 24 workflow tests across Chromium/Firefox |
| `npx playwright test -c playwright.spike.config.ts --list` | PASS discovery: 2 browser-worker spike cases |
| Firefox browser run | NOT PASSED: 10 initial cases timed out in browser/page setup before app assertions; no acceptance claim |
| Chromium diagnostic | BLOCKED: process startup reports `socket() failed: Operation not permitted (1)` |
| Visual/accessibility review in browser | NOT COMPLETED; semantic/focus/reduced-motion implementation is not a substitute |
| `git diff --check` | PASS |
| GitHub CI | NOT RUN: repository not created/pushed |

The initial Playwright 1.64.0 and primary-runtime-aligned 1.62.1 downloads first returned HTML from a CDN instead of archives. Official alternate distribution endpoints yielded actual binaries. Final lockfile uses 1.62.1. Native browser startup is still restricted; no application assertions were weakened to make this pass.

Vite's build tool Lightning CSS is MPL-2.0, explicitly reviewed as build-only file-level copyleft, not silently labeled permissive. Its binary/source is not shipped in app output. `node_modules`, target, browser binaries, generated WASM, downloaded media and conversion outputs are excluded. Dependency audit databases do not prove the absence of vulnerabilities. Optional platform binary contents and the entire Craft engine remain outside the review scope.

## CI and next milestone

CI defines clean install, typecheck, lint, tests, build, npm audit, license gate and both browsers, plus native/WASM spike checks and cargo audit. Checkout/setup-node are pinned to full verified commit SHAs with read-only permissions and no persistent Git credential. Conservative Dependabot updates are configured. No deployment workflow exists.

Next steps in order:
1. With browser fallback approval, create `rlawoals0529/Astralys` privately, transfer the logical commits and run CI.
2. Fix any real browser failures; inspect desktop/mobile layouts, screen-reader behavior, output pixels, metadata and real-world memory limits. Do not declare this milestone release-ready before those pass.
3. Add one real PDF workflow with a reviewed dependency; expand the Photo bridge to bounded RGBA/layer operations and browser-worker tests. Keep every remote-media provider gated.
