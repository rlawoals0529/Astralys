# Cloudflare Workers Static Assets — deployment readiness only

## October 12, 2026: configured preview build repair

The user supplied the live URL `https://astralys.rlawoals0529.workers.dev` and authorized passing PR merges with automatic deployment. An HTTP check returned 200 with the expected closed-network CSP, nosniff, no-referrer and same-origin opener policy. This supersedes the historical no-deployment statements below for that supplied endpoint; account settings and release issue #8 remain unverified.

Cloudflare's supplied branch-build log completed `npm run build`, then failed `npx wrangler preview` because the configuration lacked `previews`. The top-level `previews = { }` follows [Cloudflare's documented static-assets example](https://developers.cloudflare.com/workers/previews/configuration/). Assets and compatibility stay top-level; no Worker code, routes, credentials, storage or preview bindings are added. The existing static-bundle guard requires an empty preview object. No dashboard/billing/visibility settings are changed. The configured Cloudflare integration may publish branch previews; repository privacy is not access control for their URLs. Successful hosting checks and served headers still require verification after the change.

Reviewed 10 October 2026. **No Cloudflare account connected, no Worker deployed, no domain configured, and no credentials stored in this repo.** Publication is prohibited until the release gate (issue #8) and explicit deployment authorization.

## Recommendation

Astralys is a TypeScript/Vite static user interface with Web Workers doing **all** currently supported image processing in the visitor's browser. Use **Cloudflare Workers Static Assets with no Worker script**. Cloudflare serves HTML/JS/CSS and worker JavaScript; raw images, their edited Blob URLs, downloads and batch image data remain local. Cloudflare and browsers still receive ordinary HTTP asset request metadata (IP, user agent, etc.); do not promise network anonymity.

The checked-in `wrangler.toml` has a single `assets.directory="./dist"` and no main Worker script, fetch handler, back-end media downloader, analytics, databases, secrets, routes, or worker-first requests. Vite's `public/_headers` is copied to `dist/_headers` and provides a strict static-response CSP, nosniff, referrer and frame protections. Avoid changing this to a Worker-script-first route without explicitly recreating headers in dynamic responses.

Cloudflare [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) supports serving bundled `./dist` files without a Worker script. [Headers](https://developers.cloudflare.com/workers/static-assets/headers/) documents parsing `_headers` in the asset directory. [Billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) describes static asset requests as free/unlimited while Worker-script invocations are priced separately. These policies can change; recheck them when publishing.

## Offline local preflight

Node 24.19.0 and `npm ci --ignore-scripts` are the existing project baseline.

```sh
npm ci --ignore-scripts
npm run check
npm run test:browser
```

`npm run check` now executes `scripts/check-static-assets.mjs` **after** the Vite build, asserting:
- `dist/index.html` contains the built app and an output JS bundle, not the development entry;
- static `dist/_headers` includes security headers and a closed network CSP;
- all bundle entries are ordinary files, without symlinks, private/development artifacts, source maps or unexpected binary/key/db payloads;
- a bounded file count and total byte budget;
- config does not add a Worker script, account ID, routed deployment or secrets.

`npm run preview` is a **localhost-only** verification server, not a Cloudflare deploy and not a substitute for checking headers on Cloudflare after eventual publication. Run the browser test suite for actual Chromium/Firefox behavior.

## Future steps — require explicit release permission

1. Complete issue #8: name/trademark, history/secrets, license notices and security disclosure review; real-world photo/accessibility and browser-process memory QA.
2. In an authorized environment, authenticate Cloudflare through its normal UI/CLI without committing tokens; validate the actual `dist` build and the Worker domain/name. **Do not deploy a public preview merely because the repo is private.**
3. Only after explicit permission, use a reviewed pinned Wrangler tool and the **static-assets-only** configuration to publish. Verify resulting CSP, MIME types for module workers, no unexpected fallback routing, cache revalidation and source-map absence from the public endpoint.
4. Keep server-side conversion / remote-link fetching separately gated, with provider rights, SSRF, duration/size limits and dependency-license review. Static hosting does not implement or authorize remote YouTube downloads.

## Future upload path (not enabled)

For a feature that genuinely needs remote files, do **not** change the default local-only editor or route uploads through this static-assets Worker. Use a **separate, auth/quota-controlled API Worker only for short-lived upload authorizations**, then direct, opt-in **R2 presigned PUT** from the browser to a private temporary object. Large binary bodies must bypass the 128 MB API Worker isolate; source files should remain as browser `File` objects rather than being copied to JS ArrayBuffers for transfer.

A presigned PUT URL is a bearer capability until expiry; CORS and MIME signatures are not upload-size enforcement, and R2 temporary-file lifecycle deletion is eventual. Full abuse protection, cost quotas, retention and cleanup require separate implementation and explicit approval. See [Cloudflare upload architecture and memory plan](../architecture/CLOUDFLARE_UPLOAD_MEMORY.md).

## Quality and privacy gaps

This configuration does not validate real Cloudflare hosting, Workers billing in the user's account, cross-device compatibility, Cloudflare dashboard settings, production traffic, RSS usage, ICC color management or EXIF rendering fidelity. No CI deploy tokens or Wrangler package dependencies have been added.
