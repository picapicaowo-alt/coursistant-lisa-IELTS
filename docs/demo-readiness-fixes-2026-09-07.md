# Demo readiness frontend corrections

Based on the deployed frontend revision `52f3ee57e132ec2e25b8381b71b87405a17fd4de` and authenticated Tokyo Production testing on 2026-09-07 (America/Los_Angeles).

## Exam recovery

Listening, Reading and Writing held unsent responses only in React state. Reloading the page discarded answers, reset the timer and removed a paused state. The shared runner hook now saves a same-tab `sessionStorage` draft keyed by student, assigned exam and section. Active time elapsed during reload is deducted; intentionally paused practice time is retained. A confirmed submission removes its draft, while failure preserves it. Login, logout and cross-tab identity replacement clear exam session data. Attempt IDs now share the student-scoped key scheme.

Storage is a recovery aid, not authoritative exam or grading state. The existing server-submitted section guard remains authoritative. Browsers that refuse storage show a localized limitation while allowing editing and submission to continue. Drafts do not synchronize across devices, and Reading annotation highlights/notes are not persisted by this change.

## Availability wire format

Production `PUT /v2/me/teaching/availability` rejects full weekday values such as `WEDNESDAY` with HTTP 400 `BAD_REQUEST`, message `dayOfWeek must be MON..SUN`. The consumed OpenAPI describes this as a string without an enum. The existing editor and shared weekday constants use full identifiers.

The API service converts full identifiers to MON…SUN on writes and expands short identifiers on reads for the editor. Dates, time zones, exceptions and concurrency versions are preserved. A real short-code write succeeded and an Advisor read returned the saved window. No backend or environment configuration was changed.

## Task and status presentation

- Advisor overview reads active task statuses separately so resolved history cannot occupy the limited active-task preview. The heading now describes open tasks. The unused week/month control is replaced by a clear current-caseload label.
- Parent task rows use the task deadline instead of the checkpoint deadline.
- Course summaries translate lifecycle values, request origin renders a known role label, and the completed checkpoint label is human readable. Changed copy has English, Simplified Chinese and Traditional Chinese resources.

## Validation

Targeted browser coverage includes answer recovery for all three sections, failed-submit retention, successful-submit cleanup and paused-state recovery. Unit coverage checks elapsed time, identity/exam/section separation, malformed drafts, blocked storage, session cleanup, task deadlines and the availability API round trip. Existing availability retry/version-conflict browser expectations now use the verified short weekday wire values.

Authenticated live tests separately verified course creation/launch, material and assignment submission, released grades, learning-task file completion and feedback, reports, a Parent→Instructor→Advisor schedule request, attendance/hour accounting, learning groups and Mock Exam grading. These live results do not mean the candidate frontend has been deployed: the Production frontend remains at the base revision until an approved release and post-release acceptance.
