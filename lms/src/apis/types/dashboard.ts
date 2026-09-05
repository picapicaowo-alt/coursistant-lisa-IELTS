// Dashboard API types — see docs/api/dashboard_module-api_en.md
//
// The dashboard has no aggregate endpoint. Each region is an independent
// request (4 for students, 5 for teaching staff) and a failure in one region
// must not fail the page. Never render a failed request as an empty state:
// the API contract and PRD PRIN-03 both forbid showing a false "nothing here".
//
// Timezone: this module never sends X-Timezone. Every wall-clock field
// (`*Local`, `atLocal`, activity `date`) is already in the IANA zone of the
// user's tenant, and each item carries that zone in `timezone`. Per INV-06 the
// UI must render the user's local time together with a timezone label, so keep
// `timezone` attached to the value rather than dropping it at the boundary.

// ---------------------------------------------------------------- Shared

/** Enrollment role within a course. Distinct from the global user `level`. */
export type CourseRole = 'Student' | 'TA' | 'Instructor';

export type CourseState = 'Active' | 'Archived';

/** Session occurrence (`Lecture` / `Lab` / `Tutorial`) plus course events. */
export type ActivitySource = 'Session' | 'Event' | 'CourseEvent';

export interface UpcomingActivity {
  courseId: number;
  courseCode: string;
  /** `Lecture` / `Lab` / `Tutorial`, or `CourseEvent` for events. */
  type: string;
  /** Session title is its `type`; event title is the event name. */
  title: string;
  /** Tenant-local calendar date, `YYYY-MM-DD`. */
  date: string;
  startTime: string;
  endTime: string;
  /** Standard time fields */
  startsAtLocal?: string;
  endsAtLocal?: string;
  startsAtUtc?: string;
  endsAtUtc?: string;
  location: string | null;
  source: ActivitySource;
  sourceId: number;
  timezone: string;
}

// ---------------------------------------------------------------- Student

export interface PrimaryInstructor {
  instructorFirstName?: string | null;
  instructorMiddleName?: string | null;
  instructorLastName?: string | null;
  userId: number;
  name?: string;
  email?: string;
}

/**
 * A course from `/v2/me/courses`.
 *
 * The payload ships aliased pairs (`id`/`courseId`, `title`/`name`,
 * `state`/`status`, `courseRole`/`role`) that always carry the same value.
 * Prefer the first of each pair; the aliases are typed so responses still
 * parse if the backend drops one.
 */
export interface MyCourse {
  launchState?: string | null;
  lifecycleStatus?: string | null;
  completedAt?: string | null;
  lectureTotal?: number | null;
  lectureCompleted?: number | null;
  id: number;
  courseId: number;
  courseCode: string;
  title: string;
  name: string;
  description: string | null;
  tenantId: number;
  state: CourseState;
  status: CourseState;
  /** Explicit inactive enrollment denies course access; legacy omissions defer to the API. */
  active?: boolean;
  courseRole: CourseRole;
  role: CourseRole;
  /** Set only when `courseRole=TA`; `null` for Student and Instructor. */
  canGrade: boolean | null;
  canPostAnnouncements: boolean | null;
  canManageGroups: boolean | null;
  /** PRD TA content toggle. Optional until the backend contract is aligned. */
  canManageContent?: boolean | null;
  canManageCourseEvents: boolean | null;
  /** May carry only `userId` when the user row is missing. */
  primaryInstructor: PrimaryInstructor | null;
  /** `LocalDateTime` with no trailing `Z`. */
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

/** `/v2/me/courses` returns a page object, not a bare array. */
export interface MyCoursePageResponse {
  items: MyCourse[];
  page: number;
  size: number;
  total: number;
}

export interface MyCoursesParams {
  courseView?: 'CURRENT' | 'COMPLETED';
  state?: CourseState;
  /** Negative values are treated as 0. */
  page?: number;
  /** `< 1` becomes 20; `> 100` is clamped to 100. */
  size?: number;
}

export type SubmissionStatus =
  | 'NotSubmitted'
  | 'Submitted'
  | 'SubmittedLate'
  | 'NotSubmittedClosed';

/**
 * An entry from `/v2/me/assignments/upcoming`.
 *
 * The window is filtered on UTC `[now, now+days]` — not tenant calendar days,
 * unlike activities. Submitted-but-not-yet-due rows are included.
 */
export interface UpcomingDeadline {
  courseId: number;
  courseCode: string;
  assignmentId: number;
  title: string;
  /** UTC instant, with trailing `Z`. */
  dueAtUtc: string;
  /** Same instant as tenant wall-clock time, no offset. Display only. */
  dueAtLocal: string;
  timezone: string;
  submissionStatus: SubmissionStatus;
}

export interface RecentAnnouncement {
  courseId: number;
  id: number;
  courseCode: string;
  title: string;
  postedAt: string;
  unread: boolean;
}

// ---------------------------------------------------------------- Teaching

/** A course from `/v2/me/teaching/courses`. Far thinner than `MyCourse`. */
export interface TeachingCourse {
  id: number;
  courseCode: string;
  title: string;
  /** Always `Instructor` for this endpoint. */
  role: 'Instructor';
}

export type GradingQueueKind =
  | 'AssignmentUngraded'
  | 'QuizManualPending'
  | 'AssignmentAwaitingRelease'
  | 'QuizAwaitingRelease';

/** Items with `pendingCount=0` are omitted by the server. */
export interface GradingQueueItem {
  kind: GradingQueueKind;
  courseId: number;
  courseCode: string;
  title: string;
  pendingCount: number;
  oldestWaitingAt: string;
  waitingMinutes: number;
  timezone: string;
  assignmentId: number | null;
  quizId: number | null;
}

export type TeachingDeadlineKind = 'Assignment' | 'Quiz';

/**
 * An entry from `/v2/me/teaching/deadlines/upcoming`. Published items only.
 *
 * `submittedCount` / `totalStudents` count *eligible* students: active, course
 * role Student, and not submit-frozen. For group assignments every member of a
 * group that submitted is counted, which differs from the roster's group count.
 */
export interface TeachingDeadline {
  kind: TeachingDeadlineKind;
  courseId: number;
  courseCode: string;
  title: string;
  /** Assignment `due_at` or quiz `closes_at` as tenant wall-clock. */
  atLocal: string;
  timezone: string;
  submittedCount: number;
  totalStudents: number;
  assignmentId: number | null;
  quizId: number | null;
}

export type RecentActivityKind = 'GroupMembershipChange' | 'LateSubmission';

export interface RecentActivityItem {
  kind: RecentActivityKind;
  courseId: number;
  courseCode: string;
  /**
   * Server-formatted text, not a localizable key.
   * `GroupMembershipChange` looks like `"JOINED user=385"`;
   * `LateSubmission` looks like `"Late submission: Homework 1"`.
   */
  summary: string;
  occurredAt: string;
  timezone: string;
  assignmentId: number | null;
  groupSetId: number | null;
  groupId: number | null;
  targetUserId: number | null;
}
