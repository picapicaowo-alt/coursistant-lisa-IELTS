# Authenticated delivery acceptance — 2026-09-04

Scope: IELTS frontend and Dev 8085, using the supplied Tenant Admin, Counsellor, Advisor, two Instructors, two Students and Parent accounts. Credentials and designated account values are excluded from this repository. Backend services, data stores, proxy values, USC Dev and production were not changed. Parent–Student associations must remain as currently configured; this change contains no relationship mutations.

This is a follow-up to [the full route/API audit](delivery-readiness-audit-2026-09-04.md). That audit's 432 contract entries describe source coverage, not 432 successful live requests. This follow-up replaces the previous account-access limitation with real business-flow evidence, while retaining explicit external blockers.

## Frontend corrections

| Problem observed in Dev | Resulting behavior |
| --- | --- |
| Tenant header showed a generic identity despite an authenticated directory record | Reuse the Tenant user query for structured identity; preserve the normal User profile flow. |
| Mock Exam student selection showed IDs and loaded only one cohort page | Read all collection pages with the existing service helper, render structured names, and explain when no published paper is available. |
| Grading roster omitted students whose response used prefixed structured names | Display and search the documented student name fields, preserving group and legacy response support. |
| Parent linked-student choices lacked names before opening each child's dashboard | Read names from the linked-student summaries, preserving the selected ID and authorization scope. |
| Parent assignments displayed HTML source and raw UTC timestamps | Render student-visible feedback through the shared rich-text viewer, format contract UTC values and display only released scores. |
| Upload progress mislabeled byte counts as MB; failed local files could invoke a server delete | Use shared byte formatting, remove inert retry/open affordances, and remove failed temporary uploads locally so users can choose the file again. |
| A new group course was configured before recurring sessions could be added; the API then rejected session mutation | Allow recurring sessions before the first delivery configuration, require a loaded nonempty schedule before configuration, then present the locked schedule and independent dated-occurrence controls. |
| Switching tabs during schedule generation could enable another mutation | Shared TanStack mutation state blocks new actions across remounts, without interrupting the active request or changing its retry key. |
| Configured delivery hid Instructor week and Syllabus authoring, although the same Instructor successfully created a week through the documented API | Separate teaching-content management from course administration; keep role and archive restrictions. |
| Delivery views ignored structured primary-instructor fields | Use the established instructor-name formatter consistently. |

The schedule ordering follows observed live behavior: the documented session POST succeeds before configuration and is rejected afterward with “Configured course mutation is orchestrated.” No new orchestration endpoint or payload field was introduced. Objective-question authoring explains its answer requirement; it does not invent an answer schema inside generic JsonNode.

## Real-account acceptance

| Workflow | Observed result | Boundary |
| --- | --- | --- |
| All supplied roles | Eight successful authenticated logins | Role-specific pages and selected negative checks, not every possible permission combination |
| Counsellor → Advisor | Created a clearly marked QA intake; assigned its Advisor; verified disappearance from the unassigned queue and handover access closure | Existing parent associations are preserved |
| Advisor student profile and plan | Saved profile and study plan, reloaded, and confirmed persistence | No synthetic success or local-only business records |
| Tenant Mock Exam | Created QA template/version; saved and reloaded Writing content | Reading objective write rejected; no successful paper publication, assignment or student attempt |
| Instructor → Student assignment | Published QA assignment; Student uploaded a real PDF and submitted it | File submission persisted; this run does not certify the PDF preview window's rendering |
| Grading → Parent | Saved and released a score and feedback; linked Parent saw that same released result | No student report was created because the report picker was denied |
| Student isolation | Second Student saw their own unsubmitted state without the first Student's file or grade | Tested on the shared course's QA assignment |
| Instructor isolation | Second Instructor could access their own course and was denied the other course's grading page | Backend remains the authorization authority |
| Course preparation | Created QA group course; documented preconfiguration session POST succeeded; delivery configuration and readiness validation succeeded | Publication succeeded after the Instructor uploaded the required Syllabus; frontend access and blocker presentation are corrected |
| Teaching operations/calendar | Current personal-event and grading-item reads succeeded | Earlier endpoint failures recorded in previous audits are not claimed as current failures |
| Parent academic surfaces | Linked students, plan, assignments, reports and schedule read successfully | Reports list was genuinely empty; no fabricated report |

## External delivery blockers

| Priority / capability | Consumed API | Expected / observed | Handoff requirement |
| --- | --- | --- | --- |
| P1 — publish and assign a complete Mock Exam | Tenant version Reading section authoring under `/v2/tenant/mock-exam-templates/{templateId}/versions/{versionNo}` | Objective question save rejected: “every objective question must have an answer”; consumed payload has no typed answer-key contract | Supply a contract-backed accepted objective-answer example/schema, then repeat save/reload, publish, assign, attempt and review live |
| P1 — publish student reports | `GET /v2/courses/{courseId}/members?courseRole=Student&q=…&page=0&size=10` | Authenticated primary Instructor can grade the course, but the report student picker returns 403 `ACCESS_DENIED` | Resolve the role/membership contract externally, or provide an authorized documented student directory for report authoring |
| P1 — Instructor learning-material upload | `POST /v2/courses/{courseId}/weeks/{weekId}/materials` with multipart `files` | Same Instructor creates a week successfully, but both UI upload and an exact-contract probe fail; probe returns 403 `FORBIDDEN`, “Only Course Manager or Active TA can upload materials” | Reconcile the configured course Instructor/manager permission before certifying material delivery |
| P1 — class dates visibility | `GET /v2/courses/{courseId}/session-occurrences?from=…&to=…&includeHistory=false` | Advisor delivery config returns 200 for a QA course; occurrence read returns 404 `COURSE_NOT_FOUND`, and still fails in the UI after publication | Reconcile owner-course occurrence visibility; no dated classes or attendance success was fabricated |

No backend workaround, identifier override, invented answer field, forged role or fabricated result was used. These gates prevent an unconditional claim that the complete delivery lifecycle is ready for operational use.

## Validation and release boundary

The independent review found one schedule-remount race, now corrected and covered by a delayed-request navigation test. Upload removal, pagination, structured grading names, released-only parent feedback, preconfiguration schedule ordering and role identity have focused regression coverage. Responsive browser tests include desktop and narrow layouts.

Required release gates are lint, both TypeScript checks, unit tests, production build and the complete browser suite. All must pass on the final candidate before merge. The release includes the concurrent main-branch Instructor week-workspace update, preserving its dedicated editor and contract boundaries. The final candidate passed lint, both TypeScript checks, 690 unit tests, build and all 258 browser tests. Final deployed revision, artifact hashes, screenshots and the QA record inventory are kept in the local acceptance evidence folder; authenticated postdeployment verification is separate from mocked E2E coverage.

## Postdeployment transition correction

The real new-course UI now completes create → recurring session → first delivery configuration and reload. Instructor week create/reload/publish also passed on a configured course. A further live check showed that READY → ready is rejected as an invalid launch transition: the previous “Validate again” control treated a state transition as a repeatable read. The frontend now offers readiness only for DRAFT and publishing only for READY, preserves returned versions, and removes the invalid revalidation control. The remaining dated-occurrence visibility issue is independent of these frontend corrections.

The exact publish rejection payload contained `data: [{code: "SYLLABUS_REQUIRED", message: "Current Syllabus is required"}]`; it was not an unexplained publication failure. Instructor Syllabus upload succeeded through the documented endpoint, and subsequent course publication succeeded. The UI now displays fresh transition blockers on every delivery tab instead of the stale config read, and Instructor teaching-content permission covers both weeks and Syllabus while course administration remains locked.
