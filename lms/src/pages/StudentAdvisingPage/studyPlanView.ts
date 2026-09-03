import type {AdvisorTaskResponse, CheckpointResponse} from '@/apis/types/advising';

export {TASK_STATUS, TASK_STATUS_LABELS, taskStatusLabel, taskStatusTone, formatPlanDate} from '@/utils/studyPlan';

export const TASK_SUBMISSION_MAX_LENGTH = 4000;
export const TASK_PAGE_SIZES = [5, 10, 20] as const;
export {STUDY_PLAN_QUERY_PARAMS as STUDY_PLAN_PARAMS} from '@/configs/routePaths';

// Older aggregates may omit IDs. Position keys still allow read-only navigation;
// mutation controls always require the actual task ID returned by the API.
export const studyPlanRecordKey = (record: Pick<CheckpointResponse, 'id' | 'position'>, index: number): string =>
  record.id == null ? `position-${record.position ?? index + 1}` : String(record.id);

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
