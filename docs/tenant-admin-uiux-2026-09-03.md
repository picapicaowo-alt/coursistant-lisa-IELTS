# Tenant Admin UI/UX — 2026-09-03

## Scope and visual authority

The ten user-supplied Tenant Admin frames govern the composition and finish. This is an extension of the existing frontend design system, not a new visual direction. The user approved implementation using consumed API capabilities only. No backend, infrastructure, environment value, production record, deployment, Git commit, or merge is part of this delivery.

The application keeps the existing X-Learn brand assets and semantic SCSS tokens. Tenant-only shell styling adds a wider white navigation rail, an Administration header, cool-gray work surfaces, consistent white outlined cards, violet actions, and semantic state badges. No invented photographs, statistics, recent-login dates, or portal version are rendered.

## Delivered modules

| Module | UI and behavior | Contract boundary |
| --- | --- | --- |
| Dashboard | Four summary cards, recent governance activity, four quick actions, assigned/unassigned intake distribution | Counts use returned totals; active student **accounts**, not learning activity; published **templates**, not versions. Missing or partial counts display unavailable. |
| People | Wide directory, combined search/filters, server pagination, contextual create/manage drawers | `/v2/tenant/users` uses `q`, `role`, `level`, `status`, `page`, `size`. Existing managed-account updates, role changes, disable blockers and enable/disable are retained. Students enter their restricted governance record. |
| Course ownership | Course scan table, course search, active-owner picker, review/confirm transfer drawer | Tenant course ownership routes only. Transfer retains `expectedOwnershipVersion` and reason. No department, enrolled-student total, teaching management or inferred update timestamp. |
| Alert rules | Three policy modes and eight expandable configuration groups | Existing `/v2/tenant/alert-rules` GET/PUT and optimistic version. No arbitrary rule creation, notification recipients, last-trigger claims or individual student risk access. |
| Audit | Timestamp, resolved actor/target, readable action and before/after details; server filtering/pagination | Existing `actorUserId`, `targetUserId`, `action`, `resourceType`, `from`, `to`, `page`, `size`. Picker can include disabled/admin accounts. No unsupported free-text audit search. |
| Intakes | Aligned record table, create dialog, focused management drawer, existing assignment/correction/cancel flows | Name/email uses `q`; intake/student ID searches use their distinct numeric parameters. CAS/idempotency are retained. Reassignment cannot invent a missing assignment version. Cancellation asks for confirmation. |
| Mock templates | Two-column card library, immediate new-draft navigation, version selector and 8+4 version workspace | Existing template/version create, copy, publish, archive and draft-delete routes. Publish preserves three-section retrieval preflight. |
| Exam composer | Listening/Reading/Writing tabs; multiple Part/Passage/Task drafts; content, question payload and media controls | One POST creates the **entire section**. Saved sections remain read-only. All units are validated and explicitly reviewed before submission. No saved-section update API or Speaking authoring is invented. |

## Maintainability and interaction rules

- `lms/src/configs/tenantNavigation.ts` centralizes tenant navigation and page sizing.
- `lms/src/components/TenantWorkspace/` contains the shared presentation styles, accessible drawer, person cell, formatting and tenant-safe name resolution.
- Tenant mock-exam code now lives in `lms/src/pages/MockExamsPage/tenant/`; other staff role workflows retain their existing implementation.
- Native dialog drawers restore trigger focus and retain the surrounding list context. Existing nested person selectors remain keyboard operable.
- At phone widths, governance tabs reflow and table rows become labeled records; long content remains scrollable inside the app shell. No document-level horizontal overflow is accepted.
- Mobile governance shortcuts stay compact; People and Audit secondary filters open through an explicit accessible disclosure while remaining inline on desktop. Audit actor selection applies immediately. Date-time filters reserve calendar-button space and occupy a full row on phones.
- Collapsed policy cards show returned thresholds and individual check states. Edits show a per-group unsaved marker. System values that the response does not provide remain explicitly unavailable; an unsaved switch to system mode never relabels old custom values as platform defaults.
- Unsaved exam content is kept in `sessionStorage`, keyed by account, template and version, and validated before restoration. It is a tab-local draft, not a server save; storage failure is disclosed. It contains no credentials. Saved sections are cleared from the local draft after refresh.
- Media uploads send media IDs, not storage paths. File constraints remain those already consumed by this frontend. Protected media is fetched with the existing authenticated service; bound media cannot be deleted by the composer.
- The supplied OpenAPI leaves question `kind`/`payload` generic. The UI retains explicit contract JSON entry instead of claiming a complete visual question-type editor.

## Verification boundary

Automated tests use isolated synthetic identities and request fixtures. They prove frontend composition, route guards, request construction, draft transitions and response handling—not authenticated backend authorization, real tenant isolation, real upload storage, or production acceptance.

Builds and checks were run against this working checkout without discarding unrelated pre-existing work. Test-route assertions were updated for the approved `/admin/dashboard` home and current accessible controls; authorization checks and three-section publish preflight were retained.

Visual evidence: `lms/.impeccable/review/tenant-admin/` contains the nine primary surfaces at 1714×1216 and 390×844, plus explicitly named scrolled detail captures. The screenshots contain synthetic test data, never shipped application fixtures. A separate login smoke capture verifies the unauthenticated local preview.

## Final automated checks

All completed against the final frontend implementation:

- `npm run lint:ci` — passed.
- `npm run typecheck` and `npm run typecheck:production` — passed.
- `npm run test:run` — 136 files / 566 tests passed.
- `npm run build` — passed, 2,973 transformed modules.
- Canonical Playwright suite: `PLAYWRIGHT_PORT=4197 npx playwright test $(rg --files e2e | rg '\.spec\.ts$') --workers=4` — 122 tests passed. This selects canonical `.spec.ts` files, not unrelated duplicate `*.spec 2.ts` files already present in the working directory.
- `git diff --check` — passed.
- One design-detector pass on changed UI targets — no findings. The detector was not rerun during the independent-review correction batch.

The tenant-specific browser tests cover all nine surfaces at both viewport sizes, mobile first-record visibility, populated date-time text fit, correct intake-ID query construction, drawer focus restoration, all-parts section submission, tab-draft restoration and read-only saved content. Additional captures show expanded audit filters at both sizes and an unsaved alert-policy edit. No external write or live tenant acceptance is implied by these results.

## Independent visual review

Final disposition: **ship**, limited to the original three-item correction list. All three were scored resolved: mobile governance exposes usable records earlier; populated audit date-times remain fully readable; collapsed alert cards expose configured values and distinguish unsaved edits. The final mobile People capture includes the first person's name, email, identity and status above the bottom navigation. Desktop inline controls were preserved.

The review used valid desktop/mobile captures and targeted source inspection. This verdict is not a fresh whole-surface audit or authenticated workflow acceptance. The route-scoped design record is `lms/src/pages/TenantAdminPage/DESIGN.md`, with its companion sidecar; it does not replace the existing project design system.
