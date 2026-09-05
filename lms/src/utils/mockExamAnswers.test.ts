import {describe, expect, it} from 'vitest';
import {completeMockExamAnswers, MOCK_EXAM_ANSWER_MAX_LENGTH} from './mockExamAnswers';

describe('mock exam section submission', () => {
  it('fills exactly the configured question set, ignoring stale extra draft keys', () => {
    expect(completeMockExamAnswers([7, 9, 12], {'7': ' A,  B ', '8': 'stale', '9': null})).toEqual({'7': ' A,  B ', '9': '', '12': ''});
  });
  it('preserves each multi-select option as a scalar string', () => {
    expect(completeMockExamAnswers([21, 22], {'21': 'B', '22': 'A'})).toEqual({'21': 'B', '22': 'A'});
  });
  it('rejects invalid question identity and answers over 512 characters', () => {
    for (const ids of [[], [0], [1, 1], [1.2]]) expect(() => completeMockExamAnswers(ids, {})).toThrow();
    expect(completeMockExamAnswers([1], {'1': 'x'.repeat(MOCK_EXAM_ANSWER_MAX_LENGTH)})).toHaveProperty('1');
    expect(() => completeMockExamAnswers([1], {'1': 'x'.repeat(MOCK_EXAM_ANSWER_MAX_LENGTH + 1)})).toThrow();
  });
});
