# PhotoCraft multi-tile compositing — private milestone

10 October 2026 UTC. PR #7 (https://github.com/rlawoals0529/Astralys/pull/7) merged as 15604d057bfc829c7289dbd4c3610689fc69b50e. **Isolated experiment; not an enabled feature of the production Photo editor.** No deployment, upload endpoint, remote media service or public release.

## Implemented

- Original isolated PhotoCraft composite.worker.js assembles image-wide RGBA8 pixels from the existing audited, pinned 64×64 Rust/WASM blend-tile seam. Supports multiply, screen, source-over alpha and finite opacity; correct partial right/bottom edge tiles.
- Worker has one active job, job-ID-matched start/cancel, progress and an event-loop yield between tile rows. Cancelled work does not emit a successful output. Immediate Worker.terminate() is the hard stop when needed.
- Validates dimensions (1–512 each), exact Uint8Array plane lengths, modes, opacity, maximum local WASM binary (1 MiB), WASM exports and initial linear-memory bound (4 MiB). The arena is three 64×64×4-byte planes: 49,152 bytes.
- Output transfers only the completed result ArrayBuffer. At maximum 512×512, each RGBA plane is 1,048,576 bytes; two input planes plus one output total 3,145,728 application pixel bytes, **not** a hard browser-process memory ceiling. Input cloning, runtime allocations and compiled WASM memory are additional.
- No production editor integration, third-party source addition, production npm dependencies, package/Cargo lock updates, compiled binaries, network providers, changes to production CSP or extra runtime codecs.

## Verified checks

Final [GitHub Actions run 38027781708](https://github.com/rlawoals0529/Astralys/actions/runs/38027781708) completed successfully on PR #7 head 275ebe4226863239d603077ba152167b267107c3.

| Gate | Result |
| --- | --- |
| npm run check | PASS: typecheck, lint, 57/57 unit tests across 4 files, build, npm audit with 0 reported vulnerabilities, license inventory |
| Production Chromium/Firefox | PASS: 30/30 browser workflow cases |
| PhotoCraft Chromium/Firefox | PASS: 10/10 browser cases: partial edges, maximum image geometry, cancellation/restart, malformed inputs and bounded memory |
| Rust and WASM | PASS: three native Rust tests, pinned Rust 1.99.0 WASM build, Node scalar/tile verification |
| Repeated tile measurements | PASS: 256 sequential tile blends; zero exported WASM linear-memory growth |
| Rust dependency audit | PASS: cargo-audit 0.22.2; 16 locked crates; 1296 advisories loaded; no failing findings |
| CI browser evidence | The photo-spike-browser-evidence artifact contains the JSON Playwright report with per-test attached metrics; a separate browser-verification artifact records the production workflow |

**Measured Node/WASM values from CI:** compiled WASM binary **793 bytes**, initial and final exported linear memory **1,114,112 bytes**, fixed tile arena **49,152 bytes**. Browser tests also assert no exported WASM memory growth and attach job dimensions, tile counts, input/output bytes, initial/final linear memory and elapsed time. These are *not* total browser resident memory, JS heap, native codec allocations or peak process resource measurements.

## Correction history

An early Firefox run showed that a second progress update can arrive while a cancel message is in flight. The test now asserts that cancellation is acknowledged before all rows finish, no successful result follows cancellation, and a new worker completes correctly, without imposing a brittle exact progress-message count. The first evidence-upload step succeeded with a no-files warning; the final run adds the built-in Playwright JSON reporter and confirms a real artifact upload. No coverage was skipped to clear CI.

## Remaining safeguards and release gates

The trusted WASM bytes are supplied by the test harness from a local pinned build; this is **not** an untrusted-WASM sandbox. Executable WASM could use resources before exported memory checks, and within-tile operations are synchronous until Worker.terminate() ends them. Blend operations use encoded-channel RGBA, not color-managed or linear-light layer compositing. The current tests use synthetic pixels, not broad real-world images.

Before production integration: profile true process memory on multiple devices and real-world images; develop clear ICC, alpha and multi-layer semantics; verify native/worker cancellation deadlines and restart under load; review runtime WASM distribution, license and CSP; and complete manual assistive-technology checks. Keep local-first privacy, no telemetry, no implicit persistence, no remote YouTube/provider access and no unreviewed codec binaries. Engineering verification does not establish legal approval or security certification.
