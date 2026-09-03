/** Read projections from docs/api/course.openapi.yaml, supplied 2026-09-03.
 * Optionality follows the consumed schema; do not infer values absent from a record.
 * LocalTime accepts the declared object and the existing ISO time transport. */
export type LocalTime = string | {
  hour?: number;
  minute?: number;
  nano?: number;
  second?: number;
};

export type SessionOccurrenceResponse = {
  attendanceVersion?: number;
  courseId?: number;
  current?: boolean;
  endTime?: LocalTime;
  id?: number;
  instructorFirstName?: string;
  instructorLastName?: string;
  instructorMiddleName?: string;
  instructorUserId?: number;
  lectureId?: number;
  lectureNumber?: number;
  occurrenceDate?: string;
  replacementOccurrenceId?: number;
  rosterOpened?: boolean;
  sessionId?: number;
  startTime?: LocalTime;
  status?: string;
  timezone?: string;
  version?: number;
  weekId?: number;
};

export type StudentWorkQueueItemResponse = {
  alertType?: string;
  assignmentId?: number;
  checkpointId?: number;
  courseId?: number;
  courseTitle?: string;
  deepLink?: string;
  description?: string;
  dueAt?: string;
  actionAtUtc?: string;
  timezone?: string;
  gradeStatus?: string;
  learningType?: string;
  notificationId?: number;
  notificationType?: string;
  occurrenceId?: number;
  read?: boolean;
  releasedScore?: number;
  sessionId?: number;
  sourceType?: string;
  status?: string;
  submissionRequirement?: string;
  submissionStatus?: string;
  taskId?: number;
  taskStatus?: string;
  title?: string;
  urgency?: string;
};

export type StudentScheduleRequestItem = {
  id?: number;
  courseId?: number;
  courseCode?: string;
  courseTitle?: string;
  occurrenceDate?: string;
  startTime?: LocalTime;
  endTime?: LocalTime;
  timezone?: string;
  requestType?: string;
  status?: string;
};

export type InstructorScheduleRequestItem = {
  courseCode?: string;
  courseId?: number;
  courseTitle?: string;
  createdAt?: string;
  id?: number;
  occurrenceDate?: string;
  occurrenceEndTime?: LocalTime;
  occurrenceId?: number;
  occurrenceStartTime?: LocalTime;
  proposedEndTime?: LocalTime;
  proposedOccurrenceDate?: string;
  proposedStartTime?: LocalTime;
  reason?: string;
  rejectionReason?: string;
  replacementOccurrenceId?: number;
  requestType?: string;
  requestedBy?: string;
  status?: string;
  studentFirstName?: string;
  studentLastName?: string;
  studentMiddleName?: string;
  studentUserId?: number;
  timezone?: string;
  updatedAt?: string;
  version?: number;
};

export type CourseStudentReportSummaryResponse = {
  courseCode?: string;
  courseId?: number;
  courseTitle?: string;
  createdAt?: string;
  id?: number;
  publishedAt?: string;
  reportType?: "MID_TERM" | "FINAL";
  status?: "DRAFT" | "PUBLISHED";
  studentFirstName?: string;
  studentLastName?: string;
  studentMiddleName?: string;
  studentUserId?: number;
  title?: string;
  updatedAt?: string;
};
