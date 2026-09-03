import type {LoginResponse, NotificationItem, NotificationType} from '@/apis';
import {registeredDestination} from '@/utils/registeredDestination';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';

export {getNotificationTitle, formatNotificationTime} from '@/utils/notificationPresentation';

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
  },
  identity?: Pick<LoginResponse, 'role' | 'level'>,
): string | null => {
  if (notification.availability !== 'AVAILABLE') return null;

  const registered = registeredDestination(notification.deepLink);
  if (identity?.level === 'PARENT') return APP_ROUTE_PATHS.parent;
  if (identity?.role === 'TENANT_ADMIN') return APP_ROUTE_PATHS.admin;
  if (identity?.level === 'COUNSELLOR') return APP_ROUTE_PATHS.counsellor;
  if (identity?.level === 'ADVISOR' || identity?.level === 'INSTRUCTOR_ADVISOR') {
    if (registered?.startsWith('/advisor/')) return registered;
    if (identity.level === 'ADVISOR') return APP_ROUTE_PATHS.advisorOperations;
  }
  if (identity?.level === 'STUDENT') {
    if (notification.notificationType?.startsWith('ADVISOR_TASK_') || notification.notificationType === 'CHECKPOINT_REACHED_INCOMPLETE') return APP_ROUTE_PATHS.myPlan;
    if (['REPORT_PUBLISHED', 'COURSE_HOURS_CHANGED', 'ATTENDANCE_STATUS_CHANGED', 'SCHEDULE_REQUEST_DECIDED', 'ABSENCE_REQUEST_DECIDED'].includes(notification.notificationType ?? '')) return APP_ROUTE_PATHS.myOperations;
  }

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
