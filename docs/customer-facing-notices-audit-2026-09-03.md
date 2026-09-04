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
| Instructor personal-event permissions | Authenticated Instructor requests return `403 ACCESS_DENIED`; the consumed contract does not define role eligibility. | Preserve course calendar and failure recovery; disable Add event until the personal-event read succeeds. No permission broadening. |

Additional copy cleanup removes implementation commentary about backend versions and unavailable contract fields from Advisor profile/support/schedule, course delivery, attendance, assignment/event editors, tenant accounts, and exam authoring. Required reload instructions, unsaved-draft warnings and real permission checks remain.

The common error policy also covers course creation, syllabus changes, uploads, exam submission, workflow feedback and batch enrolment. Browser media/crop diagnostics use contextual recovery copy. Retired JSX routes and duplicate-number source copies are not release inputs.

## API review

Paths, required parameters, identity and response envelopes were compared with the frontend services and consumed `docs/api/course.openapi.yaml`, `advising.openapi.yaml`, and Parent/notification services. No API path, base URL, credentials, environment value, proxy or server permission was changed.

- `meTeachingGradingItems`: Instructor-level operation with no query parameters. Both supplied instructors receive HTTP 500 / `INTERNAL_SERVER_ERROR`; the aggregate grading-queue read succeeds. This is a service failure, not a successful empty list.
- `listSessionOccurrences`: documented course ID and optional `from`, `to`, `includeHistory`. Advisor reads fail both without optional parameters and with actual course-term dates. The same courses have successful Instructor occurrence reads. Backend must clarify Advisor ownership versus course-membership access; the error is not evidence that the courses or occurrences do not exist.
- `meCourseHours`: student balances are absent (`COURSE_HOURS_NOT_FOUND`). No synthetic account or balance is created by the frontend.
- `listMyPersonalEvents`: required UTC `fromUtc`/`toUtc` are present. Instructor receives 403 while Student succeeds. Role eligibility needs an explicit backend/product decision.
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

Final local baseline: `npm run lint:ci`, `npm run typecheck`, `npm run typecheck:production`, `npm run test:run -- --maxWorkers=2` (139 files / 611 tests), `npm run build`, `npm run build:dev`, and `CI=1 PLAYWRIGHT_PORT=4198 npm run test:e2e -- --workers=2 --retries=0` (175 tests) all passed. Desktop schedule and mobile grading-failure screenshots were inspected. All dependency and environment inputs remain unchanged.
