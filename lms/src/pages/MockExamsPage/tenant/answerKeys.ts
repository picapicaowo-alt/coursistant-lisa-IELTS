import {isRecord} from '@/utils/apiError';
import i18n from '@/i18n';
import {formatNumber} from '@/i18n/formatting';
import type {Field} from './questionSchema';
import type {MockExamObjectiveAnswer} from '@/apis/types/mockExam';

/** Supplied Reading/Listening authoring rule; never used for student responses. */
export type ObjectiveAnswerKey = MockExamObjectiveAnswer;

export function hasAnswerSlot(field: Field): boolean {
  return (
    field.type === 'object' &&
    field.fields.id?.type === 'number' &&
    field.fields.id.questionId === true
  );
}

export function answerKeyErrors(value: Record<string, unknown>): string[] {
  const single = Object.prototype.hasOwnProperty.call(value, 'answer');
  const multiple = Object.prototype.hasOwnProperty.call(value, 'answers');
  if (single === multiple)
    return [i18n.t('exams:validation.answerExclusive')];
  if (single)
    return typeof value.answer === 'string' && value.answer.trim()
      ? []
      : [i18n.t('exams:validation.answerNonblank')];
  if (!Array.isArray(value.answers) || !value.answers.length)
    return [i18n.t('exams:validation.answersArray')];
  if (
    value.answers.some((answer) => typeof answer !== 'string' || !answer.trim())
  )
    return [i18n.t('exams:validation.answersNonblank')];
  // Detect equivalent alternatives using the documented outer-space/case rules.
  // Preserve punctuation, internal spaces, word order and the outgoing text.
  const answers = value.answers.map((answer: string) => answer.trim().toLowerCase());
  return new Set(answers).size === answers.length
    ? []
    : [i18n.t('exams:validation.answersUnique')];
}

/** Walk active renderer slots, excluding metadata and dormant text-cell IDs.
 * multiSelect has primitive questionIds; validate its answer map without rewriting it. */
export function objectiveAnswerErrors(field: Field, value: unknown): string[] {
  if (field.type === 'object' && field.fields.questionIds && isRecord(value)) {
    const ids = Array.isArray(value.questionIds) ? value.questionIds.map(String) : [];
    const keys = value.answersByQuestion;
    const options = Array.isArray(value.options) ? value.options.filter((option): option is string => typeof option === 'string').map(option => option.charAt(0)) : [];
    if ('answer' in value || 'answers' in value || !ids.length || !isRecord(keys) || Object.keys(keys).length !== ids.length ||
      ids.some(id => typeof keys[id] !== 'string' || !options.includes(keys[id])) ||
      new Set(Object.values(keys)).size !== ids.length || value.chooseCount !== ids.length)
      return [i18n.t('exams:validation.multiSelectAnswers')];
    return [];
  }
  if (field.type === 'object' && isRecord(value))
    return [
      ...(hasAnswerSlot(field)
        ? answerKeyErrors(value).map(
            (error) => i18n.t('exams:validation.questionContext', {number: typeof value.id === 'number' ? formatNumber(value.id) : String(value.id), error}),
          )
        : []),
      ...Object.entries(field.fields).flatMap(([key, child]) =>
        objectiveAnswerErrors(child, value[key]),
      ),
    ];
  if (field.type === 'list' && Array.isArray(value))
    return value.flatMap((item) => objectiveAnswerErrors(field.item, item));
  if (field.type === 'variant' && isRecord(value)) {
    const variant = field.variants[String(value.type)];
    return variant ? objectiveAnswerErrors(variant, value) : [];
  }
  return [];
}

/** Explicit edits replace the mutually exclusive key, retaining all other data. */
export function withOfficialAnswers(
  value: Record<string, unknown>,
  answers: string[],
): Record<string, unknown> & ObjectiveAnswerKey {
  const next = {...value};
  delete next.answer;
  delete next.answers;
  return answers.length === 1
    ? {...next, answer: answers[0]}
    : {...next, answers};
}
