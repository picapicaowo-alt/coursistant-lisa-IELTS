import {describe, expect, it} from 'vitest';
import {buildQuestionSubmission} from './questionSubmission';

describe('buildQuestionSubmission', () => {
  it('includes unanswered questions when a section is partially answered', () => {
    expect(buildQuestionSubmission([11, 12, 21], {11: 'practice', 21: 'B'}))
      .toEqual({'11': 'practice', '12': '', '21': 'B'});
  });

  it('submits a fully blank section using the actual paper question numbers', () => {
    expect(buildQuestionSubmission([3, 7], {})).toEqual({'3': '', '7': ''});
  });

  it('preserves answer values and excludes keys outside the current paper', () => {
    const answers = {1: 'FALSE', 2: '', 99: 'stale'};
    expect(buildQuestionSubmission([1, 2], answers)).toEqual({'1': 'FALSE', '2': ''});
    expect(answers).toEqual({1: 'FALSE', 2: '', 99: 'stale'});
  });
});
