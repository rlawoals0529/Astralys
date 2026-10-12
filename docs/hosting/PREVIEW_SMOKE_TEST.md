# Hosted preview smoke-test record

Use this form **only after** the owner authorizes a Cloudflare preview and the deployment exists. Do not mark checks passed based on local CI or presence of a `_headers` file.

| Evidence | Value |
| --- | --- |
| Exact Git commit | |
| Cloudflare deployment ID and preview hostname | |
| Browser and version | |
| Tester / date | |
| Console and network anomalies | |

## Live HTTP responses

- [ ] `GET /` returns the built application and not a source/development entry.
- [ ] `GET /` has CSP with `connect-src 'none'`, `worker-src 'self'`, `frame-ancestors 'none'`, and no `unsafe-inline` or `unsafe-eval`.
- [ ] JS assets and image-worker JS load with appropriate MIME and `nosniff`; verify security headers on **asset responses**, not just HTML.
- [ ] `/_headers`, source maps, `.env`, `wrangler.toml` and development files are not publicly accessible.
- [ ] The site requires no Worker API, database, object storage, or image upload endpoint.

## Browser flows

- [ ] File picker and drop zone accept PNG/JPEG/WebP; malformed files fail safely.
- [ ] Export each supported format, inspect **downloaded** pixels, dimensions, and metadata.
- [ ] Crop, rotate, tonal controls, undo/reset, and opaque redaction work in downloaded output.
- [ ] Batch conversion and multi-page image-to-PDF complete without retained object URLs.
- [ ] Cancellation and oversized-file recovery work; workers terminate after completion.
- [ ] 320px and desktop layouts remain usable; keyboard and accessible status messages work.
- [ ] DevTools network inspection shows **no outbound transfer of image bytes** or unexpected third-party connections.
- [ ] Confirm in Chromium and Firefox; record any Safari/mobile/manual gaps.

## Failure and rollback

If the hosted CSP is absent, uploads occur unexpectedly, or sensitive artifacts are exposed, stop the preview and use Cloudflare rollback/disable controls. Record the exact failing URL, headers and commit without uploading private images to issues.

This is a verification checklist, not proof that any of these checks have run.
