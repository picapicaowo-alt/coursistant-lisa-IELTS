import {isRecord} from '@/utils/apiError';
import type {Field} from './questionSchema';

/** Supplied Reading/Listening authoring rule; never used for student responses. */
export type ObjectiveAnswerKey =
  {answer: string; answers?: never} | {answer?: never; answers: string[]};

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
    return ['Provide either answer or answers, never both.'];
  if (single)
    return typeof value.answer === 'string' && value.answer.trim()
      ? []
      : ['answer must be a nonblank string.'];
  if (!Array.isArray(value.answers) || !value.answers.length)
    return ['answers must be a nonempty array of strings.'];
  if (
    value.answers.some((answer) => typeof answer !== 'string' || !answer.trim())
  )
    return ['answers must contain only nonblank strings.'];
  // Only trim for duplicate detection. Do not invent grading normalization,
  // reorder words, or change the official text sent to the API.
  const answers = value.answers.map((answer: string) => answer.trim());
  return new Set(answers).size === answers.length
    ? []
    : ['answers must not contain duplicate answers.'];
}

/** Walk active renderer slots, excluding metadata and dormant text-cell IDs.
 * multiSelect has primitive questionIds, so answersByQuestion is untouched. */
export function objectiveAnswerErrors(field: Field, value: unknown): string[] {
  if (field.type === 'object' && isRecord(value))
    return [
      ...(hasAnswerSlot(field)
        ? answerKeyErrors(value).map(
            (error) => `Question ${String(value.id)}: ${error}`,
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
