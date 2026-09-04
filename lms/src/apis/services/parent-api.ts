import dayjs from 'dayjs';
import type {
  ApiResponse,
  CreateOrReuseParentLinkRequest,
  MarkParentConversationReadRequest,
  ParentAcademicRead,
  ParentConversationMessageResponse,
  ParentConversationMessagePage,
  ParentNotificationPage,
  ParentCreateScheduleRequest,
  ParentLinkedStudentPage,
  ParentLinkRequest,
  ParentMessageRequest,
  ParentNotification,
  ParentReportDetail,
  ParentStudentLinkResponse,
} from '@/apis';
import {idempotent, V2ApiClient} from '@/apis';

export class ParentApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  createOrReuseParentLink(intakeId: number, request: CreateOrReuseParentLinkRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<ParentStudentLinkResponse>> {
    return this.apiClient.post(`/v2/counsellor/student-intakes/${intakeId}/parent-links`, request, idempotent(key));
  }

  linkExistingParent(intakeId: number, parentUserId: number, request: ParentLinkRequest = {}, key: string = crypto.randomUUID()): Promise<ApiResponse<ParentStudentLinkResponse>> {
    return this.apiClient.put(`/v2/counsellor/student-intakes/${intakeId}/parent-links/${parentUserId}`, request, idempotent(key));
  }

  unlinkIntakeParent(intakeId: number, parentUserId: number, request: ParentLinkRequest = {}, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/counsellor/student-intakes/${intakeId}/parent-links/${parentUserId}`, {data: request, ...idempotent(key)});
  }

  listCounsellorParentLinks(intakeId: number): Promise<ApiResponse<ParentStudentLinkResponse[]>> {
    return this.apiClient.get(`/v2/counsellor/student-intakes/${intakeId}/parent-links`);
  }

  listTenantParentLinks(studentUserId: number): Promise<ApiResponse<ParentStudentLinkResponse[]>> {
    return this.apiClient.get(`/v2/tenant/students/${studentUserId}/parent-links`);
  }

  createOrReuseTenantParentLink(
    studentUserId: number,
    request: CreateOrReuseParentLinkRequest,
  ): Promise<ApiResponse<ParentStudentLinkResponse>> {
    return this.apiClient.post(`/v2/tenant/students/${studentUserId}/parent-links`, request);
  }

  linkTenantParent(studentUserId: number, parentUserId: number, request: ParentLinkRequest = {}, key: string = crypto.randomUUID()): Promise<ApiResponse<ParentStudentLinkResponse>> {
    return this.apiClient.put(`/v2/tenant/students/${studentUserId}/parent-links/${parentUserId}`, request, idempotent(key));
  }

  unlinkTenantParent(studentUserId: number, parentUserId: number, request: ParentLinkRequest = {}, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/tenant/students/${studentUserId}/parent-links/${parentUserId}`, {data: request, ...idempotent(key)});
  }

  listAdvisorParentLinks(studentUserId: number): Promise<ApiResponse<ParentStudentLinkResponse[]>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/parent-links`);
  }

  listLinkedStudents(page = 0, size = 20): Promise<ApiResponse<ParentLinkedStudentPage>> {
    return this.apiClient.get('/v2/parent/linked-students', {params: {page, size}});
  }

  getStudentDashboard(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/dashboard`);
  }

  getStudentProfile(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/profile`);
  }

  getStudentStudyPlan(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/study-plan`);
  }

  listStudentCourses(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/courses`);
  }

  listStudentAssignments(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/assignments`);
  }

  listStudentCalendar(studentUserId: number, params: {from?: string; to?: string; timezone?: string} = {}): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/calendar`, {params: {from: dayjs().format('YYYY-MM-DD'), to: dayjs().add(14, 'day').format('YYYY-MM-DD'), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...params}});
  }

  listStudentAttendance(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/attendance`);
  }

  getStudentHours(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/hours`);
  }

  getStudentRisk(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/risk`);
  }

  listStudentReports(studentUserId: number, page = 0, size = 20): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/reports`, {params: {page, size}});
  }

  getStudentReport(studentUserId: number, reportId: number): Promise<ApiResponse<ParentReportDetail>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/reports/${reportId}`);
  }

  listScheduleRequests(studentUserId: number): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/schedule-requests`);
  }

  createScheduleRequest(studentUserId: number, request: ParentCreateScheduleRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<ParentAcademicRead>> {
    return this.apiClient.post(`/v2/parent/students/${studentUserId}/schedule-requests`, request, idempotent(key));
  }

  listNotifications(page = 0, size = 20): Promise<ApiResponse<ParentNotificationPage | ParentNotification[]>> {
    return this.apiClient.get('/v2/parent/notifications', {params: {page, size}});
  }

  getNotificationUnreadCount(): Promise<ApiResponse<{unreadCount?: number}>> {
    return this.apiClient.get('/v2/parent/notifications/unread-count');
  }

  markNotificationRead(notificationId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.patch(`/v2/parent/notifications/${notificationId}/read`, undefined, idempotent(key));
  }

  markAllNotificationsRead(key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.patch('/v2/parent/notifications/read-all', undefined, idempotent(key));
  }

  listConversationMessages(studentUserId: number, beforeId?: number): Promise<ApiResponse<ParentConversationMessagePage | ParentConversationMessageResponse[]>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/conversation/messages`, {params: {beforeId}});
  }

  sendConversationMessage(studentUserId: number, request: ParentMessageRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<ParentConversationMessageResponse>> {
    const form = new FormData();
    form.append('clientMessageId', request.clientMessageId);
    if (request.body) form.append('body', request.body);
    request.files?.forEach(file => form.append('files', file));
    return this.apiClient.post(`/v2/parent/students/${studentUserId}/conversation/messages`, form, idempotent(key));
  }

  markConversationRead(studentUserId: number, request: MarkParentConversationReadRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.post(`/v2/parent/students/${studentUserId}/conversation/read`, request, idempotent(key));
  }

  private async getConversationAttachment(studentUserId: number, attachmentId: number, action: 'preview' | 'download'): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/parent/students/${studentUserId}/conversation/attachments/${attachmentId}/${action}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  previewConversationAttachment(studentUserId: number, attachmentId: number): Promise<Blob> {
    return this.getConversationAttachment(studentUserId, attachmentId, 'preview');
  }

  downloadConversationAttachment(studentUserId: number, attachmentId: number): Promise<Blob> {
    return this.getConversationAttachment(studentUserId, attachmentId, 'download');
  }
}

export const parentApiService = new ParentApiService();
