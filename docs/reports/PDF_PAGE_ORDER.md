# Arrange image pages before PDF creation

The image-only PDF composer now lists selected filenames in numbered order. Each row has keyboard/touch-operable Move up, Move down and Remove buttons. Native buttons expose page-specific accessible names; focus follows the moved page or the next remaining page after removal. First/last moves are disabled, all order controls lock during composition, and fewer than two remaining images disables composition.

Reordering, removal or resolution changes invalidate and revoke the previous PDF result. The selected array is the only application owner of source files after selection: the native input is cleared, allowing removed files to become eligible for collection. Choosing files replaces the selection, and Clear PDF drops all rows/references. No decoded thumbnails or extra Blob URLs are allocated for the page list. Filenames use textContent, never HTML.

The composer still accepts only 2–8 still images with 48 MiB combined input, processes sequentially with disposable workers, caps prepared JPEG data at 32 MiB and final output at 64 MiB. Existing PDF files are not opened. No remote uploads, persistent storage, dependencies or deployment are introduced.

Regression tests exercise keyboard focus, malicious-looking names, actual PDF embedded-image stream order, stale-result invalidation, removal/reselection, controls locked during a stalled worker, cancellation and screenshots at 320/390/768/1440 pixels. Exact CI results and screenshot inspection are recorded in WORK_HANDOFF.md; adding this report alone is not proof that those checks passed. Manual touch and screen-reader validation remain pending.
