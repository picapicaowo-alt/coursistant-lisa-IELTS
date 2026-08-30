import {describe, expect, it} from 'vitest';
import {
  canAccessCourseCatalogue,
  canAccessCourseOperations,
  canAccessMyOperations,
  canAccessStandaloneMockExams,
  canTakeMockExam,
  canUseStudentLearningOperations,
  canUseTeachingOperations,
} from './roleCapabilities';

describe('role capabilities', () => {
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
    expect(canAccessCourseOperations({role: 'TENANT_ADMIN', level: 'NOT_APPLICABLE'}, null)).toBe(true);
  });

  it('gives instructor-advisors both teaching and advisor-compatible LMS access', () => {
    const hybrid = {role: 'USER' as const, level: 'INSTRUCTOR_ADVISOR' as const};
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
