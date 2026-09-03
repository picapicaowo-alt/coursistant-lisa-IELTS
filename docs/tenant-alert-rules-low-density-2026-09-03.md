# Tenant Alert Rules — low-density refinement

## Scope and visual authority

The user's September 3 follow-up replaces the previous accordion composition.
Keep the existing X-Learn shell and semantic tokens. Favor generous spacing,
normal readable type, a single list, and focused editing. No other page is redesigned.

## Interaction and API boundary

- Three modes retain the existing `SYSTEM_DEFAULT`, `TENANT_OVERRIDE`, and `DISABLED` contract.
- Eight categories share one outlined list. The first five edit numeric parameters in a native dialog drawer; only overdue tasks, incomplete checkpoints, and negative hours have switches.
- The drawer applies to the local policy draft. Page-level Save changes sends one complete tenant-override request, or mode plus version for the other modes, through existing GET/PUT `/v2/tenant/alert-rules`.
- Edits pin the baseline `expectedVersion`; background cache updates do not discard/rebase them. Saving disables duplicate writes, load failures offer retry, and failed saves retain the draft. Cancelling an unchanged editor releases its snapshot; an explicit Refresh also clears a clean snapshot (including values reverted to baseline), so newer server values and versions become visible. Genuinely dirty drafts remain pinned until saved or discarded.
- Nullable values are not invented defaults. The optional numeric values retain the existing number/null serialization, and switch edits retain existing 1/null behavior. Untouched returned flags are preserved.
- No independent switches are invented for threshold-only categories. No arbitrary rule creation, recipient configuration, last-trigger date, or separate system-default comparison column is added.
- System/disabled modes do not render disabled forms. One shared explanation replaces repeated unavailable warnings. A pending change to system mode never relabels the earlier custom parameters as default values.
- Desktop uses aligned category, summary, and control columns. At smaller widths, summaries wrap below their category; phone mode choices retain three readable options and switches move to their own line. The page footer keeps save/cancel accessible while scrolling.

## Verification boundary

Unit and browser tests use isolated fixtures. Preview screenshots show the actual compiled frontend with synthetic policy data, not authenticated live Tenant Admin acceptance. No backend, environment, proxy, deployment, or production data changes are included.

Validated on the isolated `codex/alert-rules-low-density` worktree based on merged main `9d308d4`:

- Full ESLint, both TypeScript checks, and production build passed; dependency lockfiles unchanged.
- Targeted panel/API unit tests: 12 passed. Tenant UI/browser regression tests: 14 passed.
- Responsive list/editor checks: 1856, 1440, 1024, 768, 390, and 320px. Phone first-rule visibility, row overflow, drawer Escape/focus restoration, and page errors checked.
- Save/reload, local apply/cancel, supported switch payloads, missing system values, version conflicts, pending-write guards, and error recovery covered with synthetic API responses.
- Two batched visual passes completed; the first exposed phone row placement, which was corrected before the confirming pass. No public release was performed.

## Pre-merge release review

- Bugbot and Security Review independently identified the same clean-snapshot refresh defect. It is fixed, with regressions for cancelling the drawer and reverting values before refresh; each subsequent save uses the new server version.
- No additional high-confidence functional or exploitable security finding was reported. Existing tenant-only service routing and optimistic concurrency remain intact.
- Final local baseline: lint, both type checks, 138 unit-test files / 585 tests, production build, Dev build, and 142 Playwright tests passed.
- The full governance journey test now follows Edit → Apply to draft → Save changes, retaining its payload and tenant-route assertions.
- No environment, proxy, dependency, or lockfile changes. Production code uses existing semantic tokens and request services; no fixture identity, deployment URL, invented default, or unsupported field was introduced.
- These are source, fixture, and visual checks. Authenticated live Tenant Admin read/write acceptance requires a suitable session and is not implied by the release.
