import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {V2ApiClient} from '@/apis';
import {ProfileApiService} from './profile-api';

const client = {get: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn()};
const service = new ProfileApiService(client as unknown as typeof V2ApiClient);

describe('ProfileApiService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads and updates only the self-service profile contract', async () => {
    client.get.mockResolvedValue({status: 200, data: {}});
    client.patch.mockResolvedValue({status: 200, data: {}});
    await service.getMyProfile();
    await service.updateMyProfile({firstName: 'Lisa', lastName: 'Coursistant', emailNotifications: false});
    expect(client.get).toHaveBeenCalledWith('/v2/me/profile');
    expect(client.patch).toHaveBeenCalledWith('/v2/me/profile', {firstName: 'Lisa', lastName: 'Coursistant', emailNotifications: false}, expect.objectContaining({headers: expect.any(Object)}));
  });

  it('uploads and removes the current avatar', async () => {
    const file = new File(['avatar'], 'avatar.png', {type: 'image/png'});
    client.put.mockResolvedValue({status: 200, data: {}});
    client.delete.mockResolvedValue({status: 200, data: {}});
    await service.uploadAvatar(file);
    await service.deleteAvatar();
    expect(client.put.mock.calls[0][0]).toBe('/v2/me/profile/avatar');
    const uploaded = (client.put.mock.calls[0][1] as FormData).get('file') as File;
    expect(uploaded.name).toBe('avatar.png');
    expect(uploaded.type).toBe('image/png');
    expect(client.delete).toHaveBeenCalledWith('/v2/me/profile/avatar', expect.objectContaining({headers: expect.any(Object)}));
  });
});
