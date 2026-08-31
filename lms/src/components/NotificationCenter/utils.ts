import type {NotificationItem, NotificationType} from '@/apis';
import {formatUtcTimestamp} from '@/utils/datetime';

const NOTIFICATION_TITLES: Record<NotificationType, string> = {
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
};

export const getNotificationTitle = (type: NotificationType) => NOTIFICATION_TITLES[type];

/**
 * Resolves backend deep links against routes that exist in this frontend.
 *
 * The notification contract currently uses plural `/courses/...` examples,
 * while the application route is singular `/course/...`. Unknown subject
 * routes fall back to the owning course instead of opening a broken page. An
 * absolute or protocol-relative value is never followed.
 */
export const resolveNotificationPath = (
  notification: Pick<NotificationItem, 'availability' | 'courseId' | 'deepLink'> & {
    notificationType?: NotificationType;
  }
): string | null => {
  if (notification.availability !== 'AVAILABLE') return null;

  if (notification.notificationType === 'COURSE_EVENT_CANCELLED') {
    return notification.courseId ? `/course/${notification.courseId}/events` : null;
  }

  const deepLink = notification.deepLink?.trim();
  if (deepLink?.startsWith('/') && !deepLink.startsWith('//')) {
    const pluralEventsList = deepLink.match(/^\/courses\/(\d+)\/events\/?$/);
    if (pluralEventsList) {
      return `/course/${pluralEventsList[1]}/events`;
    }

    const pluralSubmission = deepLink.match(
      /^\/courses\/(\d+)\/assignments\/(\d+)\/submissions\/(\d+)\/?$/,
    );
    if (pluralSubmission) {
      const [, courseId, assignmentId, submissionId] = pluralSubmission;
      return `/course/${courseId}/assignments/${assignmentId}/submissions/${submissionId}`;
    }

    const pluralSubject = deepLink.match(
      /^\/courses\/(\d+)\/(assignments|quizzes|announcements|events|weeks|groups|group-sets)\/(\d+)(?:\/my-grade)?\/?$/,
    );
    if (pluralSubject) {
      const [, courseId, rawKind, subjectId] = pluralSubject;
      const kind = rawKind === 'groups' ? 'group-sets' : rawKind;
      return `/course/${courseId}/${kind}/${subjectId}`;
    }

    const singularSubmission = deepLink.match(
      /^(\/course\/\d+\/assignments\/\d+\/submissions\/\d+)\/?$/,
    );
    if (singularSubmission) return singularSubmission[1];

    const singularGrades = deepLink.match(/^(\/course\/\d+\/grades)\/?$/);
    if (singularGrades) return singularGrades[1];

    const singularSubject = deepLink.match(
      /^(\/course\/\d+(?:\/(?:assignments|quizzes|announcements|events|weeks|group-sets)\/\d+)?)(?:\/my-grade)?\/?$/,
    );
    if (singularSubject) return singularSubject[1];

    const pluralCourse = deepLink.match(/^\/courses\/(\d+)(?:\/.*)?$/);
    if (pluralCourse) return `/course/${pluralCourse[1]}`;
  }

  return notification.courseId ? `/course/${notification.courseId}` : null;
};

export const formatNotificationTime = (value: string): string => {
  return formatUtcTimestamp(value, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
};
