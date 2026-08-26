import type {LoginAccountType, LoginResponse, UserLevel} from '@/apis';

export const isCounsellorLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'COUNSELLOR';

export const isAdvisorLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'ADVISOR' || level === 'INSTRUCTOR_ADVISOR';

export const isStudentLevel = (level: UserLevel | null | undefined): boolean =>
  level === 'STUDENT';

export const isTenantAdminRole = (role: LoginAccountType): boolean =>
  role === 'TENANT_ADMIN';

/**
 * Post-login home. Counsellor and Advisor get the new advising verticals.
 * Other USER accounts keep the course LMS. Non-USER accounts keep /course,
 * except TENANT_ADMIN which now lands on intake operations.
 */
export const getSignedInHomePath = (user: Pick<LoginResponse, 'role' | 'level'>): string => {
  if (user.role === 'TENANT_ADMIN') return '/admin/intakes';
  if (user.role !== 'USER') return '/course';
  if (isCounsellorLevel(user.level)) return '/counsellor';
  if (isAdvisorLevel(user.level)) return '/advisor/students';
  return '/';
};
