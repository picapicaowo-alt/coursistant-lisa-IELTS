import {describe, expect, it} from 'vitest';
import {actionTaskResourceId, actionTaskStudentId} from './taskIdentity';

describe('action task student and source identity', () => {
  it('uses a valid student from either contracted location', () => {
    expect(actionTaskStudentId({studentUserId: 4})).toBe(4);
    expect(actionTaskStudentId({target: {studentUserId: 6}})).toBe(6);
    expect(actionTaskStudentId({studentUserId: 0})).toBeUndefined();
  });
  it('never joins conflicting students or treats source IDs as students', () => {
    expect(actionTaskStudentId({studentUserId: 4, target: {studentUserId: 6}})).toBeUndefined();
    expect(actionTaskStudentId({sourceId: 4, sourceReference: '/students/4'})).toBeUndefined();
  });
  it('prefers the exact typed source and retains an opaque source ID as fallback', () => {
    expect(actionTaskResourceId({sourceId: 90, target: {resourceType: 'ADVISOR_TASK', advisorTaskId: 7}})).toBe(7);
    expect(actionTaskResourceId({sourceId: 90})).toBe(90);
    expect(actionTaskResourceId({sourceId: -1})).toBeUndefined();
  });
});
