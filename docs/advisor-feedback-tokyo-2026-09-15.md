# Advisor task context and student contacts — Tokyo review

## Scope and evidence

The requested behavior is that an Advisor can identify the student and unfinished learning task behind an action item, then choose a student to contact from a messaging directory. The accompanying *XLearn-UX-Accessibility-Feedback 2026-09-09.pdf* is a third-party, read-only audit of **Dev 8085**. Its recommendations are review input; they do not authorize publishing exam content, changing grading policy, or extending backend permissions.

The user clarified that the target is **Tokyo Production** (`app.xlearnedu.com`, API `api-cn.xlearnedu.com/api`). The checks below distinguish the unchanged deployed UI, a locally built candidate using the authenticated Tokyo API, and fixture tests. No messages were sent and no task was started/resolved during these live checks.

## Implemented

- Each action item and its detail show the related student's name and links to their profile and selected Messages conversation. Name lookup failures retain the student ID and a retry control. Repeated student lookups share the existing query cache.
- Typed source identity identifies the record. Learning-plan tasks additionally load their actual title, due date and current learning-task status. Reminder status remains separate from learning-task completion.
- Conflicting top-level/target student IDs do not produce a student link. Opaque `sourceReference` JSON is neither displayed as product copy nor executed as a URL.
- Student-type filters now send contracted `VIP`/`STANDARD` values rather than `ACTIVE`/`INTAKE`/`TRANSITION`.
- Messages has **Conversations** and **Student contacts** views. Contacts use the paginated assigned-student API and support name search independently of existing chat history. Selecting a student opens their conversation.
- A direct message link resolves the selected student's name independently of the current directory page/filter. Student-list message actions now open the same Messages workspace.
- The Messages page no longer nests a second `main` inside the application shell. English, Simplified Chinese and Traditional Chinese resources cover the new copy.

## Tokyo observations

Authenticated Advisor `userId=7` in the existing test tenant:

| Read / route | Observation |
| --- | --- |
| Assigned students | Four students, IDs 25–28. |
| `GET /v2/advisor/action-tasks?page=0&size=20` | HTTP 200, four reminders, all for student 26. Two resolved schedule approvals; two report reviews (pending/in progress). Student and typed source IDs are supplied by the API but omitted from the deployed list presentation. |
| `GET /v2/advisor/conversations?page=0&size=20&unreadOnly=false` | HTTP 200, all four students. IDs 25 and 27 have no thread yet. Thus a missing backend contact list was not reproduced in this account. |
| Deployed Messages, student 25 | Conversation composer reachable; two `main` landmarks. |
| Candidate tasks → Message student → Student contacts → student 25 | Correct selected student and composer; four contacts; one `main` landmark. |
| Candidate mobile, 390 × 844 | Contact list → thread → back works; selected student stays correct; no document horizontal overflow. Simplified/Traditional locale switching checked. |

The candidate browser check used request interception to serve local compiled frontend assets while leaving Tokyo API requests unchanged. It is **not a deployment**. No incomplete learning-plan reminder exists in this account's current four-item inbox; exact overdue-task title/status enrichment is covered with fixtures, not claimed as a live overdue-case acceptance.

## Third-party audit disposition

These are scoped dispositions, not a new all-role WCAG certification. Source checks refer to the frontend candidate based on `df4207f7`; rows without authenticated role evidence remain unverified on Tokyo.

| Finding | Current disposition |
| --- | --- |
| U-01 No published exam papers / late blocker | The report's four-draft tenant state is Dev evidence, not proof the feature cannot complete on Tokyo. The mock-exam preparation form and student empty-state wording still warrant a separate review. Do not publish a draft merely to clear an empty state. |
| U-02 Counsellor loses assigned intakes | Contract limitation: the consumed counsellor list explicitly returns caller-owned **unassigned OPEN** intakes. An all-created history requires a supported contract; the frontend must not use the tenant-admin endpoint as a substitute. |
| U-03 Grade offered without submission | Current grading UI permits opening a grading record without a submission. The audit's proposed zero/excuse/chase actions are policy decisions; do not invent them. Clarify the action label and permitted grading behavior in a focused grading change. |
| U-04 Grading counts disagree | The grading page displays the API's `ungradedCount`; the dashboard consumes its separate grading feed. Their definitions must be reconciled against live payloads before claiming a frontend counting defect. Not live-retested here. |
| U-05 Resubmit after released grade | The submit button follows `acceptingSubmissions` and does not separately gate on a released grade. The effect of a replacement submission needs an explicit product/contract decision before adding a consequence statement. |
| U-06 Dashboard omits due assignment | Current student dashboard has course progress and Advisor-task previews; aggregate completion counts alone do not identify an assignment or its due date. A course-assignment deadline view needs scoped data loading. Not changed in this Advisor patch. |
| U-07 Empty student rubric | Source still renders the rubric card when no rubric is posted. Suitable for a separate assignment-detail presentation fix. |
| U-08 Stray `#` | Source uses `#` as the Points icon, not an empty data row. Treat it as decorative (or replace the icon) rather than deleting a valid points value. |
| U-09 Release controls without selection | Current source disables selected-release/retract when no rows are selected and disables release-all when `enteredCount` is zero. Hiding the zero-count control is an optional presentation change. No live release performed. |
| A-01 Missing skip link | Not reproduced on current Tokyo Advisor routes: “Skip to content” links to `#main-content`, which is focusable. This is not evidence for all roles/routes. |
| A-02 Focus visibility | Shared `:focus-visible` and header `:focus-within` styling already exist. Specific component overrides need browser inspection; a blanket missing-focus claim is not established here. |
| A-03 Contrast | The report's Dev axe counts were not repeated on Tokyo. Keep contrast failures pending a current rendered-color/axe check; do not treat a token adjustment as proof every surface passes. |
| A-04 Parent definition list | Source confirms nested decorative/content wrappers inside `dl` groups in `ParentLearningProfile`; this merits a parent-layout semantic fix and screen-reader/axe validation. Not changed in this Advisor patch. |
| A-05 Named generic containers | Source confirms named generic day columns in `WeekCalendar` and a named generic pipeline bar. Suitable for a calendar/admin semantic fix. |
| A-06 Duplicate main / unnamed nav | Duplicate `main` reproduced on Tokyo Messages and fixed in this candidate. Calendar/course-operation page roots and remaining navigation labels require their own scope. |
| A-07 Header search label mismatch | Source still uses different semantic keys for visible prompt and accessible name. Align them when reviewing the student/instructor search flow; Advisor has no global search in its header. |

## Validation

- Candidate isolated from the user's existing worktree and based on latest fetched `origin/main` (`df4207f7`). No environment, account, contract, lockfile or backend changes.
- Full lint, normal typecheck, production typecheck: passed.
- Full unit suite: 928 tests passed.
- Production build: passed; existing large-chunk advisory remains.
- Full browser suite: 444 Chromium tests passed (2.0 minutes).
- Live scope: Advisor read/navigation, task context, student contact selection, desktop/mobile and locale behavior. No message-send, attachment upload, reminder transition, grading write, or all-role acceptance claimed.

## Label alignment follow-up

Status and priority now have explicit grid cells. Desktop pills, first title lines and action buttons share a 44px first-line track, independent of extra student details or title wrapping. Compact layouts retain two equal label columns with the actions on the next row.

Browser measurements at 1440, 1280, 1024, 768 and 390px confirmed identical per-column left edges across all four Tokyo reminders and no document overflow. Desktop status, priority and button centers matched exactly. Production build, targeted lint and three existing browser regression cases passed. The previously reported full-suite counts apply to the preceding commit; this CSS follow-up has its own fresh PR CI run.
