import type {LoginAccountType, LoginResponse, UserLevel} from '@/apis';
import {APP_ROUTE_PATHS} from '@/configs/routePaths';
import {
  canAccessDashboard,
  isAdvisorAccount,
  isCounsellorAccount,
  isParentAccount,
  isSystemAdminAccount,
  isTenantAdminAccount,
} from '@/utils/roleCapabilities';

export const isCounsellorLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'COUNSELLOR';

export const isAdvisorLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'ADVISOR' || level === 'INSTRUCTOR_ADVISOR';

export const isStudentLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'STUDENT';

export const isParentLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'PARENT';

export const isTenantAdminRole = (role: LoginAccountType): boolean =>
  role === 'TENANT_ADMIN';

/**
 * Post-login home. Counsellor and Advisor get the new advising verticals.
 * Other USER accounts keep the course LMS. Non-USER accounts keep /course,
 * Tenant Admin lands on its tenant-safe administration overview.
 */
export const getSignedInHomePath = (user: Pick<LoginResponse, 'role' | 'level'>): string => {
  if (isTenantAdminAccount(user)) return APP_ROUTE_PATHS.adminDashboard;
  if (isSystemAdminAccount(user)) return '/course';
  if (isCounsellorAccount(user)) return '/counsellor';
  if (isAdvisorAccount(user)) return '/advisor/students';
  if (isParentAccount(user)) return '/parent';
  if (canAccessDashboard(user)) return '/';
  // Unknown/legacy account combinations get only the authenticated profile,
  // never a business route whose first request is guaranteed to be forbidden.
  return '/profile';
};
