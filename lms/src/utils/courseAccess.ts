import type {CourseRole, MyCourse} from '@/apis';

/**
 * UI capabilities for one course enrollment.
 *
 * Platform `user.level` is deliberately absent. A student-level account may
 * be a Student in one course and a TA in another, so every decision here is
 * derived from the enrollment returned by `/v2/me/courses`.
 */
export interface CourseAccess {
  courseRole: CourseRole | null;
  isInstructor: boolean;
  isTa: boolean;
  isStudent: boolean;
  canEditCourse: boolean;
  canManageWeeks: boolean;
  canConfigureAssignments: boolean;
  canGrade: boolean;
  canReleaseGrades: boolean;
  canUploadMaterials: boolean;
  canPostAnnouncements: boolean;
  canManageGroups: boolean;
  canManageCourseEvents: boolean;
  canSubmitAssignments: boolean;
}

export const NO_COURSE_ACCESS: CourseAccess = {
  courseRole: null,
  isInstructor: false,
  isTa: false,
  isStudent: false,
  canEditCourse: false,
  canManageWeeks: false,
  canConfigureAssignments: false,
  canGrade: false,
  canReleaseGrades: false,
  canUploadMaterials: false,
  canPostAnnouncements: false,
  canManageGroups: false,
  canManageCourseEvents: false,
  canSubmitAssignments: false,
};

export const deriveCourseAccess = (membership?: MyCourse): CourseAccess => {
  if (!membership) return NO_COURSE_ACCESS;

  const courseRole = membership.courseRole ?? membership.role;
  const isInstructor = courseRole === 'Instructor';
  const isTa = courseRole === 'TA';
  const isStudent = courseRole === 'Student';

  return {
    courseRole,
    isInstructor,
    isTa,
    isStudent,
    // Course administration and assignment/quiz authoring are Instructor-only.
    // Configured training courses are orchestrated by their owner Advisor.
    canEditCourse: isInstructor && !membership.launchState,
    // Delivery orchestration locks course administration, not the Instructor's
    // documented week/lecture authoring endpoints.
    canManageWeeks: isInstructor,
    canConfigureAssignments: isInstructor,
    // TA permissions are course-scoped flags and never carry to another course.
    canGrade: isInstructor || (isTa && membership.canGrade === true),
    canReleaseGrades: isInstructor,
    // Material upload is an inherent permission of Instructors and active TAs.
    canUploadMaterials: isInstructor || isTa,
    canPostAnnouncements: isInstructor || (isTa && membership.canPostAnnouncements === true),
    canManageGroups: isInstructor || (isTa && membership.canManageGroups === true),
    canManageCourseEvents: isInstructor || (isTa && membership.canManageCourseEvents === true),
    canSubmitAssignments: isStudent,
  };
};
