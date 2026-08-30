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
  username: string;
  name: string;
  avatar: string | null;
  role: LoginAccountType;
  level: UserLevel;
  email: string;
  mustChangePassword: boolean;
  emailNotifications: boolean;
  status: 'ACTIVE' | 'DISABLED';
  authVersion: number;
}

export interface CreateManagedUserRequest {
  email: string;
  name: string;
  role: 'USER' | 'TENANT_ADMIN';
  level?: UserLevel;
  tenantId?: number;
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
