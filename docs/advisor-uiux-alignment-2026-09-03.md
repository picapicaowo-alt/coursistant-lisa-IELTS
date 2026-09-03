# Advisor student workspace alignment — 2026-09-03

## Scope and design authority

Frontend-only implementation against Figma file `qBAAByIXGNIpoOcilCYISR`, Students List `783:8276`, Learning Journey `803:13456`, Courses `805:14271`, Add Course `815:5643`, Exams `810:15017`, and exam modal `816:6276`. The supplied screenshots are visual references, not API specifications. Existing semantic tokens and SCSS Modules remain the styling system.

No backend, infrastructure configuration, environment values, or demo credentials are changed. The user authorized push, merge and a frontend-only Dev 8085 release after verification.

## Delivered behavior

| Area | Change | Evidence boundary |
| --- | --- | --- |
| Students List | Bounded goal column, aligned table/actions, responsive mobile record cards, compact pagination, and selection reset after filters/page changes. View opens Learning Plan, matching the Figma journey entry. | Existing search/risk/type/task query parameters and assigned-student boundary retained. |
| Student summary | Smaller avatar and a compact 12-column profile/goal/progress/skills composition; deliberate tablet/mobile reflow. | Only returned profile data and task completion are shown. |
| Add Course | Figma-style mode tiles and selectable course cards, visible load/error/empty states and retry. Reopening clears previous search and selection. | Per user direction, request only `page=0&size=20`; do not fetch all pages. Search uses the same endpoint. |
| Current courses | Weekly schedule and location appear on cards; full returned schedule remains available in course detail. | Typed from `GroupCourseSchedulePreviewResponse`; weekly templates are not represented as dated next-class occurrences. |
| Exams | White exam cards with supplied sections, assignment date and result summary; aligned assignment modal with compact instructor search and retained section selection. | Existing assignment payload, query invalidation and idempotency retained. |

## Empty-course diagnosis and contract boundaries

The only source for assignable group courses is `GET /v2/advisor/students/{studentUserId}/course-options`. The first-page limit cannot itself explain an empty first page. The consumed contract expects `data.items` plus pagination metadata and explicitly permits `404 STUDY_PLAN_NOT_FOUND`.

The chooser now distinguishes:

- A valid page containing course options: renders the returned records and count; a nonempty total above 20 prompts search, not automatic pagination.
- A valid empty page: states that no options were returned for this student, with separate copy for an active search.
- A failed request or missing study plan: displays an error and retry inside the modal.
- A malformed page: displays an error rather than crashing the workspace or silently implying there are no courses.

Course management records are not a substitute for the student-specific course-options response. No alternate endpoint, eligibility rule, or client-side inclusion of unreturned courses was introduced.

Authenticated Dev read-only inspection subsequently succeeded in the independent browser session. The existing administrator session was not signed out. Observations on the currently deployed (pre-change) frontend:

- Lucas has one current course, Academic Writing Studio (`HVW101`), shown as `PUBLISHED`.
- Add Course shows no option rows or empty/error explanation, both without a query and with `HV` entered.
- Course management lists two owned courses. The other course, IELTS Speaking Clinic (course 342), is `READY`, version 1, not `PUBLISHED`.

Subsequent native Chrome DevTools inspection confirmed the actual student-specific course-options request returned HTTP 200 with `{"status":200,"code":"SUCCESS","data":{"items":[],"page":0,"size":20,"total":0}}`. The deployed frontend was not dropping returned rows: the backend returned no options. The frontend defect was the absence of an explanatory empty state. The exact server eligibility rule is not established by this response and is not inferred into frontend code. No course was published or student enrollment/exam record mutated to test a theory. The new build's nonempty-page rendering and failure handling are verified separately by contract fixtures.

### Deliberate differences from Figma

- Student summary list does not supply numeric current level, score delta, or next checkpoint. These columns are hidden per the user's latest direction, rather than filled with fabricated values or permanent placeholders.
- Course options do not supply instructor, category, or schedule. The selector displays the actual course code/title/capacity fields instead of inventing Figma labels.
- The exam-create contract supplies template and Listening/Reading/Writing selection plus optional writing instructor. It does not accept sitting dates/times or Speaking. The button is therefore **Assign Exam**; unsupported fields are hidden. Internal contract terminology is kept out of the user-facing modal.
- Existing course, task, support, profile, and intake routes remain accessible; Figma's narrower sidebar does not justify removing working navigation.

## Verification

New browser coverage lives in `lms/e2e/advisor-student-figma.spec.ts`: desktop/mobile layout, Learning Plan entry, first-20 option requests, versioned/idempotent linking, empty/error/retry/reopen states, malformed-page recovery, and exam assignment payload. Existing responsive expectations were updated for the intentional title and default-route change.

The isolated release worktree is based on merged main `b069960`, branch `codex/advisor-student-figma-release`. It excludes other tasks' uncommitted changes.

Local checks: `lint:ci`, `typecheck`, `typecheck:production`, `build`, and `build:dev` passed; `test:run` passed **133 files / 560 tests**; full `test:e2e` passed **104 tests**, with retries disabled, using isolated port 4197 and four workers. `git diff --check` passed. Desktop/mobile screenshots were inspected. Newly added cases cover seven-page pagination at 320/390px, journey/progress at 320/390/768/1080/1440px, long option strings, and one-to-one creation's session enums.

The first journey test run had an incorrect banner locator, corrected to the labelled summary. An intermediate run was discarded because a concurrent build replaced its served artifact; the final 104-test run used a completed build with no concurrent artifact changes.

## Predeployment fixes and audit

- Reuse shared course-session configuration. The earlier one-to-one payload sent `ONE_ON_ONE` and `MONDAY`, whereas `CreateSessionRequest` requires `Lecture/Lab/Tutorial` and `MON/TUE/...`. Creation and editing now use the consumed enums, with typed session fields.
- Guard required study-plan version, instructor, term range and session time range before creating. Do not convert course-local wall-clock times to UTC.
- Preserve additional sessions when the editor replaces the first session, because the endpoint replaces the entire collection. Refuse unverifiable remaining sessions or changed versions.
- Collect the contract-required withdrawal reason, bounded to 1000 characters. Bound alignment notes to 4000 characters.
- Unknown schedule-request states no longer show approve/reject actions; phase switches reset task filters.
- Fix narrow-screen pagination, summary-ring containment, journey breakpoint precedence and long-course-string containment.
- Scoped source scan found no deployment URL, tenant account value, fixture identity, `any` escape, or production console logging introduced. No environment, dependency manifest, or lockfile changes.
- Production dependency audit reports three pre-existing moderate findings (`@tiptap/core`, transitive `@xmldom/xmldom`, and its `speech-rule-engine` dependency path), with no high/critical findings. This release does not upgrade the editor/math dependency graph.

## Live acceptance and release boundary

The user logged in to a Chrome Advisor tab and authorized continued browser operation. Native DevTools provided the HTTP status and response body above. No credentials were copied and no live course/student data was changed.

The release must use clean merged main, an immutable artifact with rollback metadata, and post-release authenticated read checks. Real enrollment, withdrawal, course creation and exam assignment writes have not been performed against the user's existing students; their frontend payloads and refresh flows are tested with isolated contract fixtures.

Automated fixture-based checks do not establish authenticated live acceptance.
