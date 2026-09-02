import type {
  ApiResponse,
  CreateMockExamListeningRequest,
  CreateMockExamReadingRequest,
  CreateMockExamTemplateRequest,
  CreateMockExamWritingRequest,
  CreateStudentMockExamRequest,
  GradeMockExamWritingRequest,
  MockExamRead,
  ObserverMockExamDetail,
  MockExamTemplateSummary,
  SubmitMockExamListeningRequest,
  SubmitMockExamReadingRequest,
  SubmitMockExamWritingRequest,
  StudentMockExamDetail,
} from '@/apis';
import {idempotent, V2ApiClient} from '@/apis';

type MockExamSection = 'listening' | 'reading' | 'writing';

export class MockExamApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  listAdvisorTemplates(page = 0, size = 20): Promise<ApiResponse<MockExamTemplateSummary[]>> {
    return this.apiClient.get('/v2/advisor/mock-exam-templates', {params: {page, size}});
  }

  getAdvisorTemplate(templateId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/advisor/mock-exam-templates/${templateId}`);
  }

  listAdvisorStudentExams(studentUserId: number, page = 0, size = 20): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/mock-exams`, {params: {page, size}});
  }

  createAdvisorStudentExam(studentUserId: number, request: CreateStudentMockExamRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/advisor/students/${studentUserId}/mock-exams`, request, idempotent(key));
  }

  getAdvisorStudentExam(studentUserId: number, studentMockExamId: number): Promise<ApiResponse<ObserverMockExamDetail>> {
    return this.apiClient.get(`/v2/advisor/students/${studentUserId}/mock-exams/${studentMockExamId}`);
  }

  listInstructorWritingGrades(page = 0, size = 20): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get('/v2/instructor/mock-exams/writing-grades', {params: {page, size}});
  }

  getInstructorWritingGrade(gradeId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/instructor/mock-exams/writing-grades/${gradeId}`);
  }

  gradeInstructorWriting(gradeId: number, request: GradeMockExamWritingRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/instructor/mock-exams/writing-grades/${gradeId}`, request, idempotent(key));
  }

  listParentStudentExams(studentUserId: number, page = 0, size = 20): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/mock-exams`, {params: {page, size}});
  }

  getParentStudentExam(studentUserId: number, studentMockExamId: number): Promise<ApiResponse<ObserverMockExamDetail>> {
    return this.apiClient.get(`/v2/parent/students/${studentUserId}/mock-exams/${studentMockExamId}`);
  }

  listStudentExams(page = 0, size = 20): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get('/v2/student/mock-exams', {params: {page, size}});
  }

  getStudentExam(studentMockExamId: number): Promise<ApiResponse<StudentMockExamDetail>> {
    return this.apiClient.get(`/v2/student/mock-exams/${studentMockExamId}`);
  }

  createStudentAttempt(studentMockExamId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/student/mock-exams/${studentMockExamId}/attempts`, undefined, idempotent(key));
  }

  submitStudentListening(studentMockExamId: number, attemptId: number, request: SubmitMockExamListeningRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/student/mock-exams/${studentMockExamId}/attempts/${attemptId}/listening-submissions`, request, idempotent(key));
  }

  submitStudentReading(studentMockExamId: number, attemptId: number, request: SubmitMockExamReadingRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/student/mock-exams/${studentMockExamId}/attempts/${attemptId}/reading-submissions`, request, idempotent(key));
  }

  submitStudentWriting(studentMockExamId: number, attemptId: number, request: SubmitMockExamWritingRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/student/mock-exams/${studentMockExamId}/attempts/${attemptId}/writing-submissions`, request, idempotent(key));
  }

  getStudentSection(studentMockExamId: number, section: MockExamSection): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/student/mock-exams/${studentMockExamId}/${section}`);
  }

  getSystemExams(page = 0, size = 20): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get('/v2/system/mock-exams', {params: {page, size}});
  }

  getSystemExam(testId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/system/mock-exams/${testId}`);
  }

  getSystemSection(testId: number, section: MockExamSection): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/system/mock-exams/${testId}/${section}`);
  }

  listTenantTemplates(): Promise<ApiResponse<MockExamTemplateSummary[]>> {
    return this.apiClient.get('/v2/tenant/mock-exam-templates');
  }

  createTenantTemplate(request: CreateMockExamTemplateRequest): Promise<ApiResponse<MockExamTemplateSummary>> {
    return this.apiClient.post('/v2/tenant/mock-exam-templates', request);
  }

  getTenantTemplate(templateId: number): Promise<ApiResponse<MockExamTemplateSummary>> {
    return this.apiClient.get(`/v2/tenant/mock-exam-templates/${templateId}`);
  }

  deleteTenantDraft(templateId: number, versionId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}`);
  }

  getTenantVersion(templateId: number, versionId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}`);
  }

  archiveTenantVersion(templateId: number, versionId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/archive`);
  }

  copyTenantVersion(templateId: number, versionId: number, sourceVersionId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/copies`, {sourceVersionId});
  }

  publishTenantVersion(templateId: number, versionId: number): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/publish`);
  }

  getTenantSection(templateId: number, versionId: number, section: MockExamSection): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.get(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/${section}`);
  }

  createTenantListening(templateId: number, versionId: number, request: CreateMockExamListeningRequest): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/listening`, request);
  }

  createTenantReading(templateId: number, versionId: number, request: CreateMockExamReadingRequest): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/reading`, request);
  }

  createTenantWriting(templateId: number, versionId: number, request: CreateMockExamWritingRequest): Promise<ApiResponse<MockExamRead>> {
    return this.apiClient.post(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/writing`, request);
  }

  private async getMedia(url: string): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(url, {responseType: 'blob'});
    return response.data;
  }

  getStudentListeningAudio(studentMockExamId: number, partSeq: number): Promise<Blob> {
    return this.getMedia(`/v2/student/mock-exams/${studentMockExamId}/listening/parts/${partSeq}/audio`);
  }

  getStudentReadingImage(studentMockExamId: number, passageSeq: number, sortOrder: number): Promise<Blob> {
    return this.getMedia(`/v2/student/mock-exams/${studentMockExamId}/reading/passages/${passageSeq}/questions/${sortOrder}/image`);
  }

  getStudentWritingImage(studentMockExamId: number, taskSeq: number): Promise<Blob> {
    return this.getMedia(`/v2/student/mock-exams/${studentMockExamId}/writing/tasks/${taskSeq}/image`);
  }

  getSystemListeningAudio(testId: number, partSeq: number): Promise<Blob> {
    return this.getMedia(`/v2/system/mock-exams/${testId}/listening/parts/${partSeq}/audio`);
  }

  getSystemReadingImage(testId: number, passageSeq: number, sortOrder: number): Promise<Blob> {
    return this.getMedia(`/v2/system/mock-exams/${testId}/reading/passages/${passageSeq}/questions/${sortOrder}/image`);
  }

  getSystemWritingImage(testId: number, taskSeq: number): Promise<Blob> {
    return this.getMedia(`/v2/system/mock-exams/${testId}/writing/tasks/${taskSeq}/image`);
  }

  getTenantListeningAudio(templateId: number, versionId: number, partSeq: number): Promise<Blob> {
    return this.getMedia(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/listening/parts/${partSeq}/audio`);
  }

  getTenantReadingImage(templateId: number, versionId: number, passageSeq: number, sortOrder: number): Promise<Blob> {
    return this.getMedia(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/reading/passages/${passageSeq}/questions/${sortOrder}/image`);
  }

  getTenantWritingImage(templateId: number, versionId: number, taskSeq: number): Promise<Blob> {
    return this.getMedia(`/v2/tenant/mock-exam-templates/${templateId}/versions/${versionId}/writing/tasks/${taskSeq}/image`);
  }
}

export const mockExamApiService = new MockExamApiService();
