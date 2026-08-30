import type {
  ApiResponse,
  NotificationPage,
  NotificationPageParams,
  UnreadNotificationCount,
} from '@/apis';
import {V2ApiClient} from '@/apis';
import {idempotent} from '@/apis/types/common';

/** Current-user notification transport; read state is shared by every UI surface. */
export class NotificationApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  async getNotifications(
    params: NotificationPageParams = {page: 1, size: 20}
  ): Promise<ApiResponse<NotificationPage>> {
    // Notification pages are one-based, unlike several zero-based LMS lists.
    return this.apiClient.get<NotificationPage>('/v2/me/notifications', {params});
  }

  async getUnreadCount(): Promise<ApiResponse<UnreadNotificationCount>> {
    return this.apiClient.get<UnreadNotificationCount>('/v2/me/notifications/unread-count');
  }

  async markRead(
    notificationId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<void>> {
    return this.apiClient.patch<void>(
      `/v2/me/notifications/${notificationId}/read`,
      undefined,
      idempotent(idempotencyKey)
    );
  }

  async markAllRead(
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<UnreadNotificationCount>> {
    // The response is the authoritative badge count; notifications remain in
    // the inbox and are refreshed separately by the caller.
    return this.apiClient.patch<UnreadNotificationCount>(
      '/v2/me/notifications/read-all',
      undefined,
      idempotent(idempotencyKey)
    );
  }

  /** SYSTEM_ADMIN operational action from notification.openapi.yaml. */
  runAdminDigest(
    request: {digestDate: string; tenantId?: number},
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<void>> {
    return this.apiClient.post<void>(
      '/v2/admin/notifications/digest/run',
      request,
      idempotent(idempotencyKey),
    );
  }
}

export const notificationApiService = new NotificationApiService();
