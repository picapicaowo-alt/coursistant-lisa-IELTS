import type {LoginResponse} from '@/apis';

type Identity = Pick<LoginResponse, 'role' | 'level'>;

export const isInstructorLevel = (identity: Identity): boolean =>
  identity.role === 'USER'
  && (identity.level === 'INSTRUCTOR' || identity.level === 'INSTRUCTOR_ADVISOR');

export const isPureAdvisor = (identity: Identity): boolean =>
  identity.role === 'USER' && identity.level === 'ADVISOR';

export const canAccessCourseCatalogue = (identity: Identity): boolean => {
  if (identity.role === 'SYSTEM_ADMIN' || identity.role === 'TENANT_ADMIN') return true;
  return identity.role === 'USER'
    && (identity.level === 'STUDENT' || identity.level === 'INSTRUCTOR' || identity.level === 'INSTRUCTOR_ADVISOR');
};

export const canAccessMyOperations = (identity: Identity): boolean =>
  identity.role === 'USER'
    && (identity.level === 'STUDENT' || identity.level === 'INSTRUCTOR' || identity.level === 'INSTRUCTOR_ADVISOR');

export const canAccessCourseOperations = (
  identity: Identity,
  courseRole: string | null | undefined,
): boolean => {
  if (identity.role === 'SYSTEM_ADMIN' || identity.role === 'TENANT_ADMIN') return true;
  return canAccessCourseCatalogue(identity) && (courseRole === 'Instructor' || courseRole === 'TA');
};

/** Parent mock-exam reads live inside the linked-student Parent portal. */
export const canAccessStandaloneMockExams = (identity: Identity): boolean => {
  if (identity.role === 'SYSTEM_ADMIN' || identity.role === 'TENANT_ADMIN') return true;
  return identity.role === 'USER'
    && ['STUDENT', 'ADVISOR', 'INSTRUCTOR', 'INSTRUCTOR_ADVISOR'].includes(identity.level ?? '');
};

/** Only students can enter the timed candidate workspace backed by student endpoints. */
export const canTakeMockExam = (identity: Identity): boolean =>
  identity.role === 'USER' && identity.level === 'STUDENT';

export const canUseStudentLearningOperations = (identity: Identity): boolean =>
  identity.role === 'USER' && identity.level === 'STUDENT';

export const canUseTeachingOperations = (identity: Identity): boolean =>
  isInstructorLevel(identity);
