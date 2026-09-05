import {describe, expect, it} from 'vitest';
import {isSectionSubmitted} from './submissionState';

describe('submitted mock exam sections', () => {
  it('keeps untouched sections open after a zero-score reading submission', () => {
    const exam = {status: 'IN_PROGRESS', readingCorrect: 0, readingTotal: 40};
    expect(isSectionSubmitted(exam, 'reading')).toBe(true);
    expect(isSectionSubmitted(exam, 'listening')).toBe(false);
    expect(isSectionSubmitted(exam, 'writing')).toBe(false);
  });
  it('protects writing responses awaiting grading without waiting for all sections', () => {
    expect(isSectionSubmitted({writingTasks: [{taskKey: 'TASK1', content: 'Saved response'}]}, 'writing')).toBe(true);
    expect(isSectionSubmitted({writingGradeStatus: 'PENDING'}, 'writing')).toBe(true);
    expect(isSectionSubmitted({writingScore: 0}, 'writing')).toBe(true);
  });
  it('never reopens a completed exam or a submitted attempt', () => {
    for (const section of ['reading', 'listening', 'writing'] as const) {
      expect(isSectionSubmitted({status: 'COMPLETED'}, section)).toBe(true);
      expect(isSectionSubmitted({attempt: {status: 'SUBMITTED'}}, section)).toBe(true);
      expect(isSectionSubmitted({status: 'READY'}, section)).toBe(false);
    }
  });
});
