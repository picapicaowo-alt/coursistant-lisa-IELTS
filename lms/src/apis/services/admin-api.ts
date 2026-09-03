import {
  AdminTenant,
  AdminTenantPayload,
  AdminDirectoryQuery,
  AdminDirectoryRead,
  ApiResponse,
  AssignmentGradeCorrectionRequest,
  ChangeManagedUserRoleRequest,
  ChangeUserTenantRequest,
  CourseResponse,
  CreateManagedUserRequest,
  idempotent,
  ManagedUser,
  ManagedUserDisableBlockersResponse,
  PatchTenantManagedUserRequest,
  ReassignPrimaryInstructorRequest,
  TenantAuditEventParams,
  TenantAuditEventPage,
  TenantUserDirectoryPage,
  TenantUserDirectoryParams,
  V2ApiClient,
} from '@/apis';

/**
 * Frontend transport for privileged administration operations.
 *
 * The authenticated role chooses the endpoint scope; the API remains the
 * authority for tenant membership and every destructive-operation constraint.
 */
export class AdminApiService {
  private apiClient = V2ApiClient;

  constructor(apiClient?: typeof V2ApiClient) {
    if (apiClient) this.apiClient = apiClient;
  }

  listTenants(): Promise<ApiResponse<AdminTenant[]>> {
    return this.apiClient.get('/v2/admin/tenants');
  }

  createTenant(request: AdminTenantPayload): Promise<ApiResponse<AdminTenant>> {
    return this.apiClient.post('/v2/admin/tenants', request, idempotent());
  }

  updateTenant(tenantId: number, request: Partial<AdminTenantPayload>): Promise<ApiResponse<AdminTenant>> {
    return this.apiClient.patch(`/v2/admin/tenants/${tenantId}`, request, idempotent());
  }

  deleteTenant(tenantId: number): Promise<ApiResponse<void>> {
    return this.apiClient.delete(`/v2/admin/tenants/${tenantId}`, idempotent());
  }

  listUsers(): Promise<ApiResponse<ManagedUser[]>> {
    return this.apiClient.get('/v2/users');
  }

  listTenantUsers(params: TenantUserDirectoryParams = {}): Promise<ApiResponse<TenantUserDirectoryPage>> {
    if (!params.levels?.length) return this.apiClient.get('/v2/tenant/users', {params});

    const search = new URLSearchParams();
    Object.entries(params).forEach(([name, value]) => {
      if (name === 'levels' || value == null || value === '') return;
      search.append(name, String(value));
    });
    params.levels.forEach(level => search.append('levels', level));
    return this.apiClient.get('/v2/tenant/users', {params: search});
  }

  getTenantUser(userId: number): Promise<ApiResponse<ManagedUser>> {
    return this.apiClient.get(`/v2/tenant/users/${userId}`);
  }

  listTenantAuditEvents(params: TenantAuditEventParams = {}): Promise<ApiResponse<TenantAuditEventPage>> {
    return this.apiClient.get('/v2/tenant/audit-events', {params});
  }

  getUser(userId: number): Promise<ApiResponse<ManagedUser>> {
    return this.apiClient.get(`/v2/users/${userId}`);
  }

  listAdmins(query: AdminDirectoryQuery = {}): Promise<ApiResponse<AdminDirectoryRead>> {
    return this.apiClient.get('/v2/admins', {params: {query}});
  }

  getAdmin(adminId: number): Promise<ApiResponse<AdminDirectoryRead>> {
    return this.apiClient.get(`/v2/admins/${adminId}`);
  }

  createManagedUser(scope: 'system' | 'tenant', request: CreateManagedUserRequest): Promise<ApiResponse<number>> {
    // Callers derive scope from the authenticated admin role. It must never
    // come from a form value or other user-controlled input.
    return this.apiClient.post(`/v2/${scope}/managed-users`, request, idempotent());
  }

  createTenantManagedUser(request: CreateManagedUserRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<number>> {
    return this.apiClient.post('/v2/tenant/managed-users', request, idempotent(key));
  }

  patchTenantManagedUser(userId: number, request: PatchTenantManagedUserRequest, key: string): Promise<ApiResponse<ManagedUser>> {
    return this.apiClient.patch(`/v2/tenant/managed-users/${userId}`, request, idempotent(key));
  }

  getTenantManagedUserDisableBlockers(userId: number): Promise<ApiResponse<ManagedUserDisableBlockersResponse>> {
    return this.apiClient.get(`/v2/tenant/managed-users/${userId}/disable-blockers`);
  }

  changeManagedUserRole(scope: 'system' | 'tenant', userId: number, request: ChangeManagedUserRoleRequest): Promise<ApiResponse<void>> {
    return this.apiClient.put(`/v2/${scope}/managed-users/${userId}/role`, request, idempotent());
  }

  changeTenantManagedUserRole(userId: number, request: ChangeManagedUserRoleRequest, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.put(`/v2/tenant/managed-users/${userId}/role`, request, idempotent(key));
  }

  disableManagedUser(scope: 'system' | 'tenant', userId: number): Promise<ApiResponse<void>> {
    return this.apiClient.post(`/v2/${scope}/managed-users/${userId}/disable`, undefined, idempotent());
  }

  disableTenantManagedUser(userId: number, key: string = crypto.randomUUID()): Promise<ApiResponse<void>> {
    return this.apiClient.post(`/v2/tenant/managed-users/${userId}/disable`, undefined, idempotent(key));
  }

  enableTenantManagedUser(userId: number): Promise<ApiResponse<void>> {
    return this.apiClient.post(`/v2/tenant/managed-users/${userId}/enable`);
  }

  changeUserTenant(userId: number, request: ChangeUserTenantRequest): Promise<ApiResponse<ManagedUser>> {
    return this.apiClient.patch(`/v2/admin/users/${userId}/tenant`, request, idempotent());
  }

  reassignPrimaryInstructor(courseId: number, request: ReassignPrimaryInstructorRequest): Promise<ApiResponse<CourseResponse>> {
    return this.apiClient.post(`/v2/courses/${courseId}/primary-instructor`, request, idempotent());
  }

  correctAssignmentGrade(request: AssignmentGradeCorrectionRequest): Promise<ApiResponse<void>> {
    return this.apiClient.post('/v2/system/grade-corrections/assignments', request, idempotent());
  }
}

export const adminApiService = new AdminApiService();
