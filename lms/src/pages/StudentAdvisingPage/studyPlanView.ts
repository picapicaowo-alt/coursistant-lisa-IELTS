import type {AdvisorTaskResponse, CheckpointResponse} from '@/apis/types/advising';

export const TASK_STATUS = {notStarted: 'NOT_STARTED', inProgress: 'IN_PROGRESS', completed: 'COMPLETED'} as const;
export const TASK_STATUS_LABELS: Record<string, string> = {
  [TASK_STATUS.notStarted]: 'Not started',
  [TASK_STATUS.inProgress]: 'In progress',
  [TASK_STATUS.completed]: 'Completed',
};
export const TASK_SUBMISSION_MAX_LENGTH = 4000;
export const TASK_PAGE_SIZES = [5, 10, 20] as const;
export {STUDY_PLAN_QUERY_PARAMS as STUDY_PLAN_PARAMS} from '@/configs/routePaths';

// Older aggregates may omit IDs. Position keys still allow read-only navigation;
// mutation controls always require the actual task ID returned by the API.
export const studyPlanRecordKey = (record: Pick<CheckpointResponse, 'id' | 'position'>, index: number): string =>
  record.id == null ? `position-${record.position ?? index + 1}` : String(record.id);

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

export interface TaskAction {
  action: 'start' | 'complete';
  taskId: number;
  version: number;
}

export interface TaskInteractionProps {
  submissions: Record<number, string>;
  onSubmission: (taskId: number, value: string) => void;
  onAction: (action: TaskAction) => void;
  isPending: boolean;
  error?: string;
  actionTaskId?: number;
  onClearError: () => void;
}

export type TaskRow = {task: AdvisorTaskResponse; key: string};
