export const TASK_STATUS = {notStarted: 'NOT_STARTED', inProgress: 'IN_PROGRESS', completed: 'COMPLETED'} as const;
export const TASK_STATUS_LABELS: Record<string, string> = {
  [TASK_STATUS.notStarted]: 'Not started',
  [TASK_STATUS.inProgress]: 'In progress',
  [TASK_STATUS.completed]: 'Completed',
};
export const taskStatusLabel = (status?: string): string =>
  status ? TASK_STATUS_LABELS[status] ?? status.replace(/_/g, ' ').toLowerCase() : 'Status unavailable';

export const taskStatusTone = (status?: string): 'neutral' | 'active' | 'complete' =>
  status === TASK_STATUS.inProgress ? 'active' : status === TASK_STATUS.completed ? 'complete' : 'neutral';

export const formatPlanDate = (value?: string): string => {
  if (!value) return 'No deadline';
  // Date-only deadlines must not shift to the preceding day in western timezones.
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric'}).format(date);
};
