import type {LoginAccountType, UserLevel} from './login';

export interface AdminTenant {
  id: number;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTenantPayload {
  name: string;
  timezone: string;
}

export interface ManagedUser {
  id: number;
  tenantId: number;
  username?: string;
  name?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  avatar?: string | null;
  role: LoginAccountType;
  level: UserLevel;
  email: string;
  mustChangePassword?: boolean;
  emailNotifications?: boolean;
  status: 'ACTIVE' | 'DISABLED';
  authVersion?: number;
  accountVersion?: number;
  phone?: string;
}

export interface CreateManagedUserRequest {
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  role: 'USER' | 'TENANT_ADMIN';
  level?: UserLevel;
  tenantId?: number;
}

export interface TenantUserDirectoryParams {
  q?: string;
  role?: string;
  level?: string;
  levels?: UserLevel[];
  status?: string;
  page?: number;
  size?: number;
}

export interface PatchTenantManagedUserRequest {
  expectedAccountVersion: number;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  email?: string;
  phone?: string | null;
}

export interface ManagedUserDisableBlocker {
  code?: string;
  type?: string;
  resourceId?: number | string;
  label?: string;
  message?: string;
}

export interface ManagedUserDisableBlockersResponse {
  canDisable: boolean;
  blockers: Array<string | ManagedUserDisableBlocker>;
}

export interface TenantUserDirectoryPage {
  items: ManagedUser[];
  page: number;
  size: number;
  total: number;
}

export interface TenantAuditEventParams {
  actorUserId?: number;
  targetUserId?: number;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface TenantAuditEvent {
  eventId: string;
  sourceType?: string;
  createdAt: string;
  actorUserId?: number;
  action: string;
  resourceType: string;
  targetUserId?: number;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

export interface TenantAuditEventPage {
  items: TenantAuditEvent[];
  page: number;
  size: number;
  total: number;
}

export interface ChangeManagedUserRoleRequest {
  role: 'USER' | 'TENANT_ADMIN';
  level?: UserLevel;
}

export interface ChangeUserTenantRequest {
  tenantId: number;
}

export interface ReassignPrimaryInstructorRequest {
  primaryInstructorUserId: number;
}

export interface AssignmentGradeCorrectionRequest {
  assignmentId: number;
  studentUserId: number;
  score: number;
  reason: string;
}

/** Query object accepted by GET /v2/admins. Every field is optional. */
export interface AdminDirectoryQuery {
  avatar?: string;
  email?: string;
  id?: number;
  name?: string;
  phone?: string;
  role?: string;
  status?: string;
  username?: string;
}

/** The supplied auth OpenAPI wraps admin reads in an untyped ApiResponse. */
export type AdminDirectoryRead = unknown;
