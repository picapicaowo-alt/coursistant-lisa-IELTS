import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {courseOperationsApiService} from '@/apis/services/course-operations-api';

export function useStudentProgress(enabled: boolean) {
  return useQuery({
    queryKey: ['me', 'progress'],
    queryFn: async () =>
      unwrapData(
        await courseOperationsApiService.getMyProgress(),
        'myProgress',
      ),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
