import type {NotificationType} from '@/apis';
import {formatUtcTimestamp} from '@/utils/datetime';

const NOTIFICATION_TITLES = new Map<string, string>(Object.entries({
  ANNOUNCEMENT_POSTED: 'New announcement',
  ASSIGNMENT_PUBLISHED: 'Assignment published',
  ASSIGNMENT_SUBMISSION_RECEIVED: 'Submission received',
  ASSIGNMENT_GRADE_RELEASED: 'Grade released',
  QUIZ_GRADE_RELEASED: 'Quiz grade released',
  ASSIGNMENT_GRADE_CORRECTED: 'Assignment grade updated',
  QUIZ_GRADE_CORRECTED: 'Quiz grade updated',
  WEEK_PUBLISHED: 'Course week published',
  ASSIGNMENT_SCHEDULE_CHANGED: 'Assignment schedule changed',
  QUIZ_PUBLISHED: 'Quiz published',
  QUIZ_SCHEDULE_CHANGED: 'Quiz schedule changed',
  QUIZ_TIME_LIMIT_CHANGED: 'Quiz time limit changed',
  COURSE_EVENT_CREATED: 'New course event',
  COURSE_EVENT_UPDATED: 'Course event updated',
  COURSE_EVENT_CANCELLED: 'Course event cancelled',
  GROUP_MEMBER_ADDED: 'Group member added',
  GROUP_MEMBER_REMOVED: 'Group member removed',
  GROUP_MEMBER_MOVED: 'Group membership updated',
  REPORT_PUBLISHED: 'Student report published',
  ABSENCE_REQUEST_DECIDED: 'Absence request decided',
  CHECKPOINT_REACHED_INCOMPLETE: 'Checkpoint needs attention',
  SCHEDULE_REQUEST_CREATED: 'Schedule request created',
  SCHEDULE_REQUEST_DECIDED: 'Schedule request decided',
  SESSION_SCHEDULE_CHANGED: 'Session schedule changed',
  SESSION_CANCELLED: 'Session cancelled',
  ATTENDANCE_STATUS_CHANGED: 'Attendance updated',
  COURSE_HOURS_CHANGED: 'Course hours updated',
  ADVISOR_TASK_CREATED: 'Advisor task created',
  ADVISOR_TASK_STATUS_CHANGED: 'Advisor task status changed',
  ADVISOR_TASK_FEEDBACK_CHANGED: 'Advisor task feedback updated',
} satisfies Record<NotificationType, string>));

// Parent read responses allow new notification types; keep unknown types readable.
export const getNotificationTitle = (type?: string): string =>
  NOTIFICATION_TITLES.get(type ?? '') ?? 'Academic update';

export const formatNotificationTime = (value: string): string => {
  return formatUtcTimestamp(value, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};
