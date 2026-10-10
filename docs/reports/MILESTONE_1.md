# Astralys — milestone 1 engineering report

Reviewed and built 9 October 2026; hosted verification completed 10 October UTC (9 October Pacific). **The private repository and browser implementation are complete. All 28 Chromium/Firefox app cases passed; screenshot review and exact CI evidence are recorded below. Nothing is deployed or public.** This is an engineering compliance review, not legal approval or a security certification.

## Project and repository

- Selected name: **Astralys**, per user instruction. Public naming clearance remains unresolved: exact-name GitHub repositories, Astralys LLC software usage and SWGT Astralys exist.
- Repository: https://github.com/rlawoals0529/Astralys — `main`, verified **private** through GitHub UI and API on 9 October 2026.
- Verified implementation candidate: `1bab4f478b9122f88b684dcbc94f7f8b162c366b`. The later report/screenshots-only commit does not modify application/test/dependency code and uses `[skip ci]` to avoid repeating the identical build. The passing run is linked below; the final documentation SHA is available in repository history and the handoff message.
- Five logical build commits were transferred after the GitHub-created initial README commit. Their trees were checked against the original local commits; code/file contents are identical. GitHub commit IDs differ because the connector creates commits with new metadata and the initialized parent.
- The original local implementation `37484cab6fd67406d113c6f4e617905416f95c6f` maps to GitHub `a4535d4cc0c13a19442d8dbb180d4018564c374c`. The screenshot test and reviewed upload-artifact action were added in `d2adb600`; `747672ba` improves active-workspace layout and startup checks; `7655c9a` improves small-text contrast.
- Repository creation used the browser fallback explicitly approved by the user. All code transfer and verification used the connected GitHub API. No existing unrelated repository was modified.
- No subagents, hosting setup, domain purchase, paid service, package publishing, store publishing or deployment.

## Architecture

TypeScript with native DOM and Vite; zero production npm dependencies. File → header inspector/suggested actions → disposable worker → browser decoder/OffscreenCanvas → metadata-filtered Blob → explicit download. Metadata values and filenames never become executable markup. Ordinary image processing has no network path. UI files live in memory, with no default IndexedDB, OPFS, localStorage, account or telemetry.

An isolated Rust/WASM crate imports PhotoCraft's pinned color math. Its output is not shipped in the application. A future remote pipeline is designed as an allowlisted network broker plus isolated ephemeral compute service; no server fetching or transcoding code exists.

## Implemented behavior, and limits of verification

| Surface | Implemented | Verification |
| --- | --- | --- |
| Input and navigation | Single-file picker/drop, byte detection, mismatch warning, contextual actions, category capability descriptions | Domain and Chromium/Firefox workflow tests pass |
| Images | PNG/JPEG/WebP encode, resize, quality control, explicit JPEG white background | Real PNG/JPEG/WebP exports downloaded and inspected in Chromium/Firefox; dimensions, MIME, metadata and filenames asserted |
| Metadata | Safe container inspection, re-encode, PNG ancillary / JPEG APP metadata / WebP EXIF-XMP-ICC removal | Structural tests and actual browser export metadata assertions pass; arbitrary EXIF values are not displayed |
| Photo | Rotate 90°, horizontal flip, bounded undo, reset original, rollback pending edits on cancel/error | Native history tests and both-browser rotate/flip/undo/reset/cancellation flows pass |
| Lifecycle | Size/pixel limits, one worker, deadline/cancel, stale-result protection, Blob URL release, clear/recovery | Worker controller/URL unit tests and both-browser cancellation, clear, malformed-input and recovery cases pass |
| Media Link | HTTPS parsing and local provider classification; all fetching disabled | Provider tests pass; no resolver implementation or network fetch path |
| PDF and other categories | Clear capability/roadmap surface only | No fake conversion/output; no PDF parser or editing implemented |
| PhotoCraft spike | Pinned `photocraft-color` / `photocraft-cms`, original scalar ABI for multiply/screen | 2 native tests, WASM build, 4 Node assertions and 2 browser-worker cases pass |

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
| `npm run build` | PASS: 9 modules; worker ~6.88 kB, app JS ~12.66 kB, CSS ~11.24 kB before gzip |
| `npm run audit` | PASS: 0 reported vulnerabilities at review time |
| `npm run licenses` | PASS reviewed allowlist: 158 lockfile packages, 134 installed; optional platform entries are metadata-only |
| `cargo test --manifest-path spikes/photocraft/Cargo.toml` | PASS: 2 tests; 0 failures |
| `cargo build --manifest-path spikes/photocraft/Cargo.toml --target wasm32-unknown-unknown --release` | PASS, Rust 1.99.0; generated scalar WASM 187 bytes |
| `node spikes/photocraft/verify.mjs` | PASS: 4 ABI assertions; zero WASM imports |
| `cargo audit --file spikes/photocraft/Cargo.lock --deny warnings` | PASS, exit 0; 16 dependencies scanned, database loaded 1296 advisories, no findings emitted |
| `npx playwright test --list` | PASS discovery: 28 workflow tests across Chromium/Firefox |
| `npx playwright test -c playwright.spike.config.ts --list` | PASS discovery: 2 browser-worker spike cases |
| Final app browser suite | PASS: 28/28 cases, Chromium + Firefox, 27.2 seconds on `1bab4f4` |
| Initial hosted browser run | PASS: 24 app cases, Chromium + Firefox, 32.8 seconds on `a4535d4`; separate spike 2 browser cases passed |
| Local browser limitation | Local Firefox setup timed out; local Chromium startup reports `socket() failed: Operation not permitted (1)`. Hosted CI removes this execution blocker |
| Visual review | Chromium desktop and 390px mobile screenshots inspected: active workspace, image preview, controls and responsive stacking. Small-text contrast tests pass in both browsers. Manual screen-reader audit remains open |
| `git diff --check` | PASS |
| Final GitHub CI | PASS: web and photo-spike jobs on `1bab4f478b9122f88b684dcbc94f7f8b162c366b`, [run 38024168996](https://github.com/rlawoals0529/Astralys/actions/runs/38024168996). 28 app browser cases, 2 spike browser cases, all native/build/audit gates passed |
| Initial GitHub CI | Web job passed; spike native/build/Node/browser steps passed. Cargo-audit installation was cancelled when the screenshot commit superseded this run |

The screenshot run `d2adb600` passed 21/26 cases. One network assertion incorrectly counted the app's own delayed favicon request; four Firefox tests stalled waiting for the page `load` event, before app assertions. Traces showed HTTP 200 responses for HTML, JavaScript, CSS and icon. A follow-up run on `7655c9a` passed 26/28 app cases and the entire PhotoCraft job, but two Firefox cases still stalled on DOMContentLoaded. Startup now waits for navigation commit and explicitly asserts successful HTTP status and the app-ready marker; CI uses one browser test worker. Timeouts remain 30 seconds and assertions are not replaced with retries. The media test exempts only the exact local favicon path for non-fetch/XHR requests; other local or remote requests still fail. The underlying Firefox load-event stall is not claimed conclusively diagnosed. The final 28-case suite passed without retries in 27.2 seconds after this change.

Screenshot inspection also prompted compacting onboarding while a file is active, clipping the unfocused skip link, and darkening secondary text that fell below normal-text contrast. New computed-color checks enforce 4.5:1 for the selected small-text surfaces in both browsers. This is not a complete accessibility audit.

The initial Playwright 1.64.0 and primary-runtime-aligned 1.62.1 downloads first returned HTML from a CDN instead of archives. Official alternate distribution endpoints yielded actual binaries. Final lockfile uses 1.62.1. Local native browser startup remains restricted, but GitHub-hosted Chromium/Firefox acceptance passed. No assertions or protections were weakened.

Vite's build tool Lightning CSS is MPL-2.0, explicitly reviewed as build-only file-level copyleft, not silently labeled permissive. Its binary/source is not shipped in app output. `node_modules`, target, browser binaries, generated WASM, downloaded media and conversion outputs are excluded. Dependency audit databases do not prove the absence of vulnerabilities. Optional platform binary contents and the entire Craft engine remain outside the review scope.

## CI and next milestone

CI defines clean install, typecheck, lint, tests, build, npm audit, license gate and both browsers, plus native/WASM spike checks and cargo audit. Checkout/setup-node/upload-artifact are pinned to full verified commit SHAs with read-only permissions and no persistent Git credential. Conservative Dependabot updates are configured; push CI runs on main and pull-request CI covers candidate branches, avoiding duplicate push/PR runs. Browser evidence artifacts contain synthetic inputs only and expire after seven days. Upload-artifact uses a reviewed Node 24-compatible v6 commit. No deployment workflow exists.

Next steps in order:
1. Complete assistive-technology and broader real-world image/orientation/color/memory evaluation before public release. Browser tests and screenshots do not certify accessibility or decoder safety.
2. Add one real PDF workflow with a reviewed dependency; expand the Photo bridge to bounded RGBA/layer operations and browser-worker tests. Keep every remote-media provider gated.
3. Resolve public name/trademark clearance, verify private disclosure availability and review deployment headers before any public launch. No launch is authorized in this milestone.

Dependabot update PRs are intentionally left unmerged. Their checks apply to candidate updates, not the reviewed main-branch lockfiles; passing or failing those branches does not change the baseline.

## Visual evidence

Synthetic original sample, captured in hosted Chromium at `7655c9a`; application source is unchanged in `1bab4f4` (test-readiness change only). No real user file is shown.

- [Desktop Photo workspace](screenshots/photo-desktop.png)
- [390px mobile Photo workspace](screenshots/photo-mobile.png)

Screenshots document layout only; test assertions and the limitations above remain authoritative.
