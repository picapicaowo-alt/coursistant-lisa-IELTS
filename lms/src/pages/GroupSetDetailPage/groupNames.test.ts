import {describe, expect, it} from 'vitest';
import {groupMemberName, ungroupedStudentName} from './groupNames';

describe('real group response names', () => {
  it('uses membership names ahead of a stale displayName', () => {
    expect(groupMemberName({groupId: 4, userId: 26, userFirstName: ' Lisha ', userMiddleName: null,
      userLastName: ' testing ', displayName: 'Old name', joinedAt: '', addedByType: 'Self', addedByUserId: 26}, 'Fallback')).toBe('Lisha testing');
  });

  it('reads the different ungrouped-student prefix and retains legacy or localized fallbacks', () => {
    expect(ungroupedStudentName({userId: 26, studentFirstName: 'Lisha', studentLastName: 'testing'}, 'Fallback')).toBe('Lisha testing');
    expect(ungroupedStudentName({userId: 26, displayName: ' Legacy '}, 'Fallback')).toBe('Legacy');
    expect(ungroupedStudentName({userId: 26, studentFirstName: ' ', displayName: null}, '学生 #26')).toBe('学生 #26');
  });
});
