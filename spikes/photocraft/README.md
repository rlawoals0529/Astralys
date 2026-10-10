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
