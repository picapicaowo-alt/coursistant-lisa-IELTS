import {describe, expect, it} from 'vitest';
import {courseLaunchLabel, courseTermLabel, formatCourseDate, formatCourseTime, hasVersionedGroupConfig, parseAdvisorCourseOccurrences, validDeliveryDraft} from './courseManagement';

describe('course management projections', () => {
  it('uses honest launch and term labels', () => {
    expect(courseLaunchLabel('READY')).toBe('Ready to publish');
    expect(courseLaunchLabel(undefined)).toBe('Not configured');
    expect(formatCourseDate(undefined)).toBe('Not provided');
    expect(courseTermLabel({termStartDate: '2026-09-02', termEndDate: '2026-12-09'}))
      .toBe('Sep 2, 2026 – Dec 9, 2026');
  });

  it('fails closed for unresolved modes and versions', () => {
    expect(hasVersionedGroupConfig({deliveryMode: 'GROUP', launchState: 'DRAFT', courseLaunchVersion: 0})).toBe(true);
    for (const config of [undefined, null, {}, {deliveryMode: 'ONE_ON_ONE' as const, launchState: 'DRAFT' as const, courseLaunchVersion: 2}, {deliveryMode: 'GROUP' as const, launchState: 'DRAFT' as const}, {deliveryMode: 'GROUP' as const, courseLaunchVersion: 2}]) {
      expect(hasVersionedGroupConfig(config)).toBe(false);
    }
  });

  it('validates catalog code and integer capacity against the contract', () => {
    expect(validDeliveryDraft({catalogCode: 'C'.repeat(64), capacity: '1'})).toBe(true);
    for (const draft of [{catalogCode: 'C'.repeat(65), capacity: '16'}, {catalogCode: ' ', capacity: '16'}, {catalogCode: 'C', capacity: '1.5'}, {catalogCode: 'C', capacity: ''}, {catalogCode: 'C', capacity: 'NaN'}]) {
      expect(validDeliveryDraft(draft)).toBe(false);
    }
  });

  it('formats API course times for the English management interface', () => {
    expect(formatCourseTime('14:00:00')).toBe('2:00 PM');
    expect(formatCourseTime('09:05')).toBe('9:05 AM');
    expect(formatCourseTime()).toBe('Not provided');
  });

  it('accepts array and page-shaped occurrence reads without inventing rows', () => {
    expect(parseAdvisorCourseOccurrences({items: [
      {occurrenceId: 9, occurrenceDate: '2026-09-09', startTime: '14:00:00'},
      {id: 4, date: '2026-09-02', status: 'SCHEDULED'},
      {id: 'invalid', date: '2026-09-01'},
    ]}).map(item => item.id)).toEqual([4, 9]);
  });
});
