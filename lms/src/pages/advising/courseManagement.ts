import {contractItems} from '@/pages/AdvisorOperationsPage/advisorViewModels';
import type {AdvisorOwnedCourse} from '@/apis/types/advisorWorkspace';
import type {CourseDeliveryConfigResponse, CourseReadinessBlocker} from '@/apis';
import i18n from '@/i18n';
import {formatClockTime, formatDateValue} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';

// PutCourseDeliveryConfigRequest in docs/api/advising.openapi.yaml.
export const CATALOG_CODE_MAX_LENGTH = 64;
export const COURSE_SEARCH_MAX_LENGTH = 120;
export const courseManagementKeys = {
  owned: ['advisor', 'owned-courses'] as const,
  course: (id: number) => ['advisor', 'owned-course', id] as const,
  delivery: (id: number) => ['advisor', 'course-delivery', id] as const,
  sessions: (id: number) => ['advisor', 'owned-course-sessions', id] as const,
  occurrences: (id: number) => ['advisor', 'owned-course-occurrences', id] as const,
  scheduleWrites: (id: number) => ['advisor', 'course-schedule-write', id] as const,
};

export const validDeliveryDraft = (draft: {catalogCode: string; capacity: string}): boolean =>
  draft.catalogCode.trim().length > 0 && draft.catalogCode.trim().length <= CATALOG_CODE_MAX_LENGTH &&
  Number.isSafeInteger(Number(draft.capacity)) && Number(draft.capacity) >= 1;

export const hasVersionedGroupConfig = (config?: CourseDeliveryConfigResponse | null): boolean =>
  config?.deliveryMode === 'GROUP' && Number.isSafeInteger(config.courseLaunchVersion) &&
  (config.courseLaunchVersion ?? -1) >= 0 && COURSE_LAUNCH_STATES.some(state => state === config.launchState);

export const courseDeliveryLabel = (mode?: string): string =>
  i18n.t(mode === 'GROUP' ? 'courseTools:delivery.group' : mode === 'ONE_ON_ONE' ? 'courseTools:delivery.oneToOne' : 'courseTools:delivery.typeUnavailable');

export const COURSE_LAUNCH_STATES = ['DRAFT', 'READY', 'PUBLISHED'] as const;

/** Localize observed readiness requirements; keep unknown codes for support without showing raw server prose. */
export const courseReadinessMessage = (blocker: CourseReadinessBlocker): string => {
  if (blocker.code === 'SYLLABUS_REQUIRED') return i18n.t('courseTools:readiness.syllabusRequired');
  return i18n.t('courseTools:readiness.unknownRequirement', {code: blocker.code || i18n.t('courseTools:readiness.requirement')});
};
export type CourseLaunchState = typeof COURSE_LAUNCH_STATES[number];

export interface AdvisorCourseOccurrence {
  id: number;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  status?: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const stringValue = (record: Record<string, unknown>, key: string): string | undefined =>
  typeof record[key] === 'string' && record[key] ? record[key] as string : undefined;

export const isCourseLaunchState = (value: string): value is CourseLaunchState =>
  COURSE_LAUNCH_STATES.some(state => state === value);

export const courseLaunchLabel = (state?: string | null): string => {
  if (state === 'READY') return i18n.t('courseTools:delivery.readyToPublish');
  if (state === 'PUBLISHED' || state === 'DRAFT') return statusLabel(state);
  return i18n.t('courseTools:delivery.notConfigured');
};

export const courseTermLabel = (course: Pick<AdvisorOwnedCourse, 'termStartDate' | 'termEndDate'>): string => {
  if (!course.termStartDate && !course.termEndDate) return i18n.t('courseTools:delivery.termMissing');
  if (!course.termStartDate) return i18n.t('courseTools:delivery.termThrough', {date: formatCourseDate(course.termEndDate!)});
  if (!course.termEndDate) return i18n.t('courseTools:delivery.termFrom', {date: formatCourseDate(course.termStartDate)});
  return `${formatCourseDate(course.termStartDate)} – ${formatCourseDate(course.termEndDate)}`;
};

export const formatCourseDate = (value?: string): string => value ? formatDateValue(value) : i18n.t('common:feedback.notProvided');

export const formatCourseTime = (value?: string): string => value ? formatClockTime(value) : i18n.t('common:feedback.notProvided');

export const parseAdvisorCourseOccurrences = (value: unknown): AdvisorCourseOccurrence[] =>
  contractItems(value).flatMap(item => {
    const record = asRecord(item);
    if (!record) return [];
    const idValue = record.occurrenceId ?? record.id;
    const date = stringValue(record, 'occurrenceDate') ?? stringValue(record, 'date');
    if (typeof idValue !== 'number' || !date) return [];
    return [{
      id: idValue,
      date,
      startTime: stringValue(record, 'startTime'),
      endTime: stringValue(record, 'endTime'),
      location: stringValue(record, 'location'),
      status: stringValue(record, 'status'),
    }];
  }).sort((a, b) => `${a.date}${a.startTime ?? ''}`.localeCompare(`${b.date}${b.startTime ?? ''}`));
