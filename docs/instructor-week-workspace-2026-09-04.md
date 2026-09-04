# Instructor course workspace: multiple weeks

The instructor course page now uses a week directory and one selected-week detail panel. Adding weeks grows the directory, not a stack of expanded course sections. The supplied two-column reference governs the composition; existing semantic tokens govern typography, spacing, status colours and responsive controls.

## Layout and navigation

- Desktop: 5/12 directory and 7/12 detail, with shared top and bottom boundaries. Six weeks per page; a four-week course retains natural whitespace. Search, state filters and display ordering operate on the complete course-week response. Reordering writes the complete ID permutation, including weeks outside the visible directory page.
- Mobile: a selected-week control with an explicit Search & filter disclosure; only the selected week's details render. Material actions expand in normal flow rather than beneath the mobile shell navigation.
- `weekId`, `materialId` and the active course tab live in URL parameters. Reload and reader return retain selection. A newly selected/created week opens the correct directory page; browsing a different directory page does not replace the detail automatically.
- View and management use the same composition. Course details and week metadata have focused editors. Material upload/link forms and per-item management tools appear on demand.

## Supported functionality and placement

| Scope | Frontend placement | Contract or existing workflow |
| --- | --- | --- |
| Week metadata, lifecycle and order | Add week; selected-week actions | Course weeks list/detail/create/PATCH/delete/reorder/publish/unpublish |
| Week overview | Selected-week Overview and editor | `CreateWeekRequest.summary`, `RenameWeekRequest.summary`; optional list/detail read projection |
| Materials | Selected-week reader and Manage materials | Existing upload/link/rename/reorder/move/delete/publish/unpublish requests, protected preview/download and week ZIP |
| Material relationships | Material links entry | Existing record-based course Content workspace; lecture/assignment attachment and detachment |
| Assignments and quizzes | Assignments & Quizzes tab; Course grades link | Existing authoring, attachment, question, submission, grading and release workflows |
| Discussion and announcements | Dedicated tabs | Existing discussion/reply/attachment flows and announcement management |
| Schedule, attendance and reports | Schedule & Groups → Classes, attendance & reports | Existing role-gated occurrence, scheduling, versioned attendance and report workspace |
| Members and groups | Schedule & Groups → Members / Groups | Existing roster and group management; membership-based permissions retained |
| Syllabus and course details | Syllabus tab and Edit course | Existing protected syllabus flows; partial course title/description updates |

The work reuses the existing functional workflows instead of implementing parallel request paths. `InstructorCourseView` is selected by course membership; student and TA rendering retain their existing routes. Archived courses expose reading/downloads while content mutations are unavailable.

## Contract and persistence constraints

1. Week creation and editing accept `summary`. The read field is optional for compatibility with older projections. If the list omits it, the selected panel fetches the existing week detail endpoint; that read failing does not hide materials.
2. Summary writes are followed by a fresh detail read. A mismatch or failed read keeps the editor text and reports unconfirmed persistence; it does not repeat a successful create. Failed writes keep the same idempotency key for the same payload. A successful create without a valid returned ID cannot generate a malformed follow-up request.
3. Week edits send only changed fields. Course-description clearing uses the existing `clearDescription` contract.
4. The UI uses only Draft and Published week states. Individual material publishing remains distinct from the parent week's student visibility.
5. No week date range is fabricated from a course term or order position. Actual scheduling remains in the existing schedule/occurrence workflow.
6. Course totals come from actual week, assignment and quiz responses. Pending and failed requests do not masquerade as zero totals.

## Verification and release scope

The release branch was isolated from `origin/main` (`fff7fe1`) rather than the unrelated dirty local checkout. It preserves the latest structured instructor-name formatting, roster links, schedule permissions and report safeguards.

- `npm ci`, `npm run lint:ci`, `npm run typecheck`, `npm run typecheck:production` and `npm run build`: passed.
- `npm run test:run`: 147 files, 685 tests passed.
- `CI=1 PLAYWRIGHT_PORT=4193 npm run test:e2e -- --workers=4`: all 251 browser tests passed, with no failures or retries.
- Fourteen focused multiple-week checks cover selection/pagination/reload, complete reorder payloads, partial overview writes and detail projection fallback, failed/unconfirmed persistence, empty-week creation/deletion, ZIP download, archived controls, responsive material menus, mobile rename, structured instructor names, partial course-description clearing and duplicate-create prevention.
- Existing responsive instructor checks cover 2560, 1920, 1600, 1440, 1024, 768, 390 and 320 px. New directory/detail captures cover 1600, 1280, 1024 and 390 px, including four-week and twelve-week courses, equal desktop panel boundaries and no horizontal overflow.
- Desktop and mobile screenshots were visually inspected. Impeccable's earlier bounded mechanical scan reported no findings for the new view and focused material editor.

Browser fixtures are synthetic frontend evidence. They do not establish authenticated live persistence, server permissions, or successful processing of real uploads. Summary readback remains an authenticated live acceptance item; the UI preserves text and reports an unconfirmed write instead of claiming persistence.

The user authorized push, merge and deployment to IELTS Dev 8085 only. Release uses a clean merged-main build, immutable artifact metadata and hashes, preserved rollback target, named frontend process restart and public asset/API-boundary verification. No backend changes or other environments are included.

Main implementation: `lms/src/pages/CourseWorkspacePage/components/InstructorCourseView/`. Browser tests: `lms/e2e/instructor-weeks.spec.ts`. Synthetic screenshots: `lms/artifacts/ci/instructor-weeks/` (ignored local artifacts).
