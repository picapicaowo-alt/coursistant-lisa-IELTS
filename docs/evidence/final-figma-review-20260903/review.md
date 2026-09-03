# Independent rendered review — 2026-09-03

**This report does not accept full Figma parity.** It records rendered frontend verification and its limits. API requests were intercepted with isolated synthetic fixtures; these results do not establish authenticated account creation, enrollment, message delivery, published grades, or a live AI answer.

## Final evidence

- 56 application states at 1440×1024 and 390×844: **112 main screenshots**, plus one mobile Copy/Latest response proof. Nine manifests map those screenshots to **59 of 69 interface nodes**. Five Dashboard nodes belong to the parent audit; five specific states remain uncaptured below. UX Flow is excluded. No node is marked parity accepted merely because a screenshot exists.
- Captures use the working-tree production build through isolated Playwright preview port 4192, including compiled SCSS. All nine groups passed in 16.2 seconds. Subsequent affected-group reruns and the focused mobile interaction check passed after successive implementation fixes; see final capture run metadata. Unchanged surfaces retain earlier independent visual inspection; each changed surface was rerendered and inspected again.
- All 112 main geometry records have zero document-width overflow and zero broken images. Overlay separation and composition were also visually inspected; geometry alone was not used as approval.
- Current individual PNGs are the final evidence. `before-fixes/` preserves the previous screenshots. Contact sheets 01–12 are older review aids and must not be presented as final output.
- The temporary capture source is retained as `acceptance-visual-capture.spec.ts` in this evidence directory. It imports the repository's `e2e/workspace-fixtures.ts` and is intended to be copied back beside that file to reproduce captures. It is removed from the permanent E2E discovery directory after verification.

## Corrections verified in rendered output

| Surface | Verified result | Evidence |
|---|---|---|
| Advisor directory | Selection count and Clear selection remain above mobile navigation, with a visible gap. | `advisor-students-selected-390.png` |
| Advisor Add Course | Exactly one delivery option has a visible purple selected border matching its pressed state. | `advisor-add-course-1440.png`, `advisor-add-course-390.png` |
| Advisor student workspace | Mobile identity/metrics are compact; tabs and the Learning Journey heading appear earlier. Course lifecycle actions are inside Manage enrollment instead of competing with View Course. | `advisor-student-journey-390.png`, `advisor-student-courses-1440.png` |
| Observer exams | Cards retain available attempt state, selected sections and released result summaries. Reading/listening counts and writing score are shown from fixture fields. | `advisor-exams-1440.png`, `advisor-exam-results-1440.png` |
| Student Profile | Phone hero is 348.5 px tall, versus approximately 610 px before. Avatar controls end 20 px before baseline text begins. Skill cards form two columns with Reading/Writing/Speaking/Listening icons. Crop preview is landscape with a round avatar selection. | `student-profile-390.png`, `profile-crop-1440.png`, `profile-crop-390.png`, `final-phone-geometry.json` |
| Signup | Confirm password is present and the final verification action says Activate account. Structured names and required tenant/verification steps remain. | `auth-signup-details-390.png`, `auth-signup-verification-1440.png` |
| AI | Assistant responses have a readable white content area. On phone, Latest response scrolls to the new answer and Copy resolves with visible feedback. Course sidecar shows the four Figma prompt rows and compact composer. Each prompt prefills input; sending a synthetic response and New chat reset worked. Send stays inside the composer and the opaque surface prevents background text showing through. | `ai-long-conversation-390.png`, `ai-phone-copy-latest-proof.png`, `student-course-ai-1440.png`, `student-course-ai-390.png`, `student-course-ai-response-390.png` |
| Calendar | Desktop event details/editor are anchored to the originating control; mobile retains a contained dialog. The anchored editor stacks Starts/Ends with sufficient width; date/time picker is visible and scrollable. | `calendar-course-detail-1440.png`, `calendar-add-event-1440.png`, `calendar-add-event-390.png`, `calendar-date-time-picker-1440.png` |
| Exams | Writing submit confirmation/success and reading question entry/released per-question correctness were exercised. Both initially-loading desktop captures were replaced after explicit readiness checks. | `student-exam-confirm-1440.png`, `student-exam-complete-390.png`, `student-reading-questions-1440.png`, `student-reading-results-390.png` |

## Remaining differences and unverified states

These are not all API blockers. Feasible visual differences must remain visible in the parity decision.

- Add Course mode icons, descriptions, selected radios and supplied catalog metadata are now implemented. The consumed catalog projection still lacks skill category, instructor and schedule fields from the design.
- Calendar combined date/time picking differs from the separate date/relative-duration reference. The captured course-quiz detail is a different resource from a scheduled mock exam. A phone time picker requires scrolling to its hour/minute fields; this was not classified as a failed control.
- Course reader uses one LINK fixture. Video/PDF-specific content, completion indicators and multi-material next-item behavior were not rendered in this capture. **Go to next item is already implemented** from `materials[index + 1]` in `MaterialReader.tsx`; the single-material fixture hides it. This is an unverified state, not a missing endpoint or missing implementation.
- Course Information/Class Schedule is the current observer projection, not the learner content/assignment workspace. Profile nickname is replaced by required structured name fields. The profile header menu has Profile/Settings/Sign out; distinct Feedback/Account destinations are not established here.
- IELTS runners now use a compact desktop question rail while preserving their required passage/writing panes. Released reading correctness is captured for `427:2930`, but AI scoring/comments/Advisor notes are not implemented by that result projection. `ObserverMockExamDetailDto` explicitly omits writing feedback and task content.
- Student conversations were captured; parent-recipient channels and bulk Assign Teacher/Send Message/Delete were not. Current level and next checkpoint are absent from `AdvisorStudentSummaryResponse`. **highestPriority is present** and cannot be labeled a missing-contract field.
- Copy/Latest response are working frontend controls. Persisted AI history/search/share, course notes, per-question AI explanations and task-linked quizzes must not be represented as working without their respective contracts. No unrestricted Study Support call was substituted for a missing exam-specific operation.

## Exact screenshot-to-node coverage

| Application group | Figma IDs with screenshots or partial equivalents |
|---|---|
| advisor | `783:8276`, `791:10510`, `810:15612`, `803:13456`, `813:4892`, `805:14271`, `818:7178`, `818:7815`, `815:5643`, `810:15017`, `818:8771`, `816:6276` |
| ai | `201:906`, `322:865`, `410:9227`, `333:974` |
| auth | `715:3994`, `729:3484`, `730:4653`, `730:4753`, `731:4840`, `731:4886`, `732:4924`, `732:4973` |
| calendar | `335:1033`, `375:3392`, `375:4466`, `375:3937`, `365:1122`, `375:1621`, `375:1956`, `375:2540` |
| exams | `163:698`, `423:3034`, `417:2798`, `427:2694` |
| profile | `405:2345`, `410:2120`, `378:1714`, `406:2399`, `410:2408`, `408:2433`, `406:1914`, `399:1628`, `408:1956`, `406:3008` |
| reading | `417:2798`, `427:2930` |
| student-course | `82:357`, `414:3326`, `493:3350`, `494:3386`, `498:4121`, `507:3365`, `496:3494` |
| student-plan | `100:456`, `445:3397`, `148:642`, `445:3823`, `464:3172` |

## Explicitly uncaptured design states

| Node | Boundary |
|---|---|
| `506:3609` | Course notes are absent; no consumed course-note persistence operation was established. Announcements are a different resource. |
| `813:4672` | Advisor parent-message directory/thread is not implemented; current advising conversation operations are student scoped. A parent-recipient channel contract was not established. |
| `819:9475` | Advisor observer question-level read/edit projection is not established; see B09. |
| `430:2779` | Task-linked quiz destination and task-to-question-resource relationship are not established by the consumed advising contract. |
| `427:3588` | Per-question AI explanation/chat overlay has no consumed exam explanation operation. Course Study Support is a different capability. |

Parent Dashboard scope: `17:914`, `108:882`, `466:3289`, `772:3458`, `792:11208`. Excluded workflow reference: `774:7079`.

## Acceptance boundary

The listed frontend corrections are supported by screenshots or actual fixture interactions. Full 69-frame visual parity, authenticated API acceptance, complete permanent baseline, PR approval and deployment are separate gates owned by the parent task. No production code, shared tests, credentials, backend or infrastructure were changed by this independent capture task.

## Primary-agent completion after auxiliary service interruption

The primary agent completed the final Add Course and 1000px listening checks using local Playwright. Both passed. Listening title/candidate/audio now remain on coordinated rows; Add Course heading, left-aligned catalog title and persistent footer were visually inspected at desktop and phone widths. No further auxiliary-agent requests were made.
