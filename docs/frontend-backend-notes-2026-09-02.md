# Frontend to backend notes — 2026-09-02

These items are intentionally not simulated in the browser application. They require an explicit backend contract before the frontend can offer the workflow safely.

## 1. Counsellor assigned-intake drill-down

The Counsellor dashboard exposes `assignedCount`, but the current authorization model immediately removes an intake from Counsellor access after the first Advisor assignment. The current contract does not provide a safe Counsellor-facing projection for the records included in that count.

If the product should let a Counsellor click `Assigned` and see which students were handed over, please add a read-only, tenant-scoped endpoint that returns a deliberately limited projection (for example intake ID, student display identity, assigned Advisor, and handover timestamp). The endpoint must not reopen the intake detail, Parent links, or post-handover edit/delete permissions.

## 2. Configurable Student Intake requirements

The current create contract fixes the required fields as `firstName`, `lastName`, `email`, `studentType`, and `courseRequest`. Counsellors and Tenant Admins do not currently have a contract for changing these rules.

If requirements should be tenant-configurable, the backend needs a versioned tenant setting with read/update operations plus a validation projection that the create form can consume. The create endpoint must remain the final authority and return field-level validation errors. Until then, the frontend marks only the contract-required fields and does not invent Admin controls.

## 3. Mock Exam content editing

Mock Exam section content is create-only in the supplied handoff. There is no PUT/PATCH contract for editing Listening, Reading, or Writing content after a section has been saved. Copying a version therefore cannot honestly provide arbitrary per-question editing.

If draft editing is required, please add version-checked PUT/PATCH operations for each section and define which fields remain immutable after dependent media or assignments exist. The frontend currently supports opening a newly created draft, selecting versions, uploading/previewing/deleting media, filling missing sections, copying a version, and deleting a draft; saved sections remain locked.

## 4. Checked-in OpenAPI synchronization

The handoff describes the following newer APIs, but the checked-in frontend OpenAPI snapshots still need to be synchronized so generated/manual types can be verified against a repository-owned source of truth:

- `PATCH /v2/tenant/managed-users/{id}`
- `GET /v2/tenant/managed-users/{id}/disable-blockers`
- Tenant Intake detail/edit/assign/reassign/cancel operations
- Mock Exam version media upload/list/preview/delete operations
- media ID fields replacing storage paths in Mock Exam authoring requests

Please publish the exact request/response schemas, required `Idempotency-Key` operations, CAS conflict payloads, blocker item schema, and media list/upload response envelopes in the canonical YAML files under `docs/api/`.

## 5. Parent Link GET authorization handling

`GET /v2/counsellor/student-intakes/{intakeId}/parent-links` is treated as a protected read, not as an optional relationship lookup:

- `200 SUCCESS` renders the returned relationships. Only a successful response with `data: []` means that the Intake currently has no Parent link.
- `401 INVALID_TOKEN` enters the shared session-recovery flow. The browser attempts one refresh and replays the request; if recovery fails, it clears the local session and returns to `/login`.
- `403 FORBIDDEN` and `403 ACCESS_DENIED` render an explicit permission error. They must never be converted into `data: []` or the empty Parent-link state.
- After Advisor handover, Counselor access remains closed. A not-found response is not retried as if the Intake were still owned by the Counselor.

## 6. Current validation status matrix

| Scope | Status | Evidence | Acceptance boundary |
| --- | --- | --- | --- |
| Tenant Admin backend Local gate | Backend-reported pass | `35 PASS / 0 FAIL`; complete `mvn clean verify` reported as `BUILD SUCCESS` | Reported by the supplied Tenant Admin handoff; not independently rerun by this frontend-only task |
| Counselor Parent Link read | Backend-reported targeted pass | Controller/service, Parent OpenAPI, targeted tests, Local API smoke, and Course OpenAPI snapshot static Gate are `PASS` | The latest Counselor handoff explicitly marks full `mvn clean verify` as `FULL_VERIFY_DEFERRED`; `COUNSELLOR_PARENT_LINK_READ_GATE_PASS` has not been granted |
| Frontend lint and types | Pass | `npm run lint:ci`; `npm run typecheck`; `npm run typecheck:production` | Current local frontend worktree |
| Frontend unit/component tests | Pass | `npm run test:run`: 120 files, 498 tests | Mocked API behavior and component contracts |
| Frontend production build | Pass | `npm run build` | Compile and bundle only |
| Frontend browser E2E | Pass | `PLAYWRIGHT_PORT=4215 npm run test:e2e`: 22/22 passed without retries | Local role, responsive-shell, authoring, grading, Vocabulary, and cross-role workflow coverage with frontend fixtures/mocks |
| Instructor dashboard and availability regression | Pass locally and on Dev | Role E2E proves no Student-only dashboard requests; availability PUT preserves 2 weekly windows plus the existing date exception. Post-release Dev walkthrough showed 5 semantic availability windows with Edit/Remove actions, field-triggered date picker, and the Instructor teaching dashboard | Fixture-backed mutation coverage plus authenticated, read-only Dev acceptance on release `f12f985`; no live availability record was changed |
| Parent Link `401/403` frontend handling | Pass with stated test boundary | Error mapping tests, shared 401 recovery-decision tests, Counselor Parent-link 403 panel tests, and deployed tokenless GET returning `401 INVALID_TOKEN` | Dev `401` boundary is proven; refresh/session-expiry behavior is code-inspected, while a deployed authenticated `403 FORBIDDEN/ACCESS_DENIED` response still requires a valid non-Counselor role session |
| Dev authenticated Instructor walkthrough | Pass | Signed-in `USER / INSTRUCTOR` verified Dashboard, Teaching operations, Availability, field-triggered calendar, My Course, and course detail on release `f12f985`; browser console contained no errors | Read-only acceptance with the available Instructor session; destructive availability/course writes were intentionally not performed |
| Dev authenticated all-role integration | Partially verified | Instructor was exercised against the deployed bundle; cross-role workflows pass fixture E2E. Parent Link `200/403` and the remaining role accounts were not independently signed in during this task | Requires valid role-specific login access for live Tenant Admin, Counselor, Advisor, Student, and Parent acceptance |
| Prod deployment and protected-flow acceptance | Not performed | No Prod change or authenticated Prod test in this task | Requires separate release authorization and acceptance |

The Local Gate, frontend test suite, build, and local browser checks do not replace Dev or Prod authenticated acceptance. Dev now proves the tokenless Parent Link `401 INVALID_TOKEN` boundary and the authenticated Instructor read-only workflow. It still needs targeted Parent Link checks for a valid Counselor (`200`) and a signed-in user without permission (`403`). The backend's final Counselor Parent Link release gate also remains pending until its deferred complete Maven verification is rerun.

## 7. Advisor Profile history and Study Plan snapshot contract

User report: the Advisor can see `Version 2` on a student's Profile but cannot read earlier Profile versions.

Confirmed against the supplied Advisor Markdown and canonical `docs/api/advising.openapi.yaml`:

- Profile has POST / GET / PUT on `/v2/advisor/students/{studentUserId}/profile`. GET returns the current aggregate. `profileVersion` / `expectedProfileVersion` support optimistic concurrency; they do not provide historical reads.
- No Profile revision list, historical detail or restore operation is present in this handoff. Please deliver the Profile history read contract, pagination and immutable snapshot schema, with tenant/current-Advisor authorization and private-field boundaries. Historical storage/backfill and any restoration semantics require backend clarification. No speculative Profile endpoint is wired in the frontend.
- Study Plan already has `advisorListStudyPlanRevisions`. Its `StudyPlanRevisionResponse` includes optional `snapshot: object`. The previous frontend discarded this field and incorrectly claimed that all prior field values were unavailable. That frontend omission is corrected: returned snapshots now have a read-only viewer, with distinct loading, error/retry, empty-list and per-revision missing-snapshot states.
- The Study Plan snapshot is unstructured in the current schema. The viewer preserves the supplied nested keys and values without assuming it contains historical Profile data or replacing missing values with today's Profile/Plan. Please publish its concrete schema and state which historical revisions include content.

This diagnosis is based on the supplied contracts and current frontend code. Snapshot rendering is verified with browser fixtures, not a live protected history response. No backend changes, Profile history simulation, restore operation or deployment is included.

Follow-up frontend validation: lint, normal/production TypeScript, production build and `git diff --check` pass; 128 test files / 533 unit tests and 38 Chromium E2E tests pass. The new browser scenario verifies nested historical content, missing snapshots, version 0, server pagination and preservation of an unsaved current-plan draft, with no mutations or speculative Profile-history requests. Screenshots: [desktop](ui-review-2026-09-02/advisor-plan-history-desktop.png), [mobile](ui-review-2026-09-02/advisor-plan-history-mobile.png). Profile history remains an unresolved backend-contract dependency.
