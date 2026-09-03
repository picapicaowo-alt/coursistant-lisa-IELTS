import {useQuery} from '@tanstack/react-query';
import {unwrapData} from '@/apis';
import {advisorApiService} from '@/apis/services/advisor-api';
export function useLearningProfile(enabled: boolean) {
  return useQuery({
    queryKey: ['student', 'advising-profile'],
    queryFn: async () =>
      unwrapData(await advisorApiService.getOwnProfile(), 'ownProfile'),
    enabled,
    retry: false,
  });
}
