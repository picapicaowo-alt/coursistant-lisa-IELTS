# Advisor and Tenant record workspace polish — 2026-09-03

## Scope and visual authority

Implemented the approved screenshot-led refinement of the Advisor student workspace and Tenant Admin student intake record. The supplied images guide composition, spacing, typography and visual hierarchy; they do not define API behavior or authorize fabricated data.

This is frontend-only work. No backend, infrastructure, tracked environment values, credentials, merge or deployment are included. The working tree already contains parallel frontend changes; this document describes only this task's additions.

## Delivered composition

| Surface | Delivered refinement |
| --- | --- |
| Advisor student header | Clear identity row above actual assessment, target, task completion and skill data. Smaller-screen learning details are expandable so all six navigation entries appear early. |
| Six section links | Learning Plan, Courses, Exams, Support & reports, Profile and Intake have equal visual priority. Desktop text is 18px; narrow layouts retain at least 16px and reflow without horizontal overflow. |
| Profile | Student context and Primary target share two equal-width grid columns and stretch to the same height, with aligned top and bottom edges. Measured skills and private advisor notes form the next paired row. On phones the cards stack naturally. |
| Support & reports | Full-width conversation rows and a clear attachment/send composer; reports and learning history sit side by side. Returned course reports open a detail drawer. Course hours show actual values and reviewed versions. |
| Advisor Intake | Read-only counsellor handover table beside an expanded, read-only parent/guardian relationship panel. |
| Tenant student record | Account and counsellor intake on the left; expanded parent/guardian management and assignment on the right. Assignment edits open a focused drawer. Back to intakes preserves the originating list filters and page. |

No numeric baseline is inferred from assessment prose. No score trend arrows, member-since date, avatar photo or guardian relationship is invented to fill the reference layout. Existing Courses, Exams and Learning Plan workflows are retained.

## Maintenance and behavior boundaries

- `WorkspaceSection` gains opt-in `appearance="record"`; its existing default appearance is unchanged. Equal card height uses grid stretching, not a fixed pixel height.
- `ParentLinksPanel` gains opt-in `presentation="panel"`. The existing disclosure remains the default. Advisor access is still read-only; Tenant and Counsellor permissions use their existing services. Unlink requires confirmation.
- `IntakeAssignmentEditor` is shared by the Tenant list management drawer and the student record. It preserves reviewed versions, version zero, idempotency, pending-state protection and explicit conflict reload. Reload preserves the selected advisor and reason; it does not automatically resubmit.
- Tenant record reads use the existing user directory and `GET /v2/tenant/student-intakes?studentUserId=...&page=...&size=20`. Returned items are additionally matched to the current student. Multiple intakes require an explicit selection; no first-item assignment is inferred.
- Parent names continue to use explicit first, optional middle and last fields. No whitespace-based name parsing was introduced.
- Report detail links use returned course/report IDs and the existing Advisor course report endpoint. Records without usable IDs retain a readable summary instead of an invented link.
- Course changes clear dependent hour drafts, reviewed versions and record lookups. An initial supported course/report deep link is preserved. The course selector is disabled during an hours save.
- Task feedback selects real Learning Plan tasks and their returned versions. Historical Profile snapshots and unsupported exam scheduling fields remain unavailable.

## Verification

The isolated production preview used port `4216`. Browser tests use synthetic, contract-shaped fixtures, not live accounts.

- `typecheck`, `typecheck:production`, `lint:ci`, production `build`, and `git diff --check` passed.
- Full unit run: **141 files / 609 tests passed**. Two subsequent Tenant record cases were added; the focused Tenant record and Parent links run passed **7 tests**, including cross-student filtering, explicit multi-intake selection, retained return URL, and cancelled/confirmed unlink.
- Batched browser regression: **37 of 38 passed initially**. The remaining test asserted superseded exam-modal explanatory copy. Its assertion now checks the actual supported sections and absence of unsupported Speaking/date/time controls; the exact assignment payload and idempotency assertions are retained. The affected exam test passed on rerun.
- New record-workspace browser coverage verifies equal Profile card width/top/bottom at 1588, 1280 and 1024px; intentional stacking at 390px; all six section links; no document/navigation overflow; Profile versioned save; multipart attachment send; Tenant parent creation; assignment conflict/reload/retry; report detail IDs; course-specific hours versions including zero; and task-feedback version.
- All **4 new record-workspace scenarios passed** across the visual batch and final focused action runs. The support test's course picker uses its accessible combobox name rather than matching the containing label text.
- Mechanical design detector: no findings for the scoped UI targets. Two bounded visual inspection rounds covered desktop and phone layouts. The correction round shortened mobile summaries and tightened the Tenant parent form.

Screenshots in `lms/.impeccable/review/record-workspaces/` are **sample-data visual evidence**, not authenticated acceptance. In particular, `profile-cards-1588.png` shows the paired card bottom alignment, `profile-390.png` shows the visible six-link mobile navigation, and `tenant-record-1410.png` shows the Tenant composition.

Authenticated backend acceptance, a clean-worktree full merge baseline and Dev/Prod deployment remain separate deliverables.
