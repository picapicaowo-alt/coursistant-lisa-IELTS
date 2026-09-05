import {isConflict} from '@/utils/apiError';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData, type AdvisorTaskResponse, type StudentFacingStudyPlanResponse} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';
import {LocalizedError} from '@/i18n/errors';
import {advisingQueryKeys} from '../advising/queryKeys';
import type {TaskAction} from './studyPlanView';

export const TASK_FILE_RULES = {
  extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg', 'jpeg', 'gif', 'webp'],
  maxBytes: 100 * 1024 * 1024,
} as const;
export const TASK_FILE_ACCEPT = TASK_FILE_RULES.extensions.map(extension => `.${extension}`).join(',');

export function validateTaskFile(file: Pick<File, 'name' | 'size'>): void {
  if (!TASK_FILE_RULES.extensions.some(extension => file.name.toLowerCase().endsWith(`.${extension}`)))
    throw new LocalizedError('learning:taskFile.invalidFormat');
  if (file.size > TASK_FILE_RULES.maxBytes) throw new LocalizedError('learning:taskFile.tooLarge');
}

type TaskMutation = TaskAction | {action: 'upload'; taskId: number; version: number; file: File};

/** Upload and completion share one mutation so completion cannot race a file version. */
export function useTaskSubmission(submissions: Record<number, string>) {
  const client = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  const queryKey = advisingQueryKeys.studentStudyPlan;
  return useMutation({
    mutationFn: async (action: TaskMutation): Promise<AdvisorTaskResponse> => {
      const plan = client.getQueryData<StudentFacingStudyPlanResponse>(queryKey);
      const task = plan?.plan?.checkpoints?.flatMap(checkpoint => checkpoint.tasks ?? []).find(item => item.id === action.taskId);
      if (!task || !Number.isSafeInteger(action.version) || action.version < 0 || task.version !== action.version)
        throw new LocalizedError('learning:taskFile.reloadRequired');
      if (action.action === 'upload') {
        validateTaskFile(action.file);
        const file = unwrapData(await advisorApiService.uploadOwnTaskSubmission(action.taskId, action.version, action.file), 'taskSubmissionFile');
        if (file.taskId !== action.taskId || !Number.isSafeInteger(file.taskVersion) || file.taskVersion <= action.version)
          throw new LocalizedError('learning:taskFile.reloadRequired');
        const {taskVersion, ...submissionFile} = file;
        return {...task, version: taskVersion, submissionFile};
      }
      if (action.action === 'start') return unwrapData(await idempotency.run(
        'student-start-task', [action.taskId, {expectedVersion: action.version}] as const,
        (key, args) => advisorApiService.startOwnAdvisorTask(...args, key),
      ), 'startTask');
      const submissionText = submissions[action.taskId] ?? task.submissionText;
      if (!submissionText?.trim() && !task.submissionFile) throw new LocalizedError('learning:taskFile.submissionRequired');
      return unwrapData(await idempotency.run(
        'student-complete-task', [action.taskId, {expectedVersion: action.version, submissionText}] as const,
        (key, args) => advisorApiService.completeOwnAdvisorTask(...args, key),
      ), 'completeTask');
    },
    onMutate: async () => {await client.cancelQueries({queryKey});},
    onSuccess: async (saved, action) => {
      // Apply the returned version before any subsequent task action is enabled.
      client.setQueryData<StudentFacingStudyPlanResponse>(queryKey, current => current ? {
        ...current, plan: {...current.plan, checkpoints: current.plan.checkpoints?.map(checkpoint => ({
          ...checkpoint, tasks: checkpoint.tasks?.map(task => task.id === action.taskId ? {...task, ...saved} : task),
        }))},
      } : current);
      await client.invalidateQueries({queryKey});
    },
    onError: async (error, action) => {if (isConflict(error) || action.action === 'upload') await client.invalidateQueries({queryKey});},
  });
}
