import i18n from '@/i18n';
import {formatDateTime} from '@/i18n/formatting';
import {statusLabel} from '@/i18n/presentation';

export const TASK_STATUS = {notStarted: 'NOT_STARTED', inProgress: 'IN_PROGRESS', completed: 'COMPLETED'} as const;
export const TASK_STATUS_LABELS: Record<string, string> = {
  [TASK_STATUS.notStarted]: 'common:status.NOT_STARTED',
  [TASK_STATUS.inProgress]: 'common:status.inProgress',
  [TASK_STATUS.completed]: 'common:status.COMPLETED',
};
export const taskStatusLabel = (status?: string): string =>
  status ? statusLabel(status) : i18n.t('common:feedback.statusUnavailable');

export const taskStatusTone = (status?: string): 'neutral' | 'active' | 'complete' =>
  status === TASK_STATUS.inProgress ? 'active' : status === TASK_STATUS.completed ? 'complete' : 'neutral';

export const formatPlanDate = (value?: string, {compact = false}: {compact?: boolean} = {}): string => {
  if (!value) return i18n.t('common:dateTime.noDeadline');
  // Date-only deadlines must not shift to the preceding day in western timezones.
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {month: 'short', day: 'numeric'};
  // Compact lists omit only the current year; other years must remain explicit.
  if (!compact || date.getFullYear() !== new Date().getFullYear()) {
    options.year = 'numeric';
    if (compact) options.month = 'numeric';
  }
  return formatDateTime(date, options);
};
