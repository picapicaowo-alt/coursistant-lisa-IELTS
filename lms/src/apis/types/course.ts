import type {CourseRole, PrimaryInstructor} from './dashboard';
import type {UserLevel} from './login';

/**
 * An entry from `GET /v2/courses` — see docs/api/course_module-api_en.md 5.1.
 *
 * This is the browse listing for admins and instructors, not a personal one:
 * a plain Student or TA calling it gets 403 ACCESS_DENIED. Anything showing
 * "my courses" must use `GET /v2/me/courses` instead.
 */
export interface CourseSummary {
  id: number;
  /** Same value as `id`. */
  courseId: number;
  tenantId: number;
  courseCode: string;
  title: string;
  state: 'Active' | 'Archived';
  instructorId: number | null;
  primaryInstructor: PrimaryInstructor | null;
}

/** `GET /v2/courses` returns this page object, not a bare array. */
export interface CoursePageResponse {
  items: CourseSummary[];
  page: number;
  size: number;
  total: number;
}

/**
 * A single course — `GET /v2/courses/{id}`.
 *
 * Identity and lifecycle only. Weeks, materials, assignments and members each
 * live on their own endpoint; there is no aggregate that returns a course with
 * its contents.
 *
 * Several fields are aliased pairs carrying the same value (`id`/`courseId`,
 * `title`/`name`, `state`/`status`). Prefer the first of each.
 */
export interface CourseResponse {
  id: number;
  courseId: number;
  tenantId: number;
  courseCode: string;
  title: string;
  name: string;
  termStartDate: string;
  termEndDate: string;
  description: string | null;
  location: string | null;
  instructorId: number | null;
  primaryInstructor: PrimaryInstructor | null;
  state: 'Active' | 'Archived';
  status: 'Active' | 'Archived';
  archivedAt: string | null;
  /** How long staff can still grade after archiving. */
  gradingGraceEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MaterialType = 'FILE' | 'LINK';

/** A file or link inside a week. */
export interface CourseMaterial {
  id: number;
  weekId: number;
  courseId: number;
  materialType: MaterialType;
  displayName: string;
  createdAt?: string;
  teachingType?: 'DOCUMENT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'ARCHIVE' | 'LINK';
  /** Zero-based, ascending. */
  orderPosition: number;
  originalFilename: string | null;
  contentType: string | null;
  extension: string | null;
  sizeBytes: number | null;
  linkUrl: string | null;
  uploadedBy: number;
  previewAvailable: boolean;
  /** Same-origin API path. For a LINK this may redirect off-site. */
  downloadUrl: string;
  previewUrl?: string | null;
  publicationState?: 'DRAFT' | 'PUBLISHED' | string;
  effectiveStudentVisible?: boolean;
  checksumSha256?: string | null;
}

/**
 * A week of course content — `GET /v2/courses/{courseId}/weeks`.
 *
 * Materials are embedded, so listing weeks is enough to render the outline.
 * Students only ever receive `Published` weeks; drafts are staff-only.
 */
export interface CourseWeek {
  id: number;
  courseId: number;
  title: string;
  /** Optional on older read projections; never substitute generated overview text. */
  summary?: string | null;
  lectureId?: number;
  lectureNumber?: number;
  /** Zero-based, ascending. */
  orderPosition: number;
  state: 'Draft' | 'Published';
  publicationState?: 'DRAFT' | 'PUBLISHED' | string;
  materials: CourseMaterial[];
  createdAt: string;
  updatedAt: string;
}

/** CreateWeekRequest / RenameWeekRequest in the consumed course contract. */
export interface CourseWeekPayload {
  title?: string;
  summary?: string;
}

export interface CourseAnnouncement {
  id: number;
  courseId: number;
  title: string;
  body: string;
  authorUserId: number;
  authorName: string;
  postedAt: string;
  editedAt: string | null;
  read: boolean;
}

export interface CourseAnnouncementSummary {
  id: number;
  courseId: number;
  courseCode: string;
  title: string;
  authorUserId: number;
  authorName: string;
  postedAt: string;
  editedAt: string | null;
  read: boolean;
}

export interface CourseAnnouncementPayload {
  title: string;
  body: string;
}

export interface CourseEvent {
  id: number;
  courseId: number;
  name: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  timezone: string;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseEventPayload {
  name: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  expectedVersion?: number;
}

export interface CourseGroupMembership {
  groupId: number;
  userId: number;
  displayName: string | null;
  joinedAt: string;
  addedByType: string;
  addedByUserId: number | null;
}

export interface CourseGroup {
  id: number;
  groupSetId: number;
  name: string;
  capacity: number | null;
  capacityOverride: number | null;
  memberCount: number;
  members: CourseGroupMembership[];
}

export interface CourseGroupSet {
  id: number;
  courseId: number;
  name: string;
  defaultCapacity: number | null;
  joinOpensAtLocal: string | null;
  joinClosesAtLocal: string | null;
  timezone: string;
  locked: boolean;
  openForSelfService: boolean;
  capacityShortenWarning?: boolean;
  windowShortenWarning?: boolean;
  myGroup: CourseGroupMembership | null;
  groups: CourseGroup[];
}

export interface CreateGroupSetPayload {
  name: string;
  defaultCapacity?: number | null;
  joinOpensAt?: string | null;
  joinClosesAt?: string | null;
  locked?: boolean;
}

export interface PatchGroupSetPayload extends Partial<CreateGroupSetPayload> {
  clearJoinOpensAt?: boolean;
  clearJoinClosesAt?: boolean;
  confirmCapacityShorten?: boolean;
  confirmWindowShorten?: boolean;
}

export interface CourseMember {
  id: number;
  courseId: number;
  userId: number;
  userFirstName?: string | null;
  userMiddleName?: string | null;
  userLastName?: string | null;
  /** Display-only fallback for member responses from before structured names. */
  userName?: string | null;
  userEmail: string | null;
  courseRole: CourseRole;
  canGrade?: boolean;
  canPostAnnouncements?: boolean;
  canManageGroups?: boolean;
  canManageCourseEvents?: boolean;
  active: boolean;
  assignmentSubmitFrozen?: boolean;
  level?: UserLevel;
  enrolledAt?: string;
  joinedAt?: string | null;
  withdrawnAt?: string | null;
}

export interface CourseMemberPage {
  items: CourseMember[];
  page: number;
  size: number;
  total: number;
}

export interface MemberQueryParams {
  courseRole?: CourseRole;
  active?: boolean;
  q?: string;
  page?: number;
  size?: number;
}

export interface TaPermissions {
  canGrade?: boolean;
  canPostAnnouncements?: boolean;
  canManageGroups?: boolean;
  canManageCourseEvents?: boolean;
}

export interface BatchEnrollItem {
  userId: number | null;
  status: 'SUCCESS' | 'ERROR';
  errorType: string | null;
  message: string | null;
  member: CourseMember | null;
}

export interface BatchStudentEnrollResponse {
  requestedCount: number;
  successCount: number;
  failureCount: number;
  items: BatchEnrollItem[];
}

export type SyllabusState =
  | {posted: false}
  | {
      posted: true;
      versionId: number;
      originalFilename: string;
      contentType: string;
      sizeBytes: number;
      uploadedBy: number;
      uploadedAt: string;
      canRestorePrevious?: boolean;
    };

export interface UngroupedStudent {
  userId: number;
  displayName: string | null;
}

/** Day codes used by sessions. */
export type SessionDayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export type SessionType = 'Lecture' | 'Lab' | 'Tutorial';

/**
 * A recurring weekly class slot — `GET /v2/courses/{courseId}/sessions`.
 *
 * Recurring, so it has a day of week and no date. One-off items such as an
 * exam are Events, on a separate endpoint. Times are in the course tenant's
 * zone, which each item carries.
 */
export interface CourseSession {
  id: number;
  courseId: number;
  type: SessionType;
  dayOfWeek: SessionDayOfWeek;
  /** `HH:mm:ss`. */
  startTime: string;
  endTime: string;
  location: string | null;
  timezone: string;
}

export interface CourseSessionPayload {
  type: SessionType;
  dayOfWeek: SessionDayOfWeek;
  startTime: string;
  endTime: string;
  location?: string | null;
}

export interface CourseBrowseParams {
  /** Free-text search. */
  q?: string;
  state?: 'Active' | 'Archived';
  /** SYSTEM_ADMIN only; ignored for other callers. */
  tenantId?: number;
  page?: number;
  /** Default 20, capped at 100. */
  size?: number;
}

/**
 * The course as the workspace store holds it.
 *
 * Optional fields have no source in the current API. `school`, `semester` and
 * `teacherPhone` came from the previous backend and nothing returns them now;
 * a course instead carries term dates and a location, which is what
 * `/v2/courses/{id}` actually provides. They stay optional rather than being
 * filled with empty strings, so a screen can tell "not provided" from "blank".
 */
export interface CourseInfo {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  courseCode: string;
  name: string;
  description: string;
  termStartDate?: string;
  termEndDate?: string;
  location?: string | null;
  teacherName?: string;
  teacherEmail?: string;
  school?: string;
  semester?: string;
  teacherPhone?: string;
}

export interface CourseUnit {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  sortOrder: number;
  title: string;
  description: string;
}

export interface AssignmentPreview {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  courseUnitId: number;
  title: string;
  type: string;
  dueTime: Date;
}

export interface CourseDetailDTO {
  courseInfo: CourseInfo;
  courseUnits: CourseUnit[];
  assignments: AssignmentPreview[];
}

export interface CreateCourseRequest {
  courseCode: string;
  title: string;
  termStartDate: string;
  termEndDate: string;
  description?: string;
  location?: string;
  primaryInstructorUserId?: number;
  tenantId?: number;
}

export interface CreateCourseUnitRequest {
  sortOrder: number;
  title: string;
  description: string;
}

export interface CreateAssignmentRequest {
  title: string;
  type: string;
  dueTime: string;
}

export interface CourseUpdate {
  courseCode?: string;
  name?: string;
  description?: string;
  school?: string;
  semester?: string;
}

export interface CourseUnitUpdate {
  sortOrder?: number;
  title?: string;
  description?: string;
}

export interface AssignmentUpdate {
  title?: string;
  description?: string;
  type?: string;
  dueTime?: Date;
  settings?: {
    allowLateSubmission: boolean;
    allowedResubmissionCount: number;
  };
}

/**
 * Body of `PATCH /v2/courses/{id}`. Partial — send only what changed.
 *
 * The previous shape bundled the course, its units and its assignments into
 * one call. There is no such endpoint: weeks and assignments are edited
 * through their own routes, so this covers the course record alone.
 *
 * `tenantId`, `primaryInstructorUserId` and `instructorId` are rejected here.
 * Reassigning the primary instructor is an admin-only call of its own.
 */
export interface UpdateCourseRequest {
  courseCode?: string;
  title?: string;
  termStartDate?: string;
  termEndDate?: string;
  description?: string;
  location?: string;
  /** Clears the field, as sending an empty string would not. */
  clearDescription?: boolean;
  clearLocation?: boolean;
}
