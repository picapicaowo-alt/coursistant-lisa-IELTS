# Parent Portal — Surface Design

## Overview

Mode: **Operate**. Parents review a linked student's learning records and complete record-specific follow-up without losing the selected-student context.

This surface extends [root DESIGN.md](../../../../DESIGN.md) and [PRODUCT.md](../../../../PRODUCT.md), retaining X-Learn's semantic tokens, typography and status badges. Student and instructor names use the shared structured-name formatter; unavailable student names fall back to the student ID, never inferred name parts. No separate visual system or token values are defined here.

## Layout

The app shell owns top-level navigation and scrolling. Parent areas are configured centrally; the page shows only the current area's work, not a stack of unrelated workspaces.

| Sidebar area | In-page views |
| --- | --- |
| Student progress | Overview; no top-level tab strip |
| Learning | Study plan (`plan`); Courses & assignments (`courses`); Attendance & hours (`attendance`) |
| Schedule | Scheduled classes (`upcoming`); Request history (`requests`) |
| Reports | Published report list and selected detail |
| Mock exams | Assigned exams and published results, with Parent observer permissions |
| Messages | Conversation; Notifications |

Existing `section` bookmarks remain valid. `section=notifications` belongs to Messages; `tab` chooses only an area's subview. Area links retain `studentUserId` and discard unrelated subviews. Mobile navigation exposes the same destinations through the shared shell and More menu.

The shared 12-column desktop grid gives overview courses/progress summary a 7+5 split, with onward links spanning the workspace. Learning uses 8+4 for plan/profile-status, courses/assignments and attendance/hours. Scheduled classes/request editor and conversation/composer use 7+5; reports and mock exams use a 4+8 master/detail composition; request history is full-width.

At the shared single-column breakpoint, these regions stack in task order. The study plan stays first; the student picker expands and schedule time fields stack at the mobile breakpoint. Tabs wrap, long metadata can break, and section spacing follows the shared tokens.

## Components

`WorkspaceSection` keeps primary content visible, with a labelled heading, optional summary/count, a bordered working surface and a separated header. Optional course, checkpoint and task details use disclosures; they do not hide the primary record.

Each mounted student workspace receives an immutable selected-student ID validated against active linked students. Queries and mutations use that context. Message text, attachments, schedule drafts and selected report state belong to that mounted workspace; selecting another student remounts it and clears transient state. The student selector is disabled while message or schedule submission is pending.

Schedule selection supplies course/occurrence IDs; existing request fields, wall-clock date/time and idempotency remain intact. Success follows the mutation. Attachments, cursor pagination, report pages and notification actions retain existing interactions. Unspecified academic response schemas are narrowed at runtime with generic record details as fallback; each visible Learning section keeps independent loading, error/retry and empty states. Course percentages appear only when returned as valid numeric percentages.

## Do's and Don'ts

Do preserve centralized navigation, semantic tokens and record-scoped state. Keep unknown linked-student IDs out of protected reads. Don't invent response schemas, progress, scores, records or successful outcomes; don't duplicate the global design system or shared primitives.

The [acceptance record](../../../../docs/parent-portal-uiux-2026-09-03.md) separates local frontend/fixture evidence from authenticated live Parent acceptance and deployment.
