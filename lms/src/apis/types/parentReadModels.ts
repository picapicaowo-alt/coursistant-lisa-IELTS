/** Read projections from docs/api/parent.openapi.yaml, supplied 2026-09-03.
 * Optionality follows the consumed schema; do not infer values absent from a record.
 * LocalTime accepts the declared object and the existing ISO time transport. */
export type ParentStudentSummary = {
  studentUserId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
};

export type ParentCourseSchedule = {
  courseId?: number;
  type?: string;
  dayOfWeek?: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
  startTime?: string;
  endTime?: string;
  location?: string;
};

export type ParentCourse = {
  courseId: number;
  courseCode?: string;
  title?: string;
  instructorFirstName?: string;
  instructorMiddleName?: string;
  instructorLastName?: string;
  lifecycleStatus?: "DRAFT" | "READY" | "PUBLISHED" | "ONGOING" | "COMPLETED";
  termStartDate?: string;
  termEndDate?: string;
  publishedAssignmentCount?: number;
  submittedAssignmentCount?: number;
  progressPercent?: number;
  schedule?: Array<ParentCourseSchedule>;
};

export type ParentHoursSummary = {
  purchasedMinutes?: number;
  usedMinutes?: number;
  remainingMinutes?: number;
};

export type ParentAttendanceSummary = {
  total?: number;
  present?: number;
  absent?: number;
  excused?: number;
};

export type ParentRequestSummary = {
  pending?: number;
  approved?: number;
  rejected?: number;
};

export type ParentFeedback = {
  assignmentId?: number;
  assignmentTitle?: string;
  score?: number;
  pointsPossible?: number;
  studentVisibleFeedback?: string;
  releasedAt?: string;
};

export type ParentPublishedReport = {
  reportId?: number;
  courseId?: number;
  courseTitle?: string;
  reportType?: "MID_TERM" | "FINAL";
  overallSummary?: string;
  strengths?: string;
  weaknesses?: string;
  skillEvaluation?: string;
  improvementSuggestions?: string;
  publishedAt?: string;
};

export type ParentPublicAlert = {
  code?: string;
  severity?: "ON_TRACK" | "AT_RISK" | "NEEDS_ATTENTION";
};

export type ParentCalendarItem = {
  eventType: "SESSION" | "ASSIGNMENT_DEADLINE";
  sourceId: string;
  startsAtUtc: string;
  endsAtUtc: string;
  timezone: string;
  courseId?: number;
  courseCode?: string;
  courseTitle?: string;
  title?: string;
  weekId?: number;
  lectureId?: number;
  lectureNumber?: number;
  instructorUserId?: number;
  instructorFirstName?: string;
  instructorMiddleName?: string;
  instructorLastName?: string;
  assignmentId?: number;
  occurrenceId?: number;
};

export type ParentPublicRisk = {
  status?: "ON_TRACK" | "AT_RISK" | "NEEDS_ATTENTION";
  reasons?: Array<string>;
};

export type ParentDashboard = {
  student?: ParentStudentSummary;
  currentCourses?: Array<ParentCourse>;
  hours?: ParentHoursSummary;
  attendance?: ParentAttendanceSummary;
  requests?: ParentRequestSummary;
  latestReleasedFeedback?: ParentFeedback;
  latestPublishedReport?: ParentPublishedReport;
  publicAlerts?: Array<ParentPublicAlert>;
  upcomingSchedule?: Array<ParentCalendarItem>;
  risk?: ParentPublicRisk;
};

export type ParentStudentSkill = {
  skillCode?: string;
  displayName?: string;
  scale?: string;
  currentValue?: string;
  targetValue?: string;
  gapSummary?: string;
  position?: number;
};

export type ParentStudentProfile = {
  student?: ParentStudentSummary;
  contactPhone?: string;
  intakeBackground?: string;
  academicBackground?: string;
  priorTestExperience?: string;
  baselineAssessment?: string;
  targetGoal?: string;
  targetMetric?: string;
  targetValue?: string;
  targetDate?: string;
  advisorInterpretation?: string;
  skills?: Array<ParentStudentSkill>;
};

export type ParentStudyPlanTask = {
  taskId?: number;
  checkpointId?: number;
  position?: number;
  title?: string;
  description?: string;
  dueDate?: string;
  submissionRequirement?: string;
  status?: string;
  startedAt?: string;
  completedAt?: string;
  submissionText?: string;
  publicFeedback?: string;
};

export type ParentStudyPlanCheckpoint = {
  checkpointId?: number;
  position?: number;
  description?: string;
  goal?: string;
  dueDate?: string;
  derivedStatus?: "NOT_REACHED" | "REACHED_INCOMPLETE" | "REACHED_COMPLETED";
  tasks?: Array<ParentStudyPlanTask>;
};

export type ParentStudyPlan = {
  strategySummary?: string;
  startDate?: string;
  planEndDate?: string;
  checkpoints?: Array<ParentStudyPlanCheckpoint>;
};

export type ParentAssignment = {
  assignmentId?: number;
  courseId?: number;
  courseTitle?: string;
  title?: string;
  deadline?: string;
  submissionStatus?: "NOT_SUBMITTED" | "SUBMITTED";
  submittedAt?: string;
  releasedScore?: number;
  pointsPossible?: number;
  studentVisibleFeedback?: string;
  gradeReleasedAt?: string;
};

export type ParentCalendarResponse = {
  timezone: string;
  fromUtc: string;
  toUtc: string;
  items: Array<ParentCalendarItem>;
};

export type ParentAttendance = {
  occurrenceId?: number;
  courseId?: number;
  courseTitle?: string;
  occurrenceDate?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
  occurrenceStatus?: string;
  effectiveStatus?: string;
  requestStatus?: string;
};

export type ParentHoursBalance = {
  courseId?: number;
  courseTitle?: string;
  purchasedMinutes?: number;
  usedMinutes?: number;
  remainingMinutes?: number;
};

export type ParentHoursLedger = {
  courseId?: number;
  courseTitle?: string;
  occurrenceId?: number;
  entryType?: string;
  minutes?: number;
  beforeRemainingMinutes?: number;
  afterRemainingMinutes?: number;
  recordedAt?: string;
};

export type ParentHours = {
  purchasedMinutes?: number;
  usedMinutes?: number;
  remainingMinutes?: number;
  courses?: Array<ParentHoursBalance>;
  ledger?: Array<ParentHoursLedger>;
};

export type ParentPublishedReportSummary = {
  reportId?: number;
  studentUserId?: number;
  courseId?: number;
  courseCode?: string;
  courseTitle?: string;
  title?: string;
  reportType?: "MID_TERM" | "FINAL";
  publishedAt?: string;
};

export type ParentPublishedReportPage = {
  items: Array<ParentPublishedReportSummary>;
  page: number;
  size: number;
  total: number;
};

export type ParentPublishedReportDetail = (ParentPublishedReportSummary) & ({
  overallSummary?: string;
  strengths?: string;
  weaknesses?: string;
  skillEvaluation?: string;
  improvementSuggestions?: string;
});

export type ParentScheduleRequestResponse = {
  id?: number;
  courseId?: number;
  occurrenceId?: number;
  studentUserId?: number;
  requestedBy?: string;
  requestType?: "ABSENCE" | "SCHEDULE_CHANGE";
  status?: "PENDING_INSTRUCTOR" | "PENDING_ADVISOR" | "APPROVED" | "REJECTED";
  reason?: string;
  rejectionReason?: string;
  proposedOccurrenceDate?: string;
  proposedStartTime?: string;
  proposedEndTime?: string;
  replacementOccurrenceId?: number;
  createdAt?: string;
  updatedAt?: string;
};
