import {contractItems} from '@/pages/AdvisorOperationsPage/advisorViewModels';
import type {AdvisorOwnedCourse} from '@/apis/types/advisorWorkspace';
import type {CourseDeliveryConfigResponse} from '@/apis';

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
  mode === 'GROUP' ? 'Group course' : mode === 'ONE_ON_ONE' ? 'One-on-one course' : 'Delivery type not available';

export const COURSE_LAUNCH_STATES = ['DRAFT', 'READY', 'PUBLISHED'] as const;
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
  if (state === 'READY') return 'Ready to publish';
  if (state === 'PUBLISHED') return 'Published';
  if (state === 'DRAFT') return 'Draft';
  return 'Not configured';
};

export const courseTermLabel = (course: Pick<AdvisorOwnedCourse, 'termStartDate' | 'termEndDate'>): string => {
  if (!course.termStartDate && !course.termEndDate) return 'Term dates not provided';
  if (!course.termStartDate) return `Through ${formatCourseDate(course.termEndDate!)}`;
  if (!course.termEndDate) return `From ${formatCourseDate(course.termStartDate)}`;
  return `${formatCourseDate(course.termStartDate)} – ${formatCourseDate(course.termEndDate)}`;
};

export const formatCourseDate = (value?: string): string => {
  if (!value) return 'Not provided';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
    .format(new Date(year, month - 1, day));
};

export const formatCourseTime = (value?: string): string => {
  if (!value) return 'Not provided';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  return new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit'})
    .format(new Date(2000, 0, 1, hours, minutes));
};

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
