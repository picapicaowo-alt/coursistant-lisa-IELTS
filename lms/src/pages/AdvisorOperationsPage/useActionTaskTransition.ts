import {useMutation, useQueryClient} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
import {useIdempotencyCheckpoint} from '@/hooks/useIdempotencyCheckpoint';

/** The dashboard and task inbox share the same versioned transition and cache boundary. */
export function useActionTaskTransition() {
  const queryClient = useQueryClient();
  const idempotency = useIdempotencyCheckpoint();
  return useMutation({
    mutationFn: async ({action, taskId, version}: {action: 'start' | 'resolve'; taskId: number; version?: number}) => {
      if (version == null) throw new Error('Reload this task to get its current version.');
      const key = idempotency.keyFor(`${action}-task-${taskId}`, String(version));
      const response = action === 'start'
        ? await advisorApiService.startActionTask(taskId, {expectedVersion: version}, key)
        : await advisorApiService.resolveActionTask(taskId, {expectedVersion: version}, key);
      return unwrapData(response, 'advisorActionTaskTransition');
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'action-task']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'dashboard']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'student-hub']}),
        queryClient.invalidateQueries({queryKey: ['advisor', 'students-highlight']}),
      ]);
    },
    onError: async () => {
      await queryClient.invalidateQueries({queryKey: ['advisor', 'action-tasks']});
    },
  });
}
