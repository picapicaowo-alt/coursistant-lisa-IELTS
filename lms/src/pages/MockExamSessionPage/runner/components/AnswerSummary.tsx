import {formatNumber} from '@/i18n/formatting';
import { useTranslation } from 'react-i18next';
type AnswerSummaryProps = {
  questionNumbers: number[];
  answers: Record<number, string>;
  reviewByQuestion?: Record<number, boolean> | null;
};

/** Counts only the questions in the current section; scores are never inferred from answers. */
export function AnswerSummary({questionNumbers, answers, reviewByQuestion}: AnswerSummaryProps) {
  const { t: translate } = useTranslation();
  const answered = questionNumbers.filter(number => answers[number]?.trim()).length;
  if (reviewByQuestion) {
    const correct = questionNumbers.filter(number => reviewByQuestion[number] === true).length;
    const incorrect = questionNumbers.filter(number => reviewByQuestion[number] === false).length;
    return <div className="answer-summary" aria-label={translate('exams:releasedQuestions')}><span data-state="correct">{translate("common:status.CORRECT")} <strong>{formatNumber(correct)}</strong></span><span data-state="incorrect">{translate("common:status.INCORRECT")} <strong>{formatNumber(incorrect)}</strong></span></div>;
  }
  return <div className="answer-summary" aria-label={translate('exams:answerProgress')}><span data-state="answered">{translate('exams:answered')} <strong>{formatNumber(answered)}</strong></span><span data-state="unanswered">{translate('exams:unanswered')} <strong>{formatNumber(questionNumbers.length - answered)}</strong></span></div>;
}
