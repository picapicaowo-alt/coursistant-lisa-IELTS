# Instructor workspace UI/UX implementation

Date: 2026-09-03. Scope: the approved Instructor My Courses, course operations,
Teaching Operations, course overview and Mock Exams writing-review surfaces.

This frontend release candidate was isolated from the original dirty worktree
and rebased on the latest merged calendar/tenant/roster work. No backend,
environment, proxy, credentials or infrastructure changes are included.
Release verification is separate from authenticated business-data acceptance.

## Delivered surfaces

| Surface | Layout and functional scope |
| --- | --- |
| My Courses | Responsive course cards with aligned actions, status/code, instructor, recurring schedule/location; existing search, lifecycle filtering, grid/list views and pagination retained. |
| Course operations shell | Course heading, breadcrumb/back navigation, flat primary links, and dark secondary section pills. Existing roster, grades, course events, groups and assignment routes retained. |
| Occurrences | Dated class table, date/history filtering, create, generate, detail, reschedule, cancel and schedule-request controls. |
| Attendance | Session picker, aligned sync/save actions, summary band, student rows and status controls. Includes unrecorded and excused states rather than forcing everyone into the reference's three states. |
| Reports | Student/type/status filters, paginated cards, detail, create/edit draft and explicit publication. Published reports remain read-only. |
| Discussion | Body-based post cards, current-page filter, new posts with attachments, detail/replies and protected attachment actions. |
| Content | Course material table, local search/pagination, preview/download or actual URL, and existing lecture/assignment attachment management. |
| Teaching Operations | Teaching/Availability/Calendar navigation; aligned two-column teaching cards, full-width course list and schedule requests. Existing availability editor and personal calendar reused. |
| Course overview | Instructor navigation shell retained, title/metadata/content summary, flat tabs, 8+4 content/overview grid, first unit expanded, protected material controls and existing syllabus. |
| Mock Exams | Matched empty queue/selection panels; populated queue with script/score/feedback workflow; pending submissions cannot switch grading targets. |

## API and design boundaries

The supplied screenshots govern composition. Existing consumed contracts govern
data, authorization and available actions; screenshot sample records do not ship
as production data.

| Contract boundary | Implementation decision |
| --- | --- |
| Course occurrence and attendance endpoints | Reuse `/v2/courses/{courseId}/session-occurrences` and existing nested actions. Dates/times remain course-local, with whole seconds; versioned changes retain the server version. Attendance-opened classes cannot be rescheduled here. |
| Attendance snapshot | A missing version disables writes. Only explicitly changed student rows are sent. A version conflict preserves choices and requires a refresh; unrecorded students are not silently counted as present. |
| Student reports | Existing `student-reports` endpoints; `MID_TERM` / `FINAL` and `DRAFT` / `PUBLISHED`. List pagination starts at 1. Detail responses provide narrative text, not fabricated summaries. |
| Course student selection | Existing course members search uses `q`, `courseRole=Student` and zero-based pagination. Student IDs are never substituted with report/attendance record IDs. |
| Discussion | Existing posts/replies endpoints. No invented title field, server full-text search, or guessed reply totals. The list filter explicitly says it applies to the current page. |
| Materials | Protected blobs use existing preview/download helpers. Extra links target lectures or assignments, not invented occurrence relationships. The origin lecture is retained. Detach requires an explicit `lectureId` or `assignmentId`; ambiguous relationship IDs are read-only. Null-success unlink responses are valid. |
| Teaching dashboard | Today's classes, grading queue/items, support reasons, alerts and requests come from existing teaching reads. No client-invented risk thresholds or alerts. Registered frontend destinations guard incompatible returned links. |
| Schedule requests | Instructor review remains distinct from Advisor final decision. No new approval authority is introduced. |
| Course syllabus | The existing syllabus document/workflow is retained; the screenshot's invented weekly narrative is not added to real courses. |
| Writing review | Existing Instructor writing-grade detail and submit endpoints. Real score and feedback only; no unsupported rubric criteria or grading-scale assumptions. |

## Maintainability and interaction decisions

- `TeachingWorkspace` supplies shared semantic-token styles, dialogs, states,
  badges, pagination and avatars for the new Instructor surfaces.
- Course-operation panels are separated by domain; hooks/query keys coordinate
  server state, and existing API services continue to own requests.
- Styling is scoped to Instructor variants. Student/TA/admin/combined-role
  variants keep their established behavior; course membership remains the
  source of course-level permissions.
- Native dialogs contain keyboard focus, return focus on close, and block close
  during pending writes. Errors retain form values. Idempotency checkpoints
  preserve retries rather than creating a fresh operation for each retry.
- Unsaved attendance is guarded for session/section changes and course workspace
  links, plus browser reload/close. SPA sidebar navigation/browser history are
  not covered by that local guard and remain a follow-up hardening opportunity.
- The Impeccable layout review informed consistent baselines, balanced card
  geometry, shared spacing, responsive reflow and readable empty states.
- Small screens use stacked panels and labelled table rows. Wide tables and
  primary navigation scroll within their own regions, not the document.

## Pre-release audit

- Hardcoded data: no production sample people, course IDs, dates, credentials or
  deployment URLs introduced. Route builders and existing request services are
  reused; shared SCSS semantic tokens own colors, spacing and responsive rules.
- Contracts: checked against `docs/api/course.openapi.yaml` and the consumed
  advising/mock-exam contracts. Week/lecture aliases are explicitly documented
  by `GET /v2/courses/{courseId}/weeks`. Report pagination is one-based;
  member/discussion pagination is zero-based. No new API contract was invented.
- Safe writes: attendance/report/occurrence operations preserve versions and
  idempotency. Pending dialogs disable their full input subtree. After a
  successful attendance write, the prior snapshot stays locked until reload.
- Cache consistency: attendance refresh also invalidates teaching support;
  report previews do not refetch on window focus while a draft dialog is open.
- Truthful states: a still-pending grading projection cannot render a successful
  empty queue. Failed calendar reads remain unavailable, with explicit retry.
- Layout: automated screenshots and overflow assertions cover eleven surfaces
  at 320, 390, 768, 1024, 1440, 1600, 1920 and 2560 CSS pixels. Desktop card
  heading alignment and reachable lower course units are asserted.
- Visual inspection: course overview, teaching dashboard, Mock Exams, mobile
  course cards and attendance were inspected on the built candidate.

## Verification

Candidate checks: lint, standard and production TypeScript checks, 583 unit
tests in 138 files, and production build passed. All 155 browser cases passed
with retries disabled, including version/conflict handling, draft publication, protected
downloads, material detach identity, posting/replies, grading, availability,
schedule actions, pending-form locking, delayed queue reads and responsive QA.

The calendar regression was adapted to the new shared Calendar view: the
Instructor tab now uses title-case text and a weekly timetable on desktop.
The original 403/auth-header/date-range/retry/no-false-empty assertions are
retained, with desktop and mobile empty-state assertions for their actual views.

Browser runs use an isolated built-preview port with CI server reuse disabled.
Screenshots are generated by Playwright in ignored test-results; they contain
synthetic fixture records, not real account acceptance.

Dependency manifests and lockfile are unchanged. `npm ci` reported five
moderate advisories in the existing dependency graph. An online production-only
audit timed out; this is not a clean dependency-security certification. No
unrelated dependency upgrades are bundled into the UI release.

## Live acceptance boundary

The existing authenticated Instructor session on Dev 8085 could read course
341 and Teaching Operations before deployment. Its current grading queue
already displayed an unavailable state. This pre-existing live limitation
must be rechecked after rollout and must not be described as a successful API
acceptance. No real attendance, grades, reports or course records were changed
during read-only acceptance.

Automated interception tests prove browser behavior and consumed request shapes,
not that every deployed backend action accepts a real write. Production and
USC Dev 8084 remain outside this release.
