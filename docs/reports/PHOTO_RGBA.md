# PhotoCraft RGBA tile spike — private milestone

10 October 2026 UTC. Merged through PR #6, squash commit 2e610c4ee295d03eafb1c3cf96bb0832b5d877df. **No deployment, production import, new upstream code or binaries.**

## Scope

The existing pinned PhotoCraft color-math experiment now includes original Astralys code for bounded straight-RGBA8 source-over compositing. Mode 0 is multiply; mode 1 is screen. Opacity is finite in 0–1 and scales source alpha. Dimensions must be 1–64 pixels on each axis. The C ABI exposes a fixed 48 KiB arena with three 64×64×4-byte planes (backdrop, source, output). Inputs remain unchanged; invalid geometry/modes/opacity fail closed. Output outside the active pixel region is zeroed on valid calls.

An original disposable test worker receives in-memory bytes for the pinned local WASM build and two small tile arrays, validates exact byte counts and channels, invokes the bounded ABI, copies out only active result bytes, and is terminated by the harness. There is no network fetch, arbitrary loader, file parser, UI button, persistence or production CSP change. This proof of concept does not decode arbitrary images or import the whole PhotoCraft application.

The fixed arena does not bound the WASM runtime, native compiler stack or browser process allocations. Caller access to exported linear memory is constrained by the trusted experimental worker, not hardened as a public plugin ABI. The synchronous tile call cannot be interrupted halfway through; worker termination cancels the job lifecycle, not an individual arithmetic operation. RGB calculations are in browser-style encoded channel space, not a promise of ICC-managed or physically linear-light compositing.

## Verification

Run: https://github.com/rlawoals0529/Astralys/actions/runs/38026518126 — completed successfully on PR #6 head fed7a3daffd622d89aa2ebf686f0afd751f5c8fa.

- Web job: npm clean install, typecheck, lint, 57/57 Vitest tests (4 files), build, npm audit with 0 reported findings, license inventory, and 30/30 production Chromium/Firefox browser cases all passed.
- Photo-spike job: Rust 1.99 native tests passed (3 tests), WASM build passed, Node export/memory/boundary and blend assertions passed with zero WASM imports, and 4 browser-worker cases passed across Chromium and Firefox.
- Rust dependency audit: cargo-audit 0.22.2 completed successfully, scanning 16 locked crates against 1296 loaded advisories with no failure.
- The first proposed commit failed Node verification because an already-compiled WebAssembly.Module was instantiated using the bytes-overload return shape. Corrected in fed7a3d; the passing CI above covers that correction. No assertion was weakened or skipped.

These results test a small fixed tile and synthetic colors, not full-sized real user files, every browser/runtime, real-world image color fidelity, accessibility or memory exhaustion. Tests do not establish security certification or legal approval.

## Dependencies and legal boundary

No package manifest, lockfile, third-party dependency, runtime codec/WASM binary, fonts, icons or brand assets changed. The source still references only the pinned photocraft-color / photocraft-cms seam documented in the existing MIT-selected license, NOTICE, Unicode and provenance matrix. No downloaded media, user files or generated output entered git. This code remains an isolated spike outside the production application.

## Next gates

Measure actual compiled WASM and worker memory across repeated calls, add cancel/restart and multi-tile test coverage, design an image-wide layer interface with predictable color/alpha behavior, and review safety plus full transitive licensing before considering production use. Complete screen-reader and broader real-world image checks separately. Remote media providers, including YouTube, remain disabled.
