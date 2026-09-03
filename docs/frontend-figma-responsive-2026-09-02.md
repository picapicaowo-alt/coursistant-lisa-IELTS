# Figma implementation and responsive acceptance

## Delivered behavior

| Surface | Design and implementation | Acceptance boundary |
| --- | --- | --- |
| Student study plan | Figma 464:3172 checkpoint overview, task filters/sort/pagination, 5:3 task detail, original illustration; narrow screens show one pane | Deep links, back/close, keyboard focus restoration, draft retention and versioned Start/Complete requests tested |
| Advisor students | Figma 783:8276 information panel, avatar/name, goal, risk and last activity; mobile cards; contracted search and filters | Actual API fields only; no invented current-level/checkpoint column or bulk messaging |
| Courses | Stable course identity colors from the Figma category palette in Advisor, course catalogue and dashboard cards; independent disclosure | Three courses remain visually distinct; details/actions and date-picker anchors tested |
| Exams | Figma 163:698 card library with section and supplied-state filtering; shared type scale and controls | No invented progress, scores, duration or unsupported Speaking action |
| All role workspaces | Shared gutters, 28–32px primary titles, 22px headlines, 18px section titles, 14px body and 12px metadata, light borders and 44px action targets | Student, Advisor, Instructor, combined Instructor/Advisor, Counsellor, Parent, Tenant Admin and System Admin fixture pages tested |
| Undesigned features | Existing operational forms, tables, disclosure, vocabulary and admin flows use the same semantic token layer | Functional authorization and API contracts remain unchanged except required task-start query correction |

The supplied node 464:3317 is a pointer annotation. Its enclosing Study plan/student frame, 464:3172, is the implemented screen. Reference frames and semantic decisions are documented in `DESIGN.md`.

## Responsive rules

Page containers use available width, proportional grid tracks, content-based wrapping and shared fluid gutters. Preferred card widths are shrinkable minima, not mandatory widths. Readable text/form measures and minimum touch targets remain bounded for usability. Tables switch to labeled cards; task detail replaces the list on narrow containers. No viewport width is forced and no horizontal clipping is used to conceal overflowing content.

Long sections remain independently collapsed by default. Expansion preserves drafts and automatically reveals fields that fail validation. Ordinary workspaces reserve room for mobile navigation; the focused checkpoint screen has its own Back action and no navigation overlay.

## Verification

- Isolated checkout: no unrelated cloud-sync duplicates or environment changes included.
- Lint, TypeScript, production TypeScript, 534 unit tests, production build passed.
- 53 Chromium E2E tests passed without retries, including 320, 390, 768, 1024, 1440, 1920 and 2560 viewport widths.
- Screenshot review covered student task detail/list, Advisor students/profile/plan/courses, exams, Instructor operations and Admin mobile layouts.
- A focus restoration race found in the first run was fixed; the confirming complete browser suite passed.
- Figma Dev Mode is active in the authenticated design file with CSS inspection available.

These browser fixtures validate frontend interactions and exact request contracts. They do not by themselves establish live backend acceptance. Authenticated Dev observations are recorded separately below.

## Live Dev observations and remaining contract gaps

- Existing Advisor session can read current assigned students and open study-plan revision history, including version zero. The inspected historical snapshot returns version metadata and checkpoint count only, not the historical strategy/tasks. The frontend displays exactly that returned content.
- Profile history still has no historical-read endpoint in the supplied contract. The current Profile version is not an accessible historical record.
- Figma task attachment download has no supported student task-file contract; no synthetic download link is implemented.
- User supplied role credentials for additional live login checks. Credentials are not written to this repository or this report.
