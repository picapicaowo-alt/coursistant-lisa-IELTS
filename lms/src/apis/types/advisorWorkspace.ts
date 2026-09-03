import type {AdvisorActionTaskResponse, StudentType} from './advising';

export const ADVISOR_PAGE_SIZE = 20;
export const ADVISOR_RISKS = ['ON_TRACK', 'AT_RISK', 'NEEDS_ATTENTION'] as const;
export const ACTION_TASK_TYPES = ['ABSENCE_APPROVAL', 'SCHEDULE_CHANGE_APPROVAL', 'REPORT_REVIEW', 'REPEATED_ABSENCE', 'LOW_ASSIGNMENT_COMPLETION', 'STUDENT_INACTIVITY', 'POOR_PERFORMANCE', 'NEGATIVE_HOURS', 'OVERDUE_STUDENT_ASSIGNMENT', 'DELAYED_GRADING', 'REACHED_INCOMPLETE_CHECKPOINT', 'OVERDUE_STUDY_PLAN_TASK'] as const;
export interface AdvisorStudentFilters {
  q?: string;
  risk?: typeof ADVISOR_RISKS[number];
  studentType?: StudentType;
  activeTaskType?: string;
}
export interface AdvisorInstructor {
  instructorUserId: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  level?: 'INSTRUCTOR' | 'INSTRUCTOR_ADVISOR';
}
export interface AdvisorOwnedCourse {
  courseId: number;
  courseCode?: string;
  title?: string;
  termStartDate?: string;
  termEndDate?: string;
  lifecycleState?: string;
  launchState?: string | null;
  courseLaunchVersion?: number;
  ownerAdvisorUserId?: number;
  ownershipVersion?: number;
  primaryInstructor?: {userId?: number; instructorFirstName?: string; instructorMiddleName?: string; instructorLastName?: string; email?: string};
  catalogCode?: string | null;
  capacity?: number | null;
  activeStudents?: number;
  remainingCapacity?: number | null;
}
export interface AdvisorOwnedCourseFilters {
  q?: string;
  launchState?: 'DRAFT' | 'READY' | 'PUBLISHED';
  lifecycleState?: 'Active' | 'Archived';
  page?: number;
  size?: number;
}
export interface AdvisorConversationSummary {
  studentUserId: number;
  studentFirstName?: string;
  studentMiddleName?: string;
  studentLastName?: string;
  threadId?: number;
  latestPreview?: string;
  latestAt?: string;
  unreadCount?: number;
}
export interface AdvisorStudentHub {
  studentUserId?: number;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  studentType?: string;
  risk?: {studentUserId?: number; status?: string; reasons?: string[]};
  activeTasks?: AdvisorActionTaskResponse[];
  activeCourseCount?: number;
  publishedReportCount?: number;
  pendingRequestCount?: number;
}
export interface AdvisorActionTaskTarget {
  resourceType?: 'SCHEDULE_REQUEST' | 'COURSE_REPORT' | 'STUDENT' | 'COURSE_HOURS' | 'ASSIGNMENT' | 'SUBMISSION' | 'STUDY_PLAN_CHECKPOINT' | 'ADVISOR_TASK';
  studentUserId?: number;
  courseId?: number;
  requestId?: number;
  reportId?: number;
  assignmentId?: number;
  submissionId?: number;
  checkpointId?: number;
  advisorTaskId?: number;
}
