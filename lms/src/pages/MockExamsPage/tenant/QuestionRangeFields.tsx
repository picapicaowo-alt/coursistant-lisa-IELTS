import type {QuestionDraft} from './model';

/** One-group parts expose their range in Settings, as in the supplied design.
 * With several groups each range belongs to its own Content block instead. */
export function QuestionRangeFields({
  question,
  onChange,
}: {
  question: QuestionDraft;
  onChange: (patch: Partial<QuestionDraft>) => void;
}) {
  return (
    <>
      <label>
        <span>First question number</span>
        <input
          required
          type="number"
          min="1"
          value={question.start}
          onChange={(event) => onChange({start: event.target.value})}
        />
      </label>
      <label>
        <span>Last question number</span>
        <input
          required
          type="number"
          min="1"
          value={question.end}
          onChange={(event) => onChange({end: event.target.value})}
        />
      </label>
    </>
  );
}
