# Astralys — prompt for a new ChatGPT chat

Copy the following into a new chat. Repository state and current reports take precedence over this snapshot.

---

Continue my existing **Astralys** engineering project. Do not restart or scaffold a replacement.

Repository: https://github.com/rlawoals0529/Astralys
Owner: rlawoals0529. Keep the repository private. Work on the current main branch after checking its actual HEAD, working tree, recent commits and CI. Use the connected GitHub integration when available. If this chat cannot access the private repository or run code, say so clearly and ask for the necessary source upload or give exact local commands; never invent inspected code, commits or test results. Do not request passwords or tokens in chat.

First read AGENTS.md, README.md, docs/reports/MILESTONE_1.md, docs/reports/IMAGE_PDF.md (if present), docs/architecture/DECISIONS.md, docs/architecture/IMAGE_PDF.md, docs/security/THREAT_MODEL.md, docs/legal/UPSTREAM_AUDIT.md, docs/legal/THIRD_PARTY_LICENSES.md, docs/legal/MEDIA_POLICY.md and THIRD_PARTY_NOTICES.md. Check actual CI rather than assuming the counts below are current.

Product: a privacy-first, local-first creative workspace and converter. TypeScript/Vite native DOM shell, disposable image Web Workers, no production npm dependencies, no telemetry, accounts, default persistence or uploads. A file should lead to useful contextual actions rather than a wall of converter buttons. Original Astralys branding only; no ArtCraft/Adobe marks, fonts or app assets.

Implemented baseline: PNG/JPEG/WebP detection, conversion, resize, metadata-container inspection/removal, rotate/flip/undo/reset, cancellation/recovery, bounded input/pixels/output, object URL cleanup, honest category surfaces, and local Media Link classification with every provider disabled. Limits: 20 MiB input, 16M pixels, 8192 pixels/side, 30-second worker deadline, 64 MiB output. No existing PDF parsing, archives, audio/video conversion or backend fetcher.

Latest extension: image-to-PDF through an original narrow writer, after worker re-encoding and metadata stripping. One image-only page, 96 pixels/inch, JPEG compression, white transparency background. No searchable text, forms/scripts/links/attachments, PDF/A or PDF/UA claim. Check IMAGE_PDF.md and CI for its exact verified state. Local baseline after this addition: 57 unit tests; 30 browser cases expected across Chromium/Firefox. Never equate test discovery with passing execution.

PhotoCraft integration is a separate Rust/WASM feasibility spike using pinned photocraft-color/cms, not the production editor. It has 2 native tests, 4 Node WASM assertions and 2 browser-worker cases. Its MIT-selected licenses/notices and transitive Unicode license are preserved. All seven Craft repositories were evaluated; only this small color-math seam is imported. Do not silently expand the dependency/asset graph.

Keep YouTube and other remote providers disabled until separate legal/product/provider review and SSRF-safe backend design are complete. Local conversion, authorized remote media and platform-restricted media are different cases. No DRM/paywall/access-control bypass, cookie import or official YouTube API audiovisual downloading. FFmpeg/yt-dlp are not bundled; stock ffmpeg.wasm core is GPL, despite its MIT wrapper. Consult the recorded distribution matrix before adding anything. Astralys name clearance remains unresolved. Tests do not confer legal approval or security certification.

Process constraints: no subagents; no deployment, domains, paid accounts, package/store publishing or public visibility. No user files, secrets, generated media or large binaries in git. Exact locked dependencies, full-SHA Actions, minimal dependencies. Record upstream source/revision/licenses/notices before reuse. Preserve meaningful tests and security boundaries; do not weaken assertions to make CI green. Browser startup uses navigation commit plus explicit app-ready and HTTP-success assertions to avoid a Firefox lifecycle wait issue; do not remove readiness assertions. Local browser processes may be restricted, so use hosted CI and its synthetic screenshot artifacts when necessary.

Next: finish any outstanding image-to-PDF verification first. Then expand the isolated PhotoCraft bridge to a bounded RGBA/layer operation with worker cancellation, memory limits, native/WASM parity, license review and browser tests. Consider further PDF features only with an explicit dependency/threat-model review. Keep scope to one coherent vertical slice at a time.

Work autonomously through the selected slice, logical commits and meaningful verification. Stop at a documented, reviewable milestone. Report repository URL, branch/SHA, actual features, exact test/audit/CI results, unresolved risks, intentionally deferred features and the recommended next milestone. Keep this resume prompt current when the state changes materially.
