import {useTranslation} from 'react-i18next';
import {formatNumber} from '@/i18n/formatting';
import {isRecord} from '@/utils/apiError';

export function MultiSelectAnswerFields({value, onChange}: {value: unknown; onChange: (value: unknown) => void}) {
  const {t} = useTranslation();
  if (!isRecord(value) || !Array.isArray(value.questionIds) || !Array.isArray(value.options)) return null;
  const answers = isRecord(value.answersByQuestion) ? value.answersByQuestion : {};
  const options = value.options.filter((option): option is string => typeof option === 'string');
  return <fieldset>
    <legend>{t('exams:authoring.officialAnswers')}</legend>
    <p>{t('exams:authoring.multiSelectAnswerHelp')}</p>
    {value.questionIds.filter((id): id is number => typeof id === 'number').map(id => <label key={id}>
      {t('exams:authoring.answerForQuestion', {number: formatNumber(id)})}
      <select value={typeof answers[String(id)] === 'string' ? String(answers[String(id)]) : ''} onChange={event => {
        const next = {...value}; delete next.answer; delete next.answers;
        onChange({...next, answersByQuestion: Object.fromEntries((value.questionIds as number[]).map(questionId => [String(questionId), questionId === id ? event.target.value : answers[String(questionId)] ?? '']))});
      }}>
        <option value="">{t('exams:authoring.chooseAnswer')}</option>
        {options.map(option => <option key={option.charAt(0)} value={option.charAt(0)}>{option}</option>)}
      </select>
    </label>)}
  </fieldset>;
}
