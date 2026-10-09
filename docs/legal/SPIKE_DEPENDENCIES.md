# Isolated spike dependency matrix

Exact resolved artifacts: spikes/photocraft/Cargo.lock. Git revision for PhotoCraft is pinned in the manifest; crates.io package versions/checksums pin every other dependency. Source commit metadata comes from the installed package .cargo_vcs_info.json where present, not an independent inspection of that entire Git tree. License files were read/preserved in spikes/photocraft/licenses; upstream license files are in docs/legal/evidence/photocraft.

All listed MIT OR Apache-2.0 code permits source modification, WASM/browser and commercial redistribution conditionally. This spike selects MIT, preserving copyright/license and upstream NOTICE. Apache option includes express contributor patent grant/termination and change-notice obligations. Neither clears third-party patents/trademarks. No fonts, icons or artwork are selected. Unicode-ident additionally requires Unicode-3.0 copyright/permission notices. No copyleft is present in the selected graph. Entire engine and asset suitability remain unreviewed.

| Repository | Package version | Source revision metadata | Software license | Use |
| --- | --- | --- | --- | --- |
| https://github.com/crossbeam-rs/crossbeam | crossbeam-deque 0.8.8 | 2920c984290229ab4e0ca0452ef09e48a82063f3 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/crossbeam-rs/crossbeam | crossbeam-epoch 0.9.21 | 2920c984290229ab4e0ca0452ef09e48a82063f3 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/crossbeam-rs/crossbeam | crossbeam-utils 0.8.23 | 2920c984290229ab4e0ca0452ef09e48a82063f3 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/rayon-rs/either | either 1.19.0 | 1e4326df5972eb4a0ced66cb3b67fa0c5aca8493 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| None | photocraft-cms 0.5.0 | 2515fa7cee624cf232c873ba283aa0359ec159d7 | MIT OR Apache-2.0 | Pinned Git crate, consumed unchanged |
| None | photocraft-color 0.5.0 | 2515fa7cee624cf232c873ba283aa0359ec159d7 | MIT OR Apache-2.0 | Pinned Git crate, consumed unchanged |
| https://github.com/dtolnay/proc-macro2 | proc-macro2 1.0.107 | ed8a5497669cd63db33bf24646f261b012bbbc4a | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/dtolnay/quote | quote 1.0.47 | 723dcb47d3f0ddc896e17287c8a8d3f2ea2317d5 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/rayon-rs/rayon | rayon 1.12.0 | c9ced185ae3508246a9eb70c8407a1199bb1b77f | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/rayon-rs/rayon | rayon-core 1.13.0 | 7af20d7692d5decbcb4adcaa079cd607e3e50814 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/serde-rs/serde | serde 1.0.229 | 7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/serde-rs/serde | serde_core 1.0.229 | 7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/serde-rs/serde | serde_derive 1.0.229 | 7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/dtolnay/syn | syn 3.0.6 | 559cab55ef0c644f77660840edc3620d0d99d3d7 | MIT OR Apache-2.0 | Resolved crate; unmodified |
| https://github.com/dtolnay/unicode-ident | unicode-ident 1.0.26 | 48771a67a73f7e14ce802aaeee16770ba661035b | (MIT OR Apache-2.0) AND Unicode-3.0 | Resolved crate; unmodified |
