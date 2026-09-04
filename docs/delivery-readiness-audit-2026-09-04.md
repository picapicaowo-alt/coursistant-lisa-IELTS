# Delivery readiness audit — Dev 8085

Date: 2026-09-03 Los Angeles / 2026-09-04 UTC. Scope: IELTS frontend only.

## Decision and acceptance boundary

The confirmed frontend defects below are repaired. This release is **not a sign-off that every role has completed the full business lifecycle against Dev**. Real Student read flows were exercised; the other roles and mutation/error states were verified through isolated browser fixtures and source/contract review. A successful build, fixture response, or HTTP 200 on the homepage is not live business acceptance.

**Open delivery gate:** objective Mock Exam authoring needs a contract-backed answer format and successful real save/reload. The existing local handoff `docs/mock-exam-live-acceptance-2026-09-03.md` records a Tenant Admin Reading POST returning 400, “every objective question must have an answer.” That earlier result was not reproduced with a new write in this audit. Current source still has no typed answer-key editor; the consumed question payload is generic JsonNode. The frontend now explains that rendering a question does not make it ready to save or assign. No answer fields or endpoints were invented.

## Local / repository / deployed comparison

| Surface | Observed baseline | Finding |
|---|---|---|
| Original working directory | `118883c652226bc586da47872c590f03d64605ff`, dirty | 129 tracked files differed in effective content from fetched main; 11 missing; 216 local-only source-tree files, including 142 numbered copies. Preserved without reset or release. |
| Initial GitHub main | `19bddb155aea9b388c1e9c819bf5a2e804fad69a` | Built in a separate worktree; all 743 static files matched Dev public HTTP content by SHA-256. |
| Concurrent main update | `f24b168075056b1b261ac859eee8459b50e02b8d` | Mock Exam assignment polish from PR #34; incorporated before final regression checks. |
| Concurrent operations update | `4d55252` (PR #35) | Person picker, intake/enrollment dialogs and course readiness fixes incorporated and revalidated. |
| This change | `codex/delivery-readiness-audit` | Isolated frontend worktree; clean merged-main artifact is the only release input. Final release evidence is recorded separately. |

Public `/REVISION` returns the SPA fallback. Server-side REVISION metadata plus artifact hashes are required to establish the running revision. `/api/v3/api-docs` returned 500; the 11 checked-in OpenAPI files remain the consumed authority.

## Confirmed frontend corrections

| Issue | Correction | Evidence |
|---|---|---|
| Student-wide published report endpoint existed without a frontend consumer; course-only navigation could hide reports outside current enrollment | Added Learning overview → View published reports, using `GET /v2/me/student-reports`; report details use the returned courseId and report ID | New E2E covers zero-based pages, size 10, optional courseId and MID_TERM/FINAL filters, former-course detail, 503 error, and 320/390/768/1440 widths |
| `/post`, `/post/:postId`, `/create/:contentType` still opened legacy hardcoded prototypes with nonfunctional controls | Guarded saved links redirect to the real course catalogue; users select a course and enter its existing API-connected editors. Removed lazy imports from the app route graph | Three redirect E2E scenarios; old prototype code is no longer a routed production feature |
| Login omitted display name although current-user profile supplied structured name | Header and welcome share the cached `GET /v2/me/profile` name and avatar; no whitespace name inference | Real Student profile discrepancy observed; structured first/middle/last fixture verifies repaired rendering |
| Single enrolled course occupied only one-third of the course strip; schedule collapsed prematurely | Cards use available width for one/two courses; deliberate two-column desktop layout with mobile collapse | Geometry checks through 3840 px, screenshot at 1155 px |
| Malformed Counsellor page response displayed `NaN / NaN` | Reject invalid pagination envelope and show retryable error; responsive fixtures now match real page schema | Unit test checks both errors, no NaN and no false-empty state; all-role browser check rejects NaN |
| Narrow report row squeezed its title between icon and action | On small containers, icon/text form the first row and the action follows beneath the text | Mobile screenshots and overflow checks |
| Mock Exam preview could imply readiness without answers | Authoring explains required verified answer keys; advanced editor label names answer keys | No claim that this supplies the missing answer contract or fixes real objective-question persistence |

## Role and lifecycle coverage

All browser automation below uses isolated request fixtures unless explicitly marked live. No emails or messages were sent to other people during the live walkthrough.

| Role / workflow | Frontend/API scope reviewed | Verification in this audit | Remaining live acceptance |
|---|---|---|---|
| Counsellor intake and first assignment | Counsellor dashboard, paginated/searchable intake and advisor directories, create/edit intake, parent links, first handover; expected versions and idempotency | `role-interactions`, `counsellor-dashboard`, error-state and responsive tests | Create a designated test intake, link test Parent, assign Advisor, confirm Counsellor access closes |
| Advisor | Assigned-student directory, profile/plan/history/tasks, course options/linking, one-on-one creation and launch, reports/hours/conversations | Advisor course management/release, version-history, interaction and role-boundary tests | Complete handover-to-plan-to-course using the same real student record |
| Mock Exam admin and advisor | Tenant template/version/media/section creation and publish preflight; published-version assignment; no new section-update API | Authoring/import/retry, media/three-section preflight, assignment interaction tests; latest PR #34 retained | Known-successful Reading/Listening answer payload, real saved sections, publish and assignment |
| Instructor / combined instructor-advisor | Real course editor, sessions, dated occurrences, materials, attendance, grading queue, assignment/quiz/writing grades, report draft/publish, availability | Instructor workspace, roster, grading, material-reader, concurrency and course-management tests | Real create/schedule, attendance, grade/release and publish report; previously reported grading-queue 500 needs recheck with Instructor session |
| Student | Own courses, materials, assignment submission/result, study plan/tasks, attendance/progress/hours, schedule requests, published reports, assigned exams | **Live:** signed in, course and material entry, submitted assignment and released score/feedback, plan, learning overview, dated schedule and request form, profile. **Fixtures:** submissions/exam answer navigation, error/retry, new report filters/details | No real assigned exam or published report was available; no new submission, exam attempt or schedule-change write performed |
| Parent | Linked-student scope, reports, notification pages, conversation cursor/attachments, calendar, absence requests and exam reads | Parent pagination/navigation, client-delivery, role-contract and latest-contract tests | Sign in as linked Parent and observe the same new released results/reports |
| Tenant Admin / System Admin | Tenant governance, managed-user contract, intake administration, alert rules, read-only system exam surfaces and role separation | Tenant-admin and client-delivery browser tests; no tenant generic-course requests | Real admin writes/negative authorization not repeated in this audit |
| Shared shell and ancillary features | Login, navigation, calendar permissions, vocabulary, rich text, protected material links, error states, responsive fonts/icons | Full regression suite; nine role/surface variants at 320–2560 px; Student dashboard up to 3840 px | Browser fixture coverage does not establish real backend permissions or every device/browser |

## API coverage and honest data

The refreshed AST inventory has **432 contract entries** (some duplicated between snapshots), 374 direct method/path matches and 371 with direct non-API consumers. These are source counts, not live-tested endpoint counts. The remaining paths include dynamic section/scope wrappers and binary helpers; they must not be mislabeled as 58 missing features.

Manual follow-up covers conversation and attachment helpers, protected course downloads, managed-user scope selection, and Student/Tenant/System Mock Exam section/media wrappers. Four collection/batch alternatives remain intentional: session detail from its list, question detail from its list, course-week detail from its list, and batch enrollment instead of single enrollment. Nine explicitly disabled operations and the diagnostic `/v1` operation are not product features. Token refresh belongs to shared transport rather than a screen. The newly identified usable read gap, `meListPublishedStudentReports`, is now wired.

No production mock API bootstrap was found in the application entry graph. Fixture/mock-server scripts support tests. The reachable legacy prototype routes identified above have been removed. Empty, unavailable, not configured and unpublished states remain distinguishable; values such as scores, student identity and report content come from responses, not invented fallbacks.

The new global report list uses **page 0**; the existing course-specific report list continues using its contract's **page 1**. Filters reset pagination. Detail reads retain the report's own course identity, not the currently selected enrollment. Shared auth and backend authorization remain authoritative.

## UI and live inspection limits

Desktop screenshots were reviewed for Student, Instructor, Advisor, Counsellor, Parent and administrator surfaces. Font/image assets were checked against deployed content; the live Student page reported no broken image elements. Responsive fixture tests cover overflow, title sizing and navigation placement. The new mobile report layout received visual inspection in addition to geometry checks.

The real Student material Preview opened a protected blob tab. The browser security layer blocked inspection of that tab, so this audit does not certify that real PDF's rendering. Material-reader fixtures verify the supported reader workflow separately. Browser-extension messages and pre-login API errors were not counted as new application failures without attribution.

## External handoff

1. Supply a redacted successful Reading and Listening creation body, correct-answer location/types/enums, scoring rules, and confirmation that student projections exclude keys. Existing Reading POST: `/v2/tenant/mock-exam-templates/{templateId}/versions/{versionId}/reading`.
2. The concurrently merged [Instructor handoff](instructor-grading-calendar-handoff-2026-09-03.md) records fresh real `grading-items?page=0&size=100` HTTP 500 and `personal-events?fromUtc=…&toUtc=…` HTTP 403. Both request shapes conform to the current contract. Confirm the intended personal-event permissions and repair the grading read externally; repeat the affected Instructor flows. This audit itself had only a saved Student session.
3. Complete one real designated test lifecycle across Counsellor, Advisor, Instructor, Student and Parent, including persist/reload and unauthorized-role checks, before labeling the system fully accepted for operational use.

No backend, database, API proxy values, demo credentials, USC 8084 or production environment was changed.

## Final pre-merge validation

On the branch rebased onto `f24b1680`: `npm run lint:ci`, `npm run typecheck`, `npm run typecheck:production`, `npm run test:run -- --maxWorkers=4`, `npm run build`, `CI=1 PLAYWRIGHT_PORT=4475 npm run test:e2e -- --workers=2 --retries=0`, and `npm run build:dev` all passed. Results: **147 unit test files / 685 tests; 224 Chromium E2E tests, zero retries**. Independent Bugbot source review found no confirmed new regression. React review checked shared query reuse, conditional fetching, component state and existing abstractions. No dependency or lockfile changes.

After incorporating PR #35 (`4d55252`), the complete lint/typecheck/unit/production-build/E2E baseline passed again: **685 unit tests and 235 E2E tests, zero retries**. Final deployment and artifact checks are tracked in the release evidence supplied with this audit.
