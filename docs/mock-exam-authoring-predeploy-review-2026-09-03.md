# Mock Exam authoring — pre-deployment review

Scope: Tenant Admin authoring only, released through the independent IELTS frontend to Dev 8085. The release branch starts at `7f8291c` and excludes unrelated changes in the shared working checkout. No backend, environment, proxy, credential, package manifest or lockfile changes.

The user subsequently added complete Reading JSON import to this same release. Merge/deployment were held while that addition was implemented. The initial CI found an optional-schema narrowing error in a new preview test; the test now captures a checked schema before its callback. Refreshed release checks are required before merging the extended scope.

## Review outcome

| Area | Evidence and result |
| --- | --- |
| Supplied design | Preserves full-width Part Settings → Content → Media → Question Configuration, section tabs, part pills and bottom actions. No competing outline/sidebar. Shared app shell is retained, not claimed pixel-identical. |
| Hardcoding | Production authoring changes contain no deploy URLs, account values, tenant IDs, credentials, arbitrary colors or duplicated API routes. Reuses semantic tokens and existing API services. Local control dimensions are presentation values; generated part/task labels derive from sequence. |
| Question types | Section-specific registry mirrors typed existing student renderers, not an invented backend enum. 23 guided types have validation and actual renderer tests; Listening plan/map remains advanced. |
| API requests | Checked against `docs/api/mockexam.openapi.yaml` and existing service tests: template/version lifecycle, whole-section POSTs, multipart media upload, authenticated blob preview and scoped media deletion. No saved-section PUT/PATCH exists and none was added. |
| Authorization | Existing Tenant Admin route guard, account/template/version-scoped drafts and tenant routes remain intact. The server remains the authorization authority. Fixtures cannot establish live permission acceptance. |
| Data preservation | Unknown/imported data and nested answer metadata survive display edits. Type replacement and draft discard require confirmation. Discard does not delete uploads or another section's draft. |
| Complete Reading JSON import | File and paste entry points validate and populate the same manual editor. Loading is not a backend save. Whole-section POST remains unchanged; image IDs must exist as uploaded Reading images in the current version. Sparse sequence/order values, custom payloads, nested answers and structured paragraph JsonNode are retained. Unknown request-level fields fail visibly rather than being dropped. |
| Failure/concurrency | Failed saves retain the same draft for retry; hidden-part validation navigates to errors. Existing content-write locks and identity-based delayed-media safeguards remain intact. Saved sections are read-only. |
| Preview | Uses existing student renderers and local answer state; preview answers are never submitted. Schema projection prevents extra imported fields overriding preview identity/content. Protected media uses the existing authenticated preview route. |
| Responsive layout | Full guided save/retry flow tested at 1752, 1440, 1024 and 390 px. Additional 320/768 px long Chinese, German and emoji content tests verify no page overflow before/after validation. Typography, control height and alignment are asserted. Desktop and phone captures inspected. |

## Defects found and corrected before release

1. Imported top-level `id` could be miscounted as a question number during automatic range updates. Number extraction now follows only active schema-marked answer slots; root metadata, answer keys and dormant text-cell IDs are ignored and preserved. Regression tests cover this at schema and editing levels.
2. Matching-style options could share a key, making student responses ambiguous. Duplicate option labels are rejected for matching, headings and sentence endings.
3. Diagram help text referred to an image control “below” after Media moved above it. Copy now identifies the Media section without a stale directional reference.

## Local validation

- Clean isolated `npm ci`: passed; lockfile unchanged.
- `npm run lint:ci`, `npm run typecheck`, `npm run typecheck:production`: passed.
- `npm run test:run`: **142 files / 629 tests passed**, including all 23 guided renderer cases.
- `npm run build`: passed.
- `npm run build:dev`: passed. Full Dev-build preview E2E: **169 passed**, including small-screen/long-content cases.
- Impeccable static detector: no findings. Manual review scores: accessibility 3/4, performance 3/4, theming 3/4, responsive design 3/4, implementation integrity 4/4 (16/20). These are review judgments, not WCAG certification: screen-reader acceptance, exhaustive zoom/device coverage, dark mode and runtime performance profiling were not completed.
- `git diff --check`: passed.

## Known boundaries / non-blocking inherited findings

- `npm ci` reported **5 moderate dependency advisories**. A fresh audit request timed out at the npm advisory endpoint, including a bounded retry. This is not a clean dependency-security bill; no dependency upgrades are included in this UI release.
- Generic `kind: string` / `JsonNode` in the supplied OpenAPI does not specify accepted authoring/answer-key/scoring schemas. Guided content matches existing frontend renderers, but live backend acceptance and grading for every type cannot be established by fixture tests. The contract handoff remains in `mock-exam-authoring-ux-2026-09-03.md`.
- No authenticated Tenant Admin business write was performed in this pre-deployment review. Public HTTP, static hashes, CI and simulated requests are separate from a real tenant creation/upload/save/publish/marking walkthrough.
- GitHub merge and immutable Dev 8085 deployment are recorded separately after their gates pass. No 8084 or Prod release is authorized.
