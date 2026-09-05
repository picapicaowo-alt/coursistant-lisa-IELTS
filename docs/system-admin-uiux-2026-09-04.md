# System Admin workspace redesign

Scope: frontend only; SYSTEM_ADMIN, independently of TENANT_ADMIN. No release,
backend repair, database access or environment changes are included.

## Behavior and reuse

- The people directory is the primary workspace. Search, status/tenant filters
  and ten-row pagination operate on the existing `GET /v2/users` array.
- Existing `PersonCell`, `TeachingDialog` and `TeachingState` supply identity
  presentation, modal focus containment and loading/error/empty states.
- Page-local components separate account creation, account actions, the
  directory and audited operations. Scope is always `system`, never a form value.
- Existing account payloads, idempotent service methods and explicit change
  review are retained. There is no invented System Admin enable endpoint.
- Course membership and course catalogue reuse `SystemCourseFilters` with the
  consumed `q` and system-only `tenantId` parameters. Changing filters resets
  local pagination/selection. Enrollment remains course-scoped with partial-TA
  failure feedback preserved.
- The tenants view groups observed account tenant IDs; it does not claim a
  complete registry, tenant names, or unsupported creation/editing capabilities.
- Operations shows one task at a time: administrator directory, notification
  digest, primary instructor reassignment or audited grade correction. The
  digest receives all loaded users, independent of personnel search filters.
- System exam search/pagination and section review reuse existing transport,
  record renderer and protected media. No exam write capability is invented.
- New copy lives in the shared English, Simplified Chinese and Traditional
  Chinese resources. API identifiers and user/learning content remain unchanged.

## Production course diagnostic — read-only

Observed in the user's existing SYSTEM_ADMIN session, `admin@example.com`, at
`https://app.xlearnedu.com/course` on 2026-09-04:

1. The browser sent `GET https://api-cn.xlearnedu.com/api/v2/courses?page=0&size=20`.
   HTTP 200, `code: SUCCESS`, `data: {items: [], page: 0, size: 20, total: 0}`.
   Response timestamp: `2026-09-04T23:17:18.788595245Z`.
2. A same-session GET with `tenantId=1` also returned HTTP 200, SUCCESS,
   `total: 0`, `items.length: 0`.
3. The empty display follows the supplied response. This is not evidence that
   every tenant has no courses, nor proof of a backend defect. The screenshot
   does not demonstrate course data in this production environment.
4. The checked-in contract `docs/api/course.openapi.yaml`, operation `courseList`,
   permits `q`, `state`, `tenantId`, `page`, `size`. No state/tenant filter was
   supplied in the original request. The frontend uses the correct browse
   endpoint and consumes the returned `items` page.
5. The currently open Dev tab is a different Tenant Admin account. It cannot
   establish production System Admin behavior and was not used as such evidence.

External follow-up: confirm the production course inventory and intended
SYSTEM_ADMIN default scope, then compare a known existing course's tenant ID
with this account's browse response. Do not change backend data to make the UI
look populated. No real enrollment, role, digest or grade writes were performed.

## Validation

- Zero-warning ESLint, normal TypeScript and production TypeScript checks passed.
- 11 focused Vitest files / 54 tests passed, including locale parity, switching
  locale while preserving an open creation draft, role separation, existing
  enrollment/partial-TA behaviors, and shared record rendering.
- 5 Chromium fixture E2E tests passed. The responsive matrix covers 10 states
  across English, Simplified Chinese and Traditional Chinese at 1440 and 390 px;
  it includes account confirmation/payloads, no tenant-only requests, explicit
  course query filters, reload persistence and page-error checks.
- Independent read-only design review inspected 12 representative captures and
  source; disposition: ship, with no material findings. It did not rerun tests
  or independently verify real authorization.
- Screenshots: `output/system-admin-redesign-20260904/screenshots/`. All people,
  courses and papers in these captures are synthetic test fixtures.
- Final production build and all five Chromium fixture tests passed after
  formatting and export cleanup. The build retains its chunk-size advisory.

Fixture browser tests are separate from the two authenticated production reads
above. No full repository unit/E2E run, merge or deployment is claimed.

## Production integration

The release is assembled in an isolated worktree from the current GitHub main,
not from the older, dirty preview checkout. It preserves already-released course
Current/Completed filters, launch-state management restrictions, structured
instructor/profile names, modal pending-fieldset protection, and contextual
permission errors. The course catalogue retains shared cards and real links.

Admin and its shared controls use the existing i18next architecture with English,
Simplified Chinese and Traditional Chinese resources. Shared locale persistence,
formatting and missing-key warnings are included as necessary dependencies. The
existing global language-picker rollout gate remains closed; this release does
not claim completion of the separate sitewide localization migration.

Modal centering is fixed in TeachingDialog after the global CSS margin reset.
Unselected operation hover uses a gray outline and subtle shadow without a fill;
only the active operation retains the purple selection surface. Browser tests
check dialog centers at both viewport sizes and distinguish hover from selection.

Legacy system-admin browser tests now open the create-account modal and close it
before navigating to tenant-account summaries. Mutation payload/idempotency and
forbidden tenant-request assertions remain intact. Post-mutation dialog dismissal
waits for the existing pending lock to finish.

Deployment and live evidence are recorded separately under
`output/system-admin-prod-20260904/`; fixtures do not establish real course
inventory or authenticated write acceptance.
