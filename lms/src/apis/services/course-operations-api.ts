import {LocalizedError} from '@/i18n/errors';
import {readCollection, type CollectionPage} from './readCollection';
import type {
  ApiResponse,
  AdvisingPage,
  ScheduleRequestResponse,
  CourseOperationRead,
  CourseOwnershipListParams,
  CourseStudentReportListParams,
  MyPublishedReportParams,
  CreateOccurrenceRequest,
  CreateScheduleRequestRequest,
  GenerateOccurrencesRequest,
  OccurrenceListParams,
  PersonalEventRequest,
  ReplaceAvailabilityRequest,
  RescheduleOccurrenceRequest,
  SaveAttendanceRequest,
  ScheduleRequestDecisionRequest,
  SetPurchasedHoursRequest,
  TenantAlertRuleRequest,
  TenantAlertRuleResponse,
  TenantCourseOwnership,
  TenantCourseOwnershipPage,
  TeachingAvailabilityResponse,
  TeachingGradingItemResponse,
  TeachingStudentSupportResponse,
  TeachingTodayClassResponse,
  StudentProgressResponse,
  TransferCourseOwnerRequest,
  UpsertCourseStudentReportRequest,
} from '@/apis';
import {idempotent, V2ApiClient} from '@/apis';

export class CourseOperationsApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  adminEnroll(courseId: number, userId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/admin/courses/${courseId}/enrollments`, {userId}, idempotent(key));
  }

  adminEnrollBatch(courseId: number, request: {emails?: string[]; userIds?: number[]}, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/admin/courses/${courseId}/enrollments/batch`, request, idempotent(key));
  }

  adminDeactivateEnrollment(courseId: number, userId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/admin/courses/${courseId}/enrollments/${userId}`, idempotent(key));
  }

  getAdvisorInstructorAvailability(instructorUserId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/advisor/instructors/${instructorUserId}/availability`);
  }

  listTenantCourseOwnerships(params: CourseOwnershipListParams = {}): Promise<ApiResponse<TenantCourseOwnershipPage>> {
    return this.apiClient.get('/v2/tenant/course-ownerships', {params});
  }

  getTenantCourseOwner(courseId: number): Promise<ApiResponse<TenantCourseOwnership>> {
    return this.apiClient.get(`/v2/tenant/courses/${courseId}/owner`);
  }

  transferTenantCourseOwner(
    courseId: number,
    request: TransferCourseOwnerRequest,
  ): Promise<ApiResponse<TenantCourseOwnership>> {
    return this.apiClient.put(`/v2/tenant/courses/${courseId}/owner`, request);
  }

  listAdvisorScheduleRequests(params: {requestType?: string; studentUserId?: number; page?: number; size?: number} = {}): Promise<ApiResponse<AdvisingPage<ScheduleRequestResponse>>> {
    return this.apiClient.get('/v2/advisor/schedule-requests', {params});
  }

  decideAdvisorScheduleRequest(requestId: number, request: ScheduleRequestDecisionRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/advisor/schedule-requests/${requestId}/decision`, request, idempotent(key));
  }

  reviewCourseScheduleRequest(courseId: number, requestId: number, request: ScheduleRequestDecisionRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/schedule-requests/${requestId}/instructor-review`, request, idempotent(key));
  }

  attachMaterialToAssignment(courseId: number, materialId: number, assignmentId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/materials/${materialId}/assignment-links/${assignmentId}`, undefined, idempotent(key));
  }

  detachMaterialFromAssignment(courseId: number, materialId: number, assignmentId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/materials/${materialId}/assignment-links/${assignmentId}`, idempotent(key));
  }

  attachMaterialToLecture(courseId: number, materialId: number, lectureId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/materials/${materialId}/lecture-links/${lectureId}`, undefined, idempotent(key));
  }

  detachMaterialFromLecture(courseId: number, materialId: number, lectureId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/materials/${materialId}/lecture-links/${lectureId}`, idempotent(key));
  }

  getMaterialLinks(courseId: number, materialId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/materials/${materialId}/links`);
  }

  listAssignmentMaterials(courseId: number, assignmentId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/assignments/${assignmentId}/materials`);
  }

  listDiscussionPosts(courseId: number, page = 0, size = 20): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/discussion/posts`, {params: {page, size}});
  }

  createDiscussionPost(courseId: number, body: string, files: File[] = [], key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    const form = new FormData();
    form.append('body', body);
    files.forEach(file => form.append('files', file));
    return this.apiClient.post(`/v2/courses/${courseId}/discussion/posts`, form, idempotent(key));
  }

  getDiscussionPost(courseId: number, postId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/discussion/posts/${postId}`);
  }

  listDiscussionAttachments(courseId: number, postId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/discussion/posts/${postId}/attachments`);
  }

  listDiscussionReplies(courseId: number, postId: number, page = 0, size = 50): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/discussion/posts/${postId}/replies`, {params: {page, size}});
  }

  createDiscussionReply(courseId: number, postId: number, body: string, key: string = crypto.randomUUID(), files: File[] = []): Promise<ApiResponse<CourseOperationRead>> {
    if (!files.length) return this.apiClient.post(`/v2/courses/${courseId}/discussion/posts/${postId}/replies`, {body}, idempotent(key));
    const form = new FormData();
    form.append('body', body);
    files.forEach(file => form.append('files', file));
    return this.apiClient.post(`/v2/courses/${courseId}/discussion/posts/${postId}/replies`, form, idempotent(key));
  }

  private async getDiscussionAttachment(courseId: number, postId: number, attachmentId: number, action: 'preview' | 'download'): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/discussion/posts/${postId}/attachments/${attachmentId}/${action}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  previewDiscussionAttachment(courseId: number, postId: number, attachmentId: number): Promise<Blob> {
    return this.getDiscussionAttachment(courseId, postId, attachmentId, 'preview');
  }

  downloadDiscussionAttachment(courseId: number, postId: number, attachmentId: number): Promise<Blob> {
    return this.getDiscussionAttachment(courseId, postId, attachmentId, 'download');
  }

  listSessionOccurrences(courseId: number, params: OccurrenceListParams = {}): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/session-occurrences`, {params});
  }

  createSessionOccurrence(courseId: number, request: CreateOccurrenceRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/session-occurrences`, request, idempotent(key));
  }

  generateSessionOccurrences(courseId: number, request: GenerateOccurrencesRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/session-occurrences/generate`, request, idempotent(key));
  }

  getSessionOccurrence(courseId: number, occurrenceId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}`);
  }

  getOccurrenceAttendance(courseId: number, occurrenceId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/attendance`);
  }

  saveOccurrenceAttendance(courseId: number, occurrenceId: number, request: SaveAttendanceRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.put(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/attendance`, request, idempotent(key));
  }

  syncOccurrenceAttendanceRoster(courseId: number, occurrenceId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/attendance/roster-sync`, undefined, idempotent(key));
  }

  getOwnOccurrenceAttendance(courseId: number, occurrenceId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/attendance/me`);
  }

  cancelSessionOccurrence(courseId: number, occurrenceId: number, expectedVersion?: number, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/session-occurrences/${occurrenceId}/cancel`,
      {expectedVersion},
      idempotent(key),
    );
  }

  rescheduleSessionOccurrence(courseId: number, occurrenceId: number, request: RescheduleOccurrenceRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/reschedule`, request, idempotent(key));
  }

  listCourseScheduleRequests(courseId: number, occurrenceId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/schedule-requests`);
  }

  createCourseScheduleRequest(courseId: number, occurrenceId: number, request: CreateScheduleRequestRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/session-occurrences/${occurrenceId}/schedule-requests`, request, idempotent(key));
  }

  listCourseStudentReports(courseId: number, params: CourseStudentReportListParams = {}): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/student-reports`, {params});
  }

  createCourseStudentReport(courseId: number, request: UpsertCourseStudentReportRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(`/v2/courses/${courseId}/student-reports`, request, idempotent(key));
  }

  getCourseStudentReport(courseId: number, reportId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/student-reports/${reportId}`);
  }

  updateCourseStudentReport(courseId: number, reportId: number, request: UpsertCourseStudentReportRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.patch(`/v2/courses/${courseId}/student-reports/${reportId}`, request, idempotent(key));
  }

  publishCourseStudentReport(courseId: number, reportId: number, expectedVersion?: number, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/student-reports/${reportId}/publish`,
      {expectedVersion},
      idempotent(key),
    );
  }

  listMyPublishedReports(params: MyPublishedReportParams = {}): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get('/v2/me/student-reports', {params});
  }

  listMyPublishedCourseReports(courseId: number, page = 0, size = 20): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/student-reports/published/me`, {params: {page, size}});
  }

  getMyPublishedCourseReport(courseId: number, reportId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/student-reports/published/me/${reportId}`);
  }

  getAdvisorStudentOccurrenceAttendance(studentUserId: number, courseId: number, occurrenceId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/courses/${courseId}/session-occurrences/${occurrenceId}/attendance`);
  }

  listAdvisorPublishedCourseReports(studentUserId: number, courseId: number, page = 1, size = 20): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/courses/${courseId}/student-reports`, {params: {page, size}});
  }

  getAdvisorPublishedCourseReport(studentUserId: number, courseId: number, reportId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/courses/${courseId}/student-reports/${reportId}`);
  }

  getMyAlerts(): Promise<ApiResponse<CourseOperationRead>> { return this.apiClient.get('/v2/me/alerts'); }
  getMyAttendance(params: {from?: string; to?: string; courseId?: number} = {}): Promise<ApiResponse<CourseOperationRead>> { return this.apiClient.get('/v2/me/attendance', {params}); }
  getMyCalendar(params: {from?: string; to?: string; timezone?: string} = {}): Promise<ApiResponse<CourseOperationRead>> { return this.apiClient.get('/v2/me/calendar', {params}); }
  getMyProgress(): Promise<ApiResponse<StudentProgressResponse>> { return this.apiClient.get('/v2/me/progress'); }
  getMyScheduleRequests(): Promise<ApiResponse<CourseOperationRead>> { return readCollection<unknown>(params => this.apiClient.get<CollectionPage<unknown> | unknown[]>('/v2/me/schedule-requests', {params})); }
  getMyWorkQueue(): Promise<ApiResponse<CourseOperationRead>> { return readCollection<unknown>(params => this.apiClient.get<CollectionPage<unknown> | unknown[]>('/v2/me/work-queue', {params})); }
  getMyCourseHours(courseId: number): Promise<ApiResponse<CourseOperationRead>> { return this.apiClient.get(`/v2/me/courses/${courseId}/hours`); }
  getMyTeachingAlerts(): Promise<ApiResponse<CourseOperationRead>> { return this.apiClient.get('/v2/me/teaching/alerts'); }
  getMyTeachingGradingItems(): Promise<ApiResponse<TeachingGradingItemResponse[]>> { return readCollection<TeachingGradingItemResponse>(params => this.apiClient.get('/v2/me/teaching/grading-items', {params})); }
  getMyTeachingScheduleRequests(): Promise<ApiResponse<CourseOperationRead>> { return readCollection<unknown>(params => this.apiClient.get<CollectionPage<unknown> | unknown[]>('/v2/me/teaching/schedule-requests', {params})); }
  getMyTeachingStudentsNeedingSupport(): Promise<ApiResponse<TeachingStudentSupportResponse[]>> { return this.apiClient.get('/v2/me/teaching/students-needing-support'); }
  getMyTeachingTodayClasses(): Promise<ApiResponse<TeachingTodayClassResponse[]>> { return this.apiClient.get('/v2/me/teaching/today-classes'); }

  listMyPersonalEvents(params: {fromUtc: string; toUtc: string}): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get('/v2/me/personal-events', {params});
  }

  createMyPersonalEvent(request: PersonalEventRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.post('/v2/me/personal-events', request, idempotent(key));
  }

  getMyPersonalEvent(eventId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/me/personal-events/${eventId}`);
  }

  patchMyPersonalEvent(eventId: number, request: PersonalEventRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.patch(`/v2/me/personal-events/${eventId}`, request, idempotent(key));
  }

  deleteMyPersonalEvent(eventId: number, key: string = crypto.randomUUID(), expectedVersion?: number): Promise<ApiResponse<void>> {
    // The consumed DELETE contract requires a version query parameter, not a body.
    if (expectedVersion == null || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
      throw new LocalizedError('calendar:editor.missingVersion');
    }
    return this.apiClient.delete(`/v2/me/personal-events/${eventId}`, {...idempotent(key), params: {expectedVersion}});
  }

  getMyTeachingAvailability(): Promise<ApiResponse<TeachingAvailabilityResponse>> {
    return this.apiClient.get('/v2/me/teaching/availability');
  }

  replaceMyTeachingAvailability(request: ReplaceAvailabilityRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.put('/v2/me/teaching/availability', request, idempotent(key));
  }

  getAdvisorStudentAttendance(studentUserId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/attendance`);
  }

  getAdvisorStudentCourseHours(studentUserId: number, courseId: number): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/courses/${courseId}/hours`);
  }

  setAdvisorStudentCourseHours(studentUserId: number, courseId: number, request: SetPurchasedHoursRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<CourseOperationRead>> {
    return this.apiClient.put(`/v2/advisor/students/${studentUserId}/courses/${courseId}/hours`, request, idempotent(key));
  }

  getTenantAlertRules(): Promise<ApiResponse<TenantAlertRuleResponse>> {
    return this.apiClient.get('/v2/tenant/alert-rules');
  }

  putTenantAlertRules(request: TenantAlertRuleRequest): Promise<ApiResponse<TenantAlertRuleResponse>> {
    return this.apiClient.put('/v2/tenant/alert-rules', request);
  }
}

export const courseOperationsApiService = new CourseOperationsApiService();
