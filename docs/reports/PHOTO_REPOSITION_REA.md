# Photo repositioning and opt-in REA developer bridge

10 October 2026 UTC. PR [#10](https://github.com/rlawoals0529/Astralys/pull/10) merged as `e3b6ca725a0d10e873dd437dab1502819210e4b6`. No deployment or repository-visibility change.

## Production Photo: movable crop framing

- Preset frame ratios remain Original / Square 1:1 / Portrait 4:5 / Classic 4:3 / Widescreen 16:9. When a selected crop has source pixels to spare on an axis, users can drag the sanitized preview image to shift that crop area or use native keyboard-accessible 0–100% sliders.
- Repositioning uses original source-image dimensions **after rotation and flipping**; the crop rectangle remains entirely within the valid oriented image. Crop coordinates are finite whole percentages checked in both the pure geometry logic and dedicated worker. The pixel rectangle is selected with integer arithmetic.
- Drag commits on pointer release, not every pointer movement, keeping edits in one bounded undo checkpoint and avoiding continual full-image re-encodes. The sliders commit via change events. Undo/reset and worker cancellation/error roll back coordinates. Image and single-page PDF exports use the same current source selection.
- Controls are hidden for Original, and irrelevant axes are disabled. The preview remains an export-encoded local blob, with no additional image decoding on the main thread, cloud upload, new dependency or persistence. Very small source images can have quantized movement; percentages are not subpixel coordinates.
- This is **not** a freeform resizable crop overlay, content-aware cropping, PSD/layer editor, or ICC-managed processing.

## REA: optional developer-only local inspection

- Source reviewed: [morluto/rea](https://github.com/morluto/rea), upstream main `28d3cb545c720722f397412054ffa337ba072df5`, version `rea-agents@6.3.0`, MIT. See [REFERENCE_TOOLS.md](../development/REFERENCE_TOOLS.md).
- New original `scripts/rea-inspect.mjs` is invoked only by `npm run dev:rea -- --accept-static-analysis`, after the developer has built `dist` and separately installed a trusted `rea` CLI. It checks the Astralys project root, a real `dist/index.html`, an assets directory with built JS, and rejects symlinked build roots. It supplies the absolute `dist` path to `rea analyze-javascript-application ... --json` with `shell:false`, a 120-second deadline, and stdout/stderr directly to the terminal. The command is never included in app startup, build, CI hooks or the production bundle.
- **Tests use only a synthetic mock CLI**, ensuring explicit consent, the exact argument vector, build/target validation and rejection of symlinks. A real REA CLI was **not installed or invoked** during this milestone, so no REA output quality or installation success is claimed. The developer must review the external tool and install it manually if wanted; its static inspection output may contain sensitive application structure. No REA MCP registration, Ghidra, Hopper or native reverse engineering is enabled.
- PhotoCraft is a separate prior pinned Rust/WASM color/alpha feasibility spike. No new third-party source code, binary or assets were copied in this PR.

## Tests and CI

First iteration CI showed a test setup race during cancellation: a prior crop was not guaranteed to have completed before routing a deliberately stalled worker. Both browsers also passed the new drag and slider real-pixel tests. The corrected test now waits for the initial crop dimensions, controls and idle state before triggering cancellation. No assertion was weakened and no production code was changed to suppress the failure.

Final reviewed [PR CI run 38031551344](https://github.com/rlawoals0529/Astralys/actions/runs/38031551344) passed **both** jobs:

| Check | Result |
|---|---|
| Typecheck, lint, build and license check | Passed |
| Vitest | **67/67**, five files, including four mock REA command tests and new crop geometry/history cases |
| App Playwright in Chromium + Firefox | **38/38**, including pixel-verified drag repositioning, keyboard sliders, cancel/rollback, mobile width, export and PDF regressions |
| Isolated PhotoCraft browser suite | **10/10** across Chromium and Firefox |
| Native Rust/WASM verification | Passed; isolated PhotoCraft bridge remains unchanged |
| npm audit and pinned Rust dependency audit | Passed; npm reported 0 vulnerabilities |

These tests cover representative synthetic images and boundaries, **not** whole-process memory use, comprehensive mobile gesture coverage, formal accessibility validation, full color management or arbitrary real-world photographs.

## Remaining gates

Keep public-source release gated by [issue #8](https://github.com/rlawoals0529/Astralys/issues/8): history/secrets review, naming review, licensing and private vulnerability-reporting verification. No automatic installation or bundled REA executable. No remote-media fetcher or YouTube downloading.

Useful next product milestones are a before/after preview, real-world image fidelity/performance, manual keyboard/assistive-tech checks and eventually more sophisticated crop controls. A PhotoCraft engine integration requires a separate dependency, licensing, CSP, WASM memory and security review.
