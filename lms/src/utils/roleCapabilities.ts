import type {LoginResponse} from '@/apis';

type Identity = Pick<LoginResponse, 'role' | 'level'>;

const hasUserLevel = (
  identity: Identity,
  levels: ReadonlyArray<NonNullable<LoginResponse['level']>>,
): boolean => identity.role === 'USER'
  && identity.level !== null
  && levels.includes(identity.level);

export const isCounsellorAccount = (identity: Identity): boolean =>
  hasUserLevel(identity, ['COUNSELLOR']);

export const isAdvisorAccount = (identity: Identity): boolean =>
  hasUserLevel(identity, ['ADVISOR', 'INSTRUCTOR_ADVISOR']);

export const isStudentAccount = (identity: Identity): boolean =>
  hasUserLevel(identity, ['STUDENT']);

export const isParentAccount = (identity: Identity): boolean =>
  hasUserLevel(identity, ['PARENT']);

export const isTenantAdminAccount = (identity: Identity): boolean =>
  identity.role === 'TENANT_ADMIN';

export const isSystemAdminAccount = (identity: Identity): boolean =>
  identity.role === 'SYSTEM_ADMIN';

export const isInstructorLevel = (identity: Identity): boolean =>
  hasUserLevel(identity, ['INSTRUCTOR', 'INSTRUCTOR_ADVISOR']);

export const isPureAdvisor = (identity: Identity): boolean =>
  hasUserLevel(identity, ['ADVISOR']);

export const canAccessDashboard = (identity: Identity): boolean =>
  hasUserLevel(identity, ['STUDENT', 'INSTRUCTOR']);

export const canAccessCourseCatalogue = (identity: Identity): boolean => {
  if (isSystemAdminAccount(identity)) return true;
  return hasUserLevel(identity, ['STUDENT', 'INSTRUCTOR', 'INSTRUCTOR_ADVISOR']);
};

/** Course enrollment and roster HTTP responses decide access inside the page. */
export const canAccessCourseRoster = (identity: Identity): boolean =>
  canAccessCourseCatalogue(identity) || isAdvisorAccount(identity);

/** Generic course creation is system-scoped; Advisor 1:1 creation has its own route. */
export const canCreateCourses = (identity: Identity): boolean =>
  isSystemAdminAccount(identity);

export const canAccessCalendar = (identity: Identity): boolean =>
  hasUserLevel(identity, ['STUDENT', 'INSTRUCTOR', 'INSTRUCTOR_ADVISOR']);

/** No AI operation is delivered in the training product's current role contracts. */
export const canAccessAiWorkspace = (_identity: Identity): boolean => false;

export const canAccessCourseAuthoringTools = (identity: Identity): boolean =>
  isSystemAdminAccount(identity) || isInstructorLevel(identity);

export const canAccessAdminConsole = (identity: Identity): boolean =>
  isSystemAdminAccount(identity) || isTenantAdminAccount(identity);

/** Tenant Admin self-service is limited to the auth contract's password flow. */
export const canAccessSelfProfile = (identity: Identity): boolean =>
  !isTenantAdminAccount(identity);

export const canAccessMyOperations = (identity: Identity): boolean =>
  identity.role === 'USER'
    && (identity.level === 'STUDENT' || identity.level === 'INSTRUCTOR' || identity.level === 'INSTRUCTOR_ADVISOR');

export const canAccessCourseOperations = (
  identity: Identity,
  courseRole: string | null | undefined,
): boolean => {
  if (isSystemAdminAccount(identity)) return true;
  return canAccessCourseCatalogue(identity) && (courseRole === 'Instructor' || courseRole === 'TA');
};

/** Parent mock-exam reads live inside the linked-student Parent portal. */
export const canAccessStandaloneMockExams = (identity: Identity): boolean => {
  if (isSystemAdminAccount(identity) || isTenantAdminAccount(identity)) return true;
  return hasUserLevel(identity, ['STUDENT', 'ADVISOR', 'INSTRUCTOR', 'INSTRUCTOR_ADVISOR']);
};

/** Only students can enter the timed candidate workspace backed by student endpoints. */
export const canTakeMockExam = (identity: Identity): boolean =>
  isStudentAccount(identity);

export const canUseStudentLearningOperations = (identity: Identity): boolean =>
  isStudentAccount(identity);

export const canUseTeachingOperations = (identity: Identity): boolean =>
  isInstructorLevel(identity);
