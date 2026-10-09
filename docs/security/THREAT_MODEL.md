# Threat model and trust boundaries

V1 has no remote-media backend, upload endpoint, telemetry, account system, persistence, service worker or third-party runtime script. Assets and original application code are same-origin. User files, names, MIME declarations, headers and link text are untrusted. The browser and its native image decoders are part of the trusted computing base. Worker isolation protects responsiveness and cancellation, not the browser from a codec vulnerability.

## Current controls and residual risks

| Threat | Control | Residual risk / verification |
| --- | --- | --- |
| XSS through filename/metadata | DOM textContent only; no user HTML, SVG or document embedding | Browser tests inject malicious names; no EXIF field values rendered |
| Unsafe SVG/PDF/HTML | Never render input in iframe/object; allow only PNG/JPEG/WebP decoding after header inspection | Magic signatures are classification, not malware scanning |
| MIME/extension spoofing | Byte signatures authoritative; explicit mismatch warning; never trust accept attribute | Malformed structure is rejected before native decode where checked |
| Decode bombs and memory/CPU exhaustion | 20 MiB input, 16 million pixels, 8192 maximum dimension, one job, 4096-chunk/segment cap, bounded output, 30-second worker deadline; predecode header dimensions | Browser/native transient allocations cannot be hard-capped by JS; host memory and codec bugs remain risks |
| Animated formats | Reject APNG and animated WebP; GIF unsupported | No silent first-frame conversion |
| Metadata leakage | Re-encode pixels; remove EXIF/XMP/IPTC/comments/ancillary metadata from supported outputs using a structural allowlist | Visible information remains; not anonymization; not a forensic erasure guarantee; color/orientation may change |
| Worker lifecycle | Terminate on completion, error, cancel, timeout, clear and replacement; stale job token ignored | Test repeated conversions and cancellation |
| Object URL leakage | Owned URL slots revoked on replacement/clear/pagehide; preserve original File separately for undo | Browser may retain data until GC; downloads are controlled by user/browser |
| Malicious names/path traversal | Output basename sanitized, separators/control/bidi characters removed, fixed extension; never used as filesystem path | User-entered names displayed only as text |
| Secret/dependency compromise | No env vars consumed by frontend; lockfile, clean install without scripts, SHA-pinned Actions, audit and license inventory | Audit databases are incomplete; package updates require review |
| Remote executable code | No plugins, eval or arbitrary WASM URL; CSP denies external scripts/connects | Spike stays outside production; WASM permission only if a reviewed local module is integrated |
| Retention/recovery | In-memory files only, explicit Clear, reset to original; no storage by default | Reload loses session, browser downloads remain; disclose this clearly |

## Future remote service: required before implementation

Small API/controller plus a separate sandboxed job/container service, never FFmpeg on an ordinary edge Worker. Static host remains replaceable. No endpoint is currently implemented.

- HTTPS only; reject credentials, nonstandard ports and unsupported provider hosts; parse canonical URL, never shell strings.
- Resolve all A/AAAA records through a trusted resolver; reject every non-global address including loopback, RFC1918, ULA, link-local, multicast, reserved, IPv4-mapped IPv6 and cloud metadata destinations. Do not rely only on regex or hostname text.
- Pin the validated public IP to the connection while preserving hostname for TLS/SNI; use an egress proxy/firewall that rejects internal networks. Disable implicit proxy env behavior. Repeat checks for every redirect and DNS resolution; cap redirects at 3. Avoid validation-then-independent-fetch DNS rebinding.
- Provider allowlist plus explicit per-path method rules, no open proxy; fail closed on ambiguous addresses. Never log full URL query strings/tokens.
- Enforce streaming byte caps, header/body deadlines, per-user/IP quotas and global concurrency/CPU/memory limits. Check actual bytes, not only Content-Length. Rate limit before creating jobs.
- Fixed executable path and structured argv arrays, no shell, arbitrary user flags or external protocol delegates. Restrict FFmpeg protocols and demuxers. No process environment credentials.
- Non-root container, read-only root FS, no outbound network for transcode processes, dropped capabilities, syscall restrictions, bounded PID/memory/CPU, kill process group on cancel/deadline.
- Unique ephemeral job directory, restrictive permissions, generated internal names, safe download disposition, TTL and cleanup in finally plus periodic janitor. Test failed jobs, crashes, restart and cancellation cleanup.
- Mandatory SSRF tests: localhost aliases, decimal/octal IPs, mapped IPv6, DNS with mixed public/private answers, rebinding, redirects to private/metadata networks, invalid TLS, overlong streams, gzip expansion, redirect loops, timeouts and cancellation. No backend should be added before these tests exist.

## Future archive service

Before extraction exists: reject absolute paths, drive letters, UNC paths, parent traversal with slash/backslash and encoded variants after canonicalization; never follow symlinks/hardlinks. Enforce file count, per-entry and aggregate expanded byte limits, depth and compression-ratio limits on streamed output, not only directory metadata. Test overlapping entries, duplicate names, zip bombs, nested archives, forged sizes, traversal and truncated input. No archive parser or extraction code ships now.

## Release blockers

Name/trademark review; full transitive licensing review for any Rust/WASM distribution; no public YouTube resolver; security disclosure contact/channel verification; visual/manual accessibility review; real-world browser/memory testing. Passing tests is not a security certification.
