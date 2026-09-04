# UI/UX consistency audit — 2026-09-04

The four reported issues are fixed in the local frontend. The review also covers shared typography, action spacing, people selection, keyboard focus, dialogs, responsive reflow and error feedback. Existing role permissions and API ownership remain at each consumer.

## Findings and implemented changes

- `lms/src/pages/advising/advising.module.scss:271` — Edit had a text-sized target next to Assign. Shared action rows now have 12px gaps; action links have a 44px target and horizontal padding.
- `lms/src/pages/advising/advising.module.scss:286` — Broad form label/input rules turned person rows into vertical grids and enlarged radio controls. Text-field rules now exclude radio/checkbox labels and inputs.
- `lms/src/pages/CounsellorAssignAdvisorPage/index.tsx:112` — The empty circle in the screenshot was a stretched radio, not a failed photo. The page now uses the shared person selection row: avatar/identity together, radio at the end, selected and focus states. Changing the search or page clears the previous selection so an invisible person cannot be assigned.
- `lms/src/components/PersonCell/index.tsx:16` — The Tenant person cell has been promoted to shared UI. Tenant tables keep a compatibility export; Counsellor directory, assignment rows, owner selection and search results share its identity presentation. Compact mode fits the bounded dashboard directory.
- `lms/src/components/AdvisorInstructorPicker/index.tsx:47` — Duplicate search plus native select replaced with one searchable combobox. Typing opens results; clearing, Arrow keys, Enter, Escape, blur dismissal, pagination, retry and persistent selected names are supported. Unselected search text cannot become a submitted instructor ID.
- `lms/src/pages/CourseOperationsPage/CourseStudentPicker.tsx:42` — The course student selector uses the same combobox, retaining its course membership filter and API.
- `lms/src/pages/CounsellorIntakeFormPage/index.tsx:153` — Save and next step share a right-aligned row. Save is secondary and stays on the form. The purple next step saves dirty values before navigating, or links directly when there are no changes. Successful saves update the reviewed version; failed saves preserve the draft.
- `lms/src/styles/_tokens.scss:135` — The smallest shared text token is now 12px. Explicit text sizes below 12px found in active SCSS modules were moved to the caption token, covering dashboards, notifications, course workspaces, grading, calendars, exams and vocabulary. Existing font family and main heading/body scale remain the Figma-based system.
- `lms/src/components/IconButton/index.tsx:46` — Shared icon actions now have explicit accessible names, type=button and decorative icon semantics; their targets are 44px and semantic colors replace local raw colors.
- `lms/src/layouts/Layout.tsx:34` — Added a keyboard skip link to the main scroll region.
- `lms/src/pages/RosterPage/MemberRow.tsx:67` and `lms/src/pages/AssignmentGradingPage/index.tsx:149` — TA permissions and grading now reuse TeachingDialog, including native modal background inertness, Escape, focus restoration, busy dismissal guards and bounded scrolling.
- `lms/src/components/TeachingWorkspace/index.module.scss:386` and `lms/src/components/TenantUserPicker/index.module.scss:88` — Dialog scrolling remains contained and short viewports can reach the footer. Compound search fields use one visible focus boundary.
- `lms/src/pages/settings/styles.module.scss:110` — Restored visible keyboard focus for tabs and fields whose local outline reset hid the global focus indicator.
- `lms/src/pages/MockExamsPage/tenant/TenantSectionComposer.tsx:624` — Server failure text now uses the existing advising error presentation helper. Contextual draft-preservation/retry copy is retained, while known permission and validation errors retain their specific explanations.

Active styles with `transition: all` now enumerate visual properties, preventing incidental layout dimensions from animating. The existing global reduced-motion override remains in force.

## Reuse boundaries

| Shared piece | Responsibility | Consumers |
| --- | --- | --- |
| UserAvatar | Image rendering, reserved dimensions, neutral fallback | PersonCell and existing avatar consumers |
| PersonCell | Identity, secondary text, role text, normal/compact presentation | Tenant directory/audit/intakes/records, Counsellor directory and selections |
| PersonSelectRow | One labelled radio target, alignment, selected/focus state | Counsellor assignment, TenantUserPicker |
| PersonSearchSelect | Search field, result list, keyboard interaction, clear/dismiss, validity | Advisor instructor lookup, course report student lookup |
| TeachingDialog | Native modal lifecycle and shared shell | Course dialogs, TA permissions, assignment grading |
| advisingErrorMessage | Known actionable error copy and server/transport fallback | Existing advising consumers and exam section creation |

Person components do not fetch tenant directories or perform assignment mutations. Callers map their own typed records into display props. The Counsellor contract exposes no advisor-photo field: the shared neutral identity mark is intentional. No invented image endpoint or sample portrait is used, and the row does not trigger one photo request per candidate.

Advisor instructor search still uses `/v2/advisor/instructors` with `q`, `page`, `size`. Course student search still uses the course members API with `courseRole=Student`. Counsellor advisor search remains explicitly page-local because its consumed contract provides pagination but no text-search parameter. TenantUserPicker retains its role/status/level filtering and explicit confirmation dialog.

## Lessons applied beyond the screenshots

1. Reuse identity presentation independently from permissions and mutations. A person card should not own the business rules of every role that displays it.
2. Give one step one visual priority. A prominent button must match the actual next action. Save, save-and-continue, and navigation must have accurate labels and distinct behavior.
3. Keep compound controls together. Search and selection are one interaction for a remote directory; small fixed enums can remain native selects. Administrative selection that needs review can remain a dialog.
4. Scope styles by control semantics. A text-input height must never resize radio/checkbox controls. Do not override all descendant spans, labels or inputs inside a page to style one component.
5. Preserve identity across asynchronous results. Search, pagination and clear actions must not leave stale IDs behind. Selecting after pagination must close results even when focus returns from a footer button.
6. Use tokens for recurring typography and spacing; provide compact presentation explicitly when a bounded region needs it. Recheck content height rather than hiding overflow.
7. Share complete dialog behavior, not just a white panel and backdrop. Test focus entry, background inertness, Escape, return focus, pending state and short-screen reachability.
8. A failure state must tell users what to do and preserve their work. Empty results, unavailable data and insufficient permission are different states.

New shared search, validation, clear/dismiss, save/continue and skip-link copy uses the existing i18next resource architecture, with English, Simplified Chinese and Traditional Chinese resources. A component test changes locale live and checks validation, empty states, selected identity, key coverage and interpolation parity. This is scoped to the new shared copy; full-site localization is a separate migration.

## Coverage and evidence

Static dependency traversal started at `src/main.tsx` and followed local production imports, including lazy routes: 580 modules, of which 259 are TSX/JSX and 138 are CSS/SCSS. Shared tokens and repository/Figma standards were inspected separately. The scan excludes unimported duplicate files and tests. Its automated checks cover explicit sub-12px text and unrestricted transitions; zero findings from that scan is not an accessibility certification.

Browser review uses isolated API fixtures. Routes and flows sampled include:

| Role/area | Coverage |
| --- | --- |
| Student | Dashboard, course workspace, study plan, exams, vocabulary sessions and recovery |
| Instructor | Dashboard, availability, occurrences, attendance, reports, grading, roster permissions |
| Instructor + Advisor | Role navigation and responsive teaching workspace |
| Advisor | Student records, course creation, instructor lookup, assignment dialogs, messages and scheduling |
| Counsellor | Dashboard, intake queue/create/edit, parent links, advisor selection and first handover |
| Parent | Student context, progress, schedules, messages, pagination and navigation history |
| Tenant Admin | Directory, intake assignment, ownership, governance, protected exam media and authoring |
| System Admin | Role shell and responsive admin entry |

Responsive checks include 320, 375, 390, 768, 1024, 1280, 1440, 1600, 1752, 1920, 2560 and up to 3840px where relevant; landscape includes 844 × 390. Tests measure geometry, current accessible roles, versioned payloads, idempotency, focus and error recovery. Screenshot inspection covers the instructor dropdown, Counsellor person rows, intake action footer and small-screen selectors.

Validation results are recorded in [validation.json](evidence/uiux-consistency-20260904/validation.json) with command logs. Lint, both typechecks, build, and 697 unit tests pass. All 100 browser tests in the broad review passed across the initial run and targeted reruns; this is not a single green 100-test run. The latest built artifact also passes 26 overlapping people/dialog/course-workspace tests after localization updates. Earlier failing logs are retained with the reruns that resolve them. Native browser chrome can receive focus; modal tests verify that background application controls remain inert instead of imposing a custom trap around browser UI. Responsive assertions were corrected to recognize the existing mobile flex layout and 1024px two-column composition. Old native-select/disclosure test interactions were updated to the new combobox behavior.

No live authenticated Dev acceptance, merge or deployment was performed. The repository already contained unrelated changes; this audit preserves them. Frontend fixture evidence does not prove the availability or successful writes of connected backend systems. Safari, Firefox, screen-reader hardware, and every possible production record combination were not exercised.

## Review references

- [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), fetched for this review.
- Installed UI/UX Pro Max guidance: autocomplete, keyboard navigation, touch spacing, text reflow and controlled React fields. Existing React 18 and project tokens govern implementation.
- [Project standards](../lms/PROJECT_STANDARDS.md) and [Figma frame/API mapping](final-figma-review-2026-09-03.md).

## Production release integration

The release branch is based on main `60646f2` and preserves the already-deployed Tokyo configuration from `d0f400b`. It applies this review’s scoped changes while retaining newer upstream name handling, native-dialog busy guards and responsive behavior. Unrelated local internationalization migration and feature work are excluded. New shared translation resources remain available without enabling a partially translated site.

The isolated candidate passes lint, both typechecks, build, 737 unit tests and all 264 Chromium tests without retries. See [release candidate validation](evidence/uiux-consistency-20260904/release-candidate.json). Candidate evidence is separate from subsequent GitHub CI, merge and production activation.
