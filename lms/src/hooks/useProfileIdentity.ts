import {useQuery} from '@tanstack/react-query';
import {unwrapData, type LoginResponse} from '@/apis';
import {profileApiService} from '@/apis/services/profile-api';
import {formatPersonName} from '@/utils/personName';
import {normalizeAvatarUrl} from '@/utils/avatarUrl';

/** Login may omit a display name; the current-user profile owns structured names. */
export function useProfileIdentity(user: LoginResponse | null) {
  const profile = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => unwrapData(await profileApiService.getMyProfile(), 'current profile'),
    enabled: user?.role === 'USER' && !user.name,
    retry: false,
    staleTime: 300_000,
  });
  return {
    name: formatPersonName(profile.data, user?.name || ''),
    avatar: normalizeAvatarUrl(profile.data ? profile.data.avatarUrl : user?.avatar),
  };
}
