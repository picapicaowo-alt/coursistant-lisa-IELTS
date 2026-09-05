import type {CourseGroupMembership, UngroupedStudent} from '@/apis';
import {formatPersonName} from '@/utils/personName';

// Membership and ungrouped-student reads use different name prefixes.
// Preserve legacy displayName only when the current split-name fields are absent.
export const groupMemberName = (member: CourseGroupMembership, fallback: string) => formatPersonName({
  firstName: member.userFirstName,
  middleName: member.userMiddleName,
  lastName: member.userLastName,
}, member.displayName?.trim() || fallback);

export const ungroupedStudentName = (student: UngroupedStudent, fallback: string) => formatPersonName({
  firstName: student.studentFirstName,
  middleName: student.studentMiddleName,
  lastName: student.studentLastName,
}, student.displayName?.trim() || fallback);
