# Third-party notices

Astralys original source is MIT (LICENSE). No affiliation with ArtCraft or Adobe is implied. No ArtCraft or Adobe branding/assets are included in the application. Research copies of license/NOTICE texts under docs/legal/evidence remain the original upstream texts, not a relicensing of those projects.

The browser app has zero production npm dependencies. Vite (MIT) produces its bundle and may emit support code; its license is preserved in public/THIRD_PARTY_NOTICES.txt, which ships with the static output. Fonts are supplied by the user's operating system. The icon and sample illustration are original Astralys work.

The separate PhotoCraft spike consumes photocraft-color and photocraft-cms at the exact revision in its Cargo.toml/Cargo.lock. Upstream copyright: Copyright (c) 2026 ArtCraft Team and the PhotoCraft contributors. The MIT option is selected for dual-licensed code. Both upstream license texts and NOTICE are preserved in docs/legal/evidence/photocraft. Resolved dependency notices are under spikes/photocraft/licenses; dependency inventory is docs/legal/spike-dependencies.json. No upstream source was modified. This spike is not included in the browser bundle.

FFmpeg, ffmpeg.wasm, yt-dlp, PDF and archive libraries, font binaries, model weights and full Craft applications are not distributed by this application. Development tools have separate licenses; see docs/legal/DEVELOPMENT_DEPENDENCIES.md and BUILD_TOOL_LICENSE_REVIEW.md. Optional platform packages not installed locally have not had their binary contents audited.
