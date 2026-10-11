# Image fidelity contract

## JPEG EXIF orientation

JPEG inspection reads the IFD0 orientation from one EXIF APP1 container, in either TIFF byte order. Display dimensions include the width/height swap for orientations 5–8 before raster memory admission. The browser applies rotation/mirroring during `createImageBitmap` with explicit `imageOrientation: 'from-image'`. Astralys then applies user edits to those displayed pixels and verifies decoded dimensions against the oriented inspection result. No second source raster is allocated to rotate EXIF pixels in application code.

Only the bounded IFD0 table is inspected (at most 512 entries). Invalid TIFF tables, duplicate orientation tags/EXIF containers and invalid orientation values fail closed. Thumbnail, GPS, nested and next-IFD pointers are never traversed. The application does not expose arbitrary metadata values. Freshly encoded exports still have EXIF removed: orientation is baked into pixels, not copied as a tag.

The regression corpus is original synthetic content generated in tests: four distinct non-square JPEG quadrants, all eight EXIF orientations, both TIFF byte orders, and malformed metadata. There are no third-party fixture assets or camera/private metadata. Browser tests assert preview corner colors and downloaded PNG/JPEG/WebP dimensions, colors and metadata absence against independent expected corner permutations. This is not representative real-camera coverage. PNG/WebP EXIF orientation remains a separate unverified case; this change only normalizes JPEG inspection.

## Color profiles and resizing

The production pipeline delegates source color conversion to the native browser decoder, draws into a default 2D canvas, and removes ancillary metadata from newly encoded output. It does not preserve an embedded ICC profile or provide an explicit end-to-end wide-gamut workflow. An APP2/ICCP/iCCP container's presence is not proof that a profile was valid or correctly applied. Display hardware, browser decoding, canvas conversion and encoder behavior can affect colors. Do not claim ICC accuracy, profile round-tripping, print fidelity or equal pixels across browsers.

High-quality canvas resampling is requested, with one bounded destination raster. Interpolation is browser-dependent; there is no multi-pass resize buffer or additional resampling dependency. JPEG and lossy WebP may change pixels; JPEG/PDF flatten transparency onto white. PNG is the appropriate output for exact opaque redaction interiors and alpha checks. Lossy edges can contain interpolation/compression artifacts, so users should cover the entire sensitive region with margin and inspect downloads.

Pending: valid synthetic/permission-cleared ICC fixtures with known reference colors, PNG/WebP EXIF behavior, diverse real photographs, and actual device/display comparison. Existing synthetic alpha, tonal, redaction and resize tests remain required. The release checklist and issue #8 are not satisfied by this regression matrix alone.
