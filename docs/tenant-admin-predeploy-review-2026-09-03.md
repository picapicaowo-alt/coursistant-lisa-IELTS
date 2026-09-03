# Tenant Admin pre-deployment review — 2026-09-03

## Authorized frontend remediation — final local verification

The user authorized fixing frontend defects and hiding features without consumed API support. All three findings below are now resolved and independently re-reviewed by Bugbot and Security Review with no new actionable findings.

- Uploads capture the originating selection callback and target stable browser-only unit/question identities. Functional updates preserve intervening edits and tolerate removal/reordering. Local identities are omitted from API payloads; legacy tab drafts restore without losing content.
- Successful media deletion clears references across the current version's Listening, Reading and Writing drafts, including questions, and removes the cached media row. Shared version-scoped write guards prevent media operations from racing section creation or lifecycle writes.
- Intake errors render inside the active management drawer, reset between records/actions, and preserve form entries. Existing request paths, partial updates, idempotency and expected-version fields remain unchanged.
- Unsupported Speaking authoring, saved-question editing, arbitrary alert creation/recipients, last-login data and invented department/enrollment fields remain absent. Supported controls are retained; no backend feature was fabricated and no backend change was made.
- No SCSS/layout change was required. Existing desktop/mobile composition and responsive tests remain intact.

Final checks against the latest-main integration: lint, both typechecks, **137 files / 576 unit tests**, Production and Dev builds, **132 browser tests**, and diff whitespace checks passed. New regressions exercise delayed upload with intervening edits/navigation, question-group removal during upload, deletion across unsaved units in all three sections with reload, in-drawer failed PATCH feedback/reset and its exact API payload, and legacy draft restoration.

The release candidate is locally validated; GitHub CI, merge, deployment and authenticated Tenant acceptance remain separate gates. Subsequent release evidence must identify the merged SHA and exact deployed artifact. The initial review below is retained as an audit trail, not an outstanding defect list.

## Initial review decision (before remediation)

**Initial HOLD — not pushed, merged, or deployed at that stage.** Bugbot confirmed three P2 functional defects in the new Tenant flows. The independent security review found no actionable security issue introduced by this diff. The user subsequently authorized the remediation recorded above.

This review is distinct from the earlier implementation/visual handoff in `tenant-admin-uiux-2026-09-03.md`. Passing automated checks does not invalidate the defects below; the existing suite does not cover these race/error cases.

## Review target and isolation

- Repository: `picapicaowo-alt/coursistant-lisa-IELTS`; frontend application only.
- Release branch: `codex/tenant-admin-release`, based on fetched `origin/main` at `6ec8404cef12d4bf44d6ca8adec50bd18a1499b9`.
- Isolated working tree: `/private/tmp/coursistant-tenant-release.wJoI93`.
- Tenant changes were transferred without modifying the original dirty checkout or importing unrelated role changes/duplicate-number files.
- One existing Tenant-home test update was initially omitted from the transfer. After transferring it, the full unit suite passed. No production fix was made during this review.
- No dependency, environment, proxy, credential, backend, or database changes.

## Bugbot findings

| Severity | Location (file:line) | Finding |
| --- | --- | --- |
| P2 | `lms/src/pages/MockExamsPage/tenant/TenantMediaManager.tsx:92` | Upload completion can select media in the wrong Part/Task. Start on Part 1, switch to Part 2 while pending: the reused manager receives the new callback and selects the uploaded ID in Part 2. A read-only reproduction with the installed Query-core produced selection IDs `[null, 11]`. Capture stable unit identity and use a functional draft update. |
| P2 | `lms/src/pages/MockExamsPage/tenant/TenantMediaManager.tsx:116` | Deleting media clears only the current selection. Other unsaved parts/questions can retain the deleted media ID in tab storage and submit a dangling reference. Clear all affected draft references or prevent deletion while referenced locally. |
| P2 | `lms/src/pages/TenantIntakesPage/index.tsx:383` | General assign/reassign/cancel/profile-save errors render outside the native modal, behind its inert background. Only the intake-version conflict has an in-drawer message. Put operation errors inside the drawer and reset stale errors when changing records. |

The upload finding has a Query-core reproduction; the other two are source/contract findings. These are not authenticated backend reproductions. Recommended regression cases: delayed upload plus navigation/editing; media referenced from another local part/question; failed management writes visible inside the active dialog and cleared on record change.

## API and workflow contract audit

Existing services retain request ownership; UI does not call invented endpoints.

| Module | Consumed contract | Verified frontend behavior and remaining boundary |
| --- | --- | --- |
| Dashboard | Tenant users, student intakes, audit events, mock templates | Uses response totals/data; unavailable or incomplete metrics are not fabricated. Active accounts are not presented as learning activity. Pipeline subdivisions do not double-count open intakes. |
| People | `docs/api/auth.openapi.yaml`: `/v2/tenant/users`, `/managed-users` and user/role/enable/disable subroutes | Server search/filter/page parameters; tenant-scoped name lookup; structured name fields; CAS/idempotency and disable-blocker behavior retained. |
| Course ownership | `docs/api/course.openapi.yaml`: `/v2/tenant/course-ownerships`, `/courses/{courseId}/owner` | Search and active advisor picker; owner transfer includes `expectedOwnershipVersion` and reason. No department/enrollment fields invented. |
| Alert policy | `docs/api/course.openapi.yaml`: `/v2/tenant/alert-rules` GET/PUT | Existing policy modes, thresholds and expected version only. No arbitrary rule creation, custom recipients or fabricated last-trigger timestamps. |
| Audit | `docs/api/auth.openapi.yaml`: `/v2/tenant/audit-events` | Actor/target/action/resource/date/page filters. Audit account lookup may include disabled/admin users; advisor-selection defaults remain restricted. |
| Intakes | `docs/api/advising.openapi.yaml`: `/v2/tenant/student-intakes`, detail, advisor, cancellation and student advisor routes | Distinct `q`, `intakeId`, `studentUserId`; existing write/version/idempotency constraints. Missing assignment versions are not invented. **In-drawer error feedback needs correction.** |
| Mock templates/versions | `docs/api/mockexam.openapi.yaml`: tenant template, version, copy, publish, archive and draft-delete routes | Existing lifecycle operations, destructive confirmations and three-section publish preflight retained. |
| Exam sections/media | Same mock contract: listening/reading/writing GET/POST; media upload/preview/delete | One POST creates the entire section; saved sections stay read-only. Generic question kind/payload remains explicit. No Speaking authoring or saved-section editing endpoint invented. **Local media ownership/references need correction.** |

Source/contract checks confirm frontend construction and known boundaries, not that every live backend response/write succeeds. No API-owner contract changes were made.

## Hardcoding and security

No new deployment URLs, credentials, fixture identities, hardcoded business statistics, production logs, unsafe casts, or direct brand-color hex values were found in the scoped Tenant production modules. Shared route configuration and semantic SCSS tokens are reused. Domain statuses and field names are contract values; legitimate local constants are not evidence of unsafe hardcoding.

Security review checked role gates; tenant-only service routing; query-cache clearing on authentication transitions; account/template/version-keyed drafts; safe React text rendering; authenticated Blob previews; CAS/idempotency; and retained destructive confirmations. Its 5 focused test files / 15 tests passed. It did not perform authenticated cross-tenant authorization tests.

Dependency audit is **not clean**: npm reports five inherited moderate entries (`@humanfs/node`, `@tiptap/core`, `@xmldom/xmldom`, `fflate`, `speech-rule-engine`), with unchanged package and lock files. No introduced Tenant path into those vulnerable operations was found. The [Tiptap maintainer advisory](https://github.com/ueberdosis/tiptap/security/advisories/GHSA-cp6q-959q-f8rh) labels its issue High, although npm's audit labels it moderate. Dependency remediation requires a separate scoped assessment; this review is not proof that the whole application/dependency graph is vulnerability-free. No broad audit-fix or upgrade was run.

## Validation against latest main integration

| Check | Result |
| --- | --- |
| `npm ci` | Passed; dependency/lock files unchanged |
| `npm run lint:ci` | Passed |
| `npm run typecheck` | Passed |
| `npm run typecheck:production` | Passed |
| `npm run test:run` | 137 files / 573 tests passed |
| `npm run build` | Passed |
| `npm run build:dev` | Passed |
| `CI=1 PLAYWRIGHT_PORT=4213 npm run test:e2e -- --workers=4` | 126 passed, 21.9 seconds |
| `git diff --check` | Passed |

The browser suite ran against this worktree's built artifact on an isolated port, not a stale Vite server. It covers all nine Tenant surfaces at 1714×1216 and 390×844, mobile record visibility, populated audit date-time fit, correct intake ID filtering, drawer focus restoration, multi-part submission, draft restoration, and saved read-only content. Governance also has geometry checks at 320, 390, 768, 1024, 1440, 1920 and 2560 pixels.

Fresh screenshot spot checks examined the desktop Dashboard and mobile People, audit filters and composer details. No new alignment/overflow defect was identified in these captures. This is not a claim that every possible browser, viewport or content length was exercised.

A separate unauthenticated local login smoke check rendered the login controls with no page errors. Its first attempt occurred after the test-managed preview had already shut down; starting a dedicated isolated preview resolved the connection refusal without code changes.

Visual evidence is local to the release worktree at `lms/.impeccable/review/tenant-admin/`. Tenant screenshots use synthetic request fixtures, not shipped demo data or live business acceptance.

## Live and deployment boundary

Read-only inspection confirmed Dev 8085 still serves `6ec8404cef12d4bf44d6ca8adec50bd18a1499b9`, with frontend PM2 online and the previous static release retained. No release symlink, process, proxy or remote asset was changed.

The available browser session was Instructor, not Tenant Admin. A Tenant Admin login was requested from the user without asking for passwords. Authenticated Tenant read/write, real upload storage, backend tenant isolation and authorization acceptance remain unverified.

At the initial review stage, no commit, push, PR creation, merge, or deployment had occurred. The functional findings and regression gate are now resolved as recorded above. Intended environment remains **Dev 8085 only**, never USC 8084 or Production.
