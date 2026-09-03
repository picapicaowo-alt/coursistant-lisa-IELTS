# Frontend role and contract audit — 2026-09-02

## Acceptance statement / 验收结论

The local frontend passes its automated baseline and the six-role fixture workflows described below. This is **not full authenticated acceptance of every backend operation**. The existing Dev browser session allowed an Advisor read-only walkthrough. Passwords for the other supplied accounts were not available, so no new account login or real business-data write was performed. Local changes have not been pushed, merged, or deployed.

Authority: the three supplied Markdown handoffs and seven supplied OpenAPI updates, plus the independently versioned Assignment, Quiz, User, and Vocabulary contracts. The frontend did not inspect or modify backend source, databases, infrastructure, environment values, or designated accounts. The earlier [handoff implementation report](frontend-handoff-2026-09-02-validation.md) remains a historical checkpoint; this report supersedes its test counts.

## Corrected behavior / 已修复

| Scope | Finding and correction |
|---|---|
| Week 1 grading | The queue consumed a backend destination that the frontend did not register. It now builds the grading URL from course/assignment IDs using the route registered by the app. A regression clicks an intentionally incompatible link and verifies the rendered grading page and roster request. The screenshot did not expose the original destination URL, so it does not establish that URL verbatim. |
| Routing | App registration and incoming destination validation share route definitions. Invalid, external, and unknown backend destinations are rejected. Notifications resolve to the signed-in role’s workspace. Six role-boundary cases verify redirects without calling the forbidden workspace APIs. |
| Account isolation | Login/session clearing removes TanStack Query and mutation data to prevent previous-account state from carrying into the next session. |
| Contract parameters | Schedule types use `ABSENCE` and `SCHEDULE_CHANGE`. Absence omits proposed replacement times. Parent history uses `beforeId`; eight unpaginated reads no longer send invented page/size parameters. |
| Optimistic concurrency | Profile, Study Plan, intake, delivery, account correction, and availability retain the version reviewed by the editor. Background refetch cannot silently advance the mutation version. Explicit conflict recovery preserves drafts. Intake PATCH sends changed fields only. |
| Retry behavior | Student/Parent message retries retain both clientMessageId and idempotency key. Student schedule and personal-event retries also retain their key until success. Parent section data and infinite message history use separate query keys. |
| Missing reads | Advisor task detail and selected mock paper detail, Instructor teaching courses, Student occurrence attendance and personal-event detail are reachable from their workspaces. Student quiz history uses the current-user endpoint and submitted attempts request their receipt. |
| Observer results | Advisor and Parent read their own role-scoped mock exam list/detail and scores; the UI does not send them to a candidate attempt route. |
| Error states | Student overview and Parent content distinguish failed requests from empty results. Drafts remain available on failed writes. Clean saved intake records offer an explicit Advisor-handover action instead of an empty PATCH. |
| UI alignment | Advisor, Counsellor, Parent, teaching, and Tenant governance use shared workspace spacing. Shared conflict banners, observer result cards, and section headings use existing semantic tokens. Redundant nested main landmarks and repeated overline labels were removed from the touched workspaces. |

## Role evidence / 分角色证据

| Role | Workflow and route evidence | Local fixture acceptance | Real Dev acceptance |
|---|---|---|---|
| Student 学生 | `/my-plan`, `/my-operations`, quiz and mock exam entry; plan/task/message UI, notification destinations, personal-event detail/version/retry, failure versus empty state | Automated role flows, privacy checks, route denial, and screenshot review passed | Login and business flows pending credentials |
| Advisor 顾问 | `/advisor/operations`, `/advisor/students/:id/*`, owned-course delivery, `/mock-exams`; intake/profile/plan/support, directories, conversations, tasks and observer results | Automated navigation, optimistic-version, directory/paging, role-boundary, and responsive checks passed | Existing signed-in Advisor could read operations, assigned students, intake/parent link, profile/plan, support and mock-exam workspace. This used the previous Dev frontend, not the local build. No writes performed |
| Instructor 老师 | `/my-operations`, registered assignment grading, teaching courses/availability, writing grading | Week 1 queue click, actual grading roster request, availability preservation, and role denial passed | Both supplied Instructor accounts need credentials; real grading save/release and class-specific authorization remain unaccepted |
| Counsellor 招生 | `/counsellor`, `/counsellor/intakes/*`; create/edit intake, Parent links, Advisor handover | Workflow, changed-field PATCH, required fields, and access loss after handover passed | Login, real account creation and handover pending credentials |
| Tenant Admin 租户管理员 | `/admin`, `/admin/intakes`, `/admin/students/:id`; directory/correction, ownership, alert rules, governance audit and mock templates | Contract routes, correction conflicts, governance controls, intake dialogs and role denial passed | Login and governance writes pending credentials |
| Parent 家长 | `/parent`; linked student, schedule, messages, reports, observer exam detail | Absence submission, exam score detail, older-message cursor, retry identity, and mobile width passed | Login and linked-student authorization pending credentials |

The supplied account set includes two Students and two Instructors. Fixture roles do not prove account-by-account differences or cross-student isolation on Dev. A real acceptance pass must exercise each supplied account after credentials and the intended frontend release are available.

## Complete operation inventory / 接口清单

The [431-row operation matrix](frontend-operation-matrix-2026-09-02.md) records operationId, HTTP path, transport method, production consumer, and boundary. Counts are source evidence, not a live success percentage:

| Classification | Count | Meaning |
|---|---:|---|
| Service plus production consumer | 407 | A frontend call path is identifiable, including binary helpers and wrapper consumers |
| Alternate workflow | 4 | Course Session, Course Week and Quiz Question use collection projections; roster enrollment uses the batch endpoint with email identifiers |
| Disabled / diagnostic | 10 | Nine explicitly Disabled operations plus the auth greeting; no business UI added |
| Transport without identified consumer | 10 | Generic admin detail, generic user detail, another user’s avatar, and seven System mock-exam detail/section/media reads |

The last ten are recorded as gaps, not silently counted as implemented. The System mock-exam endpoints are outside the supplied Tenant Admin identity; Tenant scope must not be broadened to reach them. Alternative collection/batch workflows and generic response projections still need real-data validation. The source query audit found no remaining undocumented keys in the literal GET query objects it checked; it is not a complete schema validator.

## Validation / 验证

| Gate | Result |
|---|---|
| `npm run lint:ci` | PASS, zero warnings |
| `npm run typecheck` | PASS |
| `npm run typecheck:production` | PASS |
| `npm run test:run` | PASS, 125 files / 522 tests |
| `npm run build` | PASS |
| Isolated production-preview Playwright suite | PASS, 32 tests: `CI=1 PLAYWRIGHT_PORT=4199 npm run test:e2e -- --retries=0` |
| `git diff --check` | PASS |

Playwright uses synthetic identities and intercepted API responses on an isolated local preview; it never logs those fixtures into Dev. Meaningful cases include incompatible grading links, route isolation before requests, dirty-edit background refetch, message/calendar retry identity, observer results and requested query parameters. Desktop and 390px screenshot samples were reviewed for Student, Advisor, Instructor, Counsellor, Tenant Admin and Parent workspaces. Responsive assertions passed where included; this does not claim exhaustive visual acceptance of every record/state at every viewport.

## Remaining acceptance work / 未完成的真实验收

- Obtain the supplied accounts’ passwords without resetting or modifying the accounts. Test each login and its role/tenant/course/student boundary.
- On the intended frontend release, repeat Week 1 opening and grading save/release with a real Instructor, then verify Student visibility.
- Exercise real intake handover, ownership/concurrency conflict, Parent link allow/deny, message attachments, mock exam media/attempt/grading and notifications using agreed test records.
- Resolve or explicitly accept the ten transport-only reads and any backend response-schema gaps before claiming all operations have complete UI coverage.
- Keep backend deployment/prerequisite confirmation separate: backend Markdown gates are not proof that those changes are present on Dev.

No production-readiness claim is made for these pending items.
