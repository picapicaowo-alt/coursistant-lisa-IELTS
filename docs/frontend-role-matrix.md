# Frontend role matrix

This matrix controls navigation and route visibility. Backend authorization remains the authority for every request.

| Account / membership | Frontend areas |
| --- | --- |
| `SYSTEM_ADMIN` | Courses, Course Operations, legacy system enrolment, Admin Console, cross-tenant Mock Exam read |
| `TENANT_ADMIN` | Courses, Course Operations, Delivery setup, Intake and Student administration, Admin Console, tenant Mock Exam templates |
| `USER / COUNSELLOR` | Counsellor dashboard and unassigned Intake queue only |
| `USER / ADVISOR` | Advisor Operations, assigned Students, course search and adjustment, support/report/hour/conversation tools, published Mock Exam templates |
| `USER / INSTRUCTOR_ADVISOR` | Advisor areas plus Teaching Operations and course areas allowed by the user's course membership |
| `USER / INSTRUCTOR` | Teaching Operations, own courses, course workspace, Instructor Mock Exam writing queue |
| Course membership `Instructor` or `TA` | Course Operations for that course. A `TA` capability is course-scoped and does not carry to other courses. |
| Course membership `Student` | Course workspace only; no Course Operations entry |
| `USER / STUDENT` | My Plan, Learning Overview, own courses, calendar and own Mock Exams. Advisor-conversation read and attachment actions remain in My Plan. |
| `USER / PARENT` | Linked-student Parent portal: reports, notifications, conversations, attachments, schedule and Mock Exam reads |

## Contract boundary

The consumed OpenAPI files define paths, payloads, and operation names, but many course operations do not declare per-operation roles/scopes (for example through OAuth scopes or an `x-roles` extension). The frontend therefore uses the explicit route namespaces, endpoint summaries, platform role, and `/v2/me/courses` membership role. The backend team should add machine-readable operation-level authorization metadata so future frontend coverage can be generated and audited without inference.

The Mock Exam surface now follows the supplied role matrix end to end: Students take assigned sections, Tenant Admins compose and release template versions, Advisors assign published templates and inspect student history, Instructors review writing submissions, and System Admins retain cross-tenant read-only oversight. Backend authorization remains authoritative, and generic success payloads are narrowed at runtime until concrete OpenAPI response schemas are supplied.
