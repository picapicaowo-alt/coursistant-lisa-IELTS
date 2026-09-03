# Final Figma and frontend/API reassessment — 2026-09-03

**Release scope: the user has authorized publishing the completed frontend updates to Dev 8085 first, with the unresolved items documented for the next audit.** Full authenticated all-role acceptance remains open. This report replaces earlier delivery claims; a mapped route, fixture response, successful build, or screenshot does not establish full Figma or live API parity.

The first delivery is complete: [PR #11](https://github.com/picapicaowo-alt/coursistant-lisa-IELTS/pull/11) merged as `4f2ae484b93dd6659111bf8c8b6fecbf9b691cbc` and was deployed to Dev 8085. [Immutable release and public asset evidence](evidence/final-figma-review-20260903/dev8085-release.json). Supplemental review continues below without changing the recorded acceptance boundary.

## Reference and evidence scope

- Figma file `qBAAByIXGNIpoOcilCYISR`: all **69 interface nodes** received a design/source review. The separate UX Flow `774:7079` is not an application screen. [Reference retrieval and initial findings](evidence/figma-parity-20260903/reassessment-20260903.md).
- Supplied `x-learning (Copy).zip`: **352 files (238 SVG, 114 PNG)**, SHA-256 `3067e46e07983cb5dd6cf8efd21d853d11a3d060ac0e95553d30184f200ad00f`. It contains exported assets rather than a complete set of screen frames. [Manifest and individual hashes](evidence/final-figma-review-20260903/export-manifest.json). Two empty video-square SVGs are explicitly recorded; arbitrary portraits, scores or dates were not copied into runtime records.
- Independent rendered evidence: **56 application states at 1440×1024 and 390×844 (112 main screenshots)**. These map to 59 design nodes with direct or partial equivalents. Additional Student/Advisor Dashboard captures at 390/768/1440/1920 map the remaining five Dashboard nodes to their shared routes; the three Student and two Advisor design variants are not each claimed as an exact accepted state.
- Five nodes have explicitly missing capabilities, listed below. All 69 nodes are accounted for; **zero are silently counted as a visual-parity pass**. Desktop grids were additionally exercised up to 2560px and compact widths down to 320px where the permanent E2E suite specifies them.
- Screenshots are local QA artifacts, excluded from Git under project standards. Their machine-readable paths/hashes and the independent report are in [evidence](evidence/final-figma-review-20260903/). Local screenshot root: `/tmp/xlearn-final-visual-review`; Dashboard root: `/tmp/xlearn-final-dashboard`.

## Implemented corrections

| Module | Result | Functional evidence |
|---|---|---|
| Role navigation / Dashboard | Advisor course management, action tasks and scheduling have dedicated routes; the Dashboard is a composed overview. Student learning modules sit under Study Plan. Desktop uses responsive coordinated regions, with smaller breakpoints collapsing deliberately. | Sidebar links, legacy redirects, 8+4 learning composition and route guards in E2E. |
| Advisor priority and tasks | Real `highestPriority` drives Figma pink/orange/green badges. Task categories, avatars, action hierarchy, dated owned-course schedule and current caseload counts use supplied records. | `dashboard-detail-parity.spec.ts`: exact badge tokens, start/resolve versions 4→5, idempotency keys, actual delivery destination. Advisor occurrence permissions remain a live gate. |
| Advisor student workspace | Responsive identity/skill summary, task completion ring, phase cards and contextual request rail; Add Course includes mode icons, descriptions, selected radios, API-backed options and a persistent submit footer. Lifecycle controls sit under Manage enrollment. | Plan/task details, real schedule decision payload/version, linking and one-to-one form interactions. No invented assessment, member-since or numeric journey score. |
| Student Dashboard / courses | An enrollment stays visible even with no upcoming deadline. My Courses and Dashboard share the actual enrolled course identity; Advisor Tasks uses study-plan tasks. | E2E checks a course with no deadlines, its destination and actual task text. |
| Admin / intake | Refresh sits with filters, preserves criteria and shows pending/completed state. Create Intake opens an accessible modal with validation and real submit handling. | Refresh query/record change assertions, modal focus/scroll/validation and versioned intake flows. |
| Course and dashboard AI | Figma prompt rows, compact composer, coherent focus ring, opaque sidecar and readable messages. Copy and Latest response work; course prompts send with course context. Advisor AI remains a prepared UI for the future owner. | Controlled SSE request/response and courseId assertions. No live AI completion claimed; unsupported history/share tools do not show fake success. |
| Course material reader — supplemental review | Replaced browser-plugin PDF embedding after a rendered capture exposed a blank page. Protected PDF bytes now render in the application, with responsive fit width, page navigation, zoom and retry. Desktop retains outline + reading regions. | Actual video playback, PDF canvas ink/text, two-page navigation, zoom, corrupt-file recovery, download byte equality and cross-week next navigation in `material-reader.spec.ts`. These are controlled browser fixtures; live course files remain a separate gate. |
| Exams | Observer cards retain actual released summaries; system administrators can open system papers, sections and protected media. Reading/listening/writing use the Figma-style desktop question rail and purple states with actual answer/result counts. | Non-sequential system media IDs, exam navigation/answer retention, submit confirmation, real payload shape and released correctness in permanent E2E. Passage and writing panels remain necessary for their question formats. |
| Assignment editor | Required `weekId` and `learningType` now come from course weeks and the selected learning category. Locked edits send only changed fields plus the version. | Create payload and post-submission partial PATCH tests. |
| Profile / auth / calendar | Mobile avatar/summary no longer overlap; skill icons and crop preview match the reference structure. Signup validates confirmation. Calendar dialogs anchor to their trigger on desktop and remain contained on mobile. | Rendered captures, reset/signup tests, personal-event flows and actual date picker interaction. |

## API inventory and frontend omissions

The **11 consumed OpenAPI snapshots** contain **431 contract entries over 337 paths**, including duplicate endpoints across snapshots. Updated source reachability: **417 wired, 4 alternate workflows, 10 explicitly excluded**. These counts are not a claim of 431 authenticated endpoint tests. Snapshot hashes were unchanged; [contract audit](evidence/final-figma-review-20260903/contract-audit.json) and [complete operation-to-service-to-consumer matrix](frontend-operation-matrix-2026-09-02.md).

Ten previously transport-only reads now have production UI consumers:

| Operation | New consumer |
|---|---|
| `adminGetById` | System administrator directory → selected account details |
| `userGetById` | Managed user row → account details |
| `userGetAvatar` | Shared user avatar, with protected Blob loading and neutral fallback |
| `getSystemMockExam`, `getSystemMockExamListening`, `getSystemMockExamReading`, `getSystemMockExamWriting` | System paper selection → actual paper/section content |
| `getSystemMockExamListeningPartAudio`, `getSystemMockExamReadingQuestionImage`, `getSystemMockExamWritingTaskImage` | Protected media using server-provided sequence values |

This audit concerns frontend-consumed contracts. The live OpenAPI endpoint returned HTTP 500, so newly deployed backend capabilities beyond those snapshots cannot be ruled out. No backend service source or database was inspected or changed.

## API groups used by the frame matrix

Each group identifies the relevant existing contract surface; the full matrix above lists every operation and calling service. UI projection limits remain linked by B01–B13 in the [contract handoff](advisor-figma-backend-handoff.md).

| Group | Existing requests / frontend service |
|---|---|
| A01 Student Dashboard | `GET /v2/me/courses`, `/v2/me/progress`, `/v2/me/calendar`, `/v2/student/study-plan`; dashboard/course/advisor services. |
| A02 Course workspace | Course detail, weeks/materials, assignments, quizzes and `/v2/courses/{courseId}/discussion/posts` read/write/reply/file operations. No course-note persistence operation. |
| A03 Advisor Dashboard | `GET /v2/advisor/dashboard`, `/students`, `/action-tasks`, `/conversations`, `/schedule-requests`, `/courses`; task start/resolve and owned-course `GET /v2/courses/{courseId}/session-occurrences`. |
| A04 Advisor directory | `/v2/advisor/students` with filters/pagination; assigned-student hub/profile; actual `highestPriority` and avatar reads. |
| A05 Advisor conversations | Advisor student-scoped messages/read/files and conversation directory; parent-links is an association read, not a parent-recipient send contract. |
| A06 Advisor study plan | Student profile/study-plan read/write/revisions, task feedback; schedule request decision with expectedVersion/idempotency. |
| A07 Advisor course planning | Student course list, group-course option search/link, `/courses/one-on-one` create, instructor/session changes, launch/link/completion versioned transitions. |
| A08 Advisor exam observation | Assigned student exams, published template selection and observer detail; no Advisor question-level edit request. |
| A09 Student study plan | `GET /v2/student/profile`, `/study-plan`; task `start`/`complete` and student advisor conversation. |
| A10 Profile and settings | `GET/PATCH /v2/me/profile`, avatar upload/delete and `GET /v2/users/{userId}/avatar`; released course grades; existing password/notification settings. |
| A11 Calendar | `GET /v2/me/calendar`; `/v2/me/personal-events` list/create/get/PATCH/delete. Local whole-second timestamps and actual version retained. |
| A12 AI | Existing Study Support streaming service and separate Instructor/Workflow service, with course scope. No invented Advisor AI, exam AI or persisted-history endpoint. |
| A13 Student exams | `/v2/student/mock-exams`, paper/section/media reads, attempt creation and `/attempts/{attemptId}/{section}-submissions`. Results come from the returned submission projection. |
| A14 Authentication | `/v1/auth/login`, `/register`, email verification, `/password-resets`, password update and logout. No social login added without a contract. |

## All 69 frames: route, rendered state, API and residual boundary

“Captured equivalent” means the listed application state was rendered and inspected; it is not a pixel-perfect acceptance label. Repeated nodes may share a route while differing in Figma state. The exact screenshot-to-node mapping is preserved in the evidence JSON.

| Figma node | Route / entry | Rendered state or explicit omission | API group | Residual contract boundary |
|---|---|---|---|---|
| [17:914](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=17-914) | `/` | Student Dashboard captured; this variant not independently accepted | A01 | B01, B12 |
| [108:882](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=108-882) | `/` | Student Dashboard captured; this variant not independently accepted | A01 | B01, B12 |
| [466:3289](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=466-3289) | `/` | Student Dashboard captured; this variant not independently accepted | A01 | B01, B12 |
| [82:357](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=82-357) | `/course` | Captured equivalent: `student-courses` | A02 | B01 |
| [414:3326](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=414-3326) | `/course/:courseId` | Captured equivalent: `student-course-outline` | A02 | B01 |
| [498:4121](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=498-4121) | `/course/:courseId?materialId=…` | Captured equivalent: `student-course-reader` | A02 | B01, B12 |
| [507:3365](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=507-3365) | `/course/:courseId?materialId=…` | Captured equivalent: `student-course-ai`, `student-course-ai-response` | A02 | B01, B12 |
| [494:3386](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=494-3386) | `/course/:courseId → Assignments` | Captured equivalent: `student-course-assignments` | A02 | — |
| [496:3494](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=496-3494) | `/course/:courseId → Discussion` | Captured equivalent: `student-course-discussion` | A02 | B03 |
| [506:3609](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=506-3609) | `/course/:courseId` | Course notes persistence absent | A02 | B02 |
| [493:3350](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=493-3350) | `/course/:courseId` | Captured equivalent: `student-course-outline` | A02 | B01 |
| [772:3458](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=772-3458) | `/advisor/operations` | Advisor Dashboard captured; this variant not independently accepted | A03 | B04, B06 |
| [792:11208](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=792-11208) | `/advisor/operations` | Advisor Dashboard captured; this variant not independently accepted | A03 | B04, B06 |
| [783:8276](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=783-8276) | `/advisor/students` | Captured equivalent: `advisor-students` | A04 | B06 |
| [810:15612](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=810-15612) | `/advisor/messages` | Captured equivalent: `advisor-messages` | A05 | — |
| [813:4672](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=813-4672) | `/advisor/messages / student parent links` | Advisor parent-recipient conversation absent | A05 | B05 |
| [791:10510](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=791-10510) | `/advisor/students` | Captured equivalent: `advisor-students-selected` | A04 | B06 |
| [803:13456](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=803-13456) | `/advisor/students/:studentUserId/study-plan` | Captured equivalent: `advisor-student-journey` | A06 | B06, B11 |
| [813:4892](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=813-4892) | `/advisor/students/:studentUserId/study-plan` | Captured equivalent: `advisor-checkpoint-dialog` | A06 | B06, B11 |
| [805:14271](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=805-14271) | `/advisor/students/:studentUserId/courses` | Captured equivalent: `advisor-student-courses` | A07 | B07 |
| [818:7178](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=818-7178) | `/advisor/students/:studentUserId/courses` | Captured equivalent: `advisor-course-information` | A07 | B07 |
| [818:7815](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=818-7815) | `/advisor/students/:studentUserId/courses` | Captured equivalent: `advisor-course-schedule` | A07 | B07 |
| [815:5643](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=815-5643) | `/advisor/students/:studentUserId/courses → Add Course` | Captured equivalent: `advisor-add-course` | A07 | — |
| [810:15017](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=810-15017) | `/advisor/students/:studentUserId/exams` | Captured equivalent: `advisor-exams` | A08 | B08 |
| [816:6276](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=816-6276) | `/advisor/students/:studentUserId/exams` | Captured equivalent: `advisor-assign-exam` | A08 | B08 |
| [818:8771](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=818-8771) | `/advisor/students/:studentUserId/exams → View results` | Captured equivalent: `advisor-exam-results` | A08 | B09 |
| [819:9475](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=819-9475) | `/advisor/students/:studentUserId/exams → View results` | Advisor observer question-level read/edit absent | A08 | B09 |
| [100:456](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=100-456) | `/my-plan` | Captured equivalent: `student-plan` | A09 | B01 |
| [148:642](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=148-642) | `/my-plan?view=tasks` | Captured equivalent: `student-advisor-tasks` | A09 | B11 |
| [378:1714](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=378-1714) | `Header → profile menu` | Captured equivalent: `profile-menu` | A10 | — |
| [406:2399](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=406-2399) | `Header → profile menu` | Captured equivalent: `profile-menu` | A10 | — |
| [405:2345](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=405-2345) | `/profile` | Captured equivalent: `student-profile` | A10 | B13 |
| [410:2120](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=410-2120) | `/profile` | Captured equivalent: `student-profile` | A10 | B13 |
| [410:2408](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=410-2408) | `/profile → Edit profile` | Captured equivalent: `profile-edit` | A10 | — |
| [408:2433](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=408-2433) | `/profile → Change avatar` | Captured equivalent: `profile-crop` | A10 | — |
| [406:3008](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=406-3008) | `/settings` | Captured equivalent: `settings-password-success` | A10 | B13 |
| [408:1956](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=408-1956) | `/settings` | Captured equivalent: `settings-password` | A10 | B13 |
| [406:1914](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=406-1914) | `/profile → Assessments` | Captured equivalent: `profile-assessments` | A10 | B13 |
| [399:1628](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=399-1628) | `/profile → Assessments` | Captured equivalent: `profile-assessments` | A10 | B13 |
| [335:1033](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=335-1033) | `/calendar` | Captured equivalent: `calendar-week` | A11 | B10 |
| [375:1621](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-1621) | `/calendar → Add event` | Captured equivalent: `calendar-add-event` | A11 | B10 |
| [375:1956](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-1956) | `/calendar → Add event` | Captured equivalent: `calendar-date-time-picker` | A11 | B10 |
| [375:2540](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-2540) | `/calendar → Add event` | Captured equivalent: `calendar-date-time-picker` | A11 | B10 |
| [375:3392](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-3392) | `/calendar → event details` | Captured equivalent: `calendar-course-detail` | A11 | B10 |
| [375:3937](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-3937) | `/calendar → event details` | Captured equivalent: `calendar-quiz-detail` | A11 | B08, B10 |
| [375:4466](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=375-4466) | `/calendar → event details` | Captured equivalent: `calendar-assignment-detail` | A11 | B10 |
| [365:1122](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=365-1122) | `/calendar` | Captured equivalent: `calendar-month` | A11 | B10 |
| [201:906](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=201-906) | `/aibot` | Captured equivalent: `ai-empty` | A12 | B12 |
| [322:865](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=322-865) | `/aibot` | Captured equivalent: `ai-conversation` | A12 | B12 |
| [333:974](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=333-974) | `/aibot` | Captured equivalent: `ai-long-conversation` | A12 | B12 |
| [410:9227](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=410-9227) | `/aibot` | Captured equivalent: `ai-collapsed-navigation` | A12 | B12 |
| [163:698](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=163-698) | `/mock-exams` | Captured equivalent: `student-exam-library` | A13 | — |
| [423:3034](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=423-3034) | `/mock-exams` | Captured equivalent: `student-exam-library` | A13 | — |
| [417:2798](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=417-2798) | `/mock-exams/:studentMockExamId/:section` | Captured equivalent: `student-writing-exam`, `student-reading-questions` | A13 | — |
| [427:2930](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=427-2930) | `/mock-exams/:studentMockExamId/:section` | Captured equivalent: `student-reading-results` | A13 | — |
| [427:3588](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=427-3588) | `/mock-exams/:studentMockExamId/:section` | Exam-specific AI explanation absent | A13 | B12 |
| [427:2694](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=427-2694) | `/mock-exams/:studentMockExamId/:section` | Captured equivalent: `student-exam-complete` | A13 | — |
| [445:3397](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=445-3397) | `/my-plan` | Captured equivalent: `student-plan` | A09 | — |
| [445:3823](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=445-3823) | `/my-plan?checkpoint=…&task=…` | Captured equivalent: `student-checkpoint` | A09 | — |
| [464:3172](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=464-3172) | `/my-plan?checkpoint=…&task=…` | Captured equivalent: `student-task-detail` | A09 | — |
| [430:2779](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=430-2779) | `/my-plan?checkpoint=…&task=…` | Task-linked quiz association/destination absent | A09 | B11 |
| [715:3994](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=715-3994) | `/login` | Captured equivalent: `auth-login` | A14 | — |
| [730:4653](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=730-4653) | `/signup` | Captured equivalent: `auth-signup` | A14 | B13 |
| [731:4840](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=731-4840) | `/forgotpassword` | Captured equivalent: `auth-reset-email` | A14 | — |
| [731:4886](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=731-4886) | `/forgotpassword` | Captured equivalent: `auth-reset-code` | A14 | — |
| [732:4924](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=732-4924) | `/forgotpassword` | Captured equivalent: `auth-reset-password` | A14 | — |
| [732:4973](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=732-4973) | `/forgotpassword` | Captured equivalent: `auth-reset-success` | A14 | — |
| [730:4753](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=730-4753) | `/signup` | Captured equivalent: `auth-signup-details`, `auth-signup-verification` | A14 | B13 |
| [729:3484](https://www.figma.com/design/qBAAByIXGNIpoOcilCYISR/x-learning--Copy-?node-id=729-3484) | `/login` | Captured equivalent: `auth-login-error` | A14 | — |

## Remaining acceptance boundaries

1. **Authenticated all-role acceptance is incomplete.** A live Advisor session showed two assigned students and two owned courses on the existing Dev build. Student, Instructor, Counsellor, Tenant Admin, Parent and System Admin test sessions were not available. The live read was on revision `9bd7ee96faa82af0652a27fb4f754d16ef3d9dcc`, not the modified frontend. No business write was represented as successfully verified live.
2. **Advisor dated occurrences need permission confirmation.** The common course occurrence read exists in the consumed course contract; the new Dashboard uses only owned courses and shows a retryable unavailable state on failure. Advisor authorization for that read has not yet been demonstrated on Dev.
3. **Unsupported design capabilities stay explicit.** Course notes, Advisor-to-parent channels, Advisor question-level exam editing, task-linked quizzes, and exam AI explanations have no sufficient consumed contract. Existing Student/Instructor endpoints cannot substitute for Advisor authorization. AI history/share and missing cohort time series also remain outside accepted functionality.
4. **Some design projections still differ.** Calendar uses the supported combined date/time controls rather than the reference's separate date/duration model. Course/observer content uses the fields permitted by that role. The supplemental course reader review covers real media bytes with controlled API fixtures, PDF page painting and cross-week next navigation; live course files remain unverified. Structured person names replace unsupported nickname fields. Exact variant-by-variant pixel parity remains unaccepted.
5. **Backend inventory may have moved.** Updated OpenAPI or owner confirmation is needed while live `/api/v3/api-docs` returns 500. The 431-entry audit cannot certify capabilities absent from all supplied snapshots.

## Validation and release gate

The required frontend baseline passed: lint, both typechecks, production build, **542 unit tests in 130 files**, and **84 permanent browser tests** with no test-name exclusions and zero retries. [Machine-readable verification](evidence/final-figma-review-20260903/verification.json). An unconstrained unit run had worker startup timeouts; the full rerun with four workers passed without changed assertions. Commands: `npm run lint:ci`, `npm run typecheck`, `npm run typecheck:production`, `npm run test:run`, `npm run build`, and isolated `CI=1 PLAYWRIGHT_PORT=4187 npm run test:e2e -- --workers=4 --retries=0`. No test-name exclusion is permitted in the final permanent suite.

The latest user instruction explicitly prioritizes push, merge and Dev 8085 deployment of the completed changes before the next supplemental audit, and asks that unavailable work be recorded rather than block other delivery. Publish only after the required frontend checks pass. Authenticated all-role acceptance and unsupported design capabilities remain deferred, with usable role sessions and updated contract evidence needed to close them. The failed auxiliary review service is not retried. Credentials must not enter commits, reports or screenshots. Dev 8084 and Prod remain outside this release scope.

### Supplemental material reader validation

The follow-up passes the same six required gates, including **542 unit tests** and **86 permanent browser tests**, with no test-name exclusions and zero retries. [Review and limits](evidence/final-figma-review-20260903/material-reader-followup.md) · [Verification logs and screenshot hashes](evidence/final-figma-review-20260903/material-reader-verification.json). The two additional browser cases verify actual PDF painting/recovery and the multi-material media/download workflow.
