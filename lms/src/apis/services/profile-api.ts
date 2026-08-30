import {ApiResponse, idempotent, ProfileResponse, UpdateProfileRequest, V2ApiClient} from '@/apis';

/** Current-user profile transport; identity comes from the authenticated session. */
export class ProfileApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  getMyProfile(): Promise<ApiResponse<ProfileResponse>> {
    return this.apiClient.get('/v2/me/profile');
  }

  updateMyProfile(request: UpdateProfileRequest): Promise<ApiResponse<ProfileResponse>> {
    return this.apiClient.patch('/v2/me/profile', request, idempotent());
  }

  uploadAvatar(file: File | Blob): Promise<ApiResponse<ProfileResponse>> {
    const formData = new FormData();
    // FormData requires a filename for a bare Blob even though generated image
    // data has no original local name.
    formData.append('file', file, file instanceof File ? file.name : 'avatar.jpg');
    return this.apiClient.put('/v2/me/profile/avatar', formData);
  }

  deleteAvatar(): Promise<ApiResponse<ProfileResponse>> {
    return this.apiClient.delete('/v2/me/profile/avatar', idempotent());
  }

  async getUserAvatar(userId: number): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(`/v2/users/${userId}/avatar`, {responseType: 'blob'});
    return response.data;
  }
}

export const profileApiService = new ProfileApiService();
