# Operations dialog review

## Scope

| Area | Result |
| --- | --- |
| Tenant person picker | Radio, identity and role remain in one horizontal row. Portal isolation prevents enclosing form styles from changing the layout. Search submission and Escape do not affect the enclosing owner dialog. |
| Counsellor intake creation | Uses the same extracted creation dialog as Tenant Admin, with a scrollable form and persistent footer. Existing create API, idempotency, validation and detail navigation are retained. Editing remains on the existing detail page. |
| Advisor enrollment | Manage enrollment opens a modal containing existing lifecycle actions and a dedicated required withdrawal textarea. Pending requests prevent duplicate actions/closing; failed writes retain the reason and retry key. Version conflicts require an explicit reload, including after closing/reopening the modal. |
| Course readiness | Scoped summary typography no longer overrides the circle's grid centering. |

## Review and verification

- Independent functional review identified a version-conflict bypass on reopening the enrollment modal. The mutation error now persists until explicit reload; a regression test covers this boundary.
- Also fixed nested picker Escape propagation and tested that the parent owner dialog remains open.
- Local baseline passed: lint, normal and production typechecks, 147 unit-test files / 684 tests, production build, 230 Chromium E2E tests (no retries).
- Eleven new E2E cases cover desktop/390px/320px modal geometry, 320×568 footer reachability, cancel/focus, pending creation, payloads, idempotent retry, enrollment conflict reload, picker row geometry and readiness centering. Existing disclosure/card tests were adapted to the modal interaction.
- Manually inspected fixture screenshots for the narrow picker, mobile intake and desktop enrollment dialog. Separate browser smoke showed a populated login page, no page errors and no framework error overlay.
- Test accounts/data are synthetic. These checks do not constitute authenticated production or live business-write acceptance.

## External issues and release boundary

- Instructor personal-events HTTP 403 and grading-items HTTP 500 are documented separately in `instructor-grading-calendar-handoff-2026-09-03.md`; no backend implementation or request contract was changed.
- User authorized push, merge and IELTS Dev 8085 deployment only. Build/release from clean merged main; preserve the prior immutable release for rollback. USC Dev 8084, Prod, backend services and environment configuration are outside scope.
- The original working directory's unrelated edits are preserved; release input is the isolated reviewed worktree.
