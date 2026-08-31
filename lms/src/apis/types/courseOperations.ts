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
  expectedOwnershipVersion?: number;
  ownerAdvisorUserId?: number;
  reason?: string;
}

export interface CourseOwnershipListParams {
  q?: string;
  ownerAdvisorUserId?: number;
  page?: number;
  size?: number;
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

export interface TenantAlertRuleRequest {
  absenceCount?: number;
  absenceWindowDays?: number;
  checkpointIncompleteEnabled?: number;
  completionMinimumSample?: number;
  completionPercentage?: number;
  completionWindowDays?: number;
  deadlineWindowDays?: number;
  expectedVersion?: number;
  gradingDelayDays?: number;
  inactivityDays?: number;
  mode?: string;
  negativeHoursEnabled?: number;
  overdueTaskEnabled?: number;
  performanceMinimumGradedSample?: number;
  performancePercentage?: number;
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
export const SCHEDULE_REQUEST_TYPES = ['RESCHEDULE', 'CANCEL'] as const;
export const SCHEDULE_DECISIONS = ['APPROVE', 'REJECT'] as const;
export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;

export type CourseOperationRead = unknown;
