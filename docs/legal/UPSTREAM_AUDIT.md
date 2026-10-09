# Upstream audit — 9 October 2026

This is an engineering compliance review, not legal approval. Scope: source license files, root manifests, notices, selected asset notices and PhotoCraft browser/core boundaries. It is not an independent verification of clean-room provenance, all transitive Rust crates, patent rights, or every asset. Exact commits are in [upstream-pins.json](upstream-pins.json). Evidence copies are research records, not shipped application code.

All seven repositories inspected: PhotoCraft, VectorCraft, FilmCraft, LightCraft, PrintCraft (now redirected to **PdfCraft**), EffectCraft, DesignCraft. Root LICENSE-MIT, LICENSE-APACHE, NOTICE, Cargo.toml, README and brand/icon licenses were read at the recorded revisions. Full source/asset graphs must be audited before any editor distribution.

## Decisions

- Original TypeScript UI with browser-native codecs, with zero application npm dependencies. No Craft UI, logos, icons, fonts or demonstration artwork copied.
- First integration experiment: consume **photocraft-color** at the audited Git commit behind a small Rust/WASM bridge. Prove a bounded pixel blend operation, not a full editor. Build experiment is separate from production, and cannot silently enable itself in the app.
- PhotoCraft's `apps/photocraft-web` is an eframe/egui application with WebGPU/WebGL2, browser dialogs, localStorage preferences and the shared engine. It is not a ready-made headless JavaScript editor SDK. `photocraft-engine` includes many codecs, plugin support, vector/text and IO crates; importing the entire engine needs a broader review. The pure color boundary is a smaller first test. Sources: `book/src/architecture/{overview,crates,command-engine}.md`, `apps/photocraft-web/{Cargo.toml,src/web.rs}`, `crates/{engine,compose,color,cms}/Cargo.toml`.
- Browser application: native canvas resize/encode and a non-destructive single-image Photo foundation (rotation/flip, undo/reset). No PSD compatibility claim and no claim that our Photo surface is already powered by PhotoCraft.
- pdf-lib and fflate are candidates, not installed. PDF is an honest planned capability surface. Archive extraction is absent.
- Do not include FFmpeg, ffmpeg.wasm core, yt-dlp, model weights, or native codecs in V1.
- Upstream self-descriptions of clean-room implementation are claims by upstream, not independently established facts. Open questions remain around provenance, codec patents and feature-specific distribution obligations.

## Notable exceptions

LightCraft's segmentation port is Apache-2.0-only; optional SAM weights are separately licensed, non-OSI; optional RawNIND weights are GPL-3.0. PdfCraft has Foxit fonts, CMap data and egui font obligations beyond its root license. PhotoCraft's per-icon notices include separate third-party attribution. A root permissive license does not clear an entire release ZIP.

The ffmpeg.wasm wrapper is MIT but the inspected `packages/core/package.json` declares **GPL-2.0-or-later**. Treating its stock core as MIT would be wrong. yt-dlp's PyInstaller executables include GPLv3+ code according to the pinned README; source/wheel versus packaged executable must be distinguished.

## Incorporation register

| Source | Components reused | Modifications | Distribution decision |
| --- | --- | --- | --- |
| Craft repositories at upstream-pins.json | None in application | None | Architectural research only |
| photocraft-color at `2515fa7cee624cf232c873ba283aa0359ec159d7` | Git dependency in isolated spike; color/blend interface | Upstream unchanged; original bridge wrapper | Spike only; MIT option; retain copyright/license and upstream NOTICE; actual resolved graph recorded separately |
| Browser codecs and canvas | Browser APIs | Original code only | No codec binaries redistributed |
| npm development tools | Packages at exact lockfile versions | Unmodified | Build/test use; see generated development inventory |

The selected project's original code uses MIT because no copyleft runtime component is included. That choice does not relicense third-party code, models, fonts, names, or future codec binaries.
