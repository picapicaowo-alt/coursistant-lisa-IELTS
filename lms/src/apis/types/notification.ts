/** Notification module — `GET/PATCH /v2/me/notifications*`. */
export type NotificationAvailability = 'AVAILABLE' | 'NO_LONGER_AVAILABLE';

export type NotificationType =
  | 'ANNOUNCEMENT_POSTED'
  | 'ASSIGNMENT_PUBLISHED'
  | 'ASSIGNMENT_SUBMISSION_RECEIVED'
  | 'ASSIGNMENT_GRADE_RELEASED'
  | 'QUIZ_GRADE_RELEASED'
  | 'ASSIGNMENT_GRADE_CORRECTED'
  | 'QUIZ_GRADE_CORRECTED'
  | 'WEEK_PUBLISHED'
  | 'ASSIGNMENT_SCHEDULE_CHANGED'
  | 'QUIZ_PUBLISHED'
  | 'QUIZ_SCHEDULE_CHANGED'
  | 'QUIZ_TIME_LIMIT_CHANGED'
  | 'COURSE_EVENT_CREATED'
  | 'COURSE_EVENT_UPDATED'
  | 'COURSE_EVENT_CANCELLED'
  | 'GROUP_MEMBER_ADDED'
  | 'GROUP_MEMBER_REMOVED'
  | 'GROUP_MEMBER_MOVED'
  | 'REPORT_PUBLISHED'
  | 'ABSENCE_REQUEST_DECIDED'
  | 'CHECKPOINT_REACHED_INCOMPLETE'
  | 'SCHEDULE_REQUEST_CREATED'
  | 'SCHEDULE_REQUEST_DECIDED'
  | 'SESSION_SCHEDULE_CHANGED'
  | 'SESSION_CANCELLED'
  | 'ATTENDANCE_STATUS_CHANGED'
  | 'COURSE_HOURS_CHANGED'
  | 'ADVISOR_TASK_CREATED'
  | 'ADVISOR_TASK_STATUS_CHANGED'
  | 'ADVISOR_TASK_FEEDBACK_CHANGED';

export type NotificationSubjectType =
  | 'ANNOUNCEMENT'
  | 'ASSIGNMENT'
  | 'QUIZ'
  | 'ASSIGNMENT_GRADE'
  | 'QUIZ_GRADE'
  | 'ASSIGNMENT_SUBMISSION'
  | 'WEEK'
  | 'COURSE_EVENT'
  | 'GROUP_SET'
  | 'COURSE_REPORT'
  | 'SCHEDULE_REQUEST'
  | 'STUDY_PLAN_CHECKPOINT'
  | 'SESSION_OCCURRENCE'
  | 'COURSE_HOURS'
  | 'ADVISOR_TASK';

export interface NotificationItem {
  notificationId: number;
  tenantId: number;
  recipientUserId: number;
  courseId?: number | null;
  courseCode?: string | null;
  notificationType: NotificationType;
  message: string;
  subjectType?: NotificationSubjectType | null;
  subjectId?: number | null;
  /** Frontend path supplied by the API, never an absolute URL. */
  deepLink?: string | null;
  /** UTC instant. */
  createdAt: string;
  /** Null means unread. */
  readAt?: string | null;
  availability: NotificationAvailability;
}

export interface NotificationPage {
  items: NotificationItem[];
  page: number;
  size: number;
  total: number;
}

export interface NotificationPageParams {
  page?: number;
  size?: number;
}

export interface UnreadNotificationCount {
  unreadCount: number;
}
