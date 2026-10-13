# Astralys development handoff

Repository: https://github.com/rlawoals0529/Astralys (private). Objective: a polished, secure local-first browser creative toolbox. No deployment authorized.

## Verified starting state and completed work

- Audited README, AGENTS, roadmap, architecture, threat model, Cloudflare/R2 proposal, source, tests and CI. Main at audit: `c639836024882bb9561a91f989ebe8ade5852c91` (PR #27 mobile polish, merged).
- PR #28 https://github.com/rlawoals0529/Astralys/pull/28 reviewed and merged as `c2a655dc6b54b9d503b69aadff267a8a87d7e9b5`. Branch `docs/release-quality-checklist`, tested head `c5c0d00c4090680f2221cccf7086be118df63f65`. CI https://github.com/rlawoals0529/Astralys/actions/runs/38185670439 succeeded (web, photo-spike, memory-harness). No requested reviews; main reported unprotected. Ruleset inspection returned a GitHub plan restriction; no settings changed.
- Existing implemented features: still PNG/JPEG/WebP conversion, metadata stripping, crop/rotate/flip, undo/reset/before-after, tone, opaque redaction, export dimensions/presets, bounded batch conversion and multi-image PDF. Rust/PhotoCraft WASM stays experimental and out of production. Media links stay gated. Only outstanding issue found: #8 publication approval/readiness.

## Current implementation batch

Branch: `fix/exif-orientation-fidelity`.

Bug: browser EXIF rotation swaps decoded dimensions but admission/validation used raw JPEG dimensions, rejecting orientations 5–8. Fix: bounded IFD0 orientation parser, display-oriented JPEG inspection, explicit browser `from-image` decode, preserving memory limits and existing pixel pipeline. No production dependency or license addition.

Files: `src/core/exif.ts`, `src/core/files.ts`, `src/workers/image.worker.ts`, `tests/exif-fixtures.ts`, `tests/exif.test.ts`, `e2e/fidelity.spec.ts`, `docs/quality/IMAGE_FIDELITY.md`, this handoff. Tests cover all eight JPEG orientations, both byte orders, malformed/duplicate metadata, preview colors and actual PNG/JPEG/WebP downloads. ICC limitations documented; ICC accuracy is NOT verified. PNG/WebP EXIF normalization remains pending.

## Verification so far

- Local Node 24.19.0: typecheck and lint passed; 97 unit tests passed; Playwright's build succeeded.
- Local browser execution blocked: browser executables absent; Playwright installation returned invalid/truncated ZIP data. The 16 local launch failures are not application test results. Use GitHub CI for browser evidence; do not claim a browser pass until observed.
- Git CLI authentication unavailable. Current source was materialized through the connected GitHub API into an isolated scratch copy; all 147 blobs matched the audited main SHA. Local snapshot commit `eecd2da` is NOT a GitHub commit and must not be pushed. Create remote commits through GitHub Git Data tools using the real current main as parent. Original older checkout was left untouched.

## Next actions and restrictions

1. Open the EXIF fix PR against current main; verify exact-head web, spike and memory CI; fix genuine failures and merge only when green.
2. Extend EXIF with crop/rotation and PDF regression where useful; investigate valid ICC fixtures and alpha/redaction edge cases. Keep real-camera/manual color claims pending.
3. Improve the memory harness with repeated exports, batch workloads and explicit cleanup assertions; quantify sampled process RSS without raising memory caps or claiming leak freedom from RSS alone.
4. Inspect desktop/tablet/mobile screenshots; improve focused UX where evidence warrants it. Manual screen-reader and actual device checks remain outstanding.

Keep repository private; never deploy, publish, change visibility, add credentials/infrastructure, remote uploads, unrestricted media fetchers or unreviewed codecs. No telemetry/default persistence. Preserve TS/Rust boundaries, exact dependencies, SHA-pinned Actions and license provenance. Current architecture remains Workers Static Assets delivery plus browser computation; R2/upload plans are proposals only. No limits were relaxed.

Continue autonomously in focused branches/PRs, batch meaningful changes then consolidate checks. Re-read GitHub state and this file; avoid reimplementing existing features. Update this handoff with final PR/commit/CI evidence before ending. Regular ChatGPT without repository tools must provide exact patches/commands and must never invent executed tests or merges.
