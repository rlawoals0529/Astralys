# Project instructions

Do not use subagents. Do not deploy, publish packages, buy domains or change repository visibility without explicit user authorization. Keep media providers gated. No telemetry or default file persistence.

Before incorporating third-party code: record repository, immutable revision, files, license, notices, modifications and asset exclusions in docs/legal. Do not copy Craft/Adobe branding or UI assets. Keep production free of unreviewed codec/WASM binaries.

Implement real states; no fake success or unsupported working buttons. Treat all files/URLs/metadata as hostile. Keep expensive work in dedicated workers, with cancellation, memory limits and URL cleanup. Test boundary behavior and production Chromium/Firefox flows. Never weaken assertions to clear CI.

Use exact dependencies and lockfiles. Pin Actions to full SHAs. No downloaded user media/output, secrets, large binaries, node_modules, dist or target in git. Record verification honestly; distinguish a spike from production integration and legal analysis from approval.
