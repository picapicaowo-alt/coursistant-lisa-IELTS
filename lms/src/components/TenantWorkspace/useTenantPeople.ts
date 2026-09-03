import {useQueries} from '@tanstack/react-query';
import {adminApiService} from '@/apis/services/admin-api';
import {unwrapData, type ManagedUser} from '@/apis';

/** Resolve only visible actors through the tenant-safe directory, never the teaching profile API. */
export function useTenantPeople(
  ids: (number | undefined)[],
): Map<number, ManagedUser> {
  const unique = [
    ...new Set(
      ids.filter((id): id is number => typeof id === 'number' && id > 0),
    ),
  ];
  const queries = useQueries({
    queries: unique.map((id) => ({
      queryKey: ['tenant', 'user', id],
      queryFn: async () =>
        unwrapData(await adminApiService.getTenantUser(id), 'tenantUser'),
      staleTime: 60_000,
      retry: false,
    })),
  });
  return new Map(
    queries.flatMap((query, index) =>
      query.data ? [[unique[index], query.data] as const] : [],
    ),
  );
}
