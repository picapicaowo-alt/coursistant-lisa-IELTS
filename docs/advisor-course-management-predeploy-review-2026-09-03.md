# Advisor Course Management — Frontend Release Review

Date: 2026-09-03
Scope: coursistant-lisa-IELTS frontend; Dev 8085 only.
Status: frontend findings fixed; complete local release gates passed. Push/merge/deployment pending.

## Changes and boundaries

The course listing and delivery workspace retain the shared Advisor Header, Sidebar, route shell and semantic design tokens. Desktop uses a full-width three-column listing, an 8+4 delivery workspace and two-column recurring-session cards; mobile collapses deliberately.

Only course-management files are included in the isolated release branch. Unrelated dirty-workspace changes, duplicate-number files, backend/infrastructure code, environment inputs, credentials and dependency manifests are excluded.

Unsupported Students / Staff / Assessments / Settings tabs and decorative More controls are removed. There is no fake course preview, file-management action, enrollment configuration or invented eight-point publication result. Materials remain a non-interactive instructor-workspace handoff. Occurrence type is omitted because the consumed response does not guarantee a template identity; clock times are not used to guess it.

## Consumed API mapping

| User action | Existing endpoint | Frontend safeguards |
|---|---|---|
| Search, filter, paginate owned courses | GET /v2/advisor/courses | q maximum 120; launchState/lifecycleState/page/size; query-driven totals |
| Select instructor | GET /v2/advisor/instructors | Existing paginated picker, selected instructor identity |
| Create group course | POST /v2/courses | Course-local dates, selected primaryInstructorUserId, Idempotency-Key, configured-route redirect |
| Read course identity | GET /v2/courses/{courseId} | Error retained; no configuration/scheduling writes before successful read |
| Read/save delivery | GET/PUT /v2/advisor/courses/{courseId}/delivery-config | Only exact COURSE_DELIVERY_CONFIG_NOT_FOUND means absent; catalog maximum 64; positive integer capacity; existing-config version |
| Validate/publish | POST /v2/advisor/courses/{courseId}/launch/ready or /publish | Confirmed GROUP, valid current version, state eligibility, Idempotency-Key; disabled during delivery or schedule writes |
| Read/add/update weekly templates | GET/POST /v2/courses/{courseId}/sessions; PUT /v2/courses/{courseId}/sessions/{sessionId} | Successful GROUP config and session read; unpublished schedule; complete templates; idempotent writes |
| Read/generate dated occurrences | GET /v2/courses/{courseId}/session-occurrences; POST /generate | Actual course-local term defaults, explicit date validation, no invented four-month window, idempotent retry |

Authority: docs/api/advising.openapi.yaml and docs/api/course.openapi.yaml. ONE_ON_ONE editing belongs to the dedicated student advising workflow; this owner page never substitutes generic session mutations for that orchestration. A denied or unavailable read is an error, not an empty record or permission grant. Backend authorization remains authoritative.

## Review findings closed

Functional and security reviewers independently inspected the candidate. Original findings were fixed:

- Fail-open scheduling in loading, denied, absent-config and one-on-one states.
- Draft/version initialization after failed reads; exact 404 classification.
- Course identity changes retaining another course's draft or conflict state.
- Config/launch mutations leaving owned cards and summary caches stale.
- Async course loading producing a different generation range from the displayed term.
- Unsupported occurrence-type inference and fabricated Active/Scheduled labels.
- Valid 64-character codes overflowing inner grid tracks and card boundaries.
- Catalog validation mismatch; shared header/readiness action guards.
- Search submit affordance, mutation retry guidance and truthful lifecycle/type labels.

Security re-review found no remaining actionable issue in the reviewed change. Functional follow-up identified search-length, retry-copy and unsupported-type-label issues; those were subsequently corrected and covered by browser regressions. Further local hardening tracks in-flight schedule writes across tab changes to prevent concurrent launch actions.

No new credentials, API hosts, demo values, raw brand colors, unsafe HTML, `any` escapes or authentication changes were introduced. Literal UI copy and test fixtures are not deployment configuration. Dependencies are unchanged.

## Verification

- Isolated worktree created from merged origin/main b0699606c354ab33fd7ca9c056c0e4e5b5ba050e; npm ci passed.
- lint:ci, typecheck and typecheck:production passed.
- Vitest: 132 files / 556 tests passed.
- Production build passed; final Dev build and all 112 browser tests passed without retries.
- Regression coverage includes failed-write idempotent retry and launch blocking across tab changes while schedule writes remain in flight.
- Browser geometry checks cover 320, 390, 768, 1024, 1440, 1920 and 2560 px, including exact same Header height and Sidebar width across Advisor home/list/delivery/schedule.
- Maximum-length catalog code containment is tested inside its actual card, not only at document width.
- Screenshots visually reviewed at desktop and mobile; QA images remain local, not tracked.
- API fixtures verify request paths, methods, payloads, versions, idempotency, error recovery, course switch isolation, pagination, creation and list invalidation.

One early browser run used the previous static build; that stale-artifact run was discarded, then the application was rebuilt before verification. No failing test was ignored or weakened.

## Acceptance limits and existing risk

Mocked browser acceptance is not authenticated Dev business-flow acceptance. No real course, schedule or publication record was created or altered during these checks. Actual Advisor occurrence permissions, instructor availability enforcement and end-to-end live writes still require an authorized account and suitable course fixture. Unsupported or denied states remain read only and recoverable.

Existing main-branch dependency audit reports 5 moderate affected packages (0 high/critical); production-only reports 3 affected packages representing two underlying advisories: @tiptap/core and @xmldom/xmldom through speech-rule-engine. This release does not modify dependencies. A dedicated compatibility-reviewed dependency upgrade remains separate; no claim of zero dependency vulnerabilities or demonstrated application exploitability is made.

## Release

Push/merge only after the complete frontend gate passes. Build immutable Dev 8085 assets from the merged clean commit, preserve current/previous rollback, and verify revision/hash, PM2, loopback, public HTML/entry assets and the tokenless API boundary. USC 8084 and Prod remain untouched. Deployment evidence will be recorded after publication.
