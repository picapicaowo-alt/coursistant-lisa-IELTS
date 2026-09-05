import {generatePath} from 'react-router-dom';
import type {StudentProgressResponse} from '@/apis';
import {APP_ROUTE_PATHS, STUDY_PLAN_QUERY_PARAMS} from '@/configs/routePaths';
import {record, recordPage, optionalNumber, textValue, type OperationRecord} from '@/utils/operationRecords';
import {calendarLocalFields} from '@/utils/datetime';

export const LEARNING_PREVIEW_SIZE = 3;
export const LEARNING_PAGE_SIZE = 10;
export type LearningDetail = 'attendance' | 'work' | 'requests' | 'alerts' | 'course' | 'reports';
export const DETAIL_LABEL_KEYS: Record<LearningDetail, string> = {alerts: 'dashboard:alerts', attendance: 'operations:tabs.attendance', work: 'learning:overview.work', requests: 'operations:scheduleRequests', course: 'learning:parent.courseDetails', reports: 'learning:reports.title'};

/** Schedule proposals use the course timezone, even when the feed uses UTC instants. */
export function scheduleOccurrence(item: OperationRecord): OperationRecord {
  const startsAtUtc = textValue(item, 'startsAtUtc');
  const timezone = textValue(item, 'timezone');
  const local = startsAtUtc && timezone ? calendarLocalFields(startsAtUtc, textValue(item, 'endsAtUtc'), timezone) : undefined;
  return local ? {...item, ...local, occurrenceDate: local.date} : item;
}

export function assignmentSummary(progress?: StudentProgressResponse, courseId?: number) {
  const source = courseId ? progress?.courses?.find(item => item.courseId === courseId) : progress;
  const completed = source?.completedAssignmentCount;
  const total = source?.totalAssignmentCount;
  const valid = completed != null && total != null && Number.isInteger(completed) && Number.isInteger(total) && completed >= 0 && total > 0 && completed <= total;
  return {completed, total, percent: valid ? Math.round(completed / total * 100) : null};
}

export function attendanceData(value: unknown) {
  const root = Array.isArray(value) ? undefined : record(value);
  return {
    items: recordPage(value).items,
    present: root ? optionalNumber(root, 'presentCount') : undefined,
    absent: root ? optionalNumber(root, 'absentCount') : undefined,
    approved: root ? optionalNumber(root, 'approvedAbsenceCount') : undefined,
  };
}

/** Date-only deadlines retain the student's calendar date. */
export function learningDate(value?: string) {
  return value ? formatDateValue(value, {hour: undefined, minute: undefined}) : i18n.t('learning:overview.noDate');
}

export function courseRecords(items: OperationRecord[] | undefined, courseId?: number) {
  return (items ?? []).filter(item => !courseId || optionalNumber(item, 'courseId') === courseId);
}

/** Only emit known local destinations backed by the record's explicit identity. */
export function learningWorkDestination(item: OperationRecord) {
  const courseId = optionalNumber(item, 'courseId');
  const assignmentId = optionalNumber(item, 'assignmentId');
  if (courseId && assignmentId) return generatePath(APP_ROUTE_PATHS.courseCourseIdAssignmentsAssignmentId, {courseId: String(courseId), assignmentId: String(assignmentId)});
  const checkpointId = optionalNumber(item, 'checkpointId');
  if (checkpointId) {
    const params = new URLSearchParams({[STUDY_PLAN_QUERY_PARAMS.checkpoint]: String(checkpointId)});
    const taskId = optionalNumber(item, 'taskId');
    if (taskId) params.set(STUDY_PLAN_QUERY_PARAMS.task, String(taskId));
    return `${APP_ROUTE_PATHS.myPlan}?${params}`;
  }
  const deepLink = textValue(item, 'deepLink');
  if (deepLink && /^\/(?:course\/\d+(?:\/[^\s\\]*)?|my-plan(?:\?[^\s\\]*)?|calendar(?:\?[^\s\\]*)?|mock-exams(?:\/[^\s\\]*)?)$/.test(deepLink)) return deepLink;
  return courseId ? generatePath(APP_ROUTE_PATHS.courseCourseId, {courseId: String(courseId)}) : undefined;
}
import i18n from '@/i18n';
import {formatDateValue} from '@/i18n/formatting';
