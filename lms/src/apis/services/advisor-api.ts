import type {AdvisorStudentFilters, AdvisorInstructor, AdvisorOwnedCourse, AdvisorOwnedCourseFilters, AdvisorConversationSummary, AdvisorStudentHub} from '../types/advisorWorkspace';
import {readCollection} from './readCollection';
import {
  AdvisingPage,
  AdvisorStudentProfileResponse,
  AdvisorStudentCourseResponse,
  AdvisorStudentSummaryResponse,
  AdvisorStudyPlanResponse,
  AdvisorTaskFeedbackRequest,
  AdvisorTaskResponse,
  AdvisorTaskSubmissionFileResponse,
  AdvisorActionTaskResponse,
  ActionTaskMutationRequest,
  AdvisingOpenApiRead,
  ApiResponse,
  CompleteAdvisorTaskRequest,
  CompleteStudentCourseRequest,
  CourseDeliveryConfigResponse,
  CreateOneOnOneCourseRequest,
  CreateStudentProfileRequest,
  CreateStudyPlanRequest,
  GroupCourseOptionResponse,
  InstructorStudentProfileContextResponse,
  LaunchTransitionRequest,
  LinkGroupCourseRequest,
  MarkConversationReadRequest,
  PutCourseDeliveryConfigRequest,
  ReassignOneOnOneInstructorRequest,
  ReconfirmCourseLinkRequest,
  ReplaceOneOnOneSessionsRequest,
  SendAdvisorMessageRequest,
  SendAdvisorMessageMultipartRequest,
  StudentFacingProfileResponse,
  StudentFacingStudyPlanResponse,
  StudentIntakeResponse,
  StudyPlanRevisionResponse,
  UpdateStudentProfileRequest,
  UpdateStudyPlanRequest,
  WithdrawGroupCourseRequest,
  idempotent,
  V2ApiClient,
} from '@/apis';

export class AdvisorApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  listStudents(page = 0, size = 20, filters: AdvisorStudentFilters = {}): Promise<ApiResponse<AdvisingPage<AdvisorStudentSummaryResponse>>> {
    return this.apiClient.get('/v2/advisor/students', {params: {page, size, ...filters}});
  }

  /** Assignment pickers must include students beyond the directory's first page. */
  listAllStudents(): Promise<ApiResponse<AdvisorStudentSummaryResponse[]>> {
    return readCollection(({page, size}) => this.listStudents(page, size));
  }

  listInstructors(params: {q?: string; page?: number; size?: number} = {}): Promise<ApiResponse<AdvisingPage<AdvisorInstructor>>> {
    return this.apiClient.get('/v2/advisor/instructors', {params});
  }

  listOwnedCourses(params: AdvisorOwnedCourseFilters = {}): Promise<ApiResponse<AdvisingPage<AdvisorOwnedCourse>>> {
    return this.apiClient.get('/v2/advisor/courses', {params});
  }

  getStudentIntake(studentUserId: number): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/intake`);
  }

  getStudentProfile(studentUserId: number): Promise<ApiResponse<AdvisorStudentProfileResponse>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/profile`);
  }

  createStudentProfile(
    studentUserId: number,
    request: CreateStudentProfileRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<AdvisorStudentProfileResponse>> {
    return this.apiClient.post(
      `/v2/advisor/students/${studentUserId}/profile`,
      request,
      idempotent(idempotencyKey),
    );
  }

  updateStudentProfile(
    studentUserId: number,
    request: UpdateStudentProfileRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<AdvisorStudentProfileResponse>> {
    return this.apiClient.put(
      `/v2/advisor/students/${studentUserId}/profile`,
      request,
      idempotent(idempotencyKey),
    );
  }

  getStudyPlan(studentUserId: number): Promise<ApiResponse<AdvisorStudyPlanResponse>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/study-plan`);
  }

  createStudyPlan(
    studentUserId: number,
    request: CreateStudyPlanRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<AdvisorStudyPlanResponse>> {
    return this.apiClient.post(
      `/v2/advisor/students/${studentUserId}/study-plan`,
      request,
      idempotent(idempotencyKey),
    );
  }

  updateStudyPlan(
    studentUserId: number,
    request: UpdateStudyPlanRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<AdvisorStudyPlanResponse>> {
    return this.apiClient.put(
      `/v2/advisor/students/${studentUserId}/study-plan`,
      request,
      idempotent(idempotencyKey),
    );
  }

  listStudyPlanRevisions(
    studentUserId: number,
    page = 0,
    size = 20,
  ): Promise<ApiResponse<AdvisingPage<StudyPlanRevisionResponse>>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/study-plan/revisions`, {params: {page, size}});
  }

  feedbackAdvisorTask(
    studentUserId: number,
    taskId: number,
    request: AdvisorTaskFeedbackRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<AdvisorTaskResponse>> {
    return this.apiClient.post(
      `/v2/advisor/students/${studentUserId}/study-plan/tasks/${taskId}/feedback`,
      request,
      idempotent(idempotencyKey),
    );
  }

  getOwnProfile(): Promise<ApiResponse<StudentFacingProfileResponse>> {
    return this.apiClient.get('/v2/student/profile');
  }

  getOwnStudyPlan(): Promise<ApiResponse<StudentFacingStudyPlanResponse>> {
    return this.apiClient.get('/v2/student/study-plan');
  }

  startOwnAdvisorTask(taskId: number, request: {expectedVersion: number}, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorTaskResponse>> {
    // Start uses a query parameter; complete uses the JSON request body.
    return this.apiClient.post(`/v2/student/study-plan/tasks/${taskId}/start`, undefined, {...idempotent(idempotencyKey), params: request});
  }

  completeOwnAdvisorTask(taskId: number, request: CompleteAdvisorTaskRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorTaskResponse>> {
    return this.apiClient.post(`/v2/student/study-plan/tasks/${taskId}/complete`, request, idempotent(idempotencyKey));
  }

  uploadOwnTaskSubmission(taskId: number, expectedVersion: number, file: File): Promise<ApiResponse<AdvisorTaskSubmissionFileResponse>> {
    const form = new FormData();
    form.append('file', file);
    return this.apiClient.put(`/v2/student/study-plan/tasks/${taskId}/submission-file`, form, {params: {expectedVersion}});
  }

  async getTaskSubmissionFile(studentUserId: number, taskId: number, action: 'preview' | 'download'): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/advisor/students/${studentUserId}/study-plan/tasks/${taskId}/submission-file/${action}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  listStudentCourses(studentUserId: number): Promise<ApiResponse<AdvisorStudentCourseResponse[]>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/courses`);
  }

  searchGroupCourseOptions(studentUserId: number, params: {q?: string; page?: number; size?: number} = {}): Promise<ApiResponse<AdvisingPage<GroupCourseOptionResponse>>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/course-options`, {params});
  }

  linkGroupCourse(studentUserId: number, request: LinkGroupCourseRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/group-links`, request, idempotent(idempotencyKey));
  }

  withdrawGroupCourse(studentUserId: number, courseId: number, request: WithdrawGroupCourseRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/${courseId}/withdraw`, request, idempotent(idempotencyKey));
  }

  completeStudentCourse(studentUserId: number, courseId: number, request: CompleteStudentCourseRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/${courseId}/complete`, request, idempotent(idempotencyKey));
  }

  createOneOnOneCourse(studentUserId: number, request: CreateOneOnOneCourseRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/one-on-one`, request, idempotent(idempotencyKey));
  }

  reassignOneOnOneInstructor(studentUserId: number, courseId: number, request: ReassignOneOnOneInstructorRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.put(`/v2/advisor/students/${studentUserId}/courses/${courseId}/instructor`, request, idempotent(idempotencyKey));
  }

  replaceOneOnOneSessions(studentUserId: number, courseId: number, request: ReplaceOneOnOneSessionsRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.put(`/v2/advisor/students/${studentUserId}/courses/${courseId}/sessions`, request, idempotent(idempotencyKey));
  }

  readyOneOnOneLaunch(studentUserId: number, courseId: number, request: LaunchTransitionRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/${courseId}/launch/ready`, request, idempotent(idempotencyKey));
  }

  publishOneOnOneLaunch(studentUserId: number, courseId: number, request: LaunchTransitionRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/${courseId}/launch/publish`, request, idempotent(idempotencyKey));
  }

  getCourseDeliveryConfig(courseId: number): Promise<ApiResponse<CourseDeliveryConfigResponse>> {
    return this.apiClient.get(`/v2/advisor/courses/${courseId}/delivery-config`);
  }

  putCourseDeliveryConfig(
    courseId: number,
    request: PutCourseDeliveryConfigRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<CourseDeliveryConfigResponse>> {
    return this.apiClient.put(
      `/v2/advisor/courses/${courseId}/delivery-config`,
      request,
      idempotent(idempotencyKey),
    );
  }

  readyCourseLaunch(
    courseId: number,
    request: LaunchTransitionRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<CourseDeliveryConfigResponse>> {
    return this.apiClient.post(
      `/v2/advisor/courses/${courseId}/launch/ready`,
      request,
      idempotent(idempotencyKey),
    );
  }

  publishCourseLaunch(
    courseId: number,
    request: LaunchTransitionRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<CourseDeliveryConfigResponse>> {
    return this.apiClient.post(
      `/v2/advisor/courses/${courseId}/launch/publish`,
      request,
      idempotent(idempotencyKey),
    );
  }

  reconfirmCourseLink(studentUserId: number, courseId: number, request: ReconfirmCourseLinkRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorStudentCourseResponse>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/courses/${courseId}/reconfirm`, request, idempotent(idempotencyKey));
  }

  getInstructorStudentProfileContext(courseId: number, studentUserId: number): Promise<ApiResponse<InstructorStudentProfileContextResponse>> {
    return this.apiClient.get(`/v2/instructor/courses/${courseId}/students/${studentUserId}/profile-context`);
  }

  getDashboard(): Promise<ApiResponse<AdvisingOpenApiRead>> {
    return this.apiClient.get('/v2/advisor/dashboard');
  }

  getStudentHub(studentUserId: number): Promise<ApiResponse<AdvisorStudentHub>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/hub`);
  }

  listStudentPublishedReports(studentUserId: number, page = 0, size = 20): Promise<ApiResponse<AdvisingOpenApiRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/student-reports`, {params: {page, size}});
  }

  listConversations(page = 0, size = 20, filters: {q?: string; unreadOnly?: boolean} = {}): Promise<ApiResponse<AdvisingPage<AdvisorConversationSummary>>> {
    return this.apiClient.get('/v2/advisor/conversations', {params: {page, size, ...filters}});
  }

  listConversationMessages(studentUserId: number, beforeId?: number): Promise<ApiResponse<AdvisingOpenApiRead>> {
    const url = `/v2/advisor/students/${studentUserId}/conversation/messages`;
    return beforeId == null ? this.apiClient.get(url) : this.apiClient.get(url, {params: {beforeId}});
  }

  sendConversationMessage(studentUserId: number, request: SendAdvisorMessageRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisingOpenApiRead>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/conversation/messages`, request, idempotent(idempotencyKey));
  }

  sendConversationMessageMultipart(studentUserId: number, request: SendAdvisorMessageMultipartRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisingOpenApiRead>> {
    const form = new FormData();
    form.append('clientMessageId', request.clientMessageId);
    if (request.body) form.append('body', request.body);
    request.files?.forEach(file => form.append('files', file));
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/conversation/messages`, form, idempotent(idempotencyKey));
  }

  markConversationRead(studentUserId: number, request: MarkConversationReadRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/conversation/read`, request, idempotent(idempotencyKey));
  }

  listOwnConversationMessages(beforeId?: number): Promise<ApiResponse<AdvisingOpenApiRead>> {
    const url = '/v2/student/advisor-conversation/messages';
    return beforeId == null ? this.apiClient.get(url) : this.apiClient.get(url, {params: {beforeId}});
  }

  sendOwnConversationMessage(request: SendAdvisorMessageRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisingOpenApiRead>> {
    return this.apiClient.post('/v2/student/advisor-conversation/messages', request, idempotent(idempotencyKey));
  }

  sendOwnConversationMessageMultipart(request: SendAdvisorMessageMultipartRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisingOpenApiRead>> {
    const form = new FormData();
    form.append('clientMessageId', request.clientMessageId);
    if (request.body) form.append('body', request.body);
    request.files?.forEach(file => form.append('files', file));
    return this.apiClient.post('/v2/student/advisor-conversation/messages', form, idempotent(idempotencyKey));
  }

  markOwnConversationRead(request: MarkConversationReadRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.post('/v2/student/advisor-conversation/read', request, idempotent(idempotencyKey));
  }

  private async getConversationAttachment(url: string): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(url, {responseType: 'blob'});
    return response.data;
  }

  previewConversationAttachment(studentUserId: number, attachmentId: number): Promise<Blob> {
    return this.getConversationAttachment(`/v2/advisor/students/${studentUserId}/conversation/attachments/${attachmentId}/preview`);
  }

  downloadConversationAttachment(studentUserId: number, attachmentId: number): Promise<Blob> {
    return this.getConversationAttachment(`/v2/advisor/students/${studentUserId}/conversation/attachments/${attachmentId}/download`);
  }

  previewOwnConversationAttachment(attachmentId: number): Promise<Blob> {
    return this.getConversationAttachment(`/v2/student/advisor-conversation/attachments/${attachmentId}/preview`);
  }

  downloadOwnConversationAttachment(attachmentId: number): Promise<Blob> {
    return this.getConversationAttachment(`/v2/student/advisor-conversation/attachments/${attachmentId}/download`);
  }

  listActionTasks(params: {status?: string; priority?: string; type?: string; studentType?: string; studentUserId?: number; page?: number; size?: number} = {}): Promise<ApiResponse<AdvisingPage<AdvisorActionTaskResponse>>> {
    return this.apiClient.get('/v2/advisor/action-tasks', {params});
  }

  getActionTask(taskId: number): Promise<ApiResponse<AdvisorActionTaskResponse>> {
    return this.apiClient.get(`/v2/advisor/action-tasks/${taskId}`);
  }

  startActionTask(taskId: number, request: ActionTaskMutationRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorActionTaskResponse>> {
    return this.apiClient.post(`/v2/advisor/action-tasks/${taskId}/start`, request, idempotent(idempotencyKey));
  }

  resolveActionTask(taskId: number, request: ActionTaskMutationRequest, idempotencyKey: string = crypto.randomUUID()): Promise<ApiResponse<AdvisorActionTaskResponse>> {
    return this.apiClient.post(`/v2/advisor/action-tasks/${taskId}/resolve`, request, idempotent(idempotencyKey));
  }
}

export const advisorApiService = new AdvisorApiService();
