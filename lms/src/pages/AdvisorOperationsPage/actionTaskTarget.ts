import type {AdvisorActionTaskTarget} from '@/apis/types/advisorWorkspace';

const validId = (id?: number): id is number => Number.isSafeInteger(id) && (id ?? 0) > 0;

/** Navigate only from the typed target. Opaque sourceReference is never executable routing data. */
export function actionTaskTargetPath(target?: AdvisorActionTaskTarget | null): string | null {
  if (!target || !validId(target.studentUserId)) return null;
  const root = `/advisor/students/${target.studentUserId}`;
  const params = new URLSearchParams();
  if (validId(target.courseId)) params.set('courseId', String(target.courseId));
  switch (target.resourceType) {
    case 'SCHEDULE_REQUEST':
      return validId(target.requestId) ? `/advisor/operations?studentUserId=${target.studentUserId}&requestId=${target.requestId}#schedule-requests` : null;
    case 'COURSE_REPORT':
      if (!validId(target.courseId) || !validId(target.reportId)) return null;
      params.set('reportId', String(target.reportId));
      return `${root}/support?${params}#course-support`;
    case 'COURSE_HOURS':
      return validId(target.courseId) ? `${root}/support?${params}#course-support` : null;
    case 'STUDY_PLAN_CHECKPOINT':
      return validId(target.checkpointId) ? `${root}/study-plan?checkpointId=${target.checkpointId}` : null;
    case 'ADVISOR_TASK':
      return validId(target.advisorTaskId) ? `${root}/study-plan?advisorTaskId=${target.advisorTaskId}` : null;
    case 'STUDENT':
    case 'ASSIGNMENT':
    case 'SUBMISSION':
      // Advisor support is the authorized surface; teaching grading is instructor-only.
      return `${root}/support${params.size ? `?${params}` : ''}`;
    default:
      return null;
  }
}
