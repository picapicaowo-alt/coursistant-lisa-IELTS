import {describe, expect, it} from 'vitest';
import {
  advisorConversationMessageViews,
  advisorConversationViews,
  advisorDashboardView,
  advisorScheduleRequestViews,
  contractItems,
} from './advisorViewModels';

describe('Advisor view models', () => {
  it('normalizes dashboard metrics without exposing raw contract labels', () => {
    const view = advisorDashboardView({assignedStudentCount: 4, onTrackCount: 3, urgentTasks: []});
    expect(view.stats[0]).toMatchObject({label: 'Assigned students', value: 4});
    expect(view.stats[1]).toMatchObject({label: 'On track', value: 3});
    expect(view.urgentTasks).toEqual([]);
    expect(view.stats.find(stat => stat.key === 'atRiskCount')?.value).toBeUndefined();
    expect(advisorDashboardView({atRiskCount: 0}).stats.find(stat => stat.key === 'atRiskCount')?.value).toBe(0);
  });

  it('supports both arrays and page-shaped collections', () => {
    expect(contractItems([{id: 1}])).toHaveLength(1);
    expect(contractItems({items: [{id: 2}]})).toEqual([{id: 2}]);
  });

  it('turns conversation summaries into student-first inbox rows', () => {
    expect(advisorConversationViews([{studentUserId: 560, studentFirstName: 'Student', studentLastName: 'One', unreadCount: 2, threadId: 7}]))
      .toEqual([{studentUserId: 560, studentName: 'Student One', unreadCount: 2, hasThread: true}]);
  });

  it('uses the backend request id and version for schedule decisions', () => {
    expect(advisorScheduleRequestViews({items: [{requestId: 8, version: 3, studentUserId: 9, courseCode: 'IELTS-1'}]}))
      .toEqual([expect.objectContaining({requestId: 8, expectedVersion: 3, studentName: 'Student #9', courseLabel: 'IELTS-1'})]);
  });

  it('keeps message attachment actions tied to returned attachment ids', () => {
    expect(advisorConversationMessageViews([{messageId: 4, body: 'Hello', attachments: [{attachmentId: 6, originalName: 'plan.pdf'}]}]))
      .toEqual([expect.objectContaining({messageId: 4, attachments: [expect.objectContaining({attachmentId: 6, originalName: 'plan.pdf'})]})]);
  });
});
