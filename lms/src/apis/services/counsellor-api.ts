import {
  AdvisingPage,
  AdvisorCandidateResponse,
  AssignAdvisorRequest,
  CounsellorDashboardResponse,
  CreateStudentIntakeRequest,
  PatchStudentIntakeRequest,
  StudentIntakeResponse,
  ApiResponse,
  idempotent,
  V2ApiClient,
} from '@/apis';

export class CounsellorApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  getDashboard(): Promise<ApiResponse<CounsellorDashboardResponse>> {
    return this.apiClient.get('/v2/counsellor/dashboard');
  }

  listStudentIntakes(page = 0, size = 20): Promise<ApiResponse<AdvisingPage<StudentIntakeResponse>>> {
    return this.apiClient.get('/v2/counsellor/student-intakes', {params: {page, size}});
  }

  getStudentIntake(intakeId: number): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.get(`/v2/counsellor/student-intakes/${intakeId}`);
  }

  createStudentIntake(
    request: CreateStudentIntakeRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.post('/v2/counsellor/student-intakes', request, idempotent(idempotencyKey));
  }

  patchStudentIntake(
    intakeId: number,
    request: PatchStudentIntakeRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.patch(`/v2/counsellor/student-intakes/${intakeId}`, request, idempotent(idempotencyKey));
  }

  listAdvisors(page = 0, size = 20): Promise<ApiResponse<AdvisingPage<AdvisorCandidateResponse>>> {
    return this.apiClient.get('/v2/counsellor/advisors', {params: {page, size}});
  }

  assignAdvisor(
    intakeId: number,
    request: AssignAdvisorRequest,
    idempotencyKey: string,
  ): Promise<ApiResponse<StudentIntakeResponse>> {
    return this.apiClient.put(
      `/v2/counsellor/student-intakes/${intakeId}/advisor`,
      request,
      idempotent(idempotencyKey),
    );
  }
}

export const counsellorApiService = new CounsellorApiService();
