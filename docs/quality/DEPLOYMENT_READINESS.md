# Deployment readiness — evidence and outstanding gates

Status: **NOT READY FOR PUBLIC HOSTING**. Prepared 2026-10-12 UTC from private repository documentation and GitHub Actions metadata. This is a working evidence index, **not** a release approval, security certification, trademark clearance, or substitute for device testing.

Release authority: [issue #8](https://github.com/rlawoals0529/Astralys/issues/8), [AGENTS.md](../../AGENTS.md), [security policy](../../SECURITY.md), [threat model](../security/THREAT_MODEL.md), [fidelity protocol](../quality/RELEASE_EVIDENCE_CHECKLIST.md). Do not deploy, change visibility, or enable remote uploads without explicit owner approval.

## Verified engineering evidence

| Item | Evidence | Interpretation |
| --- | --- | --- |
| Production app | [README](../../README.md) | Browser-local PNG/JPEG/WebP edits, image/PDF exports, batch and multipage PDF; no provider downloader or general PDF editor. |
| PR #43 PNG CRC validation | [merged change](https://github.com/rlawoals0529/Astralys/pull/43) | Checksum validation and synthetic corruption regression integrated into main. |
| PR #44 unknown critical PNG chunks | [CI run 38193704672](https://github.com/rlawoals0529/Astralys/actions/runs/38193704672) | Exact head `7c1ff23ba030e2ae46985b1cb541ab5a8dfec871`: web, photo-spike and memory-harness jobs all succeeded. **Not merged as of this record**; do not count its parser guard as shipped. |
| Automated browser memory | [measurement harness](../../scripts/measure-browser-memory.mjs) and CI memory-harness job | Linux /proc process-tree RSS sampler exercises 20 exports, eight-image batch, multipage PDF, cancellation/recovery and object-URL/worker cleanup in Chromium and Firefox. CI job passed, but artifact contents and numerical peak RSS have **not been independently reviewed here**. These samples are not physical-device leak proof. |
| PhotoCraft | [isolated spike report](../reports/PHOTO_MULTITILE.md) | WASM experiment, **not integrated into the production editor**. |
| Browser image/PDF | [image-PDF report](../reports/IMAGE_PDF.md) | Synthetic verification; not a general PDF tool and not proof of real-world color accuracy. |

## Release-gate matrix

Use **OPEN**, **PARTIAL**, or **VERIFIED** only with traceable evidence. An automated pass never substitutes for manual accessibility, color or legal review.

| Gate | State | Required evidence before public launch |
| --- | --- | --- |
| All-history and Actions secret/data review | **OPEN** | Inspect all reachable Git history (including deleted files), Actions logs and uploaded artifacts; document method, scope, reviewer, findings and any credential revocations. No secrets or personal media in reports. |
| Dependency, upstream licenses and notices | **PARTIAL** | Lockfile/audit/license inventory and pinned Actions are present; review committed assets, PhotoCraft notices, provenance and distributable bundle. Record sign-off. |
| Naming and trademark | **OPEN** | [Naming notes](../legal/NAMING.md) identify unrelated Astralys uses. Review trademark/common-law/domain usage in launch jurisdictions or rename; no clearance claimed. |
| Private vulnerability reporting | **OPEN** | Verify a private contact/reporting channel end-to-end and update SECURITY.md before publication. Do not invite exploit details into public issues. |
| Repository configuration | **OPEN** | Before any visibility switch, inspect branch protections, Actions permissions, dependency alerts, artifact exposure and Security settings. |
| Public-alpha claims | **PARTIAL** | README accurately labels private milestone; revise for exact public-alpha capabilities only when release decision is made. Explicitly exclude YouTube, remote fetch, audio/video conversion, PDF editing and production PhotoCraft. |
| EXIF orientation | **PARTIAL** | Synthetic metadata stripping tests exist; require permission-cleared asymmetric orientation=6 JPEG rendered and downloaded in both browsers, checked against independent local viewer. Record whether pixels or metadata apply orientation and avoid double-rotation. |
| ICC/color fidelity | **OPEN** | Test licensed real ICC-profile JPEG and PNG in Chromium/Firefox against color-managed reference viewer; record source/working/output profile handling, pixel/color shifts and user-facing limitations. No fidelity guarantee yet. |
| Real-image and corrupt-input matrix | **OPEN** | PNG, JPEG, WebP, alpha, screenshots, low-light, near-limit raster, malformed/oversized inputs; record SHA, permissions, browsers, output and visual observations without committing private originals. |
| Memory/lifecycle | **PARTIAL** | Automated Linux RSS and resource checks exist. Review recorded peaks and repeat on representative low-memory devices; assess 20 exports, eight-image batch, PDF and cancellation. Do not mistake JS heap, sampled RSS or 96 MiB RGBA estimate for a hard total-process cap. |
| Keyboard, screen-reader, touch | **OPEN** | Manual keyboard pass at 320/390/768px and 200/400% zoom; VoiceOver/NVDA/TalkBack as available; iOS Safari and Android Chrome touch. Record blockers and fixes. |
| Security/privacy | **PARTIAL** | No upload, telemetry, persistence, or remote-provider backend by design; still require threat-model review, CSP and malicious-file verification on release SHA. Browser native codecs remain in the trusted computing base. |
| Final release candidate | **OPEN** | Exact candidate SHA: all required web/photo-spike/memory CI green, browser screenshots reviewed, blockers resolved, owner approval recorded in issue #8. |

## Hosting design decision (not deployed)

The current application can be hosted as immutable static assets behind HTTPS; a static-assets deployment (for example, Cloudflare Workers Static Assets or Pages) does **not** require a file-upload API. Keep all image processing inside browser workers and disable remote media. Hosting provider choice does not eliminate local browser memory, codec or color risks. Before selecting production hosting, verify response security headers/CSP, caching for hashed assets versus HTML, rollback procedure, custom-domain/trademark decision, build reproducibility and a smoke test on a **nonpublic** candidate. Never add server-side upload storage or third-party analytics as a shortcut.

## Handoff procedure

1. Recheck GitHub PR heads and CI before merging; do not infer mergeability from old runs.
2. Review downloadable CI evidence, including memory JSON and screenshot artifacts, without treating synthetic fixtures as manual proof.
3. Resolve the OPEN gates with concrete records and issue links; avoid unverified checkmarks.
4. Prepare a candidate commit and owner-facing release decision, then **wait for explicit approval** before public deployment or visibility changes.
