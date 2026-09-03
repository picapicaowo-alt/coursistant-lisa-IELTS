# Parent portal UI/UX — September 3, 2026

## Delivered scope

Frontend-only navigation and presentation update. The established X-Learn shell,
semantic tokens, WorkspaceSection panels, form controls and status badges remain
the visual system. No backend, API service, environment, proxy, credential,
dependency or deployment changes are included.

| Sidebar area | In-page views | Presentation |
| --- | --- | --- |
| Student progress | Overview, no top-level tab strip | Current courses and assignment progress; hours/attendance summary; links to related workspaces |
| Learning | Study plan; Courses & assignments; Attendance & hours | Checkpoint timeline as primary content, learning profile/risk as supporting content; independent reads/errors per displayed section |
| Schedule | Scheduled classes; Request history | Class selection and request editor side by side on desktop; stacked on mobile |
| Reports | Published report list and selected detail | 4+8 master/detail layout with contracted MID_TERM / FINAL summary, strengths, weaknesses, skill evaluation and next steps |
| Mock exams | Assigned exams and selected results | 4+8 master/detail layout with contracted section scores/status and Parent observer permissions |
| Messages | Conversation; Notifications | Conversation and composer side by side on desktop; cursor pagination, attachments and notification pages |

`lms/src/configs/parentNavigation.ts` owns Parent areas, section labels and URL
construction. Existing `/parent?section=...` bookmarks remain valid, including
`section=notifications`, which selects Messages in the sidebar. `tab` controls
only the selected area's subview. Sidebar links preserve `studentUserId` and
reset unrelated subviews. The mobile shell exposes every destination through
the same navigation configuration and More menu.

## Data and interaction boundaries

- All student IDs are still selected from the paginated active-link response.
  Unknown IDs are not used for protected reads. Changing the selected student
  remounts the workspace, preventing cross-student draft/attachment leakage.
- Student names come from the existing dashboard read. The selector uses names
  already in the query cache and otherwise shows the student ID; it does not
  invent name fields in the linked-student contract or load every dashboard.
- Several Parent academic GET operations have unspecified response schemas.
  Presentation narrows observed fields at runtime; generic record details remain
  the fallback. No synthetic production records, inferred scores or new endpoints.
- Course percentages are shown only when returned as valid numeric percentages.
  Structured instructor names remain structured; no full-name splitting.
- Schedule requests retain existing payload fields, idempotency and wall-clock
  date/time values. Submission success is shown only after the mutation succeeds.
- Read-only mock exams, message upload/download, report pages and notification
  read mutations retain their existing service and permission boundaries.
- The UI does not claim unsupported weekly reports, conversation filters,
  sender roles, attachment-size limits, schedule notices, buildings or writing
  percentages. Those appear only if a consumed contract supplies them.

## Verification

- `npm run lint:ci`: passed.
- `npm run typecheck`: passed.
- `npm run typecheck:production`: passed.
- `npm run test:run`: 132 files / 553 tests passed.
- Production Vite builds: passed in both the standard `dist` directory and the
  isolated Parent review artifact.
- Focused Parent/contract E2E: **12 passed**.
- Full E2E suite: **97 passed**, without retries.
- Layout exercised at 320, 390, 768, 1440, 2048 and 2560 CSS-pixel widths.
  Desktop/mobile visual review covers all six Parent areas.
  The main workspace is the actual scroll owner; mobile detail captures are
  explicitly scrolled captures, not claims of an entire page fitting on screen.
- Browser verification confirmed meaningful content, no Vite error overlay,
  successful navigation and no console errors. At 390px every reviewed route
  had matching 390px document and main-workspace widths.

The isolated fixture harness is `lms/.impeccable/parent-local-preview.mjs`.
It binds to loopback, blocks writes, never proxies upstream and labels its data
as sample data. The automated review config accepts `PARENT_REVIEW_DIST` and
`PLAYWRIGHT_PORT`.

## Acceptance limit

This is local frontend and isolated-fixture evidence, not authenticated live
Parent acceptance. No Git commit, push, merge, Dev 8085 release, USC 8084 release
or production release was performed. Unrelated concurrent Counsellor work and
pre-existing duplicate files were preserved.
