import {describe, expect, it} from 'vitest';
import type {MyCourse} from '@/apis';
import {deriveCourseAccess, NO_COURSE_ACCESS} from './courseAccess';

const membership = (overrides: Partial<MyCourse>): MyCourse => ({
  id: 31,
  courseId: 31,
  courseCode: 'CS101',
  title: 'Computer Science',
  name: 'Computer Science',
  description: null,
  tenantId: 1,
  state: 'Active',
  status: 'Active',
  courseRole: 'Student',
  role: 'Student',
  canGrade: null,
  canPostAnnouncements: null,
  canManageGroups: null,
  canManageContent: null,
  canManageCourseEvents: null,
  primaryInstructor: null,
  createdAt: '2026-08-01T00:00:00',
  updatedAt: '2026-08-01T00:00:00',
  archivedAt: null,
  ...overrides,
});

describe('deriveCourseAccess', () => {
  it('fails closed when the course enrollment is unavailable', () => {
    expect(deriveCourseAccess()).toBe(NO_COURSE_ACCESS);
  });

  it('grants the primary instructor course, assignment, grading and release controls', () => {
    const access = deriveCourseAccess(membership({courseRole: 'Instructor', role: 'Instructor'}));

    expect(access).toMatchObject({
      isInstructor: true,
      canEditCourse: true,
      canConfigureAssignments: true,
      canGrade: true,
      canReleaseGrades: true,
      canUploadMaterials: true,
      canSubmitAssignments: false,
    });
  });

  it.each(['Instructor', 'TA', 'Student'] as const)('denies inactive %s enrollments', courseRole => {
    expect(deriveCourseAccess(membership({courseRole, active: false}))).toBe(NO_COURSE_ACCESS);
  });

  it('limits a TA to explicitly granted course permissions', () => {
    const access = deriveCourseAccess(membership({
      courseRole: 'TA',
      role: 'TA',
      canGrade: true,
      canPostAnnouncements: false,
      canManageGroups: true,
      canManageContent: true,
      canManageCourseEvents: false,
    }));

    expect(access).toMatchObject({
      isTa: true,
      canEditCourse: false,
      canManageTeachingContent: false,
      canConfigureAssignments: false,
      canGrade: true,
      canReleaseGrades: false,
      canUploadMaterials: true,
      canPostAnnouncements: false,
      canManageGroups: true,
      canManageCourseEvents: false,
      canSubmitAssignments: false,
    });
  });

  it('grants TA inherent material upload permission without requiring canManageContent', () => {
    const access = deriveCourseAccess(membership({courseRole: 'TA', role: 'TA'}));

    expect(access.canUploadMaterials).toBe(true);
  });

  it('keeps a Student on student-only assignment behavior', () => {
    const access = deriveCourseAccess(membership({}));

    expect(access).toMatchObject({
      isStudent: true,
      canManageTeachingContent: false,
      canGrade: false,
      canUploadMaterials: false,
      canSubmitAssignments: true,
    });
  });

  it.each(['DRAFT', 'READY', 'PUBLISHED'] as const)('keeps instructor week authoring available for %s delivery', launchState => {
    expect(deriveCourseAccess(membership({courseRole: 'Instructor', role: 'Instructor', launchState}))).toMatchObject({
      canEditCourse: false,
      canManageTeachingContent: true,
    });
  });
});
