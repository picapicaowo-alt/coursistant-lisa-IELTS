# xLearn disclosure and course hierarchy delivery

Date: 2026-09-02
Scope: training frontend only; local implementation and browser-fixture verification.

## Result

Long workspaces now expose a compact title and summary before their fields or actions. Each section is independently expandable and starts collapsed. Expanding one section does not close another. Collapsing preserves mounted inputs and unsaved drafts.

Explicit edit, add-record and task-link actions reveal the relevant detail. Browser required-field validation reveals enclosing sections before focusing the invalid control. Page-level save actions and save/conflict feedback remain visible where the save applies to several sections.

| Area | Disclosure coverage |
| --- | --- |
| Advisor profile | Student context, primary target, measured skills, individual skills, private notes |
| Advisor study plan | Direction, checkpoints, individual tasks, revision activity; direct task links reveal their ancestors |
| Advisor course planning | Separate colored course summaries; group linking, one-to-one creation and editing |
| Advisor operations and support | Owned courses, action tasks, conversations, scheduling, availability, learning history and reports |
| Student | Profile, targets, skills, study-plan tasks, conversation, learning operations and calendar |
| Instructor | Teaching queues and courses, support, availability and calendar; shared course and assignment property forms |
| Counsellor / intake | Shared student identity and learning-context fields; parent or guardian access |
| Parent | Overview, exams, schedule requests, conversation, reports and notifications |
| Tenant management | User directory, account creation/detail, ownership, alert rules, audit, student records and course scheduling |
| Mock-exam staff | Template library, release controls, composer, assignment preparation, assigned papers and writing review |

Navigation, page identity, error feedback, compact overview metrics and active exam-taking interactions retain their roles; the disclosure pattern applies to detailed sections and long forms.

## Shared implementation

- `CollapsibleSection`: native `details` / `summary`, keyboard interaction, labelled content regions, retained form state, invalid-field revelation and explicit-target revelation. No exclusive accordion state. Editor entry points use an interaction revision so reopening the same selected record also works, while unrelated re-renders preserve a manual collapse.
- `CourseIdentityCard`: xLearn blue, indigo and violet tokens; deterministic course-ID color. Name, course code, teacher and state remain visible; actions appear on expansion. Color is supplementary to the text identity.
- `PropertyForm`, `OperationCard`, `StudentIntakeFormFields` and `ParentLinksPanel` reuse the disclosure primitive across their existing consumers.
- `DateTimePickerPopover`: placement first tries the right side; otherwise it aligns to the input's right edge above or below. Available height is bounded without moving over the edited field. Scrolling, resize and visual-viewport changes reposition the popover. Dismissal returns focus appropriately; keyboard focus alone does not reopen it.
- The mobile shell reserves space above its bottom navigation, instead of letting the navigation overlay the main scroll viewport.

No API request schema, endpoint, route permission or backend behavior was changed for this UI refinement. Existing contract/audit changes from the earlier task remain separate in the working tree.

## Reference and visual review

The supplied xLearn screenshots and blue/cyan logo establish the brand. The referenced [CNPAF Community](https://github.com/picapicaowo-alt/CNPAF-Community) frontend was inspected for interaction conventions; its reviewed date fields use native browser controls, so the xLearn custom calendar positioning was implemented in its own shared component.

A desktop/mobile screenshot review covered the profile, plan, multiple course cards and date popover. The correction batch aligned the profile form width, made course corners explicit, reserved mobile navigation space and retained calendar dismissal controls at constrained heights.

## Acceptance

The final baseline runs lint, both TypeScript configurations, unit tests, the production build and Chromium E2E in sequence. Browser fixtures use synthetic users and intercepted APIs; they do not prove acceptance with the live Harbourview accounts. No deployment, push or merge is included.


| Check | Result |
| --- | --- |
| `npm run lint:ci` | Passed |
| `npm run typecheck` | Passed |
| `npm run typecheck:production` | Passed |
| `npm run test:run` | 127 files, 529 tests passed |
| `npm run build` | Passed |
| `CI=1 PLAYWRIGHT_PORT=4205 npm run test:e2e -- --retries=0 --workers=2` | 37 passed; isolated preview of completed production build |
| `git diff --check` | Passed |

New browser coverage verifies independent defaults, retained unsaved text, nested required-field focus, direct task-link expansion, repeated edits of the same course, multi-course colors, date/input non-overlap, calendar dismissal visibility and mobile save-button reachability. The existing Week 1 grading-route regression and cross-role workflow tests also pass.

Screenshots: [course cards](ui-review-2026-09-02/courses-desktop.png), [collapsed study plan](ui-review-2026-09-02/study-plan-desktop.png), [mobile profile](ui-review-2026-09-02/profile-mobile.png), [desktop date picker](ui-review-2026-09-02/calendar-desktop.png), [mobile date picker](ui-review-2026-09-02/calendar-mobile.png).
