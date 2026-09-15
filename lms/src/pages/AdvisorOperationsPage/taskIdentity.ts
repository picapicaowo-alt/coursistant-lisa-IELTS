import type {AdvisorActionTaskResponse} from '@/apis/types/advising';

const validId = (id?: number): id is number => Number.isSafeInteger(id) && (id ?? 0) > 0;

/** Never connect a reminder to a different student when its two identities disagree. */
export function actionTaskStudentId(task: AdvisorActionTaskResponse): number | undefined {
  const direct = validId(task.studentUserId) ? task.studentUserId : undefined;
  const target = validId(task.target?.studentUserId) ? task.target.studentUserId : undefined;
  return direct && target && direct !== target ? undefined : direct ?? target;
}

export function actionTaskResourceId(task: AdvisorActionTaskResponse): number | undefined {
  const target = task.target;
  const id = target?.resourceType === 'ADVISOR_TASK' ? target.advisorTaskId
    : target?.resourceType === 'STUDY_PLAN_CHECKPOINT' ? target.checkpointId
    : target?.resourceType === 'ASSIGNMENT' ? target.assignmentId
    : target?.resourceType === 'SUBMISSION' ? target.submissionId
    : target?.resourceType === 'SCHEDULE_REQUEST' ? target.requestId
    : target?.resourceType === 'COURSE_REPORT' ? target.reportId
    : target?.resourceType === 'COURSE_HOURS' ? target.courseId
    : target?.resourceType === 'STUDENT' ? actionTaskStudentId(task)
    : undefined;
  return validId(id) ? id : validId(task.sourceId) ? task.sourceId : undefined;
}
