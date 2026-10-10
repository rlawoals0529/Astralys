# External reference tools — research only

Reviewed 2026-10-10 UTC. This is a reference inventory, not a claim of product integration, complete licensing clearance, or approval to reverse engineer third-party applications.

## PhotoCraft — design and audited color seam

- Source: https://github.com/storytold/photocraft
- Reviewed upstream `main` commit: `95006995f646501f16cd237a03dc00e3c584f8b5`
- Project: Photoshop-like Rust editor with desktop and browser app, including document editing, compositing, and native file parsers.
- License at review: MIT OR Apache-2.0 with upstream notices and individually licensed visual assets. The repository contains distinct assets that may require separate rights.
- Astralys already has a **separately pinned** smaller PhotoCraft color/CMS Rust dependency in `spikes/photocraft`, documented in `docs/legal/SPIKE_DEPENDENCIES.md`. Its selected upstream pin must **not** be implicitly updated by this reference. The experiment is not in the production editor.
- This milestone reimplements **original crop-position geometry and UI** using native browser Web Workers/Canvas. It does not copy PhotoCraft code, images, trademarks, icons, CSS, controls, or other assets; no additional PhotoCraft dependency was installed.
- A general PhotoCraft engine import requires a new license, transitive-dependency, WebAssembly, memory, decoder and product-scope review.

## REA — opt-in development companion only

- Source: https://github.com/morluto/rea
- Reviewed upstream `main` commit: `28d3cb545c720722f397412054ffa337ba072df5`
- Published tool name/version at review: `rea-agents` 6.3.0, MIT license (copyright morluto).
- REA is a *reverse-engineering and observation CLI/MCP server* for developer agents, not an image editor, raster library, or end-user file converter. It can inspect JavaScript apps and local binaries and perform opt-in runtime analysis. Its native providers, environment access and setup can introduce new privileges and side effects. Do not load it into the browser production app.
- **Optional local workflow for an authorized development environment:** review the documentation and upstream dependencies first. After explicitly approving installation outside Astralys, install a pinned version with `npm install --global rea-agents@6.3.0` and run `rea --help`. Review `rea setup` before running it: setup modifies agent/MCP configuration. Use only on systems and artifacts you own or have permission to analyze, respecting licenses and access controls. Keep evidence synthetic or non-sensitive, and never record third-party credentials, user files or source dumps in this repository.
- No REA process has been executed or installed as part of Astralys CI, no MCP server has been registered automatically, and no REA code or packages are vendored. Consequently, this is an **optional development workflow**, **not** a shipped Astralys feature or a REA-based scan of third-party software.
- If a future feature genuinely needs REA-assisted analysis, first define a specific authorized target and expected evidence, review the tool's privileges, and run it manually outside the production app. Reuse ideas only when independently implemented and legally permitted.

## Astralys boundary

`npm ci --ignore-scripts`, the normal image worker, production CSP, browser acceptance tests and the build remain unchanged. No outbound fetcher, archive unpacker, executable file parser, credentials/telemetry, deployment or public-repository switch has been added.
