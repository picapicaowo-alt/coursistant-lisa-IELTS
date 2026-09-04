# Advisor / Tenant intake record release review

## Scope and source

The approved Advisor record workspace refinement is combined with the follow-up Tenant intake rectangle layout. Release target: **IELTS frontend Dev 8085 only**. The candidate is isolated from the dirty active checkout, based on `origin/main` at `7f8291cfbe8522030182f869bd42d48292a084df`; unrelated uncommitted work is excluded.

The Tenant content area uses two equal-width columns with a shared top and bottom boundary. Account and Intake remain grouped on the left; Parent access and Assignment remain on the right. Cards grow naturally rather than using fixed heights. The parent form uses container-width-based columns; mobile DOM and focus order retain email, first, middle, last and relationship note. Section icons and status colors use existing shared tokens.

## Functional and contract review

- Reviewed role entry routes, account and intake queries, same-student filtering, multiple-intake selection, parent relationships, assignment/reassignment/cancellation, profile and plan save, course hours, reports, conversation attachments and task feedback.
- A TypeScript-AST audit mapped **37 direct HTTP calls** across **39 invoked service methods** to the checked-in OpenAPI with no missing operation. The delegated conversation-list and attachment-preview paths were manually verified; attachment download also uses the existing authenticated Blob helper. No API service, auth, proxy or environment contract was changed.
- Explicit tenant/Advisor service boundaries remain intact. A Tenant response for another student is not rendered. Multiple intakes require a selection before showing assignment actions. Advisor parent links remain read-only.
- Assignment edits preserve the reviewed intake/assignment version, including zero. Conflicts block resubmission until an explicit reload; selected advisor and reason are retained. Parent unlink requires confirmation and cannot run concurrently with parent creation.
- Support course changes clear course-dependent drafts and old success state. Successful task feedback advances to the returned task version so a second save is valid. Explicit reload callbacks cannot apply a version to a different selected course/task.
- Report links use returned course/report IDs. No sample scores, dates, avatars, trend arrows or relationships are synthesized.
- Added production-line/new-module scan found no new hardcoded host, credential, token, `as any`, `@ts-nocheck` or `console.log`. Reusable route and design values use existing configuration/tokens. Package files, lockfiles and tracked environment values are unchanged.

## Local validation

| Gate | Result |
| --- | --- |
| Clean-worktree `npm ci` | Passed |
| Lint; normal and production TypeScript | Passed |
| Unit tests | 139 files / 594 tests passed |
| Production and development-mode builds | Passed |
| Full isolated browser suite | 164 passed, retries disabled |
| Layout detector and whitespace check | No findings |

Browser tests verify the rectangular boundary at 1448, 1280, 1024 and 768px; mobile stacking at 390px; Advisor paired cards and all six navigation links; parent creation; assignment conflict/reload/retry; profile expected version; multipart messages; report details; course-specific hours including version zero; and consecutive task-feedback saves. Existing progress-bar geometry coverage now opens the intentional mobile Learning overview before measuring it. All other existing role/course/exam suites run unchanged.

The first full browser run exposed two test interactions that needed updating: opening the new mobile summary and using the textbox's accessible name after feedback success. These were corrected, retaining the behavior assertions; the final full run is green. Browser smoke confirmed the rendered login controls and no framework error overlay.

## Latest-main integration

The candidate incorporates `origin/main` at `d61f5d1e7020b7f97d2ea4285d692b09d0454e21` (shared course cards), preserving the newer Dev release. The integrated tree passed lint, both TypeScript checks, **140 unit-test files / 604 tests**, production and Dev builds, and **176 browser tests with retries disabled**. A higher-concurrency run hit the cumulative 30-second limit in the existing 18-screen Tenant visual test (175 passed); that group passed alone and the final complete suite passed with two workers, with no production change or weakened assertion.

## Remaining boundaries and inherited risk

- `npm ci` reports **five inherited moderate dependency advisories**. A fresh bounded `npm audit` retry timed out at the registry audit service. No dependency fix/upgrade or lockfile change is included. This is not a vulnerability-free claim; the existing dependency review is documented in `tenant-admin-predeploy-review-2026-09-03.md`.
- Screenshots use contract-shaped fixtures and are not live business acceptance. An existing authenticated Tenant Admin browser session is available for post-deploy read-only acceptance. Real message sends, parent-access mutations, assignments and financial/course-hour changes are not performed on live records as test fixtures.
- Push/merge must target `picapicaowo-alt/coursistant-lisa-IELTS` explicitly; the CLI can otherwise infer the historical university upstream. Publish only from the clean merged commit, verify the complete artifact manifest, retain `previous`, and verify public routes/assets plus the API authorization boundary. Prod and USC 8084 are out of scope.
