# Instructor recent activity and historical group links

The instructor dashboard displayed the backend's audit `summary` verbatim,
including `LEAVE_SELF user=26`. Every group event linked directly to its
historical group-set ID, even when that resource was no longer available.

## Read-only live observation

On 2026-09-05, the signed-in Instructor at `app.xlearnedu.com` had seven
group-membership events for course 1, all linking to `/course/1/group-sets/1`.
Opening that route reproduced the unavailable page and HTTP 404 errors in the
browser console. `/course/1/groups` loaded normally and showed no current group
sets. This establishes a stale or unavailable historical destination; it does
not establish how, when, or by whom the group set was removed. No live records
or memberships were changed.

The consumed `docs/api/course.openapi.yaml` already contains recent activity,
group listing/detail, self join/leave/switch, and staff membership operations.
No new endpoint or response field is assumed by this frontend change.

## Teacher home information scope

The home panel now shows **Teaching to-dos**, sourced only from the existing
`/v2/me/teaching/grading-queue`. It includes pending assignment grading, manual
quiz grading, and grades awaiting release. It no longer reads
`/v2/me/teaching/activity/recent`: group membership logs and historical late
submissions do not establish that a teacher needs to act now. Unresolved late
submissions are represented by the authoritative grading queue when eligible;
the frontend does not infer a late flag or pending status from old events.

- Grading and release aggregates for the same course assignment or quiz share
  one card and destination, with separate counts. Course and assessment-type
  boundaries remain distinct. Each card explains the course, authored title,
  work remaining and next action.
- All platform copy uses the shared English, Simplified Chinese and Traditional
  Chinese resources. Authored course codes and assessment titles stay original.
- Known queue kinds have explicit presentation and routing. Unknown kinds or
  incomplete targets never render raw identifiers, broken links or a false
  no-work message; the existing teaching-management entry remains available.
- The successful empty state is scoped to assignments and grades. Loading and
  failed reads cannot display an empty queue or zero pending count.
- The separate course deadline panel says there are no upcoming assignment or
  quiz deadlines, rather than no pending work. Past submissions can still need
  grading, so those two areas must not contradict one another.
- New activity types do not automatically gain a home placement. A future home
  item must have a verified current need, understandable context, a real action,
  three-locale copy and no duplication of another home item. A generic
  "Teaching update" is not a reason to fill the home panel.
- Group management remains in the course workspace. No course history screen
  is invented from a globally limited recent-activity feed. The backend records
  are untouched; a dedicated course history requires an appropriate contract.

## Historical group links

The previously implemented recovery remains: an old detail link returning 404
shows a neutral status and a current-groups link. Copy allows that the group may
have been removed without claiming deletion as a confirmed cause. A 403 gets
permission-specific guidance; temporary failures retain Retry. Dependent member
reads and management controls wait for successful group-set loading.

## Verification boundary

The earlier live reproduction establishes the original stale-link issue.
Current local regression covers grouped assignment/quiz work, separate course
boundaries, empty/error/retry states, unknown kinds, exclusion of historical
activity requests, actual locale switching and refresh persistence, and old-link
recovery. Browser API fixtures are isolated and send no live mutations.
Production release is authorized separately. The release candidate is rebased on
current main and must pass the full repository baseline before merge. Release
revision, artifact verification and authenticated acceptance are recorded with
the deployment evidence; fixture coverage alone is not live acceptance.
