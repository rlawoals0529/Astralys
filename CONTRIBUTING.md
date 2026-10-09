# Contributing

Use Node 24. Run `npm ci --ignore-scripts`, `npm run check`, and `npm run test:browser` (after `npx playwright install chromium firefox`). Changes need a focused explanation, useful boundary tests and updated capability/license documentation. Do not add runtime packages merely to simplify one operation.

Keep files local by default. Do not add a URL fetcher or archive extractor before the threat-model acceptance tests exist. Changes to providers, dependencies, output metadata handling, codecs or WASM require security and license review. User files never belong in fixtures; generate synthetic inputs.

The isolated Rust spike has separate commands and obligations; see spikes/photocraft/README.md. No deployment or publication is authorized.
