# Student UI refinement — 2026-09-03

## Delivered scope

The approved reference screenshots guide this frontend-only change. Dashboard retains the three-region composition: assistant on the left, course cards / advisor tasks / exams in the middle, and schedule / alerts on the right. Course cards reuse the Instructor card, including its non-shifting hover and keyboard-focus accent. At narrower widths the course carousel shows fewer cards; mobile reading order prioritizes courses and tasks.

Learning overview uses a primary progress region and supporting alerts region. Assignment completion is visualized with a ring and course bars. Course progress is paginated in groups of three; milestones are a limited preview with a Study Plan destination. Attendance, work queue, and schedule requests remain parallel previews. Their complete records and course hours, published reports, and schedule request forms open in a separate detail view rather than being appended below the overview.

Discussion includes a spacious composer, author / role / date presentation, separate posts, one-level replies, and file attachments. Released grades and assignment progress use a supporting column. Student course overview now retains application navigation; material reading keeps its focused layout. Related Study Plan task cards share the revised spacing and record treatment.

## Contract mapping and boundaries

| Surface | Consumed contract | Behavior |
| --- | --- | --- |
| Courses | `GET /v2/me/courses`, course sessions | Enrolled active courses, actual instructor and published schedule. No inferred student counts or bookmarks. |
| Progress | `GET /v2/me/progress` | Assignment counts only. Missing counts remain unavailable; zero assignments is distinct from 100% completion. |
| Advisor tasks | `GET /v2/student/study-plan` | Existing task states, due dates, feedback, and checkpoint/task destinations. No inferred task-to-course association. |
| Calendar | `GET /v2/me/events/upcoming`, `GET /v2/me/calendar` | Dated activities; selected-day filtering and full calendar entry. Calendar request windows remain half-open. |
| Learning records | `GET /v2/me/attendance`, `/work-queue`, `/schedule-requests`, `/alerts` | Actual record states. Attendance uses the supported course filter. Other course filtering uses explicit course IDs only. Alerts and study-plan milestones retain their global scope. |
| Course details | `GET /v2/me/courses/{courseId}/hours`; course published student reports | Minutes displayed as hours; published reports use 1-based server pagination. Report detail includes written evaluation and publication-time metrics. |
| Schedule requests | Course dated-occurrence attendance and schedule-request APIs | Absence / schedule-change submissions retain idempotency. Proposed times preserve class-local values with whole seconds; submitting does not imply approval. |
| Discussion | Course discussion post / reply / attachment APIs | Text and files, paginated replies, protected file preview/download. Failed submissions retain their draft and files. |
| Grades | Course `my-grades` API | Only released numeric grades are displayed as scores. |

No backend or AI service implementation was changed. Report download and discussion reactions are not offered because those capabilities are absent from the consumed contract. Error, loading, and empty states are distinct; each failed query retains a retry.

## Implementation notes

- SCSS Modules and existing semantic tokens control layout, typography, borders, and status colors.
- `StudentLearningPage` owns learning overview and course detail presentation; API requests remain in the existing service.
- Shared operation-record parsing was moved from the Instructor page to a utility and re-exported for existing consumers.
- Reply attachments extend the existing API service signature without changing existing text-only callers.
- Release preparation uses an isolated branch based on current `origin/main`, preserving the unrelated changes in the original working directory.

## Validation

Integrated release candidate: full lint, standard / production TypeScript, 656 unit tests, and production build passed. Browser regression retained 191 passing cases; two existing cases were updated for the rendered responsive columns and the new Calendar navigation / field labels, then passed focused reruns. Assertions still verify fluid geometry, no overflow, unavailable alerts, the latest event version, and stable idempotency on retry. The complete final browser and GitHub CI gates must pass before merge. Dev 8085 artifact checks and authenticated acceptance are recorded separately.

### Initial UI validation

Final checks: lint, standard TypeScript, production TypeScript, and production build passed. Targeted unit tests: **17 passed** across five files. Browser regression: **10 passed**, covering the new layouts, hover stability, carousel / schedule filtering, report paging, class-local schedule requests, discussion file retry and download / preview dispatch, existing material reading, task navigation, profile, calendar, TA access, and Student AI navigation. Learning overview geometry was checked at 320, 390, 768, 1440, 1920, and 2560 pixels. Desktop / mobile visual evidence covers 390, 1440, and 1920 pixels. The layout detector returned no findings. Browser-native PDF rendering is not asserted by the preview-dispatch check. Screenshots use isolated sample records shaped to the consumed API contracts. They are visual / frontend interaction evidence, not acceptance against an authenticated live Student account.

Evidence directory: [student-refinement-20260903](evidence/student-refinement-20260903/).

## Preview images

- [Dashboard — desktop](evidence/student-refinement-20260903/dashboard-1920.png)
- [Dashboard — mobile](evidence/student-refinement-20260903/dashboard-390.png)
- [Learning overview — desktop](evidence/student-refinement-20260903/learning-1920.png)
- [Learning overview — lower modules](evidence/student-refinement-20260903/learning-lower-1920.png)
- [Discussion — desktop](evidence/student-refinement-20260903/discussion-1920.png)
- [Discussion — mobile](evidence/student-refinement-20260903/discussion-390.png)
