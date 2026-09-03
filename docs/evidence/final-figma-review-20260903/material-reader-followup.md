# Course reader supplemental review

The initial reader browser check confirmed a PDF Blob URL and successful download, but the screenshot showed an empty embedded viewer. That result was rejected: network success did not establish visible document content.

The reader now uses the already-locked PDF.js dependency to render protected bytes locally. The worker is bundled with the frontend. The view supports page navigation, responsive fit width, zoom, extracted screen-reader text and a recovery action that fetches fresh bytes. The original protected download remains available. No API route, environment input, dependency version or backend system changed.

`lms/e2e/material-reader.spec.ts` exercises:

- A local WebM video that actually plays after a failed-preview retry.
- A two-page PDF with painted canvas ink and extracted text, previous/next controls, endpoint disabling, zoom and responsive layout at 390px/1440px.
- A corrupt PDF that displays an error, then successfully reloads fresh protected bytes.
- A download response containing a JSON error, followed by a successful file download whose bytes match the source PDF.
- Material selection reflected in the URL, next-item navigation across weeks, a final LINK destination and return to the course.

The desktop view keeps an outline beside the dominant reading pane. At narrow widths the outline precedes the reader; zoom overflow is contained inside the PDF viewport. The Discussion/AI actions form the compact floating tool group shown in frame `498:4121`, with real route/assistant actions. Notes remains explicitly unavailable without a persistence contract. Screenshot paths and hashes are recorded in `material-reader-verification.json`; screenshots remain local under repository standards.

This is browser rendering and contract-shaped fixture acceptance. It does not certify authenticated access to live course files. PDF editing, form filling, annotation, document search and encrypted-document password entry are not part of the reader; the original file can be downloaded for those tasks. The broader 69-frame matrix, unsupported capabilities and all-role live API gaps remain in the parent report.
