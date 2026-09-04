import {describe, expect, it} from 'vitest';
import {assignmentSummary, attendanceData, courseRecords, learningWorkDestination} from './learningData';

describe('learning data boundaries', () => {
  it('distinguishes absent and zero progress from real completion', () => {
    expect(assignmentSummary()).toMatchObject({percent: null});
    expect(assignmentSummary({totalAssignmentCount: 0, completedAssignmentCount: 0})).toMatchObject({percent: null, total: 0});
    expect(assignmentSummary({totalAssignmentCount: 2, completedAssignmentCount: 3}).percent).toBeNull();
    expect(assignmentSummary({totalAssignmentCount: 4, completedAssignmentCount: 3, courses: [{courseId: 71, totalAssignmentCount: 2, completedAssignmentCount: 1}]}, 71).percent).toBe(50);
  });
  it('does not assign unlinked records to a selected course', () => {
    expect(courseRecords([{id: 1}, {id: 2, courseId: 71}, {id: 3, courseId: 72}], 71)).toEqual([{id: 2, courseId: 71}]);
    expect(() => attendanceData({unexpected: []})).toThrow();
    expect(attendanceData({presentCount: 0, items: []})).toMatchObject({present: 0, items: []});
  });
  it('uses explicit record identities and refuses external work links', () => {
    expect(learningWorkDestination({courseId: 71, assignmentId: 11})).toBe('/course/71/assignments/11');
    expect(learningWorkDestination({deepLink: 'https://example.test'})).toBeUndefined();
    expect(learningWorkDestination({deepLink: '//example.test'})).toBeUndefined();
    expect(learningWorkDestination({checkpointId: 91, taskId: 101})).toContain('task=101');
  });
});
