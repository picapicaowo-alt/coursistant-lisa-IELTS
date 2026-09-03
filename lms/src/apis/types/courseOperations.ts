export interface AttendanceEntryRequest {
  status?: string;
  studentUserId?: number;
}

export interface SaveAttendanceRequest {
  entries?: AttendanceEntryRequest[];
  expectedAttendanceVersion?: number;
}

export interface CreateOccurrenceRequest {
  endTime?: string;
  occurrenceDate?: string;
  sessionId?: number;
  startTime?: string;
  weekId?: number;
}

export interface GenerateOccurrencesRequest {
  from?: string;
  to?: string;
  weekId?: number;
}

export interface RescheduleOccurrenceRequest {
  endTime?: string;
  expectedVersion?: number;
  occurrenceDate?: string;
  startTime?: string;
  weekId?: number;
}

export interface ScheduleRequestResponse {
  id?: number;
  courseId?: number;
  occurrenceId?: number;
  studentUserId?: number;
  requestType?: string;
  status?: string;
  reason?: string;
  rejectionReason?: string;
  proposedOccurrenceDate?: string;
  proposedStartTime?: string;
  proposedEndTime?: string;
  version?: number;
}

export interface CreateScheduleRequestRequest {
  proposedEndTime?: string;
  proposedOccurrenceDate?: string;
  proposedStartTime?: string;
  reason?: string;
  requestType?: string;
}

export interface ScheduleRequestDecisionRequest {
  decision?: string;
  expectedVersion?: number;
  rejectionReason?: string;
}

export interface AvailabilityWindowRequest {
  dayOfWeek?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  endTime?: string;
  startTime?: string;
  timezone?: string;
}

export interface AvailabilityExceptionRequest {
  endTime?: string;
  exceptionDate?: string;
  startTime?: string;
  timezone?: string;
}

/** Current instructor availability returned by `/v2/me/teaching/availability`. */
export interface TeachingAvailabilityResponse {
  /** Some backend versions use `availabilityVersion`; reads accept both aliases. */
  availabilityVersion?: number;
  exceptions?: AvailabilityExceptionRequest[];
  version?: number;
  windows?: AvailabilityWindowRequest[];
}

export interface TeachingGradingItemResponse {
  assignmentId: number;
  courseCode?: string;
  courseId: number;
  dueAt?: string;
  gradingDeepLink?: string;
  status?: string;
  studentFirstName?: string;
  studentLastName?: string;
  studentMiddleName?: string;
  studentUserId: number;
  submittedAt?: string;
  title: string;
  urgency?: string;
}

export interface TeachingStudentSupportResponse {
  courseId: number;
  courseTitle?: string;
  deepLink?: string;
  reasons?: string[];
  studentFirstName?: string;
  studentLastName?: string;
  studentMiddleName?: string;
  studentUserId: number;
}

export interface TeachingTodayClassResponse {
  courseCode?: string;
  courseId: number;
  courseTitle?: string;
  date?: string;
  endTime?: string;
  lectureNumber?: number;
  location?: string;
  occurrenceId?: number;
  sessionId?: number;
  startTime?: string;
  status?: string;
  studentCount?: number;
  timezone?: string;
}

export interface ReplaceAvailabilityRequest {
  exceptions?: AvailabilityExceptionRequest[];
  expectedVersion?: number;
  windows?: AvailabilityWindowRequest[];
}

export interface SetPurchasedHoursRequest {
  expectedVersion?: number;
  purchasedMinutes?: number;
  reason?: string;
}

export interface TransferCourseOwnerRequest {
  expectedOwnershipVersion: number;
  ownerAdvisorUserId: number;
  reason: string;
}

export interface CourseOwnershipListParams {
  q?: string;
  ownerAdvisorUserId?: number;
  page?: number;
  size?: number;
}

export interface TenantCourseOwnership {
  courseId: number;
  courseCode: string;
  title: string;
  launchState?: string;
  lifecycleState?: string;
  ownerAdvisorUserId?: number;
  ownerAdvisorFirstName?: string;
  ownerAdvisorMiddleName?: string;
  ownerAdvisorLastName?: string;
  ownershipVersion: number;
}

export interface TenantCourseOwnershipPage {
  items: TenantCourseOwnership[];
  page: number;
  size: number;
  total: number;
}

export interface UpsertCourseStudentReportRequest {
  expectedVersion?: number;
  improvementSuggestions?: string;
  overallSummary?: string;
  reportType?: 'MID_TERM' | 'FINAL';
  skillEvaluation?: string;
  strengths?: string;
  studentUserId?: number;
  weaknesses?: string;
}

export interface PersonalEventRequest {
  endsAtLocal?: string;
  expectedVersion?: number;
  reminderMinutesBefore?: number;
  startsAtLocal?: string;
  timezone?: string;
  title?: string;
}

export type TenantAlertRuleMode = 'SYSTEM_DEFAULT' | 'TENANT_OVERRIDE' | 'DISABLED';

export interface TenantAlertRuleThresholds {
  absenceCount?: number | null;
  absenceWindowDays?: number | null;
  checkpointIncompleteEnabled?: number | null;
  completionMinimumSample?: number | null;
  completionPercentage?: number | null;
  completionWindowDays?: number | null;
  deadlineWindowDays?: number | null;
  gradingDelayDays?: number | null;
  inactivityDays?: number | null;
  negativeHoursEnabled?: number | null;
  overdueTaskEnabled?: number | null;
  performanceMinimumGradedSample?: number | null;
  performancePercentage?: number | null;
}

export interface TenantAlertRuleRequest extends TenantAlertRuleThresholds {
  expectedVersion?: number;
  mode: TenantAlertRuleMode;
}

export interface TenantAlertRuleResponse extends TenantAlertRuleThresholds {
  tenantId: number;
  mode: TenantAlertRuleMode;
  version: number;
  updatedAt?: string;
}

export interface OccurrenceListParams {
  from?: string;
  to?: string;
  includeHistory?: boolean;
}

export interface CourseStudentReportListParams {
  studentUserId?: number;
  reportType?: 'MID_TERM' | 'FINAL';
  status?: string;
  page?: number;
  size?: number;
}

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;
export const SCHEDULE_REQUEST_TYPES = ['ABSENCE', 'SCHEDULE_CHANGE'] as const;
export const SCHEDULE_DECISIONS = ['APPROVE', 'REJECT'] as const;
export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

export type CourseOperationRead = unknown;
