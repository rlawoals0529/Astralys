# Worker and Blob cleanup, keyboard accessibility, static-host readiness

10 October 2026 UTC. **Automated evidence project:** private, no deployment. Use the exact feature CI run for results once complete. No user media, external collection, production dependency or application telemetry is introduced.

## What is tested

1. **Resource lifecycle:** a Chromium/Firefox Playwright test instruments the page-local `Worker`, `terminate()`, `URL.createObjectURL()` and `URL.revokeObjectURL()` APIs. It loads a synthetic PNG, performs a Photo edit and image export, explicitly clears the source, runs a two-file batch conversion and clears the results. It demands *zero tracked active Worker instances and zero live Blob URLs* after clearing, exactly balanced URL creations/revocations, no concurrent test workload overlap, and attached JSON evidence. The instrumentation is present **only in the acceptance test**, not the shipped application. This is a browser-page reference/worker cleanup assertion, **not** proof that browser process RSS returns to baseline or that GC runs on cue.
2. **Keyboard and responsive accessibility:** tests the privacy disclosure button's `aria-controls`, `aria-expanded`, visibility and focus restoration. Redaction's numeric percentage fields have an accessible explanation, and a keyboard Enter on Apply creates a real undoable pixel-mask edit. Tests visible controls for horizontal overflow at 320, 390, 768, 1280 and 1920 px; checks that the size preset can be operated by keyboard and that its help remains associated via `aria-describedby`. Automated checks do **not** replace VoiceOver/NVDA, real-touch, zoom or manual WCAG review.
3. **Static-host security:** a Vitest test reads `public/_headers` and `index.html`, checking a closed-default CSP, `worker-src 'self'`, Blob-only local previews, `connect-src 'none'` on actual static response headers, `nosniff`, referrer, permissions and same-origin isolation settings. This is a **contract for static files**, not evidence that a live Cloudflare response correctly serves them.

## Cloudflare static host (plan only)

[Cloudflare Static Assets preparation](../deployment/CLOUDFLARE_STATIC.md) outlines static delivery from Vite's `dist/` and use of its `_headers` file. No server Worker, media backend, R2, account, preview environment, routes, DNS, credentials or production deployment were added. Review [release gate #8](https://github.com/rlawoals0529/Astralys/issues/8) before authorizing public hosting.

## Open limitations

Rights-cleared **real-photo tests** including EXIF rotation, embedded Display P3/ICC, low-light, skin tones and alpha edges are still a manual or explicitly approved data-provenance milestone. Only synthetic fixtures are permitted in CI. Browser-process memory (RSS/private bytes), real mobile device interaction and formal screen-reader accessibility remain open. See [the acceptance protocol](../quality/PHOTO_QA_PROTOCOL.md). Do not mark those as completed based on page-level instrumentation alone.

## Verification

CI outcome and exact counts: **pending**. Track the associated PR's production Chromium/Firefox, TypeScript, ESLint, license inventory, Vitest, PhotoCraft native/WASM/browser and pinned Rust audit jobs. Any failures should be fixed without suppressing tests.
