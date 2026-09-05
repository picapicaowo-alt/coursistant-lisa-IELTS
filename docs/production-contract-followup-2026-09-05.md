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

The API base URL and tracked environment inputs are unchanged. Backend services, databases and infrastructure configuration are outside this frontend change.

## Release validation

The release is isolated on `codex/production-contract-followup` from current main, preserving the existing report pagination, course delivery capabilities, vocabulary routing and materials browser. The unrelated shared-worktree edits are excluded. Required checks cover lint, both TypeScript configurations, unit tests, the Production build and the full browser suite. Fixture tests are separate from authenticated Production acceptance; final results and rollback metadata are recorded in `output/production-contract-release-20260905/` and the release summary.

## IELTS TA availability

The IELTS product hides TA role filters, promotion/demotion, permission editors, and TA enrollment across the roster and System Admin membership workspace. Student enrollment and authorized withdrawal remain available. Existing API role values and response-backed historical members remain readable; this frontend change does not migrate memberships or change backend permissions. The administrator help text is aligned in all three locales.
