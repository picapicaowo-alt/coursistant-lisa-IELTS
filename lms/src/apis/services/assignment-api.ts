import {
  ApiResponse,
  AssignmentAttachment,
  AssignmentAttachmentManifestItem,
  AssignmentDetail,
  AssignmentListRead,
  AssignmentSummary,
  CreateAssignmentPayload,
  DueDateChangePreview,
  GradeRecord,
  GradeSelectionPayload,
  GradingRoster,
  GradingView,
  MyGradeItem,
  PatchAssignmentPayload,
  RubricState,
  StagingFile,
  SubmissionVersion,
  SubmissionState,
  SubmitAssignmentPayload,
  UpsertGradePayload,
  V2ApiClient
} from "@/apis";
import {idempotent} from '@/apis/types/common';
import {normalizeCourseLocalDateTime} from '@/utils/courseLocalDateTime';

type AssignmentDeadlineFields = {
  dueAt?: string;
  lateUntil?: string;
};

const normalizeDeadlineFields = <Request extends AssignmentDeadlineFields>(request: Request): Request => {
  let normalizedRequest = request;

  for (const field of ['dueAt', 'lateUntil'] as const) {
    if (request[field] === undefined) continue;
    const normalizedValue = normalizeCourseLocalDateTime(request[field]);
    if (!normalizedValue) {
      throw new TypeError(`${field} must be a valid course-local date-time without a timezone or fractional seconds.`);
    }
    normalizedRequest = {...normalizedRequest, [field]: normalizedValue};
  }

  return normalizedRequest;
};

export class AssignmentApiService {
  private apiClient = V2ApiClient;
  
  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) {
      this.apiClient = apiClient;
    }
  }
  
  /**
   * Assignment list cards for a course, ordered by due date.
   *
   * The slim endpoint rather than `/assignments`, which returns every field
   * including descriptions and attachments — far more than a list needs.
   */
  async getCourseAssignmentSummaries(courseId: number): Promise<ApiResponse<AssignmentSummary[]>> {
    try {
      return await this.apiClient.get<AssignmentSummary[]>(
        `/v2/courses/${courseId}/assignments/summaries`
      );
    } catch (error) {
      console.error(`Failed to get assignment summaries for courseId: ${courseId}`, error);
      throw error;
    }
  }

  listAssignments(courseId: number): Promise<ApiResponse<AssignmentListRead>> {
    return this.apiClient.get(`/v2/courses/${courseId}/assignments`);
  }

  listAssignmentAttachmentManifest(courseId: number): Promise<ApiResponse<AssignmentAttachmentManifestItem[]>> {
    return this.apiClient.get(`/v2/courses/${courseId}/assignment-attachments`);
  }

  /** Role-shaped assignment detail from the current 8081 contract. */
  async getAssignment(courseId: number, assignmentId: number): Promise<ApiResponse<AssignmentDetail>> {
    return this.apiClient.get<AssignmentDetail>(
      `/v2/courses/${courseId}/assignments/${assignmentId}`
    );
  }

  async createAssignment(
    courseId: number,
    request: CreateAssignmentPayload,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<AssignmentDetail>> {
    return this.apiClient.post<AssignmentDetail>(
      `/v2/courses/${courseId}/assignments`,
      normalizeDeadlineFields(request),
      idempotent(idempotencyKey),
    );
  }

  async patchAssignment(
    courseId: number,
    assignmentId: number,
    request: PatchAssignmentPayload,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<AssignmentDetail>> {
    if (!Number.isInteger(request.expectedVersion)) {
      throw new TypeError('expectedVersion is required when patching an assignment.');
    }
    return this.apiClient.patch<AssignmentDetail>(
      `/v2/courses/${courseId}/assignments/${assignmentId}`,
      normalizeDeadlineFields(request),
      idempotent(idempotencyKey)
    );
  }

  async publishAssignment(
    courseId: number,
    assignmentId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<AssignmentDetail>> {
    return this.apiClient.post<AssignmentDetail>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/publish`,
      undefined,
      idempotent(idempotencyKey)
    );
  }

  async unpublishAssignment(
    courseId: number,
    assignmentId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<AssignmentDetail>> {
    return this.apiClient.post<AssignmentDetail>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/unpublish`,
      undefined,
      idempotent(idempotencyKey)
    );
  }

  async deleteAssignment(
    courseId: number,
    assignmentId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/courses/${courseId}/assignments/${assignmentId}`, idempotent(idempotencyKey));
  }

  async previewDueDateChange(
    courseId: number,
    assignmentId: number,
    request: {dueAt: string; lateUntil?: string; clearLateUntil?: boolean},
  ): Promise<ApiResponse<DueDateChangePreview>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/assignments/${assignmentId}/due-date-change-preview`,
      normalizeDeadlineFields(request),
    );
  }

  async getRubric(courseId: number, assignmentId: number): Promise<ApiResponse<RubricState>> {
    return this.apiClient.get(`/v2/courses/${courseId}/assignments/${assignmentId}/rubric`);
  }

  async uploadRubric(courseId: number, assignmentId: number, file: File, confirmReplaceAfterGrading = false): Promise<ApiResponse<RubricState>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiClient.post(
      `/v2/courses/${courseId}/assignments/${assignmentId}/rubric`,
      formData,
      {params: {confirmReplaceAfterGrading}},
    );
  }

  private async getRubricBlob(courseId: number, assignmentId: number, action: 'preview' | 'download'): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/rubric/${action}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  downloadRubric(courseId: number, assignmentId: number): Promise<Blob> {
    return this.getRubricBlob(courseId, assignmentId, 'download');
  }

  previewRubric(courseId: number, assignmentId: number): Promise<Blob> {
    return this.getRubricBlob(courseId, assignmentId, 'preview');
  }

  async restorePreviousRubric(courseId: number, assignmentId: number, confirmReplaceAfterGrading = false): Promise<ApiResponse<RubricState>> {
    return this.apiClient.post(
      `/v2/courses/${courseId}/assignments/${assignmentId}/rubric/restore-previous`,
      undefined,
      {params: {confirmReplaceAfterGrading}},
    );
  }

  private async uploadAnnotatedFile(
    courseId: number,
    assignmentId: number,
    target: 'students' | 'groups',
    targetId: number,
    file: File,
  ): Promise<ApiResponse<GradeRecord>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.apiClient.post(
      `/v2/courses/${courseId}/assignments/${assignmentId}/${target}/${targetId}/grade/annotated-file`,
      formData,
    );
  }

  uploadStudentAnnotatedFile(courseId: number, assignmentId: number, studentUserId: number, file: File) {
    return this.uploadAnnotatedFile(courseId, assignmentId, 'students', studentUserId, file);
  }

  uploadGroupAnnotatedFile(courseId: number, assignmentId: number, groupId: number, file: File) {
    return this.uploadAnnotatedFile(courseId, assignmentId, 'groups', groupId, file);
  }

  private async downloadAnnotatedFile(courseId: number, assignmentId: number, target: 'students' | 'groups', targetId: number): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/${target}/${targetId}/grade/annotated-file`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  downloadStudentAnnotatedFile(courseId: number, assignmentId: number, studentUserId: number) {
    return this.downloadAnnotatedFile(courseId, assignmentId, 'students', studentUserId);
  }

  downloadGroupAnnotatedFile(courseId: number, assignmentId: number, groupId: number) {
    return this.downloadAnnotatedFile(courseId, assignmentId, 'groups', groupId);
  }

  async getGradingRoster(
    courseId: number,
    assignmentId: number
  ): Promise<ApiResponse<GradingRoster>> {
    return this.apiClient.get<GradingRoster>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/grading-roster`
    );
  }

  async listMyGrades(courseId: number): Promise<ApiResponse<MyGradeItem[]>> {
    return this.apiClient.get<MyGradeItem[]>(`/v2/courses/${courseId}/my-grades`);
  }

  async upsertStudentGrade(
    courseId: number,
    assignmentId: number,
    studentUserId: number,
    request: UpsertGradePayload
  ): Promise<ApiResponse<GradeRecord>> {
    return this.apiClient.put<GradeRecord>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/students/${studentUserId}/grade`,
      request
    );
  }

  async upsertGroupGrade(
    courseId: number,
    assignmentId: number,
    groupId: number,
    request: UpsertGradePayload
  ): Promise<ApiResponse<GradeRecord>> {
    return this.apiClient.put<GradeRecord>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/groups/${groupId}/grade`,
      request
    );
  }

  async releaseGrades(
    courseId: number,
    assignmentId: number,
    request: GradeSelectionPayload,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<GradingRoster>> {
    return this.apiClient.post<GradingRoster>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/grades/release`,
      request,
      idempotent(idempotencyKey),
    );
  }

  async releaseAllGrades(
    courseId: number,
    assignmentId: number,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<GradingRoster>> {
    return this.apiClient.post<GradingRoster>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/grades/release-all`,
      undefined,
      idempotent(idempotencyKey),
    );
  }

  async retractGrades(
    courseId: number,
    assignmentId: number,
    request: GradeSelectionPayload,
    idempotencyKey: string = crypto.randomUUID(),
  ): Promise<ApiResponse<GradingRoster>> {
    return this.apiClient.post<GradingRoster>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/grades/retract`,
      request,
      idempotent(idempotencyKey),
    );
  }

  async getStudentGradingView(
    courseId: number,
    assignmentId: number,
    studentUserId: number
  ): Promise<ApiResponse<GradingView>> {
    return this.apiClient.get<GradingView>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/students/${studentUserId}/grading`
    );
  }

  async getGroupGradingView(
    courseId: number,
    assignmentId: number,
    groupId: number
  ): Promise<ApiResponse<GradingView>> {
    return this.apiClient.get<GradingView>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/groups/${groupId}/grading`
    );
  }

  async uploadAttachments(
    courseId: number,
    assignmentId: number,
    files: File[],
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<AssignmentAttachment[]>> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    return this.apiClient.post<AssignmentAttachment[]>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/attachments`,
      formData,
      idempotent(idempotencyKey)
    );
  }

  async deleteAttachment(
    courseId: number,
    assignmentId: number,
    attachmentId: number,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/attachments/${attachmentId}`,
      idempotent(idempotencyKey)
    );
  }

  private async getAttachmentBlob(
    courseId: number,
    assignmentId: number,
    attachmentId: number,
    action: 'preview' | 'download',
  ): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/attachments/${attachmentId}/${action}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  downloadAttachment(courseId: number, assignmentId: number, attachmentId: number): Promise<Blob> {
    return this.getAttachmentBlob(courseId, assignmentId, attachmentId, 'download');
  }

  previewAttachment(courseId: number, assignmentId: number, attachmentId: number): Promise<Blob> {
    return this.getAttachmentBlob(courseId, assignmentId, attachmentId, 'preview');
  }

  async getMySubmission(
    courseId: number,
    assignmentId: number
  ): Promise<ApiResponse<SubmissionState>> {
    return this.apiClient.get<SubmissionState>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submission`
    );
  }

  async listSubmissionVersions(
    courseId: number,
    assignmentId: number,
    submissionId: number,
  ): Promise<ApiResponse<SubmissionVersion[]>> {
    return this.apiClient.get(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/versions`,
    );
  }

  private async getSubmissionFileBlob(
    courseId: number,
    assignmentId: number,
    submissionId: number,
    fileId: number,
    action: 'download' | 'preview',
  ): Promise<Blob> {
    const response = await this.apiClient.getClient().get<Blob>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submissions/${submissionId}/files/${fileId}/${action}`,
      {responseType: 'blob'},
    );
    return response.data;
  }

  downloadSubmissionFile(
    courseId: number,
    assignmentId: number,
    submissionId: number,
    fileId: number,
  ): Promise<Blob> {
    return this.getSubmissionFileBlob(courseId, assignmentId, submissionId, fileId, 'download');
  }

  previewSubmissionFile(
    courseId: number,
    assignmentId: number,
    submissionId: number,
    fileId: number,
  ): Promise<Blob> {
    return this.getSubmissionFileBlob(courseId, assignmentId, submissionId, fileId, 'preview');
  }

  /** Active, not-yet-submitted files owned by the current student. */
  async listStagingFiles(
    courseId: number,
    assignmentId: number
  ): Promise<ApiResponse<StagingFile[]>> {
    return this.apiClient.get<StagingFile[]>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submission-staging-files`
    );
  }

  async uploadStagingFiles(
    courseId: number,
    assignmentId: number,
    files: File[],
    signal?: AbortSignal
  ): Promise<ApiResponse<StagingFile[]>> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    return this.apiClient.post<StagingFile[]>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submission-staging-files`,
      formData,
      signal ? {signal} : undefined
    );
  }

  async deleteStagingFile(
    courseId: number,
    assignmentId: number,
    stagingFileId: number
  ): Promise<ApiResponse<void>> {
    return this.apiClient.delete<void>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submission-staging-files/${stagingFileId}`
    );
  }

  async submitStagedFiles(
    courseId: number,
    assignmentId: number,
    request?: SubmitAssignmentPayload,
    idempotencyKey: string = crypto.randomUUID()
  ): Promise<ApiResponse<SubmissionState>> {
    return this.apiClient.post<SubmissionState>(
      `/v2/courses/${courseId}/assignments/${assignmentId}/submissions`,
      request,
      idempotent(idempotencyKey)
    );
  }
}

export const assignmentApiService = new AssignmentApiService();
