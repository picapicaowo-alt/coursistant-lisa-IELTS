# Frontend handoff alignment — 2026-09-02

## Inputs and authority

This change consumes the three supplied Advisor, Tenant Admin, and Counsellor Markdown handoffs and the supplied advising, auth, counsellor, course, parent, mockexam, and notification OpenAPI snapshots. The repository copies are synchronized (line endings normalized). Existing assignment, quiz, user, and vocabulary contracts retain their independent versions.

Backend implementation notes and local backend gates are evidence supplied by the backend team, not frontend deployment authority. No backend source, database, infrastructure, deployment configuration, or demo credentials were changed. No Git push, merge, Dev release, or Prod release was performed.

## Delivered frontend scope

| Module | Implemented behavior | Validation boundary |
|---|---|---|
| Teaching grading | Queue destinations are generated from course and assignment IDs using the same route definition registered by the app. An incompatible backend deep link cannot send Week 1 into the global not-found route. | Regression uses an intentionally incompatible backend link and asserts the actual grading roster request and rendered assignment heading. The screenshot did not include the original destination URL. |
| Advisor directories | Instructor search and pagination use the Advisor directory. Student search combines q, risk, studentType, and activeTaskType. Owner course search includes launch/lifecycle filters and nullable delivery metadata. | Typed services and deterministic UI/API tests. |
| Advisor operations | Paginated conversations and schedule requests; structured conversation names; unread-only filter; action-task filters and typed navigation targets. | No sourceReference parsing and no Tenant directory fallback. |
| Advisor student workspace | Hub loads before child tabs. Ownership-related child read/write 404 exits to the refreshed student queue and removes student query data. Initial missing Profile/Plan remains a valid creation state. | Automated query-cache boundary tests. |
| Advisor planning | Instructor pickers for 1:1 creation/reassignment and Writing mock assignment. Group creation, recurring schedule, occurrence generation, delivery readiness/publish controls. Group student links do not show 1:1 launch controls; completed/hidden/withdrawn links expose no new mutation controls. | Local frontend implementation; backend owner authorization and live schedule conflict cases require target-environment acceptance. |
| Advisor support | Older-message cursor loading, stable message/client retry IDs, authenticated attachment handling, audio rejection, report pagination with separate 0-based student and 1-based course adapters. | Local frontend validation; live message/file writes not performed. |
| Counsellor | Active Parent Link GET retained; mutations refresh authoritative links; ownership loss closes the intake workspace; intake conflict preserves the draft and requires explicit reload. | Existing Parent Link/API tests plus ownership handling. No Parent directory or post-assignment intake access introduced. |
| Tenant Admin | Staff and other Tenant Admin profile correction with accountVersion, draft-preserving conflict reload, self-edit exclusion, disable preview using target identity and blockers, stable governance mutation retry keys. | Account conflict and blocked-disable UI tests. Enable follows the no-key contract. |
| Mock exam media | fileName response field, authenticated preview, recoverable upload list, UPLOADED-only selection/deletion, mediaId creation payloads, per-version composer reset, stable upload retry keys. | Existing media service coverage; target-environment storage/Range verification remains with integration acceptance. |
| Notifications | Snapshot aligned; existing nullable course fields and /v2/me/notifications idempotent read operations already match. | Existing notification tests. |

## Validation

| Check | Result |
|---|---|
| `npm run lint:ci` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run typecheck:production` | PASS |
| `npm run test:run` | PASS, 122 files / 505 tests |
| `npm run build` | PASS |
| `CI=1 PLAYWRIGHT_PORT=4191 npm run test:e2e -- --retries=0` | PASS, 24 tests |
| `git diff --check` | PASS |
| Seven supplied OpenAPI documents vs repository snapshots | Semantic equality PASS |

The final end-to-end run uses the current production build on an isolated local preview port. It covers the Week 1 queue-to-grading route, Advisor conversation pagination and directory boundary, required Writing instructor selection, Profile/Plan Hub entry, and the existing role/responsive suite. The updated Advisor operations page also passes a 390px horizontal-overflow check. Earlier failures from obsolete no-parameter schedule assertions and missing new Hub/instructor fixtures were corrected to match the supplied contracts; the final run passes without retries.

## Environment acceptance

The attached backend gates describe local backend execution. The Counselor handoff explicitly defers full Maven verification, and the Tenant Admin handoff explicitly excludes Dev/Prod promotion. This frontend run does not certify those backend releases or apply their database prerequisites.

The available browser session was an Advisor session on the existing Dev release. It confirmed the previous UI still had raw instructor-ID entry and inappropriate Group Course launch buttons. No live data mutation was performed. The original Instructor Week 1 click is covered by the local deterministic end-to-end regression; authenticated Dev grading submission remains to be accepted after an authorized frontend release.
