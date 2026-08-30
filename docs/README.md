# Frontend-consumed contracts

This folder holds the backend contracts the frontend consumes. It is not
the backend repository. When a frontend change exposes a contract gap, record
the expected/observed behavior here and hand it off. Do not invent endpoints.

| File | Authority |
|---|---|
| [`api/auth.openapi.yaml`](./api/auth.openapi.yaml) | Authentication and managed-user account contract |
| [`api/user.openapi.yaml`](./api/user.openapi.yaml) | Current-user profile and user administration contract |
| [`api/course.openapi.yaml`](./api/course.openapi.yaml) | Course, schedule, attendance, hours, reports, alerts, and teaching operations |
| [`api/assignment.openapi.yaml`](./api/assignment.openapi.yaml) | Assignment, submission, rubric, grading, and attachment contract |
| [`api/notification.openapi.yaml`](./api/notification.openapi.yaml) | Current-user notification and admin digest contract |
| [`api/parent.openapi.yaml`](./api/parent.openapi.yaml) | Parent links, academic reads, schedule requests, notifications, and conversations |
| [`api/mockexam.openapi.yaml`](./api/mockexam.openapi.yaml) | Student/Parent/Advisor/Instructor/Tenant mock-exam contract |
| [`api/advising.openapi.yaml`](./api/advising.openapi.yaml) | Unique advising contract, including course orchestration, tasks, reports, and conversations |
| [`api/counsellor.openapi.yaml`](./api/counsellor.openapi.yaml) | Standalone Counsellor Intake copy of the A-gate paths |
| [`counsellor-dev-frontend-walkthrough.md`](./counsellor-dev-frontend-walkthrough.md) | Counselor Dev walkthrough |
| [`advisor-frontend-handoff.md`](./advisor-frontend-handoff.md) | Advisor Milestone B handoff |
| [`frontend-advising-progress.md`](./frontend-advising-progress.md) | Frontend A/B completeness, local test results, remaining gaps |

| [`api-integration-coverage.md`](./api-integration-coverage.md) | Per-contract frontend coverage and intentional exclusions |
| [`backend-openapi-handoff.md`](./backend-openapi-handoff.md) | Backend documentation endpoint and response-schema handoff |

## Current frontend scope

- **Milestone A:** Counsellor Intake (create, unassigned queue, patch, first assign). No cancel, reassignment, or assigned-student detail for Counsellor.
- **Milestone B:** Advisor student queue, intake, profile, study plan, revisions; Student and TENANT_ADMIN read-only views; TENANT_ADMIN cancel / first-assign / reassign.
- **Course orchestration:** Advisor course links/1:1 creation, launch transitions, Tenant delivery configuration, and Instructor profile-context transport are wired from the supplied contract.
- **Parent:** Parent account routing, linked-student portal, academic reads, schedule requests, notifications, conversations, and link-management controls are wired.
- **Mock exams:** Student paper library and full-screen Listening/Reading/Writing attempt flows are wired, including authenticated media and section submissions. Tenant template/version composition, Advisor assignment/history, Instructor writing review, and System read-only oversight have product UI entry points. Successful Dev payloads remain runtime-validated until the backend publishes concrete response schemas.
- **Course operations:** Attendance, occurrence, schedule-request, hours, report, alert, availability, discussion, relationship, assignment-manifest, enrolment, and personal-event transports have UI entry points.

OpenAPI operations whose `operationId` is explicitly suffixed `Disabled` remain intentionally unavailable in the UI. The frontend does not manufacture response fields where the supplied Parent or Mock Exam OpenAPI only describes HTTP success without a response schema.

Do not commit Dev/local passwords or fixture emails.
