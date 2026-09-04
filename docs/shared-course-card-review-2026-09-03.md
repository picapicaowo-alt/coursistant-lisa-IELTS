# Shared course card UI/UX review

## Decision and scope

The supplied Instructor My Courses screenshot is the reference. Reuse its
status/code row, title/instructor hierarchy, white rounded card, schedule/footer
divider and aligned actions. Reveal the blue-violet top bar on hover and keyboard
focus without changing geometry. Extend the existing `CourseIdentityCard` and
semantic tokens rather than introducing a second card family.

The user approved push, merge and deployment to Dev 8085 after review. The
release branch is isolated from the dirty original checkout and based on main
`7f8291c`. Only this card diff is transplanted; the newer Advisor version guards,
withdrawal reasons and complete-session preservation on main are retained.
Backend services, contracts, environments, accounts, USC 8084 and Prod are out of
scope. The original working tree is not reset or committed wholesale.

## Audited role coverage

| Role / surface | Collection and preserved contract | Reused presentation / preserved behavior |
| --- | --- | --- |
| Student, `/course` | `GET /v2/me/courses`; state, zero-based page, size 20; `/v2/me/progress`; existing course sessions read | Shared card and grid, status pills, assignment progress, view details; no staff actions |
| Instructor, `/course` | Same own-course read; course membership controls actions | Reference card now uses shared component; view details, course operations and manager lifecycle menu retained |
| Instructor Advisor, `/course` | Same own-course read and existing capability checks | Course operations and delivery destination remain available when authorized; no student progress |
| Advisor, `/advisor/courses` | `GET /v2/advisor/courses`; q, launchState, lifecycleState, page, size | Shared card/grid; search, both filters, pagination, grid/list switch, create control and manage delivery preserved |
| Advisor, `/advisor/students/:studentUserId/courses` | Existing student-scoped courses array and study-plan/version reads | Shared card/grid; lecture progress, course summary, enrollment disclosure and version-protected actions retained |
| Parent, portal dashboard and Learning → Courses | Linked-student dashboard currentCourses and `/v2/parent/students/:studentUserId/courses` | Shared read-only card/grid, returned assignment progress and detail disclosure; no general course or teacher API calls added |
| System Admin, `/course` | `GET /v2/courses`, existing admin browse scope | Shared card/grid with existing management controls; no invented tenant filter |
| Counsellor / Tenant Admin | No equivalent authorized My Courses catalogue in current role gates | No course page or permission added; existing dashboards/governance remain unchanged |

The retained dashboard-widget `CourseCard` adapter also consumes the shared
component. The current main Dashboard's assignment and compact course rows are
not replaced by larger cards. Course pickers, schedule occurrences and course
detail workspaces are not course catalogues and retain their own layouts.

## Implementation boundaries

- `CourseIdentityCard` only renders caller-provided data/slots. It neither fetches
  data nor derives permissions. Missing progress remains unavailable, not zero.
- `CourseCardGrid` uses container-aware three/two/one-column behavior within a
  12-column grid. List mode spans the full row. Buttons wrap on narrow cards.
- The accent is a pointer-transparent overlay, not an expanding border. The card
  is not clipped, preserving lifecycle popovers; Escape closes the catalogue menu
  and returns focus to its trigger.
- Shared lecture progress reuses the existing AssignmentProgress visual styles.
  Parent progress retains the existing parent-specific labels and numbers.
- Removed the obsolete dashboard-widget card stylesheet and migrated catalogue/
  Advisor-owned card layout rules. The shared card owns these visuals now.
- The removed tracked widget stylesheet is recoverable from Git history.
- No Advisor workspace-shell styling is transplanted from the dirty checkout.

## Predeployment review findings

- `CourseIdentityCard/index.module.scss`: fixed SCSS `composes` importing raw
  Sass token values into built CSS. Import the shared progress module from TSX,
  so Vite runs the Sass compiler. Browser assertions cover track color/radius;
  artifact scans reject unresolved `t.$` values.
- `CoursePreview.tsx`: navigation now uses real links with the existing route
  helpers. Menu opening focuses the first item, arrows/Home/End move focus,
  Escape closes and restores focus, and closing resets deletion confirmation.
  Menu items and confirmation controls meet the 44px touch target.
- `CoursePreview.tsx`: null session data now passes through `unwrapData` and
  enters the retryable error state instead of falsely claiming no schedule.
  Endpoint, request parameters and retry limit are unchanged.
- `CourseIdentityCard/index.tsx`: reject non-finite or invalid lecture counts,
  preserving the distinction between unavailable and actual zero progress.
- No new runtime host, port, credential, sample person, business ID, date or
  per-page brand color. Existing SCSS semantic tokens and route helpers remain
  the shared owners. No API service, payload, role gate, package manifest,
  lockfile or environment file changes.
- React review: presentation stays separate from page queries/mutations; no new
  API waterfall, render-time layout measurement, dependency or global listener
  per idle card. Lists retain their existing pagination.
- Interface review follows the
  [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
  Scope is the changed card surfaces, not a claim that all legacy UI is flawless.

## Verification

Final local release gates passed on the main-based candidate:

- Lint, regular TypeScript, strict production TypeScript and production build.
- 140 unit-test files / **602 tests passed**.
- **172 browser tests passed**, two workers, **zero retries** (1.9 minutes).
- Compiled CSS scan: zero unresolved Sass token references.

The expanded suite includes null schedule data, lifecycle requests and
long-data/open-enrollment responsive regressions.

Commands from the isolated worktree's `lms/`:

```sh
npm ci
npm run lint:ci
npm run typecheck
npm run typecheck:production
npm run test:run -- --maxWorkers=4
npm run build
CI=1 PLAYWRIGHT_PORT=4295 npm run test:e2e -- --workers=2 --retries=0
```

Role-specific card tests cover Student, Instructor, Instructor Advisor, System
Admin, Advisor-owned, Advisor-student and Parent. Primary surfaces are captured
at 1600, 1024, 390 and 320px, with overflow, hover geometry, focus, progress,
links, read-only boundaries, filters, paging, list view and schedule retry.
Lifecycle tests intercept writes locally: POST archive/restore retain idempotency
headers; DELETE occurs only after confirmation; HTTP 409 preserves the card and
displays an error. No actual courses are modified by these tests.

## Dependency and live-acceptance limits

- `npm audit` reports **5 moderate**, zero high/critical advisories:
  `@humanfs/node`, `@tiptap/core`, `@xmldom/xmldom`, `fflate`,
  `speech-rule-engine`. These are inherited from the unchanged lockfile, not
  introduced by this UI patch. A separate dependency security update is needed;
  this report does not claim the dependency tree is vulnerability-free.
- A real existing Advisor session showed two owned courses before deployment.
  Postdeployment read-only acceptance is recorded with release evidence.
- Synthetic screenshot/interaction tests do not prove every role's authenticated
  backend authorization, nor successful live archive/publish/withdraw/delete.
  Those writes are intentionally not performed on shared Dev records.
- Prior dirty-checkout exam-copy failure is not imported or ignored: the clean
  main-based full suite includes the exam tests.
