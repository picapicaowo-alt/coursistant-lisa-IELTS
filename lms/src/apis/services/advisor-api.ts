import {
  AdvisingPage,
  AdvisorStudentProfileResponse,
  AdvisorStudentSummaryResponse,
  AdvisorStudyPlanResponse,
  ApiResponse,
  CreateStudentProfileRequest,
  CreateStudyPlanRequest,
  StudentFacingProfileResponse,
  StudentFacingStudyPlanResponse,
  StudentIntakeResponse,
  StudyPlanRevisionResponse,
  UpdateStudentProfileRequest,
  UpdateStudyPlanRequest,
  idempotent,
  V2ApiClient,
} from '@/apis';

export class AdvisorApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  listStudents(page = 0, size = 20): Promise<ApiResponse<AdvisingPage<AdvisorStudentSummaryResponse>>> {
    return this.apiClient.get('/v2/advisor/students', {params: {page, size}});
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

  getOwnProfile(): Promise<ApiResponse<StudentFacingProfileResponse>> {
    return this.apiClient.get('/v2/student/profile');
  }

  getOwnStudyPlan(): Promise<ApiResponse<StudentFacingStudyPlanResponse>> {
    return this.apiClient.get('/v2/student/study-plan');
  }
}

export const advisorApiService = new AdvisorApiService();
