# First-pass frontend verification — 2026-09-03

Scope: local frontend working tree on `codex/figma-full-site-parity`, based on `49c8a1dd4fffb5238b482c1e900a79d21f09152f`. Tests run from `lms/`. These are fixture-based frontend results, not authenticated Dev acceptance.

> Historical first-pass evidence. The following counts and hashes describe that completed run; see [the subsequent client review](../../client-delivery-review-2026-09-03.md) for the release candidate.

## Checks

| Check | Result | Evidence |
|---|---|---|
| `npm run lint:ci` | Pass, zero lint warnings | [log](logs/lint-final.log) |
| `npm run typecheck` | Pass | [log](logs/typecheck-all-final.log) |
| `npm run typecheck:production` | Pass | [log](logs/typecheck-production-final.log) |
| `npm run test:run -- --maxWorkers=4` | 129 files / 539 tests passed; no unintended network calls in final run | [log](logs/unit-final.log) |
| `npm run build` | Production build passed | [log](logs/build-final.log) |
| `CI=1 PLAYWRIGHT_PORT=4193 npm run test:e2e -- --workers=4 --retries=0` | 66 tests passed, zero retries | [log](logs/e2e-final.log) |
| Diff whitespace / scope | `git diff --check` clean; no tracked environment, lockfile or OpenAPI edits | [file inventory](working-files.json) |

The runtime emits its existing `module.register` deprecation notice and Playwright color-environment notices. They are not application failures. Earlier fixture gaps and broad locators were corrected before the final successful run; failing runs are not counted as passes.

## What the tests establish

- Nine role/page cases check geometry at 320, 390, 768, 1024, 1440, 1920 and 2560px; titles remain legible and the document has no horizontal overflow. Other route-specific tests exercise desktop and 390px mobile layouts. This does not mean every page was tested on every physical device.
- Student course cards show measured assignment completion, grid/list selection, and a real material destination. Discussion submission uses its multipart request and idempotency key. TA restrictions remain in force.
- Study-plan tasks use returned status counts and checkpoint/task navigation. Existing checkpoint start/complete, submission, version conflict and focus-restoration tests remain passing.
- Advisor Dashboard and Messages have distinct routes, layouts and purposes. Support exposes conversation, reports and learning history without requiring expansion. Student directories preserve server query/filter/pagination and role scope.
- Profile assessments use released grades. Photo crop occurs before the real avatar upload request; cancellation does not upload.
- Personal events preserve local whole-second timestamps and timezone, fetch the current version before PATCH, and retain the required query window. The date picker works inside native dialogs. Calendar overlap layout is separately unit-tested.
- Existing grading, exam sections, intake handover, Parent views, Tenant directory/ownership, administrator restrictions, and deep links remain covered by the full suite.

## Visual review

All 69 Figma UI frames/states and the separate UX Flow were inventoried. Source screenshot contact sheets were reviewed during the audit; the exact nodes remain linked from the [full matrix](../../figma-parity-audit-2026-09-03.md). Application screenshots were inspected at desktop/mobile sizes, with targeted full-size inspection for navigation, course cards, Advisor lists, AI, dialogs and calendars.

The Impeccable detector ran once against 85 changed UI files. It reported three style heuristics: Inter, a calendar event accent, and an unused Advisor draft accent. Inter and calendar category cues follow the supplied design; the unused Advisor stylesheet was removed and replaced with only the consumed styles. [Raw detector output](craft-detector.json) is retained as evidence of that single run, not a current defect list. React review checked query gating, role access, versioned writes, object-URL cleanup, dialog behavior and data-derived state.

Screenshots are local QA artifacts and are not committed, following PROJECT_STANDARDS. The table records the locally reviewed sizes. Screenshots use isolated synthetic records. Empty states, unavailable scores, and missing photos deliberately remain visible where a fixture lacks those values. They are not production screenshots, sample records shipped inside the app, or pixel-difference certification of all 69 states.

| Workspace | Desktop | Mobile |
|---|---|---|
| courses | 1440px (local screenshot) | 390px (local screenshot) |
| course-outline | 1440px (local screenshot) | 390px (local screenshot) |
| course-reader | 1440px (local screenshot) | 390px (local screenshot) |
| advisor-tasks | 1440px (local screenshot) | 390px (local screenshot) |
| advisor-messages | 1440px (local screenshot) | 390px (local screenshot) |
| advisor-dashboard | 1440px (local screenshot) | 390px (local screenshot) |
| advisor-students | 1440px (local screenshot) | 390px (local screenshot) |
| calendar-week | 1440px (local screenshot) | 390px (local screenshot) |
| calendar-month | 1440px (local screenshot) | 390px (local screenshot) |
| student-ai | 1440px (local screenshot) | 390px (local screenshot) |
| profile-assessments | 1440px (local screenshot) | 390px (local screenshot) |
| advisor-support | 1440px (local screenshot) | 390px (local screenshot) |
| student | 1440px (local screenshot) | 390px (local screenshot) |
| instructor | 1440px (local screenshot) | 390px (local screenshot) |
| combined-instructor-advisor | 1440px (local screenshot) | 390px (local screenshot) |
| counsellor | 1440px (local screenshot) | 390px (local screenshot) |
| parent | 1440px (local screenshot) | 390px (local screenshot) |
| tenant-admin | 1440px (local screenshot) | 390px (local screenshot) |
| system-admin | 1440px (local screenshot) | 390px (local screenshot) |
| student-exams | 1440px (local screenshot) | 390px (local screenshot) |

## Remaining acceptance boundary

The 13 contract dependencies are in the [backend handoff](../../advisor-figma-backend-handoff.md). In particular, the current snapshots do not supply all Figma lesson-resume metrics, course notes, Advisor-parent threads, observer question-editing, persistent AI history or every typed generic read. Existing endpoints are distinguished from genuinely missing capabilities.

This run did not push, merge or deploy. The provided Dev 8085 entry was inspected only at the login page. No authenticated Dev business scenario, actual API latency/load, cross-tenant backend enforcement or physical-device testing is claimed. Backend owners must supply the missing contracts/authorized fixtures before those items can be accepted end to end.
