import {describe, expect, it} from 'vitest';
import {actionTaskTargetPath} from './actionTaskTarget';

describe('Advisor task navigation', () => {
  it('carries the report and course identity to the authorized student workspace', () => {
    expect(actionTaskTargetPath({resourceType: 'COURSE_REPORT', studentUserId: 3, courseId: 8, reportId: 12})).toBe('/advisor/students/3/support?courseId=8&reportId=12#course-support');
  });
  it('never opens malformed targets or instructor grading from an Advisor task', () => {
    expect(actionTaskTargetPath(null)).toBeNull();
    expect(actionTaskTargetPath({resourceType: 'COURSE_REPORT', studentUserId: 3})).toBeNull();
    expect(actionTaskTargetPath({resourceType: 'STUDENT', studentUserId: -1})).toBeNull();
    expect(actionTaskTargetPath({resourceType: 'SUBMISSION', studentUserId: 3, courseId: 8, submissionId: 2})).toBe('/advisor/students/3/support?courseId=8');
  });
});
