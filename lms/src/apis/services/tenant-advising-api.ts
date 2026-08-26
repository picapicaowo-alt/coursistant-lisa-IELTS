import {
  AdvisingPage,
  ApiResponse,
  AssignAdvisorRequest,
  CancelStudentIntakeRequest,
  ReassignAdvisorRequest,
  StudentIntakeResponse,
  TenantIntakeListParams,
  TenantStudentProfileResponse,
  TenantStudyPlanResponse,
  StudyPlanRevisionResponse,
  idempotent,
  V2ApiClient,
} from '@/apis';

export class TenantAdvisingApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  listStudentIntakes(params: TenantIntakeListParams = {}): Promise<ApiResponse<AdvisingPage<StudentIntakeResponse>>> {
    return this.apiClient.get('/v2/tenant/student-intakes', {params});
  }

  assignAdvisor(
    intakeId: number,
    request: AssignAdvisorRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.put(
      `/v2/tenant/student-intakes/${intakeId}/advisor`,
      request,
      idempotent(idempotencyKey),
    );
  }

  reassignAdvisor(
    studentUserId: number,
    request: ReassignAdvisorRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.put(
      `/v2/tenant/students/${studentUserId}/advisor`,
      request,
      idempotent(idempotencyKey),
    );
  }

  cancelStudentIntake(
    intakeId: number,
    request: CancelStudentIntakeRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.post(
      `/v2/tenant/student-intakes/${intakeId}/cancel`,
      request,
      idempotent(idempotencyKey),
    );
  }

  getStudentProfile(studentUserId: number): Promise<ApiResponse<TenantStudentProfileResponse>> {
    return this.apiClient.get(`/v2/tenant/students/${studentUserId}/profile`);
  }

  getStudentStudyPlan(studentUserId: number): Promise<ApiResponse<TenantStudyPlanResponse>> {
    return this.apiClient.get(`/v2/tenant/students/${studentUserId}/study-plan`);
  }

  listStudyPlanRevisions(
    studentUserId: number,
    page = 0,
    size = 20,
  ): Promise<ApiResponse<AdvisingPage<StudyPlanRevisionResponse>>> {
    return this.apiClient.get(`/v2/tenant/students/${studentUserId}/study-plan/revisions`, {params: {page, size}});
  }
}

export const tenantAdvisingApiService = new TenantAdvisingApiService();
