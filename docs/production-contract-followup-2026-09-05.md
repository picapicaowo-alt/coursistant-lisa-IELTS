# Production contract follow-up — 2026-09-05

This frontend change responds to the supplied Production backend update and the
user's `production-function-problems-2026-09-05.md` incident record. That record
is historical evidence: it documents the unversioned personal-event DELETE 500,
Instructor file/link upload 403, and course-members 403 affecting both roster
and report student selection. It is not a post-update backend acceptance result.

## Frontend behavior

- Personal-event deletion sends the current response's `version` as the
  `expectedVersion` query parameter. Invalid/missing versions are blocked by the
  service. Both editors use `version`, without an undocumented `eventVersion`
  fallback. Failed mutations retain the event; successful mutations invalidate
  the list/calendar. A version conflict rereads details, presents a localized
  message, and requires another deliberate user action. The Calendar dialog
  resets its delete confirmation. Failed refresh blocks further writes.
- PARAM_MISSING, BAD_REQUEST and PERSONAL_EVENT_VERSION_CONFLICT have distinct
  English, Simplified Chinese and Traditional Chinese messages.
- Course access rejects an explicitly inactive enrollment. Legacy membership
  responses without `active` remain compatible and server authorization is
  authoritative. Roster access depends on enrollment, not global Instructor
  level alone. The route admits eligible account categories; known Student/TA
  or inactive enrollment is denied by the page. When membership information is
  unavailable, the members endpoint decides. 403 and 404 display unavailable
  states without roster controls and without automatic retries.
- Roster read access does not grant enrollment, withdrawal, TA promotion,
  demotion or permission changes. Both UI controls and the mutation hook enforce
  the separate management gate. Existing System Admin management remains in its
  existing boundary; Advisor delivery/member management is not changed.
- The report student picker uses the existing paginated members endpoint and
  hides selection after 403/404. Successful options come from returned members.
- Instructor/TA material upload retains `files`, `linkUrl`, `linkDisplayName`,
  FormData and UUID idempotency keys. The shared HTTP client removes its JSON
  content type so the browser creates the multipart boundary.
- Material management now has a separate component permission. Instructor and
  TA course workspace callers do not infer Course Manager authority from week
  editing or upload permission: publish/unpublish, rename, move, reorder and
  deletion of another uploader's material are unavailable there. Deleting one's
  own material retains the existing upload-owner rule. This follows the new
  handoff even though the historical report observed an Instructor publish
  succeeding on the previous backend.

## Contract provenance

The frontend currently consumes handwritten services/types and
`docs/api/course.openapi.yaml`; no OpenAPI client/type generation task is
configured. The supplied path `docs/api/feature-registration/course.openapi.yaml`
is absent from this checkout. The existing consumed snapshot was annotated only
for the supplied three-operation authorization/error changes, preserving paths,
request schemas and the required DELETE version parameter. This is a scoped
handoff alignment, **not** a claim that the full latest backend export was
retrieved or regenerated. Import/reconcile that full export when provided.

The API base URL, environment inputs, backend services, databases and deployment
were not changed by this work. The shared checkout contains other uncommitted
frontend work; this change does not represent a clean release snapshot.

## Verification

See the verification results recorded below. All browser API calls use local
fixtures. They do not establish authenticated Production acceptance or prove
that the updated backend permits the real Instructor account. The three real
Production workflows still need post-deployment acceptance using current event
versions and course enrollment: delete a disposable personal event, read members
and select a report student, upload a file and a link.

### Results

- Full Vitest run: 155 files / 778 tests passed. This run preceded the final
  error-copy helper/test-fixture refinements and shared compile alignment.
- Subsequent focused runs: 20 tests passed for the final error helper, Calendar
  conflict recovery, roster and report picker; 10 tests passed after the final
  typed picker fixture correction, including the learning-data regression.
- Shared i18n checks: static references/parity passed; 42 locale tests passed.
- Final production-preview Chromium run: **14 passed**, covering the roster,
  forbidden/not-found/inactive access, file/link multipart headers and UUIDs,
  and Calendar create/edit/delete retries in all three locales at 390/1440 px.
- Final application typecheck, production typecheck and lint passed.
- Final Production build passed, retaining the existing >500 kB chunk warning.
  An intermediate build exposed a shared StudentLearningPage import mismatch:
  `DETAIL_LABELS` had been renamed to `DETAIL_LABEL_KEYS`. Its four stale usages
  now consume the keys and translate at render time; the final build passed.
- Consumed OpenAPI YAML parsed successfully with all three operation IDs intact.
- Scoped diff whitespace checks passed. No full-site browser suite, merge,
  deployment or authenticated Production mutations were performed.

## Production release preparation

The user subsequently authorized push, merge and Production deployment. Release
work is isolated on `codex/production-contract-followup`, based on current
`origin/main` (`7faf370` at preparation). Only the three-operation fixes and
necessary shared locale entries were ported; current main's report pagination,
course delivery capabilities, production vocabulary routing and material browsing
remain intact. The unrelated shared-worktree StudentLearningPage compilation fix
and unfinished sitewide locale migration are not included in this release branch.

Clean-branch dependency installation retained the lockfile. Both typechecks,
lint, Production build and 157 Vitest files / 773 tests passed. The old Instructor
material rename and TA-management browser expectations were aligned to the new
permission boundary: Instructor upload/own deletion is separate from management;
the existing System Admin TA-management modal still has focus/mobile coverage.
Final browser and deployment results are recorded in the local release evidence
under `output/production-contract-release-20260905/` and the release summary.
