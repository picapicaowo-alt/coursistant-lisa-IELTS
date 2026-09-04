# Dashboard course cards and Advisor schedule review

## Student course cards

The dashboard now reserves two equal course-card slots in its desktop course
region, independent of enrolment count. Additional courses keep the existing
horizontal navigation. Narrow containers use one slot capped at 24rem and shrink
to fit mobile screens. The card uses the same standard `CourseIdentityCard`
presentation as Instructor courses, including spacing, typography, hover/focus
treatment and primary action. Position-based icon color overrides are removed.

Existing dashboard composition and API calls are preserved. These edits are
local and have not been merged or deployed.

## Advisor schedule finding

`AdvisorLearningSchedule` loads active owned courses, then calls
`GET /v2/courses/{courseId}/session-occurrences` with `from`, `to` and
`includeHistory=false`. The notice “Some course sessions could not be displayed”
appears if an individual request fails or a returned row lacks the expected
numeric identity, occurrence date or start time. Valid sessions remain visible.

The request matches `listSessionOccurrences` in `docs/api/course.openapi.yaml`.
The earlier authenticated acceptance recorded in
`advisor-course-management-predeploy-review-2026-09-03.md` found successful
course/configuration/weekly-session reads but “Course does not exist” for the
dated-occurrence read, including after retry. That is prior evidence of an
external integration issue, not proof of the cause of this screenshot.

The live browser tab was unavailable because another task owns it. This review
therefore cannot establish the current HTTP status, business code, response
shape or affected course. Backend owners need those details to investigate the
live occurrence read. No backend, permission, environment or credential changes
were made. The failure notice and retry remain; unavailable data is not replaced
with recurring templates or an empty-week claim.

## Validation

- Targeted ESLint and production TypeScript checks passed.
- Production build passed in an isolated temporary output directory.
- Two Playwright regressions passed against that build: stable card widths for
  one, two and three courses at 390/1440/1920/2560px; desktop two-slot geometry;
  overflow containment and horizontal navigation; Advisor partial-read failure,
  preservation of successful sessions and recovery after explicit retry.
- Desktop and mobile screenshots were visually inspected. All browser data was
  intercepted fixture data; this does not establish authenticated Dev acceptance.
