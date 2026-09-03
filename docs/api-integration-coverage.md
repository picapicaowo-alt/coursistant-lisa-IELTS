# Frontend API integration coverage

Current source audit: **2026-09-02**, after the supplied Advisor, Counsellor,
and Tenant Admin handoffs and seven OpenAPI updates. Eleven contracts contain
431 operations. See the [operation evidence matrix](frontend-operation-matrix-2026-09-02.md)
and [role acceptance report](frontend-role-audit-2026-09-02.md).

Source classification: 407 operations have a service and production consumer,
4 use collection reads or batch enrollment instead of individual operations, 10 are Disabled or diagnostic,
and 10 have transport methods without an identified production consumer.
These numbers describe source reachability, not live business acceptance.
The browser integration remains same-origin `/api`.

| Contract | Paths | Operations |
|---|---:|---:|
| Advising | 53 | 64 |
| Assignment | 35 | 42 |
| Auth | 24 | 27 |
| Counsellor | 5 | 7 |
| Course | 113 | 151 |
| Mock Exam | 43 | 51 |
| Notification | 5 | 5 |
| Parent | 26 | 32 |
| Quiz | 22 | 29 |
| User | 8 | 13 |
| Vocabulary | 10 | 10 |

## UI delivered before Figma

- Parent accounts land on `/parent` and can select linked students, read the
  academic sections and report detail, request schedule changes, manage read
  state, preview/download conversation attachments, see mock exams, and send messages.
- `/mock-exams` changes by role: Tenant creates templates, Advisor assigns a
  published template, Student starts an attempt, and Instructor grades writing.
- Advisor student workspaces include `/courses` for course search/linking,
  one-to-one create/reassignment/session replacement, READY/PUBLISH, reconfirm,
  completion, and withdraw; `/support` covers attendance, hours, reports, tasks,
  and the student conversation.
- Advisor `/operations` covers dashboard, action-task detail and transitions,
  schedule-request decisions, conversations, and instructor availability.
- Advisor course cards link to delivery configuration for catalog/capacity and
  READY/PUBLISH transitions. Removed Tenant delivery routes are no longer called.
- `/my-operations` provides the current user's alerts, attendance, progress,
  work queue, calendar, course hours, personal events, reports, and instructor
  teaching/availability operations.
- `/course/:courseId/operations` provides the course-level non-authoring
  operations, assignment manifest, and instructor-safe student context.
- Admin Console and Tenant governance expose managed-user
  directory/detail/audit/enable, notification digest, and versioned Tenant
  alert rules. Generic admin/user detail and another user’s avatar have
  transport methods without an identified production page consumer. Managed-user creation is restricted to contract-supported staff
  and Tenant administrator levels.
- Student advising supports task transitions, messaging, read state, and
  authenticated conversation attachment preview/download.

These pages intentionally use the existing design tokens and functional
components. They do not claim final visual parity with a future Figma file.

## Contract limitations retained in the frontend

- Many Course, Parent, Assignment, User/Auth and Mock Exam success responses,
  and some Advising operations, only reference a generic `ApiResponse` or omit a
  concrete response payload schema in the supplied YAML. New uncertain reads
  return `unknown`, and the UI uses
  a safe structured contract-data renderer. This prevents invented fields while
  still making the live backend data usable.
- Disabled user/admin CRUD operations remain disabled. The presence of a path
  in OpenAPI does not authorize the frontend to expose an operation whose
  operationId explicitly says `Disabled`.
- Real shared-Dev writes still require an authorized fixture account and must
  respect the backend's idempotency and optimistic-version checks.
- The backend `/api/v3/api-docs` aggregation endpoint returned 500 during the
  previous Dev verification. Until a live recheck succeeds, the checked-in
  YAML files remain the frontend contract snapshot. See
  `backend-openapi-handoff.md`.
