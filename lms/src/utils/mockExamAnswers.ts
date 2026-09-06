import type {MockExamAnswerBearingQuestionPayload} from '@/apis/types/mockExam';
import {LocalizedError} from '@/i18n/errors';
import {isRecord} from './apiError';

export const MOCK_EXAM_ANSWER_MAX_LENGTH = 512;

export function questionPayloadObject(value: unknown): MockExamAnswerBearingQuestionPayload {
  // Payloads arrive through JSON; this assertion follows the object boundary
  // check and preserves numbered slot IDs and all renderer-specific content.
  if (!isRecord(value)) throw new LocalizedError('exams:validation.questionJson');
  return value as MockExamAnswerBearingQuestionPayload;
}

/** Use this section's actual IDs, including gaps and unanswered slots. */
export function completeMockExamAnswers(questionIds: readonly number[], answers: Record<string, string | null>): Record<string, string> {
  if (!questionIds.length || questionIds.some(id => !Number.isSafeInteger(id) || id <= 0) || new Set(questionIds).size !== questionIds.length)
    throw new LocalizedError('exams:submission.invalidQuestions');
  return Object.fromEntries(questionIds.map(id => {
    const answer = answers[String(id)] ?? '';
    if (typeof answer !== 'string' || answer.length > MOCK_EXAM_ANSWER_MAX_LENGTH)
      throw new LocalizedError('exams:submission.answerTooLong', {number: id, max: MOCK_EXAM_ANSWER_MAX_LENGTH});
    return [String(id), answer];
  }));
}
