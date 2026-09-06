import i18n from '@/i18n';
import type {NotificationType} from '@/apis';
import {formatUtcTimestamp} from '@/utils/datetime';

const NOTIFICATION_TITLES = new Map<string, string>(Object.entries({
  ANNOUNCEMENT_POSTED: 'notification:types.ANNOUNCEMENT_POSTED',
  ASSIGNMENT_PUBLISHED: 'notification:types.ASSIGNMENT_PUBLISHED',
  ASSIGNMENT_SUBMISSION_RECEIVED: 'notification:types.ASSIGNMENT_SUBMISSION_RECEIVED',
  ASSIGNMENT_GRADE_RELEASED: 'notification:types.ASSIGNMENT_GRADE_RELEASED',
  QUIZ_GRADE_RELEASED: 'notification:types.QUIZ_GRADE_RELEASED',
  ASSIGNMENT_GRADE_CORRECTED: 'notification:types.ASSIGNMENT_GRADE_CORRECTED',
  QUIZ_GRADE_CORRECTED: 'notification:types.QUIZ_GRADE_CORRECTED',
  WEEK_PUBLISHED: 'notification:types.WEEK_PUBLISHED',
  ASSIGNMENT_SCHEDULE_CHANGED: 'notification:types.ASSIGNMENT_SCHEDULE_CHANGED',
  QUIZ_PUBLISHED: 'notification:types.QUIZ_PUBLISHED',
  QUIZ_SCHEDULE_CHANGED: 'notification:types.QUIZ_SCHEDULE_CHANGED',
  QUIZ_TIME_LIMIT_CHANGED: 'notification:types.QUIZ_TIME_LIMIT_CHANGED',
  COURSE_EVENT_CREATED: 'notification:types.COURSE_EVENT_CREATED',
  COURSE_EVENT_UPDATED: 'notification:types.COURSE_EVENT_UPDATED',
  COURSE_EVENT_CANCELLED: 'notification:types.COURSE_EVENT_CANCELLED',
  GROUP_MEMBER_ADDED: 'notification:types.GROUP_MEMBER_ADDED',
  GROUP_MEMBER_REMOVED: 'notification:types.GROUP_MEMBER_REMOVED',
  GROUP_MEMBER_MOVED: 'notification:types.GROUP_MEMBER_MOVED',
  REPORT_PUBLISHED: 'notification:types.REPORT_PUBLISHED',
  ABSENCE_REQUEST_DECIDED: 'notification:types.ABSENCE_REQUEST_DECIDED',
  CHECKPOINT_REACHED_INCOMPLETE: 'notification:types.CHECKPOINT_REACHED_INCOMPLETE',
  SCHEDULE_REQUEST_CREATED: 'notification:types.SCHEDULE_REQUEST_CREATED',
  SCHEDULE_REQUEST_DECIDED: 'notification:types.SCHEDULE_REQUEST_DECIDED',
  SESSION_SCHEDULE_CHANGED: 'notification:types.SESSION_SCHEDULE_CHANGED',
  SESSION_CANCELLED: 'notification:types.SESSION_CANCELLED',
  ATTENDANCE_STATUS_CHANGED: 'notification:types.ATTENDANCE_STATUS_CHANGED',
  COURSE_HOURS_CHANGED: 'notification:types.COURSE_HOURS_CHANGED',
  ADVISOR_TASK_CREATED: 'notification:types.ADVISOR_TASK_CREATED',
  ADVISOR_TASK_STATUS_CHANGED: 'notification:types.ADVISOR_TASK_STATUS_CHANGED',
  ADVISOR_TASK_FEEDBACK_CHANGED: 'notification:types.ADVISOR_TASK_FEEDBACK_CHANGED',
} satisfies Record<NotificationType, string>));

// Parent read responses allow new notification types; keep unknown types readable.
export const getNotificationTitle = (type?: string): string =>
  i18n.t(NOTIFICATION_TITLES.get(type ?? '') ?? 'notification:academicUpdate');

export const formatNotificationTime = (value: string): string => {
  return formatUtcTimestamp(value, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};
