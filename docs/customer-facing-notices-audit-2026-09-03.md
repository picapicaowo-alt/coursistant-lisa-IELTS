# Customer-facing notices and API-state audit

## Scope and findings

Training frontend, based on clean `origin/main`. The review covers Student, Instructor, combined Instructor/Advisor, Advisor, Counsellor, Parent, Tenant Admin and System Admin presentation, plus existing course permission tests. The supplied eight Dev accounts cover six account roles; they do not include System Admin or combined Instructor/Advisor. Those additional roles are covered by isolated fixtures only.

| Issue | Established cause | Frontend resolution |
| --- | --- | --- |
| Passive study-plan profile-version banner | A profile-change flag rendered a warning even without a failed save. The editor already uses the current reviewed profile token. | Remove the banner. Preserve optimistic concurrency, draft content and explicit conflict recovery; clear the old mutation error after reload. |
| Course-date banner on opening weekly schedule | Independent course-occurrence read fails for Advisor although owned-course details and weekly sessions succeed. | Read actual dates on request. Keep the weekly schedule usable, keep failure/retry inside the date section and disable generation after a failed read. Never synthesize dates or cancellations. |
| Raw `Internal server error` and transport diagnostics | Shared `getApiErrorMessage` preferred server text; a few mutation surfaces bypassed it. | Use operation-specific copy for server, transport and malformed-payload errors. Preserve actionable validation, authentication, permission and conflict messages. Keep diagnostic errors intact. |
| Parent header notification failures | Generic user notifications were mounted for every `USER`, including Parent, despite a separate Parent notification contract. | Parent bell links to the existing Parent inbox. It no longer calls learner notification endpoints. |
| Student course hours | Explicit `404 COURSE_HOURS_NOT_FOUND`, distinct from a missing course or transport failure. | Neutral unconfigured state without a fabricated zero balance. Other failures retain retry. |
| False empty states and stale notices | Student hours, reports and calendar rendered empty content before or after failed reads; inactive sections retained error notices. | Empty states require successful reads. Notices follow the active section. |
| Instructor personal-event permissions | Authenticated Instructor requests return `403 ACCESS_DENIED`; the latest Instructor handoff explicitly includes personal calendars. | Preserve course calendar and failure recovery; disable Add event until the personal-event read succeeds. No permission broadening. |

Additional copy cleanup removes implementation commentary about backend versions and unavailable contract fields from Advisor profile/support/schedule, course delivery, attendance, assignment/event editors, tenant accounts, and exam authoring. Required reload instructions, unsaved-draft warnings and real permission checks remain.

The common error policy also covers course creation, syllabus changes, uploads, exam submission, workflow feedback and batch enrolment. Browser media/crop diagnostics use contextual recovery copy. Retired JSX routes and duplicate-number source copies are not release inputs.

## API review

Paths, required parameters, identity and response envelopes were compared with the frontend services and consumed `docs/api/course.openapi.yaml`, `advising.openapi.yaml`, and Parent/notification services. Base URL, credentials, environment values, proxy targets and server permissions are unchanged. Collection query parameters, calendar date windows and response adapters now match the supplied September 3 contracts.

- `meTeachingGradingItems`: optional `courseId/status/page/size`; page is zero-based, size is 1–100. Both instructors still return HTTP 500 with `page=0&size=100`. Normal responses are `{items,page,size,total}`, including empty queues.
- `listSessionOccurrences`: the new operation description explicitly permits the owner Advisor to read. Owned courses still return `404 COURSE_NOT_FOUND` with documented term-date filters, although course details and weekly sessions succeed. This is a runtime contract mismatch, not an unsupported frontend feature.
- `meCourseHours`: absent balances return `COURSE_HOURS_NOT_FOUND`. No synthetic account or balance is created.
- `listMyPersonalEvents`: required UTC `fromUtc/toUtc` are present. Instructor receives 403 while Student succeeds. The new Instructor handoff includes this capability; runtime authorization needs correction or a revised contract.
- `courseMemberList`: both accounts have `Instructor` membership in their respective courses but member-list reads return 403. Backend must confirm the role policy. Frontend does not bypass the denial.
- Parent-specific notification list/unread reads succeed; learner notification reads are denied. The frontend routing error is corrected in this release.

Only sign-in and read-only live probes were used for this audit; business writes are exercised in isolated fixtures. This is not acceptance of every production mutation or AI interaction. Detailed account-specific evidence is kept in the user handoff, outside committed source; no credentials or demo-account values are committed.

## Review and validation

- Shared server-state error handling retains original diagnostic objects; required missing payloads still throw and never become empty data.
- Actual versions, idempotency keys, role guards and course-local time formats remain intact.
- No new environment hosts, deploy ports, account values, literal design colors, unsafe type bypasses or debug logging in production changes. Environment and dependency/lock files are unchanged.
- Required release gates: lint, both TypeScript checks, full unit tests, production and development builds, isolated complete Playwright suite. Results are recorded in the release report.
- Regression coverage includes role-specific 500 display, network failure, missing payload, permission denial, retry-to-success, absent versus failed course balances, current-profile plan saving, draft-preserving conflict recovery, and Parent notification routing.
- Responsive coverage includes 320–2560 px role layouts and 390/1440 px error states. Browser fixtures are separate from authenticated API evidence.

Remaining server failures and permission questions are explicitly open; changing their wording does not repair those services. The release targets only Dev 8085.

## September 3 contract cutover

The eight user-supplied OpenAPI files replace the corresponding `docs/api` inputs. The role handoffs were used as product/authorization evidence, not as instructions to operate external systems.

| Contract change | Frontend adaptation |
| --- | --- |
| Six queue/list endpoints now return zero-based pages | A shared service reader exhausts server pages for existing complete-list views. It respects the server page size, preserves order, accepts legacy arrays during rollout, rejects malformed/repeated pages and does not hide failed reads. |
| Student and Parent conversation cursor pages | Continuation follows `hasMore` and `nextBeforeId`; no guessed cursor on the current contract. |
| Parent calendar uses `from/to/timezone` and UTC items | Removed unsupported `limit`; render real session instants in their displayed timezone and exclude assignment deadlines from schedule-change targets. No invented location. |
| Student/Instructor unified calendar now returns UTC items | Convert instants into the requested calendar timezone before positioning them; test a cross-date timezone boundary. |
| Student current/completed courses | Send `courseView=CURRENT/COMPLETED`; the server owns lifecycle filtering. |
| Grading item fields | Read `dueAtUtc`, group identity and registered grading links. Writing queue prioritizes `id` (the old reader already had an `id` fallback), displays template titles, enforces band 0–9 in half steps and prevents repeated grading. |
| Final occurrence mutations are owner-Advisor only | Hide creation/generation/reschedule/cancel from Instructor and legacy teaching operations; retain attendance and review only for `SCHEDULE_CHANGE + PENDING_INSTRUCTOR`. Student-only request creation is also hidden from teaching operations. |
| Configured course administration | Suppress Instructor course editing and recurring-session editing when `launchState` identifies an orchestrated course. |
| Attendance writes | Offer only the delivered `PRESENT` / `ABSENT` statuses. |
| Undelivered AI and syllabus Phase 1 UI | Remove dashboard AI placeholders, sidebar/direct AI entry and material-reader assistant controls; remove the Phase 1 syllabus card. Dashboard columns reflow into main/supporting regions. |

Course Quiz, discussions, course events/announcements and existing read-only published reports retain their explicit consumed contracts. Their absence from a particular handoff inventory is not treated as proof that all compatibility endpoints are unavailable. No new Global Exam, AI, parent payment/submission, or writing-feedback capability is invented.

Latest authenticated contract check: **2026-09-04 01:49 UTC**, 29 reads with the supplied role identities. New list pages, both message cursors, Parent calendar and current/completed course filters are already served by Dev. The three runtime mismatches above remain reproducible; Instructor course-member 403 remains a separate role-policy question. Additional Student/Instructor calendar reads confirmed UTC session items. Final gate and deployment results are recorded after the release completes.
