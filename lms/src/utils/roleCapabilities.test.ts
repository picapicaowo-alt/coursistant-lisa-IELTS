import {describe, expect, it} from 'vitest';
import {
  canAccessAdminConsole,
  canAccessAiWorkspace,
  canAccessCalendar,
  canAccessCourseCatalogue,
  canAccessCourseAuthoringTools,
  canAccessDashboard,
  canAccessCourseOperations,
  canAccessMyOperations,
  canAccessStandaloneMockExams,
  canCreateCourses,
  canTakeMockExam,
  canUseStudentLearningOperations,
  canUseTeachingOperations,
} from './roleCapabilities';

describe('role capabilities', () => {
  const identities = {
    systemAdmin: {role: 'SYSTEM_ADMIN' as const, level: null},
    tenantAdmin: {role: 'TENANT_ADMIN' as const, level: 'NOT_APPLICABLE' as const},
    counsellor: {role: 'USER' as const, level: 'COUNSELLOR' as const},
    advisor: {role: 'USER' as const, level: 'ADVISOR' as const},
    instructorAdvisor: {role: 'USER' as const, level: 'INSTRUCTOR_ADVISOR' as const},
    instructor: {role: 'USER' as const, level: 'INSTRUCTOR' as const},
    student: {role: 'USER' as const, level: 'STUDENT' as const},
    parent: {role: 'USER' as const, level: 'PARENT' as const},
    unsupported: {role: 'ADMIN' as const, level: null},
  };

  it.each([
    ['systemAdmin', false, true, false, false, false, true, true],
    ['tenantAdmin', false, false, false, false, false, true, true],
    ['counsellor', false, false, false, false, false, false, false],
    ['advisor', false, false, false, false, false, true, false],
    ['instructorAdvisor', false, true, true, false, true, true, false],
    ['instructor', true, true, true, false, true, true, false],
    ['student', true, true, true, false, true, true, false],
    ['parent', false, false, false, false, false, false, false],
    ['unsupported', false, false, false, false, false, false, false],
  ] as const)(
    'keeps %s navigation aligned with authorized endpoint families',
    (key, dashboard, courses, calendar, aiWorkspace, myOperations, mockExams, adminConsole) => {
      const identity = identities[key];
      expect(canAccessDashboard(identity)).toBe(dashboard);
      expect(canAccessCourseCatalogue(identity)).toBe(courses);
      expect(canAccessCalendar(identity)).toBe(calendar);
      expect(canAccessAiWorkspace(identity)).toBe(aiWorkspace);
      expect(canAccessMyOperations(identity)).toBe(myOperations);
      expect(canAccessStandaloneMockExams(identity)).toBe(mockExams);
      expect(canAccessAdminConsole(identity)).toBe(adminConsole);
    },
  );

  it('limits generic creation and authoring routes to their narrow roles', () => {
    expect(canCreateCourses(identities.systemAdmin)).toBe(true);
    expect(canCreateCourses(identities.instructor)).toBe(false);
    expect(canCreateCourses(identities.tenantAdmin)).toBe(false);
    expect(canAccessCourseAuthoringTools(identities.systemAdmin)).toBe(true);
    expect(canAccessCourseAuthoringTools(identities.instructor)).toBe(true);
    expect(canAccessCourseAuthoringTools(identities.instructorAdvisor)).toBe(true);
    expect(canAccessCourseAuthoringTools(identities.student)).toBe(false);
    expect(canAccessCourseAuthoringTools(identities.tenantAdmin)).toBe(false);
  });

  it('never trusts a platform level carried by a non-USER account', () => {
    const malformedTenantIdentity = {role: 'TENANT_ADMIN' as const, level: 'STUDENT' as const};
    expect(canAccessDashboard(malformedTenantIdentity)).toBe(false);
    expect(canAccessCourseCatalogue(malformedTenantIdentity)).toBe(false);
    expect(canAccessAiWorkspace(malformedTenantIdentity)).toBe(false);
    expect(canTakeMockExam(malformedTenantIdentity)).toBe(false);
  });

  it('keeps counsellor and parent accounts out of course and operations routes', () => {
    for (const level of ['COUNSELLOR', 'PARENT'] as const) {
      const identity = {role: 'USER' as const, level};
      expect(canAccessCourseCatalogue(identity)).toBe(false);
      expect(canAccessMyOperations(identity)).toBe(false);
      expect(canAccessStandaloneMockExams(identity)).toBe(false);
      expect(canTakeMockExam(identity)).toBe(false);
    }
  });

  it('separates student learning from instructor teaching operations', () => {
    const student = {role: 'USER' as const, level: 'STUDENT' as const};
    const instructor = {role: 'USER' as const, level: 'INSTRUCTOR' as const};
    expect(canUseStudentLearningOperations(student)).toBe(true);
    expect(canTakeMockExam(student)).toBe(true);
    expect(canUseTeachingOperations(student)).toBe(false);
    expect(canUseStudentLearningOperations(instructor)).toBe(false);
    expect(canUseTeachingOperations(instructor)).toBe(true);
    expect(canTakeMockExam(instructor)).toBe(false);
  });

  it('shows course operations only for course staff or platform administrators', () => {
    const student = {role: 'USER' as const, level: 'STUDENT' as const};
    const advisor = {role: 'USER' as const, level: 'ADVISOR' as const};
    expect(canAccessCourseOperations(student, 'Student')).toBe(false);
    expect(canAccessCourseOperations(student, 'TA')).toBe(true);
    expect(canAccessCourseOperations(advisor, 'TA')).toBe(false);
    expect(canAccessCourseOperations({role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'}, null)).toBe(false);
    expect(canAccessCourseOperations({role: 'SYSTEM_ADMIN', level: null}, null)).toBe(true);
  });

  it('gives instructor-advisors both teaching and advisor-compatible LMS access', () => {
    const hybrid = {role: 'USER' as const, level: 'INSTRUCTOR_ADVISOR' as const};
    expect(canAccessDashboard(hybrid)).toBe(false);
    expect(canAccessCourseCatalogue(hybrid)).toBe(true);
    expect(canAccessMyOperations(hybrid)).toBe(true);
    expect(canUseTeachingOperations(hybrid)).toBe(true);
    expect(canAccessStandaloneMockExams(hybrid)).toBe(true);
  });

  it('matches standalone mock-exam access for system and tenant admins', () => {
    expect(canAccessStandaloneMockExams({role: 'SYSTEM_ADMIN', level: null})).toBe(true);
    expect(canAccessStandaloneMockExams({role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'})).toBe(true);
  });
});
