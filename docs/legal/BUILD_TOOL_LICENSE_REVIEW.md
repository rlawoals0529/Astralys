# Build-only MPL review

Vite 8.3.4 resolves Lightning CSS 1.33.0 and optional platform binaries under MPL-2.0. Its installed package manifest and complete LICENSE were read on 2026-10-09. Repository: https://github.com/parcel-bundler/lightningcss . Exact package tarball/integrity appears in package-lock.json and development-dependencies.json; no Git revision inspection is claimed for this package.

MPL is file-level copyleft with contributor patent provisions. Source modification and commercial distribution are permitted subject to the license. Distributing covered executables requires making corresponding covered source available and retaining notices. Browser/WASM distribution of the tool itself would carry those conditions; it is not approved here.

This project uses unmodified Lightning CSS only as a development/build tool. It transforms our CSS; neither its executable nor source is bundled into the static application. `node_modules` is not committed or packaged. This is why the project can retain MIT for its own source/output, rather than treating a build tool as a permissive runtime dependency. If that distribution boundary changes, re-review it. The license gate permits only this named MPL family, not arbitrary copyleft additions.

Primary terms: https://www.mozilla.org/en-US/MPL/2.0/ and https://www.mozilla.org/en-US/MPL/2.0/FAQ/ . No claim of legal approval.
