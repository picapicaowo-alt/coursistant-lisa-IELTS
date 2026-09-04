import {useQuery} from '@tanstack/react-query';
import {unwrapData, type LoginResponse} from '@/apis';
import {profileApiService} from '@/apis/services/profile-api';
import {adminApiService} from '@/apis/services/admin-api';
import {formatPersonName} from '@/utils/personName';
import {normalizeAvatarUrl} from '@/utils/avatarUrl';

/** Login can omit names. Resolve them through the directory allowed for this role. */
export function useProfileIdentity(user: LoginResponse | null) {
  const profile = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => unwrapData(await profileApiService.getMyProfile(), 'current profile'),
    enabled: user?.role === 'USER' && !user.name,
    retry: false,
    staleTime: 300_000,
  });
  const tenantUser = useQuery({
    // Share the tenant dashboard's directory cache; admin accounts have no teaching profile.
    queryKey: ['tenant', 'user', user?.id],
    queryFn: async () => unwrapData(await adminApiService.getTenantUser(user!.id), 'tenantUser'),
    enabled: user?.role === 'TENANT_ADMIN' && !user.name && user.id > 0,
    retry: false,
    staleTime: 60_000,
  });
  const person = user?.role === 'USER' ? profile.data : user?.role === 'TENANT_ADMIN' ? tenantUser.data : undefined;
  return {
    name: formatPersonName(person, user?.name || ''),
    avatar: normalizeAvatarUrl(user?.role === 'USER' && profile.data ? profile.data.avatarUrl : user?.avatar),
  };
}
