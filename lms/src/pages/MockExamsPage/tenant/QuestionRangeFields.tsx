import {useTranslation} from 'react-i18next';
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
  const {t: translate} = useTranslation();
  return (
    <>
      <label>
        <span>{translate("exams:authoring.firstQuestion")}</span>
        <input
          required
          type="number"
          min="1"
          value={question.start}
          onChange={(event) => onChange({start: event.target.value})}
        />
      </label>
      <label>
        <span>{translate("exams:authoring.lastQuestion")}</span>
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
