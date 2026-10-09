# Media policy and release gate

Reviewed 2026-10-09. Engineering/product decision, not formal legal advice. All remote providers remain disabled. Pasting a URL classifies it locally; it triggers **no network request**, thumbnail fetch, metadata request, DNS lookup, or download. No YouTube API client, resolver, cookie import, user-defined command flags or yt-dlp integration exists.

| Class | Example | V1 | Conditions for a future implementation |
| --- | --- | --- | --- |
| A: supplied local file | A user's local recording | Images supported; audio/video planned | User must have relevant rights; file possession alone is not a rights clearance |
| B: authorized remote source | Explicit download endpoint for a user's own assets | Gated | Verify provider terms and permitted access method, ownership/permission basis, host allowlist, security tests |
| C: platform-restricted content | YouTube watch URL, including a creator's own upload | YouTube gated | Separate platform permission/terms and copyright analysis; an ownership checkbox does not settle platform restrictions |

## Primary sources

- YouTube Terms: https://www.youtube.com/static?template=terms (retrieved version dated December 15, 2023), Permissions and Restrictions and License to Other Users.
- API Services Terms: https://developers.google.com/youtube/terms/api-services-terms-of-service
- API Developer Policies: https://developers.google.com/youtube/terms/developer-policies (III.E.1 downloading/storage; also audiovisual separation restrictions).
- Authorized export information: https://support.google.com/youtube/answer/56100 and Google Takeout via https://takeout.google.com/ . Verify exact export route and current terms before describing supported integrations.

The retrieved general terms restrict downloading except through service authorization or prior written permission from YouTube and relevant rights holders. They also restrict automated access and interfering with copying/security restrictions. API policies separately prohibit downloading/storing audiovisual content without prior written approval and restrict separating audiovisual components. Do not assume copyright permission alone supplies platform permission. Applicable law and statutory exceptions vary and need jurisdiction-specific evaluation; a public service has additional exposure beyond an individual's local use.

Safe initial route: the user obtains their own export through a permitted provider flow and later supplies that local file. A future direct-file provider must be explicitly allowlisted and use only a permitted retrieval method. No public generic YouTube downloader launch is approved. No official YouTube API audiovisual downloading. No DRM/paywall/private-video bypasses, credential or cookie theft, or access-control evasion.

## Capability gate

`src/core/media.ts` is a local-only classification contract, with `enabled: false` for every provider. The YouTube resolver flag is fixed false, not a user-toggle or query parameter. No resolver implementation is supplied. Enabling any provider requires a code change, documented legal/product review and the backend acceptance gates in the threat model. Disclaimers or checkboxes are not technical or legal authorization.
