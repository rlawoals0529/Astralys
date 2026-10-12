# Cloudflare Workers Static Assets: release runbook

**Status:** Prepared, not deployed. No Cloudflare credentials, domains, DNS records, or production routes are configured in this repository. This document is not authorization to deploy.

## Architecture

Astralys builds to `dist/` using Vite. `wrangler.toml` configures Workers Static Assets only, with no Worker script or backend routes. User images stay in the browser; the hosting layer serves static HTML, JavaScript, styles and headers. This does **not** enable remote image conversion or media-provider downloads.

## Preflight (no Cloudflare account required)

1. Use the pinned Node major from `package.json` and install with `npm ci --ignore-scripts`.
2. Run `npm run check`; it typechecks, lints, tests, builds, validates `dist/`, audits dependencies and checks licenses.
3. Run `npm run test:browser` in the configured Playwright environment and confirm Chromium and Firefox results on the **exact candidate SHA**.
4. Review `dist/index.html`, `dist/_headers`, compiled worker URLs, `wrangler.toml`, and the output of `scripts/check-static-assets.mjs`. Never commit `dist/` or credentials.
5. Complete issue #8: historical secrets/log/artifact audit, licensing and naming review, private vulnerability reporting, manual device and screen-reader checks, EXIF/ICC real-image tests, browser memory/RSS and cancellation evidence. Document unresolved issues rather than silently marking them passed.

## Cloudflare preview (requires explicit owner authorization)

After issue #8's applicable preview gates and explicit owner approval, connect the Cloudflare account using its official login flow outside this repository. Prefer a separately named preview environment; do not attach a production route or custom domain initially. Build the same verified SHA, verify the upload contains only checked `dist/` assets, and use the official Wrangler CLI to deploy the configured static assets. Do not put API tokens in source, command history, CI logs, or committed files.

Check the actual preview HTTP responses for CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`. A `_headers` file present in the build is **not proof** that the deployed host applies it. If Workers Static Assets does not apply the file as expected, stop and configure equivalent response headers through a reviewed hosting mechanism before public exposure.

Smoke-test navigation, file-picker/drop, PNG/JPEG/WebP conversion, Photo editing, actual downloaded output, multi-page PDF, cancellation, responsive layout, and browser worker loading on Chromium and Firefox. Confirm browser network requests do not upload image bytes or contact unexpected hosts.

## Rollback and operating model

Record deployment ID, exact source SHA, build checks and hostname in a release log. Keep a known-good version for rollback; if a privacy or security issue is found, disable the preview or roll back using Cloudflare's official deployment controls. No database, R2 bucket, D1, KV, Queues, or Worker API is required for the current browser-only scope. Do not add them without a documented feature need, privacy review, and cost/limits assessment.

**Production launch:** separate owner approval after issue #8, real-host verification, and review of name/trademark risk. Publishing the GitHub source and hosting the application are different decisions.
