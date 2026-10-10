# Local image-to-PDF boundary

Decision, 10 October 2026: implement one raster image per PDF page using original code and browser JPEG encoding. Do not import a PDF parser or accept existing PDFs. Existing pdf-lib evaluation remains a future candidate, not an installed dependency.

Format reference: ISO 32000-1:2008, clauses 7.5 (file structure/xref), 7.7 (document/page tree), 8.9 (image XObjects), 7.4.8 (DCTDecode), retrieved from https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/PDF32000_2008.pdf (SHA-256 `9de0ca9e8570d6209e8bd48a355be8eb6ec376acfc3fc3ae97cd8730351417ff`) . This is specification research; no implementation, samples, trademarks or assets are copied. The original writer remains covered by Astralys's MIT license. The specification itself is not redistributed.

Flow: bounded image decode → existing resize/Photo transform → white-backed JPEG re-encode → metadata removal → fixed five-object PDF → explicit download. All work stays in the disposable worker. PDF output never becomes an embedded browser document or image preview. Source bytes, filenames and metadata never become PDF syntax. The writer accepts only the freshly encoded internal JPEG, not arbitrary user JPEG streams. Require baseline 8-bit three-component JPEG with matching dimensions. Reject unexpected browser encoding.

Page size preserves image aspect ratio at 96 pixels/inch (0.75 PDF points per pixel). No margins, text layer, forms, JavaScript, links, embedded attachments, document info, XMP, encryption or remote resources. JPEG is lossy; transparency becomes white. No claims of searchable text, PDF/A, PDF/UA, archival fidelity or accessibility of rasterized text. Input, pixel, worker deadline and output bounds remain enforced. Cancel terminates the worker and releases the job.

Verification: byte-level xref/stream/page tests, Chromium/Firefox downloads, and independent local Poppler pdfinfo/rasterization of synthetic output. Poppler 26.05.0 is an externally installed verification utility, not an application dependency or redistributed binary. No PDF library, font or codec package is added to the product.
