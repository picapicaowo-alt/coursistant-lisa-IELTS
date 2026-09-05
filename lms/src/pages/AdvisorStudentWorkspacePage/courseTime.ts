import i18n from '@/i18n';
import {formatClockTime} from '@/i18n/formatting';

/** Course schedules are local wall-clock times, not UTC instants. */
export function formatCourseTime(value?: string): string {
  return value ? formatClockTime(value) : i18n.t('common:feedback.notProvided');
}
