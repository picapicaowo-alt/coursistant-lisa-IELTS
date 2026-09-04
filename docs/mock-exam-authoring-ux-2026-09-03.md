# Mock exam authoring: guided frontend workflow

## Scope and acceptance boundary

The implementation-stage evidence below predates the release request. See `mock-exam-authoring-predeploy-review-2026-09-03.md` for the subsequent isolated release audit and its acceptance boundaries.

Tenant Admin mock-exam authoring now supports section-specific question-type selection, structured content forms, plain-text reading paragraphs, content previews, whole-section checks and an explicit final review. The existing X-Learn tokens and Administration shell are retained. No backend, environment value, deployment, credentials or production record is changed.

This is **frontend display/content authoring**, not a newly specified grading contract. `docs/api/mockexam.openapi.yaml` still exposes `kind: string` and a generic `JsonNode` payload. The form registry mirrors the existing Listening/Reading student-renderer types, using a TypeScript `satisfies` boundary to constrain their discriminants. It is not an authoritative list of backend-accepted authoring kinds. No answer-key field, scoring rule, endpoint or saved-section update operation has been invented.

## User workflow

1. Create or open the existing template draft and choose Listening, Reading or Writing.
2. Set the whole-section duration. Part/Passage/Task display names default to their sequence and remain customizable. Defaults are applied to outgoing requests without marking a pristine local draft as edited.
3. Select a question type. Guided types reveal content fields, repeatable question/option/blank rows, and automatic range updates. Add further groups and parts as needed. Reading paragraphs use ordinary text fields; Writing retains its prompt, minimum words and optional image.
4. Preview supported complete content through the existing student renderer. Preview answers are local component state and never enter the draft, storage, or API request. Images use the existing protected-media preview controls rather than arbitrary preview URLs.
5. Review the whole section. Validation includes hidden parts, missing content/audio, positive numbers, duplicate/overlapping ranges, range/content alignment, option letters, multi-select slot counts and table widths. Errors identify a unit/group and provide navigation back to it.
6. Confirm the single whole-section POST. Failure keeps the review and draft available for retry. Once saved, content stays read-only. Template copy/archive/delete and the original three-section publication preflight are unchanged.

## Data integrity and compatibility

- Existing tab-local storage format and account/template/version isolation remain unchanged.
- Form writes replace only the edited known field. Other object fields, including existing nested answer metadata, are preserved.
- Switching a populated question type requires an explicit replace/cancel decision. The warning includes existing answer data; cancellation leaves the payload unchanged.
- Unknown/custom question codes remain available through Advanced data. Malformed JSON and incompatible imported structures are shown for correction, never coerced or overwritten automatically.
- Reading string-array paragraphs have a plain-text editor. Existing structured paragraph arrays remain in Advanced paragraph data, preserving formatting and content.
- Listening plan/map labelling remains an advanced type: the supplied media contract has no Listening image authoring kind. Existing payload use remains available; no storage URL or upload route is fabricated.
- The shared recursive field renderer stays page-local. It renders labelled controls and repeatable content, and does not own API state. The existing composer/media mutation keys and functional identity-based draft updates remain in place.

## External contract still needed

The API owner should supply the accepted question-kind list by section, per-kind payload schemas and examples, answer-key/alternative-answer formats, scoring/normalization rules, and image binding for Listening maps. Saved section editing also still requires explicit version-checked update operations. Content preview and passing frontend checks do not establish backend creation/marking compatibility.

## Verification

Automated validation uses isolated fixtures, never real tenant data. The added tests cover guided forms, raw-data preservation, automatic numbering, replacement confirmation, hidden-unit checks, preview-only answers, all-section submission, retry behavior and read-only results. Desktop/mobile captures are stored locally under `lms/.impeccable/review/mock-authoring/`; these are synthetic visual evidence, not authenticated acceptance or a deployment.

Final working-checkout results:

- `npm run lint:ci`, `npm run typecheck`, and `npm run typecheck:production`: passed.
- `npm run test:run`: 141 files / 609 tests passed. This includes other pre-existing work in the shared checkout.
- `npm run build`: passed.
- `CI=1 PLAYWRIGHT_PORT=4219 npx playwright test e2e/mock-exam-authoring.spec.ts e2e/tenant-admin-design.spec.ts --workers=2 --retries=0`: 14 tests passed. The complete repository E2E suite was not run for this localized authoring change.
- Desktop (1440px) and phone (390px) guided form/review screenshots inspected; the existing tenant layout test additionally covers 1714px and 390px surfaces and horizontal overflow.
- One Impeccable detector pass: no findings. One visual correction batch and a confirmation pass completed.
- `git diff --check`: passed. Package manifests, lockfile and consumed OpenAPI are unchanged.

The API's section-create operations do not define an idempotency header; the existing client behavior is preserved. Existing media-upload idempotency tests still pass. No authenticated live business acceptance, Git commit/merge or deployment is claimed.

## Supplied-design correction

The user supplied the complete Tenant Admin composer reference and rejected the added right-hand outline and collapsed core fields. That reference supersedes the earlier 8+4 authoring layout. The implementation now retains the reference's full-width sequence: Part Settings, Content, Media, Question Configuration, and the bottom action bar. The extra builder introduction and outline have been removed. Reading and Writing retain their corresponding content and media requirements.

- Question titles and student instructions are always visible. For a single-group part, first/last question numbers appear in Settings as in the reference. When a part contains multiple groups, their ranges appear in their respective Content blocks: the API owns group ranges, not an additional editable part-range field.
- Guided question-type selection, structured fields, advanced JSON compatibility, previews and whole-section validation remain available in Question Configuration.
- The page uses shared tokens: 16px labels/inputs, 22px section headings, a 24px input line height, comfortable card padding, and full-width aligned surfaces. The three subject tabs fit on a 390px phone without truncating Writing.
- The reference's action placement is preserved. The primary action is labelled **Review & save**, because the consumed API creates a complete section and locks it afterward; it cannot truthfully be a per-part update. **Discard draft** explicitly confirms discarding the current unsaved section only. It preserves other sections and does not delete uploaded media.
- Breadcrumb navigation retains access to the template library and version overview; the existing working-version selector remains available. No example part count, template title or backend type code from the artwork is hardcoded into production.

Reference-alignment evidence is captured with isolated sample data under `lms/.impeccable/review/mock-authoring-reference/` at 1752px (the supplied reference width), 1440px, 1024px and 390px. These images demonstrate frontend structure and spacing, not authenticated live acceptance. The common application shell remains the repository's existing shell.

Correction verification:

- Scoped ESLint, production TypeScript check, and the four authoring unit-test files passed (21 tests).
- The production build passed. An initial build was blocked by an unrelated missing Advisor Sass token; no Advisor files or shared token definitions were changed by this task. That shared-checkout blocker was absent on the final build.
- Source-preview E2E: all 13 authoring/media cases passed. Built-preview E2E: 12 passed on the first run; the 1752px end-to-end scenario exceeded its 30-second overall budget. Its isolated rerun passed in 6.2 seconds with a 60-second cap. No product timeout or network contract was changed to make the test pass.
- Tests assert full-width section order, permanently visible content fields, control typography/height, aligned fields, phone tabs and horizontal overflow; they also retain whole-section saves, retries, locked saved content, media identity/deletion and hidden-part validation checks. Discard cancel/confirm checks verify preservation of other sections and uploaded files.
- Desktop/reference-width, tablet and mobile screenshots were inspected. One correction batch fixed phone-tab clipping and header/media-action alignment, followed by confirmation screenshots. The existing shell is not represented as a pixel-identical recreation of the reference shell.
- `git diff --check` passed. The package manifest, lockfile and consumed Mock Exam OpenAPI are unchanged. No merge, deployment or live tenant-data write was performed.
