# PhotoCraft core / WASM integration spike

This is an isolated feasibility test, **not the engine of Astralys Photo**. No upstream application is iframed or forked. It consumes `photocraft-color` and its `photocraft-cms` dependency at the exact Git revision in Cargo.toml. Original wrapper exports two bounded scalar blend operations. Upstream code is unmodified. No egui UI, fonts, marks, app icons, PSD parser, IO or plugin runtime is selected.

## Reproduce

```sh
rustup toolchain install 1.99.0 --profile minimal --target wasm32-unknown-unknown
cargo +1.99.0 test --locked --manifest-path spikes/photocraft/Cargo.toml
cargo +1.99.0 build --locked --manifest-path spikes/photocraft/Cargo.toml --target wasm32-unknown-unknown --release
node spikes/photocraft/verify.mjs
```

`astralys_blend(mode, backdrop, source)` takes scalar normalized channels. Mode 0 multiplies; mode 1 screens. Non-finite/out-of-range channels or unknown modes return NaN. Keeping the first ABI scalar eliminates unchecked pointer/allocation crossings. Both legal and technical scope is deliberately small; a real image/layer engine needs a bounded RGBA buffer ABI, color management, cancellation, and per-feature crate review.

License: MIT option for PhotoCraft code; preserve upstream copyright/license/NOTICE in ../../docs/legal/evidence/photocraft. Complete resolved graph metadata is ../../docs/legal/spike-dependencies.json. Included third-party license texts are in licenses/. Unicode-ident has additional Unicode-3.0 obligations. Rayon is native-side only in this selected graph. No proof of whole-engine distribution suitability or legal approval is implied by compiling this seam.

A future integration should preserve the original TypeScript shell and accessible controls and run the audited WASM inside a dedicated worker. Do not copy the upstream web app UI or silently change production CSP to allow unreviewed modules. No generated WASM binary is committed or shipped.

## Bounded RGBA tile experiment

The original bridge now includes a fixed 48 KiB (three 64×64 RGBA8 planes) tile buffer via astralys_tile_ptr and astralys_tile_blend. The synchronous blend operates on 1–64 pixel dimensions, multiply/screen modes, and finite 0–1 opacity. Inputs remain unchanged; invalid arguments return a rejection code. The output uses straight-alpha source-over compositing. The original JavaScript worker harness validates exact input byte counts, copies active output only, and is terminated after each browser test.

Native, Node WASM and Chromium/Firefox worker tests exercise arithmetic, boundary checks, transparent pixels and input immutability. The fixed arena is not a hard process-memory limit; browser/WASM runtime allocations remain additional. This isolated spike is **not imported into the production Photo editor**. Image-wide tiling, interactive cancellation and full layer/ICC workflows are future work. No new upstream code, assets, licenses, dependencies or WASM binaries were added.

## Milestone 3 — image-wide tiled worker (isolated experiment)

An original `composite.worker.js` now assembles images as bounded 64×64 RGBA tiles using the existing Rust/WASM blend seam. It accepts explicit `start` and `cancel` messages and one active job per worker. Width and height are each capped at 512 (1 MiB/pixel plane), with exactly sized `Uint8Array` source/backdrop inputs, two defined blend modes, finite opacity, a 1 MiB maximum trusted WASM binary, and a 4 MiB maximum initial WASM linear memory. The production app does **not** import this worker or ship the built WASM. No new dependencies or upstream source were incorporated.

Each tile row emits a progress message and yields to the worker event loop so an explicit matching cancellation can stop the job. Immediate `Worker.terminate()` remains the hard-stop escape hatch if the browser/engine stops responding; the caller is responsible for timeout, object URL cleanup and termination. The test harness covers abort-then-fresh-worker recovery, error paths and last partial tiles. Image-wide compositing is **not** interactive production layer editing. The example workflow uses two whole RGBA buffers and one destination buffer (maximum 3 MiB in typed pixel arrays) plus a fixed 48 KiB WASM arena; structured-clone, browser, engine and WASM runtime memory increase actual process use.

Measurement scope: tests record WASM binary bytes, initial/final exported WASM linear-memory sizes, arena bytes, input/output byte counts, number of tile operations and elapsed wall time. A Node test also checks 256 repeated tile calls without WASM linear-memory growth. These metrics are not whole-process peak memory or a resource guarantee. Source pixels are treated as straight RGBA values in encoded-channel space; no color-profile/ICC management or full layer controls are claimed. See the separate milestone report in docs/reports for verified CI details.
