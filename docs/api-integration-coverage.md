# Frontend API integration coverage

Snapshot received 2026-08-28. The nine files under `docs/api/` are the
frontend-consumed copies of the backend OpenAPI supplied for the 8085 training
product. The browser continues to use same-origin `/api`; 8085 proxies that to
the training LMS on 8083.

| Contract | Paths | Operations | Frontend status |
|---|---:|---:|---|
| User | 8 | 13 | Current profile/avatar, user directory/detail/avatar, and supported admin writes connected; five `*Disabled` operations intentionally have no UI |
| Parent | 26 | 30 | New typed service plus Parent portal and Counsellor/Advisor/Tenant link controls |
| Notification | 5 | 5 | Personal notification center already connected; admin digest transport added |
| Counsellor | 5 | 7 | All operations already connected |
| Course | 111 | 148 | Existing course UI retained; Course Operations and My Operations expose attendance, occurrences, scheduling, hours, reports, alerts, availability, discussions, relationships, and personal events |
| Mock Exam | 40 | 47 | Role-scoped transport retained; the complete exam loop is explicitly excluded from this delivery |
| Assignment | 35 | 42 | Existing workflows plus the full assignment collection and course attachment manifest are connected, including authenticated binary helpers |
| Auth | 18 | 21 | Login/register/reset/session, administrator directory/detail, and enabled managed-user operations connected; four `*Disabled` admin CRUD operations intentionally omitted |
| Advising | 53 | 62 | Existing A/B plus course orchestration, tasks, dashboard/hub, reports, conversations, and action tasks connected |

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
- Tenant course cards link to delivery configuration for catalog/capacity and
  READY/PUBLISH transitions.
- `/my-operations` provides the current user's alerts, attendance, progress,
  work queue, calendar, course hours, personal events, reports, and instructor
  teaching/availability operations.
- `/course/:courseId/operations` provides the course-level non-authoring
  operations, assignment manifest, and instructor-safe student context.
- Admin Console operations expose admin/user detail, user avatar, notification
  digest, tenant instructor availability, and versioned tenant alert rules.
- Student advising supports task transitions, messaging, read state, and
  authenticated conversation attachment preview/download.

These pages intentionally use the existing design tokens and functional
components. They do not claim final visual parity with a future Figma file.

## Contract limitations retained in the frontend

- Many Course, Parent, Assignment, User/Auth and Mock Exam success responses,
  plus 14 Advising operations, only reference a generic `ApiResponse` or omit a
  concrete response payload schema in the supplied YAML. New uncertain reads
  return `unknown`, and the UI uses
  a safe structured contract-data renderer. This prevents invented fields while
  still making the live backend data usable.
- Disabled user/admin CRUD operations remain disabled. The presence of a path
  in OpenAPI does not authorize the frontend to expose an operation whose
  operationId explicitly says `Disabled`.
- Real shared-Dev writes still require an authorized fixture account and must
  respect the backend's idempotency and optimistic-version checks.
- The backend `/api/v3/api-docs` aggregation endpoint currently returns 500.
  This prevents a live operation-count comparison; the checked-in nine YAML
  files remain the frontend contract snapshot. See `backend-openapi-handoff.md`.
