import {useId} from 'react';
import {answerKeyErrors, withOfficialAnswers} from './answerKeys';
import ui from '@/components/TenantWorkspace/workspace.module.scss';

export function AnswerKeyFields({
  value,
  onChange,
  path,
}: {
  value: Record<string, unknown>;
  onChange: (value: unknown) => void;
  path: string;
}) {
  const hintId = useId();
  const present =
    Object.prototype.hasOwnProperty.call(value, 'answer') ||
    Object.prototype.hasOwnProperty.call(value, 'answers');
  const errors = answerKeyErrors(value);
  const editable =
    !(
      Object.prototype.hasOwnProperty.call(value, 'answer') &&
      Object.prototype.hasOwnProperty.call(value, 'answers')
    ) &&
    (!present ||
      typeof value.answer === 'string' ||
      (Array.isArray(value.answers) &&
        value.answers.every((answer) => typeof answer === 'string')));
  // Invalid imported keys remain intact for correction in Advanced data.
  if (!editable)
    return (
      <p className={ui.inlineError} role="alert">
        {errors.join(' ')} Correct the answer key in Advanced data; the original
        is preserved.
      </p>
    );
  const answers =
    typeof value.answer === 'string'
      ? [value.answer]
      : Array.isArray(value.answers)
        ? value.answers
        : [];
  return (
    <label>
      <span>Official accepted answers</span>
      <textarea
        aria-label={`${path} / Official accepted answers`}
        aria-describedby={hintId}
        rows={2}
        value={answers.join('\n')}
        onChange={(event) =>
          onChange(withOfficialAnswers(value, event.target.value.split('\n')))
        }
      />
      <small id={hintId}>
        Enter one official answer per line. One line saves a single answer;
        additional lines are equivalent alternatives. Do not leave blank or
        duplicate lines. Word order matters: cow dung and dung cow are different
        answers.
      </small>
      {present && errors.length ? (
        <small className={ui.inlineError} role="alert">
          {errors.join(' ')}
        </small>
      ) : null}
    </label>
  );
}
